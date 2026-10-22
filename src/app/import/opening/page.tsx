'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import {
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  ShieldCheck,
  Warehouse,
  History,
  Lock,
  Loader2,
  ArrowRight,
} from 'lucide-react';

export default function OpeningInventoryPage() {
  const [openingBatches, setOpeningBatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/import/history');
      if (res.ok) {
        const data = await res.json();
        // Filter only opening stock batches
        const openings = (data.batches || []).filter((b: any) => b.mode === 'opening_stock');
        setOpeningBatches(openings);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  return (
    <AppShell
      title="اعتماد وتوثيق الرصيد الافتتاحي (Opening Inventory)"
      subtitle="إجراء مخصص لضبط المخزون البدائي بدقة وتوثيق تاريخ الاعتماد مع منع تكرار الإدخال"
    >
      <div className="space-y-6">
        {/* Guidance Alert */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-amber-900 text-xs space-y-2">
          <div className="flex items-center gap-2 font-black text-sm text-amber-950">
            <ShieldCheck className="w-5 h-5 text-amber-700" />
            <span>ضوابط الرصيد الافتتاحي الإلزامية لضمان دقة المخزن</span>
          </div>
          <p className="text-amber-800 leading-relaxed">
            • يتم تثبيت الرصيد الافتتاحي لمرة واحدة فقط لكل دفعة معتمدة من قِبل مدير النظام.
            <br />
            • يمنع النظام آلياً إعادة استيراد نفس الملف مرتين لتجنب مضاعفة الرصيد على الأرفف.
            <br />
            • كل رصيد افتتاحي يتم تسجيله كحركة موثقة غير قابلة للتعديل في سجل حركات المخزن بنوع (OPENING_BALANCE).
          </p>
        </div>

        {/* Action Call to Wizard */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-black text-slate-900">استيراد دفعة رصيد افتتاحي جديدة</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              استخدم معالج استيراد الإكسيل المخصص مع تحديد وضع "استيراد رصيد افتتاحي معتمد".
            </p>
          </div>

          <Link
            href="/import"
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>بدء استيراد الرصيد الافتتاحي</span>
          </Link>
        </div>

        {/* Existing Opening Stock Batches Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
            <span className="font-black text-slate-800">
              دفعات الأرصدة الافتتاحية المعتمدة ({openingBatches.length})
            </span>
          </div>

          {loading ? (
            <div className="py-20 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-500">جارٍ قراءة سجل الأرصدة الافتتاحية...</p>
            </div>
          ) : openingBatches.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-xs">
              لم يتم استيراد أو اعتماد أي رصيد افتتاحي بعد.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">رقم الدفعة</th>
                    <th className="py-3 px-4">اسم الملف</th>
                    <th className="py-3 px-4">المستودع</th>
                    <th className="py-3 px-4 text-center">الصفوف المعتمدة</th>
                    <th className="py-3 px-4">تاريخ ووقت الاعتماد</th>
                    <th className="py-3 px-4">المعتمد بواسطة</th>
                    <th className="py-3 px-4 text-center">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {openingBatches.map((b) => (
                    <tr key={b.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-mono font-bold text-indigo-700">{b.batch_number}</td>
                      <td className="py-3 px-4 font-bold text-slate-900">{b.filename}</td>
                      <td className="py-3 px-4 text-slate-600">{b.location_name || 'المستودع الرئيسي'}</td>
                      <td className="py-3 px-4 text-center font-bold text-emerald-700">
                        {b.imported_rows} صف
                      </td>
                      <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                        {new Date(b.created_at).toLocaleString('ar-EG')}
                      </td>
                      <td className="py-3 px-4 text-slate-700 font-semibold">{b.approved_by_name || b.created_by_name}</td>
                      <td className="py-3 px-4 text-center">
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px] border border-emerald-200">
                          معتمد ومحصن ضد التكرار
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
