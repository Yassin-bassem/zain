import { NextRequest, NextResponse } from 'next/server';
import { parseSpreadsheetBuffer, detectColumnMapping } from '@/lib/services/excelImportService';
import { authorizeRoles } from '@/lib/auth/apiAuth';

export async function POST(req: NextRequest) {
  const auth = await authorizeRoles(['admin']);
  if (auth.response) return auth.response;

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const sheetName = formData.get('sheet') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'يرجى تحديد ملف Excel أو CSV للرفع.' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { sheets, readSheet } = parseSpreadsheetBuffer(buffer);
    const selectedSheet = sheetName && sheets.includes(sheetName) ? sheetName : sheets[0];
    const { headers, rows } = readSheet(selectedSheet);

    const mapping = detectColumnMapping(headers);

    return NextResponse.json({
      filename: file.name,
      fileSize: file.size,
      sheets,
      selectedSheet,
      headers,
      sampleRows: rows.slice(0, 10),
      totalRows: rows.length,
      detectedMapping: mapping,
      allRows: rows,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'فشل في قراءة ملف الإكسيل' }, { status: 500 });
  }
}
