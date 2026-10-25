import { NextRequest, NextResponse } from 'next/server';
import { getPrintableLabels } from '@/lib/services/qrService';
import { authorizeRoles } from '@/lib/auth/apiAuth';

export async function GET(req: NextRequest) {
  const auth = await authorizeRoles(['admin', 'sales', 'warehouse']);
  if (auth.response) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const modelCode = searchParams.get('model_code') || undefined;
    const categoryId = searchParams.get('category_id') ? parseInt(searchParams.get('category_id')!, 10) : undefined;
    const variantId = searchParams.get('variant_id') ? parseInt(searchParams.get('variant_id')!, 10) : undefined;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 100;

    const labels = await getPrintableLabels({
      search,
      modelCode,
      categoryId,
      variantId,
      limit,
    });

    return NextResponse.json({ labels });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
