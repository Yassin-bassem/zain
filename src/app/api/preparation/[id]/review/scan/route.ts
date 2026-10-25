import { NextRequest, NextResponse } from 'next/server';
import { processReviewScan } from '@/lib/services/preparationService';
import { authorizeRoles } from '@/lib/auth/apiAuth';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorizeRoles(['admin', 'warehouse']);
  if (auth.response) return auth.response;

  try {
    const { id } = await params;
    const orderId = parseInt(id, 10);
    const { session_id, code, idempotency_key } = await req.json();

    if (!code || !code.trim()) {
      return NextResponse.json({ error: 'كود الباركود مطلوب للفحص.' }, { status: 400 });
    }

    const result = await processReviewScan({
      sessionId: parseInt(session_id, 10),
      orderId,
      userId: auth.user.id,
      code: code.trim(),
      idempotencyKey: idempotency_key,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
