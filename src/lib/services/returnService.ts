import { query, queryOne, transaction } from '@/lib/db';

export interface ReturnItemInput {
  variant_id: number;
  returned_quantity: number;
  disposition?: 'pending' | 'sellable' | 'damaged';
  inspection_notes?: string;
}

export interface CreateReturnInput {
  customer_id: number;
  order_id?: number;
  reason: string;
  items: ReturnItemInput[];
  status?: 'draft' | 'pending_approval' | 'pending';
}

export async function createReturn(userId: number, input: CreateReturnInput) {
  if (!input.items || input.items.length === 0) {
    throw new Error('يجب تحديد صنف واحد على الأقل في طلب الإرجاع.');
  }

  const cleanReason = (input.reason || '').trim();
  if (!cleanReason) {
    throw new Error('سبب الإرجاع إلزامي ومطلوب.');
  }

  return await transaction(async (tx) => {
    // If linked to an order, validate that requested quantities do not exceed shipped quantities
    if (input.order_id) {
      const order = await tx.queryOne<{ id: number; order_number: string; status: string }>(
        `SELECT id, order_number, status FROM sales_orders WHERE id = $1`,
        [input.order_id]
      );
      if (!order) throw new Error('الطلب الأصلي المرتبط غير موجود.');

      for (const item of input.items) {
        const qty = Math.floor(Number(item.returned_quantity));
        if (qty <= 0) throw new Error('الكمية المرتجعة يجب أن تكون موجبة أكبر من صفر.');

        // Get original shipped quantity
        const orderLine = await tx.queryOne<{
          shipped_quantity: number;
          model_code: string;
          model_name: string;
          color_name: string;
          size_name: string;
        }>(
          `SELECT soi.shipped_quantity, p.model_code, p.model_name, c.name as color_name, sz.name as size_name
           FROM sales_order_items soi
           JOIN product_variants pv ON soi.variant_id = pv.id
           JOIN products p ON pv.product_id = p.id
           JOIN colors c ON pv.color_id = c.id
           JOIN sizes sz ON pv.size_id = sz.id
           WHERE soi.order_id = $1 AND soi.variant_id = $2`,
          [input.order_id, item.variant_id]
        );

        if (!orderLine) {
          throw new Error('الصنف المرتجع غير موجود في الطلب الأصلي.');
        }

        const shippedQty = Number(orderLine.shipped_quantity || 0);

        // Calculate previously returned quantities for this variant in this order (excluding rejected/canceled)
        const prevReturns = await tx.queryOne<{ total: string | number }>(
          `SELECT SUM(sri.returned_quantity) as total
           FROM sales_return_items sri
           JOIN sales_returns sr ON sri.return_id = sr.id
           WHERE sr.order_id = $1 AND sri.variant_id = $2 AND sr.status NOT IN ('rejected', 'canceled')`,
          [input.order_id, item.variant_id]
        );
        const alreadyReturned = Number(prevReturns?.total || 0);
        const maxReturnable = Math.max(0, shippedQty - alreadyReturned);

        if (qty > maxReturnable) {
          throw new Error(
            `الكمية المرتجعة المطلوبة (${qty} قطعة) للصنف [${orderLine.model_code} - ${orderLine.color_name} - ${orderLine.size_name}] تتجاوز الكمية المشحونة المتاحة للإرجاع (${maxReturnable} قطعة).`
          );
        }
      }
    }

    const returnNumber = `RET-${Date.now().toString().slice(-6)}`;
    const initialStatus = input.status || 'pending_approval';

    const retRows = await tx.query<{ id: number }>(
      `INSERT INTO sales_returns (return_number, order_id, customer_id, reason, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [returnNumber, input.order_id || null, input.customer_id, cleanReason, initialStatus, userId]
    );

    const returnId = retRows[0].id;

    for (const item of input.items) {
      const qty = Math.floor(Number(item.returned_quantity));
      if (qty <= 0) throw new Error('الكمية المرتجعة يجب أن تكون موجبة أكبر من صفر.');

      await tx.execute(
        `INSERT INTO sales_return_items (
           return_id, variant_id, returned_quantity, disposition, inspection_notes, restocked
         ) VALUES ($1, $2, $3, $4, $5, false)`,
        [
          returnId,
          item.variant_id,
          qty,
          item.disposition || 'pending',
          item.inspection_notes || null,
        ]
      );
    }

    // Audit log
    await tx.execute(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
       VALUES ($1, 'CREATE_RETURN_REQUEST', 'sales_return', $2, $3)`,
      [
        userId,
        String(returnId),
        JSON.stringify({ returnNumber, orderId: input.order_id, initialStatus }),
      ]
    );

    return { returnId, returnNumber };
  });
}

