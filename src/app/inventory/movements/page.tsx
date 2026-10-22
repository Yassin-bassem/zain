'use client';

import React, { useState, useEffect } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { History, Search, Filter, Loader2, ArrowUpRight, ArrowDownLeft, FileText } from 'lucide-react';

export default function StockMovementsPage() {
  const [movements, setMovements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const fetchMovements = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: String(page),
        limit: '50',
        search: search.trim(),
        type,
      });

      const res = await fetch(`/api/inventory/movements?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setMovements(data.movements || []);
        setTotalPages(data.totalPages || 1);
        setTotalCount(data.total || 0);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMovements();
  }, [page, type]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchMovements();
  };

  const movementLabels: Record<string, { label: string; badge: string }> = {
    RECEIPT: { label: 'توريد بضاعة', badge: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
    OPENING_BALANCE: { label: 'رصيد افتتاحي', badge: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
    SHIPMENT: { label: 'شحن طلب مبيعات', badge: 'bg-rose-100 text-rose-800 border-rose-200' },
    RETURN_SELLABLE: { label: 'مرتجع سليم للبيع', badge: 'bg-teal-100 text-teal-800 border-teal-200' },
    ADJUSTMENT: { label: 'تسوية مخزنية', badge: 'bg-amber-100 text-amber-800 border-amber-200' },
    TRANSFER: { label: 'نقل مخزني', badge: 'bg-purple-100 text-purple-800 border-purple-200' },
  };

  return (
    <AppShell
      title="سجل حركات المخزن غير القابل للتعديل (Stock Ledger)"
      subtitle="سجل تدقيق كامل يوثق كل إضافة أو خصم أو تسوية مع رقم المرجع والسبب والمستخدم المسؤول"
    >
      <div className="space-y-6">
        {/* Filter Bar */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
          <form onSubmit={handleSearchSubmit} className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
            <div className="relative flex-1 min-w-[220px]">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="بحث برقم المرجع، كود الموديل، الباركود، أو السبب..."
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 pr-10 text-sm focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
              />
              <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
            </div>

            <div className="w-52">
              <select
                value={type}
                onChange={(e) => {
                  setType(e.target.value);
                  setPage(1);
                }}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-xs text-slate-800 font-bold focus:border-indigo-500"
              >
                <option value="">كافة أنواع الحركات</option>
                <option value="RECEIPT">توريد بضاعة (إذن استلام)</option>
                <option value="OPENING_BALANCE">رصيد افتتاحي معتمد</option>
                <option value="SHIPMENT">شحن طلب مبيعات</option>
                <option value="RETURN_SELLABLE">مرتجع مبيعات سليم</option>
                <option value="ADJUSTMENT">تسوية جرد مخزني</option>
              </select>
            </div>

            <button
              type="submit"
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              بحث
            </button>
          </form>

          <span className="text-xs text-slate-500 font-bold">
            إجمالي الحركات: {totalCount.toLocaleString('ar-EG')} حركة
          </span>
        </div>

        {/* Ledger Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          {loading ? (
            <div className="py-24 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-500">جارٍ قراءة سجل الحركات...</p>
            </div>
          ) : movements.length === 0 ? (
            <div className="py-20 text-center">
              <History className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-slate-700">لا توجد حركات مسجلة</h3>
              <p className="text-xs text-slate-400 mt-1">
                أي حركة استلام أو شحن أو تسوية ستظهر هنا تلقائياً دون إمكانية للحذف.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">التاريخ والوقت</th>
                    <th className="py-3 px-4">نوع الحركة</th>
                    <th className="py-3 px-4">الصنف والموديل</th>
                    <th className="py-3 px-4">اللون والمقاس</th>
                    <th className="py-3 px-4 text-center">فارق الكمية</th>
                    <th className="py-3 px-4">رقم المرجع والمستند</th>
                    <th className="py-3 px-4">السبب / البيان</th>
                    <th className="py-3 px-4">المستخدم</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {movements.map((m) => {
                    const isPositive = Number(m.quantity_delta) > 0;
                    const badge = movementLabels[m.movement_type] || {
                      label: m.movement_type,
                      badge: 'bg-slate-100 text-slate-700 border-slate-200',
                    };

                    return (
                      <tr key={m.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                          {new Date(m.created_at).toLocaleString('ar-EG', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2.5 py-1 rounded-md font-bold text-[10px] border ${badge.badge}`}
                          >
                            {badge.label}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-mono font-bold text-indigo-700 ml-1">{m.model_code}</span>
                          <span className="font-bold text-slate-900">{m.model_name}</span>
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-700">
                          {m.color_name} • {m.size_name}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`font-black text-sm px-2.5 py-0.5 rounded-lg inline-block ${
                              isPositive
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}
                          >
                            {isPositive ? `+${m.quantity_delta}` : m.quantity_delta}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-slate-800">
                          {m.reference_id || '—'}
                        </td>
                        <td className="py-3 px-4 text-slate-600 max-w-xs truncate" title={m.reason}>
                          {m.reason}
                        </td>
                        <td className="py-3 px-4 text-slate-700 font-semibold">
                          {m.created_by_name || 'النظام'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-4 py-2 rounded-xl bg-white border border-slate-300 font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
              >
                السابق
              </button>
              <span className="font-bold text-slate-600">
                صفحة {page} من {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-4 py-2 rounded-xl bg-white border border-slate-300 font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
              >
                التالي
              </button>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
