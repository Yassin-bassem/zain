'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import {
  Layers,
  ArrowRight,
  PlusCircle,
  Warehouse,
  CheckCircle2,
  Clock,
  Loader2,
  Table as TableIcon,
  Tag,
} from 'lucide-react';

function ProductDetailContent() {
  const params = useParams();
  const productId = params.id as string;

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchMatrix = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/products/${productId}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (productId) fetchMatrix();
  }, [productId]);

  // Extract unique colors and sizes for 2D matrix
  const variants = data?.variants || [];
  const uniqueColors: { id: number; name: string }[] = [];
  const uniqueSizes: { id: number; name: string }[] = [];

  const seenColorIds = new Set<number>();
  const seenSizeIds = new Set<number>();

  for (const v of variants) {
    if (!seenColorIds.has(v.color_id)) {
      seenColorIds.add(v.color_id);
      uniqueColors.push({ id: v.color_id, name: v.color_name });
    }
    if (!seenSizeIds.has(v.size_id)) {
      seenSizeIds.add(v.size_id);
      uniqueSizes.push({ id: v.size_id, name: v.size_name });
    }
  }

  // Map of "colorId_sizeId" -> variant
  const matrixMap = new Map<string, any>();
  for (const v of variants) {
    matrixMap.set(`${v.color_id}_${v.size_id}`, v);
  }

  return (
    <AppShell
      title={`مصفوفة الموديل: ${data?.product?.model_code || '...'}`}
      subtitle={`${data?.product?.model_name || ''}`}
    >
      <div className="space-y-6">
        {/* Back and Action Bar */}
        <div className="flex items-center justify-between">
          <Link
            href="/products"
            className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors"
          >
            <ArrowRight className="w-4 h-4" />
            <span>العودة لكتالوج الموديلات</span>
          </Link>

          <Link
            href={`/products/bulk-variants?productId=${productId}`}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors"
          >
            <PlusCircle className="w-4 h-4" />
            <span>توليد مقاسات وألوان إضافية لهذا الموديل</span>
          </Link>
        </div>

        {loading ? (
          <div className="py-24 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto mb-2" />
            <p className="text-xs font-bold text-slate-500">جارٍ قراءة مصفوفة الموديل وحساب المخزون...</p>
          </div>
        ) : !data ? (
          <div className="py-16 text-center text-slate-500 text-sm">الموديل غير موجود</div>
        ) : (
          <div className="space-y-6">
            {/* Header Totals Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-500">إجمالي الرصيد الفعلي للموديل</span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-3xl font-black text-slate-900">
                      {data.totals.totalOnHand.toLocaleString('ar-EG')}
                    </span>
                    <span className="text-xs font-bold text-slate-500">قطعة</span>
                  </div>
                </div>
                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
                  <Warehouse className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-amber-700">المحجوز للطلبات</span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-3xl font-black text-amber-900">
                      {data.totals.totalReserved.toLocaleString('ar-EG')}
                    </span>
                    <span className="text-xs font-bold text-amber-600">قطعة</span>
                  </div>
                </div>
                <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
                  <Clock className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-emerald-200 shadow-xs flex items-center justify-between bg-emerald-50/20">
                <div>
                  <span className="text-xs font-bold text-emerald-700">الرصيد المتاح للطلب الفوري</span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-3xl font-black text-emerald-800">
                      {data.totals.totalAvailable.toLocaleString('ar-EG')}
                    </span>
                    <span className="text-xs font-bold text-emerald-600">قطعة</span>
                  </div>
                </div>
                <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              </div>
            </div>

            {/* 2D Variant Matrix (Colors x Sizes) */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TableIcon className="w-4 h-4 text-indigo-600" />
                  <h3 className="text-sm font-black text-slate-900">
                    مصفوفة الألوان والمقاسات (Variant Matrix)
                  </h3>
                </div>
                <span className="text-xs text-slate-500 font-semibold">
                  (الأرقام تعرض: الفعلي / المتاح)
                </span>
              </div>

              {variants.length === 0 ? (
                <div className="p-10 text-center text-slate-400 text-xs">
                  لا توجد متغيرات لهذا الموديل حتى الآن. اضغط زر "توليد مقاسات وألوان" بالأعلى لإضافتها.
                </div>
              ) : (
                <div className="overflow-x-auto p-4">
                  <table className="w-full border-collapse text-center text-xs">
                    <thead>
                      <tr>
                        <th className="border border-slate-200 bg-slate-100 py-3 px-4 font-black text-slate-800 text-right w-44">
                          اللون \ المقاس
                        </th>
                        {uniqueSizes.map((sz) => (
                          <th
                            key={sz.id}
                            className="border border-slate-200 bg-slate-100 py-3 px-3 font-black text-slate-800 min-w-[90px]"
                          >
                            {sz.name}
                          </th>
                        ))}
                        <th className="border border-slate-200 bg-slate-200 py-3 px-3 font-black text-slate-900">
                          إجمالي اللون
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {uniqueColors.map((color) => {
                        let colorOnHandTotal = 0;
                        let colorAvailableTotal = 0;

                        return (
                          <tr key={color.id} className="hover:bg-slate-50/60 transition-colors">
                            <td className="border border-slate-200 p-3 font-bold text-slate-900 text-right bg-slate-50/50">
                              {color.name}
                            </td>
                            {uniqueSizes.map((sz) => {
                              const variant = matrixMap.get(`${color.id}_${sz.id}`);
                              if (!variant) {
                                return (
                                  <td
                                    key={sz.id}
                                    className="border border-slate-200 p-3 text-slate-300 font-mono text-[11px] bg-slate-50/30"
                                  >
                                    —
                                  </td>
                                );
                              }

                              const onHand = Number(variant.on_hand_quantity || 0);
                              const available = Number(variant.available_quantity || 0);
                              colorOnHandTotal += onHand;
                              colorAvailableTotal += available;

                              return (
                                <td key={sz.id} className="border border-slate-200 p-2.5">
                                  <div className="space-y-0.5">
                                    <span
                                      className={`block font-black text-sm ${
                                        available > 0 ? 'text-emerald-700' : 'text-slate-400'
                                      }`}
                                    >
                                      {available} متاح
                                    </span>
                                    <span className="block text-[10px] text-slate-400">
                                      ({onHand} فعلي)
                                    </span>
                                  </div>
                                </td>
                              );
                            })}
                            <td className="border border-slate-200 p-3 bg-slate-100/70 font-black text-sm text-slate-900">
                              <span className="text-emerald-800">{colorAvailableTotal}</span> / {colorOnHandTotal}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Individual SKUs List Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Tag className="w-4 h-4 text-purple-600" />
                  <h3 className="text-sm font-black text-slate-900">قائمة أكواد المتغيرات والباركود (SKU Table)</h3>
                </div>
                <span className="text-xs text-slate-500 font-bold">{variants.length} صنف فرعي</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-4">كود الباركود (SKU)</th>
                      <th className="py-2.5 px-4">اللون</th>
                      <th className="py-2.5 px-4">المقاس</th>
                      <th className="py-2.5 px-4 text-center">الرصيد الفعلي</th>
                      <th className="py-2.5 px-4 text-center">المحجوز</th>
                      <th className="py-2.5 px-4 text-center">المتاح للطلب</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {variants.map((v: any) => (
                      <tr key={v.variant_id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-4 font-mono font-bold text-indigo-700">{v.sku}</td>
                        <td className="py-2.5 px-4 font-semibold text-slate-800">{v.color_name}</td>
                        <td className="py-2.5 px-4 font-semibold text-slate-800">{v.size_name}</td>
                        <td className="py-2.5 px-4 text-center font-bold text-slate-900">{v.on_hand_quantity}</td>
                        <td className="py-2.5 px-4 text-center font-bold text-amber-700">{v.reserved_quantity}</td>
                        <td className="py-2.5 px-4 text-center font-black text-emerald-700">
                          {v.available_quantity}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

export default function ProductDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-slate-50 font-sans text-slate-500" dir="rtl">
          جاري تحميل تفاصيل ومصفوفة الموديل...
        </div>
      }
    >
      <ProductDetailContent />
    </Suspense>
  );
}
