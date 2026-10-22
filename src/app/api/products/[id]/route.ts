import { NextRequest, NextResponse } from 'next/server';
import { getModelStockMatrix } from '@/lib/services/inventoryService';
import { query, queryOne, execute } from '@/lib/db';
import { authorizeRoles } from '@/lib/auth/apiAuth';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorizeRoles(['admin', 'sales', 'warehouse']);
  if (auth.response) return auth.response;

  try {
    const { id } = await params;
    const productId = Number(id);

    const matrix = await getModelStockMatrix(productId);
    return NextResponse.json(matrix);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 404 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorizeRoles(['admin']);
  if (auth.response) return auth.response;

  try {
    const { id } = await params;
    const productId = Number(id);
    const body = await req.json();

    await execute(
      `UPDATE products 
       SET model_name = $1, category_id = $2, description = $3, default_price = $4, active = $5, updated_at = CURRENT_TIMESTAMP
       WHERE id = $6`,
      [
        body.model_name,
        body.category_id || null,
        body.description || null,
        Number(body.default_price || 0),
        body.active !== undefined ? Boolean(body.active) : true,
        productId,
      ]
    );

    return NextResponse.json({ success: true, message: 'تم تحديث الموديل بنجاح' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
