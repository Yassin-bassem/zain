import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne, execute } from '@/lib/db';
import { authorizeRoles } from '@/lib/auth/apiAuth';

export async function GET(req: NextRequest) {
  const auth = await authorizeRoles(['admin', 'sales', 'warehouse']);
  if (auth.response) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';

    let customers;
    if (search.trim()) {
      customers = await query(
        `SELECT c.*, (SELECT COUNT(*) FROM sales_orders so WHERE so.customer_id = c.id) as orders_count
         FROM customers c
         WHERE c.active = true AND (c.name ILIKE $1 OR c.phone ILIKE $1 OR c.customer_code ILIKE $1)
         ORDER BY c.name ASC`,
        [`%${search.trim()}%`]
      );
    } else {
      customers = await query(
        `SELECT c.*, (SELECT COUNT(*) FROM sales_orders so WHERE so.customer_id = c.id) as orders_count
         FROM customers c
         WHERE c.active = true
         ORDER BY c.name ASC`
      );
    }

    return NextResponse.json({ customers });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await authorizeRoles(['admin', 'sales']);
  if (auth.response) return auth.response;

  try {
    const { name, phone, alternate_phone, address, notes } = await req.json();

    if (!name || !phone) {
      return NextResponse.json({ error: 'اسم العميل ورقم الهاتف مطلوبان.' }, { status: 400 });
    }

    const customerCode = `CUST-${Date.now().toString().slice(-5)}`;

    const res = await query<{ id: number }>(
      `INSERT INTO customers (customer_code, name, phone, alternate_phone, address, notes, active)
       VALUES ($1, $2, $3, $4, $5, $6, true)
       RETURNING id`,
      [customerCode, name.trim(), phone.trim(), alternate_phone?.trim() || null, address?.trim() || null, notes?.trim() || null]
    );

    return NextResponse.json({
      success: true,
      customer: { id: res[0].id, customer_code: customerCode, name, phone },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
