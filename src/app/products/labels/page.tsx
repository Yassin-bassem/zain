'use client';

import React, { useState, useEffect } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import {
  QrCode,
  Printer,
  Search,
  Filter,
  RefreshCw,
  CheckSquare,
  Square,
  AlertCircle,
  Loader2,
  Tag,
  Layers,
  Sparkles,
} from 'lucide-react';

export default function QrLabelsPage() {
  const [labels, setLabels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [backfilling, setBackfilling] = useState(false);
  const [message, setMessage] = useState('');

  const fetchLabels = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/qr/labels?search=${encodeURIComponent(search.trim())}`);
      if (res.ok) {
        const data = await res.json();
        setLabels(data.labels || []);
        // By default select all for fast batch printing
        setSelectedIds(new Set((data.labels || []).map((l: any) => l.variant_id)));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLabels();
  }, []);

  const handleSelectAll = () => {
    if (selectedIds.size === labels.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(labels.map((l) => l.variant_id)));
    }
  };

  const toggleSelect = (id: number) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleBackfill = async () => {
    try {
      setBackfilling(true);
      setMessage('');
      const res = await fetch('/api/qr/backfill', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل التوليد');
      setMessage(data.message || 'تم تحديث كافة الأكواد بنجاح.');
      fetchLabels();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setBackfilling(false);
    }
  };

  const selectedLabels = labels.filter((l) => selectedIds.has(l.variant_id));

  return (
    <AppShell
      title="توليد وطباعة استيكرات الباركود وQR"
      subtitle="طباعة ملصقات الباركود الفريدة لكل متغير (موديل + لون + مقاس) جاهزة للصق على قطع الملابس"
    >
      <div className="space-y-6">
        {/* Actions & Filters Bar - Hidden during printing */}
        <div className="print:hidden space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                fetchLabels();
              }}
              className="flex items-center gap-2 flex-1 max-w-md"
            >
              <div className="relative flex-1">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="بحث بكود الموديل، اللون، المقاس، أو SKU..."
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

            <div className="flex items-center gap-2">
              <button
                onClick={handleBackfill}
                disabled={backfilling}
                className="flex items-center gap-1.5 px-3.5 py-2 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                title="توليد أكواد QR للأصناف التي لا تحتوي على كود"
              >
                {backfilling ? <Loader2 className="w-4 h-4 animate-spin text-indigo-600" /> : <Sparkles className="w-4 h-4 text-amber-500" />}
                <span>تحديث وتوليد QR للكل</span>
              </button>

              <button
                onClick={handlePrint}
                disabled={selectedIds.size === 0}
                className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                <Printer className="w-4 h-4" />
                <span>طباعة الملصقات ({selectedIds.size})</span>
              </button>
            </div>
          </div>

          {message && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2">
              <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{message}</span>
            </div>
          )}

          {/* Selection Helper Bar */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
            <div className="flex items-center gap-3">
              <button
                onClick={handleSelectAll}
                className="flex items-center gap-1.5 font-bold text-slate-700 hover:text-slate-900 cursor-pointer"
              >
                {selectedIds.size === labels.length && labels.length > 0 ? (
                  <CheckSquare className="w-4 h-4 text-indigo-600" />
                ) : (
                  <Square className="w-4 h-4 text-slate-400" />
                )}
                <span>تحديد الكل ({labels.length})</span>
              </button>
              <span className="text-slate-400">|</span>
              <span className="font-bold text-indigo-700">تم اختيار: {selectedIds.size} ملصق</span>
            </div>
            <div className="text-slate-500 text-[11px]">
              مقاس الملصق مجهز للطباعة على ورق الاستيكر مقاس A4 أو طابعات الباركود الحرارية
            </div>
          </div>
        </div>

        {/* Labels Sheet / Grid */}
        {loading ? (
          <div className="py-24 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto mb-2" />
            <p className="text-xs font-bold text-slate-500">جارٍ تجهيز صور الباركود والملصقات...</p>
          </div>
        ) : labels.length === 0 ? (
          <div className="py-20 text-center text-slate-400 text-xs bg-white rounded-2xl border border-slate-200">
            <QrCode className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p>لا توجد أصناف أو متغيرات مطابقة للبحث.</p>
          </div>
        ) : (
          <div
            id="printable-labels-area"
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 gap-3.5 print:grid-cols-3 print:gap-2 print:p-0"
          >
            {labels.map((label) => {
              const isSelected = selectedIds.has(label.variant_id);

              return (
                <div
                  key={label.variant_id}
                  onClick={() => toggleSelect(label.variant_id)}
                  className={`relative p-3 rounded-xl border bg-white shadow-2xs transition-all cursor-pointer select-none text-right flex flex-col justify-between ${
                    isSelected
                      ? 'border-indigo-500 ring-2 ring-indigo-500/20'
                      : 'border-slate-200 hover:border-slate-300 opacity-60 print:hidden'
                  } print:opacity-100 print:border-slate-400 print:shadow-none print:break-inside-avoid print:p-2`}
                  style={{ pageBreakInside: 'avoid' }}
                >
                  {/* Select Checkbox Indicator - Hidden during printing */}
                  <div className="absolute top-2 left-2 print:hidden">
                    {isSelected ? (
                      <CheckSquare className="w-4 h-4 text-indigo-600" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-300" />
                    )}
                  </div>

                  {/* Label Header */}
                  <div className="space-y-0.5 pr-0.5">
                    <div className="flex items-center justify-between">
                      <span className="font-black text-slate-900 text-sm tracking-tight">
                        {label.model_code}
                      </span>
                      {label.shelf_code && (
                        <span className="font-mono font-black text-[10px] text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.2 rounded">
                          رف: {label.shelf_code}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] font-bold text-slate-700 truncate">
                      {label.model_name}
                    </div>
                  </div>

                  {/* QR Image Center */}
                  <div className="py-2 flex items-center justify-center">
                    <img
                      src={label.qr_data_url}
                      alt={label.qr_code_uid}
                      className="w-24 h-24 sm:w-28 sm:h-28 object-contain"
                    />
                  </div>

                  {/* Label Footer */}
                  <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="font-black text-slate-900">{label.color_name}</span>
                      <span className="text-slate-300">•</span>
                      <span className="font-bold text-indigo-700">{label.size_name}</span>
                    </div>
                    {label.default_price > 0 && (
                      <span className="font-mono font-bold text-slate-800 text-[11px]">
                        {label.default_price} ج.م
                      </span>
                    )}
                  </div>

                  {/* UID/SKU Bar */}
                  <div className="mt-1 text-[9px] font-mono text-slate-400 truncate text-center dir-ltr">
                    {label.qr_code_uid}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Print Specific CSS */}
      <style jsx global>{`
        @media print {
          body {
            background: white !important;
            color: black !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          header, aside, footer, nav, button, input {
            display: none !important;
          }
          #printable-labels-area {
            display: grid !important;
            grid-template-columns: repeat(3, 1fr) !important;
            gap: 8px !important;
            padding: 0 !important;
            margin: 0 !important;
          }
        }
      `}</style>
    </AppShell>
  );
}
