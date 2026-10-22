import { NextRequest, NextResponse } from 'next/server';
import { validateSpreadsheetRows, ImportMode, ColumnMapping } from '@/lib/services/excelImportService';
import { authorizeRoles } from '@/lib/auth/apiAuth';

export async function POST(req: NextRequest) {
  const auth = await authorizeRoles(['admin']);
  if (auth.response) return auth.response;

  try {
    const { rows, mapping, mode } = (await req.json()) as {
      rows: any[];
      mapping: ColumnMapping;
      mode: ImportMode;
    };

    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: 'لا توجد بيانات للتحقق منها.' }, { status: 400 });
    }

    const preview = await validateSpreadsheetRows(rows, mapping, mode);
    return NextResponse.json(preview);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
