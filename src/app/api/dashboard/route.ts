import { NextResponse } from 'next/server';
import { getDashboardMetrics } from '@/lib/services/inventoryService';
import { authorizeRoles } from '@/lib/auth/apiAuth';

export async function GET() {
  const auth = await authorizeRoles(['admin', 'sales', 'warehouse']);
  if (auth.response) return auth.response;

  try {
    const data = await getDashboardMetrics();
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
