'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import {
  Printer,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Clock,
  PackageCheck,
  Truck,
  XCircle,
  Loader2,
  FileText,
  Warehouse,
  User,
  Phone,
  MapPin,
  Calendar,
} from 'lucide-react';

function OrderDetailContent() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.id as string;

  const [order, setOrder] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchOrder = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/orders/${orderId}`);
      if (res.ok) {
        const data = await res.json();
        setOrder(data.order);
        setItems(data.items || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (orderId) fetchOrder();
  }, [orderId]);

  const handleAction = async (action: 'confirm' | 'cancel' | 'pick' | 'pack' | 'ship') => {
    const actionLabels: Record<string, string> = {
      confirm: 'تأكيد وحجز المخزون آلياً',
      cancel: 'إلغاء الطلب وفك الحجز',
      pick: 'بدء التجهيز والالتقاط',
      pack: 'اعتماد التغليف',
      ship: 'الشحن وخصم المخزون الفعلي نهائياً',
    };

    if (!confirm(`هل أنت متأكد من تنفيذ إجراء (${actionLabels[action]})؟`)) {
      return;
    }

    setActionLoading(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch(`/api/orders/${orderId}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل تنفيذ الإجراء');

      setSuccess(`تم بنجاح تنفيذ: ${actionLabels[action]}`);
      fetchOrder();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const statusConfig: Record<string, { label: string; badge: string; icon: any }> = {
    draft: { label: 'مسودة تنتظر التأكيد', badge: 'bg-slate-100 text-slate-800 border-slate-300', icon: Clock },
    confirmed: { label: 'مؤكد والمخزون محجوز', badge: 'bg-blue-100 text-blue-800 border-blue-200', icon: CheckCircle2 },
    picking: { label: 'قيد التجهيز في المستودع', badge: 'bg-purple-100 text-purple-800 border-purple-200', icon: PackageCheck },
    packed: { label: 'مغلف وجاهز للشحن', badge: 'bg-amber-100 text-amber-800 border-amber-200', icon: PackageCheck },
    shipped: { label: 'تم الشحن والتسليم وخصم المخزون', badge: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: Truck },
    canceled: { label: 'طلب ملغي (تم تحرير الحجز)', badge: 'bg-rose-100 text-rose-800 border-rose-200', icon: XCircle },
  };

  const currentStatus = order ? statusConfig[order.status] || { label: order.status, badge: '', icon: Clock } : null;
  const StatusIcon = currentStatus?.icon || Clock;

  return (
    <AppShell
      title={`طلب مبيعات: ${order?.order_number || '...'}`}
      subtitle="معاينة تفاصيل الطلب المشكل، التحكم في مسار الشحن، وطباعة فاتورة البيع"
    >
      <div className="space-y-6">
        {/* Navigation & Action Controls (Hidden on Print) */}
        <div className="no-print flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/orders"
            className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors"
          >
            <ArrowRight className="w-4 h-4" />
            <span>العودة لقائمة الطلبات</span>
          </Link>

          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold shadow-sm transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة فاتورة الجملة (Ctrl+P)</span>
            </button>

            {/* Workflow Action Buttons Based on Status */}
            {order && (
              <>
                {order.status === 'draft' && (
                  <button
                    onClick={() => handleAction('confirm')}
                    disabled={actionLoading}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>تأكيد وحجز المخزون</span>
                  </button>
                )}

                {order.status === 'confirmed' && (
                  <button
                    onClick={() => handleAction('pick')}
                    disabled={actionLoading}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <PackageCheck className="w-4 h-4" />
                    <span>بدء تجهيز الطلب في المستودع</span>
                  </button>
                )}

                {order.status === 'picking' && (
                  <button
                    onClick={() => handleAction('pack')}
                    disabled={actionLoading}
                    className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <PackageCheck className="w-4 h-4" />
                    <span>تأكيد التعبئة والتغليف</span>
                  </button>
                )}

                {order.status === 'packed' && (
                  <button
                    onClick={() => handleAction('ship')}
                    disabled={actionLoading}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Truck className="w-4 h-4" />
                    <span>تأكيد الشحن والتسليم النهائي (خصم المخزون)</span>
                  </button>
                )}

                {['draft', 'confirmed', 'picking', 'packed'].includes(order.status) && (
                  <button
                    onClick={() => handleAction('cancel')}
                    disabled={actionLoading}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-bold border border-rose-200 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>إلغاء الطلب</span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Feedback Messages */}
        {error && (
          <div className="no-print p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs font-bold flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
            <span className="whitespace-pre-line leading-relaxed">{error}</span>
          </div>
        )}
        {success && (
          <div className="no-print p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs font-bold flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />
            <span>{success}</span>
          </div>
        )}

        {loading ? (
          <div className="py-24 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto mb-2" />
            <p className="text-xs font-bold text-slate-500">جارٍ قراءة بيانات الطلب والفاتورة...</p>
          </div>
        ) : !order ? (
          <div className="py-20 text-center text-slate-500 text-sm">الطلب غير موجود</div>
        ) : (
          <div className="space-y-6">
            {/* Status Banner (No Print) */}
            <div className="no-print bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-black border ${currentStatus?.badge}`}
                >
                  <StatusIcon className="w-4 h-4" />
                  <span>{currentStatus?.label}</span>
                </span>
                <span className="text-xs text-slate-500">
                  تاريخ الإنشاء: {new Date(order.created_at).toLocaleString('ar-EG')}
                </span>
              </div>

              {order.confirmed_at && (
                <span className="text-xs text-blue-700 font-bold">
                  تم حجز المخزون في: {new Date(order.confirmed_at).toLocaleString('ar-EG')}
                </span>
              )}

              {order.shipped_at && (
                <span className="text-xs text-emerald-700 font-bold">
                  تم الشحن الفعلي في: {new Date(order.shipped_at).toLocaleString('ar-EG')}
                </span>
              )}
            </div>

            {/* Printable Invoice Container */}
            <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm print:border-none print:shadow-none print:p-0 space-y-6">
              {/* Invoice Header */}
              <div className="border-b-2 border-slate-900 pb-6 flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-xl bg-slate-900 text-white font-black text-xl flex items-center justify-center">
                      ز
                    </div>
                    <div>
                      <h2 className="text-2xl font-black text-slate-900">منظومة زين التجارية</h2>
                      <p className="text-xs text-slate-600 font-bold">جملة مشكل ملابس أطفال • القاهرة، مصر</p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500">سجل تجاري / بطاقة ضريبية معتمدة</p>
                </div>

                <div className="text-left space-y-1">
                  <h3 className="text-xl font-black text-indigo-900 font-mono">فاتورة بيع جملة</h3>
                  <p className="text-sm font-black font-mono text-slate-800">{order.order_number}</p>
                  <p className="text-xs text-slate-500">
                    التاريخ: {new Date(order.order_date).toLocaleDateString('ar-EG')}
                  </p>
                </div>
              </div>

              {/* Customer & Order Metadata Grid */}
              <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="space-y-1">
                  <span className="text-slate-400 font-bold">بيانات العميل:</span>
                  <p className="text-sm font-black text-slate-900">{order.customer_name}</p>
                  <p className="text-slate-600 font-mono">هاتف: {order.customer_phone}</p>
                  {order.customer_address && <p className="text-slate-600">العنوان: {order.customer_address}</p>}
                </div>

                <div className="space-y-1 text-left">
                  <span className="text-slate-400 font-bold">بيانات العملية:</span>
                  <p className="font-bold text-slate-800">حرر بواسطة: {order.created_by_name || 'مسؤول المبيعات'}</p>
                  <p className="text-slate-600">المستودع: المستودع الرئيسي (MAIN)</p>
                  {order.notes && <p className="text-slate-700 italic">ملاحظات: {order.notes}</p>}
                </div>
              </div>

              {/* Items Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs border border-slate-300">
                  <thead className="bg-slate-100 text-slate-800 font-black border-b border-slate-300">
                    <tr>
                      <th className="py-2.5 px-3 border-l border-slate-300 text-center w-10">م</th>
                      <th className="py-2.5 px-3 border-l border-slate-300">كود الموديل</th>
                      <th className="py-2.5 px-3 border-l border-slate-300">اسم الموديل / الصنف</th>
                      <th className="py-2.5 px-3 border-l border-slate-300">اللون</th>
                      <th className="py-2.5 px-3 border-l border-slate-300">المقاس</th>
                      <th className="py-2.5 px-3 border-l border-slate-300 text-center">الكمية</th>
                      <th className="py-2.5 px-3 border-l border-slate-300 text-center">سعر القطعة</th>
                      <th className="py-2.5 px-3 border-l border-slate-300 text-center">الخصم</th>
                      <th className="py-2.5 px-3 text-center">الإجمالي</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {items.map((item, idx) => (
                      <tr key={item.id} className="hover:bg-slate-50">
                        <td className="py-2 px-3 border-l border-slate-200 text-center font-bold text-slate-500">
                          {idx + 1}
                        </td>
                        <td className="py-2 px-3 border-l border-slate-200 font-mono font-black text-indigo-900">
                          {item.model_code}
                        </td>
                        <td className="py-2 px-3 border-l border-slate-200 font-bold text-slate-900">
                          {item.model_name}
                        </td>
                        <td className="py-2 px-3 border-l border-slate-200">{item.color_name}</td>
                        <td className="py-2 px-3 border-l border-slate-200">{item.size_name}</td>
                        <td className="py-2 px-3 border-l border-slate-200 text-center font-black text-slate-900">
                          {item.quantity}
                        </td>
                        <td className="py-2 px-3 border-l border-slate-200 text-center font-bold">
                          {Number(item.unit_price).toLocaleString('ar-EG')} ج.م
                        </td>
                        <td className="py-2 px-3 border-l border-slate-200 text-center text-slate-500">
                          {Number(item.line_discount) > 0 ? `${Number(item.line_discount)} ج.م` : '—'}
                        </td>
                        <td className="py-2 px-3 text-center font-black text-slate-900">
                          {Number(item.line_total).toLocaleString('ar-EG')} ج.م
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Invoice Financial Summary */}
              <div className="flex justify-between items-start pt-4">
                <div className="text-xs text-slate-500 space-y-1">
                  <p>• البضاعة المباعة تخضع لسياسة الفحص المعتمدة خلال 48 ساعة من تاريخ الاستلام.</p>
                  <p>• لا يعتمد أي مرتجع إلا بعد فحص الحالة الفنية والتأكد من سلامة البطاقات.</p>
                </div>

                <div className="w-80 border border-slate-300 rounded-xl p-4 bg-slate-50 space-y-2 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>إجمالي عدد القطع:</span>
                    <span className="font-bold text-slate-900">{order.total_pieces} قطعة ملابس</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>المجموع الفرعي:</span>
                    <span className="font-bold text-slate-900">{Number(order.subtotal).toLocaleString('ar-EG')} ج.م</span>
                  </div>
                  {Number(order.discount_amount) > 0 && (
                    <div className="flex justify-between text-rose-700 font-bold">
                      <span>خصم الفاتورة:</span>
                      <span>- {Number(order.discount_amount).toLocaleString('ar-EG')} ج.م</span>
                    </div>
                  )}
                  <div className="flex justify-between text-base font-black text-slate-900 pt-2 border-t border-slate-300">
                    <span>الصافي المطلوب سداده:</span>
                    <span className="text-indigo-900">{Number(order.total_amount).toLocaleString('ar-EG')} جنيه مصري</span>
                  </div>
                </div>
              </div>

              {/* Signatures for Warehouse and Customer */}
              <div className="grid grid-cols-2 gap-8 pt-8 border-t border-slate-200 text-xs">
                <div className="text-center space-y-8">
                  <span className="font-bold text-slate-700">توقيع مسؤول المستودع والتجهيز</span>
                  <div className="border-b border-dashed border-slate-400 w-48 mx-auto" />
                </div>
                <div className="text-center space-y-8">
                  <span className="font-bold text-slate-700">توقيع واستلام العميل / المندوب</span>
                  <div className="border-b border-dashed border-slate-400 w-48 mx-auto" />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

export default function OrderDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-slate-50 font-sans text-slate-500" dir="rtl">
          جاري تحميل تفاصيل الطلب...
        </div>
      }
    >
      <OrderDetailContent />
    </Suspense>
  );
}
