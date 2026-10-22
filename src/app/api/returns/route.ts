import { NextRequest, NextResponse } from 'next/server';
import { createReturn } from '@/lib/services/returnService';
import { query } from '@/lib/db';
import { authorizeRoles } from '@/lib/auth/apiAuth';

export async function GET(req: NextRequest) {
  const auth = await authorizeRoles(['admin', 'sales', 'warehouse']);
  if (auth.response) return auth.response;

  try {
    const returns = await query(
      `SELECT sr.*, c.name AS customer_name, so.order_number, u.full_name AS created_by_name,
              (SELECT COUNT(*) FROM sales_return_items sri WHERE sri.return_id = sr.id) as items_count
       FROM sales_returns sr
       JOIN customers c ON sr.customer_id = c.id
       LEFT JOIN sales_orders so ON sr.order_id = so.id
       LEFT JOIN users u ON sr.created_by = u.id
       ORDER BY sr.created_at DESC`
    );

    const items = await query(
      `SELECT sri.*, p.model_code, p.model_name, col.name AS color_name, sz.name AS size_name, pv.sku
       FROM sales_return_items sri
       JOIN product_variants pv ON sri.variant_id = pv.id
       JOIN products p ON pv.product_id = p.id
       JOIN colors col ON pv.color_id = col.id
       JOIN sizes sz ON pv.size_id = sz.id`
    );

    return NextResponse.json({ returns, items });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await authorizeRoles(['admin', 'sales', 'warehouse']);
  if (auth.response) return auth.response;

  try {
    const body = await req.json();
    const result = await createReturn(auth.user.id, {
      customer_id: Number(body.customer_id),
      order_id: body.order_id ? Number(body.order_id) : undefined,
      reason: body.reason,
      items: body.items,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
