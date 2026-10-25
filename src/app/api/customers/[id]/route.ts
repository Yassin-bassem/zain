import { NextRequest, NextResponse } from 'next/server';
import { getCustomerProfile } from '@/lib/services/customerService';
import { authorizeRoles } from '@/lib/auth/apiAuth';
import { query, execute } from '@/lib/db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorizeRoles(['admin', 'sales', 'warehouse']);
  if (auth.response) return auth.response;

  try {
    const { id } = await params;
    const customerId = parseInt(id, 10);
    if (isNaN(customerId)) {
      return NextResponse.json({ error: 'معرّف العميل غير صالح' }, { status: 400 });
    }

    const data = await getCustomerProfile(customerId);
    if (!data) {
      return NextResponse.json({ error: 'العميل غير موجود' }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorizeRoles(['admin', 'sales']);
  if (auth.response) return auth.response;

  try {
    const { id } = await params;
    const customerId = parseInt(id, 10);
    if (isNaN(customerId)) {
      return NextResponse.json({ error: 'معرّف العميل غير صالح' }, { status: 400 });
    }

    const { name, phone, alternate_phone, address, notes } = await req.json();
    if (!name?.trim() || !phone?.trim()) {
      return NextResponse.json({ error: 'اسم العميل ورقم الهاتف مطلوبان.' }, { status: 400 });
    }

    await execute(
      `UPDATE customers
       SET name = $1, phone = $2, alternate_phone = $3, address = $4, notes = $5, updated_at = CURRENT_TIMESTAMP
       WHERE id = $6`,
      [name.trim(), phone.trim(), alternate_phone?.trim() || null, address?.trim() || null, notes?.trim() || null, customerId]
    );

    // Audit log
    await execute(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
       VALUES ($1, 'UPDATE_CUSTOMER_PROFILE', 'customer', $2, $3)`,
      [auth.user.id, String(customerId), JSON.stringify({ name, phone })]
    );

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
