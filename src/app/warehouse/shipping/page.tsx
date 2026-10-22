'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import { Truck, CheckCircle2, AlertCircle, Loader2, PackageCheck, Eye } from 'lucide-react';

export default function ShippingWorkspacePage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [shippingOrderId, setShippingOrderId] = useState<number | null>(null);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const fetchReadyOrders = async () => {
    try {
      setLoading(true);
      // Fetch packed, picking, or confirmed orders
      const res = await fetch('/api/orders?limit=100');
      if (res.ok) {
        const data = await res.json();
        const ready = (data.orders || []).filter((o: any) =>
          ['packed', 'picking', 'confirmed'].includes(o.status)
        );
        setOrders(ready);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReadyOrders();
  }, []);

  const handleConfirmShipment = async (orderId: number, orderNumber: string) => {
    if (!confirm(`هل أنت متأكد من تأكيد تسليم وشحن الطلب (${orderNumber})؟\nسيتم خصم الرصيد الفعلي للمخزون نهائياً وتسجيل حركة شحن معتمدة.`)) {
      return;
    }

    setShippingOrderId(orderId);
    setMessage(null);

    try {
      const res = await fetch(`/api/orders/${orderId}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ship' }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل تنفيذ عملية الشحن');

      setMessage({
        text: `تم بنجاح شحن الطلب (${orderNumber}) وخصم القطع الفعلية من المستودع وتحرير الحجز.`,
        type: 'success',
      });

      fetchReadyOrders();
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setShippingOrderId(null);
    }
  };

  return (
    <AppShell
      title="فحص التغليف وتأكيد الشحن والتسليم النهائي"
      subtitle="محطة التسليم النهائي التي يتم عندها خصم المخزون الفعلي ذرياً وتحويل الحجوزات إلى تسليم نهائي"
    >
      <div className="space-y-6">
        {/* Warning Callout */}
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-xs text-emerald-900 flex items-center gap-3">
          <Truck className="w-5 h-5 text-emerald-700 shrink-0" />
          <div>
            <p className="font-black text-sm text-emerald-950">نقطة الخصم المخزني الفعلي (Deduction Point)</p>
            <p className="text-emerald-800 mt-0.5">
              لا يتم خصم الرصيد الفعلي في أي مرحلة سابقة (سواء المسودة، أو التأكيد، أو التجهيز). فقط عند الضغط على "تأكيد الشحن والتسليم"، يقوم النظام بخصم الرصيد الفعلي وتسجيل حركة الشحن في سجل التدقيق غير القابل للتعديل لمنع تكرار الخصم.
            </p>
          </div>
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

        {/* Ready Orders Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
            <span className="font-black text-slate-800">
              الطلبات الجاهزة للشحن والتسليم ({orders.length} طلب)
            </span>
          </div>

          {loading ? (
            <div className="py-20 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-500">جارٍ قراءة الشحنات الجاهزة...</p>
            </div>
          ) : orders.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-xs">
              <PackageCheck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p>لا توجد طلبات جاهزة للشحن والتسليم حالياً.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">رقم الطلب</th>
                    <th className="py-3 px-4">العميل / المحل</th>
                    <th className="py-3 px-4">هاتف العميل</th>
                    <th className="py-3 px-4 text-center">إجمالي القطع</th>
                    <th className="py-3 px-4 text-center">قيمة الطلب</th>
                    <th className="py-3 px-4 text-center">حالة التجهيز</th>
                    <th className="py-3 px-4 text-center">إجراء التسليم والشحن</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {orders.map((o) => (
                    <tr key={o.id} className="hover:bg-slate-50">
                      <td className="py-3.5 px-4 font-mono font-black text-indigo-700">
                        {o.order_number}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-900">{o.customer_name}</td>
                      <td className="py-3.5 px-4 font-mono text-slate-500">{o.customer_phone}</td>
                      <td className="py-3.5 px-4 text-center font-black text-slate-900">
                        {o.total_pieces} قطعة
                      </td>
                      <td className="py-3.5 px-4 text-center font-black text-indigo-900">
                        {Number(o.total_amount).toLocaleString('ar-EG')} ج.م
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`px-2.5 py-1 rounded-md text-[11px] font-bold ${
                            o.status === 'packed'
                              ? 'bg-amber-100 text-amber-800'
                              : o.status === 'picking'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {o.status === 'packed' ? 'مغلف وجاهز' : o.status === 'picking' ? 'قيد التجهيز' : 'مؤكد ومحجوز'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Link
                            href={`/orders/${o.id}`}
                            className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100"
                            title="معاينة الفاتورة"
                          >
                            <Eye className="w-4 h-4" />
                          </Link>

                          <button
                            onClick={() => handleConfirmShipment(o.id, o.order_number)}
                            disabled={shippingOrderId === o.id}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                          >
                            {shippingOrderId === o.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Truck className="w-3.5 h-3.5" />
                            )}
                            <span>تسليم وشحن نهائي</span>
                          </button>
                        </div>
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
