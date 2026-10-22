import { NextRequest, NextResponse } from 'next/server';
import { getOrderDetails } from '@/lib/services/orderService';
import { authorizeRoles } from '@/lib/auth/apiAuth';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorizeRoles(['admin', 'sales', 'warehouse']);
  if (auth.response) return auth.response;

  try {
    const { id } = await params;
    const orderId = Number(id);

    const data = await getOrderDetails(orderId);
    if (!data) {
      return NextResponse.json({ error: 'الطلب غير موجود' }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
