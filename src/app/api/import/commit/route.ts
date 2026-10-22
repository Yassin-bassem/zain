import { NextRequest, NextResponse } from 'next/server';
import { commitImport, ImportMode } from '@/lib/services/excelImportService';
import { authorizeRoles } from '@/lib/auth/apiAuth';

export async function POST(req: NextRequest) {
  const auth = await authorizeRoles(['admin']);
  if (auth.response) return auth.response;

  try {
    const { filename, mode, locationId, validRows, reason } = (await req.json()) as {
      filename: string;
      mode: ImportMode;
      locationId?: number;
      validRows: any[];
      reason?: string;
    };

    const result = await commitImport({
      userId: auth.user.id,
      filename: filename || 'import_file.xlsx',
      mode,
      locationId,
      validRows,
      reason,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
