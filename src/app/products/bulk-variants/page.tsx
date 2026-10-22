'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import {
  Grid,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  Sparkles,
  Layers,
  Palette,
  Maximize2,
} from 'lucide-react';

function BulkVariantsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedProductId = searchParams.get('productId') || '';

  const [products, setProducts] = useState<any[]>([]);
  const [colors, setColors] = useState<any[]>([]);
  const [sizes, setSizes] = useState<any[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>(preselectedProductId);
  const [selectedColors, setSelectedColors] = useState<number[]>([]);
  const [selectedSizes, setSelectedSizes] = useState<number[]>([]);
  const [excludedCombos, setExcludedCombos] = useState<Set<string>>(new Set());

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/products?limit=1000').then((r) => r.json()),
      fetch('/api/attributes').then((r) => r.json()),
    ])
      .then(([prodData, attrData]) => {
        setProducts(prodData.items || []);
        setColors(attrData.colors || []);
        setSizes(attrData.sizes || []);
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const handleToggleColor = (id: number) => {
    setSelectedColors((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const handleToggleSize = (id: number) => {
    setSelectedSizes((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const toggleExclude = (key: string) => {
    setExcludedCombos((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Generate preview combinations
  const combinations: { key: string; color: any; size: any }[] = [];
  if (selectedColors.length > 0 && selectedSizes.length > 0) {
    for (const colorId of selectedColors) {
      const col = colors.find((c) => c.id === colorId);
      for (const sizeId of selectedSizes) {
        const sz = sizes.find((s) => s.id === sizeId);
        if (col && sz) {
          combinations.push({
            key: `${colorId}_${sizeId}`,
            color: col,
            size: sz,
          });
        }
      }
    }
  }

  const activeCombinationsCount = combinations.length - excludedCombos.size;

  const handleSubmit = async () => {
    if (!selectedProductId) {
      setMessage({ text: 'يرجى اختيار الموديل أولاً.', type: 'error' });
      return;
    }
    if (combinations.length === 0) {
      setMessage({ text: 'يرجى اختيار لون واحد ومقاس واحد على الأقل.', type: 'error' });
      return;
    }
    if (activeCombinationsCount === 0) {
      setMessage({ text: 'لقد قمت باستبعاد جميع التركيبات المعروضة.', type: 'error' });
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      const res = await fetch('/api/products/bulk-variants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: Number(selectedProductId),
          colorIds: selectedColors,
          sizeIds: selectedSizes,
          excludedKeys: Array.from(excludedCombos),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل توليد المتغيرات');

      setMessage({
        text: `تم بنجاح إنشاء ${data.createdCount} متغير جديد للموديل (تم تخطي ${data.skippedCount} تركيبة مسبقة أو مستبعدة). لم يتم إضافة أي رصيد مخزني آلياً حفاظاً على دقة الجرد.`,
        type: 'success',
      });

      // Reset selection
      setTimeout(() => {
        router.push(`/products/${selectedProductId}`);
      }, 1800);
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const selectedProduct = products.find((p) => String(p.id) === String(selectedProductId));

  return (
    <AppShell
      title="مُوَلّد المتغيرات المجمع (Bulk Variant Generator)"
      subtitle="توليد تركيبات الألوان والمقاسات للموديل دفعة واحدة مع استبعاد ما لا يتوفر فعلياً"
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Link
            href="/products"
            className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors"
          >
            <ArrowRight className="w-4 h-4" />
            <span>العودة لكتالوج الموديلات</span>
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

        {/* Step 1: Select Model */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold">
              1
            </span>
            <h3 className="text-sm font-black text-slate-900">اختر الموديل المطلوب توليد مقاسات وألوان له</h3>
          </div>

          <div className="max-w-md">
            <select
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-800 focus:bg-white focus:border-indigo-500"
            >
              <option value="">-- اضغط لاختيار الموديل --</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.model_code} - {p.model_name}
                </option>
              ))}
            </select>
          </div>

          {selectedProduct && (
            <div className="p-3 rounded-xl bg-indigo-50/70 border border-indigo-200/60 text-xs text-indigo-900 flex items-center gap-4">
              <span>كود: <strong>{selectedProduct.model_code}</strong></span>
              <span>اسم: <strong>{selectedProduct.model_name}</strong></span>
              <span>السعر: <strong>{selectedProduct.default_price} ج.م</strong></span>
              <span>المتغيرات الحالية: <strong>{selectedProduct.total_variants}</strong></span>
            </div>
          )}
        </div>

        {/* Step 2 & 3: Colors & Sizes Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Colors Selection */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold">
                  2
                </span>
                <h3 className="text-sm font-black text-slate-900">حدد الألوان المتاحة للموديل</h3>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setSelectedColors(colors.map((c) => c.id))}
                  className="text-indigo-600 font-bold hover:underline cursor-pointer"
                >
                  تحديد الكل
                </button>
                <span>•</span>
                <button
                  type="button"
                  onClick={() => setSelectedColors([])}
                  className="text-slate-400 font-bold hover:underline cursor-pointer"
                >
                  إلغاء التحديد
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-56 overflow-y-auto p-1">
              {colors.map((c) => {
                const isSelected = selectedColors.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleToggleColor(c.id)}
                    className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-between transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-50 border-indigo-500 text-indigo-950 shadow-xs'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      {c.hex_code && (
                        <span
                          className="w-3.5 h-3.5 rounded-full border border-slate-300 shrink-0"
                          style={{ backgroundColor: c.hex_code }}
                        />
                      )}
                      <span className="truncate">{c.name}</span>
                    </div>
                    {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-slate-400">
              تم تحديد {selectedColors.length} لون
            </p>
          </div>

          {/* Sizes Selection */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold">
                  3
                </span>
                <h3 className="text-sm font-black text-slate-900">حدد المقاسات المتاحة للموديل</h3>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setSelectedSizes(sizes.map((s) => s.id))}
                  className="text-indigo-600 font-bold hover:underline cursor-pointer"
                >
                  تحديد الكل
                </button>
                <span>•</span>
                <button
                  type="button"
                  onClick={() => setSelectedSizes([])}
                  className="text-slate-400 font-bold hover:underline cursor-pointer"
                >
                  إلغاء التحديد
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-56 overflow-y-auto p-1">
              {sizes.map((s) => {
                const isSelected = selectedSizes.includes(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => handleToggleSize(s.id)}
                    className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-between transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-purple-50 border-purple-500 text-purple-950 shadow-xs'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span className="truncate">{s.name}</span>
                    {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-purple-600 shrink-0" />}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-slate-400">
              تم تحديد {selectedSizes.length} مقاس
            </p>
          </div>
        </div>

        {/* Step 4: Combinations Preview & Exclusion */}
        {combinations.length > 0 && (
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-black text-slate-900">
                  معاينة التركيبات واستبعاد المقاسات أو الألوان غير الموجودة فعلياً
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  انقر على أي تركيبة لإلغاء تفعيلها إذا كان المصنع لم يُنتج هذا اللون بهذا المقاس
                </p>
              </div>
              <div className="text-xs font-bold px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700">
                سيتم إنشاء: <strong>{activeCombinationsCount}</strong> من إجمالي {combinations.length} تركيبة
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5 max-h-72 overflow-y-auto p-1">
              {combinations.map((c) => {
                const isExcluded = excludedCombos.has(c.key);
                return (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => toggleExclude(c.key)}
                    className={`p-2.5 rounded-xl border text-xs font-bold text-center transition-all cursor-pointer ${
                      isExcluded
                        ? 'bg-slate-100 border-slate-200 text-slate-400 line-through opacity-60'
                        : 'bg-emerald-50 border-emerald-400 text-emerald-950 shadow-2xs hover:bg-emerald-100'
                    }`}
                  >
                    <span className="block font-bold">{c.color.name}</span>
                    <span className="block text-[11px] mt-0.5 opacity-80">{c.size.name}</span>
                  </button>
                );
              })}
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                تنبيه: إنشاء المتغيرات لا يضيف رصيداً مخزنياً. يتم إدخال الرصيد عبر أذونات الاستلام أو الاستيراد.
              </span>

              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting || activeCombinationsCount === 0}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>جارٍ الإنشاء...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>تأكيد إنشاء {activeCombinationsCount} متغير</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

export default function BulkVariantsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-slate-50 font-sans text-slate-500" dir="rtl">
          جاري تحميل مولد المتغيرات...
        </div>
      }
    >
      <BulkVariantsContent />
    </Suspense>
  );
}
