import { NextRequest, NextResponse } from 'next/server';
import { createBulkVariants } from '@/lib/services/productService';
import { authorizeRoles } from '@/lib/auth/apiAuth';

export async function POST(req: NextRequest) {
  const auth = await authorizeRoles(['admin']);
  if (auth.response) return auth.response;

  try {
    const body = await req.json();
    const result = await createBulkVariants({
      productId: Number(body.productId),
      colorIds: body.colorIds.map(Number),
      sizeIds: body.sizeIds.map(Number),
      excludedKeys: body.excludedKeys || [],
      minStockThreshold: Number(body.minStockThreshold || 0),
    });

    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
