import { NextRequest, NextResponse } from 'next/server';
import { query, execute } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { authorizeRoles } from '@/lib/auth/apiAuth';

export async function GET() {
  const auth = await authorizeRoles(['admin']);
  if (auth.response) return auth.response;

  try {
    const users = await query(
      'SELECT id, username, full_name, email, role, active, created_at, updated_at FROM users ORDER BY created_at ASC'
    );
    return NextResponse.json({ users });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await authorizeRoles(['admin']);
  if (auth.response) return auth.response;

  try {
    const { username, full_name, email, password, role } = await req.json();

    if (!username || !full_name || !password || !role) {
      return NextResponse.json({ error: 'جميع الحقول الأساسية مطلوبة.' }, { status: 400 });
    }

    if (!['admin', 'sales', 'warehouse'].includes(role)) {
      return NextResponse.json({ error: 'الدور المحدد غير صالح.' }, { status: 400 });
    }

    const hash = await hashPassword(password);

    const rows = await query<{ id: number }>(
      `INSERT INTO users (username, full_name, email, password_hash, role, active)
       VALUES ($1, $2, $3, $4, $5, true)
       RETURNING id`,
      [username.trim(), full_name.trim(), email?.trim() || null, hash, role]
    );

    // Audit log
    await execute(
      `INSERT INTO audit_logs (user_id, username, action, entity_type, entity_id, details)
       VALUES ($1, $2, 'CREATE_USER', 'user', $3, $4)`,
      [
        auth.user.id,
        auth.user.username,
        String(rows[0].id),
        JSON.stringify({ newUsername: username, role }),
      ]
    );

    return NextResponse.json({ success: true, userId: rows[0].id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
