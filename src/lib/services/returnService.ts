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
}

export async function createReturn(userId: number, input: CreateReturnInput) {
  if (!input.items || input.items.length === 0) {
    throw new Error('يجب تحديد صنف واحد على الأقل في طلب الإرجاع.');
  }

  const returnNumber = `RET-${Date.now().toString().slice(-6)}`;

  return await transaction(async (tx) => {
    const retRows = await tx.query<{ id: number }>(
      `INSERT INTO sales_returns (return_number, order_id, customer_id, reason, status, created_by)
       VALUES ($1, $2, $3, $4, 'pending', $5)
       RETURNING id`,
      [returnNumber, input.order_id || null, input.customer_id, input.reason.trim(), userId]
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

    return { returnId, returnNumber };
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
    }>(
      `SELECT sri.*, sr.return_number
       FROM sales_return_items sri
       JOIN sales_returns sr ON sri.return_id = sr.id
       WHERE sri.id = $1 AND sri.return_id = $2
       FOR UPDATE`,
      [data.itemId, data.returnId]
    );

    if (!item) throw new Error('بند الإرجاع غير موجود.');
    if (item.restocked) {
      throw new Error('تم إعادة هذا البند للمخزن مسبقاً، ولا يمكن تكرار الإدخال.');
    }

    let targetLocId = data.locationId;
    if (!targetLocId) {
      const mainLoc = await tx.queryOne<{ id: number }>(
        "SELECT id FROM inventory_locations WHERE location_code = 'MAIN'"
      );
      targetLocId = mainLoc!.id;
    }

    if (data.disposition === 'sellable') {
      // Increment physical stock
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
        `UPDATE sales_returns SET status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [data.returnId]
      );
    } else {
      await tx.execute(
        `UPDATE sales_returns SET status = 'inspected', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [data.returnId]
      );
    }

    return { success: true, restocked: data.disposition === 'sellable' };
  });
}
