import { NextRequest, NextResponse } from 'next/server';
import {
  confirmOrder,
  cancelOrder,
  startPicking,
  packOrder,
  shipOrder,
} from '@/lib/services/orderService';
import { authorizeRoles } from '@/lib/auth/apiAuth';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const orderId = Number(id);

  try {
    const { action } = await req.json();

    if (action === 'confirm') {
      // Admin or sales (if authorized) can confirm
      const auth = await authorizeRoles(['admin', 'sales']);
      if (auth.response) return auth.response;

      const result = await confirmOrder(auth.user.id, orderId);
      return NextResponse.json(result);
    }

    if (action === 'cancel') {
      // Admin or sales can cancel
      const auth = await authorizeRoles(['admin', 'sales']);
      if (auth.response) return auth.response;

      const result = await cancelOrder(auth.user.id, orderId);
      return NextResponse.json(result);
    }

    if (action === 'pick') {
      // Warehouse or admin can start picking
      const auth = await authorizeRoles(['admin', 'warehouse']);
      if (auth.response) return auth.response;

      const result = await startPicking(auth.user.id, orderId);
      return NextResponse.json(result);
    }

    if (action === 'pack') {
      // Warehouse or admin can pack
      const auth = await authorizeRoles(['admin', 'warehouse']);
      if (auth.response) return auth.response;

      const result = await packOrder(auth.user.id, orderId);
      return NextResponse.json(result);
    }

    if (action === 'ship') {
      // Warehouse or admin can ship
      const auth = await authorizeRoles(['admin', 'warehouse']);
      if (auth.response) return auth.response;

      const result = await shipOrder(auth.user.id, orderId);
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: 'إجراء غير صالح' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
