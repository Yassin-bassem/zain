import { NextRequest, NextResponse } from 'next/server';
import { createReceipt } from '@/lib/services/receivingService';
import { query } from '@/lib/db';
import { authorizeRoles } from '@/lib/auth/apiAuth';

export async function GET(req: NextRequest) {
  const auth = await authorizeRoles(['admin', 'warehouse']);
  if (auth.response) return auth.response;

  try {
    const receipts = await query(
      `SELECT pr.*, s.name AS supplier_name, u.full_name AS created_by_name, conf.full_name AS confirmed_by_name
       FROM purchase_receipts pr
       JOIN suppliers s ON pr.supplier_id = s.id
       LEFT JOIN users u ON pr.created_by = u.id
       LEFT JOIN users conf ON pr.confirmed_by = conf.id
       ORDER BY pr.created_at DESC`
    );

    return NextResponse.json({ receipts });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await authorizeRoles(['admin', 'warehouse']);
  if (auth.response) return auth.response;

  try {
    const body = await req.json();
    const result = await createReceipt(auth.user.id, {
      supplier_id: Number(body.supplier_id),
      receipt_date: body.receipt_date,
      supplier_invoice_ref: body.supplier_invoice_ref,
      notes: body.notes,
      items: body.items,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
