import { NextRequest, NextResponse } from 'next/server';
import { resolveVariantByScannedCode } from '@/lib/services/qrService';
import { authorizeRoles } from '@/lib/auth/apiAuth';

export async function POST(req: NextRequest) {
  const auth = await authorizeRoles(['admin', 'sales', 'warehouse']);
  if (auth.response) return auth.response;

  try {
    const { code } = await req.json();
    if (!code || !code.trim()) {
      return NextResponse.json({ error: 'كود الفحص مفقود' }, { status: 400 });
    }

    const variant = await resolveVariantByScannedCode(code);
    if (!variant) {
      return NextResponse.json({
        found: false,
        error: `الباركود أو المعرّف (${code}) غير مسجل بالنظام كمتغير صالح.`,
      }, { status: 404 });
    }

    return NextResponse.json({
      found: true,
      variant,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
