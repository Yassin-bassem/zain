import { query, queryOne, transaction } from '@/lib/db';
import { normalizeArabicText } from '@/lib/db';

export interface ProductSummary {
  id: number;
  model_code: string;
  model_name: string;
  category_id: number | null;
  category_name: string | null;
  description: string | null;
  default_price: number;
  active: boolean;
  total_variants: number;
  total_physical_stock: number;
  total_available_stock: number;
}

export async function listProducts(options: {
  search?: string;
  categoryId?: number;
  activeOnly?: boolean;
  page?: number;
  limit?: number;
} = {}) {
  const { search = '', categoryId, activeOnly = true, page = 1, limit = 50 } = options;
  const offset = (page - 1) * limit;

  const whereClauses: string[] = [];
  const params: any[] = [];
  let paramIdx = 1;

  if (activeOnly) {
    whereClauses.push('p.active = true');
  }

  if (search.trim()) {
    whereClauses.push(`(p.model_code ILIKE $${paramIdx} OR p.model_name ILIKE $${paramIdx})`);
    params.push(`%${search.trim()}%`);
    paramIdx++;
  }

  if (categoryId) {
    whereClauses.push(`p.category_id = $${paramIdx}`);
    params.push(categoryId);
    paramIdx++;
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const countSql = `SELECT COUNT(*) as total FROM products p ${whereSql}`;
  const totalRes = await queryOne<{ total: string | number }>(countSql, params);
  const total = Number(totalRes?.total || 0);

  const querySql = `
    SELECT 
      p.id,
      p.model_code,
      p.model_name,
      p.category_id,
      cat.name AS category_name,
      p.description,
      p.default_price,
      p.active,
      COUNT(DISTINCT pv.id) AS total_variants,
      COALESCE(SUM(ib.on_hand_quantity), 0) AS total_physical_stock,
      COALESCE(SUM(ib.on_hand_quantity - ib.reserved_quantity), 0) AS total_available_stock
    FROM products p
    LEFT JOIN categories cat ON p.category_id = cat.id
    LEFT JOIN product_variants pv ON pv.product_id = p.id AND pv.active = true
    LEFT JOIN inventory_balances ib ON ib.variant_id = pv.id
    ${whereSql}
    GROUP BY p.id, cat.name
    ORDER BY p.model_code ASC
    LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
  `;

  const items = await query<ProductSummary>(querySql, [...params, limit, offset]);

  return {
    items,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

export async function createProduct(data: {
  model_code: string;
  model_name: string;
  category_id?: number | null;
  description?: string;
  default_price?: number;
}) {
  const code = data.model_code.trim().toUpperCase();
  const name = data.model_name.trim();

  if (!code) throw new Error('كود الموديل إلزامي ومطلوب.');
  if (!name) throw new Error('اسم الموديل إلزامي ومطلوب.');

  const existing = await queryOne('SELECT id FROM products WHERE model_code = $1', [code]);
  if (existing) {
    throw new Error(`كود الموديل (${code}) مسجل مسبقاً لموديل آخر. يرجى اختيار كود فريد.`);
  }

  const rows = await query<{ id: number }>(
    `INSERT INTO products (model_code, model_name, category_id, description, default_price, active)
     VALUES ($1, $2, $3, $4, $5, true)
     RETURNING id`,
    [code, name, data.category_id || null, data.description || null, data.default_price || 0]
  );

  return rows[0];
}

export async function createBulkVariants(data: {
  productId: number;
  colorIds: number[];
  sizeIds: number[];
  excludedKeys?: string[]; // array of "colorId_sizeId"
  minStockThreshold?: number;
}) {
  const product = await queryOne<{ id: number; model_code: string }>(
    'SELECT id, model_code FROM products WHERE id = $1',
    [data.productId]
  );
  if (!product) throw new Error('الموديل غير موجود.');

  const excluded = new Set(data.excludedKeys || []);

  return await transaction(async (tx) => {
    let createdCount = 0;
    let skippedCount = 0;

    for (const colorId of data.colorIds) {
      for (const sizeId of data.sizeIds) {
        const comboKey = `${colorId}_${sizeId}`;
        if (excluded.has(comboKey)) {
          skippedCount++;
          continue;
        }

        // Check if combination already exists
        const existing = await tx.queryOne(
          'SELECT id FROM product_variants WHERE product_id = $1 AND color_id = $2 AND size_id = $3',
          [data.productId, colorId, sizeId]
        );

        if (existing) {
          skippedCount++;
          continue;
        }

        // Generate stable SKU
        const sku = `${product.model_code}-C${colorId}-S${sizeId}`;

        await tx.execute(
          `INSERT INTO product_variants (product_id, color_id, size_id, sku, min_stock_threshold, active)
           VALUES ($1, $2, $3, $4, $5, true)`,
          [data.productId, colorId, sizeId, sku, data.minStockThreshold || 0]
        );

        createdCount++;
      }
    }

    return { createdCount, skippedCount };
  });
}
