import { NextRequest, NextResponse } from 'next/server';
import { updateShelf, deleteShelf } from '@/lib/services/shelfService';
import { authorizeRoles } from '@/lib/auth/apiAuth';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorizeRoles(['admin', 'warehouse']);
  if (auth.response) return auth.response;

  try {
    const { id } = await params;
    const shelfId = parseInt(id, 10);
    const body = await req.json();

    const result = await updateShelf(shelfId, body);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorizeRoles(['admin']);
  if (auth.response) return auth.response;

  try {
    const { id } = await params;
    const shelfId = parseInt(id, 10);

    const result = await deleteShelf(shelfId);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
