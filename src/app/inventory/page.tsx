'use client';

import React, { useState, useEffect } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import {
  Warehouse,
  Search,
  Filter,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  SlidersHorizontal,
  History,
  Loader2,
  TrendingDown,
  Clock,
} from 'lucide-react';

export default function InventoryPage() {
  const [items, setItems] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [stockStatus, setStockStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Adjustment Modal
  const [selectedVariant, setSelectedVariant] = useState<any>(null);
  const [newQuantity, setNewQuantity] = useState('');
  const [adjustmentReason, setAdjustmentReason] = useState('');
  const [adjustError, setAdjustError] = useState('');
  const [adjustSuccess, setAdjustSuccess] = useState('');
  const [adjusting, setAdjusting] = useState(false);

  const fetchInventory = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: String(page),
        limit: '50',
        search: search.trim(),
        stockStatus,
      });
      if (categoryId) params.append('categoryId', categoryId);

      const res = await fetch(`/api/inventory?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.items);
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
    fetch('/api/attributes')
      .then((r) => r.json())
      .then((d) => setCategories(d.categories || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchInventory();
  }, [page, categoryId, stockStatus]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchInventory();
  };

  const handleExportExcel = () => {
    const params = new URLSearchParams({
      search: search.trim(),
      stockStatus,
    });
    if (categoryId) params.append('categoryId', categoryId);
    window.open(`/api/inventory/export?${params.toString()}`, '_blank');
  };

  const handleOpenAdjustment = (item: any) => {
    setSelectedVariant(item);
    setNewQuantity(String(item.on_hand_quantity));
    setAdjustmentReason('');
    setAdjustError('');
    setAdjustSuccess('');
  };

  const handleSaveAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustmentReason.trim()) {
      setAdjustError('سبب التسوية إلزامي للمساءلة الرقابية.');
      return;
    }
    const qty = Number(newQuantity);
    if (isNaN(qty) || qty < 0) {
      setAdjustError('الكمية يجب أن تكون رقماً غير سالب.');
      return;
    }

    setAdjusting(true);
    setAdjustError('');

    try {
      const res = await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: adjustmentReason.trim(),
          items: [{ variantId: selectedVariant.variant_id, newQuantity: qty }],
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل تطبيق التسوية المخزنية');

      setAdjustSuccess(`تم بنجاح تطبيق التسوية برقم (${data.adjustmentNumber}).`);
      setTimeout(() => {
        setSelectedVariant(null);
        fetchInventory();
      }, 1500);
    } catch (err: any) {
      setAdjustError(err.message);
    } finally {
      setAdjusting(false);
    }
  };

  return (
    <AppShell
      title="إدارة المخزون والأرصدة اللحظية"
      subtitle="متابعة دقيقة للأرصدة الفعلية والمحجوزة والمتاحة لكل متغير ومقاس ولون"
    >
      <div className="space-y-6">
        {/* Filter & Export Bar */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
          <form onSubmit={handleSearchSubmit} className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
            <div className="relative flex-1 min-w-[220px]">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="بحث بكود الموديل، الباركود، اللون، أو المقاس..."
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 pr-10 text-sm focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
              />
              <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
            </div>

            <div className="w-44">
              <select
                value={categoryId}
                onChange={(e) => {
                  setCategoryId(e.target.value);
                  setPage(1);
                }}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-xs text-slate-800 focus:border-indigo-500"
              >
                <option value="">كافة الأقسام</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="w-44">
              <select
                value={stockStatus}
                onChange={(e) => {
                  setStockStatus(e.target.value);
                  setPage(1);
                }}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-xs text-slate-800 focus:border-indigo-500 font-bold"
              >
                <option value="all">كافة حالات الرصيد</option>
                <option value="in_stock">المتوفر في المخزن (&gt; 0)</option>
                <option value="low_stock">أوشك على النفاد (حد الطلب)</option>
                <option value="out_of_stock">النافد تماماً (رصيد 0)</option>
              </select>
            </div>

            <button
              type="submit"
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              تصفية
            </button>
          </form>

          <div>
            <button
              onClick={handleExportExcel}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>تصدير النتائج إلى إكسيل</span>
            </button>
          </div>
        </div>

        {/* Inventory Items Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
            <span className="font-black text-slate-800">
              إجمالي الأصناف الفرعية (Variants): {totalCount.toLocaleString('ar-EG')}
            </span>
            <span className="text-slate-500">
              صفحة {page} من {totalPages}
            </span>
          </div>

          {loading ? (
            <div className="py-24 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-500">جارٍ قراءة أرصدة المخزن...</p>
            </div>
          ) : items.length === 0 ? (
            <div className="py-20 text-center">
              <Warehouse className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-slate-700">لا توجد نتائج مطابقة لبحث المخزون</h3>
              <p className="text-xs text-slate-400 mt-1">تأكد من شروط التصفية أو أعد تعيينها</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">كود الموديل</th>
                    <th className="py-3 px-4">اسم الموديل</th>
                    <th className="py-3 px-4">اللون</th>
                    <th className="py-3 px-4">المقاس</th>
                    <th className="py-3 px-4">الباركود (SKU)</th>
                    <th className="py-3 px-4 text-center">الرصيد الفعلي</th>
                    <th className="py-3 px-4 text-center">المحجوز</th>
                    <th className="py-3 px-4 text-center">المتاح للطلب</th>
                    <th className="py-3 px-4 text-center">حد الطلب</th>
                    <th className="py-3 px-4 text-center">إجراء التسوية</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item) => {
                    const isOutOfStock = Number(item.available_quantity) <= 0;
                    const isLowStock =
                      !isOutOfStock && Number(item.available_quantity) <= Number(item.min_stock_threshold);

                    return (
                      <tr key={item.variant_id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 font-mono font-black text-indigo-700">
                          {item.model_code}
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-900">{item.model_name}</td>
                        <td className="py-3 px-4 font-semibold text-slate-800">{item.color_name}</td>
                        <td className="py-3 px-4 font-semibold text-slate-800">{item.size_name}</td>
                        <td className="py-3 px-4 font-mono text-[11px] text-slate-500">{item.sku}</td>
                        <td className="py-3 px-4 text-center font-bold text-sm text-slate-900">
                          {item.on_hand_quantity}
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-sm text-amber-700">
                          {item.reserved_quantity}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`font-black text-sm px-2 py-0.5 rounded-md ${
                              isOutOfStock
                                ? 'bg-rose-100 text-rose-800'
                                : isLowStock
                                ? 'bg-amber-100 text-amber-800'
                                : 'text-emerald-800'
                            }`}
                          >
                            {item.available_quantity}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center text-slate-500 font-mono">
                          {item.min_stock_threshold}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => handleOpenAdjustment(item)}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-[11px] transition-colors cursor-pointer"
                          >
                            تسوية جرد
                          </button>
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

      {/* Stock Adjustment Modal */}
      {selectedVariant && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-black text-slate-900 text-base">تسوية جرد مخزني معتمدة</h3>
              <button
                onClick={() => setSelectedVariant(null)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            {adjustError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{adjustError}</span>
              </div>
            )}
            {adjustSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{adjustSuccess}</span>
              </div>
            )}

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
              <p className="font-bold text-slate-900">
                {selectedVariant.model_code} - {selectedVariant.model_name}
              </p>
              <p className="text-slate-600">
                اللون: <strong>{selectedVariant.color_name}</strong> • المقاس: <strong>{selectedVariant.size_name}</strong>
              </p>
              <div className="pt-1 flex items-center justify-between text-slate-500 text-[11px]">
                <span>الرصيد الفعلي الحالي: <strong>{selectedVariant.on_hand_quantity}</strong></span>
                <span>المحجوز للطلبات: <strong>{selectedVariant.reserved_quantity}</strong></span>
              </div>
            </div>

            <form onSubmit={handleSaveAdjustment} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  الرصيد الفعلي الجديد بعد الجرد (قطع) *
                </label>
                <input
                  type="number"
                  min={selectedVariant.reserved_quantity}
                  required
                  value={newQuantity}
                  onChange={(e) => setNewQuantity(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-bold text-base focus:bg-white focus:border-indigo-500"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  لا يمكن للرصيد الفعلي أن يقل عن الكمية المحجوزة حالياً ({selectedVariant.reserved_quantity}).
                </span>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  سبب التسوية المخزنية الإلزامي *
                </label>
                <textarea
                  rows={3}
                  required
                  value={adjustmentReason}
                  onChange={(e) => setAdjustmentReason(e.target.value)}
                  placeholder="مثال: جرد سنوي، تصحيح خطأ إدخال سابق، عجز أثناء الرص..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:bg-white focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedVariant(null)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={adjusting}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {adjusting && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>اعتماد وتسجيل التسوية</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
