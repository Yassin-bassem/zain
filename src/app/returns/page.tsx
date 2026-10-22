'use client';

import React, { useState, useEffect } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import {
  RotateCcw,
  Plus,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldCheck,
  Search,
  Check,
  XCircle,
} from 'lucide-react';

export default function ReturnsWorkspacePage() {
  const [returns, setReturns] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // New Return Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [returnReason, setReturnReason] = useState('');
  const [returnItems, setReturnItems] = useState<Array<{ variant_id: number; returned_quantity: number }>>([]);
  const [inventorySearch, setInventorySearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState('');

  // Inspect Modal
  const [inspectingItem, setInspectingItem] = useState<any>(null);
  const [inspectionDisposition, setInspectionDisposition] = useState<'sellable' | 'damaged'>('sellable');
  const [inspectionNotes, setInspectionNotes] = useState('');
  const [inspectLoading, setInspectLoading] = useState(false);

  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const fetchReturns = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/returns');
      if (res.ok) {
        const data = await res.json();
        setReturns(data.returns || []);
        setItems(data.items || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReturns();
    fetch('/api/customers')
      .then((r) => r.json())
      .then((d) => setCustomers(d.customers || []))
      .catch((err) => console.error(err));
  }, []);

  useEffect(() => {
    if (!inventorySearch.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await fetch(`/api/inventory?limit=10&search=${encodeURIComponent(inventorySearch.trim())}`);
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
  }, [inventorySearch]);

  const handleAddReturnItem = (v: any) => {
    const existing = returnItems.find((i) => i.variant_id === v.variant_id);
    if (existing) {
      existing.returned_quantity += 1;
      setReturnItems([...returnItems]);
    } else {
      setReturnItems([...returnItems, { variant_id: v.variant_id, returned_quantity: 1 }]);
    }
  };

  const handleCreateReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId) {
      setModalError('يرجى تحديد العميل.');
      return;
    }
    if (!returnReason.trim()) {
      setModalError('سبب الإرجاع إلزامي.');
      return;
    }
    if (returnItems.length === 0) {
      setModalError('يجب تحديد صنف واحد على الأقل مرتجع.');
      return;
    }

    setModalLoading(true);
    setModalError('');

    try {
      const res = await fetch('/api/returns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: Number(selectedCustomerId),
          reason: returnReason,
          items: returnItems,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل تسجيل المرتجع');

      setIsModalOpen(false);
      setSelectedCustomerId('');
      setReturnReason('');
      setReturnItems([]);
      setMessage({
        text: `تم تسجيل طلب المرتجع بنجاح برقم (${data.returnNumber}). الأصناف الآن بانتظار الفحص الفني.`,
        type: 'success',
      });
      fetchReturns();
    } catch (err: any) {
      setModalError(err.message);
    } finally {
      setModalLoading(false);
    }
  };

  const handleInspectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inspectingItem) return;

    setInspectLoading(true);
    try {
      const res = await fetch(`/api/returns/${inspectingItem.return_id}/inspect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: inspectingItem.id,
          disposition: inspectionDisposition,
          inspectionNotes,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل فحص البند');

      setMessage({
        text:
          inspectionDisposition === 'sellable'
            ? 'تم اعتماد البند كبضاعة سليمة وإعادة إضافتها فوراً للمخزون المتاح للبيع.'
            : 'تم توثيق البند كبضاعة تالفة - تم منع إضافتها للمخزن المتاح للبيع.',
        type: 'success',
      });

      setInspectingItem(null);
      fetchReturns();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setInspectLoading(false);
    }
  };

  return (
    <AppShell
      title="فحص المرتجعات واعتماد إعادة البيع (Returns Inspection)"
      subtitle="منظومة ضبط الجودة وفحص القطع المرتجعة - إعادة السليم للمخزن وعزل التالف"
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2 text-xs text-amber-900 font-bold flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-amber-700" />
            <span>قاعدة الأمان: لا تعاد أي قطعة للمخزون المتاح إلا بعد فحصها واعتمادها كبضاعة سليمة (Sellable).</span>
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>تسجيل طلب مرتجع جديد</span>
          </button>
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

        {/* Returns and Inspection Items Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
            <span className="font-black text-slate-800">
              سجل طلبات الإرجاع والفحص ({returns.length} طلب)
            </span>
          </div>

          {loading ? (
            <div className="py-20 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-500">جارٍ قراءة طلبات المرتجعات...</p>
            </div>
          ) : returns.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-xs">
              <RotateCcw className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p>لا توجد طلبات إرجاع مسجلة حالياً.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {returns.map((ret) => {
                const retItems = items.filter((i) => i.return_id === ret.id);

                return (
                  <div key={ret.id} className="p-5 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-black text-sm text-indigo-700">{ret.return_number}</span>
                        <span className="font-bold text-slate-900">العميل: {ret.customer_name}</span>
                        <span className="text-slate-500">السبب: {ret.reason}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 text-[11px]">
                          {new Date(ret.created_at).toLocaleDateString('ar-EG')}
                        </span>
                        <span
                          className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
                            ret.status === 'completed'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {ret.status === 'completed' ? 'تم اكتمال الفحص' : 'بانتظار الفحص الفني'}
                        </span>
                      </div>
                    </div>

                    {/* Items table for this return */}
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <table className="w-full text-right text-xs">
                        <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                          <tr>
                            <th className="py-2 px-3">كود الموديل</th>
                            <th className="py-2 px-3">اسم الموديل</th>
                            <th className="py-2 px-3">اللون</th>
                            <th className="py-2 px-3">المقاس</th>
                            <th className="py-2 px-3 text-center">الكمية المرتجعة</th>
                            <th className="py-2 px-3 text-center">قرار الفحص</th>
                            <th className="py-2 px-3 text-center">حالة الرصيد</th>
                            <th className="py-2 px-3 text-center">إجراء الفحص</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {retItems.map((item) => (
                            <tr key={item.id} className="hover:bg-slate-50">
                              <td className="py-2 px-3 font-mono font-black text-indigo-900">{item.model_code}</td>
                              <td className="py-2 px-3 font-bold text-slate-800">{item.model_name}</td>
                              <td className="py-2 px-3">{item.color_name}</td>
                              <td className="py-2 px-3">{item.size_name}</td>
                              <td className="py-2 px-3 text-center font-black">{item.returned_quantity}</td>
                              <td className="py-2 px-3 text-center">
                                <span
                                  className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                                    item.disposition === 'sellable'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : item.disposition === 'damaged'
                                      ? 'bg-rose-100 text-rose-800'
                                      : 'bg-slate-100 text-slate-700'
                                  }`}
                                >
                                  {item.disposition === 'sellable'
                                    ? 'سليم لإعادة البيع'
                                    : item.disposition === 'damaged'
                                    ? 'تالف - هالك'
                                    : 'بانتظار الفحص'}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-center">
                                {item.restocked ? (
                                  <span className="text-emerald-700 font-bold text-[10px] flex items-center justify-center gap-1">
                                    <Check className="w-3.5 h-3.5" />
                                    <span>أعيد للمخزن</span>
                                  </span>
                                ) : (
                                  <span className="text-slate-400 text-[10px]">
                                    {item.disposition === 'damaged' ? 'معزول عن المخزن' : 'معلق'}
                                  </span>
                                )}
                              </td>
                              <td className="py-2 px-3 text-center">
                                {!item.restocked && item.disposition === 'pending' ? (
                                  <button
                                    onClick={() => setInspectingItem(item)}
                                    className="px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg text-[11px] transition-colors cursor-pointer"
                                  >
                                    فحص واتخاذ قرار
                                  </button>
                                ) : (
                                  <span className="text-slate-400 text-[10px]">مكتمل</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Inspect Item Modal */}
      {inspectingItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-black text-slate-900 text-base">فحص بند المرتجع واتخاذ القرار</h3>
              <button onClick={() => setInspectingItem(null)} className="text-slate-400 hover:text-slate-600 font-bold">
                ✕
              </button>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
              <p className="font-bold text-slate-900">
                {inspectingItem.model_code} - {inspectingItem.model_name}
              </p>
              <p className="text-slate-600">
                اللون: <strong>{inspectingItem.color_name}</strong> • المقاس: <strong>{inspectingItem.size_name}</strong>
              </p>
              <p className="text-slate-600">
                الكمية المرتجعة: <strong>{inspectingItem.returned_quantity} قطعة</strong>
              </p>
            </div>

            <form onSubmit={handleInspectSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-2">قرار الفحص الفني *</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setInspectionDisposition('sellable')}
                    className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                      inspectionDisposition === 'sellable'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-950 font-black shadow-xs'
                        : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 mx-auto mb-1" />
                    <span>سليم وصالح لإعادة البيع</span>
                    <span className="block text-[10px] text-emerald-700 mt-1 font-normal">
                      (يعاد فوراً للمخزن المتاح)
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setInspectionDisposition('damaged')}
                    className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                      inspectionDisposition === 'damaged'
                        ? 'bg-rose-50 border-rose-500 text-rose-950 font-black shadow-xs'
                        : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    <XCircle className="w-5 h-5 text-rose-600 mx-auto mb-1" />
                    <span>تالف / به عيب صناعة</span>
                    <span className="block text-[10px] text-rose-700 mt-1 font-normal">
                      (يمنع إعادته للمخزن)
                    </span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">تقرير الفحص والملاحظات</label>
                <textarea
                  rows={2}
                  value={inspectionNotes}
                  onChange={(e) => setInspectionNotes(e.target.value)}
                  placeholder="حالة التغليف، البطاقات، سبب الرفض أو القبول..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:bg-white focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setInspectingItem(null)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={inspectLoading}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {inspectLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>اعتماد قرار الفحص</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Return Request Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-black text-slate-900 text-base">تسجيل طلب إرجاع بضاعة</h3>
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

            <form onSubmit={handleCreateReturn} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">العميل صاحب المرتجع *</label>
                <select
                  required
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-bold focus:bg-white focus:border-indigo-500"
                >
                  <option value="">-- اختر العميل --</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.phone})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">سبب الإرجاع *</label>
                <input
                  type="text"
                  required
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  placeholder="مثال: مقاس غير مناسب للزبون، فحص إضافي..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:bg-white focus:border-indigo-500"
                />
              </div>

              {/* Variant Picker */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">ابحث عن الصنف لإضافته:</label>
                <input
                  type="text"
                  value={inventorySearch}
                  onChange={(e) => setInventorySearch(e.target.value)}
                  placeholder="كود الموديل أو اللون..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:bg-white focus:border-indigo-500"
                />

                {searchResults.length > 0 && (
                  <div className="mt-2 border border-slate-200 rounded-xl p-2 max-h-36 overflow-y-auto space-y-1">
                    {searchResults.map((v) => (
                      <button
                        key={v.variant_id}
                        type="button"
                        onClick={() => handleAddReturnItem(v)}
                        className="w-full text-right p-2 rounded-lg bg-slate-50 hover:bg-slate-100 flex items-center justify-between"
                      >
                        <span>{v.model_code} - {v.color_name} ({v.size_name})</span>
                        <span className="text-indigo-600 font-bold">+ إضافة</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {returnItems.length > 0 && (
                <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 space-y-2">
                  <span className="font-bold text-slate-800">الأصناف المحددة للإرجاع ({returnItems.length}):</span>
                  {returnItems.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs">
                      <span>صنف #{item.variant_id}</span>
                      <div className="flex items-center gap-2">
                        <label className="text-slate-500">الكمية:</label>
                        <input
                          type="number"
                          min="1"
                          value={item.returned_quantity}
                          onChange={(e) => {
                            const updated = [...returnItems];
                            updated[idx].returned_quantity = Math.max(1, Number(e.target.value));
                            setReturnItems(updated);
                          }}
                          className="w-16 bg-white border border-slate-300 rounded px-2 py-0.5 text-center font-bold"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

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
                  <span>حفظ طلب الإرجاع</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
