import { NextRequest, NextResponse } from 'next/server';
import { searchVariantsForAssignment } from '@/lib/services/shelfService';
import { authorizeRoles } from '@/lib/auth/apiAuth';

export async function GET(req: NextRequest) {
  const auth = await authorizeRoles(['admin', 'sales', 'warehouse']);
  if (auth.response) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const variants = await searchVariantsForAssignment(search);
    return NextResponse.json({ variants });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
