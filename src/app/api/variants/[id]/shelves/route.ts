import { NextRequest, NextResponse } from 'next/server';
import { getVariantShelves, assignVariantShelf } from '@/lib/services/shelfService';
import { authorizeRoles } from '@/lib/auth/apiAuth';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorizeRoles(['admin', 'sales', 'warehouse']);
  if (auth.response) return auth.response;

  try {
    const { id } = await params;
    const variantId = parseInt(id, 10);
    const shelves = await getVariantShelves(variantId);
    return NextResponse.json({ shelves });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorizeRoles(['admin', 'warehouse']);
  if (auth.response) return auth.response;

  try {
    const { id } = await params;
    const variantId = parseInt(id, 10);
    const body = await req.json();

    const result = await assignVariantShelf({
      variantId,
      shelfId: parseInt(body.shelf_id, 10),
      quantity: body.quantity !== undefined ? parseInt(body.quantity, 10) : undefined,
      isPrimary: body.is_primary,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
