import { query, queryOne, execute, transaction } from '@/lib/db';

export interface WarehouseShelf {
  id: number;
  warehouse_id: number;
  warehouse_name: string;
  shelf_code: string;
  aisle: string | null;
  rack: string | null;
  bin_carton: string | null;
  notes: string | null;
  active: boolean;
  created_at: string;
  assigned_variants_count: number;
  total_pieces: number;
}

export interface VariantShelfAssignment {
  id: number;
  variant_id: number;
  shelf_id: number;
  shelf_code: string;
  aisle: string | null;
  rack: string | null;
  bin_carton: string | null;
  quantity: number;
  is_primary: boolean;
}

export async function getWarehouseShelves(options: {
  search?: string;
  warehouseId?: number;
} = {}): Promise<WarehouseShelf[]> {
  const whereClauses: string[] = ['ws.active = true'];
  const params: any[] = [];
  let pIdx = 1;

  if (options.search?.trim()) {
    whereClauses.push(
      `(ws.shelf_code ILIKE $${pIdx} OR ws.aisle ILIKE $${pIdx} OR ws.rack ILIKE $${pIdx} OR ws.bin_carton ILIKE $${pIdx} OR ws.notes ILIKE $${pIdx})`
    );
    params.push(`%${options.search.trim()}%`);
    pIdx++;
  }

  if (options.warehouseId) {
    whereClauses.push(`ws.warehouse_id = $${pIdx}`);
    params.push(options.warehouseId);
    pIdx++;
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const sql = `
    SELECT ws.*,
           COALESCE(loc.name, 'المستودع الرئيسي') as warehouse_name,
           (SELECT COUNT(DISTINCT vs.variant_id) FROM variant_shelves vs WHERE vs.shelf_id = ws.id) as assigned_variants_count,
           COALESCE((SELECT SUM(vs.quantity) FROM variant_shelves vs WHERE vs.shelf_id = ws.id), 0) as total_pieces
    FROM warehouse_shelves ws
    LEFT JOIN inventory_locations loc ON ws.warehouse_id = loc.id
    ${whereSql}
    ORDER BY ws.shelf_code ASC
  `;

  const rows = await query<any>(sql, params);
  return rows.map((r) => ({
    ...r,
    assigned_variants_count: Number(r.assigned_variants_count || 0),
    total_pieces: Number(r.total_pieces || 0),
  }));
}

export async function createShelf(data: {
  shelf_code: string;
  aisle?: string;
  rack?: string;
  bin_carton?: string;
  notes?: string;
  warehouse_id?: number;
}): Promise<{ id: number; shelf_code: string }> {
  const cleanCode = data.shelf_code.trim().toUpperCase();
  if (!cleanCode) {
    throw new Error('كود الرف مطلوب ولا يمكن أن يكون فارغاً.');
  }

  // Check unique code
  const existing = await queryOne<{ id: number }>(
    `SELECT id FROM warehouse_shelves WHERE shelf_code = $1`,
    [cleanCode]
  );
  if (existing) {
    throw new Error(`كود الرف (${cleanCode}) مسجل مسبقاً.`);
  }

  let warehouseId = data.warehouse_id;
  if (!warehouseId) {
    const mainLoc = await queryOne<{ id: number }>(
      `SELECT id FROM inventory_locations WHERE location_code = 'MAIN' LIMIT 1`
    );
    warehouseId = mainLoc?.id || 1;
  }

  const res = await query<{ id: number }>(
    `INSERT INTO warehouse_shelves (warehouse_id, shelf_code, aisle, rack, bin_carton, notes, active)
     VALUES ($1, $2, $3, $4, $5, $6, true)
     RETURNING id`,
    [
      warehouseId,
      cleanCode,
      data.aisle?.trim() || null,
      data.rack?.trim() || null,
      data.bin_carton?.trim() || null,
      data.notes?.trim() || null,
    ]
  );

  return { id: res[0].id, shelf_code: cleanCode };
}

export async function getOrCreateShelf(
  warehouseId: number,
  shelfCode: string,
  aisle?: string,
  rack?: string
): Promise<{ id: number; shelf_code: string }> {
  const clean = shelfCode.trim().toUpperCase();
  const existing = await queryOne<{ id: number; shelf_code: string }>(
    `SELECT id, shelf_code FROM warehouse_shelves WHERE shelf_code = $1`,
    [clean]
  );
  if (existing) return existing;
  return await createShelf({
    warehouse_id: warehouseId,
    shelf_code: clean,
    aisle,
    rack,
  });
}

export async function updateShelf(
  shelfId: number,
  data: {
    shelf_code?: string;
    aisle?: string;
    rack?: string;
    bin_carton?: string;
    notes?: string;
    active?: boolean;
  }
) {
  const shelf = await queryOne<{ id: number; shelf_code: string }>(
    `SELECT id, shelf_code FROM warehouse_shelves WHERE id = $1`,
    [shelfId]
  );
  if (!shelf) throw new Error('الرف التخزيني غير موجود.');

  let newCode = shelf.shelf_code;
  if (data.shelf_code?.trim()) {
    newCode = data.shelf_code.trim().toUpperCase();
    if (newCode !== shelf.shelf_code) {
      const existing = await queryOne<{ id: number }>(
        `SELECT id FROM warehouse_shelves WHERE shelf_code = $1 AND id != $2`,
        [newCode, shelfId]
      );
      if (existing) {
        throw new Error(`كود الرف (${newCode}) مسجل مسبقاً لرف آخر.`);
      }
    }
  }

  await query(
    `UPDATE warehouse_shelves
     SET shelf_code = $1,
         aisle = COALESCE($2, aisle),
         rack = COALESCE($3, rack),
         bin_carton = COALESCE($4, bin_carton),
         notes = COALESCE($5, notes),
         active = COALESCE($6, active)
     WHERE id = $7`,
    [
      newCode,
      data.aisle !== undefined ? data.aisle.trim() || null : null,
      data.rack !== undefined ? data.rack.trim() || null : null,
      data.bin_carton !== undefined ? data.bin_carton.trim() || null : null,
      data.notes !== undefined ? data.notes.trim() || null : null,
      data.active !== undefined ? data.active : null,
      shelfId,
    ]
  );

  return { success: true };
}

export async function deleteShelf(shelfId: number) {
  // Check if active pieces are placed on this shelf
  const pieces = await queryOne<{ total: string | number }>(
    `SELECT SUM(quantity) as total FROM variant_shelves WHERE shelf_id = $1`,
    [shelfId]
  );
  if (Number(pieces?.total || 0) > 0) {
    throw new Error('لا يمكن حذف رف تخزيني يحتوي على بضاعة مسجلة. قم بنقل الأصناف لرف آخر أولاً.');
  }

  await query(`DELETE FROM warehouse_shelves WHERE id = $1`, [shelfId]);
  return { success: true };
}

export async function getVariantShelves(variantId: number): Promise<VariantShelfAssignment[]> {
  const rows = await query<any>(
    `SELECT vs.id, vs.variant_id, vs.shelf_id, vs.quantity, vs.is_primary,
            ws.shelf_code, ws.aisle, ws.rack, ws.bin_carton
     FROM variant_shelves vs
     JOIN warehouse_shelves ws ON vs.shelf_id = ws.id
     WHERE vs.variant_id = $1
     ORDER BY vs.is_primary DESC, ws.shelf_code ASC`,
    [variantId]
  );

  return rows.map((r) => ({
    ...r,
    quantity: Number(r.quantity || 0),
    is_primary: Boolean(r.is_primary),
  }));
}

export async function assignVariantShelf(data: {
  variantId: number;
  shelfId: number;
  quantity?: number;
  isPrimary?: boolean;
}) {
  return await transaction(async (tx) => {
    // Check variant
    const variant = await tx.queryOne<{ id: number; sku: string }>(
      `SELECT id, sku FROM product_variants WHERE id = $1`,
      [data.variantId]
    );
    if (!variant) throw new Error('الصنف أو المتغير غير موجود.');

    // Check shelf
    const shelf = await tx.queryOne<{ id: number; shelf_code: string }>(
      `SELECT id, shelf_code FROM warehouse_shelves WHERE id = $1`,
      [data.shelfId]
    );
    if (!shelf) throw new Error('الرف غير موجود.');

    // Authoritative balance
    const balance = await tx.queryOne<{ on_hand_quantity: number }>(
      `SELECT on_hand_quantity FROM inventory_balances WHERE variant_id = $1 LIMIT 1`,
      [data.variantId]
    );
    const authoritativeOnHand = Number(balance?.on_hand_quantity || 0);

    const qty = data.quantity !== undefined ? Math.max(0, Math.floor(Number(data.quantity))) : 0;

    // Check existing on other shelves
    const otherShelves = await tx.queryOne<{ total: string | number }>(
      `SELECT SUM(quantity) as total FROM variant_shelves WHERE variant_id = $1 AND shelf_id != $2`,
      [data.variantId, data.shelfId]
    );
    const totalOtherQty = Number(otherShelves?.total || 0);

    if (totalOtherQty + qty > authoritativeOnHand && authoritativeOnHand > 0) {
      throw new Error(
        `إجمالي الكمية الموزعة على الأرفف (${totalOtherQty + qty}) يتجاوز رصيد المخزن الفعلي المعتمد (${authoritativeOnHand} قطعة).`
      );
    }

    // If setting as primary, clear primary on other shelves
    if (data.isPrimary) {
      await tx.execute(
        `UPDATE variant_shelves SET is_primary = false WHERE variant_id = $1`,
        [data.variantId]
      );
    }

    // Upsert variant_shelves
    await tx.execute(
      `INSERT INTO variant_shelves (variant_id, shelf_id, quantity, is_primary, updated_at)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
       ON CONFLICT (variant_id, shelf_id)
       DO UPDATE SET quantity = $3, is_primary = COALESCE($4, variant_shelves.is_primary), updated_at = CURRENT_TIMESTAMP`,
      [data.variantId, data.shelfId, qty, data.isPrimary ?? false]
    );

    return {
      success: true,
      variantId: data.variantId,
      shelfCode: shelf.shelf_code,
      quantity: qty,
    };
  });
}

export async function assignVariantToShelf(first: any, second?: any) {
  if (second) {
    return await assignVariantShelf(second);
  }
  return await assignVariantShelf(first);
}

export async function getShelfAssignedVariants(shelfId: number) {
  const rows = await query<any>(
    `SELECT vs.id, vs.variant_id, vs.shelf_id, vs.quantity as shelf_quantity, vs.is_primary,
            pv.sku, pv.qr_code_uid,
            p.model_code, p.model_name,
            c.name as color_name, sz.name as size_name,
            COALESCE(ib.on_hand_quantity, 0) as total_on_hand,
            ws.shelf_code
     FROM variant_shelves vs
     JOIN warehouse_shelves ws ON vs.shelf_id = ws.id
     JOIN product_variants pv ON vs.variant_id = pv.id
     JOIN products p ON pv.product_id = p.id
     JOIN colors c ON pv.color_id = c.id
     JOIN sizes sz ON pv.size_id = sz.id
     LEFT JOIN inventory_balances ib ON pv.id = ib.variant_id
     WHERE vs.shelf_id = $1
     ORDER BY p.model_code ASC, c.name ASC, sz.sort_order ASC`,
    [shelfId]
  );

  return rows.map((r) => ({
    ...r,
    shelf_quantity: Number(r.shelf_quantity || 0),
    total_on_hand: Number(r.total_on_hand || 0),
    is_primary: Boolean(r.is_primary),
  }));
}

export async function removeVariantFromShelf(shelfId: number, variantId: number) {
  await execute(
    `DELETE FROM variant_shelves WHERE shelf_id = $1 AND variant_id = $2`,
    [shelfId, variantId]
  );
  return { success: true };
}

export async function searchVariantsForAssignment(search?: string) {
  const params: any[] = [];
  let where = 'pv.active = true';
  if (search?.trim()) {
    where += ` AND (p.model_code ILIKE $1 OR p.model_name ILIKE $1 OR c.name ILIKE $1 OR sz.name ILIKE $1 OR pv.sku ILIKE $1 OR pv.qr_code_uid ILIKE $1)`;
    params.push(`%${search.trim()}%`);
  }

  const rows = await query<any>(
    `SELECT pv.id as variant_id, pv.sku, pv.qr_code_uid,
            p.model_code, p.model_name,
            c.name as color_name, sz.name as size_name,
            COALESCE(ib.on_hand_quantity, 0) as on_hand_quantity,
            (
              SELECT ws.shelf_code
              FROM variant_shelves vs
              JOIN warehouse_shelves ws ON vs.shelf_id = ws.id
              WHERE vs.variant_id = pv.id AND vs.is_primary = true
              LIMIT 1
            ) as current_shelf_code
     FROM product_variants pv
     JOIN products p ON pv.product_id = p.id
     JOIN colors c ON pv.color_id = c.id
     JOIN sizes sz ON pv.size_id = sz.id
     LEFT JOIN inventory_balances ib ON pv.id = ib.variant_id
     WHERE ${where}
     ORDER BY p.model_code ASC, c.name ASC, sz.sort_order ASC
     LIMIT 50`,
    params
  );

  return rows.map((r) => ({
    ...r,
    on_hand_quantity: Number(r.on_hand_quantity || 0),
  }));
}


