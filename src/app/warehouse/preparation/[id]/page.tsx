'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import {
  PackageCheck,
  Printer,
  QrCode,
  ArrowRight,
  User,
  Phone,
  Calendar,
  Layers,
  CheckSquare,
  AlertCircle,
  Loader2,
  FileText,
  Warehouse,
  Boxes,
} from 'lucide-react';

function OrderPreparationDetailContent() {
  const router = useRouter();
  const params = useParams();
  const orderId = params.id as string;

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchDetails = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/preparation/${orderId}`);
      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || 'تعذر تحميل بيانات الفاتورة');
      }
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetails();
  }, [orderId]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <AppShell title="تحضير الأوردر" subtitle="جارٍ التحميل...">
        <div className="py-24 text-center">
          <Loader2 className="w-10 h-10 animate-spin text-indigo-600 mx-auto mb-3" />
          <p className="text-xs font-bold text-slate-500">جارٍ قراءة بنود الفاتورة وتوزيع الأرفف...</p>
        </div>
      </AppShell>
    );
  }

  if (error || !data) {
    return (
      <AppShell title="خطأ في تحميل الفاتورة" subtitle="تعذر جلب البيانات">
        <div className="p-8 max-w-xl mx-auto bg-white rounded-2xl border border-rose-200 text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
          <h2 className="text-base font-black text-slate-900">{error || 'الطلب غير موجود'}</h2>
          <Link
            href="/warehouse/preparation"
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-bold"
          >
            <ArrowRight className="w-4 h-4" />
            <span>العودة لطابور التجهيز</span>
          </Link>
        </div>
      </AppShell>
    );
  }

  const { order, items, shelfGroups } = data;
  const totalChecked = items.reduce((acc: number, i: any) => acc + (i.quantity_checked || 0), 0);
  const totalRequired = items.reduce((acc: number, i: any) => acc + (i.quantity_required || 0), 0);
  const isFullyChecked = totalChecked >= totalRequired && totalRequired > 0;

  return (
    <AppShell
      title={`تحضير الفاتورة: ${order.order_number}`}
      subtitle={`العميل: ${order.customer_name} • بنود الفاتورة مجمعة حسب أرفف المستودع لتسهيل الالتقاط`}
    >
      <div className="space-y-6">
        {/* Top Controls - Hidden during print */}
        <div className="print:hidden flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/warehouse/preparation"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors"
          >
            <ArrowRight className="w-4 h-4" />
            <span>العودة لطابور التجهيز</span>
          </Link>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة قائمة الالتقاط (Picking List)</span>
            </button>

            <Link
              href={`/warehouse/preparation/${order.id}/review`}
              className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-xs transition-colors"
            >
              <QrCode className="w-4 h-4" />
              <span>مراجعة الأوردر وفحص الباركود</span>
            </Link>
          </div>
        </div>

        {/* Printable Picking List Header (Visible on print, beautiful on screen) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-slate-200">
            <div>
              <span className="text-[11px] font-bold text-slate-500 block mb-1">
                فاتورة تجهيز المستودع (Picking Sheet)
              </span>
              <h2 className="text-xl font-black text-slate-900 font-mono">
                {order.order_number}
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-6 text-xs text-slate-700">
              <div>
                <span className="text-slate-400 block text-[10px]">العميل / المحل</span>
                <span className="font-bold text-slate-900">{order.customer_name}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">رقم الهاتف</span>
                <span className="font-mono font-bold text-slate-900 dir-ltr">{order.customer_phone}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">تاريخ الطلب</span>
                <span className="font-bold">{new Date(order.order_date).toLocaleDateString('ar-EG')}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">إجمالي القطع</span>
                <span className="font-mono font-black text-indigo-700 text-sm">{order.total_pieces} قطعة</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">حالة المراجعة</span>
                <span className={`inline-block px-2.5 py-0.5 rounded-full font-bold text-[11px] ${
                  isFullyChecked ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                }`}>
                  {isFullyChecked ? 'مكتملة الفحص 100%' : `تم فحص ${totalChecked} من ${totalRequired}`}
                </span>
              </div>
            </div>
          </div>

          {order.notes && (
            <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-200/80 text-amber-900 text-xs">
              <span className="font-bold">ملاحظات التجهيز: </span>
              {order.notes}
            </div>
          )}
        </div>

        {/* Invoice Items Grouped by Shelf */}
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="font-black text-slate-900 text-sm flex items-center gap-2">
              <Warehouse className="w-4 h-4 text-indigo-600" />
              <span>بنود الفاتورة مجمعة حسب الرف التخزيني ({shelfGroups.length} رف)</span>
            </h3>
            <span className="text-xs text-slate-500 font-bold">
              يساعد التجميع على سرعة تحرك أمين المخزن بين الممرات والأرفف
            </span>
          </div>

          {shelfGroups.map((group: any) => (
            <div
              key={group.shelf_code}
              className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden print:break-inside-avoid"
            >
              {/* Shelf Banner */}
              <div className="bg-slate-900 text-white px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="font-mono font-black text-base bg-indigo-600 px-3 py-1 rounded-lg">
                    الرف: {group.shelf_code}
                  </span>
                  <span className="text-xs text-slate-300 font-bold">
                    ({group.items.length} صنف مسكن بهذا الرف)
                  </span>
                </div>
                <div className="text-xs font-bold text-slate-300">
                  المطلوب من هذا الرف:{' '}
                  <span className="font-mono font-black text-white text-sm">{group.total_required}</span> قطعة
                </div>
              </div>

              {/* Items Table in Shelf */}
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-4 w-12 text-center print:table-cell">الالتقاط</th>
                      <th className="py-2.5 px-4">كود الموديل</th>
                      <th className="py-2.5 px-4">اسم الموديل والصنف</th>
                      <th className="py-2.5 px-4">اللون</th>
                      <th className="py-2.5 px-4">المقاس</th>
                      <th className="py-2.5 px-4 text-center font-bold">المطلوب</th>
                      <th className="py-2.5 px-4 text-center">المفحوص (QR)</th>
                      <th className="py-2.5 px-4 text-center">المتبقي</th>
                      <th className="py-2.5 px-4 text-center">المتاح بالمخزن</th>
                      <th className="py-2.5 px-4 font-mono text-[11px]">رمز المتغير SKU</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {group.items.map((it: any) => {
                      const isComplete = it.quantity_checked >= it.quantity_required;

                      return (
                        <tr
                          key={it.id}
                          className={`hover:bg-slate-50 transition-colors ${
                            isComplete ? 'bg-emerald-50/30' : ''
                          }`}
                        >
                          <td className="py-3 px-4 text-center">
                            {/* Checkbox box for physical picking */}
                            <div className="w-5 h-5 border-2 border-slate-400 rounded-md mx-auto flex items-center justify-center font-bold text-slate-800">
                              {isComplete && <span className="text-emerald-600 text-xs">✓</span>}
                            </div>
                          </td>
                          <td className="py-3 px-4 font-black font-mono text-indigo-700 text-sm">
                            {it.model_code}
                          </td>
                          <td className="py-3 px-4 font-bold text-slate-900">{it.model_name}</td>
                          <td className="py-3 px-4 font-bold text-slate-800">{it.color_name}</td>
                          <td className="py-3 px-4 text-slate-800">{it.size_name}</td>
                          <td className="py-3 px-4 text-center font-black font-mono text-base text-slate-900">
                            {it.quantity_required}
                          </td>
                          <td className="py-3 px-4 text-center font-bold font-mono text-emerald-700">
                            {it.quantity_checked}
                          </td>
                          <td className="py-3 px-4 text-center font-mono font-bold">
                            {it.quantity_remaining > 0 ? (
                              <span className="text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
                                {it.quantity_remaining}
                              </span>
                            ) : (
                              <span className="text-emerald-600 font-bold">مكتمل</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center font-mono text-slate-500">
                            {it.available_stock} قطعة
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-400 text-[11px] dir-ltr">
                            {it.sku}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>

        {/* Footer Actions */}
        <div className="print:hidden p-5 bg-white rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div className="text-xs text-slate-600">
            <span>إجمالي الفاتورة: </span>
            <span className="font-bold text-slate-900">{items.length} صنف</span>
            <span className="mx-2">•</span>
            <span className="font-bold text-indigo-700">{totalRequired} قطعة ملابس</span>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href={`/warehouse/preparation/${order.id}/review`}
              className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-xs transition-colors"
            >
              <QrCode className="w-4 h-4" />
              <span>بدء مراجعة الأوردر ومطابقة الباركود</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Print CSS styling */}
      <style jsx global>{`
        @media print {
          body {
            background: white !important;
            color: black !important;
          }
          header, aside, footer, nav, button, input {
            display: none !important;
          }
        }
      `}</style>
    </AppShell>
  );
}

export default function OrderPreparationDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-slate-50 font-sans text-slate-500" dir="rtl">
          جاري تحميل تفاصيل تحضير الفاتورة وأماكن الرفوف...
        </div>
      }
    >
      <OrderPreparationDetailContent />
    </Suspense>
  );
}

