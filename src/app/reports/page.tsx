'use client';

import React, { useState, useEffect } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import {
  BarChart3,
  Layers,
  FileSpreadsheet,
  TrendingDown,
  Sparkles,
  Users,
  Loader2,
  Printer,
  Calendar,
} from 'lucide-react';

export default function ReportsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeReport, setActiveReport] = useState<'models' | 'low_stock' | 'top_variants' | 'customers'>('models');

  const fetchReports = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/reports');
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const handlePrint = () => {
    window.print();
  };

  return (
    <AppShell
      title="التقارير والإحصائيات والتحليلات المخزنية"
      subtitle="بيانات تحليلية محسوبة من واقع سجلات المعاملات الفعلية والأرصدة المتاحة للبيع"
    >
      <div className="space-y-6">
        {/* Navigation Tabs & Print Bar */}
        <div className="no-print bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 overflow-x-auto">
            <button
              onClick={() => setActiveReport('models')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeReport === 'models'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>أرصدة المخزون حسب الموديل</span>
            </button>

            <button
              onClick={() => setActiveReport('low_stock')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeReport === 'low_stock'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <TrendingDown className="w-4 h-4" />
              <span>الأصناف الشحيحة والنافدة</span>
            </button>

            <button
              onClick={() => setActiveReport('top_variants')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeReport === 'top_variants'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>الأكثر طلباً ومبيعاً</span>
            </button>

            <button
              onClick={() => setActiveReport('customers')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeReport === 'customers'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>إجماليات مبيعات العملاء</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold shadow-sm transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>طباعة التقرير</span>
            </button>
          </div>
        </div>

        {loading ? (
          <div className="py-24 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto mb-2" />
            <p className="text-xs font-bold text-slate-500">جارٍ تجميع وتوليد التقارير المخزنية...</p>
          </div>
        ) : !data ? (
          <div className="py-16 text-center text-slate-400 text-xs">لا تتوفر بيانات تقارير حالياً</div>
        ) : (
          <div className="space-y-6">
            {/* 1. Stock By Model Report */}
            {activeReport === 'models' && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs font-bold text-slate-800">
                  <span>تقرير أرصدة المخزون مجمعة حسب الموديل ({data.stockByModel?.length} موديل)</span>
                  <span className="text-slate-500">حساب آلي دقيق لمجموع قطع المتغيرات</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-3 px-4">كود الموديل</th>
                        <th className="py-3 px-4">اسم الموديل</th>
                        <th className="py-3 px-4">القسم / الفئة</th>
                        <th className="py-3 px-4 text-center">عدد المتغيرات</th>
                        <th className="py-3 px-4 text-center">القطع الفعلية (على الأرفف)</th>
                        <th className="py-3 px-4 text-center">القطع المحجوزة للطلبات</th>
                        <th className="py-3 px-4 text-center">القطع المتاحة للطلب</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.stockByModel?.map((m: any) => (
                        <tr key={m.id} className="hover:bg-slate-50">
                          <td className="py-3 px-4 font-mono font-black text-indigo-700">{m.model_code}</td>
                          <td className="py-3 px-4 font-bold text-slate-900">{m.model_name}</td>
                          <td className="py-3 px-4">{m.category_name || 'عام'}</td>
                          <td className="py-3 px-4 text-center font-bold text-purple-700">
                            {m.variants_count} متغير
                          </td>
                          <td className="py-3 px-4 text-center font-black text-sm text-slate-900">
                            {Number(m.physical_pieces).toLocaleString('ar-EG')}
                          </td>
                          <td className="py-3 px-4 text-center font-black text-sm text-amber-700">
                            {Number(m.reserved_pieces).toLocaleString('ar-EG')}
                          </td>
                          <td className="py-3 px-4 text-center font-black text-sm text-emerald-800">
                            {Number(m.available_pieces).toLocaleString('ar-EG')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 2. Low & Out of Stock Report */}
            {activeReport === 'low_stock' && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="p-4 bg-rose-50/50 border-b border-rose-200 flex items-center justify-between text-xs font-bold text-rose-900">
                  <span>تقرير الأصناف الشحيحة والنافذة التي تحتاج لإعادة تصنيع أو توريد ({data.lowAndOutStock?.length} صنف)</span>
                  <span className="text-[11px] text-rose-600 font-semibold">بناءً على حد الطلب الأدنى أو رصيد صفر</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-3 px-4">كود الموديل</th>
                        <th className="py-3 px-4">اسم الموديل</th>
                        <th className="py-3 px-4">اللون</th>
                        <th className="py-3 px-4">المقاس</th>
                        <th className="py-3 px-4">الباركود (SKU)</th>
                        <th className="py-3 px-4 text-center">الرصيد الفعلي</th>
                        <th className="py-3 px-4 text-center">المحجوز</th>
                        <th className="py-3 px-4 text-center">الرصيد المتاح</th>
                        <th className="py-3 px-4 text-center">حد الطلب الأدنى</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.lowAndOutStock?.map((v: any) => {
                        const isZero = Number(v.available_quantity) <= 0;
                        return (
                          <tr key={v.id} className="hover:bg-slate-50">
                            <td className="py-3 px-4 font-mono font-black text-indigo-700">{v.model_code}</td>
                            <td className="py-3 px-4 font-bold text-slate-900">{v.model_name}</td>
                            <td className="py-3 px-4 font-semibold">{v.color_name}</td>
                            <td className="py-3 px-4 font-semibold">{v.size_name}</td>
                            <td className="py-3 px-4 font-mono text-[11px] text-slate-500">{v.sku}</td>
                            <td className="py-3 px-4 text-center font-bold text-slate-900">{v.on_hand_quantity}</td>
                            <td className="py-3 px-4 text-center font-bold text-amber-700">{v.reserved_quantity}</td>
                            <td className="py-3 px-4 text-center">
                              <span
                                className={`px-2.5 py-0.5 rounded-md font-black text-xs ${
                                  isZero ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                                }`}
                              >
                                {v.available_quantity} متاح
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center font-mono text-slate-600">{v.min_stock_threshold}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 3. Top Ordered Variants */}
            {activeReport === 'top_variants' && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="p-4 bg-purple-50/50 border-b border-purple-200 flex items-center justify-between text-xs font-bold text-purple-900">
                  <span>المتغيرات والألوان والمقاسات الأكثر طلباً ومبيعاً بناءً على تاريخ الطلبات الفعلي</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-3 px-4">كود الموديل</th>
                        <th className="py-3 px-4">اسم الموديل</th>
                        <th className="py-3 px-4">اللون</th>
                        <th className="py-3 px-4">المقاس</th>
                        <th className="py-3 px-4">الباركود (SKU)</th>
                        <th className="py-3 px-4 text-center">إجمالي القطع المطلوبة</th>
                        <th className="py-3 px-4 text-center">تكرار الظهور في الطلبات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.topVariants?.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-12 text-center text-slate-400">
                            لا توجد طلبات كافية بعد لحساب الأصناف الأكثر طلباً.
                          </td>
                        </tr>
                      ) : (
                        data.topVariants?.map((tv: any) => (
                          <tr key={tv.id} className="hover:bg-slate-50">
                            <td className="py-3 px-4 font-mono font-black text-indigo-700">{tv.model_code}</td>
                            <td className="py-3 px-4 font-bold text-slate-900">{tv.model_name}</td>
                            <td className="py-3 px-4 font-semibold">{tv.color_name}</td>
                            <td className="py-3 px-4 font-semibold">{tv.size_name}</td>
                            <td className="py-3 px-4 font-mono text-[11px] text-slate-500">{tv.sku}</td>
                            <td className="py-3 px-4 text-center font-black text-sm text-purple-900">
                              {Number(tv.total_ordered_pieces).toLocaleString('ar-EG')} قطعة
                            </td>
                            <td className="py-3 px-4 text-center font-bold text-slate-700">
                              في {tv.order_occurrences} طلبات مختلفة
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 4. Sales Totals By Customer */}
            {activeReport === 'customers' && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="p-4 bg-emerald-50/50 border-b border-emerald-200 flex items-center justify-between text-xs font-bold text-emerald-900">
                  <span>إجماليات أوامر البيع والقطع المطلوبة حسب كل عميل ومحل</span>
                  <span className="text-[11px] text-slate-500">تمثل إجماليات أوامر البيع الفعلية غير الملغية</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-3 px-4">كود العميل</th>
                        <th className="py-3 px-4">اسم العميل / المحل</th>
                        <th className="py-3 px-4">الهاتف</th>
                        <th className="py-3 px-4 text-center">عدد الطلبات</th>
                        <th className="py-3 px-4 text-center">إجمالي القطع المشتراة</th>
                        <th className="py-3 px-4 text-center">إجمالي قيمة الطلبات (ج.م)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.salesByCustomer?.map((c: any) => (
                        <tr key={c.id} className="hover:bg-slate-50">
                          <td className="py-3 px-4 font-mono font-bold text-indigo-700">{c.customer_code}</td>
                          <td className="py-3 px-4 font-bold text-slate-900">{c.name}</td>
                          <td className="py-3 px-4 font-mono text-slate-700">{c.phone}</td>
                          <td className="py-3 px-4 text-center font-bold text-slate-800">{c.total_orders}</td>
                          <td className="py-3 px-4 text-center font-black text-slate-900">
                            {Number(c.total_pieces_ordered).toLocaleString('ar-EG')} قطعة
                          </td>
                          <td className="py-3 px-4 text-center font-black text-sm text-emerald-900">
                            {Number(c.total_sales_value).toLocaleString('ar-EG')} ج.م
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
