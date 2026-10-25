import { NextRequest, NextResponse } from 'next/server';
import { approveAndApplyAuditAdjustments } from '@/lib/services/auditService';
import { authorizeRoles } from '@/lib/auth/apiAuth';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorizeRoles(['admin']);
  if (auth.response) return auth.response;

  try {
    const { id } = await params;
    const sessionId = parseInt(id, 10);
    const body = await req.json().catch(() => ({}));

    const result = await approveAndApplyAuditAdjustments(
      sessionId,
      auth.user.id,
      body.notes
    );

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
