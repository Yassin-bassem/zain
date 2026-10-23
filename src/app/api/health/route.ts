import { NextResponse } from 'next/server';
import { queryOne } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const start = Date.now();
  try {
    const res = await queryOne<{ db_check: number; user_count: string }>(
      'SELECT 1 as db_check, COUNT(*) as user_count FROM users'
    );
    const duration = Date.now() - start;

    return NextResponse.json({
      status: 'ok',
      message: 'Zain Wholesale Arabic WMS API is healthy',
      database: 'connected',
      userCount: Number(res?.user_count || 0),
      dbLatencyMs: duration,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json({
      status: 'degraded',
      message: 'Server function running but database query failed',
      database: 'error',
      error: err.message || String(err),
      durationMs: Date.now() - start,
      timestamp: new Date().toISOString(),
    }, { status: 200 });
  }
}
