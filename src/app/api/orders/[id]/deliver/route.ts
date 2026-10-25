import { NextRequest, NextResponse } from 'next/server';
import { confirmOrderDelivery } from '@/lib/services/customerService';
import { authorizeRoles } from '@/lib/auth/apiAuth';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorizeRoles(['admin', 'sales', 'warehouse']);
  if (auth.response) return auth.response;

  try {
    const { id } = await params;
    const orderId = parseInt(id, 10);
    if (isNaN(orderId)) {
      return NextResponse.json({ error: 'معرّف الطلب غير صالح' }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const result = await confirmOrderDelivery(orderId, auth.user.id, {
      recipient_name: body.recipient_name,
      delivery_notes: body.delivery_notes,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
