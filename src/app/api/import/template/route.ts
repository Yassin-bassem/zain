import { NextResponse } from 'next/server';
import { generateSampleExcelBuffer } from '@/lib/services/excelImportService';

export async function GET() {
  const buffer = generateSampleExcelBuffer();

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="clothing_inventory_sample_template.xlsx"',
    },
  });
}
