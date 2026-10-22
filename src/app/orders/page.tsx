'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import {
  ShoppingCart,
  Search,
  Plus,
  Eye,
  Filter,
  Loader2,
  Clock,
  CheckCircle2,
  PackageCheck,
  Truck,
  XCircle,
  FileText,
} from 'lucide-react';

export default function OrdersListPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: String(page),
        limit: '25',
        search: search.trim(),
        status,
      });

      const res = await fetch(`/api/orders?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
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
    fetchOrders();
  }, [page, status]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchOrders();
  };

  const statusConfig: Record<string, { label: string; badge: string; icon: any }> = {
    draft: { label: 'مسودة', badge: 'bg-slate-100 text-slate-700 border-slate-300', icon: Clock },
    confirmed: { label: 'مؤكد ومحجوز', badge: 'bg-blue-100 text-blue-800 border-blue-200', icon: CheckCircle2 },
    picking: { label: 'قيد التجهيز (Pick)', badge: 'bg-purple-100 text-purple-800 border-purple-200', icon: PackageCheck },
    packed: { label: 'مغلف وجاهز', badge: 'bg-amber-100 text-amber-800 border-amber-200', icon: PackageCheck },
    shipped: { label: 'تم الشحن والتسليم', badge: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: Truck },
    canceled: { label: 'ملغي ومفكوك الحجز', badge: 'bg-rose-100 text-rose-800 border-rose-200', icon: XCircle },
  };

  return (
    <AppShell
      title="قائمة طلبات الجملة المشكل"
      subtitle="إدارة وتتبع أوامر البيع المشكلة للعملاء من الإنشاء والحجز حتى التجهيز والشحن النهائي"
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
                placeholder="بحث برقم الطلب (مثال: ORD-2610...) أو اسم العميل أو الهاتف..."
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 pr-10 text-sm focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
              />
              <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
            </div>

            <div className="w-48">
              <select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-xs text-slate-800 font-bold focus:border-indigo-500"
              >
                <option value="">كافة حالات الطلبات</option>
                <option value="draft">مسودات</option>
                <option value="confirmed">مؤكدة (محجوزة)</option>
                <option value="picking">قيد التجهيز (Picking)</option>
                <option value="packed">مغلفة وجاهزة (Packed)</option>
                <option value="shipped">تم الشحن والتسليم</option>
                <option value="canceled">ملغية</option>
              </select>
            </div>

            <button
              type="submit"
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              بحث
            </button>
          </form>

          <Link
            href="/orders/new"
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>إدخال طلب جملة جديد</span>
          </Link>
        </div>

        {/* Orders Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
            <span className="font-black text-slate-800">
              إجمالي الطلبات: {totalCount.toLocaleString('ar-EG')} طلب
            </span>
            <span className="text-slate-500">صفحة {page} من {totalPages}</span>
          </div>

          {loading ? (
            <div className="py-24 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-500">جارٍ قراءة بيانات الطلبات...</p>
            </div>
          ) : orders.length === 0 ? (
            <div className="py-20 text-center">
              <ShoppingCart className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-slate-700">لا توجد طلبات مسجلة</h3>
              <p className="text-xs text-slate-400 mt-1">
                اضغط زر "إدخال طلب جملة جديد" لبدء تسجيل أول طلب مشكل.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">رقم الطلب</th>
                    <th className="py-3 px-4">العميل / المحل</th>
                    <th className="py-3 px-4">تاريخ الطلب</th>
                    <th className="py-3 px-4 text-center">عدد الأصناف</th>
                    <th className="py-3 px-4 text-center">إجمالي القطع</th>
                    <th className="py-3 px-4 text-center">القيمة الإجمالية</th>
                    <th className="py-3 px-4 text-center">حالة الطلب</th>
                    <th className="py-3 px-4 text-center">معاينة وفاتورة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {orders.map((o) => {
                    const cfg = statusConfig[o.status] || {
                      label: o.status,
                      badge: 'bg-slate-100 text-slate-700',
                      icon: Clock,
                    };
                    const StatusIcon = cfg.icon;

                    return (
                      <tr key={o.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-black text-indigo-700">
                          {o.order_number}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="font-bold text-slate-900 block">{o.customer_name}</span>
                          <span className="text-[11px] text-slate-400 font-mono">{o.customer_phone}</span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-500 font-mono">
                          {new Date(o.order_date).toLocaleDateString('ar-EG')}
                        </td>
                        <td className="py-3.5 px-4 text-center font-bold text-slate-700">
                          {o.item_count} صنف
                        </td>
                        <td className="py-3.5 px-4 text-center font-black text-slate-900">
                          {o.total_pieces} قطعة
                        </td>
                        <td className="py-3.5 px-4 text-center font-black text-sm text-indigo-900">
                          {Number(o.total_amount).toLocaleString('ar-EG')} ج.م
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold border ${cfg.badge}`}
                          >
                            <StatusIcon className="w-3.5 h-3.5" />
                            <span>{cfg.label}</span>
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <Link
                            href={`/orders/${o.id}`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>التفاصيل / الفاتورة</span>
                          </Link>
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
