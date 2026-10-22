import { query, queryOne, transaction, DbClient } from '@/lib/db';

export interface InventoryItemRow {
  variant_id: number;
  product_id: number;
  model_code: string;
  model_name: string;
  category_name: string | null;
  color_name: string;
  size_name: string;
  sku: string;
  location_id: number;
  location_name: string;
  on_hand_quantity: number;
  reserved_quantity: number;
  available_quantity: number;
  min_stock_threshold: number;
  default_price: number;
  last_movement_at: string | null;
}

export interface InventoryFilterOptions {
  search?: string;
  categoryId?: number;
  stockStatus?: 'all' | 'in_stock' | 'low_stock' | 'out_of_stock';
  locationId?: number;
  page?: number;
  limit?: number;
}

export async function getInventoryList(options: InventoryFilterOptions = {}) {
  const {
    search = '',
    categoryId,
    stockStatus = 'all',
    locationId,
    page = 1,
    limit = 50,
  } = options;

  const offset = (page - 1) * limit;
  const whereClauses: string[] = ['pv.active = true', 'p.active = true'];
  const params: any[] = [];
  let paramIdx = 1;

  if (search.trim()) {
    const s = `%${search.trim()}%`;
    whereClauses.push(`(
      p.model_code ILIKE $${paramIdx} OR
      p.model_name ILIKE $${paramIdx} OR
      pv.sku ILIKE $${paramIdx} OR
      c.name ILIKE $${paramIdx} OR
      sz.name ILIKE $${paramIdx}
    )`);
    params.push(s);
    paramIdx++;
  }

  if (categoryId) {
    whereClauses.push(`p.category_id = $${paramIdx}`);
    params.push(categoryId);
    paramIdx++;
  }

  if (locationId) {
    whereClauses.push(`loc.id = $${paramIdx}`);
    params.push(locationId);
    paramIdx++;
  }

  let statusFilter = '';
  if (stockStatus === 'in_stock') {
    statusFilter = 'AND (COALESCE(ib.on_hand_quantity, 0) - COALESCE(ib.reserved_quantity, 0)) > 0';
  } else if (stockStatus === 'out_of_stock') {
    statusFilter = 'AND (COALESCE(ib.on_hand_quantity, 0) - COALESCE(ib.reserved_quantity, 0)) <= 0';
  } else if (stockStatus === 'low_stock') {
    statusFilter = 'AND (COALESCE(ib.on_hand_quantity, 0) - COALESCE(ib.reserved_quantity, 0)) <= pv.min_stock_threshold AND (COALESCE(ib.on_hand_quantity, 0) - COALESCE(ib.reserved_quantity, 0)) > 0';
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const countSql = `
    SELECT COUNT(*) as total
    FROM product_variants pv
    JOIN products p ON pv.product_id = p.id
    LEFT JOIN categories cat ON p.category_id = cat.id
    JOIN colors c ON pv.color_id = c.id
    JOIN sizes sz ON pv.size_id = sz.id
    CROSS JOIN inventory_locations loc
    LEFT JOIN inventory_balances ib ON ib.variant_id = pv.id AND ib.location_id = loc.id
    ${whereSql}
    AND loc.location_code = 'MAIN'
    ${statusFilter}
  `;

  const totalResult = await queryOne<{ total: string | number }>(countSql, params);
  const total = Number(totalResult?.total || 0);

  const querySql = `
    SELECT 
      pv.id AS variant_id,
      p.id AS product_id,
      p.model_code,
      p.model_name,
      cat.name AS category_name,
      c.name AS color_name,
      sz.name AS size_name,
      pv.sku,
      loc.id AS location_id,
      loc.name AS location_name,
      COALESCE(ib.on_hand_quantity, 0) AS on_hand_quantity,
      COALESCE(ib.reserved_quantity, 0) AS reserved_quantity,
      (COALESCE(ib.on_hand_quantity, 0) - COALESCE(ib.reserved_quantity, 0)) AS available_quantity,
      pv.min_stock_threshold,
      p.default_price,
      (
        SELECT MAX(sm.created_at) 
        FROM stock_movements sm 
        WHERE sm.variant_id = pv.id AND sm.location_id = loc.id
      ) AS last_movement_at
    FROM product_variants pv
    JOIN products p ON pv.product_id = p.id
    LEFT JOIN categories cat ON p.category_id = cat.id
    JOIN colors c ON pv.color_id = c.id
    JOIN sizes sz ON pv.size_id = sz.id
    CROSS JOIN inventory_locations loc
    LEFT JOIN inventory_balances ib ON ib.variant_id = pv.id AND ib.location_id = loc.id
    ${whereSql}
    AND loc.location_code = 'MAIN'
    ${statusFilter}
    ORDER BY p.model_code ASC, sz.sort_order ASC, c.name ASC
    LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
  `;

  const items = await query<InventoryItemRow>(querySql, [...params, limit, offset]);

  return {
    items,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

export async function getModelStockMatrix(productId: number) {
  const product = await queryOne<{ id: number; model_code: string; model_name: string }>(
    'SELECT id, model_code, model_name FROM products WHERE id = $1',
    [productId]
  );
  if (!product) throw new Error('الموديل غير موجود');

  const rows = await query<{
    variant_id: number;
    color_id: number;
    color_name: string;
    size_id: number;
    size_name: string;
    sku: string;
    on_hand_quantity: number;
    reserved_quantity: number;
    available_quantity: number;
  }>(
    `SELECT 
       pv.id AS variant_id,
       c.id AS color_id,
       c.name AS color_name,
       sz.id AS size_id,
       sz.name AS size_name,
       pv.sku,
       COALESCE(ib.on_hand_quantity, 0) AS on_hand_quantity,
       COALESCE(ib.reserved_quantity, 0) AS reserved_quantity,
       (COALESCE(ib.on_hand_quantity, 0) - COALESCE(ib.reserved_quantity, 0)) AS available_quantity
     FROM product_variants pv
     JOIN colors c ON pv.color_id = c.id
     JOIN sizes sz ON pv.size_id = sz.id
     LEFT JOIN inventory_locations loc ON loc.location_code = 'MAIN'
     LEFT JOIN inventory_balances ib ON ib.variant_id = pv.id AND ib.location_id = loc.id
     WHERE pv.product_id = $1 AND pv.active = true
     ORDER BY sz.sort_order ASC, c.name ASC`,
    [productId]
  );

  let totalOnHand = 0;
  let totalReserved = 0;
  let totalAvailable = 0;

  for (const r of rows) {
    totalOnHand += Number(r.on_hand_quantity || 0);
    totalReserved += Number(r.reserved_quantity || 0);
    totalAvailable += Number(r.available_quantity || 0);
  }

  return {
    product,
    variants: rows,
    totals: {
      totalOnHand,
      totalReserved,
      totalAvailable,
    },
  };
}

export async function adjustStock(data: {
  userId: number;
  locationId?: number;
  reason: string;
  items: Array<{
    variantId: number;
    newQuantity: number;
    reason?: string;
  }>;
}) {
  if (!data.reason || !data.reason.trim()) {
    throw new Error('سبب تسوية المخزون إلزامي للمساءلة الرقابية.');
  }

  return await transaction(async (tx) => {
    // Determine location
    let locId = data.locationId;
    if (!locId) {
      const mainLoc = await tx.queryOne<{ id: number }>(
        "SELECT id FROM inventory_locations WHERE location_code = 'MAIN'"
      );
      locId = mainLoc!.id;
    }

    const adjustmentNumber = `ADJ-${Date.now().toString().slice(-6)}`;
    const adjRows = await tx.query<{ id: number }>(
      `INSERT INTO stock_adjustments (adjustment_number, location_id, reason, status, created_by)
       VALUES ($1, $2, $3, 'applied', $4) RETURNING id`,
      [adjustmentNumber, locId, data.reason.trim(), data.userId]
    );
    const adjustmentId = adjRows[0].id;

    for (const item of data.items) {
      if (item.newQuantity < 0) {
        throw new Error('الكمية الجديدة لا يمكن أن تكون قيمة سالبة.');
      }

      // Lock row
      const existing = await tx.queryOne<{
        id: number;
        on_hand_quantity: number;
        reserved_quantity: number;
      }>(
        `SELECT id, on_hand_quantity, reserved_quantity 
         FROM inventory_balances 
         WHERE variant_id = $1 AND location_id = $2 
         FOR UPDATE`,
        [item.variantId, locId]
      );

      const previousQty = existing ? Number(existing.on_hand_quantity) : 0;
      const reservedQty = existing ? Number(existing.reserved_quantity) : 0;
      const newQty = Number(item.newQuantity);

      if (newQty < reservedQty) {
        throw new Error(
          `لا يمكن ضبط الرصيد الفعلي (${newQty}) ليكون أقل من الكمية المحجوزة للطلبات الحالية (${reservedQty}).`
        );
      }

      const delta = newQty - previousQty;

      if (existing) {
        await tx.execute(
          `UPDATE inventory_balances 
           SET on_hand_quantity = $1, updated_at = CURRENT_TIMESTAMP 
           WHERE id = $2`,
          [newQty, existing.id]
        );
      } else {
        await tx.execute(
          `INSERT INTO inventory_balances (variant_id, location_id, on_hand_quantity, reserved_quantity)
           VALUES ($1, $2, $3, 0)`,
          [item.variantId, locId, newQty]
        );
      }

      // Record adjustment item
      await tx.execute(
        `INSERT INTO stock_adjustment_items (adjustment_id, variant_id, previous_quantity, new_quantity, delta, reason)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [adjustmentId, item.variantId, previousQty, newQty, delta, item.reason || data.reason]
      );

      // Record immutable stock movement
      await tx.execute(
        `INSERT INTO stock_movements (variant_id, location_id, movement_type, quantity_delta, reference_type, reference_id, reason, created_by)
         VALUES ($1, $2, 'ADJUSTMENT', $3, 'STOCK_ADJUSTMENT', $4, $5, $6)`,
        [
          item.variantId,
          locId,
          delta,
          adjustmentNumber,
          `تسوية مخزنية: ${item.reason || data.reason}`,
          data.userId,
        ]
      );
    }

    // Audit log
    await tx.execute(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
       VALUES ($1, 'STOCK_ADJUSTMENT_APPLIED', 'stock_adjustment', $2, $3)`,
      [
        data.userId,
        String(adjustmentId),
        JSON.stringify({
          adjustmentNumber,
          itemCount: data.items.length,
          reason: data.reason,
        }),
      ]
    );

    return { success: true, adjustmentNumber, adjustmentId };
  });
}

export async function getDashboardMetrics() {
  const metrics = await queryOne<{
    total_models: string | number;
    total_variants: string | number;
    total_physical: string | number;
    total_reserved: string | number;
    total_available: string | number;
    out_of_stock_count: string | number;
    low_stock_count: string | number;
  }>(`
    SELECT 
      (SELECT COUNT(*) FROM products WHERE active = true) AS total_models,
      (SELECT COUNT(*) FROM product_variants WHERE active = true) AS total_variants,
      COALESCE((SELECT SUM(on_hand_quantity) FROM inventory_balances), 0) AS total_physical,
      COALESCE((SELECT SUM(reserved_quantity) FROM inventory_balances), 0) AS total_reserved,
      COALESCE((SELECT SUM(on_hand_quantity - reserved_quantity) FROM inventory_balances), 0) AS total_available,
      (
        SELECT COUNT(*) 
        FROM product_variants pv 
        LEFT JOIN inventory_balances ib ON ib.variant_id = pv.id
        WHERE pv.active = true AND COALESCE(ib.on_hand_quantity - ib.reserved_quantity, 0) <= 0
      ) AS out_of_stock_count,
      (
        SELECT COUNT(*) 
        FROM product_variants pv 
        LEFT JOIN inventory_balances ib ON ib.variant_id = pv.id
        WHERE pv.active = true 
          AND COALESCE(ib.on_hand_quantity - ib.reserved_quantity, 0) > 0
          AND COALESCE(ib.on_hand_quantity - ib.reserved_quantity, 0) <= pv.min_stock_threshold
      ) AS low_stock_count
  `);

  const orderCounts = await query<{ status: string; count: string | number }>(
    `SELECT status, COUNT(*) as count FROM sales_orders GROUP BY status`
  );

  const ordersByStatus: Record<string, number> = {
    draft: 0,
    confirmed: 0,
    picking: 0,
    packed: 0,
    shipped: 0,
    canceled: 0,
  };

  for (const o of orderCounts) {
    ordersByStatus[o.status] = Number(o.count || 0);
  }

  const recentMovements = await query(
    `SELECT sm.id, sm.movement_type, sm.quantity_delta, sm.reference_type, sm.reference_id, 
            sm.reason, sm.created_at, p.model_code, p.model_name, c.name AS color_name, sz.name AS size_name
     FROM stock_movements sm
     JOIN product_variants pv ON sm.variant_id = pv.id
     JOIN products p ON pv.product_id = p.id
     JOIN colors c ON pv.color_id = c.id
     JOIN sizes sz ON pv.size_id = sz.id
     ORDER BY sm.created_at DESC
     LIMIT 8`
  );

  const recentReceipts = await query(
    `SELECT pr.id, pr.receipt_number, pr.receipt_date, pr.status, pr.total_pieces, s.name AS supplier_name
     FROM purchase_receipts pr
     JOIN suppliers s ON pr.supplier_id = s.id
     ORDER BY pr.created_at DESC
     LIMIT 5`
  );

  return {
    totalModels: Number(metrics?.total_models || 0),
    totalVariants: Number(metrics?.total_variants || 0),
    totalPhysical: Number(metrics?.total_physical || 0),
    totalReserved: Number(metrics?.total_reserved || 0),
    totalAvailable: Number(metrics?.total_available || 0),
    outOfStockCount: Number(metrics?.out_of_stock_count || 0),
    lowStockCount: Number(metrics?.low_stock_count || 0),
    ordersAwaitingConfirmation: ordersByStatus.draft || 0,
    ordersAwaitingPicking: ordersByStatus.confirmed || 0,
    ordersBeingPacked: ordersByStatus.picking || 0,
    ordersReadyToShip: ordersByStatus.packed || 0,
    recentMovements,
    recentReceipts,
  };
}
