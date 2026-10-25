import { query, queryOne, transaction } from '@/lib/db';

export interface AuditSessionSummary {
  id: number;
  session_number: string;
  audit_mode: string;
  warehouse_id: number;
  warehouse_name: string;
  status: string;
  notes: string | null;
  total_variants: number;
  counted_variants: number;
  matched_variants: number;
  discrepancy_variants: number;
  created_by_name: string | null;
  approved_by_name: string | null;
  created_at: string;
  approved_at: string | null;
  closed_at: string | null;
}

export interface AuditLineItem {
  id: number;
  session_id: number;
  variant_id: number;
  model_code: string;
  model_name: string;
  color_name: string;
  size_name: string;
  sku: string;
  qr_code_uid: string | null;
  shelf_id: number | null;
  shelf_code: string | null;
  system_physical_quantity: number;
  system_reserved_quantity: number;
  system_available_quantity: number;
  counted_quantity: number | null;
  discrepancy: number;
  reconciliation_status: string;
  notes: string | null;
  counted_by_name: string | null;
  counted_at: string | null;
  sold_last_30_days: number;
}

export async function createAuditSession(
  userId: number,
  input: {
    audit_mode?: 'full' | 'by_model' | 'by_category' | 'by_shelf' | 'selected_variants' | 'cycle_count';
    auditMode?: 'full' | 'by_model' | 'by_category' | 'by_shelf' | 'selected_variants' | 'cycle_count';
    warehouse_id?: number;
    warehouseId?: number;
    notes?: string;
    model_id?: number;
    category_id?: number;
    shelf_id?: number;
    variant_ids?: number[];
  }
) {
  return await transaction(async (tx) => {
    const auditMode = input.audit_mode || input.auditMode || 'full';
    let warehouseId = input.warehouse_id || input.warehouseId;
    if (!warehouseId) {
      const mainLoc = await tx.queryOne<{ id: number }>(
        `SELECT id FROM inventory_locations WHERE location_code = 'MAIN' LIMIT 1`
      );
      warehouseId = mainLoc?.id || 1;
    }

    const dateStr = new Date().toISOString().slice(2, 7).replace('-', '');
    const randSuffix = Math.floor(1000 + Math.random() * 9000);
    const sessionNumber = `AUD-${dateStr}-${randSuffix}`;

    const sessionRes = await tx.query<{ id: number }>(
      `INSERT INTO inventory_audit_sessions (
         session_number, audit_mode, warehouse_id, status, notes, created_by
       ) VALUES ($1, $2, $3, 'in_progress', $4, $5)
       RETURNING id`,
      [sessionNumber, auditMode, warehouseId, input.notes?.trim() || null, userId]
    );

    const sessionId = sessionRes[0].id;

    // Filter variants based on scope
    const whereClauses: string[] = ['pv.active = true', 'p.active = true'];
    const params: any[] = [];
    let pIdx = 1;

    if (input.audit_mode === 'by_model' && input.model_id) {
      whereClauses.push(`p.id = $${pIdx}`);
      params.push(input.model_id);
      pIdx++;
    } else if (input.audit_mode === 'by_category' && input.category_id) {
      whereClauses.push(`p.category_id = $${pIdx}`);
      params.push(input.category_id);
      pIdx++;
    } else if (input.audit_mode === 'by_shelf' && input.shelf_id) {
      whereClauses.push(`vs.shelf_id = $${pIdx}`);
      params.push(input.shelf_id);
      pIdx++;
    } else if (input.audit_mode === 'selected_variants' && input.variant_ids && input.variant_ids.length > 0) {
      whereClauses.push(`pv.id = ANY($${pIdx}::int[])`);
      params.push(input.variant_ids);
      pIdx++;
    }

    const whereSql = `WHERE ${whereClauses.join(' AND ')}`;

    // Query matching variants with balances and shelf
    const variants = await tx.query<any>(
      `SELECT DISTINCT pv.id as variant_id,
              COALESCE(ib.on_hand_quantity, 0) as on_hand_quantity,
              COALESCE(ib.reserved_quantity, 0) as reserved_quantity,
              (COALESCE(ib.on_hand_quantity, 0) - COALESCE(ib.reserved_quantity, 0)) as available_quantity,
              (
                SELECT vs.shelf_id
                FROM variant_shelves vs
                WHERE vs.variant_id = pv.id
                ORDER BY vs.is_primary DESC, vs.id ASC
                LIMIT 1
              ) as shelf_id
       FROM product_variants pv
       JOIN products p ON pv.product_id = p.id
       LEFT JOIN variant_shelves vs ON vs.variant_id = pv.id
       LEFT JOIN inventory_balances ib ON ib.variant_id = pv.id AND ib.location_id = $${pIdx}
       ${whereSql}`,
      [...params, warehouseId]
    );

    for (const v of variants) {
      await tx.execute(
        `INSERT INTO inventory_audit_lines (
           session_id, variant_id, shelf_id,
           system_physical_quantity, system_reserved_quantity, system_available_quantity,
           reconciliation_status
         ) VALUES ($1, $2, $3, $4, $5, $6, 'pending')`,
        [
          sessionId,
          v.variant_id,
          v.shelf_id || null,
          Number(v.on_hand_quantity || 0),
          Number(v.reserved_quantity || 0),
          Number(v.available_quantity || 0),
        ]
      );
    }

    // Audit log
    await tx.execute(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
       VALUES ($1, 'CREATE_INVENTORY_AUDIT_SESSION', 'inventory_audit_session', $2, $3)`,
      [
        userId,
        String(sessionId),
        JSON.stringify({ sessionNumber, mode: input.audit_mode, variantsCount: variants.length }),
      ]
    );

    return { sessionId, sessionNumber, variantsCount: variants.length };
  });
}

export async function getAuditSessionsList(): Promise<AuditSessionSummary[]> {
  const sql = `
    SELECT ias.*,
           COALESCE(loc.name, 'المستودع الرئيسي') as warehouse_name,
           u1.full_name as created_by_name,
           u2.full_name as approved_by_name,
           COUNT(ial.id) as total_variants,
           COUNT(ial.id) FILTER (WHERE ial.counted_quantity IS NOT NULL) as counted_variants,
           COUNT(ial.id) FILTER (WHERE ial.reconciliation_status = 'matched') as matched_variants,
           COUNT(ial.id) FILTER (WHERE ial.reconciliation_status = 'discrepancy') as discrepancy_variants
    FROM inventory_audit_sessions ias
    LEFT JOIN inventory_locations loc ON ias.warehouse_id = loc.id
    LEFT JOIN users u1 ON ias.created_by = u1.id
    LEFT JOIN users u2 ON ias.approved_by = u2.id
    LEFT JOIN inventory_audit_lines ial ON ial.session_id = ias.id
    GROUP BY ias.id, loc.name, u1.full_name, u2.full_name
    ORDER BY ias.created_at DESC
  `;

  const rows = await query<any>(sql);
  return rows.map((r) => ({
    ...r,
    total_variants: Number(r.total_variants || 0),
    counted_variants: Number(r.counted_variants || 0),
    matched_variants: Number(r.matched_variants || 0),
    discrepancy_variants: Number(r.discrepancy_variants || 0),
  }));
}

export async function getAuditSessionDetails(sessionId: number): Promise<{
  session: any;
  lines: AuditLineItem[];
} | null> {
  const session = await queryOne<any>(
    `SELECT ias.*,
            COALESCE(loc.name, 'المستودع الرئيسي') as warehouse_name,
            u1.full_name as created_by_name,
            u2.full_name as approved_by_name
     FROM inventory_audit_sessions ias
     LEFT JOIN inventory_locations loc ON ias.warehouse_id = loc.id
     LEFT JOIN users u1 ON ias.created_by = u1.id
     LEFT JOIN users u2 ON ias.approved_by = u2.id
     WHERE ias.id = $1`,
    [sessionId]
  );

  if (!session) return null;

  const rawLines = await query<any>(
    `SELECT ial.*,
            p.model_code, p.model_name,
            c.name as color_name, sz.name as size_name, pv.sku, pv.qr_code_uid,
            ws.shelf_code,
            u.full_name as counted_by_name,
            COALESCE((
              SELECT SUM(soi.shipped_quantity)
              FROM sales_order_items soi
              JOIN sales_orders so ON soi.order_id = so.id
              WHERE soi.variant_id = pv.id 
                AND so.status = 'shipped' 
                AND so.shipped_at >= CURRENT_TIMESTAMP - INTERVAL '30 days'
            ), 0) as sold_last_30_days
     FROM inventory_audit_lines ial
     JOIN product_variants pv ON ial.variant_id = pv.id
     JOIN products p ON pv.product_id = p.id
     JOIN colors c ON pv.color_id = c.id
     JOIN sizes sz ON pv.size_id = sz.id
     LEFT JOIN warehouse_shelves ws ON ial.shelf_id = ws.id
     LEFT JOIN users u ON ial.counted_by = u.id
     WHERE ial.session_id = $1
     ORDER BY ws.shelf_code ASC NULLS LAST, p.model_code ASC, c.name ASC, sz.sort_order ASC`,
    [sessionId]
  );

  const lines: AuditLineItem[] = rawLines.map((r) => ({
    id: r.id,
    session_id: r.session_id,
    variant_id: r.variant_id,
    model_code: r.model_code,
    model_name: r.model_name,
    color_name: r.color_name,
    size_name: r.size_name,
    sku: r.sku,
    qr_code_uid: r.qr_code_uid,
    shelf_id: r.shelf_id,
    shelf_code: r.shelf_code,
    system_physical_quantity: Number(r.system_physical_quantity || 0),
    system_reserved_quantity: Number(r.system_reserved_quantity || 0),
    system_available_quantity: Number(r.system_available_quantity || 0),
    counted_quantity: r.counted_quantity !== null ? Number(r.counted_quantity) : null,
    discrepancy: Number(r.discrepancy || 0),
    reconciliation_status: r.reconciliation_status,
    notes: r.notes,
    counted_by_name: r.counted_by_name,
    counted_at: r.counted_at,
    sold_last_30_days: Number(r.sold_last_30_days || 0),
  }));

  return { session, lines };
}

export async function updateAuditLineCount(
  first: any,
  second?: any,
  third?: any,
  fourth?: any,
  fifth?: any
) {
  let sessionId: number;
  let lineId: number;
  let countedQty: number;
  let userId: number;
  let notes: string | undefined;

  if (typeof first === 'object' && first !== null) {
    sessionId = first.sessionId;
    lineId = first.lineId;
    countedQty = Number(first.countedQuantity ?? first.countedQty ?? 0);
    userId = first.userId || 1;
    notes = first.notes;
  } else if (typeof second === 'object' && second !== null) {
    userId = first;
    lineId = second.lineId;
    countedQty = Number(second.countedQuantity ?? second.countedQty ?? 0);
    notes = second.notes;
    sessionId = second.sessionId;
    if (!sessionId) {
      const lineRow = await queryOne<{ session_id: number }>(
        'SELECT session_id FROM inventory_audit_lines WHERE id = $1',
        [lineId]
      );
      sessionId = lineRow?.session_id || 1;
    }
  } else {
    sessionId = first;
    lineId = second;
    countedQty = third;
    userId = fourth;
    notes = fifth;
  }
  const line = await queryOne<any>(
    `SELECT * FROM inventory_audit_lines WHERE id = $1 AND session_id = $2`,
    [lineId, sessionId]
  );
  if (!line) throw new Error('بند الجرد غير موجود.');

  const session = await queryOne<any>(
    `SELECT status FROM inventory_audit_sessions WHERE id = $1`,
    [sessionId]
  );
  if (session.status !== 'in_progress' && session.status !== 'draft') {
    throw new Error('لا يمكن تعديل العد لجلسة جرد معتمدة أو مغلقة.');
  }

  const sysPhysical = Number(line.system_physical_quantity);
  const diff = countedQty - sysPhysical;
  const status = diff === 0 ? 'matched' : 'discrepancy';

  await query(
    `UPDATE inventory_audit_lines
     SET counted_quantity = $1,
         discrepancy = $2,
         reconciliation_status = $3,
         notes = $4,
         counted_by = $5,
         counted_at = CURRENT_TIMESTAMP
     WHERE id = $6`,
    [countedQty, diff, status, notes?.trim() || null, userId, lineId]
  );

  return { success: true, discrepancy: diff, status };
}

export async function approveAndApplyAuditAdjustments(
  sessionId: number,
  approverId: number,
  approvalNotes?: string
) {
  return await transaction(async (tx) => {
    const session = await tx.queryOne<any>(
      `SELECT * FROM inventory_audit_sessions WHERE id = $1 FOR UPDATE`,
      [sessionId]
    );

    if (!session) throw new Error('جلسة الجرد غير موجودة.');
    if (session.status === 'approved') {
      throw new Error('تم اعتماد وتطبيق فروقات جلسة الجرد هذه مسبقاً.');
    }
    if (session.status === 'canceled') {
      throw new Error('لا يمكن اعتماد جلسة جرد ملغاة.');
    }

    const lines = await tx.query<any>(
      `SELECT ial.*, p.model_code, p.model_name
       FROM inventory_audit_lines ial
       JOIN product_variants pv ON ial.variant_id = pv.id
       JOIN products p ON pv.product_id = p.id
       WHERE ial.session_id = $1 AND ial.counted_quantity IS NOT NULL
       FOR UPDATE`,
      [sessionId]
    );

    if (lines.length === 0) {
      throw new Error('لا توجد أصناف معدودة في جلسة الجرد لتطبيقها.');
    }

    let appliedAdjustmentsCount = 0;

    for (const line of lines) {
      const counted = Number(line.counted_quantity);
      const diff = Number(line.discrepancy);

      if (diff !== 0) {
        // Lock balance row
        const balance = await tx.queryOne<any>(
          `SELECT id, on_hand_quantity, reserved_quantity 
           FROM inventory_balances 
           WHERE variant_id = $1 AND location_id = $2 
           FOR UPDATE`,
          [line.variant_id, session.warehouse_id]
        );

        const currentReserved = Number(balance?.reserved_quantity || 0);

        if (counted < currentReserved) {
          throw new Error(
            `تعذر الاعتماد: الكمية الفعلية المعدودة للصنف [${line.model_code} - ${line.model_name}] (${counted} قطعة) أقل من الكميات المحجوزة حالياً لطلبات المبيعات النشطة (${currentReserved} قطعة). يرجى فحص الحجوزات أولاً.`
          );
        }

        if (balance) {
          await tx.execute(
            `UPDATE inventory_balances 
             SET on_hand_quantity = $1, updated_at = CURRENT_TIMESTAMP 
             WHERE id = $2`,
            [counted, balance.id]
          );
        } else {
          await tx.execute(
            `INSERT INTO inventory_balances (variant_id, location_id, on_hand_quantity, reserved_quantity)
             VALUES ($1, $2, $3, 0)`,
            [line.variant_id, session.warehouse_id, counted]
          );
        }

        // Reconcile primary shelf balance
        if (line.shelf_id) {
          await tx.execute(
            `INSERT INTO variant_shelves (variant_id, shelf_id, quantity, is_primary)
             VALUES ($1, $2, $3, true)
             ON CONFLICT (variant_id, shelf_id)
             DO UPDATE SET quantity = $3, updated_at = CURRENT_TIMESTAMP`,
            [line.variant_id, line.shelf_id, counted]
          );
        }

        // Immutable stock movement
        await tx.execute(
          `INSERT INTO stock_movements (
             variant_id, location_id, movement_type, quantity_delta,
             reference_type, reference_id, reason, created_by
           ) VALUES ($1, $2, 'ADJUSTMENT', $3, 'INVENTORY_AUDIT', $4, $5, $6)`,
          [
            line.variant_id,
            session.warehouse_id,
            diff,
            session.session_number,
            `تسوية فروقات جرد معتمدة جلسة #${session.session_number} (${diff > 0 ? '+' : ''}${diff} قطعة)`,
            approverId,
          ]
        );

        appliedAdjustmentsCount++;
      }

      await tx.execute(
        `UPDATE inventory_audit_lines 
         SET reconciliation_status = 'approved' 
         WHERE id = $1`,
        [line.id]
      );
    }

    // Mark session approved and closed
    await tx.execute(
      `UPDATE inventory_audit_sessions 
       SET status = 'approved',
           approved_by = $1,
           approved_at = CURRENT_TIMESTAMP,
           closed_at = CURRENT_TIMESTAMP,
           notes = COALESCE($2, notes)
       WHERE id = $3`,
      [approverId, approvalNotes?.trim() || null, sessionId]
    );

    // Audit log
    await tx.execute(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
       VALUES ($1, 'APPROVE_INVENTORY_AUDIT', 'inventory_audit_session', $2, $3)`,
      [
        approverId,
        String(sessionId),
        JSON.stringify({
          sessionNumber: session.session_number,
          adjustedLinesCount: appliedAdjustmentsCount,
        }),
      ]
    );

    return {
      success: true,
      adjustmentsCount: appliedAdjustmentsCount,
      adjustedLinesCount: appliedAdjustmentsCount,
      sessionNumber: session.session_number,
    };
  });
}
