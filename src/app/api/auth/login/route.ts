import { NextRequest, NextResponse } from 'next/server';
import { queryOne, execute } from '@/lib/db';
import { comparePassword, signToken, AuthUser } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json({ error: 'اسم المستخدم وكلمة المرور مطلوبان.' }, { status: 400 });
    }

    const userWithHash = await queryOne<AuthUser & { password_hash: string }>(
      'SELECT id, username, full_name, email, password_hash, role, active FROM users WHERE username = $1',
      [username.trim()]
    );

    if (!userWithHash || !userWithHash.active) {
      return NextResponse.json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة.' }, { status: 401 });
    }

    const valid = await comparePassword(password, userWithHash.password_hash);
    if (!valid) {
      return NextResponse.json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة.' }, { status: 401 });
    }

    const authUser: AuthUser = {
      id: userWithHash.id,
      username: userWithHash.username,
      full_name: userWithHash.full_name,
      email: userWithHash.email,
      role: userWithHash.role,
      active: userWithHash.active,
    };

    const token = signToken(authUser);

    // Audit log
    await execute(
      `INSERT INTO audit_logs (user_id, username, action, entity_type, entity_id, details)
       VALUES ($1, $2, 'USER_LOGIN', 'user', $3, $4)`,
      [authUser.id, authUser.username, String(authUser.id), JSON.stringify({ ip: req.headers.get('x-forwarded-for') || 'local' })]
    );

    const response = NextResponse.json({ success: true, user: authUser });
    response.cookies.set({
      name: 'zain_auth_token',
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'حدث خطأ في تسجيل الدخول' }, { status: 500 });
  }
}
