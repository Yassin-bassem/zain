'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import {
  PackagePlus,
  Plus,
  Trash2,
  Search,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
} from 'lucide-react';

export default function NewReceiptPage() {
  const router = useRouter();

  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [receiptDate, setReceiptDate] = useState('');
  const [invoiceRef, setInvoiceRef] = useState('');
  const [notes, setNotes] = useState('');

  // Items
  const [items, setItems] = useState<
    Array<{
      variant_id: number;
      model_code: string;
      model_name: string;
      color_name: string;
      size_name: string;
      quantity: number;
      unit_cost: number;
    }>
  >([]);

  // Search
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setReceiptDate(new Date().toISOString().slice(0, 10));
    fetch('/api/suppliers')
      .then((r) => r.json())
      .then((d) => setSuppliers(d.suppliers || []))
      .catch((err) => console.error(err));
  }, []);

  useEffect(() => {
    if (!search.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await fetch(`/api/inventory?limit=15&search=${encodeURIComponent(search.trim())}`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.items || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setSearchLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [search]);

  const handleAddItem = (v: any) => {
    const existingIndex = items.findIndex((i) => i.variant_id === v.variant_id);
    if (existingIndex >= 0) {
      const updated = [...items];
      updated[existingIndex].quantity += 10;
      setItems(updated);
    } else {
      setItems([
        ...items,
        {
          variant_id: v.variant_id,
          model_code: v.model_code,
          model_name: v.model_name,
          color_name: v.color_name,
          size_name: v.size_name,
          quantity: 10,
          unit_cost: 0,
        },
      ]);
    }
  };

  const handleUpdateItem = (index: number, field: string, val: any) => {
    const updated = [...items];
    (updated[index] as any)[field] = val;
    setItems(updated);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, idx) => idx !== index));
  };

  const totalPieces = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);

  const handleSubmit = async (confirmImmediately = false) => {
    if (!selectedSupplierId) {
      setError('يرجى تحديد المورد أو المصنع.');
      return;
    }
    if (items.length === 0) {
      setError('يجب إضافة صنف واحد على الأقل في إذن الاستلام.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/receiving', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplier_id: Number(selectedSupplierId),
          receipt_date: receiptDate,
          supplier_invoice_ref: invoiceRef,
          notes,
          items: items.map((i) => ({
            variant_id: i.variant_id,
            quantity: Number(i.quantity),
            unit_cost: Number(i.unit_cost || 0),
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل حفظ إذن الاستلام');

      if (confirmImmediately) {
        const confRes = await fetch(`/api/receiving/${data.receiptId}/confirm`, {
          method: 'POST',
        });
        const confData = await confRes.json();
        if (!confRes.ok) {
          throw new Error(`تم الحفظ ولكن تعذر التأكيد الفوري: ${confData.error}`);
        }
      }

      router.push('/warehouse/receipts');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppShell
      title="تسجيل إذن استلام بضاعة وتوريد جديد"
      subtitle="إثبات البضاعة المستلمة من المصانع وإضافتها للرصيد الفعلي في المستودع"
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Link
            href="/warehouse/receipts"
            className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors"
          >
            <ArrowRight className="w-4 h-4" />
            <span>العودة لقائمة التوريدات</span>
          </Link>
        </div>

        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs font-bold flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Supplier & Receipt Header */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">المورد / المصنع *</label>
              <select
                required
                value={selectedSupplierId}
                onChange={(e) => setSelectedSupplierId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-slate-900 font-bold focus:bg-white focus:border-indigo-500"
              >
                <option value="">-- اختر المورد --</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.phone || 'بدون هاتف'})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">تاريخ الاستلام *</label>
              <input
                type="date"
                required
                value={receiptDate}
                onChange={(e) => setReceiptDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:bg-white focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">رقم فاتورة / إذن المورد</label>
              <input
                type="text"
                value={invoiceRef}
                onChange={(e) => setInvoiceRef(e.target.value)}
                placeholder="مثال: فاتورة رقم 502"
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:bg-white focus:border-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* Search & Add Items */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <label className="block text-xs font-black text-slate-800">
            البحث عن الأصناف الواردة لإضافتها للإذن:
          </label>
          <div className="relative">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="اكتب كود الموديل أو اسم الصنف أو اللون لإظهار المتغيرات..."
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 pr-10 text-sm focus:bg-white focus:border-indigo-500"
            />
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
            {searchLoading && <Loader2 className="w-4 h-4 animate-spin text-indigo-600 absolute left-3.5 top-3" />}
          </div>

          {searchResults.length > 0 && (
            <div className="border border-indigo-200 rounded-xl bg-indigo-50/40 p-3 max-h-52 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-xs">
              {searchResults.map((v) => (
                <button
                  key={v.variant_id}
                  type="button"
                  onClick={() => handleAddItem(v)}
                  className="p-2.5 rounded-xl border border-white bg-white hover:border-indigo-400 shadow-2xs text-right transition-all flex items-center justify-between cursor-pointer"
                >
                  <div className="truncate">
                    <p className="font-black text-slate-900 truncate">{v.model_code} - {v.model_name}</p>
                    <p className="text-[11px] text-slate-500">{v.color_name} • {v.size_name}</p>
                  </div>
                  <span className="text-indigo-600 font-bold shrink-0 mr-2">+ إضافة</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Items Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs font-bold text-slate-800">
            <span>الأصناف والكميات المستلمة ({items.length} صنف)</span>
            <span className="text-indigo-700">إجمالي القطع الواردة: {totalPieces} قطعة</span>
          </div>

          {items.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-xs">
              لم تتم إضافة أي أصناف حتى الآن.
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
                    <th className="py-3 px-4 text-center w-36">الكمية المستلمة (قطع) *</th>
                    <th className="py-3 px-4 text-center w-36">تكلفة القطعة (اختياري)</th>
                    <th className="py-3 px-4 text-center">حذف</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item, idx) => (
                    <tr key={item.variant_id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-mono font-black text-indigo-700">{item.model_code}</td>
                      <td className="py-3 px-4 font-bold text-slate-900">{item.model_name}</td>
                      <td className="py-3 px-4 font-semibold text-slate-800">{item.color_name}</td>
                      <td className="py-3 px-4 font-semibold text-slate-800">{item.size_name}</td>
                      <td className="py-3 px-4 text-center">
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => handleUpdateItem(idx, 'quantity', Math.max(1, Number(e.target.value)))}
                          className="w-24 text-center bg-slate-50 border border-slate-300 rounded-lg py-1 font-black text-slate-900"
                        />
                      </td>
                      <td className="py-3 px-4 text-center">
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          value={item.unit_cost}
                          onChange={(e) => handleUpdateItem(idx, 'unit_cost', Math.max(0, Number(e.target.value)))}
                          className="w-24 text-center bg-slate-50 border border-slate-300 rounded-lg py-1 text-slate-800"
                        />
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="p-1 rounded-lg text-rose-600 hover:bg-rose-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Actions */}
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => handleSubmit(false)}
              disabled={submitting}
              className="px-5 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              حفظ كمسودة
            </button>

            <button
              type="button"
              onClick={() => handleSubmit(true)}
              disabled={submitting}
              className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>جارٍ الحفظ والاعتماد...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>اعتماد الإذن وإضافة القطع للمخزن فوراً</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
