'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import {
  Layers,
  Search,
  Plus,
  Filter,
  Eye,
  PlusCircle,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Grid,
} from 'lucide-react';

export default function ProductsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<number | ''>('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // New Product Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modelCode, setModelCode] = useState('');
  const [modelName, setModelName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [defaultPrice, setDefaultPrice] = useState('');
  const [description, setDescription] = useState('');
  const [modalError, setModalError] = useState('');
  const [modalLoading, setModalLoading] = useState(false);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: String(page),
        limit: '25',
        search: search.trim(),
      });
      if (selectedCategory) params.append('categoryId', String(selectedCategory));

      const res = await fetch(`/api/products?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setProducts(data.items);
        setTotalPages(data.totalPages || 1);
        setTotalCount(data.total || 0);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/attributes');
      if (res.ok) {
        const data = await res.json();
        setCategories(data.categories || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [page, selectedCategory]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchProducts();
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError('');
    setModalLoading(true);

    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model_code: modelCode,
          model_name: modelName,
          category_id: categoryId ? Number(categoryId) : null,
          default_price: Number(defaultPrice || 0),
          description,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'فشل إنشاء الموديل');
      }

      setIsModalOpen(false);
      setModelCode('');
      setModelName('');
      setDefaultPrice('');
      setDescription('');
      fetchProducts();
    } catch (err: any) {
      setModalError(err.message);
    } finally {
      setModalLoading(false);
    }
  };

  return (
    <AppShell
      title="كتالوج الموديلات والأصناف"
      subtitle="إدارة موديلات ملابس الأطفال، كود الموديل المستقر، والكميات الإجمالية المحسوبة آلياً"
    >
      <div className="space-y-6">
        {/* Top Control Bar */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
          <form onSubmit={handleSearchSubmit} className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
            <div className="relative flex-1 min-w-[200px]">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="بحث بكود الموديل (مثال: K101) أو اسم الصنف..."
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 pr-10 text-sm focus:outline-none focus:border-indigo-500 focus:bg-white transition-colors"
              />
              <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
            </div>

            <div className="w-48">
              <select
                value={selectedCategory}
                onChange={(e) => {
                  setSelectedCategory(e.target.value ? Number(e.target.value) : '');
                  setPage(1);
                }}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:border-indigo-500"
              >
                <option value="">كافة الأقسام والفئات</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-sm font-bold transition-colors cursor-pointer"
            >
              بحث
            </button>
          </form>

          <div className="flex items-center gap-3">
            <Link
              href="/products/bulk-variants"
              className="flex items-center gap-2 px-4 py-2.5 bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 rounded-xl text-sm font-bold transition-colors"
            >
              <Grid className="w-4 h-4" />
              <span>مُوَلّد المتغيرات المجمع</span>
            </Link>

            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-sm transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة موديل جديد</span>
            </button>
          </div>
        </div>

        {/* Models List Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <span className="text-xs font-black text-slate-700">
              إجمالي الموديلات المعروضة: {totalCount.toLocaleString('ar-EG')} موديل
            </span>
            <span className="text-xs text-slate-500">صفحة {page} من {totalPages}</span>
          </div>

          {loading ? (
            <div className="py-20 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-500">جارٍ جلب الموديلات وحساب أرصدتها...</p>
            </div>
          ) : products.length === 0 ? (
            <div className="py-20 text-center">
              <Layers className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-700">لا توجد موديلات مطابقة</h3>
              <p className="text-xs text-slate-500 mt-1">
                يمكنك إضافة موديل جديد أو استيراد ملف إكسيل كامل للموديلات.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">كود الموديل</th>
                    <th className="py-3 px-4">اسم الموديل</th>
                    <th className="py-3 px-4">القسم / الفئة</th>
                    <th className="py-3 px-4">السعر الافتراضي</th>
                    <th className="py-3 px-4 text-center">عدد المتغيرات (SKUs)</th>
                    <th className="py-3 px-4 text-center">الرصيد الفعلي</th>
                    <th className="py-3 px-4 text-center">المتاح للطلب</th>
                    <th className="py-3 px-4 text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {products.map((p) => {
                    const hasVariants = Number(p.total_variants) > 0;
                    return (
                      <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-black text-sm text-indigo-700">
                          {p.model_code}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-slate-900">
                          {p.model_name}
                          {p.description && (
                            <span className="block text-[11px] text-slate-400 font-normal truncate max-w-xs">
                              {p.description}
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 font-semibold text-[11px]">
                            {p.category_name || 'عام'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-bold text-slate-800">
                          {Number(p.default_price).toLocaleString('ar-EG')} ج.م
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          {hasVariants ? (
                            <span className="px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200 font-bold">
                              {p.total_variants} متغير
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 font-bold text-[10px]">
                              بدون متغيرات
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-center font-black text-sm text-slate-900">
                          {Number(p.total_physical_stock).toLocaleString('ar-EG')}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span
                            className={`font-black text-sm ${
                              Number(p.total_available_stock) > 0 ? 'text-emerald-700' : 'text-slate-400'
                            }`}
                          >
                            {Number(p.total_available_stock).toLocaleString('ar-EG')}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <Link
                              href={`/products/${p.id}`}
                              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold transition-colors"
                              title="عرض مصفوفة الموديل"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>المصفوفة</span>
                            </Link>

                            <Link
                              href={`/products/bulk-variants?productId=${p.id}`}
                              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                              title="توليد ألوان ومقاسات للموديل"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-4 py-2 rounded-xl bg-white border border-slate-300 font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
              >
                الصفحة السابقة
              </button>
              <span className="font-bold text-slate-600">
                صفحة {page} من {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-4 py-2 rounded-xl bg-white border border-slate-300 font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
              >
                الصفحة التالية
              </button>
            </div>
          )}
        </div>
      </div>

      {/* New Product Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-black text-slate-900 text-lg">إضافة موديل ملابس جديد</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {modalError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleCreateProduct} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">كود الموديل (فريد) *</label>
                  <input
                    type="text"
                    required
                    value={modelCode}
                    onChange={(e) => setModelCode(e.target.value.toUpperCase())}
                    placeholder="مثال: K101"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-mono font-bold text-slate-900 focus:bg-white focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">سعر البيع الافتراضي (ج.م)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={defaultPrice}
                    onChange={(e) => setDefaultPrice(e.target.value)}
                    placeholder="180"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:bg-white focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">اسم الموديل / الوصف المختصر *</label>
                <input
                  type="text"
                  required
                  value={modelName}
                  onChange={(e) => setModelName(e.target.value)}
                  placeholder="مثال: سالوبيت قطن صيفي مطرز"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:bg-white focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">القسم / الفئة</label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-800 focus:bg-white focus:border-indigo-500"
                >
                  <option value="">اختر القسم (ولادي، بناتي، حديث ولادة...)</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">ملاحظات إضافية (اختياري)</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="نوع القماش، المواصفات..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:bg-white focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={modalLoading}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {modalLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>حفظ الموديل</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