export async function approveReturnRequest(returnId: number, approverId: number, notes?: string) {
  return await transaction(async (tx) => {
    const ret = await tx.queryOne<{ id: number; return_number: string; status: string }>(
      `SELECT id, return_number, status FROM sales_returns WHERE id = $1 FOR UPDATE`,
      [returnId]
    );

    if (!ret) throw new Error('طلب الإرجاع غير موجود.');
    if (ret.status === 'approved' || ret.status === 'completed') {
      throw new Error('طلب الإرجاع معتمد مسبقاً.');
    }
    if (ret.status === 'rejected') {
      throw new Error('لا يمكن اعتماد طلب إرجاع مرفوض.');
    }

    // Approve the request (status -> 'approved'). Note: Approval does NOT increase stock!
    await tx.execute(
      `UPDATE sales_returns
       SET status = 'approved',
           approved_by = $1,
           approved_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [approverId, returnId]
    );

    // Audit log
    await tx.execute(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
       VALUES ($1, 'APPROVE_RETURN_REQUEST', 'sales_return', $2, $3)`,
      [
        approverId,
        String(returnId),
        JSON.stringify({ returnNumber: ret.return_number, notes }),
      ]
    );

    return { success: true, returnNumber: ret.return_number };
  });
}

export async function rejectReturnRequest(returnId: number, approverId: number, reason: string) {
  const cleanReason = (reason || '').trim();
  if (!cleanReason) {
    throw new Error('سبب رفض طلب الإرجاع إلزامي ومطلوب.');
  }

  return await transaction(async (tx) => {
    const ret = await tx.queryOne<{ id: number; return_number: string; status: string }>(
      `SELECT id, return_number, status FROM sales_returns WHERE id = $1 FOR UPDATE`,
      [returnId]
    );

    if (!ret) throw new Error('طلب الإرجاع غير موجود.');
    if (ret.status === 'completed') {
      throw new Error('لا يمكن رفض طلب إرجاع تم اكتماله وإعادة بضاعته.');
    }

    await tx.execute(
      `UPDATE sales_returns
       SET status = 'rejected',
           rejected_by = $1,
           rejected_at = CURRENT_TIMESTAMP,
           rejection_reason = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [approverId, cleanReason, returnId]
    );

    // Audit log
    await tx.execute(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
       VALUES ($1, 'REJECT_RETURN_REQUEST', 'sales_return', $2, $3)`,
      [
        approverId,
        String(returnId),
        JSON.stringify({ returnNumber: ret.return_number, reason: cleanReason }),
      ]
    );

    return { success: true, returnNumber: ret.return_number };
  });
}

