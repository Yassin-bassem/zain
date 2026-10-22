import { NextResponse } from 'next/server';

export async function POST() {
  const response = NextResponse.json({ success: true, message: 'تم تسجيل الخروج بنجاح' });
  response.cookies.set({
    name: 'zain_auth_token',
    value: '',
    httpOnly: true,
    expires: new Date(0),
    path: '/',
  });
  return response;
}
