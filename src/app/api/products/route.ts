import { NextRequest, NextResponse } from 'next/server';
import { listProducts, createProduct } from '@/lib/services/productService';
import { authorizeRoles } from '@/lib/auth/apiAuth';

export async function GET(req: NextRequest) {
  const auth = await authorizeRoles(['admin', 'sales', 'warehouse']);
  if (auth.response) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const categoryId = searchParams.get('categoryId') ? Number(searchParams.get('categoryId')) : undefined;
    const page = Number(searchParams.get('page') || 1);
    const limit = Number(searchParams.get('limit') || 50);

    const result = await listProducts({
      search,
      categoryId,
      page,
      limit,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await authorizeRoles(['admin']);
  if (auth.response) return auth.response;

  try {
    const body = await req.json();
    const product = await createProduct({
      model_code: body.model_code,
      model_name: body.model_name,
      category_id: body.category_id,
      description: body.description,
      default_price: Number(body.default_price || 0),
    });

    return NextResponse.json({ success: true, product });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
