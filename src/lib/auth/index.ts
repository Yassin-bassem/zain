import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { query, queryOne, execute } from '@/lib/db';

export type UserRole = 'admin' | 'sales' | 'warehouse';

export interface AuthUser {
  id: number;
  username: string;
  full_name: string;
  email: string | null;
  role: UserRole;
  active: boolean;
}

const JWT_SECRET = process.env.JWT_SECRET || 'wholesale-clothing-secret-jwt-key-2026';
const COOKIE_NAME = 'zain_auth_token';

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signToken(user: AuthUser): string {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      full_name: user.full_name,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export function verifyToken(token: string): AuthUser | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    return {
      id: decoded.id,
      username: decoded.username,
      full_name: decoded.full_name,
      email: decoded.email || null,
      role: decoded.role,
      active: true,
    };
  } catch {
    return null;
  }
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) return null;

    const decoded = verifyToken(token);
    if (!decoded) return null;

    // Verify user is still active in database
    const user = await queryOne<AuthUser>(
      'SELECT id, username, full_name, email, role, active FROM users WHERE id = $1 AND active = true',
      [decoded.id]
    );

    return user;
  } catch {
    return null;
  }
}

export async function isInitialSetupRequired(): Promise<boolean> {
  const result = await queryOne<{ count: string | number }>(
    'SELECT COUNT(*) as count FROM users'
  );
  return Number(result?.count || 0) === 0;
}

export async function createInitialAdmin(data: {
  username: string;
  full_name: string;
  email?: string;
  password: string;
}): Promise<AuthUser> {
  const isRequired = await isInitialSetupRequired();
  if (!isRequired) {
    throw new Error('تم إعداد حساب المدير مسبقاً ولا يمكن تكرار هذه العملية.');
  }

  const hash = await hashPassword(data.password);
  const rows = await query<AuthUser>(
    `INSERT INTO users (username, full_name, email, password_hash, role, active)
     VALUES ($1, $2, $3, $4, 'admin', true)
     RETURNING id, username, full_name, email, role, active`,
    [data.username.trim(), data.full_name.trim(), data.email?.trim() || null, hash]
  );

  const admin = rows[0];

  // Log setup to audit log
  await execute(
    `INSERT INTO audit_logs (user_id, username, action, entity_type, entity_id, details)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      admin.id,
      admin.username,
      'INITIAL_ADMIN_SETUP',
      'user',
      String(admin.id),
      JSON.stringify({ note: 'تم إنشاء الحساب الإداري الأول بنجاح' }),
    ]
  );

  return admin;
}
