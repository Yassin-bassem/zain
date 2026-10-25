'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import {
  ClipboardCheck,
  Plus,
  Search,
  Warehouse,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Calendar,
  Layers,
  ArrowLeft,
  FileSpreadsheet,
} from 'lucide-react';

export default function InventoryAuditSessionsPage() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // New session modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [auditMode, setAuditMode] = useState<string>('full');
  const [notes, setNotes] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');

  const fetchSessions = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/inventory/audit');
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setCreateLoading(true);
      setCreateError('');
      const res = await fetch('/api/inventory/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audit_mode: auditMode,
          notes,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل إنشاء جلسة الجرد');

      setIsCreateOpen(false);
      setNotes('');
      fetchSessions();
    } catch (err: any) {
      setCreateError(err.message);
    } finally {
      setCreateLoading(false);
    }
  };

  const getModeLabel = (mode: string) => {
    switch (mode) {
      case 'full':
        return 'جرد كامل للمستودع';
      case 'by_model':
        return 'جرد حسب الموديل';
      case 'by_category':
        return 'جرد حسب الفئة';
      case 'by_shelf':
        return 'جرد حسب الرف';
      case 'cycle_count':
        return 'جرد دوري مستمر';
      default:
        return mode;
    }
  };

  return (
    <AppShell
      title="الجرد الفعلي والتسويات المخزنية"
      subtitle="إدارة جلسات الجرد الشامل والدوري ومقارنة الأرصدة الفعلية مع دفاتر النظام واعتماد التسويات"
    >
      <div className="space-y-6">
        {/* Top Summary & Action Bar */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="font-black text-slate-900 text-sm flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5 text-indigo-600" />
              <span>جلسات ومحاضر الجرد المسجلة</span>
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              يتم الحفاظ على الحركات السابقة والحجوزات ومطابقة الكميات بحركات تسوية ذرية معتمدة
            </p>
          </div>

          <button
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>إنشاء محضر جرد جديد</span>
          </button>
        </div>

        {/* Sessions Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-700 flex items-center justify-between">
            <span>سجل محاضر الجرد ({sessions.length} جلسة)</span>
            <span className="text-slate-500">المستودع الرئيسي: MAIN</span>
          </div>

          {loading ? (
            <div className="py-20 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-500">جارٍ قراءة سجل جلسات الجرد...</p>
            </div>
          ) : sessions.length === 0 ? (
            <div className="py-20 text-center text-slate-400 text-xs">
              <ClipboardCheck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p>لا توجد جلسات جرد مسجلة بعد. اضغط "إنشاء محضر جرد جديد" للبدء.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">رقم المحضر</th>
                    <th className="py-3 px-4">نطاق الجرد</th>
                    <th className="py-3 px-4">المستودع</th>
                    <th className="py-3 px-4">الحالة</th>
                    <th className="py-3 px-4 text-center">إجمالي الأصناف</th>
                    <th className="py-3 px-4 text-center">المعدود</th>
                    <th className="py-3 px-4 text-center">المطابق</th>
                    <th className="py-3 px-4 text-center">فروقات الجرد</th>
                    <th className="py-3 px-4">تاريخ الجلسة</th>
                    <th className="py-3 px-4 text-center">الإجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sessions.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4 font-mono font-black text-indigo-700">
                        {s.session_number}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900">
                        {getModeLabel(s.audit_mode)}
                      </td>
                      <td className="py-3 px-4 text-slate-700">{s.warehouse_name}</td>
                      <td className="py-3 px-4">
                        {s.status === 'in_progress' && (
                          <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 font-bold text-[10px]">
                            قيد العد والتسجيل
                          </span>
                        )}
                        {s.status === 'approved' && (
                          <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                            معتمد ومطبق بالأرصدة
                          </span>
                        )}
                        {s.status === 'canceled' && (
                          <span className="px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold text-[10px]">
                            ملغي
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-bold text-slate-900">
                        {s.total_variants}
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-bold text-indigo-600">
                        {s.counted_variants}
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-bold text-emerald-600">
                        {s.matched_variants}
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-bold">
                        {s.discrepancy_variants > 0 ? (
                          <span className="text-rose-600 bg-rose-50 px-2 py-0.5 rounded">
                            {s.discrepancy_variants} فرق
                          </span>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                        {new Date(s.created_at).toLocaleDateString('ar-EG')}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Link
                          href={`/inventory/audit/${s.id}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold transition-colors"
                        >
                          <span>فتح المحضر</span>
                          <ArrowLeft className="w-3 h-3" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Create Audit Session Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-black text-slate-900 text-base">إنشاء محضر جرد مخزني جديد</h3>
              <button onClick={() => setIsCreateOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold">
                ✕
              </button>
            </div>

            {createError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{createError}</span>
              </div>
            )}

            <form onSubmit={handleCreate} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">نطاق عملية الجرد *</label>
                <select
                  value={auditMode}
                  onChange={(e) => setAuditMode(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-bold focus:bg-white focus:border-indigo-500"
                >
                  <option value="full">جرد شامل لكافة أصناف وموديلات المستودع (Full)</option>
                  <option value="cycle_count">جرد دوري مستمر (Cycle Count)</option>
                  <option value="by_shelf">جرد محدد حسب الرفوف التخزينية (By Shelf)</option>
                  <option value="by_model">جرد محدد لموديلات معينة (By Model)</option>
                  <option value="by_category">جرد محدد لفئة معينة (By Category)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">ملاحظات أو سبب الجرد</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="جرد نهاية الفترة أو مطابقة بضاعة الصيفي..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:bg-white focus:border-indigo-500"
                />
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 text-blue-900 rounded-xl text-[11px] leading-relaxed">
                يتم استيراد كافة الأرصدة الحالية للنظام (الفعلي، المحجوز، والمتاح) وتجميد نسخة للمقارنة
                دون التأثير على الحجوزات أو حركة البيع النشطة.
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
                  <span>بدء جلسة الجرد</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
