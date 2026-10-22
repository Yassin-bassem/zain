import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne, execute } from '@/lib/db';
import { authorizeRoles } from '@/lib/auth/apiAuth';

export async function GET(req: NextRequest) {
  const auth = await authorizeRoles(['admin', 'warehouse']);
  if (auth.response) return auth.response;

  try {
    const suppliers = await query(
      `SELECT s.*, (SELECT COUNT(*) FROM purchase_receipts pr WHERE pr.supplier_id = s.id) as receipts_count
       FROM suppliers s
       WHERE s.active = true
       ORDER BY s.name ASC`
    );

    return NextResponse.json({ suppliers });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await authorizeRoles(['admin']);
  if (auth.response) return auth.response;

  try {
    const { name, phone, notes } = await req.json();

    if (!name) {
      return NextResponse.json({ error: 'اسم المورد مطلوب.' }, { status: 400 });
    }

    const supplierCode = `SUPP-${Date.now().toString().slice(-5)}`;

    const res = await query<{ id: number }>(
      `INSERT INTO suppliers (supplier_code, name, phone, notes, active)
       VALUES ($1, $2, $3, $4, true)
       RETURNING id`,
      [supplierCode, name.trim(), phone?.trim() || null, notes?.trim() || null]
    );

    return NextResponse.json({
      success: true,
      supplier: { id: res[0].id, supplier_code: supplierCode, name, phone },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
