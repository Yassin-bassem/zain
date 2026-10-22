import { NextRequest, NextResponse } from 'next/server';
import { getInventoryList, adjustStock } from '@/lib/services/inventoryService';
import { authorizeRoles } from '@/lib/auth/apiAuth';

export async function GET(req: NextRequest) {
  const auth = await authorizeRoles(['admin', 'sales', 'warehouse']);
  if (auth.response) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const categoryId = searchParams.get('categoryId') ? Number(searchParams.get('categoryId')) : undefined;
    const stockStatus = (searchParams.get('stockStatus') || 'all') as any;
    const page = Number(searchParams.get('page') || 1);
    const limit = Number(searchParams.get('limit') || 50);

    const result = await getInventoryList({
      search,
      categoryId,
      stockStatus,
      page,
      limit,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  // Stock adjustments require admin authorization
  const auth = await authorizeRoles(['admin']);
  if (auth.response) return auth.response;

  try {
    const body = await req.json();
    const result = await adjustStock({
      userId: auth.user.id,
      locationId: body.locationId,
      reason: body.reason,
      items: body.items,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
