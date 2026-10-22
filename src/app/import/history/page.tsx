'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import { FolderArchive, FileSpreadsheet, Loader2, ArrowRight } from 'lucide-react';

export default function ImportHistoryPage() {
  const [batches, setBatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBatches = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/import/history');
      if (res.ok) {
        const data = await res.json();
        setBatches(data.batches || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBatches();
  }, []);

  const modeLabels: Record<string, { label: string; color: string }> = {
    products_variants: { label: 'موديلات ومتغيرات', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
    opening_stock: { label: 'رصيد افتتاحي معتمد', color: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
    stock_adjustment: { label: 'تسوية مخزنية مجمعة', color: 'bg-amber-50 text-amber-800 border-amber-200' },
  };

  return (
    <AppShell
      title="سجل ملفات ودفعات الاستيراد (Import History)"
      subtitle="أرشيف كامل لكافة ملفات الإكسيل المستوردة مع تفاصيل عدد الصفوف وتاريخ التنفيذ والمستخدم"
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Link
            href="/import"
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>معالج استيراد جديد</span>
          </Link>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          {loading ? (
            <div className="py-20 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-500">جارٍ قراءة سجل الاستيراد...</p>
            </div>
          ) : batches.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-xs">
              <FolderArchive className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <span>لا توجد عمليات استيراد مسجلة حتى الآن.</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">رقم الدفعة</th>
                    <th className="py-3 px-4">اسم الملف</th>
                    <th className="py-3 px-4">وضع الاستيراد</th>
                    <th className="py-3 px-4 text-center">إجمالي الصفوف</th>
                    <th className="py-3 px-4 text-center">الصفوف المحفوظة</th>
                    <th className="py-3 px-4">المستخدم</th>
                    <th className="py-3 px-4">تاريخ الاستيراد</th>
                    <th className="py-3 px-4 text-center">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {batches.map((b) => {
                    const badge = modeLabels[b.mode] || { label: b.mode, color: 'bg-slate-100 text-slate-700' };
                    return (
                      <tr key={b.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4 font-mono font-bold text-indigo-700">{b.batch_number}</td>
                        <td className="py-3 px-4 font-bold text-slate-900">{b.filename}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2.5 py-0.5 rounded-md font-bold text-[10px] border ${badge.color}`}>
                            {badge.label}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center text-slate-600 font-bold">{b.total_rows}</td>
                        <td className="py-3 px-4 text-center font-bold text-emerald-700">{b.imported_rows}</td>
                        <td className="py-3 px-4 text-slate-700 font-semibold">{b.created_by_name || 'مدير'}</td>
                        <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                          {new Date(b.created_at).toLocaleString('ar-EG')}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                            مكتمل بنجاح
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
