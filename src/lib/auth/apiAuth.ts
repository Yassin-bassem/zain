import { NextResponse } from 'next/server';
import { getCurrentUser, AuthUser, UserRole } from '@/lib/auth';

export async function authenticateApi(): Promise<AuthUser | null> {
  return await getCurrentUser();
}

export function jsonResponse(data: any, status = 200) {
  return NextResponse.json(data, { status });
}

export function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function authorizeRoles(allowedRoles: UserRole[]): Promise<{
  user: AuthUser;
  response?: NextResponse;
}> {
  const user = await getCurrentUser();
  if (!user) {
    return {
      user: null as any,
      response: errorResponse('يرجى تسجيل الدخول أولاً للوصول إلى هذا الإجراء.', 401),
    };
  }

  if (!allowedRoles.includes(user.role)) {
    return {
      user,
      response: errorResponse('ليس لديك الصلاحية الكافية لتنفيذ هذا الإجراء.', 403),
    };
  }

  return { user };
}
