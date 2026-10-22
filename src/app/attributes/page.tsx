'use client';

import React, { useState, useEffect } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { Palette, Ruler, Layers, Plus, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

export default function AttributesPage() {
  const [categories, setCategories] = useState<any[]>([]);
  const [colors, setColors] = useState<any[]>([]);
  const [sizes, setSizes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Forms
  const [activeTab, setActiveTab] = useState<'colors' | 'sizes' | 'categories'>('colors');
  const [colorName, setColorName] = useState('');
  const [colorHex, setColorHex] = useState('#2563eb');
  const [sizeName, setSizeName] = useState('');
  const [sizeOrder, setSizeOrder] = useState('10');
  const [catName, setCatName] = useState('');

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchAttributes = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/attributes');
      if (res.ok) {
        const data = await res.json();
        setCategories(data.categories || []);
        setColors(data.colors || []);
        setSizes(data.sizes || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttributes();
  }, []);

  const handleAddColor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!colorName.trim()) return;
    setSubmitting(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/attributes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'color', name: colorName, hex_code: colorHex }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل إضافة اللون');

      setColorName('');
      setSuccess('تمت إضافة اللون بنجاح');
      fetchAttributes();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddSize = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sizeName.trim()) return;
    setSubmitting(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/attributes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'size', name: sizeName, sort_order: Number(sizeOrder) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل إضافة المقاس');

      setSizeName('');
      setSuccess('تمت إضافة المقاس بنجاح');
      fetchAttributes();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) return;
    setSubmitting(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/attributes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'category', name: catName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل إضافة القسم');

      setCatName('');
      setSuccess('تمت إضافة القسم بنجاح');
      fetchAttributes();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppShell
      title="إدارة سمات الملابس (الألوان، المقاسات، الأقسام)"
      subtitle="تكوين دليل الألوان والمقاسات العمرية لملابس الأطفال لمنع التكرار وضبط الترتيب المنطقي"
    >
      <div className="space-y-6">
        {/* Messages */}
        {error && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-bold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{success}</span>
          </div>
        )}

        {/* Tab Selector */}
        <div className="flex items-center gap-2 bg-slate-200/80 p-1.5 rounded-2xl w-fit">
          <button
            onClick={() => { setActiveTab('colors'); setError(''); setSuccess(''); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'colors' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Palette className="w-4 h-4" />
            <span>الألوان ({colors.length})</span>
          </button>
          <button
            onClick={() => { setActiveTab('sizes'); setError(''); setSuccess(''); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'sizes' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Ruler className="w-4 h-4" />
            <span>المقاسات العمرية ({sizes.length})</span>
          </button>
          <button
            onClick={() => { setActiveTab('categories'); setError(''); setSuccess(''); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'categories' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>الأقسام والفئات ({categories.length})</span>
          </button>
        </div>

        {/* Tab 1: Colors */}
        {activeTab === 'colors' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs h-fit space-y-4">
              <h3 className="text-sm font-black text-slate-900">إضافة لون جديد</h3>
              <form onSubmit={handleAddColor} className="space-y-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">اسم اللون (بالعربية) *</label>
                  <input
                    type="text"
                    required
                    value={colorName}
                    onChange={(e) => setColorName(e.target.value)}
                    placeholder="مثال: بترولي"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:bg-white focus:border-indigo-500"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    يتم تطبيع الحروف آلياً لمنع تكرار اللون (أ، إ، ا / ة، ه).
                  </span>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">كود اللون البصري (Hex)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={colorHex}
                      onChange={(e) => setColorHex(e.target.value)}
                      className="w-10 h-10 p-0.5 border border-slate-300 rounded-lg cursor-pointer"
                    />
                    <input
                      type="text"
                      value={colorHex}
                      onChange={(e) => setColorHex(e.target.value)}
                      className="w-24 bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-mono text-center"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Plus className="w-4 h-4" />
                  <span>حفظ اللون في الدليل</span>
                </button>
              </form>
            </div>

            <div className="md:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-xs p-5">
              <h3 className="text-sm font-black text-slate-900 mb-3">دليل الألوان المعتمدة</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {colors.map((c) => (
                  <div
                    key={c.id}
                    className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex items-center gap-3"
                  >
                    <span
                      className="w-5 h-5 rounded-full border border-slate-300 shrink-0 shadow-2xs"
                      style={{ backgroundColor: c.hex_code || '#cbd5e1' }}
                    />
                    <div className="truncate">
                      <span className="block font-bold text-xs text-slate-900 truncate">{c.name}</span>
                      <span className="text-[10px] text-slate-400 font-mono">{c.normalized_name}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Sizes */}
        {activeTab === 'sizes' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs h-fit space-y-4">
              <h3 className="text-sm font-black text-slate-900">إضافة مقاس ملابس جديد</h3>
              <form onSubmit={handleAddSize} className="space-y-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">اسم المقاس *</label>
                  <input
                    type="text"
                    required
                    value={sizeName}
                    onChange={(e) => setSizeName(e.target.value)}
                    placeholder="مثال: 18 شهر، 5 سنوات..."
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:bg-white focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">رقم الترتيب التصاعدي</label>
                  <input
                    type="number"
                    value={sizeOrder}
                    onChange={(e) => setSizeOrder(e.target.value)}
                    placeholder="10"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:bg-white focus:border-indigo-500"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    يستخدم لترتيب المقاسات تصاعدياً بالمصفوفة (من حديث الولادة حتى الأعمار الأكبر).
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Plus className="w-4 h-4" />
                  <span>حفظ المقاس</span>
                </button>
              </form>
            </div>

            <div className="md:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-xs p-5">
              <h3 className="text-sm font-black text-slate-900 mb-3">دليل المقاسات مرتبة تصاعدياً</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {sizes.map((s) => (
                  <div
                    key={s.id}
                    className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between"
                  >
                    <span className="font-bold text-xs text-slate-900">{s.name}</span>
                    <span className="px-2 py-0.5 rounded-md bg-slate-200 text-slate-700 text-[10px] font-bold">
                      ترتيب #{s.sort_order}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Categories */}
        {activeTab === 'categories' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs h-fit space-y-4">
              <h3 className="text-sm font-black text-slate-900">إضافة قسم / فئة جديدة</h3>
              <form onSubmit={handleAddCategory} className="space-y-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">اسم القسم / التصنيف *</label>
                  <input
                    type="text"
                    required
                    value={catName}
                    onChange={(e) => setCatName(e.target.value)}
                    placeholder="مثال: بيبي، شتوي، قطنيات..."
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:bg-white focus:border-indigo-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Plus className="w-4 h-4" />
                  <span>حفظ القسم</span>
                </button>
              </form>
            </div>

            <div className="md:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-xs p-5">
              <h3 className="text-sm font-black text-slate-900 mb-3">الأقسام والفئات المعتمدة</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {categories.map((c) => (
                  <div
                    key={c.id}
                    className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex items-center gap-2"
                  >
                    <Layers className="w-4 h-4 text-indigo-600 shrink-0" />
                    <span className="font-bold text-xs text-slate-900">{c.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
