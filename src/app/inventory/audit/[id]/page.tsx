'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import {
  ClipboardCheck,
  Search,
  CheckCircle2,
  AlertTriangle,
  Printer,
  ArrowRight,
  Loader2,
  Check,
  Warehouse,
  Filter,
  Save,
  ShieldCheck,
  RotateCcw,
} from 'lucide-react';

function InventoryAuditDetailContent() {
  const router = useRouter();
  const params = useParams();
  const sessionId = params.id as string;

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'discrepancy' | 'uncounted' | 'matched'>('all');

  // Line editing counts
  const [editingCounts, setEditingCounts] = useState<Record<number, string>>({});
  const [savingLineId, setSavingLineId] = useState<number | null>(null);

  // Approval modal
  const [isApproveOpen, setIsApproveOpen] = useState(false);
  const [approvalNotes, setApprovalNotes] = useState('');
  const [approving, setApproving] = useState(false);
  const [approveError, setApproveError] = useState('');

  const fetchDetails = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/inventory/audit/${sessionId}`);
      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || 'تعذر تحميل جلسة الجرد');
      }
      const json = await res.json();
      setData(json);

      // Prepopulate editing counts
      const counts: Record<number, string> = {};
      json.lines.forEach((l: any) => {
        if (l.counted_quantity !== null) {
          counts[l.id] = String(l.counted_quantity);
        }
      });
      setEditingCounts(counts);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetails();
  }, [sessionId]);

  const handleSaveLineCount = async (lineId: number) => {
    const val = editingCounts[lineId];
    if (val === undefined || val === '') return;
    const num = parseInt(val, 10);
    if (isNaN(num) || num < 0) {
      alert('الكمية يجب أن تكون رقماً موجباً أو صفراً.');
      return;
    }

    try {
      setSavingLineId(lineId);
      const res = await fetch(`/api/inventory/audit/${sessionId}/line`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          line_id: lineId,
          counted_quantity: num,
        }),
      });

      const resJson = await res.json();
      if (!res.ok) throw new Error(resJson.error || 'فشل حفظ العد');
      fetchDetails();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSavingLineId(null);
    }
  };

  const handleApproveAdjustments = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setApproving(true);
      setApproveError('');
      const res = await fetch(`/api/inventory/audit/${sessionId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: approvalNotes }),
      });

      const resJson = await res.json();
      if (!res.ok) throw new Error(resJson.error || 'فشل اعتماد التسويات');

      setIsApproveOpen(false);
      fetchDetails();
    } catch (err: any) {
      setApproveError(err.message);
    } finally {
      setApproving(false);
    }
  };

  if (loading) {
    return (
      <AppShell title="محضر الجرد المخزني" subtitle="جارٍ التحميل...">
        <div className="py-24 text-center">
          <Loader2 className="w-10 h-10 animate-spin text-indigo-600 mx-auto mb-3" />
          <p className="text-xs font-bold text-slate-500">جارٍ قراءة بطاقات الجرد وفروقات المخزون...</p>
        </div>
      </AppShell>
    );
  }

  if (error || !data) {
    return (
      <AppShell title="خطأ في تحميل الجرد" subtitle="تعذر جلب البيانات">
        <div className="p-8 max-w-xl mx-auto bg-white rounded-2xl border border-rose-200 text-center space-y-4">
          <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto" />
          <h2 className="text-base font-black text-slate-900">{error}</h2>
          <Link
            href="/inventory/audit"
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-bold"
          >
            <ArrowRight className="w-4 h-4" />
            <span>العودة لقائمة محاضر الجرد</span>
          </Link>
        </div>
      </AppShell>
    );
  }

  const { session, lines } = data;

  const totalLines = lines.length;
  const countedLines = lines.filter((l: any) => l.counted_quantity !== null).length;
  const matchedLines = lines.filter((l: any) => l.reconciliation_status === 'matched').length;
  const discrepancyLines = lines.filter((l: any) => l.reconciliation_status === 'discrepancy').length;
  const isApproved = session.status === 'approved';

  const filteredLines = lines.filter((l: any) => {
    const q = search.trim().toLowerCase();
    const matchesSearch =
      l.model_code.toLowerCase().includes(q) ||
      l.model_name.toLowerCase().includes(q) ||
      l.color_name.toLowerCase().includes(q) ||
      l.size_name.toLowerCase().includes(q) ||
      (l.shelf_code && l.shelf_code.toLowerCase().includes(q)) ||
      l.sku.toLowerCase().includes(q);
    if (!matchesSearch) return false;

    if (filterMode === 'discrepancy') return l.reconciliation_status === 'discrepancy';
    if (filterMode === 'matched') return l.reconciliation_status === 'matched';
    if (filterMode === 'uncounted') return l.counted_quantity === null;
    return true;
  });

  return (
    <AppShell
      title={`محضر الجرد رقم: ${session.session_number}`}
      subtitle={`المستودع: ${session.warehouse_name} • مقارنة الكميات الفعلية مع السيستم والمحجوز والمباع`}
    >
      <div className="space-y-6">
        {/* Top Header Actions */}
        <div className="print:hidden flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/inventory/audit"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors"
          >
            <ArrowRight className="w-4 h-4" />
            <span>العودة لمحاضر الجرد</span>
          </Link>

          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة كشف الجرد</span>
            </button>

            {!isApproved ? (
              <button
                onClick={() => setIsApproveOpen(true)}
                disabled={countedLines === 0}
                className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>اعتماد فروقات الجرد وتحديث الأرصدة</span>
              </button>
            ) : (
              <span className="px-3 py-1.5 rounded-xl bg-emerald-100 text-emerald-800 font-bold text-xs border border-emerald-300 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>تم اعتماد وتطبيق هذا المحضر في الأرصدة</span>
              </span>
            )}
          </div>
        </div>

        {/* KPI Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <span className="text-slate-500 text-xs font-bold">إجمالي أصناف الجرد</span>
            <div className="mt-2 text-2xl font-black text-slate-900">{totalLines}</div>
            <div className="mt-1 text-[11px] text-slate-400">صنف مشمول بالمحضر</div>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <span className="text-slate-500 text-xs font-bold">تم عده فعلياً</span>
            <div className="mt-2 text-2xl font-black text-indigo-600">{countedLines}</div>
            <div className="mt-1 text-[11px] text-indigo-700 font-bold">
              {totalLines > 0 ? `${Math.round((countedLines / totalLines) * 100)}% نسبة الإنجاز` : '0%'}
            </div>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <span className="text-slate-500 text-xs font-bold">مطابق للرصيد الدفتري 100%</span>
            <div className="mt-2 text-2xl font-black text-emerald-600">{matchedLines}</div>
            <div className="mt-1 text-[11px] text-slate-400">بدون أي فروقات</div>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <span className="text-slate-500 text-xs font-bold">فروقات (عجز أو زيادة)</span>
            <div className={`mt-2 text-2xl font-black ${discrepancyLines > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
              {discrepancyLines}
            </div>
            <div className="mt-1 text-[11px] text-slate-400">تتطلب تسوية معتمدة</div>
          </div>
        </div>

        {/* Filters Bar */}
        <div className="print:hidden bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث بكود الموديل، اللون، المقاس، أو الرف..."
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2 pr-10 text-xs focus:bg-white focus:border-indigo-500"
            />
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-2.5" />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setFilterMode('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                filterMode === 'all' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              الكل ({lines.length})
            </button>
            <button
              onClick={() => setFilterMode('discrepancy')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                filterMode === 'discrepancy'
                  ? 'bg-rose-600 text-white'
                  : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
              }`}
            >
              فروقات الجرد فقط ({discrepancyLines})
            </button>
            <button
              onClick={() => setFilterMode('uncounted')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                filterMode === 'uncounted'
                  ? 'bg-amber-600 text-white'
                  : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
              }`}
            >
              غير معدود ({totalLines - countedLines})
            </button>
            <button
              onClick={() => setFilterMode('matched')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                filterMode === 'matched'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
              }`}
            >
              مطابق ({matchedLines})
            </button>
          </div>
        </div>

        {/* Audit Sheet Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-700 flex items-center justify-between">
            <span>كشف بنود ومطابقة الجرد ({filteredLines.length} صنف)</span>
            <span className="text-slate-500 text-[11px]">
              الرصيد الفعلي = المحجوز + المتاح • لا يُعتبر المحجوز عجزاً
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-3">الموديل والصنف</th>
                  <th className="py-3 px-3">اللون</th>
                  <th className="py-3 px-3">المقاس</th>
                  <th className="py-3 px-3">الرف</th>
                  <th className="py-3 px-3 text-center">الرصيد الدفتري (الفعلي)</th>
                  <th className="py-3 px-3 text-center">المحجوز</th>
                  <th className="py-3 px-3 text-center">المتاح للبيع</th>
                  <th className="py-3 px-3 text-center bg-indigo-50/70 border-x border-indigo-200">
                    العد الفعلي بالمخزن
                  </th>
                  <th className="py-3 px-3 text-center">الفرق (Discrepancy)</th>
                  <th className="py-3 px-3 text-center">المباع آخر 30 يوم</th>
                  <th className="py-3 px-3 text-center">الحالة</th>
                  {!isApproved && <th className="py-3 px-3 text-center print:hidden">حفظ</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLines.map((line: any) => {
                  const isSaving = savingLineId === line.id;
                  const diff = line.discrepancy || 0;

                  return (
                    <tr
                      key={line.id}
                      className={`hover:bg-slate-50 transition-colors ${
                        line.reconciliation_status === 'discrepancy'
                          ? 'bg-rose-50/30'
                          : line.reconciliation_status === 'matched'
                          ? 'bg-emerald-50/20'
                          : ''
                      }`}
                    >
                      <td className="py-2.5 px-3 font-bold text-slate-900">
                        {line.model_code} - {line.model_name}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-slate-700">{line.color_name}</td>
                      <td className="py-2.5 px-3 text-slate-800">{line.size_name}</td>
                      <td className="py-2.5 px-3">
                        <span className="font-mono text-[10px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded">
                          {line.shelf_code || '—'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold font-mono text-slate-900">
                        {line.system_physical_quantity}
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold font-mono text-blue-700">
                        {line.system_reserved_quantity}
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold font-mono text-emerald-700">
                        {line.system_available_quantity}
                      </td>

                      {/* Physical Counted Input */}
                      <td className="py-2 px-3 text-center bg-indigo-50/40 border-x border-indigo-100">
                        {isApproved ? (
                          <span className="font-mono font-black text-slate-900 text-sm">
                            {line.counted_quantity !== null ? line.counted_quantity : '—'}
                          </span>
                        ) : (
                          <div className="flex items-center justify-center gap-1">
                            <input
                              type="number"
                              min="0"
                              value={editingCounts[line.id] !== undefined ? editingCounts[line.id] : ''}
                              onChange={(e) =>
                                setEditingCounts({
                                  ...editingCounts,
                                  [line.id]: e.target.value,
                                })
                              }
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleSaveLineCount(line.id);
                                }
                              }}
                              placeholder="الكمية"
                              className="w-20 text-center bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs font-mono font-black text-slate-900 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
                            />
                          </div>
                        )}
                      </td>

                      {/* Discrepancy Column */}
                      <td className="py-2.5 px-3 text-center font-mono font-black">
                        {line.counted_quantity !== null ? (
                          diff > 0 ? (
                            <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                              +{diff} زيادة
                            </span>
                          ) : diff < 0 ? (
                            <span className="text-rose-700 bg-rose-50 px-2 py-0.5 rounded">
                              {diff} عجز
                            </span>
                          ) : (
                            <span className="text-slate-400">0 مطابق</span>
                          )
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>

                      {/* Sold Last 30 Days */}
                      <td className="py-2.5 px-3 text-center font-mono text-slate-500">
                        {line.sold_last_30_days} قطعة
                      </td>

                      {/* Status */}
                      <td className="py-2.5 px-3 text-center">
                        {line.reconciliation_status === 'matched' && (
                          <span className="text-emerald-700 font-bold text-[11px] flex items-center justify-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>مطابق</span>
                          </span>
                        )}
                        {line.reconciliation_status === 'discrepancy' && (
                          <span className="text-rose-700 font-bold text-[11px]">فروقات</span>
                        )}
                        {line.reconciliation_status === 'approved' && (
                          <span className="text-emerald-800 font-bold text-[11px]">معتمد</span>
                        )}
                        {line.reconciliation_status === 'pending' && (
                          <span className="text-slate-400 text-[11px]">بانتظار العد</span>
                        )}
                      </td>

                      {/* Save Button */}
                      {!isApproved && (
                        <td className="py-2 px-3 text-center print:hidden">
                          <button
                            onClick={() => handleSaveLineCount(line.id)}
                            disabled={isSaving}
                            className="p-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 transition-colors cursor-pointer"
                            title="حفظ الكمية المعدودة"
                          >
                            {isSaving ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Save className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Approval Confirmation Modal */}
      {isApproveOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <h3 className="font-black text-slate-900 text-base">اعتماد محضر الجرد والتسويات</h3>
              </div>
              <button onClick={() => setIsApproveOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold">
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              سيتم اعتماد الفروقات وتعديل رصيد المخزن الفعلي في قاعدة البيانات تلقائياً وإنشاء قيود تسوية
              مخزنية ذرية غير قابلة للحذف (Immutable Audit Trail) مسجلة باسمك ورقم المحضر.
            </p>

            {approveError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{approveError}</span>
              </div>
            )}

            <form onSubmit={handleApproveAdjustments} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  ملاحظات الاعتماد والتسوية (اختياري)
                </label>
                <textarea
                  rows={2}
                  value={approvalNotes}
                  onChange={(e) => setApprovalNotes(e.target.value)}
                  placeholder="تم فحص الفروقات واعتماد التسويات المخزنية..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:bg-white focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsApproveOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={approving}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {approving && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>تأكيد واعتماد التسويات الآن</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Print Sheet Styling */}
      <style jsx global>{`
        @media print {
          body {
            background: white !important;
            color: black !important;
          }
          header, aside, footer, nav, button, input {
            display: none !important;
          }
        }
      `}</style>
    </AppShell>
  );
}

export default function InventoryAuditDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-slate-50 font-sans text-slate-500" dir="rtl">
          جاري تحميل كشف جلسة الجرد وأرصدة الفحص...
        </div>
      }
    >
      <InventoryAuditDetailContent />
    </Suspense>
  );
}

