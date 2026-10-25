import { NextRequest, NextResponse } from 'next/server';
import { getOrCreateReviewSession, confirmReviewCompletion } from '@/lib/services/preparationService';
import { authorizeRoles } from '@/lib/auth/apiAuth';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorizeRoles(['admin', 'sales', 'warehouse']);
  if (auth.response) return auth.response;

  try {
    const { id } = await params;
    const orderId = parseInt(id, 10);
    const sessionData = await getOrCreateReviewSession(orderId, auth.user.id);
    return NextResponse.json(sessionData);
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
    const orderId = parseInt(id, 10);
    const { session_id } = await req.json();

    const result = await confirmReviewCompletion(parseInt(session_id, 10), orderId, auth.user.id);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
