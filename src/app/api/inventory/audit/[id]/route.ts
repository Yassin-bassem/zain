import { NextRequest, NextResponse } from 'next/server';
import { getAuditSessionDetails } from '@/lib/services/auditService';
import { authorizeRoles } from '@/lib/auth/apiAuth';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorizeRoles(['admin', 'sales', 'warehouse']);
  if (auth.response) return auth.response;

  try {
    const { id } = await params;
    const sessionId = parseInt(id, 10);
    const data = await getAuditSessionDetails(sessionId);
    if (!data) {
      return NextResponse.json({ error: 'جلسة الجرد غير موجودة' }, { status: 404 });
    }
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
