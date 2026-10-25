import { NextRequest, NextResponse } from 'next/server';
import { query, execute } from '@/lib/db';
import { authorizeRoles } from '@/lib/auth/apiAuth';

export async function GET(req: NextRequest) {
  const auth = await authorizeRoles(['admin']);
  if (auth.response) return auth.response;

  try {
    const permissions = await query(
      `SELECT id, role, permission_key, allowed, created_at 
       FROM role_permissions 
       ORDER BY role, permission_key ASC`
    );

    return NextResponse.json({ permissions });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await authorizeRoles(['admin']);
  if (auth.response) return auth.response;

  try {
    const body = await req.json();
    const { role, permission_key, allowed } = body;

    if (!role || !permission_key) {
      return NextResponse.json({ error: 'الدور والمفتاح مطلوبان.' }, { status: 400 });
    }

    await execute(
      `INSERT INTO role_permissions (role, permission_key, allowed)
       VALUES ($1, $2, $3)
       ON CONFLICT (role, permission_key)
       DO UPDATE SET allowed = EXCLUDED.allowed`,
      [role, permission_key, Boolean(allowed)]
    );

    return NextResponse.json({ success: true, role, permission_key, allowed });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