export async function inspectAndRestockReturnItem(data: {
  userId: number;
  returnId: number;
  itemId: number;
  disposition: 'sellable' | 'damaged';
  inspectionNotes?: string;
  locationId?: number;
}) {
  return await transaction(async (tx) => {
    const item = await tx.queryOne<{
      id: number;
      return_id: number;
      variant_id: number;
      returned_quantity: number;
      disposition: string;
      restocked: boolean;
      return_number: string;
      return_status: string;
    }>(
      `SELECT sri.*, sr.return_number, sr.status as return_status
       FROM sales_return_items sri
       JOIN sales_returns sr ON sri.return_id = sr.id
       WHERE sri.id = $1 AND sri.return_id = $2
       FOR UPDATE`,
      [data.itemId, data.returnId]
    );

    if (!item) throw new Error('بند الإرجاع غير موجود.');
    if (item.return_status === 'rejected') {
      throw new Error('لا يمكن فحص أو إعادة بضاعة لطلب إرجاع مرفوض.');
    }
    if (item.restocked) {
      throw new Error('تم إعادة هذا البند للمخزن مسبقاً، ولا يمكن تكرار الإدخال.');
    }

    let targetLocId = data.locationId;
    if (!targetLocId) {
      const mainLoc = await tx.queryOne<{ id: number }>(
        "SELECT id FROM inventory_locations WHERE location_code = 'MAIN'"
      );
      targetLocId = mainLoc ? mainLoc.id : 1;
    }

    if (data.disposition === 'sellable') {
      // Increment physical stock atomically
      const balance = await tx.queryOne<{ id: number; on_hand_quantity: number }>(
        'SELECT id, on_hand_quantity FROM inventory_balances WHERE variant_id = $1 AND location_id = $2 FOR UPDATE',
        [item.variant_id, targetLocId]
      );

      if (balance) {
        await tx.execute(
          `UPDATE inventory_balances 
           SET on_hand_quantity = on_hand_quantity + $1, updated_at = CURRENT_TIMESTAMP 
           WHERE id = $2`,
          [item.returned_quantity, balance.id]
        );
      } else {
        await tx.execute(
          `INSERT INTO inventory_balances (variant_id, location_id, on_hand_quantity, reserved_quantity)
           VALUES ($1, $2, $3, 0)`,
          [item.variant_id, targetLocId, item.returned_quantity]
        );
      }

      // Reconcile primary shelf if assigned
      const primaryShelf = await tx.queryOne<{ shelf_id: number }>(
        `SELECT shelf_id FROM variant_shelves WHERE variant_id = $1 AND is_primary = true LIMIT 1`,
        [item.variant_id]
      );
      if (primaryShelf) {
        await tx.execute(
          `UPDATE variant_shelves SET quantity = quantity + $1, updated_at = CURRENT_TIMESTAMP WHERE variant_id = $2 AND shelf_id = $3`,
          [item.returned_quantity, item.variant_id, primaryShelf.shelf_id]
        );
      }

      // Record immutable movement
      await tx.execute(
        `INSERT INTO stock_movements (
           variant_id, location_id, movement_type, quantity_delta,
           reference_type, reference_id, reason, created_by
         ) VALUES ($1, $2, 'RETURN_SELLABLE', $3, 'SALES_RETURN', $4, $5, $6)`,
        [
          item.variant_id,
          targetLocId,
          item.returned_quantity,
          item.return_number,
          `مرتجع مبيعات سليم ومعتمد لإعادة البيع رقم ${item.return_number}`,
          data.userId,
        ]
      );

      await tx.execute(
        `UPDATE sales_return_items
         SET disposition = 'sellable', inspection_notes = $1, restocked = true, restocked_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [data.inspectionNotes || null, item.id]
      );
    } else {
      // Damaged items: mark damaged, do NOT touch physical stock!
      await tx.execute(
        `UPDATE sales_return_items
         SET disposition = 'damaged', inspection_notes = $1, restocked = false
         WHERE id = $2`,
        [data.inspectionNotes || 'بضاعة تالفة - لا تعاد للرصيد المتاح للبيع', item.id]
      );
    }

    // Check if all items in return are inspected
    const pendingItems = await tx.queryOne<{ count: string | number }>(
      `SELECT COUNT(*) as count FROM sales_return_items WHERE return_id = $1 AND disposition = 'pending'`,
      [data.returnId]
    );

    if (Number(pendingItems?.count || 0) === 0) {
      await tx.execute(
        `UPDATE sales_returns 
         SET status = 'completed', inspected_by = $1, inspected_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $2`,
        [data.userId, data.returnId]
      );
    } else {
      await tx.execute(
        `UPDATE sales_returns 
         SET status = 'inspected', inspected_by = $1, inspected_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $2`,
        [data.userId, data.returnId]
      );
    }

    return { success: true, restocked: data.disposition === 'sellable' };
  });
}
