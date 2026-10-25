import { NextRequest, NextResponse } from 'next/server';
import { getWarehouseShelves, createShelf } from '@/lib/services/shelfService';
import { authorizeRoles } from '@/lib/auth/apiAuth';

export async function GET(req: NextRequest) {
  const auth = await authorizeRoles(['admin', 'sales', 'warehouse']);
  if (auth.response) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const warehouseId = searchParams.get('warehouse_id') ? parseInt(searchParams.get('warehouse_id')!, 10) : undefined;

    const shelves = await getWarehouseShelves({ search, warehouseId });
    return NextResponse.json({ shelves });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await authorizeRoles(['admin', 'warehouse']);
  if (auth.response) return auth.response;

  try {
    const body = await req.json();
    const result = await createShelf(body);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
