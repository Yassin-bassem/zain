'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import {
  Users,
  Phone,
  MapPin,
  Calendar,
  Package,
  Truck,
  CheckCircle2,
  Clock,
  ArrowRight,
  ShoppingCart,
  AlertTriangle,
  RotateCcw,
  Check,
  Search,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  FileText,
  Edit2,
  Loader2,
} from 'lucide-react';

function CustomerProfileContent() {
  const router = useRouter();
  const params = useParams();
  const customerId = params.id as string;

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedOrderId, setExpandedOrderId] = useState<number | null>(null);

  // Delivery confirmation modal
  const [deliveringOrder, setDeliveringOrder] = useState<any>(null);
  const [recipientName, setRecipientName] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [deliverySubmitting, setDeliverySubmitting] = useState(false);

  // Edit profile modal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAlternatePhone, setEditAlternatePhone] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);

  const fetchCustomer = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/customers/${customerId}`);
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'تعذر تحميل بيانات العميل');
      }
      const json = await res.json();
      setData(json);
      setEditName(json.customer.name);
      setEditPhone(json.customer.phone);
      setEditAlternatePhone(json.customer.alternate_phone || '');
      setEditAddress(json.customer.address || '');
      setEditNotes(json.customer.notes || '');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomer();
  }, [customerId]);

  const handleConfirmDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deliveringOrder) return;
    try {
      setDeliverySubmitting(true);
      const res = await fetch(`/api/orders/${deliveringOrder.id}/deliver`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient_name: recipientName,
          delivery_notes: deliveryNotes,
        }),
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || 'فشل تأكيد التسليم');

      setDeliveringOrder(null);
      setRecipientName('');
      setDeliveryNotes('');
      fetchCustomer();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setDeliverySubmitting(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setEditSubmitting(true);
      const res = await fetch(`/api/customers/${customerId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName,
          phone: editPhone,
          alternate_phone: editAlternatePhone,
          address: editAddress,
          notes: editNotes,
        }),
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || 'فشل تحديث البيانات');

      setIsEditModalOpen(false);
      fetchCustomer();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setEditSubmitting(false);
    }
  };

  if (loading) {
    return (
      <AppShell title="الملف التعريفي للعميل" subtitle="جارٍ التحميل...">
        <div className="py-24 text-center">
          <Loader2 className="w-10 h-10 animate-spin text-indigo-600 mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-600">جارٍ قراءة سجل العميل ومطابقة الشحنات...</p>
        </div>
      </AppShell>
    );
  }

  if (error || !data) {
    return (
      <AppShell title="خطأ في تحميل العميل" subtitle="تعذر جلب البيانات">
        <div className="p-8 max-w-xl mx-auto bg-white rounded-2xl border border-rose-200 text-center space-y-4">
          <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto" />
          <h2 className="text-base font-black text-slate-900">{error || 'العميل غير موجود'}</h2>
          <Link
            href="/customers"
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-bold"
          >
            <ArrowRight className="w-4 h-4" />
            <span>العودة لقائمة العملاء</span>
          </Link>
        </div>
      </AppShell>
    );
  }

  const { customer, orders, timeline, returns } = data;

  const filteredOrders = orders.filter((o: any) => {
    const matchesSearch =
      o.order_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (o.notes && o.notes.toLowerCase().includes(searchQuery.toLowerCase()));
    if (!matchesSearch) return false;

    if (statusFilter === 'all') return true;
    if (statusFilter === 'delivered') return !!o.delivered_at;
    if (statusFilter === 'shipped_pending_delivery') return o.status === 'shipped' && !o.delivered_at;
    return o.status === statusFilter;
  });

  return (
    <AppShell
      title={`الملف الشخصي: ${customer.name}`}
      subtitle={`كود العميل: ${customer.customer_code} • تفاصيل الطلبات وسجل الشحن والتسليم الكامل`}
    >
      <div className="space-y-6">
        {/* Top Header Navigation */}
        <div className="flex items-center justify-between">
          <Link
            href="/customers"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors"
          >
            <ArrowRight className="w-4 h-4" />
            <span>العودة لدليل العملاء</span>
          </Link>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsEditModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold shadow-xs cursor-pointer"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>تعديل البيانات</span>
            </button>
            <Link
              href={`/orders/new?customer_id=${customer.id}`}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs"
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              <span>إنشاء طلب جديد للعميل</span>
            </Link>
          </div>
        </div>

        {/* Customer Information & Summary Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Main Info Card */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <span className="inline-block px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-mono text-xs font-black mb-1">
                  {customer.customer_code}
                </span>
                <h2 className="text-lg font-black text-slate-900">{customer.name}</h2>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-100 text-slate-600">
                <Users className="w-5 h-5" />
              </div>
            </div>

            <div className="space-y-2.5 text-xs text-slate-600 pt-2 border-t border-slate-100">
              <div className="flex items-center gap-2.5">
                <Phone className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="font-mono font-bold text-slate-800 dir-ltr">{customer.phone}</span>
                {customer.alternate_phone && (
                  <span className="font-mono text-slate-500 dir-ltr text-[11px]">
                    / {customer.alternate_phone}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2.5">
                <MapPin className="w-4 h-4 text-rose-500 shrink-0" />
                <span>{customer.address || 'العنوان غير مسجل'}</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Calendar className="w-4 h-4 text-indigo-500 shrink-0" />
                <span>
                  تاريخ التسجيل:{' '}
                  {new Date(customer.created_at).toLocaleDateString('ar-EG', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </span>
              </div>
              {customer.notes && (
                <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200/60 text-amber-900 text-[11px] leading-relaxed">
                  <span className="font-bold">ملاحظات: </span>
                  {customer.notes}
                </div>
              )}
            </div>
          </div>

          {/* Aggregate Order Metrics */}
          <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
              <span className="text-slate-500 text-xs font-bold">إجمالي الطلبات</span>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-2xl font-black text-slate-900">{customer.total_orders}</span>
                <span className="text-xs text-slate-500">طلب</span>
              </div>
              <div className="mt-3 text-[11px] text-slate-400">سجل طلبات الجملة</div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
              <span className="text-slate-500 text-xs font-bold">إجمالي القطع المطلوبة</span>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-2xl font-black text-indigo-600">
                  {customer.total_pieces_ordered}
                </span>
                <span className="text-xs text-slate-500">قطعة</span>
              </div>
              <div className="mt-3 text-[11px] text-slate-400">كافة الأصناف المحجوزة</div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
              <span className="text-slate-500 text-xs font-bold">إجمالي القطع المشحونة</span>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-2xl font-black text-emerald-600">
                  {customer.total_pieces_shipped}
                </span>
                <span className="text-xs text-slate-500">قطعة</span>
              </div>
              <div className="mt-3 text-[11px] text-emerald-700 font-bold">
                {customer.total_pieces_ordered > 0
                  ? `${Math.round((customer.total_pieces_shipped / customer.total_pieces_ordered) * 100)}% تم شحنها`
                  : '0%'}
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
              <span className="text-slate-500 text-xs font-bold">المتبقي للشحن والتسليم</span>
              <div className="mt-2 flex items-baseline gap-1">
                <span
                  className={`text-2xl font-black ${
                    customer.total_pieces_remaining > 0 ? 'text-amber-600' : 'text-slate-400'
                  }`}
                >
                  {customer.total_pieces_remaining}
                </span>
                <span className="text-xs text-slate-500">قطعة</span>
              </div>
              <div className="mt-3 text-[11px] text-slate-400">
                {customer.total_pieces_remaining === 0 ? 'كافة الطلبات مستوفاة' : 'قيد التجهيز والشحن'}
              </div>
            </div>
          </div>
        </div>

        {/* Orders History Section */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          {/* Filters Bar */}
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-600" />
              <h3 className="font-black text-slate-900 text-sm">سجل فواتير وطلبات العميل</h3>
              <span className="text-xs text-slate-500 font-bold mr-1">({orders.length} طلب)</span>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Search */}
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="بحث برقم الطلب..."
                  className="bg-white border border-slate-300 rounded-xl px-3 py-1.5 pr-8 text-xs focus:border-indigo-500"
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5" />
              </div>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700"
              >
                <option value="all">كافة الحالات</option>
                <option value="draft">مسودة</option>
                <option value="confirmed">مؤكد ومحجوز</option>
                <option value="picking">قيد التجهيز والالتقاط</option>
                <option value="packed">تم التغليف</option>
                <option value="shipped">تم الشحن (عام)</option>
                <option value="shipped_pending_delivery">مشحون (بانتظار تأكيد الاستلام)</option>
                <option value="delivered">تم التسليم النهائي للعميل</option>
                <option value="canceled">ملغي</option>
              </select>
            </div>
          </div>

          {/* Orders Table */}
          {filteredOrders.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-xs">
              <Package className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p>لا توجد فواتير مطابقة للبحث أو التصفية.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">رقم الطلب</th>
                    <th className="py-3 px-4">تاريخ الفاتورة</th>
                    <th className="py-3 px-4">حالة الطلب والتجهيز</th>
                    <th className="py-3 px-4 text-center">القطع المطلوبة</th>
                    <th className="py-3 px-4 text-center">القطع المشحونة</th>
                    <th className="py-3 px-4 text-center">المتبقي للشحن</th>
                    <th className="py-3 px-4">إجمالي القيمة</th>
                    <th className="py-3 px-4">تأكيد التسليم</th>
                    <th className="py-3 px-4 text-center">التفاصيل</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredOrders.map((order: any) => {
                    const isExpanded = expandedOrderId === order.id;
                    const isDelivered = !!order.delivered_at;
                    const isShipped = order.status === 'shipped';

                    return (
                      <React.Fragment key={order.id}>
                        <tr className={`hover:bg-slate-50 transition-colors ${isExpanded ? 'bg-indigo-50/30' : ''}`}>
                          <td className="py-3 px-4 font-mono font-black text-indigo-700">
                            <Link href={`/orders/${order.id}`} className="hover:underline flex items-center gap-1">
                              <span>{order.order_number}</span>
                              <ExternalLink className="w-3 h-3 text-slate-400" />
                            </Link>
                          </td>
                          <td className="py-3 px-4 text-slate-700 font-medium">
                            {new Date(order.order_date).toLocaleDateString('ar-EG')}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex flex-col gap-1">
                              {order.status === 'draft' && (
                                <span className="inline-block px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold text-[10px] w-fit">
                                  مسودة
                                </span>
                              )}
                              {order.status === 'confirmed' && (
                                <span className="inline-block px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-bold text-[10px] w-fit">
                                  مؤكد ومحجوز بالمخزن
                                </span>
                              )}
                              {order.status === 'picking' && (
                                <span className="inline-block px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold text-[10px] w-fit">
                                  قيد التجهيز والالتقاط
                                </span>
                              )}
                              {order.status === 'packed' && (
                                <span className="inline-block px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 font-bold text-[10px] w-fit">
                                  تم التغليف
                                </span>
                              )}
                              {order.status === 'shipped' && (
                                <span className="inline-block px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px] w-fit">
                                  تم الشحن
                                </span>
                              )}
                              {order.status === 'canceled' && (
                                <span className="inline-block px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold text-[10px] w-fit">
                                  ملغي
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center font-bold font-mono text-slate-900">
                            {order.total_pieces}
                          </td>
                          <td className="py-3 px-4 text-center font-bold font-mono text-emerald-700">
                            {order.pieces_shipped}
                          </td>
                          <td className="py-3 px-4 text-center font-bold font-mono">
                            {order.pieces_remaining > 0 ? (
                              <span className="text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md">
                                {order.pieces_remaining}
                              </span>
                            ) : (
                              <span className="text-slate-400">0</span>
                            )}
                          </td>
                          <td className="py-3 px-4 font-black font-mono text-slate-900">
                            {Number(order.total_amount).toLocaleString('ar-EG')} ج.م
                          </td>
                          <td className="py-3 px-4">
                            {isDelivered ? (
                              <div className="flex items-center gap-1.5 text-emerald-700 font-bold text-[11px]">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                <div>
                                  <span>تم التسليم</span>
                                  {order.delivery_recipient_name && (
                                    <div className="text-[10px] text-slate-500 font-normal">
                                      المستلم: {order.delivery_recipient_name}
                                    </div>
                                  )}
                                </div>
                              </div>
                            ) : isShipped ? (
                              <button
                                onClick={() => {
                                  setDeliveringOrder(order);
                                  setRecipientName(customer.name);
                                }}
                                className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-[10px] font-bold shadow-2xs transition-colors cursor-pointer"
                              >
                                تأكيد استلام العميل
                              </button>
                            ) : (
                              <span className="text-slate-400 text-[11px]">—</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                              className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
                              title="عرض بنود الفاتورة ومطابقة الأرفف"
                            >
                              {isExpanded ? (
                                <ChevronUp className="w-4 h-4 text-indigo-600" />
                              ) : (
                                <ChevronDown className="w-4 h-4" />
                              )}
                            </button>
                          </td>
                        </tr>

                        {/* Order Lines Fulfillment Breakdown (Expanded View) */}
                        {isExpanded && (
                          <tr className="bg-slate-50/80 border-b border-indigo-100">
                            <td colSpan={9} className="p-4">
                              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-3">
                                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                                  <div className="font-bold text-slate-800 text-xs flex items-center gap-2">
                                    <Package className="w-4 h-4 text-indigo-600" />
                                    <span>بنود ومطابقة الشحن للطلب: {order.order_number}</span>
                                  </div>
                                  <Link
                                    href={`/orders/${order.id}`}
                                    className="text-[11px] font-bold text-indigo-600 hover:underline flex items-center gap-1"
                                  >
                                    <span>فتح شاشة الفاتورة الكاملة</span>
                                    <ExternalLink className="w-3 h-3" />
                                  </Link>
                                </div>

                                <div className="overflow-x-auto">
                                  <table className="w-full text-right text-[11px]">
                                    <thead className="bg-slate-100 text-slate-700 font-bold">
                                      <tr>
                                        <th className="py-2 px-3">الموديل والصنف</th>
                                        <th className="py-2 px-3">اللون</th>
                                        <th className="py-2 px-3">المقاس</th>
                                        <th className="py-2 px-3">الرف التخزيني</th>
                                        <th className="py-2 px-3 text-center">المطلوب</th>
                                        <th className="py-2 px-3 text-center">المحجوز</th>
                                        <th className="py-2 px-3 text-center">الملتقط</th>
                                        <th className="py-2 px-3 text-center">المفحوص</th>
                                        <th className="py-2 px-3 text-center">المغلّف</th>
                                        <th className="py-2 px-3 text-center">المشحون</th>
                                        <th className="py-2 px-3 text-center">المتبقي</th>
                                        <th className="py-2 px-3">السعر</th>
                                        <th className="py-2 px-3">الإجمالي</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                      {order.items.map((item: any) => (
                                        <tr key={item.id} className="hover:bg-slate-50">
                                          <td className="py-2 px-3 font-bold text-slate-900">
                                            {item.model_code} - {item.model_name}
                                          </td>
                                          <td className="py-2 px-3 font-bold text-slate-700">{item.color_name}</td>
                                          <td className="py-2 px-3 text-slate-800">{item.size_name}</td>
                                          <td className="py-2 px-3">
                                            {item.shelf_code ? (
                                              <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded text-[10px]">
                                                {item.shelf_code}
                                              </span>
                                            ) : (
                                              <span className="text-slate-400">غير محدد</span>
                                            )}
                                          </td>
                                          <td className="py-2 px-3 text-center font-bold font-mono">
                                            {item.quantity_ordered}
                                          </td>
                                          <td className="py-2 px-3 text-center font-bold font-mono text-blue-700">
                                            {item.quantity_reserved}
                                          </td>
                                          <td className="py-2 px-3 text-center font-bold font-mono text-amber-700">
                                            {item.quantity_picked}
                                          </td>
                                          <td className="py-2 px-3 text-center font-bold font-mono text-cyan-700">
                                            {item.quantity_checked}
                                          </td>
                                          <td className="py-2 px-3 text-center font-bold font-mono text-purple-700">
                                            {item.quantity_packed}
                                          </td>
                                          <td className="py-2 px-3 text-center font-bold font-mono text-emerald-700">
                                            {item.quantity_shipped}
                                          </td>
                                          <td className="py-2 px-3 text-center font-bold font-mono">
                                            {item.quantity_remaining > 0 ? (
                                              <span className="text-amber-700 font-black">
                                                {item.quantity_remaining}
                                              </span>
                                            ) : (
                                              <span className="text-emerald-600 font-bold">مكتمل</span>
                                            )}
                                          </td>
                                          <td className="py-2 px-3 font-mono">{item.unit_price} ج.م</td>
                                          <td className="py-2 px-3 font-bold font-mono text-slate-900">
                                            {item.line_total} ج.م
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Customer Lifecycle Timeline & Returns */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Timeline */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <Clock className="w-5 h-5 text-indigo-600" />
              <h3 className="font-black text-slate-900 text-sm">شريط الأحداث وعمليات العميل</h3>
            </div>

            {timeline.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                لا توجد أحداث سابقة مسجلة في شريط المتابعة.
              </div>
            ) : (
              <div className="space-y-4 relative before:absolute before:inset-0 before:right-3 before:w-0.5 before:bg-slate-200 before:z-0">
                {timeline.map((event: any) => (
                  <div key={event.id} className="relative flex items-start gap-3 z-10">
                    <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                      <Check className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-bold text-slate-900">{event.title}</span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {new Date(event.created_at).toLocaleString('ar-EG')}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-600 flex items-center gap-2">
                        <span>الطلب: #{event.order_number}</span>
                        {event.user_name && <span>• الموظف: {event.user_name}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Returns History */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <RotateCcw className="w-5 h-5 text-rose-600" />
              <h3 className="font-black text-slate-900 text-sm">سجل المرتجعات للعميل</h3>
              <span className="text-xs text-slate-400 font-bold">({returns.length} مرتجع)</span>
            </div>

            {returns.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                لا توجد مرتجعات مسجلة لهذا العميل.
              </div>
            ) : (
              <div className="space-y-3">
                {returns.map((ret: any) => (
                  <div key={ret.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-rose-700">{ret.return_number}</span>
                      <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-800 text-[10px] font-bold">
                        {ret.status}
                      </span>
                    </div>
                    <p className="text-slate-700 font-medium">{ret.reason}</p>
                    <div className="text-[10px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-100">
                      <span>مرتبط بالطلب: #{ret.order_number || 'بدون طلب'}</span>
                      <span>{new Date(ret.created_at).toLocaleDateString('ar-EG')}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Confirm Delivery Modal */}
      {deliveringOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <h3 className="font-black text-slate-900 text-base">تأكيد استلام العميل للشحنة</h3>
              </div>
              <button onClick={() => setDeliveringOrder(null)} className="text-slate-400 hover:text-slate-600 font-bold">
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              يرجى تسجيل بيانات استلام طلب المبيعات رقم{' '}
              <span className="font-mono font-bold text-indigo-700">{deliveringOrder.order_number}</span> للعميل:{' '}
              <span className="font-bold text-slate-900">{customer.name}</span>.
            </p>

            <form onSubmit={handleConfirmDelivery} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">اسم الشخص المستلم للشحنة</label>
                <input
                  type="text"
                  required
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder="اسم المستلم أو التاجر"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:bg-white focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">ملاحظات التسليم أو رقم إيصال شركة الشحن</label>
                <textarea
                  rows={2}
                  value={deliveryNotes}
                  onChange={(e) => setDeliveryNotes(e.target.value)}
                  placeholder="تم التسليم بمقر المحل بدون ملاحظات..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:bg-white focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setDeliveringOrder(null)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={deliverySubmitting}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {deliverySubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>اعتماد التسليم</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Customer Profile Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-black text-slate-900 text-base">تعديل بيانات العميل</h3>
              <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold">
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateProfile} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">اسم العميل / المحل *</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:bg-white focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">الهاتف الأساسي *</label>
                <input
                  type="text"
                  required
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:bg-white focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">هاتف إضافي</label>
                <input
                  type="text"
                  value={editAlternatePhone}
                  onChange={(e) => setEditAlternatePhone(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:bg-white focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">العنوان أو المحافظة</label>
                <input
                  type="text"
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:bg-white focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">ملاحظات</label>
                <textarea
                  rows={2}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:bg-white focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={editSubmitting}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {editSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>حفظ التعديلات</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}

export default function CustomerProfilePage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-slate-50 font-sans text-slate-500" dir="rtl">
          جاري تحميل ملف العميل وسجل الطلبات...
        </div>
      }
    >
      <CustomerProfileContent />
    </Suspense>
  );
}

