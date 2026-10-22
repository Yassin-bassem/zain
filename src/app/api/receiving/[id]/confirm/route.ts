import { NextRequest, NextResponse } from 'next/server';
import { confirmReceipt } from '@/lib/services/receivingService';
import { authorizeRoles } from '@/lib/auth/apiAuth';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorizeRoles(['admin', 'warehouse']);
  if (auth.response) return auth.response;

  try {
    const { id } = await params;
    const receiptId = Number(id);

    const result = await confirmReceipt(auth.user.id, receiptId);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
