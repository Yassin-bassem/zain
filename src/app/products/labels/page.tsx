'use client';

import React, { useState, useEffect } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import {
  QrCode,
  Printer,
  Search,
  CheckSquare,
  Square,
  Loader2,
  Sparkles,
  Layers,
  Sliders,
  Plus,
  Minus,
  Check,
  Package,
} from 'lucide-react';

export default function QrLabelsPage() {
  const [labels, setLabels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [copies, setCopies] = useState<Record<number, number>>({});
  const [printMode, setPrintMode] = useState<'thermal' | 'a4'>('thermal');
  const [backfilling, setBackfilling] = useState(false);
  const [message, setMessage] = useState('');

  const fetchLabels = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/qr/labels?search=${encodeURIComponent(search.trim())}`);
      if (res.ok) {
        const data = await res.json();
        const loadedLabels: any[] = data.labels || [];
        setLabels(loadedLabels);

        // Select all by default
        setSelectedIds(new Set(loadedLabels.map((l) => l.variant_id)));

        // Default copies to on_hand_quantity (or 1 if stock is 0)
        setCopies((prev) => {
          const next = { ...prev };
          loadedLabels.forEach((l) => {
            if (next[l.variant_id] === undefined) {
              const stock = Number(l.on_hand_quantity || 0);
              next[l.variant_id] = stock > 0 ? stock : 1;
            }
          });
          return next;
        });
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

  const updateCopies = (variantId: number, val: number) => {
    const count = Math.max(1, Math.min(999, Math.floor(val) || 1));
    setCopies((prev) => ({ ...prev, [variantId]: count }));
  };

  const handleSetAllToStock = () => {
    setCopies((prev) => {
      const next = { ...prev };
      labels.forEach((l) => {
        const stock = Number(l.on_hand_quantity || 0);
        next[l.variant_id] = stock > 0 ? stock : 1;
      });
      return next;
    });
  };

  const handleSetAllToOne = () => {
    setCopies((prev) => {
      const next = { ...prev };
      labels.forEach((l) => {
        next[l.variant_id] = 1;
      });
      return next;
    });
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

  // Total stickers to print
  const totalPrintStickers = selectedLabels.reduce(
    (sum, l) => sum + (copies[l.variant_id] || 1),
    0
  );

  // Flattened array for printing each copy individually
  const printableItems = selectedLabels.flatMap((label) => {
    const count = Math.max(1, copies[label.variant_id] || 1);
    return Array.from({ length: count }, (_, idx) => ({
      ...label,
      copyIndex: idx + 1,
      totalCopies: count,
    }));
  });

  return (
    <AppShell
      title="توليد وطباعة استيكرات الباركود وQR"
      subtitle="طباعة ملصقات الباركود والـ QR بالعدد المطلوب أو حسب رصيد المخزن الفعلي لطابعات الاستيكرات الحرارية"
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
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2 pr-10 text-xs focus:bg-white focus:border-indigo-500 font-bold"
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

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleBackfill}
                disabled={backfilling}
                className="flex items-center gap-1.5 px-3.5 py-2 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                title="توليد أكواد QR للأصناف التي لا تحتوي على كود"
              >
                {backfilling ? (
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                ) : (
                  <Sparkles className="w-4 h-4 text-amber-500" />
                )}
                <span>تحديث وتوليد QR للكل</span>
              </button>

              <button
                onClick={handlePrint}
                disabled={selectedIds.size === 0 || totalPrintStickers === 0}
                className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                <Printer className="w-4 h-4" />
                <span>
                  طباعة {totalPrintStickers} ملصق ({selectedIds.size} صنف)
                </span>
              </button>
            </div>
          </div>

          {message && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2">
              <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{message}</span>
            </div>
          )}

          {/* Print Configuration & Batch Controls Bar */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
              {/* Select All & Selection Counts */}
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
                <span className="text-slate-300">|</span>
                <span className="font-bold text-indigo-700">
                  تم تحديد: {selectedIds.size} صنف
                </span>
                <span className="text-slate-300">|</span>
                <span className="font-black text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                  إجمالي الملصقات للطباعة: {totalPrintStickers} ملصق
                </span>
              </div>

              {/* Layout Mode Selector */}
              <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setPrintMode('thermal')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    printMode === 'thermal'
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  طابعة حرارية (استيكر فردي لكل صفحة)
                </button>
                <button
                  type="button"
                  onClick={() => setPrintMode('a4')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    printMode === 'a4'
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  ورق A4 (شبكة ملصقات)
                </button>
              </div>
            </div>

            {/* Quick Bulk Actions for Copies */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/80 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-slate-500 font-bold">تعيين سريع لكميات الطباعة:</span>
                <button
                  type="button"
                  onClick={handleSetAllToStock}
                  className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-lg font-bold transition-colors cursor-pointer flex items-center gap-1"
                >
                  <Package className="w-3.5 h-3.5 text-indigo-600" />
                  <span>تلقائي = رصيد المخزن الفعلي للكل</span>
                </button>
                <button
                  type="button"
                  onClick={handleSetAllToOne}
                  className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-lg font-bold transition-colors cursor-pointer"
                >
                  نسخة واحدة (1) للكل
                </button>
              </div>

              <div className="text-[11px] text-slate-500">
                {printMode === 'thermal'
                  ? 'نمط الطابعة الحرارية: سيتم إرسال كل ملصق بمفرده مع فاصل صفحة (Page Break)'
                  : 'نمط A4: سيتم ترتيب الملصقات في شبكة جاهزة للطباعة والقص'}
              </div>
            </div>
          </div>
        </div>

        {/* Labels Screen Grid Preview */}
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
          <div className="print:hidden grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3.5">
            {labels.map((label) => {
              const isSelected = selectedIds.has(label.variant_id);
              const copyCount = copies[label.variant_id] ?? 1;
              const stock = Number(label.on_hand_quantity || 0);

              return (
                <div
                  key={label.variant_id}
                  onClick={() => toggleSelect(label.variant_id)}
                  className={`relative p-3 rounded-2xl border bg-white shadow-2xs transition-all cursor-pointer select-none text-right flex flex-col justify-between ${
                    isSelected
                      ? 'border-indigo-500 ring-2 ring-indigo-500/20 shadow-xs'
                      : 'border-slate-200 hover:border-slate-300 opacity-60'
                  }`}
                >
                  {/* Select Checkbox Indicator */}
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-1.5">
                      {isSelected ? (
                        <CheckSquare className="w-4 h-4 text-indigo-600 shrink-0" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-300 shrink-0" />
                      )}
                      <span className="font-mono font-black text-sm text-slate-900">
                        {label.model_code}
                      </span>
                    </div>

                    {label.shelf_code && (
                      <span className="font-mono font-black text-[10px] text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded">
                        رف: {label.shelf_code}
                      </span>
                    )}
                  </div>

                  {/* Model Name & Variant details */}
                  <div className="pt-2 space-y-0.5">
                    <div className="text-[11px] font-bold text-slate-700 truncate">
                      {label.model_name}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="font-black text-slate-900">{label.color_name}</span>
                      <span className="text-slate-300">•</span>
                      <span className="font-bold text-indigo-700">{label.size_name}</span>
                    </div>
                  </div>

                  {/* QR Image Center */}
                  <div className="py-2.5 flex items-center justify-center">
                    <img
                      src={label.qr_data_url}
                      alt={label.qr_code_uid}
                      className="w-24 h-24 sm:w-28 sm:h-28 object-contain"
                    />
                  </div>

                  {/* Stock Info & Copies Control */}
                  <div
                    className="pt-2 border-t border-slate-100 space-y-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-500 font-bold">رصيد المخزن:</span>
                      <span
                        className={`font-mono font-black px-1.5 py-0.5 rounded ${
                          stock > 0
                            ? 'text-emerald-700 bg-emerald-50'
                            : 'text-slate-400 bg-slate-100'
                        }`}
                      >
                        {stock} قطعة
                      </span>
                    </div>

                    {/* Copy Count Controller */}
                    <div className="flex items-center justify-between bg-slate-50 p-1.5 rounded-xl border border-slate-200">
                      <span className="text-[10px] font-bold text-slate-600">نسخ الطباعة:</span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => updateCopies(label.variant_id, copyCount - 1)}
                          className="w-6 h-6 rounded-lg bg-white border border-slate-300 flex items-center justify-center font-black text-slate-700 hover:bg-slate-100 active:scale-95 transition-all cursor-pointer"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <input
                          type="number"
                          min="1"
                          max="999"
                          value={copyCount}
                          onChange={(e) =>
                            updateCopies(label.variant_id, parseInt(e.target.value) || 1)
                          }
                          className="w-12 text-center bg-white border border-slate-300 rounded-lg text-xs font-mono font-black py-0.5 text-indigo-700 focus:outline-indigo-500"
                        />
                        <button
                          type="button"
                          onClick={() => updateCopies(label.variant_id, copyCount + 1)}
                          className="w-6 h-6 rounded-lg bg-white border border-slate-300 flex items-center justify-center font-black text-slate-700 hover:bg-slate-100 active:scale-95 transition-all cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {/* Quick reset to stock if different */}
                    {stock > 0 && copyCount !== stock && (
                      <button
                        type="button"
                        onClick={() => updateCopies(label.variant_id, stock)}
                        className="w-full text-center text-[10px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer"
                      >
                        طباعة رصيد المخزن ({stock} استيكر)
                      </button>
                    )}
                  </div>

                  {/* UID/SKU Bar */}
                  <div className="mt-2 text-[9px] font-mono text-slate-400 truncate text-center dir-ltr">
                    {label.qr_code_uid}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* PRINT ONLY RENDER AREA */}
        <div className="hidden print:block">
          {printMode === 'thermal' ? (
            /* THERMAL PRINTER MODE: Each sticker on its own single page alone */
            <div className="thermal-print-container">
              {printableItems.map((item, index) => (
                <div key={`thermal-${item.variant_id}-${index}`} className="thermal-label-sticker">
                  <div className="thermal-sticker-inner">
                    {/* Header */}
                    <div className="flex items-center justify-between w-full border-b border-black pb-1 mb-1">
                      <span className="font-mono font-black text-base tracking-tight text-black">
                        {item.model_code}
                      </span>
                      {item.shelf_code && (
                        <span className="font-mono font-black text-xs text-black border border-black px-1 rounded">
                          رف {item.shelf_code}
                        </span>
                      )}
                    </div>

                    {/* Model & Variant info */}
                    <div className="w-full text-center font-bold text-xs text-black truncate mb-1">
                      {item.model_name}
                    </div>
                    <div className="flex items-center justify-center gap-2 text-xs font-black text-black mb-1">
                      <span>{item.color_name}</span>
                      <span>•</span>
                      <span>مقاس: {item.size_name}</span>
                    </div>

                    {/* QR Code */}
                    <div className="my-1 flex items-center justify-center">
                      <img
                        src={item.qr_data_url}
                        alt={item.qr_code_uid}
                        className="w-32 h-32 object-contain"
                      />
                    </div>

                    {/* Price if available */}
                    {item.default_price > 0 && (
                      <div className="font-mono font-black text-xs text-black text-center mb-0.5">
                        {item.default_price} ج.م
                      </div>
                    )}

                    {/* UID */}
                    <div className="font-mono text-[9px] text-black text-center dir-ltr truncate w-full">
                      {item.qr_code_uid}
                    </div>

                    {/* Copy indicator if multiple */}
                    {item.totalCopies > 1 && (
                      <div className="text-[8px] font-mono text-black text-center mt-0.5">
                        نسخة {item.copyIndex} من {item.totalCopies}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* A4 MULTI-LABEL GRID MODE */
            <div className="a4-print-container">
              {printableItems.map((item, index) => (
                <div key={`a4-${item.variant_id}-${index}`} className="a4-label-card">
                  <div className="flex items-center justify-between pb-1 border-b border-black mb-1">
                    <span className="font-mono font-black text-xs text-black">
                      {item.model_code}
                    </span>
                    {item.shelf_code && (
                      <span className="font-mono font-bold text-[10px] text-black border border-black px-1 rounded">
                        رف {item.shelf_code}
                      </span>
                    )}
                  </div>

                  <div className="text-[10px] font-bold text-black truncate text-center">
                    {item.model_name}
                  </div>
                  <div className="text-[11px] font-black text-black text-center">
                    {item.color_name} • {item.size_name}
                  </div>

                  <div className="py-1 flex items-center justify-center">
                    <img
                      src={item.qr_data_url}
                      alt={item.qr_code_uid}
                      className="w-24 h-24 object-contain"
                    />
                  </div>

                  {item.default_price > 0 && (
                    <div className="font-mono font-bold text-[10px] text-black text-center">
                      {item.default_price} ج.م
                    </div>
                  )}

                  <div className="text-[8px] font-mono text-black text-center dir-ltr truncate">
                    {item.qr_code_uid}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Global CSS for Print Media */}
      <style jsx global>{`
        @media print {
          @page {
            size: auto;
            margin: 0mm;
          }
          body {
            background: white !important;
            color: black !important;
            padding: 0 !important;
            margin: 0 !important;
            font-family: sans-serif !important;
          }
          header,
          aside,
          footer,
          nav,
          button,
          input,
          .print\\:hidden {
            display: none !important;
          }

          /* THERMAL PRINTER FORMAT: 1 sticker alone per page */
          .thermal-print-container {
            display: block !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .thermal-label-sticker {
            page-break-after: always !important;
            break-after: page !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            width: 100vw !important;
            height: 100vh !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            justify-content: center !important;
            box-sizing: border-box !important;
            padding: 4mm !important;
          }
          .thermal-sticker-inner {
            width: 100% !important;
            max-width: 60mm !important;
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            justify-content: center !important;
            box-sizing: border-box !important;
          }

          /* A4 GRID FORMAT */
          .a4-print-container {
            display: grid !important;
            grid-template-columns: repeat(3, 1fr) !important;
            gap: 4mm !important;
            padding: 5mm !important;
          }
          .a4-label-card {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            border: 1px dashed #777 !important;
            border-radius: 4px !important;
            padding: 3mm !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            box-sizing: border-box !important;
          }
        }
      `}</style>
    </AppShell>
  );
}
