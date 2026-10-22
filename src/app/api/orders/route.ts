import { NextRequest, NextResponse } from 'next/server';
import { createDraftOrder } from '@/lib/services/orderService';
import { query, queryOne } from '@/lib/db';
import { authorizeRoles } from '@/lib/auth/apiAuth';

export async function GET(req: NextRequest) {
  const auth = await authorizeRoles(['admin', 'sales', 'warehouse']);
  if (auth.response) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const page = Number(searchParams.get('page') || 1);
    const limit = Number(searchParams.get('limit') || 50);
    const offset = (page - 1) * limit;

    const whereClauses: string[] = [];
    const params: any[] = [];
    let paramIdx = 1;

    if (search.trim()) {
      whereClauses.push(`(
        so.order_number ILIKE $${paramIdx} OR
        c.name ILIKE $${paramIdx} OR
        c.phone ILIKE $${paramIdx}
      )`);
      params.push(`%${search.trim()}%`);
      paramIdx++;
    }

    if (status) {
      whereClauses.push(`so.status = $${paramIdx}`);
      params.push(status);
      paramIdx++;
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const countSql = `
      SELECT COUNT(*) as total
      FROM sales_orders so
      JOIN customers c ON so.customer_id = c.id
      ${whereSql}
    `;

    const totalResult = await queryOne<{ total: string | number }>(countSql, params);
    const total = Number(totalResult?.total || 0);

    const querySql = `
      SELECT 
        so.id,
        so.order_number,
        so.status,
        so.order_date,
        so.subtotal,
        so.discount_amount,
        so.total_amount,
        so.total_pieces,
        so.notes,
        so.created_at,
        so.confirmed_at,
        so.shipped_at,
        c.name AS customer_name,
        c.phone AS customer_phone,
        u.full_name AS created_by_name,
        (SELECT COUNT(*) FROM sales_order_items soi WHERE soi.order_id = so.id) AS item_count
      FROM sales_orders so
      JOIN customers c ON so.customer_id = c.id
      LEFT JOIN users u ON so.created_by = u.id
      ${whereSql}
      ORDER BY so.created_at DESC
      LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
    `;

    const orders = await query(querySql, [...params, limit, offset]);

    return NextResponse.json({
      orders,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await authorizeRoles(['admin', 'sales']);
  if (auth.response) return auth.response;

  try {
    const body = await req.json();
    const result = await createDraftOrder(auth.user.id, {
      customer_id: Number(body.customer_id),
      order_date: body.order_date,
      notes: body.notes,
      discount_amount: Number(body.discount_amount || 0),
      items: body.items,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
