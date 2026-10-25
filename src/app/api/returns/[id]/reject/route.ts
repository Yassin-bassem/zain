import { NextRequest, NextResponse } from 'next/server';
import { rejectReturnRequest } from '@/lib/services/returnService';
import { authorizeRoles } from '@/lib/auth/apiAuth';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorizeRoles(['admin']);
  if (auth.response) return auth.response;

  try {
    const { id } = await params;
    const returnId = parseInt(id, 10);
    const { reason } = await req.json();

    if (!reason || !reason.trim()) {
      return NextResponse.json({ error: 'سبب رفض المرتجع إلزامي ومطلوب.' }, { status: 400 });
    }

    const result = await rejectReturnRequest(returnId, auth.user.id, reason.trim());
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
