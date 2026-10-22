import { NextRequest, NextResponse } from 'next/server';
import { generateErrorReportExcel, RowError } from '@/lib/services/excelImportService';

export async function POST(req: NextRequest) {
  try {
    const { errors } = (await req.json()) as { errors: RowError[] };
    if (!errors || errors.length === 0) {
      return NextResponse.json({ error: 'لا توجد أخطاء لتصديرها.' }, { status: 400 });
    }

    const buffer = generateErrorReportExcel(errors);

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="import_errors_report.xlsx"',
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
