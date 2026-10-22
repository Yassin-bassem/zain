'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import {
  PackageCheck,
  Printer,
  CheckCircle2,
  Clock,
  ArrowRight,
  Loader2,
  Check,
  AlertCircle,
} from 'lucide-react';

export default function PickingWorkspacePage() {
  const [confirmedOrders, setConfirmedOrders] = useState<any[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [orderDetails, setOrderDetails] = useState<any>(null);
  const [pickedItems, setPickedItems] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      // Fetch orders in 'confirmed' or 'picking' status
      const res = await fetch('/api/orders?status=confirmed&limit=100');
      if (res.ok) {
        const data = await res.json();
        setConfirmedOrders(data.orders || []);
        if (data.orders?.length > 0 && !selectedOrderId) {
          setSelectedOrderId(data.orders[0].id);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  useEffect(() => {
    if (!selectedOrderId) {
      setOrderDetails(null);
      return;
    }

    fetch(`/api/orders/${selectedOrderId}`)
      .then((r) => r.json())
      .then((d) => {
        setOrderDetails(d);
        // Initialize picked items with requested quantities
        const initPicked: Record<number, number> = {};
        for (const item of d.items || []) {
          initPicked[item.id] = item.picked_quantity > 0 ? item.picked_quantity : item.quantity;
        }
        setPickedItems(initPicked);
      })
      .catch((err) => console.error(err));
  }, [selectedOrderId]);

  const handleCompletePicking = async () => {
    if (!selectedOrderId) return;
    setSubmitting(true);
    setMessage(null);

    try {
      // Transition from confirmed -> picking, then pack
      const res1 = await fetch(`/api/orders/${selectedOrderId}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'pick' }),
      });
      const data1 = await res1.json();
      if (!res1.ok && !data1.error?.includes('picking')) {
        throw new Error(data1.error || 'فشل تحديث حالة التجهيز');
      }

      const res2 = await fetch(`/api/orders/${selectedOrderId}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'pack' }),
      });
      const data2 = await res2.json();
      if (!res2.ok) throw new Error(data2.error || 'فشل نقل الطلب لمرحلة التغليف');

      setMessage({
        text: 'تم اكتمال تجهيز وتغليف كافة أصناف الطلب بنجاح ونقله إلى جاهز للشحن.',
        type: 'success',
      });

      fetchOrders();
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <AppShell
      title="منطقة تجهيز والتقاط الطلبات (Picking Workspace)"
      subtitle="قائمة التجهيز للمستودع مرتبة بالموديل والمقاس وموقع التخزين مع مطابقة الكميات المجهزة"
    >
      <div className="space-y-6">
        {/* Top Controls (No Print) */}
        <div className="no-print flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-600">اختر طلب للتجهيز:</span>
            <select
              value={selectedOrderId || ''}
              onChange={(e) => setSelectedOrderId(Number(e.target.value))}
              className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800"
            >
              {confirmedOrders.length === 0 ? (
                <option value="">لا توجد طلبات مؤكدة بانتظار التجهيز حالياً</option>
              ) : (
                confirmedOrders.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.order_number} - {o.customer_name} ({o.total_pieces} قطعة)
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              disabled={!orderDetails}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold shadow-sm transition-colors cursor-pointer disabled:opacity-50"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة إذن التجهيز للمستودع (Picking Sheet)</span>
            </button>

            {orderDetails && orderDetails.order.status !== 'packed' && orderDetails.order.status !== 'shipped' && (
              <button
                onClick={handleCompletePicking}
                disabled={submitting}
                className="flex items-center gap-2 px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors cursor-pointer disabled:opacity-50"
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <PackageCheck className="w-4 h-4" />
                )}
                <span>تأكيد اكتمال التجهيز والتغليف</span>
              </button>
            )}
          </div>
        </div>

        {message && (
          <div
            className={`no-print p-4 rounded-xl text-xs font-bold flex items-center gap-2.5 ${
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

        {/* Printable Picking Sheet */}
        {!orderDetails ? (
          <div className="bg-white p-16 rounded-2xl border border-slate-200 text-center text-slate-400 text-xs">
            <PackageCheck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p>اختر طلباً من القائمة بالأعلى لعرض بنود التجهيز وقائمة الأرفف</p>
          </div>
        ) : (
          <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6 print:border-none print:shadow-none print:p-0">
            {/* Sheet Header */}
            <div className="border-b-2 border-slate-900 pb-4 flex items-start justify-between">
              <div>
                <h2 className="text-xl font-black text-slate-900">إذن تجهيز والتقاط بضاعة (Picking Sheet)</h2>
                <p className="text-xs text-slate-600 mt-0.5">
                  أمر تجهيز مخصص لموظف المستودع • مجمع حسب كود الموديل والأرفف
                </p>
              </div>

              <div className="text-left font-mono">
                <span className="block text-lg font-black text-purple-900">{orderDetails.order.order_number}</span>
                <span className="text-xs text-slate-500">
                  تاريخ الطلب: {new Date(orderDetails.order.order_date).toLocaleDateString('ar-EG')}
                </span>
              </div>
            </div>

            {/* Order info badge */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between text-xs">
              <span>العميل: <strong>{orderDetails.order.customer_name}</strong></span>
              <span>المستودع: <strong>المستودع الرئيسي (MAIN)</strong></span>
              <span>إجمالي القطع المطلوبة: <strong className="text-indigo-900">{orderDetails.order.total_pieces} قطعة</strong></span>
              <span>الحالة الحالية: <strong className="text-purple-700">{orderDetails.order.status}</strong></span>
            </div>

            {/* Picking Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs border border-slate-300">
                <thead className="bg-slate-100 text-slate-800 font-black border-b border-slate-300">
                  <tr>
                    <th className="py-2.5 px-3 border-l border-slate-300 text-center w-12">تم</th>
                    <th className="py-2.5 px-3 border-l border-slate-300">كود الموديل</th>
                    <th className="py-2.5 px-3 border-l border-slate-300">اسم الموديل</th>
                    <th className="py-2.5 px-3 border-l border-slate-300">اللون</th>
                    <th className="py-2.5 px-3 border-l border-slate-300">المقاس</th>
                    <th className="py-2.5 px-3 border-l border-slate-300">الباركود (SKU)</th>
                    <th className="py-2.5 px-3 border-l border-slate-300 text-center">الكمية المطلوبة</th>
                    <th className="py-2.5 px-3 border-l border-slate-300 text-center w-28">الكمية المجهزة فعلياً</th>
                    <th className="py-2.5 px-3 text-center">ملاحظات التجهيز</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {orderDetails.items.map((item: any) => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="py-2 px-3 border-l border-slate-200 text-center">
                        <input
                          type="checkbox"
                          defaultChecked
                          className="w-4 h-4 rounded text-purple-600 focus:ring-0 cursor-pointer"
                        />
                      </td>
                      <td className="py-2 px-3 border-l border-slate-200 font-mono font-black text-indigo-900">
                        {item.model_code}
                      </td>
                      <td className="py-2 px-3 border-l border-slate-200 font-bold text-slate-900">
                        {item.model_name}
                      </td>
                      <td className="py-2 px-3 border-l border-slate-200 font-semibold">{item.color_name}</td>
                      <td className="py-2 px-3 border-l border-slate-200 font-semibold">{item.size_name}</td>
                      <td className="py-2 px-3 border-l border-slate-200 font-mono text-[11px] text-slate-500">
                        {item.sku}
                      </td>
                      <td className="py-2 px-3 border-l border-slate-200 text-center font-black text-sm text-slate-900">
                        {item.quantity}
                      </td>
                      <td className="py-2 px-3 border-l border-slate-200 text-center">
                        <span className="font-bold text-sm text-purple-900">
                          {pickedItems[item.id] !== undefined ? pickedItems[item.id] : item.quantity}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-center text-slate-400 text-[11px]">
                        سليم ومطابق
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Signature Area */}
            <div className="grid grid-cols-2 gap-8 pt-6 border-t border-slate-200 text-xs">
              <div className="text-center space-y-6">
                <span className="font-bold text-slate-700">توقيع مسؤول الالتقاط والتجهيز بالمستودع</span>
                <div className="border-b border-dashed border-slate-400 w-48 mx-auto" />
              </div>
              <div className="text-center space-y-6">
                <span className="font-bold text-slate-700">توقيع مسؤول فحص وتغليف الشحنة</span>
                <div className="border-b border-dashed border-slate-400 w-48 mx-auto" />
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
