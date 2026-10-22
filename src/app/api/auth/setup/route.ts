import { NextRequest, NextResponse } from 'next/server';
import { createInitialAdmin, isInitialSetupRequired, signToken } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const isRequired = await isInitialSetupRequired();
    if (!isRequired) {
      return NextResponse.json(
        { error: 'تم إعداد حساب المدير مسبقاً ولا يمكن تكرار هذه العملية.' },
        { status: 400 }
      );
    }

    const { username, full_name, email, password } = await req.json();

    if (!username || !password || !full_name) {
      return NextResponse.json(
        { error: 'اسم المستخدم والاسم الكامل وكلمة المرور مطلوبة لإعداد الحساب الإداري.' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'يجب ألا تقل كلمة المرور عن 6 أحرف.' },
        { status: 400 }
      );
    }

    const admin = await createInitialAdmin({
      username,
      full_name,
      email,
      password,
    });

    const token = signToken(admin);

    const response = NextResponse.json({
      success: true,
      message: 'تم إنشاء حساب مدير النظام بنجاح.',
      user: admin,
    });

    response.cookies.set({
      name: 'zain_auth_token',
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'حدث خطأ أثناء إعداد النظام' }, { status: 500 });
  }
}
