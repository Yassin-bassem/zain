'use client';

import React, { useState, useEffect } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { Building2, Plus, Phone, Loader2, AlertCircle, PackageCheck } from 'lucide-react';

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState('');

  const fetchSuppliers = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/suppliers');
      if (res.ok) {
        const data = await res.json();
        setSuppliers(data.suppliers || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalLoading(true);
    setModalError('');

    try {
      const res = await fetch('/api/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, notes }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل إضافة المورد');

      setIsModalOpen(false);
      setName('');
      setPhone('');
      setNotes('');
      fetchSuppliers();
    } catch (err: any) {
      setModalError(err.message);
    } finally {
      setModalLoading(false);
    }
  };

  return (
    <AppShell
      title="دليل المصانع والموردين"
      subtitle="سجل مصانع وورش تصنيع وتوريد ملابس الأطفال وسجل أذونات الاستلام"
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-500">
            إجمالي الموردين: {suppliers.length} مورد
          </span>

          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة مورد / مصنع جديد</span>
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          {loading ? (
            <div className="py-20 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-500">جارٍ قراءة سجل الموردين...</p>
            </div>
          ) : suppliers.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-xs">
              <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p>لا يوجد موردين مسجلين حتى الآن.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">كود المورد</th>
                    <th className="py-3 px-4">اسم المصنع / المورد</th>
                    <th className="py-3 px-4">رقم الهاتف</th>
                    <th className="py-3 px-4 text-center">أذونات الاستلام الواردة</th>
                    <th className="py-3 px-4">ملاحظات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {suppliers.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50">
                      <td className="py-3.5 px-4 font-mono font-bold text-indigo-700">{s.supplier_code}</td>
                      <td className="py-3.5 px-4 font-bold text-slate-900">{s.name}</td>
                      <td className="py-3.5 px-4 font-mono text-slate-700">{s.phone || '—'}</td>
                      <td className="py-3.5 px-4 text-center font-bold text-slate-800">
                        {s.receipts_count || 0} إذن استلام
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 truncate max-w-xs">{s.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* New Supplier Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-black text-slate-900 text-base">إضافة مصنع / مورد جديد</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold">
                ✕
              </button>
            </div>

            {modalError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleCreateSupplier} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">اسم المصنع / المورد *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="مثال: مصنع النور للألبسة الجاهزة"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:bg-white focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">رقم الهاتف / مسؤول التوريد</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="01234567890"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:bg-white focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">ملاحظات التوريد أو التعامل</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="تخصص المصنع (ولادي، قطنيات، شتوي)..."
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
                  <span>حفظ المورد</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
