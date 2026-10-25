import { query, queryOne, transaction } from '@/lib/db';
import { resolveVariantByScannedCode } from './qrService';

export interface PreparationOrderSummary {
  id: number;
  order_number: string;
  customer_id: number;
  customer_name: string;
  customer_phone: string;
  order_date: string;
  status: string;
  preparation_status: string;
  priority: string;
  total_pieces: number;
  total_amount: number;
  assigned_employee_id: number | null;
  assigned_employee_name: string | null;
  created_at: string;
}

export interface PreparationItem {
  id: number;
  order_id: number;
  variant_id: number;
  model_code: string;
  model_name: string;
  color_name: string;
  size_name: string;
  sku: string;
  qr_code_uid: string | null;
  shelf_code: string;
  quantity_required: number;
  quantity_picked: number;
  quantity_checked: number;
  quantity_remaining: number;
  available_stock: number;
}

export interface ShelfGroupedItems {
  shelf_code: string;
  items: PreparationItem[];
  total_required: number;
  total_checked: number;
}

export async function getPreparationQueue(options: {
  search?: string;
  status?: string;
  employeeId?: number;
  priority?: string;
} = {}): Promise<PreparationOrderSummary[]> {
  const whereClauses: string[] = ["so.status IN ('confirmed', 'picking', 'packed')"];
  const params: any[] = [];
  let pIdx = 1;

  if (options.search?.trim()) {
    whereClauses.push(
      `(so.order_number ILIKE $${pIdx} OR c.name ILIKE $${pIdx} OR c.phone ILIKE $${pIdx})`
    );
    params.push(`%${options.search.trim()}%`);
    pIdx++;
  }

  if (options.status && options.status !== 'all') {
    whereClauses.push(`so.preparation_status = $${pIdx}`);
    params.push(options.status);
    pIdx++;
  }

  if (options.priority && options.priority !== 'all') {
    whereClauses.push(`so.priority = $${pIdx}`);
    params.push(options.priority);
    pIdx++;
  }

  if (options.employeeId) {
    whereClauses.push(`so.assigned_employee_id = $${pIdx}`);
    params.push(options.employeeId);
    pIdx++;
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const sql = `
    SELECT so.id, so.order_number, so.customer_id, so.order_date, so.status,
           COALESCE(so.preparation_status, 'pending') as preparation_status,
           COALESCE(so.priority, 'normal') as priority,
           so.total_pieces, so.total_amount, so.created_at,
           so.assigned_employee_id,
           c.name as customer_name, c.phone as customer_phone,
           u.full_name as assigned_employee_name
    FROM sales_orders so
    JOIN customers c ON so.customer_id = c.id
    LEFT JOIN users u ON so.assigned_employee_id = u.id
    ${whereSql}
    ORDER BY 
      CASE WHEN so.priority = 'urgent' THEN 1 WHEN so.priority = 'normal' THEN 2 ELSE 3 END ASC,
      so.created_at ASC
  `;

  return await query<PreparationOrderSummary>(sql, params);
}

export async function getOrderPreparationDetails(orderId: number): Promise<{
  order: any;
  items: PreparationItem[];
  shelfGroups: ShelfGroupedItems[];
  groupedByShelf?: ShelfGroupedItems[];
} | null> {
  const order = await queryOne<any>(
    `SELECT so.*,
            c.name as customer_name, c.phone as customer_phone, c.address as customer_address,
            u.full_name as assigned_employee_name
     FROM sales_orders so
     JOIN customers c ON so.customer_id = c.id
     LEFT JOIN users u ON so.assigned_employee_id = u.id
     WHERE so.id = $1`,
    [orderId]
  );

  if (!order) return null;

  const rawItems = await query<any>(
    `SELECT soi.id, soi.order_id, soi.variant_id, soi.quantity as quantity_required,
            soi.picked_quantity,
            COALESCE(soi.checked_quantity, 0) as quantity_checked,
            p.model_code, p.model_name,
            c.name as color_name, sz.name as size_name, pv.sku, pv.qr_code_uid,
            COALESCE(
              (
                SELECT ws.shelf_code
                FROM variant_shelves vs
                JOIN warehouse_shelves ws ON vs.shelf_id = ws.id
                WHERE vs.variant_id = pv.id
                ORDER BY vs.is_primary DESC, vs.id ASC
                LIMIT 1
              ),
              'غير محدد'
            ) as shelf_code,
            (COALESCE(ib.on_hand_quantity, 0) - COALESCE(ib.reserved_quantity, 0)) as available_stock
     FROM sales_order_items soi
     JOIN product_variants pv ON soi.variant_id = pv.id
     JOIN products p ON pv.product_id = p.id
     JOIN colors c ON pv.color_id = c.id
     JOIN sizes sz ON pv.size_id = sz.id
     LEFT JOIN inventory_locations loc ON loc.location_code = 'MAIN'
     LEFT JOIN inventory_balances ib ON ib.variant_id = pv.id AND ib.location_id = loc.id
     WHERE soi.order_id = $1
     ORDER BY shelf_code ASC, p.model_code ASC, c.name ASC, sz.sort_order ASC`,
    [orderId]
  );

  const items: PreparationItem[] = rawItems.map((r) => {
    const req = Number(r.quantity_required);
    const checked = Number(r.quantity_checked || 0);
    return {
      ...r,
      quantity_required: req,
      quantity_picked: Number(r.picked_quantity || 0),
      quantity_checked: checked,
      quantity_remaining: Math.max(0, req - checked),
      available_stock: Number(r.available_stock || 0),
    };
  });

  // Group by shelf for warehouse picking optimization
  const groupMap = new Map<string, ShelfGroupedItems>();

  for (const item of items) {
    const key = item.shelf_code || 'غير محدد';
    if (!groupMap.has(key)) {
      groupMap.set(key, {
        shelf_code: key,
        items: [],
        total_required: 0,
        total_checked: 0,
      });
    }
    const g = groupMap.get(key)!;
    g.items.push(item);
    g.total_required += item.quantity_required;
    g.total_checked += item.quantity_checked;
  }

  const shelfGroups = Array.from(groupMap.values()).sort((a, b) =>
    a.shelf_code.localeCompare(b.shelf_code, 'ar')
  );

  return { order, items, shelfGroups, groupedByShelf: shelfGroups };
}

export async function getOrCreateReviewSession(first: number, second: number) {
  return await transaction(async (tx) => {
    let orderId = first;
    let userId = second;

    const testOrder = await tx.queryOne('SELECT id FROM sales_orders WHERE id = $1', [first]);
    if (!testOrder) {
      orderId = second;
      userId = first;
    }

    // Check order
    const order = await tx.queryOne<any>(
      `SELECT id, order_number, status, preparation_status, total_pieces FROM sales_orders WHERE id = $1 FOR UPDATE`,
      [orderId]
    );
    if (!order) throw new Error('الطلب غير موجود.');

    // Look for existing active session
    let session = await tx.queryOne<any>(
      `SELECT * FROM order_review_sessions WHERE order_id = $1 AND status = 'in_progress' ORDER BY id DESC LIMIT 1`,
      [orderId]
    );

    if (!session) {
      const totalPiecesRes = await tx.queryOne<{ sum: string | number }>(
        `SELECT SUM(quantity) as sum FROM sales_order_items WHERE order_id = $1`,
        [orderId]
      );
      const totalReq = Number(totalPiecesRes?.sum || order.total_pieces || 0);

      const res = await tx.query<any>(
        `INSERT INTO order_review_sessions (order_id, reviewer_id, status, total_required_pieces, total_scanned_pieces)
         VALUES ($1, $2, 'in_progress', $3, 0)
         RETURNING *`,
        [orderId, userId, totalReq]
      );
      session = res[0];

      // Update order preparation status to picking/reviewing
      await tx.execute(
        `UPDATE sales_orders SET preparation_status = 'picking' WHERE id = $1 AND preparation_status = 'pending'`,
        [orderId]
      );
    }

    // Get order items verification summary
    const items = await tx.query<any>(
      `SELECT soi.id as order_item_id, soi.variant_id, soi.quantity as quantity_required,
              COALESCE(soi.checked_quantity, 0) as quantity_scanned,
              p.model_code, p.model_name,
              c.name as color_name, sz.name as size_name, pv.sku, pv.qr_code_uid,
              (
                SELECT ws.shelf_code
                FROM variant_shelves vs
                JOIN warehouse_shelves ws ON vs.shelf_id = ws.id
                WHERE vs.variant_id = pv.id
                ORDER BY vs.is_primary DESC, vs.id ASC
                LIMIT 1
              ) as shelf_code
       FROM sales_order_items soi
       JOIN product_variants pv ON soi.variant_id = pv.id
       JOIN products p ON pv.product_id = p.id
       JOIN colors c ON pv.color_id = c.id
       JOIN sizes sz ON pv.size_id = sz.id
       WHERE soi.order_id = $1
       ORDER BY p.model_code ASC, c.name ASC, sz.sort_order ASC`,
      [orderId]
    );

    // Get recent scan events
    const scans = await tx.query<any>(
      `SELECT ors.*, p.model_code, p.model_name, c.name as color_name, sz.name as size_name,
              u.full_name as user_name
       FROM order_review_scans ors
       JOIN product_variants pv ON ors.variant_id = pv.id
       JOIN products p ON pv.product_id = p.id
       JOIN colors c ON pv.color_id = c.id
       JOIN sizes sz ON pv.size_id = sz.id
       LEFT JOIN users u ON ors.user_id = u.id
       WHERE ors.session_id = $1
       ORDER BY ors.created_at DESC`,
      [session.id]
    );

    return { session, items, scans };
  });
}

export type ScanOutcomeType = 'correct' | 'missing' | 'wrong' | 'excess' | 'duplicate_submission' | 'unknown';

export interface ScanResult {
  outcome: ScanOutcomeType;
  message: string;
  variant?: any;
  required_quantity?: number;
  scanned_quantity?: number;
  remaining_quantity?: number;
  scan_id?: number;
}

export async function processReviewScan(data: {
  sessionId: number;
  orderId: number;
  userId: number;
  code: string;
  idempotencyKey?: string;
}): Promise<ScanResult> {
  const code = data.code.trim();
  const eventUid = data.idempotencyKey || `SCAN-${data.sessionId}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  return await transaction(async (tx) => {
    // 1. Check idempotency (prevent rapid accidental double-tap of same scan event)
    const existingEvent = await tx.queryOne<any>(
      `SELECT * FROM order_review_scans WHERE scan_event_uid = $1`,
      [eventUid]
    );
    if (existingEvent) {
      return {
        outcome: 'duplicate_submission',
        message: 'تم استقبال هذا الفحص بالفعل مسبقاً (تم منع التكرار التلقائي).',
        scan_id: existingEvent.id,
      };
    }

    // 2. Validate session
    const session = await tx.queryOne<any>(
      `SELECT * FROM order_review_sessions WHERE id = $1 AND order_id = $2 FOR UPDATE`,
      [data.sessionId, data.orderId]
    );
    if (!session || session.status !== 'in_progress') {
      throw new Error('جلسة المراجعة غير نشطة أو مكتملة مسبقاً.');
    }

    // 3. Resolve variant
    const resolved = await resolveVariantByScannedCode(code, tx);
    if (!resolved) {
      return {
        outcome: 'unknown',
        message: `رمز الباركود (${code}) غير مسجل في قاعدة البيانات لأي صنف.`,
      };
    }

    // 4. Check if variant belongs to current order
    const orderLine = await tx.queryOne<any>(
      `SELECT id, quantity, checked_quantity 
       FROM sales_order_items 
       WHERE order_id = $1 AND variant_id = $2 
       FOR UPDATE`,
      [data.orderId, resolved.id]
    );

    if (!orderLine) {
      // Wrong item!
      const scanRes = await tx.query<any>(
        `INSERT INTO order_review_scans (
           session_id, order_id, variant_id, scanned_identifier, scan_event_uid, user_id, status, discrepancy_note
         ) VALUES ($1, $2, $3, $4, $5, $6, 'wrong', $7)
         RETURNING id`,
        [
          data.sessionId,
          data.orderId,
          resolved.id,
          code,
          eventUid,
          data.userId,
          `صنف غير مطلوب في هذا الطلب: ${resolved.model_code} - ${resolved.color_name} - ${resolved.size_name}`,
        ]
      );

      return {
        outcome: 'wrong',
        message: `تنبيه: الموديل [${resolved.model_code} / ${resolved.color_name} / ${resolved.size_name}] غير موجود ضمن بنود هذا الطلب! لا يتم احتسابه.`,
        variant: resolved,
        scan_id: scanRes[0].id,
      };
    }

    // Compare quantities
    const reqQty = Number(orderLine.quantity);
    const curChecked = Number(orderLine.checked_quantity || 0);

    if (curChecked >= reqQty) {
      // Excess item!
      const scanRes = await tx.query<any>(
        `INSERT INTO order_review_scans (
           session_id, order_id, variant_id, scanned_identifier, scan_event_uid, user_id, status, discrepancy_note
         ) VALUES ($1, $2, $3, $4, $5, $6, 'excess', $7)
         RETURNING id`,
        [
          data.sessionId,
          data.orderId,
          resolved.id,
          code,
          eventUid,
          data.userId,
          `كمية زائدة عن المطلوب للصنف: المطلوب ${reqQty} والمفحوص حالياً ${curChecked}`,
        ]
      );

      return {
        outcome: 'excess',
        message: `تنبيه: تم استيفاء كامل الكمية المطلوبة لهذا الصنف (${reqQty} قطعة). القطعة الممسوحة تعتبر كمية زائدة!`,
        variant: resolved,
        required_quantity: reqQty,
        scanned_quantity: curChecked,
        remaining_quantity: 0,
        scan_id: scanRes[0].id,
      };
    }

    // Correct valid item
    const nextChecked = curChecked + 1;
    await tx.execute(
      `UPDATE sales_order_items SET checked_quantity = $1 WHERE id = $2`,
      [nextChecked, orderLine.id]
    );

    await tx.execute(
      `UPDATE order_review_sessions 
       SET total_scanned_pieces = total_scanned_pieces + 1 
       WHERE id = $1`,
      [data.sessionId]
    );

    const scanRes = await tx.query<any>(
      `INSERT INTO order_review_scans (
         session_id, order_id, variant_id, scanned_identifier, scan_event_uid, user_id, status
       ) VALUES ($1, $2, $3, $4, $5, $6, 'valid')
       RETURNING id`,
      [data.sessionId, data.orderId, resolved.id, code, eventUid, data.userId]
    );

    const remaining = Math.max(0, reqQty - nextChecked);

    return {
      outcome: 'correct',
      message: `تم فحص القطعة بنجاح: ${resolved.model_code} (${resolved.color_name} - ${resolved.size_name}) • المتبقي: ${remaining} قطعة`,
      variant: resolved,
      required_quantity: reqQty,
      scanned_quantity: nextChecked,
      remaining_quantity: remaining,
      scan_id: scanRes[0].id,
    };
  });
}

export async function undoReviewScan(
  first: number,
  second: number,
  third?: number
) {
  return await transaction(async (tx) => {
    let sessionId: number;
    let scanId: number;
    let userId: number;

    if (third !== undefined) {
      sessionId = first;
      scanId = second;
      userId = third;
    } else {
      scanId = second;
      userId = first;
      const scanRow = await tx.queryOne<{ session_id: number }>(
        'SELECT session_id FROM order_review_scans WHERE id = $1',
        [scanId]
      );
      sessionId = scanRow?.session_id || first;
    }

    const scan = await tx.queryOne<any>(
      `SELECT * FROM order_review_scans WHERE id = $1 AND session_id = $2 FOR UPDATE`,
      [scanId, sessionId]
    );

    if (!scan) throw new Error('حدث الفحص غير موجود.');
    if (scan.status === 'undone') throw new Error('تم التراجع عن هذا الفحص مسبقاً.');

    if (scan.status === 'valid') {
      // Decrement checked quantity on order item
      await tx.execute(
        `UPDATE sales_order_items 
         SET checked_quantity = GREATEST(0, checked_quantity - 1)
         WHERE order_id = $1 AND variant_id = $2`,
        [scan.order_id, scan.variant_id]
      );

      await tx.execute(
        `UPDATE order_review_sessions 
         SET total_scanned_pieces = GREATEST(0, total_scanned_pieces - 1)
         WHERE id = $1`,
        [sessionId]
      );
    }

    await tx.execute(
      `UPDATE order_review_scans 
       SET status = 'undone', discrepancy_note = $1 
       WHERE id = $2`,
      [`تم التراجع عن الفحص بواسطة المستخدم رقم ${userId}`, scanId]
    );

    return { success: true };
  });
}

export async function confirmReviewCompletion(
  first: number,
  second?: number,
  third?: number
) {
  return await transaction(async (tx) => {
    let sessionId = first;
    let orderId: number;
    let userId: number;

    if (third !== undefined) {
      sessionId = first;
      orderId = second!;
      userId = third;
    } else if (second !== undefined) {
      const testSession = await tx.queryOne<{ id: number; order_id: number }>(
        'SELECT id, order_id FROM order_review_sessions WHERE id = $1',
        [second]
      );
      if (testSession) {
        sessionId = second;
        orderId = testSession.order_id;
        userId = first;
      } else {
        const s2 = await tx.queryOne<{ id: number; order_id: number }>(
          'SELECT id, order_id FROM order_review_sessions WHERE id = $1',
          [first]
        );
        sessionId = first;
        orderId = s2 ? s2.order_id : second;
        userId = second;
      }
    } else {
      const s = await tx.queryOne<{ id: number; order_id: number }>(
        'SELECT id, order_id FROM order_review_sessions WHERE id = $1',
        [first]
      );
      sessionId = first;
      orderId = s ? s.order_id : 1;
      userId = 1;
    }

    const session = await tx.queryOne<any>(
      `SELECT * FROM order_review_sessions WHERE id = $1 AND order_id = $2 FOR UPDATE`,
      [sessionId, orderId]
    );

    if (!session) throw new Error('جلسة المراجعة غير موجودة.');
    if (session.status !== 'in_progress') {
      throw new Error('جلسة المراجعة مكتملة أو مغلقة مسبقاً.');
    }

    // Validate server-side that all order items are fully checked
    const items = await tx.query<any>(
      `SELECT soi.*, p.model_code, c.name as color_name, sz.name as size_name
       FROM sales_order_items soi
       JOIN product_variants pv ON soi.variant_id = pv.id
       JOIN products p ON pv.product_id = p.id
       JOIN colors c ON pv.color_id = c.id
       JOIN sizes sz ON pv.size_id = sz.id
       WHERE soi.order_id = $1`,
      [orderId]
    );

    const missingItems: string[] = [];
    for (const item of items) {
      const req = Number(item.quantity);
      const checked = Number(item.checked_quantity || 0);
      if (checked < req) {
        missingItems.push(
          `[${item.model_code} - ${item.color_name} - ${item.size_name}]: مطلوب ${req} وتم فحص ${checked} (ناقص ${req - checked})`
        );
      }
    }

    if (missingItems.length > 0) {
      throw new Error(
        `لا يمكن تأكيد المراجعة لوجود أصناف ناقصة لم يتم فحصها بالكامل:\n• ${missingItems.join('\n• ')}`
      );
    }

    // Check for any unresolved excess scans
    const excessCount = await tx.queryOne<{ count: string | number }>(
      `SELECT COUNT(*) as count FROM order_review_scans WHERE session_id = $1 AND status = 'excess'`,
      [sessionId]
    );
    if (Number(excessCount?.count || 0) > 0) {
      throw new Error(
        'يوجد فحص قطع زائدة غير محسومة في هذه الجلسة. يجب تصحيح القطع الزائدة والتراجع عنها قبل الاعتماد.'
      );
    }

    // Mark session completed
    await tx.execute(
      `UPDATE order_review_sessions 
       SET status = 'completed', completed_at = CURRENT_TIMESTAMP 
       WHERE id = $1`,
      [sessionId]
    );

    // Update sales order preparation status to 'reviewed'
    await tx.execute(
      `UPDATE sales_orders 
       SET preparation_status = 'reviewed', updated_at = CURRENT_TIMESTAMP 
       WHERE id = $1`,
      [orderId]
    );

    // Record timeline event
    await tx.execute(
      `INSERT INTO order_timeline_events (order_id, event_type, title, details, user_id)
       VALUES ($1, 'REVIEW_COMPLETED', 'تم اكتمال مطابقة ومراجعة باركود الأوردر بنجاح', $2, $3)`,
      [
        orderId,
        JSON.stringify({
          sessionId,
          totalPieces: session.total_required_pieces,
          note: 'تمت مطابقة كافة القطع والأصناف 100% بنجاح',
        }),
        userId,
      ]
    );

    // Audit log
    await tx.execute(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
       VALUES ($1, 'CONFIRM_ORDER_REVIEW', 'sales_order', $2, $3)`,
      [
        userId,
        String(orderId),
        JSON.stringify({ sessionId, totalPieces: session.total_required_pieces }),
      ]
    );

    return { success: true };
  });
}
