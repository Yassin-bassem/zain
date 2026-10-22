import { NextRequest, NextResponse } from 'next/server';
import { inspectAndRestockReturnItem } from '@/lib/services/returnService';
import { authorizeRoles } from '@/lib/auth/apiAuth';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorizeRoles(['admin', 'warehouse']);
  if (auth.response) return auth.response;

  try {
    const { id } = await params;
    const returnId = Number(id);
    const body = await req.json();

    const result = await inspectAndRestockReturnItem({
      userId: auth.user.id,
      returnId,
      itemId: Number(body.itemId),
      disposition: body.disposition, // 'sellable' | 'damaged'
      inspectionNotes: body.inspectionNotes,
      locationId: body.locationId,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
