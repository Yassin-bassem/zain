import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { authorizeRoles } from '@/lib/auth/apiAuth';

export async function GET(req: NextRequest) {
  const auth = await authorizeRoles(['admin']);
  if (auth.response) return auth.response;

  try {
    const logs = await query(
      `SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 150`
    );
    return NextResponse.json({ logs });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
