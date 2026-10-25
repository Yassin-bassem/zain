import { NextRequest, NextResponse } from 'next/server';
import { backfillAllVariantQrCodes } from '@/lib/services/qrService';
import { authorizeRoles } from '@/lib/auth/apiAuth';

export async function POST(req: NextRequest) {
  const auth = await authorizeRoles(['admin']);
  if (auth.response) return auth.response;

  try {
    const count = await backfillAllVariantQrCodes();
    return NextResponse.json({
      success: true,
      updated_count: count,
      message: `تم توليد وتحديث أكواد QR بنجاح لعدد ${count} متغير.`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
