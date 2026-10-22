'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import {
  Layers,
  Sparkles,
  Warehouse,
  ShieldAlert,
  Clock,
  PackageCheck,
  Truck,
  ArrowUpRight,
  TrendingDown,
  ArrowDownLeft,
  Calendar,
  CheckCircle2,
  FileSpreadsheet,
  PlusCircle,
  Loader2,
} from 'lucide-react';

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/dashboard');
      if (res.ok) {
        const data = await res.json();
        setMetrics(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const movementLabels: Record<string, { label: string; color: string }> = {
    RECEIPT: { label: 'توريد بضاعة', color: 'bg-emerald-100 text-emerald-800' },
    OPENING_BALANCE: { label: 'رصيد افتتاحي', color: 'bg-indigo-100 text-indigo-800' },
    SHIPMENT: { label: 'شحن طلب', color: 'bg-rose-100 text-rose-800' },
    RETURN_SELLABLE: { label: 'مرتجع سليم', color: 'bg-teal-100 text-teal-800' },
    ADJUSTMENT: { label: 'تسوية مخزنية', color: 'bg-amber-100 text-amber-800' },
    TRANSFER: { label: 'نقل مخزني', color: 'bg-purple-100 text-purple-800' },
  };

  return (
    <AppShell
      title="لوحة تحكم المستودع وحركة المخزون"
      subtitle="متابعة دقيقة للأرصدة الفعلية والمحجوزة وحركة طلبات الجملة المشكل"
    >
      {loading && !metrics ? (
        <div className="py-24 text-center">
          <Loader2 className="w-10 h-10 animate-spin text-indigo-600 mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-600">جارٍ قراءة بيانات المخزون المحدثة لحظياً...</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Quick Welcome Banner */}
          <div className="bg-gradient-to-l from-slate-900 to-indigo-950 rounded-2xl p-6 text-white shadow-md relative overflow-hidden flex flex-wrap items-center justify-between gap-4">
            <div className="relative z-10 space-y-1">
              <span className="inline-block px-2.5 py-0.5 rounded-full bg-indigo-500/30 text-indigo-200 text-xs font-bold border border-indigo-400/30">
                منظومة الجملة الموحدة
              </span>
              <h2 className="text-2xl font-black">مستودع ملابس الأطفال المركزي</h2>
              <p className="text-slate-300 text-sm max-w-xl">
                إدارة الطلبات المشكلة بدقة متناهية، حجز المخزون آلياً ومنع البيع على المكشوف، وتسجيل كافة الحركات بملف تدقيق غير قابل للتعديل.
              </p>
            </div>
            <div className="relative z-10 flex items-center gap-3">
              <Link
                href="/orders/new"
                className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-bold shadow-md transition-colors"
              >
                <PlusCircle className="w-4 h-4" />
                <span>إدخال طلب جملة جديد</span>
              </Link>
              <Link
                href="/import"
                className="flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm font-bold transition-colors border border-white/15"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>استيراد ملف شيت</span>
              </Link>
            </div>
          </div>

          {/* Core Inventory Pieces Cards (Physical, Reserved, Available) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* 1. Physical On-Hand Stock */}
            <Link
              href="/inventory"
              className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-indigo-300 transition-all group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">الرصيد الفعلي في المخزن</span>
                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                  <Warehouse className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-black text-slate-900">
                  {metrics?.totalPhysical?.toLocaleString('ar-EG') || 0}
                </span>
                <span className="text-xs font-bold text-slate-500">قطعة ملابس فعلية</span>
              </div>
              <p className="text-xs text-slate-400 mt-2">إجمالي القطع الموجودة فعلياً على الأرفف بالمستودع</p>
            </Link>

            {/* 2. Reserved Stock */}
            <Link
              href="/orders?status=confirmed"
              className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-amber-300 transition-all group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-700">الرصيد المحجوز للطلبات</span>
                <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 group-hover:bg-amber-100 transition-colors">
                  <Clock className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-black text-amber-900">
                  {metrics?.totalReserved?.toLocaleString('ar-EG') || 0}
                </span>
                <span className="text-xs font-bold text-amber-600">قطعة محجوزة</span>
              </div>
              <p className="text-xs text-slate-400 mt-2">قطع محجوزة لطلبات مؤكدة قيد التجهيز والشحن</p>
            </Link>

            {/* 3. Available For Sale Stock */}
            <Link
              href="/inventory?stockStatus=in_stock"
              className="bg-white p-5 rounded-2xl border border-emerald-200 shadow-xs hover:border-emerald-400 transition-all group bg-gradient-to-br from-white to-emerald-50/40"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-700">الرصيد المتاح للبيع الفوري</span>
                <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700 group-hover:bg-emerald-200 transition-colors">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-black text-emerald-800">
                  {metrics?.totalAvailable?.toLocaleString('ar-EG') || 0}
                </span>
                <span className="text-xs font-bold text-emerald-600">قطعة جاهزة للطلب</span>
              </div>
              <p className="text-xs text-slate-400 mt-2">الرصيد الفعلي مطروحاً منه المحجوز (الرصيد الآمن)</p>
            </Link>
          </div>

          {/* Catalog & Alert Counts Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Link
              href="/products"
              className="bg-white p-4 rounded-xl border border-slate-200 hover:border-slate-300 transition-colors shadow-2xs"
            >
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-xs font-bold">الموديلات النشطة</span>
                <Layers className="w-4 h-4 text-indigo-600" />
              </div>
              <p className="text-2xl font-black text-slate-900">
                {metrics?.totalModels?.toLocaleString('ar-EG') || 0}
              </p>
              <span className="text-[11px] text-slate-400">موديل / كود صنف</span>
            </Link>

            <Link
              href="/products"
              className="bg-white p-4 rounded-xl border border-slate-200 hover:border-slate-300 transition-colors shadow-2xs"
            >
              <div className="flex items-center justify-between text-slate-500 mb-1">
                <span className="text-xs font-bold">المتغيرات الفريدة (SKUs)</span>
                <Sparkles className="w-4 h-4 text-purple-600" />
              </div>
              <p className="text-2xl font-black text-slate-900">
                {metrics?.totalVariants?.toLocaleString('ar-EG') || 0}
              </p>
              <span className="text-[11px] text-slate-400">تركيبة (موديل + لون + مقاس)</span>
            </Link>

            <Link
              href="/inventory?stockStatus=out_of_stock"
              className="bg-white p-4 rounded-xl border border-rose-100 hover:border-rose-300 transition-colors shadow-2xs bg-rose-50/20"
            >
              <div className="flex items-center justify-between text-rose-700 mb-1">
                <span className="text-xs font-bold">أصناف نفدت بالكامل</span>
                <ShieldAlert className="w-4 h-4 text-rose-600" />
              </div>
              <p className="text-2xl font-black text-rose-900">
                {metrics?.outOfStockCount?.toLocaleString('ar-EG') || 0}
              </p>
              <span className="text-[11px] text-rose-500 font-semibold">متغير برصيد صفر متاح</span>
            </Link>

            <Link
              href="/inventory?stockStatus=low_stock"
              className="bg-white p-4 rounded-xl border border-amber-100 hover:border-amber-300 transition-colors shadow-2xs bg-amber-50/20"
            >
              <div className="flex items-center justify-between text-amber-700 mb-1">
                <span className="text-xs font-bold">أصناف أوشكت على النفاد</span>
                <TrendingDown className="w-4 h-4 text-amber-600" />
              </div>
              <p className="text-2xl font-black text-amber-900">
                {metrics?.lowStockCount?.toLocaleString('ar-EG') || 0}
              </p>
              <span className="text-[11px] text-amber-500 font-semibold">أقل من حد الطلب الأدنى</span>
            </Link>
          </div>

          {/* Wholesale Orders Pipeline Workflow Status */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-black text-slate-900">مسار تنفيذ طلبات الجملة المشكل</h3>
                <p className="text-xs text-slate-500">حالات تدفق الطلبات من الإنشاء حتى التسليم والشحن النهائي</p>
              </div>
              <Link
                href="/orders"
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
              >
                <span>عرض قائمة الطلبات</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Link
                href="/orders?status=draft"
                className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 hover:bg-slate-100 transition-colors"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-slate-600">مسودات تنتظر التأكيد</span>
                  <div className="w-2.5 h-2.5 rounded-full bg-slate-400" />
                </div>
                <p className="text-2xl font-black text-slate-800">{metrics?.ordersAwaitingConfirmation || 0}</p>
                <p className="text-[11px] text-slate-400 mt-1">تتطلب فحص المخزون والتأكيد</p>
              </Link>

              <Link
                href="/warehouse/picking"
                className="p-4 rounded-xl bg-blue-50/60 border border-blue-200/80 hover:bg-blue-100/60 transition-colors"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-blue-800">بانتظار التجهيز (Pick)</span>
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                </div>
                <p className="text-2xl font-black text-blue-900">{metrics?.ordersAwaitingPicking || 0}</p>
                <p className="text-[11px] text-blue-600 font-semibold mt-1">المخزون محجوز ومؤكد</p>
              </Link>

              <Link
                href="/warehouse/shipping"
                className="p-4 rounded-xl bg-amber-50/60 border border-amber-200/80 hover:bg-amber-100/60 transition-colors"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-amber-800">قيد التعبئة والتغليف</span>
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                </div>
                <p className="text-2xl font-black text-amber-900">{metrics?.ordersBeingPacked || 0}</p>
                <p className="text-[11px] text-amber-600 font-semibold mt-1">جاري مطابقة بنود الشحنة</p>
              </Link>

              <Link
                href="/warehouse/shipping"
                className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200/80 hover:bg-emerald-100/60 transition-colors"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-emerald-800">جاهزة للتسليم والشحن</span>
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                </div>
                <p className="text-2xl font-black text-emerald-900">{metrics?.ordersReadyToShip || 0}</p>
                <p className="text-[11px] text-emerald-600 font-semibold mt-1">خصم المخزون الفعلي عند الشحن</p>
              </Link>
            </div>
          </div>

          {/* Two-Column: Recent Stock Movements & Recent Goods Receipts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 1. Recent Immutable Stock Movements */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-base font-black text-slate-900">سجل أحدث الحركات المخزنية</h3>
                    <p className="text-xs text-slate-500">سجل غير قابل للتعديل يوثق كل إضافة أو خصم أو تسوية</p>
                  </div>
                  <Link
                    href="/inventory/movements"
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                  >
                    <span>عرض السجل كاملاً</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </Link>
                </div>

                <div className="divide-y divide-slate-100">
                  {(!metrics?.recentMovements || metrics.recentMovements.length === 0) ? (
                    <div className="py-8 text-center text-slate-400 text-xs">
                      لا توجد حركات مخزنية مسجلة بعد.
                    </div>
                  ) : (
                    metrics.recentMovements.map((m: any) => {
                      const isPositive = Number(m.quantity_delta) > 0;
                      const badge = movementLabels[m.movement_type] || {
                        label: m.movement_type,
                        color: 'bg-slate-100 text-slate-700',
                      };

                      return (
                        <div key={m.id} className="py-2.5 flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2.5">
                            <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${badge.color}`}>
                              {badge.label}
                            </span>
                            <div>
                              <p className="font-bold text-slate-900">
                                {m.model_code} - {m.model_name}
                              </p>
                              <p className="text-slate-500 text-[11px]">
                                {m.color_name} • {m.size_name} • {m.reason}
                              </p>
                            </div>
                          </div>
                          <div className="text-left">
                            <span
                              className={`font-black text-sm ${
                                isPositive ? 'text-emerald-600' : 'text-rose-600'
                              }`}
                            >
                              {isPositive ? `+${m.quantity_delta}` : m.quantity_delta}
                            </span>
                            <span className="block text-[10px] text-slate-400">
                              {new Date(m.created_at).toLocaleTimeString('ar-EG', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* 2. Recent Supplier Receipts */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-base font-black text-slate-900">أحدث أذونات استلام البضاعة</h3>
                    <p className="text-xs text-slate-500">التوريدات الواردة من المصانع وورش تصنيع ملابس الأطفال</p>
                  </div>
                  <Link
                    href="/warehouse/receipts"
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                  >
                    <span>كافة التوريدات</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </Link>
                </div>

                <div className="divide-y divide-slate-100">
                  {(!metrics?.recentReceipts || metrics.recentReceipts.length === 0) ? (
                    <div className="py-8 text-center text-slate-400 text-xs">
                      لا توجد أذونات توريد مسجلة حالياً.
                    </div>
                  ) : (
                    metrics.recentReceipts.map((r: any) => (
                      <div key={r.id} className="py-3 flex items-center justify-between text-xs">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900">{r.receipt_number}</span>
                            <span
                              className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                                r.status === 'confirmed'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {r.status === 'confirmed' ? 'تم الاعتماد والإدخال' : 'مسودة'}
                            </span>
                          </div>
                          <p className="text-slate-500 text-[11px] mt-0.5">
                            المورد: {r.supplier_name} • التاريخ: {new Date(r.receipt_date).toLocaleDateString('ar-EG')}
                          </p>
                        </div>
                        <div className="text-left">
                          <span className="font-black text-sm text-slate-800">
                            {r.total_pieces?.toLocaleString('ar-EG')} قطعة
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 mt-4">
                <Link
                  href="/warehouse/receipts/new"
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors"
                >
                  <PackageCheck className="w-4 h-4" />
                  <span>تسجيل إذن استلام توريد جديد</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
