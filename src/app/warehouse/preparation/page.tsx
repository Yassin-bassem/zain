'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import {
  PackageCheck,
  Search,
  Filter,
  Calendar,
  User,
  AlertCircle,
  Loader2,
  Clock,
  ArrowLeft,
  FileText,
  CheckCircle2,
  QrCode,
  Flame,
} from 'lucide-react';

export default function PreparationQueuePage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search.trim()) params.append('search', search.trim());
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (priorityFilter !== 'all') params.append('priority', priorityFilter);

      const res = await fetch(`/api/preparation/queue?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [statusFilter, priorityFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchOrders();
  };

  const getPrepBadge = (status: string) => {
    switch (status) {
      case 'reviewed':
        return { label: 'تمت المراجعة والباركود', cls: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
      case 'picking':
        return { label: 'جارٍ التجهيز والالتقاط', cls: 'bg-amber-100 text-amber-800 border-amber-300' };
      case 'packed':
        return { label: 'تم التغليف', cls: 'bg-purple-100 text-purple-800 border-purple-300' };
      default:
        return { label: 'بانتظار التجهيز', cls: 'bg-blue-100 text-blue-800 border-blue-300' };
    }
  };

  return (
    <AppShell
      title="تحضير الأوردر (طابور تجهيز المستودع)"
      subtitle="قائمة فواتير الجملة المؤكدة والمحجوزة بالمخزن والمطلوب تجهيزها والتقاطها من الأرفف"
    >
      <div className="space-y-6">
        {/* KPI Stats Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <span className="text-slate-500 text-xs font-bold">طلبات بانتظار التجهيز</span>
            <div className="mt-2 text-2xl font-black text-blue-600">
              {orders.filter((o) => o.preparation_status === 'pending').length}
            </div>
            <div className="mt-1 text-[11px] text-slate-400">محجوزة بالمخزن وجاهزة للالتقاط</div>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <span className="text-slate-500 text-xs font-bold">قيد الالتقاط والمراجعة</span>
            <div className="mt-2 text-2xl font-black text-amber-600">
              {orders.filter((o) => o.preparation_status === 'picking').length}
            </div>
            <div className="mt-1 text-[11px] text-slate-400">جارٍ جمع القطع من الأرفف</div>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <span className="text-slate-500 text-xs font-bold">تمت مراجعة الباركود 100%</span>
            <div className="mt-2 text-2xl font-black text-emerald-600">
              {orders.filter((o) => o.preparation_status === 'reviewed').length}
            </div>
            <div className="mt-1 text-[11px] text-slate-400">جاهزة للتغليف والشحن النهائي</div>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <span className="text-slate-500 text-xs font-bold">إجمالي القطع بالطابور</span>
            <div className="mt-2 text-2xl font-black text-slate-900">
              {orders.reduce((acc, o) => acc + Number(o.total_pieces || 0), 0)}
            </div>
            <div className="mt-1 text-[11px] text-slate-400">قطعة ملابس أطفال محجوزة</div>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
          <form onSubmit={handleSearch} className="flex items-center gap-2 flex-1 max-w-md">
            <div className="relative flex-1">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="بحث برقم الطلب، اسم العميل، أو الهاتف..."
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2 pr-10 text-xs focus:bg-white focus:border-indigo-500"
              />
              <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-2.5" />
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              بحث
            </button>
          </form>

          <div className="flex flex-wrap items-center gap-3">
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-700"
            >
              <option value="all">كافة حالات التجهيز</option>
              <option value="pending">بانتظار التجهيز</option>
              <option value="picking">جارٍ التجهيز والالتقاط</option>
              <option value="reviewed">تمت المراجعة والباركود</option>
              <option value="packed">تم التغليف</option>
            </select>

            {/* Priority Filter */}
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-700"
            >
              <option value="all">كافة الأولويات</option>
              <option value="urgent">عاجل جداً</option>
              <option value="normal">عادي</option>
              <option value="low">منخفض</option>
            </select>
          </div>
        </div>

        {/* Preparation Queue List */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-700 flex items-center justify-between">
            <span>طابور فواتير التجهيز ({orders.length} طلب)</span>
            <span className="text-slate-500 text-[11px]">يتم ترتيب الأولوية العاجلة في المقدمة تلقائياً</span>
          </div>

          {loading ? (
            <div className="py-20 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-500">جارٍ قراءة طابور التجهيز بالمستودع...</p>
            </div>
          ) : orders.length === 0 ? (
            <div className="py-20 text-center text-slate-400 text-xs">
              <PackageCheck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p>طابور التجهيز فارغ حالياً. لا توجد طلبات معلقة تتطلب التجهيز.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">رقم الفاتورة</th>
                    <th className="py-3 px-4">العميل / المحل</th>
                    <th className="py-3 px-4">تاريخ الطلب</th>
                    <th className="py-3 px-4 text-center">القطع المطلوبة</th>
                    <th className="py-3 px-4">أولوية التجهيز</th>
                    <th className="py-3 px-4">حالة التجهيز بالمستودع</th>
                    <th className="py-3 px-4">الموظف المسؤول</th>
                    <th className="py-3 px-4 text-center">الإجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {orders.map((o) => {
                    const badge = getPrepBadge(o.preparation_status);
                    const isUrgent = o.priority === 'urgent';

                    return (
                      <tr key={o.id} className={`hover:bg-slate-50 transition-colors ${isUrgent ? 'bg-amber-50/40' : ''}`}>
                        <td className="py-3.5 px-4 font-mono font-black text-indigo-700">
                          {o.order_number}
                        </td>
                        <td className="py-3.5 px-4">
                          <Link href={`/customers/${o.customer_id}`} className="font-bold text-slate-900 hover:text-indigo-600">
                            {o.customer_name}
                          </Link>
                          <div className="text-[11px] text-slate-500 font-mono dir-ltr">{o.customer_phone}</div>
                        </td>
                        <td className="py-3.5 px-4 text-slate-700">
                          {new Date(o.order_date).toLocaleDateString('ar-EG')}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className="font-mono font-black text-slate-900 bg-slate-100 px-2.5 py-1 rounded-lg">
                            {o.total_pieces} قطعة
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          {isUrgent ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-300 font-bold text-[10px]">
                              <Flame className="w-3 h-3 text-rose-600" />
                              <span>عاجل جداً</span>
                            </span>
                          ) : (
                            <span className="text-slate-500 font-medium text-[11px]">عادي</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`inline-block px-2.5 py-1 rounded-full border font-bold text-[10px] ${badge.cls}`}>
                            {badge.label}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-600">
                          {o.assigned_employee_name || 'غير محدد'}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <Link
                            href={`/warehouse/preparation/${o.id}`}
                            className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>فتح الفاتورة</span>
                          </Link>
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
