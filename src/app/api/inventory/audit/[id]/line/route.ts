import { NextRequest, NextResponse } from 'next/server';
import { updateAuditLineCount } from '@/lib/services/auditService';
import { authorizeRoles } from '@/lib/auth/apiAuth';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorizeRoles(['admin', 'warehouse']);
  if (auth.response) return auth.response;

  try {
    const { id } = await params;
    const sessionId = parseInt(id, 10);
    const { line_id, counted_quantity, notes } = await req.json();

    const countNum = parseInt(counted_quantity, 10);
    if (isNaN(countNum) || countNum < 0) {
      return NextResponse.json({ error: 'الكمية الفعلية يجب أن تكون رقماً غير سالب.' }, { status: 400 });
    }

    const result = await updateAuditLineCount(
      sessionId,
      parseInt(line_id, 10),
      countNum,
      auth.user.id,
      notes
    );

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
