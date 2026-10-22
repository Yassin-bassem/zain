import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { authorizeRoles } from '@/lib/auth/apiAuth';

export async function GET(req: NextRequest) {
  const auth = await authorizeRoles(['admin']);
  if (auth.response) return auth.response;

  try {
    const batches = await query(
      `SELECT ib.*, u.full_name AS created_by_name, app.full_name AS approved_by_name, loc.name AS location_name
       FROM import_batches ib
       LEFT JOIN users u ON ib.created_by = u.id
       LEFT JOIN users app ON ib.approved_by = app.id
       LEFT JOIN inventory_locations loc ON ib.location_id = loc.id
       ORDER BY ib.created_at DESC
       LIMIT 100`
    );

    return NextResponse.json({ batches });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
