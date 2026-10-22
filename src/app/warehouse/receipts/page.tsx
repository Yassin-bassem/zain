'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import {
  PackagePlus,
  Plus,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Calendar,
  Building2,
} from 'lucide-react';

export default function ReceiptsListPage() {
  const [receipts, setReceipts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const fetchReceipts = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/receiving');
      if (res.ok) {
        const data = await res.json();
        setReceipts(data.receipts || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReceipts();
  }, []);

  const handleConfirmReceipt = async (receiptId: number, receiptNumber: string) => {
    if (!confirm(`هل أنت متأكد من اعتماد إذن استلام التوريد (${receiptNumber})؟\nسيتم إضافة القطع للرصيد الفعلي في المستودع فوراً وتسجيل حركة توريد معتمدة.`)) {
      return;
    }

    setConfirmingId(receiptId);
    setMessage(null);

    try {
      const res = await fetch(`/api/receiving/${receiptId}/confirm`, {
        method: 'POST',
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل اعتماد إذن الاستلام');

      setMessage({
        text: `تم بنجاح اعتماد إذن الاستلام (${receiptNumber}) وإضافة القطع للمخزون الفعلي.`,
        type: 'success',
      });

      fetchReceipts();
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setConfirmingId(null);
    }
  };

  return (
    <AppShell
      title="أذونات استلام البضاعة من المصانع والموردين"
      subtitle="إثبات التوريدات الواردة وإضافتها آلياً للرصيد الفعلي في المستودع الرئيسي"
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-500">
            إجمالي الأذونات: {receipts.length} إذن توريد
          </span>

          <Link
            href="/warehouse/receipts/new"
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>تسجيل إذن استلام توريد جديد</span>
          </Link>
        </div>

        {message && (
          <div
            className={`p-4 rounded-xl text-xs font-bold flex items-center gap-2.5 ${
              message.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}
          >
            {message.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            )}
            <span>{message.text}</span>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          {loading ? (
            <div className="py-20 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-500">جارٍ قراءة أذونات التوريد...</p>
            </div>
          ) : receipts.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-xs">
              <PackagePlus className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p>لا توجد أذونات استلام بضاعة مسجلة حتى الآن.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">رقم إذن الاستلام</th>
                    <th className="py-3 px-4">المورد / المصنع</th>
                    <th className="py-3 px-4">رقم فاتورة المورد</th>
                    <th className="py-3 px-4">تاريخ الاستلام</th>
                    <th className="py-3 px-4 text-center">إجمالي القطع الواردة</th>
                    <th className="py-3 px-4">المسؤول</th>
                    <th className="py-3 px-4 text-center">الحالة</th>
                    <th className="py-3 px-4 text-center">الإجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {receipts.map((r) => {
                    const isConfirmed = r.status === 'confirmed';
                    return (
                      <tr key={r.id} className="hover:bg-slate-50">
                        <td className="py-3.5 px-4 font-mono font-black text-indigo-700">
                          {r.receipt_number}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-slate-900">{r.supplier_name}</td>
                        <td className="py-3.5 px-4 font-mono text-slate-600">{r.supplier_invoice_ref || '—'}</td>
                        <td className="py-3.5 px-4 text-slate-500 font-mono">
                          {new Date(r.receipt_date).toLocaleDateString('ar-EG')}
                        </td>
                        <td className="py-3.5 px-4 text-center font-black text-sm text-slate-900">
                          {r.total_pieces?.toLocaleString('ar-EG')} قطعة
                        </td>
                        <td className="py-3.5 px-4 text-slate-600">{r.confirmed_by_name || r.created_by_name}</td>
                        <td className="py-3.5 px-4 text-center">
                          <span
                            className={`px-2.5 py-1 rounded-md text-[10px] font-bold border ${
                              isConfirmed
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                : 'bg-amber-100 text-amber-800 border-amber-200'
                            }`}
                          >
                            {isConfirmed ? 'معتمد ومضاف للمخزن' : 'مسودة بانتظار الاعتماد'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          {!isConfirmed ? (
                            <button
                              onClick={() => handleConfirmReceipt(r.id, r.receipt_number)}
                              disabled={confirmingId === r.id}
                              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                            >
                              {confirmingId === r.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <span>اعتماد وإدخال المخزن</span>
                              )}
                            </button>
                          ) : (
                            <span className="text-emerald-700 font-bold text-[11px] flex items-center justify-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>مكتمل</span>
                            </span>
                          )}
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
