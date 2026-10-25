import { NextRequest, NextResponse } from 'next/server';
import { performGlobalSearch } from '@/lib/services/searchService';
import { authorizeRoles } from '@/lib/auth/apiAuth';

export async function GET(req: NextRequest) {
  const auth = await authorizeRoles(['admin', 'sales', 'warehouse']);
  if (auth.response) return auth.response;

  try {
    const url = new URL(req.url);
    const q = url.searchParams.get('q') || '';
    const limit = Math.min(20, Math.max(1, parseInt(url.searchParams.get('limit') || '5', 10)));

    const searchResponse = await performGlobalSearch(q, auth.user.role, limit);
    return NextResponse.json(searchResponse);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
