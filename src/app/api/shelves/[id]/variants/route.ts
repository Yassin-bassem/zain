import { NextRequest, NextResponse } from 'next/server';
import {
  getShelfAssignedVariants,
  assignVariantShelf,
  removeVariantFromShelf,
} from '@/lib/services/shelfService';
import { authorizeRoles } from '@/lib/auth/apiAuth';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorizeRoles(['admin', 'sales', 'warehouse']);
  if (auth.response) return auth.response;

  try {
    const { id } = await params;
    const shelfId = parseInt(id, 10);
    const variants = await getShelfAssignedVariants(shelfId);
    return NextResponse.json({ variants });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
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
    const shelfId = parseInt(id, 10);
    const body = await req.json();

    const result = await assignVariantShelf({
      shelfId,
      variantId: parseInt(body.variant_id, 10),
      quantity: body.quantity !== undefined ? parseInt(body.quantity, 10) : 0,
      isPrimary: Boolean(body.is_primary),
    });

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorizeRoles(['admin', 'warehouse']);
  if (auth.response) return auth.response;

  try {
    const { id } = await params;
    const shelfId = parseInt(id, 10);
    const { searchParams } = new URL(req.url);
    const variantIdParam = searchParams.get('variantId');
    const variantId = variantIdParam ? parseInt(variantIdParam, 10) : null;

    if (!variantId) {
      return NextResponse.json({ error: 'معرف المتغير مطلوب' }, { status: 400 });
    }

    const result = await removeVariantFromShelf(shelfId, variantId);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
