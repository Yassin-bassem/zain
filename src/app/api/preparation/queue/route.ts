import { NextRequest, NextResponse } from 'next/server';
import { getPreparationQueue } from '@/lib/services/preparationService';
import { authorizeRoles } from '@/lib/auth/apiAuth';

export async function GET(req: NextRequest) {
  const auth = await authorizeRoles(['admin', 'sales', 'warehouse']);
  if (auth.response) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || 'all';
    const priority = searchParams.get('priority') || 'all';
    const employeeId = searchParams.get('employee_id') ? parseInt(searchParams.get('employee_id')!, 10) : undefined;

    const orders = await getPreparationQueue({
      search,
      status,
      priority,
      employeeId,
    });

    return NextResponse.json({ orders });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
