import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { authorizeRoles } from '@/lib/auth/apiAuth';

export async function GET(req: NextRequest) {
  const auth = await authorizeRoles(['admin', 'sales', 'warehouse']);
  if (auth.response) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const movementType = searchParams.get('type') || '';
    const page = Number(searchParams.get('page') || 1);
    const limit = Number(searchParams.get('limit') || 50);
    const offset = (page - 1) * limit;

    const whereClauses: string[] = [];
    const params: any[] = [];
    let paramIdx = 1;

    if (search.trim()) {
      whereClauses.push(`(
        p.model_code ILIKE $${paramIdx} OR
        p.model_name ILIKE $${paramIdx} OR
        pv.sku ILIKE $${paramIdx} OR
        sm.reference_id ILIKE $${paramIdx} OR
        sm.reason ILIKE $${paramIdx}
      )`);
      params.push(`%${search.trim()}%`);
      paramIdx++;
    }

    if (movementType) {
      whereClauses.push(`sm.movement_type = $${paramIdx}`);
      params.push(movementType);
      paramIdx++;
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const countSql = `
      SELECT COUNT(*) as total
      FROM stock_movements sm
      JOIN product_variants pv ON sm.variant_id = pv.id
      JOIN products p ON pv.product_id = p.id
      ${whereSql}
    `;

    const totalResult = await queryOne<{ total: string | number }>(countSql, params);
    const total = Number(totalResult?.total || 0);

    const querySql = `
      SELECT 
        sm.id,
        sm.movement_type,
        sm.quantity_delta,
        sm.reference_type,
        sm.reference_id,
        sm.reason,
        sm.created_at,
        p.model_code,
        p.model_name,
        c.name AS color_name,
        sz.name AS size_name,
        pv.sku,
        loc.name AS location_name,
        u.full_name AS created_by_name
      FROM stock_movements sm
      JOIN product_variants pv ON sm.variant_id = pv.id
      JOIN products p ON pv.product_id = p.id
      JOIN colors c ON pv.color_id = c.id
      JOIN sizes sz ON pv.size_id = sz.id
      JOIN inventory_locations loc ON sm.location_id = loc.id
      LEFT JOIN users u ON sm.created_by = u.id
      ${whereSql}
      ORDER BY sm.created_at DESC
      LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
    `;

    const movements = await query(querySql, [...params, limit, offset]);

    return NextResponse.json({
      movements,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
