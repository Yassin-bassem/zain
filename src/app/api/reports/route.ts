import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { authorizeRoles } from '@/lib/auth/apiAuth';

export async function GET(req: NextRequest) {
  const auth = await authorizeRoles(['admin', 'sales', 'warehouse']);
  if (auth.response) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const reportType = searchParams.get('type') || 'overview';

    // 1. Stock by model
    const stockByModel = await query(
      `SELECT 
         p.id, p.model_code, p.model_name, cat.name AS category_name,
         COUNT(DISTINCT pv.id) as variants_count,
         COALESCE(SUM(ib.on_hand_quantity), 0) as physical_pieces,
         COALESCE(SUM(ib.reserved_quantity), 0) as reserved_pieces,
         COALESCE(SUM(ib.on_hand_quantity - ib.reserved_quantity), 0) as available_pieces
       FROM products p
       LEFT JOIN categories cat ON p.category_id = cat.id
       LEFT JOIN product_variants pv ON pv.product_id = p.id AND pv.active = true
       LEFT JOIN inventory_balances ib ON ib.variant_id = pv.id
       WHERE p.active = true
       GROUP BY p.id, p.model_code, p.model_name, cat.name
       ORDER BY p.model_code ASC`
    );

    // 2. Out of stock & low stock variants
    const lowAndOutStock = await query(
      `SELECT 
         pv.id, pv.sku, p.model_code, p.model_name, c.name AS color_name, sz.name AS size_name,
         pv.min_stock_threshold,
         COALESCE(ib.on_hand_quantity, 0) as on_hand_quantity,
         COALESCE(ib.reserved_quantity, 0) as reserved_quantity,
         (COALESCE(ib.on_hand_quantity, 0) - COALESCE(ib.reserved_quantity, 0)) as available_quantity
       FROM product_variants pv
       JOIN products p ON pv.product_id = p.id
       JOIN colors c ON pv.color_id = c.id
       JOIN sizes sz ON pv.size_id = sz.id
       LEFT JOIN inventory_balances ib ON ib.variant_id = pv.id
       WHERE pv.active = true 
         AND (COALESCE(ib.on_hand_quantity - ib.reserved_quantity, 0) <= pv.min_stock_threshold)
       ORDER BY available_quantity ASC, p.model_code ASC`
    );

    // 3. Top ordered variants (most frequently ordered)
    const topVariants = await query(
      `SELECT 
         pv.id, pv.sku, p.model_code, p.model_name, c.name AS color_name, sz.name AS size_name,
         SUM(soi.quantity) as total_ordered_pieces,
         COUNT(DISTINCT soi.order_id) as order_occurrences
       FROM sales_order_items soi
       JOIN product_variants pv ON soi.variant_id = pv.id
       JOIN products p ON pv.product_id = p.id
       JOIN colors c ON pv.color_id = c.id
       JOIN sizes sz ON pv.size_id = sz.id
       GROUP BY pv.id, pv.sku, p.model_code, p.model_name, c.name, sz.name
       ORDER BY total_ordered_pieces DESC
       LIMIT 15`
    );

    // 4. Sales order totals by customer
    const salesByCustomer = await query(
      `SELECT 
         c.id, c.customer_code, c.name, c.phone,
         COUNT(so.id) as total_orders,
         COALESCE(SUM(so.total_pieces), 0) as total_pieces_ordered,
         COALESCE(SUM(so.total_amount), 0) as total_sales_value
       FROM customers c
       LEFT JOIN sales_orders so ON so.customer_id = c.id AND so.status != 'canceled'
       GROUP BY c.id, c.customer_code, c.name, c.phone
       ORDER BY total_sales_value DESC`
    );

    return NextResponse.json({
      stockByModel,
      lowAndOutStock,
      topVariants,
      salesByCustomer,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
