'use client';

import React, { useState, useEffect } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import {
  Layers,
  Plus,
  Search,
  Warehouse,
  FolderTree,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Boxes,
  MapPin,
  Tag,
  X,
} from 'lucide-react';

export default function WarehouseShelvesPage() {
  const [shelves, setShelves] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // New Shelf Modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [shelfCode, setShelfCode] = useState('');
  const [aisle, setAisle] = useState('');
  const [rack, setRack] = useState('');
  const [binCarton, setBinCarton] = useState('');
  const [notes, setNotes] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');

  // Edit Shelf Modal
  const [editingShelf, setEditingShelf] = useState<any>(null);
  const [editShelfCode, setEditShelfCode] = useState('');
  const [editAisle, setEditAisle] = useState('');
  const [editRack, setEditRack] = useState('');
  const [editBinCarton, setEditBinCarton] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');

  // Shelf Items Modal
  const [selectedShelfForItems, setSelectedShelfForItems] = useState<any>(null);
  const [shelfItems, setShelfItems] = useState<any[]>([]);
  const [shelfItemsLoading, setShelfItemsLoading] = useState(false);
  const [shelfItemsError, setShelfItemsError] = useState('');

  // Assign Variant Form
  const [assignSearch, setAssignSearch] = useState('');
  const [assignableVariants, setAssignableVariants] = useState<any[]>([]);
  const [isSearchingVariants, setIsSearchingVariants] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState<any>(null);
  const [assignQuantity, setAssignQuantity] = useState('0');
  const [isPrimaryShelf, setIsPrimaryShelf] = useState(true);
  const [assignSubmitting, setAssignSubmitting] = useState(false);
  const [assignSuccess, setAssignSuccess] = useState('');

  const fetchShelves = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/shelves?search=${encodeURIComponent(search.trim())}`);
      if (res.ok) {
        const data = await res.json();
        setShelves(data.shelves || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const openShelfItems = async (shelf: any) => {
    setSelectedShelfForItems(shelf);
    setShelfItemsLoading(true);
    setShelfItemsError('');
    setSelectedVariant(null);
    setAssignQuantity('0');
    setAssignSearch('');
    setAssignSuccess('');
    try {
      const res = await fetch(`/api/shelves/${shelf.id}/variants`);
      if (res.ok) {
        const data = await res.json();
        setShelfItems(data.variants || []);
      } else {
        const err = await res.json();
        setShelfItemsError(err.error || 'فشل تحميل الأصناف المسكنة');
      }
    } catch (e: any) {
      setShelfItemsError(e.message);
    } finally {
      setShelfItemsLoading(false);
    }
  };

  const searchAssignable = async (term: string) => {
    setAssignSearch(term);
    if (!term.trim()) {
      setAssignableVariants([]);
      return;
    }
    setIsSearchingVariants(true);
    try {
      const res = await fetch(`/api/variants/assignable?search=${encodeURIComponent(term.trim())}`);
      if (res.ok) {
        const data = await res.json();
        setAssignableVariants(data.variants || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSearchingVariants(false);
    }
  };

  const handleAssignVariant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedShelfForItems || !selectedVariant) return;
    setAssignSubmitting(true);
    setShelfItemsError('');
    setAssignSuccess('');
    try {
      const res = await fetch(`/api/shelves/${selectedShelfForItems.id}/variants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          variant_id: selectedVariant.variant_id,
          quantity: parseInt(assignQuantity, 10) || 0,
          is_primary: isPrimaryShelf,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل تسكين الصنف');

      setAssignSuccess(`تم تسكين الموديل (${selectedVariant.model_code}) بنجاح!`);
      setSelectedVariant(null);
      setAssignSearch('');
      setAssignableVariants([]);
      setAssignQuantity('0');

      // Refresh shelf items & shelf table
      openShelfItems(selectedShelfForItems);
      fetchShelves();
    } catch (err: any) {
      setShelfItemsError(err.message);
    } finally {
      setAssignSubmitting(false);
    }
  };

  const handleRemoveVariant = async (variantId: number, modelCode: string) => {
    if (!confirm(`هل أنت متأكد من إلغاء تسكين الموديل (${modelCode}) من هذا الرف؟`)) return;
    try {
      const res = await fetch(`/api/shelves/${selectedShelfForItems.id}/variants?variantId=${variantId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'فشل حذف التسكين');
      }
      openShelfItems(selectedShelfForItems);
      fetchShelves();
    } catch (err: any) {
      alert(err.message);
    }
  };

  useEffect(() => {
    fetchShelves();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateLoading(true);
    setCreateError('');

    try {
      const res = await fetch('/api/shelves', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shelf_code: shelfCode,
          aisle,
          rack,
          bin_carton: binCarton,
          notes,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل إضافة الرف');

      setIsCreateOpen(false);
      setShelfCode('');
      setAisle('');
      setRack('');
      setBinCarton('');
      setNotes('');
      fetchShelves();
    } catch (err: any) {
      setCreateError(err.message);
    } finally {
      setCreateLoading(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingShelf) return;
    setEditLoading(true);
    setEditError('');

    try {
      const res = await fetch(`/api/shelves/${editingShelf.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shelf_code: editShelfCode,
          aisle: editAisle,
          rack: editRack,
          bin_carton: editBinCarton,
          notes: editNotes,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل تعديل الرف');

      setEditingShelf(null);
      fetchShelves();
    } catch (err: any) {
      setEditError(err.message);
    } finally {
      setEditLoading(false);
    }
  };

  const handleDelete = async (id: number, code: string) => {
    if (!confirm(`هل أنت متأكد من حذف الرف التخزيني (${code})؟`)) return;
    try {
      const res = await fetch(`/api/shelves/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل حذف الرف');
      fetchShelves();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const totalPieces = shelves.reduce((acc, s) => acc + (s.total_pieces || 0), 0);
  const activeShelves = shelves.filter((s) => s.assigned_variants_count > 0).length;

  return (
    <AppShell
      title="إدارة الأرفف والمواقع التخزينية"
      subtitle="تكوين أرفف وممرات المستودع وربط موديلات الأطفال بمواقعها لتسهيل الالتقاط والجرد"
    >
      <div className="space-y-6">
        {/* KPI Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <span className="text-slate-500 text-xs font-bold">إجمالي الأرفف التخزينية</span>
            <div className="mt-2 text-2xl font-black text-slate-900">{shelves.length}</div>
            <div className="mt-1 text-[11px] text-slate-400">مواقع محددة بالمستودع</div>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <span className="text-slate-500 text-xs font-bold">أرفف مشغولة بأصناف</span>
            <div className="mt-2 text-2xl font-black text-indigo-600">{activeShelves}</div>
            <div className="mt-1 text-[11px] text-indigo-700 font-bold">
              {shelves.length > 0 ? `${Math.round((activeShelves / shelves.length) * 100)}% نسبة الإشغال` : '0%'}
            </div>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <span className="text-slate-500 text-xs font-bold">أرفف شاغرة</span>
            <div className="mt-2 text-2xl font-black text-emerald-600">
              {shelves.length - activeShelves}
            </div>
            <div className="mt-1 text-[11px] text-slate-400">جاهزة لتخزين بضاعة جديدة</div>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <span className="text-slate-500 text-xs font-bold">إجمالي القطع على الأرفف</span>
            <div className="mt-2 text-2xl font-black text-amber-600">{totalPieces}</div>
            <div className="mt-1 text-[11px] text-slate-400">قطعة موزعة موقعياً</div>
          </div>
        </div>

        {/* Search and Action Bar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              fetchShelves();
            }}
            className="flex items-center gap-2 flex-1 max-w-md"
          >
            <div className="relative flex-1">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="بحث بكود الرف (مثل A-01-01) أو الممر أو العمود..."
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2 pr-10 text-xs focus:bg-white focus:border-indigo-500"
              />
              <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-2.5" />
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              بحث
            </button>
          </form>

          <button
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة رف تخزيني جديد</span>
          </button>
        </div>

        {/* Shelves List Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-700 flex items-center justify-between">
            <span>دليل مواقع التخزين والأرفف ({shelves.length} موقع)</span>
            <span className="text-slate-500">المستودع الرئيسي: MAIN</span>
          </div>

          {loading ? (
            <div className="py-20 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-500">جارٍ قراءة خريطة الأرفف...</p>
            </div>
          ) : shelves.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-xs">
              <Warehouse className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p>لا توجد أرفف مسجلة مطابقة للبحث.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">كود الرف</th>
                    <th className="py-3 px-4">الممر (Aisle)</th>
                    <th className="py-3 px-4">العمود / الاستاند (Rack)</th>
                    <th className="py-3 px-4">الصندوق / الكرتونة</th>
                    <th className="py-3 px-4 text-center">الموديلات المسكنة</th>
                    <th className="py-3 px-4 text-center">القطع بالرف</th>
                    <th className="py-3 px-4">ملاحظات</th>
                    <th className="py-3 px-4 text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {shelves.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4">
                        <span className="font-mono font-black text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-lg text-xs">
                          {s.shelf_code}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-800">{s.aisle || '—'}</td>
                      <td className="py-3 px-4 text-slate-700">{s.rack || '—'}</td>
                      <td className="py-3 px-4 text-slate-600">{s.bin_carton || '—'}</td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`px-2.5 py-0.5 rounded-full font-bold text-[11px] ${
                            s.assigned_variants_count > 0
                              ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {s.assigned_variants_count} متغير
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-bold">
                        <span
                          className={s.total_pieces > 0 ? 'text-emerald-700 font-black' : 'text-slate-400'}
                        >
                          {s.total_pieces} قطعة
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-400 text-[11px] truncate max-w-xs">
                        {s.notes || '—'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => openShelfItems(s)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                            title="عرض وتسكين الأصناف على هذا الرف"
                          >
                            <Boxes className="w-3.5 h-3.5" />
                            <span>تسكين الأصناف</span>
                          </button>
                          <button
                            onClick={() => {
                              setEditingShelf(s);
                              setEditShelfCode(s.shelf_code);
                              setEditAisle(s.aisle || '');
                              setEditRack(s.rack || '');
                              setEditBinCarton(s.bin_carton || '');
                              setEditNotes(s.notes || '');
                            }}
                            className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
                            title="تعديل الرف"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(s.id, s.shelf_code)}
                            className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-100 transition-colors cursor-pointer"
                            title="حذف الرف"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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

      {/* Create Shelf Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-black text-slate-900 text-base">إضافة موقع تخزيني / رف جديد</h3>
              <button onClick={() => setIsCreateOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold">
                ✕
              </button>
            </div>

            {createError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{createError}</span>
              </div>
            )}

            <form onSubmit={handleCreate} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  كود الرف (Shelf Code) * (مثال: A-01-03 أو RACK-04-SHELF-02)
                </label>
                <input
                  type="text"
                  required
                  value={shelfCode}
                  onChange={(e) => setShelfCode(e.target.value)}
                  placeholder="A-01-03"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-mono font-bold text-slate-900 uppercase focus:bg-white focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">الممر (اختياري)</label>
                  <input
                    type="text"
                    value={aisle}
                    onChange={(e) => setAisle(e.target.value)}
                    placeholder="A"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:bg-white focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">العمود (اختياري)</label>
                  <input
                    type="text"
                    value={rack}
                    onChange={(e) => setRack(e.target.value)}
                    placeholder="01"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:bg-white focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">الصندوق (اختياري)</label>
                  <input
                    type="text"
                    value={binCarton}
                    onChange={(e) => setBinCarton(e.target.value)}
                    placeholder="03"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:bg-white focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">ملاحظات إضافية</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="مخصص للسالوبيت والقطنيات الصيفي..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:bg-white focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={createLoading}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {createLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>حفظ الرف</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Shelf Modal */}
      {editingShelf && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-black text-slate-900 text-base">تعديل بيانات الرف التخزيني</h3>
              <button onClick={() => setEditingShelf(null)} className="text-slate-400 hover:text-slate-600 font-bold">
                ✕
              </button>
            </div>

            {editError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{editError}</span>
              </div>
            )}

            <form onSubmit={handleUpdate} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">كود الرف *</label>
                <input
                  type="text"
                  required
                  value={editShelfCode}
                  onChange={(e) => setEditShelfCode(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-mono font-bold text-slate-900 uppercase focus:bg-white focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">الممر</label>
                  <input
                    type="text"
                    value={editAisle}
                    onChange={(e) => setEditAisle(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:bg-white focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">العمود</label>
                  <input
                    type="text"
                    value={editRack}
                    onChange={(e) => setEditRack(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:bg-white focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">الصندوق</label>
                  <input
                    type="text"
                    value={editBinCarton}
                    onChange={(e) => setEditBinCarton(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:bg-white focus:border-indigo-500"
                  />
                </div>
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
                  onClick={() => setEditingShelf(null)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {editLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>حفظ التعديلات</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Shelf Variants Management Modal */}
      {selectedShelfForItems && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-4xl w-full p-6 shadow-2xl max-h-[92vh] overflow-y-auto space-y-6 text-xs">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-2xl">
                  <Boxes className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-black text-slate-900">
                      إدارة وتسكين الأصناف على الرف
                    </h3>
                    <span className="font-mono font-black text-indigo-700 bg-indigo-100/70 border border-indigo-300 px-3 py-0.5 rounded-lg text-sm">
                      {selectedShelfForItems.shelf_code}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-500 font-bold">
                    <span>الممر: {selectedShelfForItems.aisle || '—'}</span>
                    <span>•</span>
                    <span>الاستاند: {selectedShelfForItems.rack || '—'}</span>
                    <span>•</span>
                    <span>الصندوق: {selectedShelfForItems.bin_carton || '—'}</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setSelectedShelfForItems(null)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Notifications */}
            {shelfItemsError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{shelfItemsError}</span>
              </div>
            )}
            {assignSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{assignSuccess}</span>
              </div>
            )}

            {/* Section 1: Assign New Variant */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                  <Plus className="w-4 h-4 text-indigo-600" />
                  <span>تسكين صنف أو مقاس جديد على هذا الرف</span>
                </span>
                <span className="text-[10px] text-slate-400">
                  ابحث عن الموديل وحدد الكمية لربطه بالرف
                </span>
              </div>

              <form onSubmit={handleAssignVariant} className="space-y-3">
                {/* Variant Search Picker */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    اختر الموديل والمقاس واللون <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={assignSearch}
                      onChange={(e) => searchAssignable(e.target.value)}
                      placeholder="ابحث بكود الموديل (مثال: K101) أو اللون أو المقاس..."
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 pr-9 text-xs focus:border-indigo-500"
                    />
                    <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                    {isSearchingVariants && (
                      <Loader2 className="w-4 h-4 text-indigo-600 animate-spin absolute left-3 top-2.5" />
                    )}
                  </div>

                  {/* Search Results Dropdown */}
                  {assignableVariants.length > 0 && !selectedVariant && (
                    <div className="mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto divide-y divide-slate-100 z-10">
                      {assignableVariants.map((v) => (
                        <div
                          key={v.variant_id}
                          onClick={() => {
                            setSelectedVariant(v);
                            setAssignQuantity(String(v.on_hand_quantity || 0));
                            setAssignableVariants([]);
                            setAssignSearch(`${v.model_code} - ${v.color_name} - ${v.size_name}`);
                          }}
                          className="p-2.5 hover:bg-indigo-50 cursor-pointer flex items-center justify-between text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-indigo-700">{v.model_code}</span>
                            <span className="text-slate-600">{v.model_name}</span>
                            <span className="px-2 py-0.5 bg-slate-100 rounded text-[11px] font-bold text-slate-700">
                              {v.color_name}
                            </span>
                            <span className="px-2 py-0.5 bg-slate-100 rounded text-[11px] font-bold text-slate-700">
                              {v.size_name}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                              رصيد المخزن: {v.on_hand_quantity} قطعة
                            </span>
                            {v.current_shelf_code && (
                              <span className="text-[10px] text-slate-400">
                                الرف الحالي: {v.current_shelf_code}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Selected Variant Highlight Card */}
                  {selectedVariant && (
                    <div className="mt-2 p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
                        <span className="font-bold text-indigo-900">{selectedVariant.model_code}</span>
                        <span className="text-slate-700">{selectedVariant.model_name}</span>
                        <span className="px-2 py-0.5 bg-white border border-indigo-200 rounded font-bold text-slate-800 text-[11px]">
                          اللون: {selectedVariant.color_name}
                        </span>
                        <span className="px-2 py-0.5 bg-white border border-indigo-200 rounded font-bold text-slate-800 text-[11px]">
                          المقاس: {selectedVariant.size_name}
                        </span>
                        <span className="text-emerald-700 font-bold text-[11px]">
                          (الرصيد الكلي: {selectedVariant.on_hand_quantity} قطعة)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedVariant(null);
                          setAssignSearch('');
                        }}
                        className="text-slate-400 hover:text-rose-600 text-[11px] font-bold"
                      >
                        تغيير
                      </button>
                    </div>
                  )}
                </div>

                {/* Quantity and Primary Shelf */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      الكمية المخزنة على هذا الرف (قطعة)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={assignQuantity}
                      onChange={(e) => setAssignQuantity(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs focus:border-indigo-500 font-mono font-bold"
                    />
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <label className="flex items-center gap-2 cursor-pointer pt-2">
                      <input
                        type="checkbox"
                        checked={isPrimaryShelf}
                        onChange={(e) => setIsPrimaryShelf(e.target.checked)}
                        className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                      />
                      <span className="font-bold text-slate-700 text-xs">
                        تعيين كرف أساسي للموديل (Primary Shelf)
                      </span>
                    </label>

                    <button
                      type="submit"
                      disabled={assignSubmitting || !selectedVariant}
                      className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold flex items-center gap-2 cursor-pointer disabled:opacity-50 shrink-0"
                    >
                      {assignSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                      <span>تسكين على الرف</span>
                    </button>
                  </div>
                </div>
              </form>
            </div>

            {/* Section 2: Currently Assigned Items */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-slate-900 text-xs">
                  الأصناف المسكنة حالياً على الرف ({shelfItems.length} صنف)
                </h4>
                <span className="text-[11px] text-slate-500 font-bold">
                  إجمالي القطع بالرف:{' '}
                  <span className="text-emerald-700 font-black">
                    {shelfItems.reduce((acc, it) => acc + (it.shelf_quantity || 0), 0)} قطعة
                  </span>
                </span>
              </div>

              {shelfItemsLoading ? (
                <div className="py-12 text-center text-slate-400">
                  <Loader2 className="w-6 h-6 animate-spin text-indigo-600 mx-auto mb-2" />
                  <p>جارٍ تحميل محتويات الرف...</p>
                </div>
              ) : shelfItems.length === 0 ? (
                <div className="py-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-300 text-slate-400">
                  <Boxes className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="font-bold">لا توجد أصناف مسكنة على هذا الرف بعد.</p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    استخدم نموذج البحث بالأعلى لاختيار صنف وتسكينه على هذا الرف.
                  </p>
                </div>
              ) : (
                <div className="border border-slate-200 rounded-2xl overflow-hidden">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">كود الموديل</th>
                        <th className="py-2.5 px-3">الاسم والوصف</th>
                        <th className="py-2.5 px-3">اللون</th>
                        <th className="py-2.5 px-3">المقاس</th>
                        <th className="py-2.5 px-3 text-center">الرصيد الكلي</th>
                        <th className="py-2.5 px-3 text-center">الكمية بالرف</th>
                        <th className="py-2.5 px-3 text-center">الرف الأساسي</th>
                        <th className="py-2.5 px-3 text-center">الإجراء</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {shelfItems.map((it) => (
                        <tr key={it.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-2.5 px-3 font-mono font-bold text-indigo-700">
                            {it.model_code}
                          </td>
                          <td className="py-2.5 px-3 text-slate-800">{it.model_name}</td>
                          <td className="py-2.5 px-3 font-bold text-slate-700">{it.color_name}</td>
                          <td className="py-2.5 px-3 text-slate-700">{it.size_name}</td>
                          <td className="py-2.5 px-3 text-center text-slate-500 font-mono">
                            {it.total_on_hand}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className="font-mono font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                              {it.shelf_quantity} قطعة
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {it.is_primary ? (
                              <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full text-[10px] font-bold">
                                رف رئيسي
                              </span>
                            ) : (
                              <span className="text-slate-400 text-[10px]">رف إضافي</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveVariant(it.variant_id, it.model_code)}
                              className="px-2 py-1 text-rose-600 hover:bg-rose-50 rounded-lg text-[11px] font-bold transition-colors cursor-pointer"
                              title="إلغاء التسكين من هذا الرف"
                            >
                              إزالة
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedShelfForItems(null)}
                className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
