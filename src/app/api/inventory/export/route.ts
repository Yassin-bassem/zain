import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { getInventoryList } from '@/lib/services/inventoryService';
import { authorizeRoles } from '@/lib/auth/apiAuth';

export async function GET(req: NextRequest) {
  const auth = await authorizeRoles(['admin', 'sales', 'warehouse']);
  if (auth.response) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const categoryId = searchParams.get('categoryId') ? Number(searchParams.get('categoryId')) : undefined;
    const stockStatus = (searchParams.get('stockStatus') || 'all') as any;

    const data = await getInventoryList({
      search,
      categoryId,
      stockStatus,
      page: 1,
      limit: 10000,
    });

    const exportRows = data.items.map((item) => ({
      'كود الموديل': item.model_code,
      'اسم الموديل': item.model_name,
      'القسم / الفئة': item.category_name || 'عام',
      'اللون': item.color_name,
      'المقاس': item.size_name,
      'الباركود / SKU': item.sku,
      'المستودع': item.location_name,
      'الرصيد الفعلي (قطعة)': item.on_hand_quantity,
      'الرصيد المحجوز (قطعة)': item.reserved_quantity,
      'الرصيد المتاح للبيع (قطعة)': item.available_quantity,
      'سعر البيع الافتراضي': item.default_price,
      'حد الطلب الأدنى': item.min_stock_threshold,
      'آخر حركة مخزنية': item.last_movement_at ? new Date(item.last_movement_at).toLocaleDateString('ar-EG') : 'لا يوجد',
    }));

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'تقرير_المخزون');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="inventory_report_${new Date().toISOString().slice(0, 10)}.xlsx"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
