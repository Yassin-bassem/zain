'use client';

import React, { useState, useEffect } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { Users, Plus, Search, Phone, MapPin, Loader2, AlertCircle, ShoppingCart } from 'lucide-react';

export default function CustomersPage() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [alternatePhone, setAlternatePhone] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState('');

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/customers?search=${encodeURIComponent(search.trim())}`);
      if (res.ok) {
        const data = await res.json();
        setCustomers(data.customers || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchCustomers();
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalLoading(true);
    setModalError('');

    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          phone,
          alternate_phone: alternatePhone,
          address,
          notes,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل إضافة العميل');

      setIsModalOpen(false);
      setName('');
      setPhone('');
      setAlternatePhone('');
      setAddress('');
      setNotes('');
      fetchCustomers();
    } catch (err: any) {
      setModalError(err.message);
    } finally {
      setModalLoading(false);
    }
  };

  return (
    <AppShell
      title="دليل العملاء ومحلات الأطفال"
      subtitle="سجل تجار الجملة ومحلات ملابس الأطفال المتعاملة وأرقام التواصل وسجل الطلبات"
    >
      <div className="space-y-6">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
          <form onSubmit={handleSearchSubmit} className="flex items-center gap-3 flex-1 max-w-md">
            <div className="relative flex-1">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="بحث باسم المحل، كود العميل، أو رقم الهاتف..."
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 pr-10 text-xs focus:bg-white focus:border-indigo-500"
              />
              <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
            </div>
            <button
              type="submit"
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              بحث
            </button>
          </form>

          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة عميل جديد</span>
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-700">
            إجمالي العملاء المسجلين: {customers.length} عميل
          </div>

          {loading ? (
            <div className="py-20 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-500">جارٍ قراءة سجل العملاء...</p>
            </div>
          ) : customers.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-xs">
              <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p>لا يوجد عملاء مطابقين للبحث.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">كود العميل</th>
                    <th className="py-3 px-4">اسم العميل / المحل</th>
                    <th className="py-3 px-4">رقم الهاتف الأساسي</th>
                    <th className="py-3 px-4">رقم إضافي</th>
                    <th className="py-3 px-4">العنوان أو المحافظة</th>
                    <th className="py-3 px-4 text-center">عدد الطلبات المسجلة</th>
                    <th className="py-3 px-4">ملاحظات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {customers.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-mono font-bold text-indigo-700">{c.customer_code}</td>
                      <td className="py-3 px-4 font-bold text-slate-900">{c.name}</td>
                      <td className="py-3 px-4 font-mono text-slate-800">{c.phone}</td>
                      <td className="py-3 px-4 font-mono text-slate-500">{c.alternate_phone || '—'}</td>
                      <td className="py-3 px-4 text-slate-600">{c.address || '—'}</td>
                      <td className="py-3 px-4 text-center">
                        <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-800 font-bold text-[11px]">
                          {c.orders_count || 0} طلب
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-400 text-[11px] truncate max-w-xs">{c.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* New Customer Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-black text-slate-900 text-base">إضافة تاجر / محل جديد</h3>
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

            <form onSubmit={handleCreateCustomer} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">اسم العميل / اسم المحل التجاري *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="مثال: سنتر السعادة لملابس الأطفال"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:bg-white focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">رقم الهاتف الأساسي *</label>
                <input
                  type="text"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="01012345678"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:bg-white focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">رقم هاتف إضافي أو واتساب</label>
                <input
                  type="text"
                  value={alternatePhone}
                  onChange={(e) => setAlternatePhone(e.target.value)}
                  placeholder="01187654321"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:bg-white focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">العنوان أو المحافظة</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="مثال: المحلة الكبرى - شارع البحر"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:bg-white focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">ملاحظات إضافية</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="طريقة الشحن المفضلة أو رغبات خاصة..."
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
                  <span>حفظ العميل</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
