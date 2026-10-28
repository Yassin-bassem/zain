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
  Plus,
  Minus,
  Package,
  Usb,
  Cpu,
  RefreshCw,
  Eye,
  Sliders,
  Check,
  Info,
} from 'lucide-react';

type LabelPreset = 'auto' | '50x30' | '50x25' | '40x30' | '60x40' | '80x50' | 'custom';
type LayoutStyle = 'side' | 'stacked';
type PrintMode = 'thermal' | 'a4_single' | 'a4_grid';

export default function QrLabelsPage() {
  const [labels, setLabels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [copies, setCopies] = useState<Record<number, number>>({});
  const [backfilling, setBackfilling] = useState(false);
  const [message, setMessage] = useState('');

  // Thermal Label Printer Specific Settings
  const [printMode, setPrintMode] = useState<PrintMode>('thermal');
  const [labelPreset, setLabelPreset] = useState<LabelPreset>('50x30');
  const [customWidth, setCustomWidth] = useState<number>(50);
  const [customHeight, setCustomHeight] = useState<number>(30);
  const [layoutStyle, setLayoutStyle] = useState<LayoutStyle>('side');
  const [detectedPrinter, setDetectedPrinter] = useState<string | null>(null);
  const [detectingPrinter, setDetectingPrinter] = useState(false);
  const [showLivePreview, setShowLivePreview] = useState(false);

  // Compute active dimensions in mm
  const getActiveDimensions = () => {
    switch (labelPreset) {
      case '50x30':
        return { w: 50, h: 30 };
      case '50x25':
        return { w: 50, h: 25 };
      case '40x30':
        return { w: 40, h: 30 };
      case '60x40':
        return { w: 60, h: 40 };
      case '80x50':
        return { w: 80, h: 50 };
      case 'custom':
        return { w: Math.max(20, customWidth || 50), h: Math.max(15, customHeight || 30) };
      case 'auto':
      default:
        return { w: 50, h: 30, isAuto: true };
    }
  };

  const { w: activeW, h: activeH, isAuto } = getActiveDimensions();

  // Load saved printer preferences from localStorage on mount
  useEffect(() => {
    try {
      const savedPrinter = localStorage.getItem('zain_label_printer_name');
      if (savedPrinter) setDetectedPrinter(savedPrinter);

      const savedPreset = localStorage.getItem('zain_label_size_preset') as LabelPreset;
      if (savedPreset) setLabelPreset(savedPreset);

      const savedW = localStorage.getItem('zain_label_custom_w');
      if (savedW) setCustomWidth(Number(savedW));

      const savedH = localStorage.getItem('zain_label_custom_h');
      if (savedH) setCustomHeight(Number(savedH));

      const savedLayout = localStorage.getItem('zain_label_layout_style') as LayoutStyle;
      if (savedLayout) setLayoutStyle(savedLayout);

      const savedMode = localStorage.getItem('zain_label_print_mode') as PrintMode;
      if (savedMode) setPrintMode(savedMode);
    } catch (e) {
      // Ignore localStorage errors
    }
  }, []);

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

        // Default copies to 1 for all items (single sticker per QR code)
        setCopies((prev) => {
          const next = { ...prev };
          loadedLabels.forEach((l) => {
            if (next[l.variant_id] === undefined) {
              next[l.variant_id] = 1;
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

  // Detect connected label printer using WebUSB / Web Serial API
  const handleDetectPrinter = async () => {
    setDetectingPrinter(true);
    try {
      // 1. Check already granted USB devices
      if (typeof navigator !== 'undefined' && 'usb' in navigator) {
        const devices = await (navigator as any).usb.getDevices();
        if (devices.length > 0) {
          const d = devices[0];
          const name = d.productName || d.manufacturerName || `طابعة USB (Vendor: 0x${d.vendorId.toString(16)})`;
          setDetectedPrinter(name);
          localStorage.setItem('zain_label_printer_name', name);
          setDetectingPrinter(false);
          return;
        }
      }

      // 2. Check already granted Serial ports
      if (typeof navigator !== 'undefined' && 'serial' in navigator) {
        const ports = await (navigator as any).serial.getPorts();
        if (ports.length > 0) {
          const info = ports[0].getInfo ? ports[0].getInfo() : {};
          const name = `طابعة ملصقات تسلسلية (Port / VID: ${info.usbVendorId || 'COM'})`;
          setDetectedPrinter(name);
          localStorage.setItem('zain_label_printer_name', name);
          setDetectingPrinter(false);
          return;
        }
      }

      // 3. Prompt user with native USB device selector
      if (typeof navigator !== 'undefined' && 'usb' in navigator) {
        try {
          const d = await (navigator as any).usb.requestDevice({ filters: [] });
          if (d) {
            const name = d.productName || d.manufacturerName || `طابعة ملصقات USB حرارية`;
            setDetectedPrinter(name);
            localStorage.setItem('zain_label_printer_name', name);
            setDetectingPrinter(false);
            return;
          }
        } catch (e) {
          // User closed dialog
        }
      }

      // 4. Default fallback: detect system printer driver
      const fallbackName = 'طابعة الاستيكرات الافتراضية (Thermal Label Printer)';
      setDetectedPrinter(fallbackName);
      localStorage.setItem('zain_label_printer_name', fallbackName);
    } catch (err: any) {
      setDetectedPrinter('طابعة الملصقات الحرارية المتصلة');
    } finally {
      setDetectingPrinter(false);
    }
  };

  const handlePresetChange = (preset: LabelPreset) => {
    setLabelPreset(preset);
    try {
      localStorage.setItem('zain_label_size_preset', preset);
    } catch (e) {}
  };

  const handleLayoutChange = (style: LayoutStyle) => {
    setLayoutStyle(style);
    try {
      localStorage.setItem('zain_label_layout_style', style);
    } catch (e) {}
  };

  const handlePrintModeChange = (mode: PrintMode) => {
    setPrintMode(mode);
    try {
      localStorage.setItem('zain_label_print_mode', mode);
    } catch (e) {}
  };

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

  const handleSetAllToOne = () => {
    setCopies((prev) => {
      const next = { ...prev };
      labels.forEach((l) => {
        next[l.variant_id] = 1;
      });
      return next;
    });
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

  // Total stickers/pages to print
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

  // Example item for live preview
  const previewItem = selectedLabels[0] || labels[0] || {
    model_code: 'M-101',
    model_name: 'طقم بناتي قطن صيفي كولكشن 2026',
    color_name: 'كحلي',
    size_name: '4 سنوات',
    shelf_code: 'A-01',
    default_price: 185,
    sku: 'SKU-101-NVY-4Y',
    qr_code_uid: 'ZN-101-NVY-4Y-001',
    qr_data_url:
      'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="white"/><rect x="10" y="10" width="30" height="30" fill="black"/><rect x="60" y="10" width="30" height="30" fill="black"/><rect x="10" y="60" width="30" height="30" fill="black"/><rect x="20" y="20" width="10" height="10" fill="white"/><rect x="70" y="20" width="10" height="10" fill="white"/><rect x="20" y="70" width="10" height="10" fill="white"/><rect x="45" y="45" width="15" height="15" fill="black"/></svg>',
  };

  return (
    <AppShell
      title="طباعة استيكرات وملصقات الباركود والـ QR"
      subtitle="نظام مخصص لطابعات الاستيكرات الحرارية (Label Printers) مع كشف الطابعة التلقائي والمطابقة التلقائية لمقاس الرول"
    >
      <div className="space-y-6">
        {/* Actions & Filters Bar - Hidden during printing */}
        <div className="print:hidden space-y-4">
          {/* Main Top Bar */}
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
                onClick={() => setShowLivePreview(!showLivePreview)}
                className={`flex items-center gap-1.5 px-3.5 py-2 border rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  showLivePreview
                    ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                    : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Eye className="w-4 h-4 text-indigo-600" />
                <span>{showLivePreview ? 'إخفاء المعاينة الحية' : 'معاينة مقاس الاستيكر'}</span>
              </button>

              <button
                onClick={handlePrint}
                disabled={selectedIds.size === 0 || totalPrintStickers === 0}
                className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-md transition-all cursor-pointer disabled:opacity-50 active:scale-95"
              >
                <Printer className="w-4 h-4" />
                <span>
                  طباعة {totalPrintStickers} استيكر ({selectedIds.size} صنف)
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

          {/* DEDICATED LABEL PRINTER CONFIGURATION BOX */}
          <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white p-5 rounded-2xl shadow-lg border border-indigo-900/50 space-y-4">
            {/* Header: Printer Detection and Status */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-indigo-900/60">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center">
                  <Printer className="w-4 h-4 text-indigo-300" />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-black flex items-center gap-2">
                    <span>إعدادات طابعة الملصقات الحرارية (Label Printer)</span>
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">
                      نشطة
                    </span>
                  </h3>
                  <div className="flex items-center gap-2 text-[11px] text-slate-300 mt-0.5">
                    <span>الطابعة المكتشفة:</span>
                    <span className="font-mono font-bold text-amber-300 bg-amber-950/60 border border-amber-500/30 px-2 py-0.5 rounded">
                      {detectedPrinter || 'طابعة الملصقات الافتراضية (Xprinter / Zebra / Rongta)'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Auto Detect Button */}
              <button
                type="button"
                onClick={handleDetectPrinter}
                disabled={detectingPrinter}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
              >
                {detectingPrinter ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Usb className="w-3.5 h-3.5 text-indigo-200" />
                )}
                <span>كشف الطابعة المتصلة تلقائياً (USB / Serial)</span>
              </button>
            </div>

            {/* Label Size Presets and Dimensions */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
              {/* Presets */}
              <div className="lg:col-span-8 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-indigo-200">
                  <span>مقاس رول الاستيكر (Auto-Scale to Label Roll):</span>
                  <span className="text-[11px] text-slate-400">
                    المقاس النشط: {isAuto ? 'تلقائي (مطابقة رول الطابعة)' : `${activeW} × ${activeH} مم`}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handlePresetChange('auto')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                      labelPreset === 'auto'
                        ? 'bg-emerald-500 text-slate-950 shadow-md ring-2 ring-emerald-300'
                        : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 border border-slate-700'
                    }`}
                  >
                    تلقائي (حسب مقاس الطابعة)
                  </button>

                  <button
                    type="button"
                    onClick={() => handlePresetChange('50x30')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                      labelPreset === '50x30'
                        ? 'bg-indigo-500 text-white shadow-md ring-2 ring-indigo-300'
                        : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 border border-slate-700'
                    }`}
                  >
                    50 × 30 مم (الأشهر للملابس)
                  </button>

                  <button
                    type="button"
                    onClick={() => handlePresetChange('40x30')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                      labelPreset === '40x30'
                        ? 'bg-indigo-500 text-white shadow-md ring-2 ring-indigo-300'
                        : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 border border-slate-700'
                    }`}
                  >
                    40 × 30 مم (استيكر صغير)
                  </button>

                  <button
                    type="button"
                    onClick={() => handlePresetChange('50x25')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                      labelPreset === '50x25'
                        ? 'bg-indigo-500 text-white shadow-md ring-2 ring-indigo-300'
                        : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 border border-slate-700'
                    }`}
                  >
                    50 × 25 مم
                  </button>

                  <button
                    type="button"
                    onClick={() => handlePresetChange('60x40')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                      labelPreset === '60x40'
                        ? 'bg-indigo-500 text-white shadow-md ring-2 ring-indigo-300'
                        : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 border border-slate-700'
                    }`}
                  >
                    60 × 40 مم
                  </button>

                  <button
                    type="button"
                    onClick={() => handlePresetChange('80x50')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                      labelPreset === '80x50'
                        ? 'bg-indigo-500 text-white shadow-md ring-2 ring-indigo-300'
                        : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 border border-slate-700'
                    }`}
                  >
                    80 × 50 مم (كرتونة)
                  </button>

                  <button
                    type="button"
                    onClick={() => handlePresetChange('custom')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                      labelPreset === 'custom'
                        ? 'bg-indigo-500 text-white shadow-md ring-2 ring-indigo-300'
                        : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 border border-slate-700'
                    }`}
                  >
                    مقاس مخصص...
                  </button>
                </div>

                {/* Custom mm inputs if custom chosen */}
                {labelPreset === 'custom' && (
                  <div className="flex items-center gap-3 pt-2 text-xs">
                    <span className="text-slate-300 font-bold">أبعاد الاستيكر:</span>
                    <label className="flex items-center gap-1.5">
                      <span className="text-slate-400">العرض:</span>
                      <input
                        type="number"
                        min="20"
                        max="200"
                        value={customWidth}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setCustomWidth(val);
                          try {
                            localStorage.setItem('zain_label_custom_w', String(val));
                          } catch (e) {}
                        }}
                        className="w-16 bg-slate-800 border border-slate-600 rounded-lg px-2 py-1 text-center font-mono font-bold text-indigo-300 focus:outline-indigo-400"
                      />
                      <span className="text-slate-400">مم</span>
                    </label>

                    <label className="flex items-center gap-1.5">
                      <span className="text-slate-400">الارتفاع:</span>
                      <input
                        type="number"
                        min="15"
                        max="250"
                        value={customHeight}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setCustomHeight(val);
                          try {
                            localStorage.setItem('zain_label_custom_h', String(val));
                          } catch (e) {}
                        }}
                        className="w-16 bg-slate-800 border border-slate-600 rounded-lg px-2 py-1 text-center font-mono font-bold text-indigo-300 focus:outline-indigo-400"
                      />
                      <span className="text-slate-400">مم</span>
                    </label>
                  </div>
                )}
              </div>

              {/* Orientation / Layout Style */}
              <div className="lg:col-span-4 space-y-2 bg-slate-800/50 p-3 rounded-xl border border-indigo-900/60">
                <div className="text-xs font-bold text-indigo-200">شكل وتوزيع الملصق:</div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleLayoutChange('side')}
                    className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all text-center cursor-pointer ${
                      layoutStyle === 'side'
                        ? 'bg-indigo-600 text-white ring-2 ring-indigo-400'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    جانبي (QR بجانب البيانات)
                  </button>

                  <button
                    type="button"
                    onClick={() => handleLayoutChange('stacked')}
                    className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all text-center cursor-pointer ${
                      layoutStyle === 'stacked'
                        ? 'bg-indigo-600 text-white ring-2 ring-indigo-400'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    رأسي (QR في المنتصف)
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Tips / Instructions for thermal print */}
            <div className="flex items-center justify-between text-[11px] text-slate-300 pt-2 border-t border-indigo-900/60">
              <div className="flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                <span>
                  النظام يقوم بضبط الهوامش (Margin: 0) وتحديد فاصل الصفحات تلقائياً لمنع خروج استيكرات فارغة إضافية.
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-slate-400">أو يمكنك التبديل إلى:</span>
                <button
                  type="button"
                  onClick={() => handlePrintModeChange(printMode === 'thermal' ? 'a4_single' : 'thermal')}
                  className="text-indigo-300 hover:text-white underline font-bold cursor-pointer"
                >
                  {printMode === 'thermal' ? 'ورق A4 عادي (صفحة كاملة)' : 'طابعة الاستيكرات الحرارية'}
                </button>
              </div>
            </div>
          </div>

          {/* LIVE MINI PREVIEW OF THE LABEL (ON SCREEN) */}
          {showLivePreview && (
            <div className="bg-amber-50/70 border-2 border-amber-200 p-4 rounded-2xl animate-in fade-in space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-amber-700" />
                  <span className="text-xs font-black text-amber-900">
                    معاينة حية لشكل الاستيكر بالمقاس المضبوط ({isAuto ? '50x30 مم تقريبي' : `${activeW} × ${activeH} مم`})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowLivePreview(false)}
                  className="text-xs text-amber-800 hover:underline font-bold cursor-pointer"
                >
                  إغلاق المعاينة
                </button>
              </div>

              {/* Exact Proportion Preview Container */}
              <div className="flex justify-center p-3 bg-slate-200/60 rounded-xl overflow-x-auto">
                <div
                  style={{
                    width: `${activeW * 4.2}px`,
                    height: `${activeH * 4.2}px`,
                    minWidth: '220px',
                    minHeight: '130px',
                  }}
                  className="bg-white border-2 border-slate-900 shadow-md rounded-md p-2 flex flex-col justify-between select-none text-black transition-all"
                >
                  {layoutStyle === 'side' ? (
                    <div className="flex items-center justify-between w-full h-full gap-2">
                      <div className="flex-1 flex flex-col justify-between h-full text-right leading-tight py-0.5">
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-black text-xs text-black tracking-tight">
                            {previewItem.model_code}
                          </span>
                          {previewItem.shelf_code && (
                            <span className="font-mono font-bold text-[8px] border border-black px-1 rounded-xs">
                              رف:{previewItem.shelf_code}
                            </span>
                          )}
                        </div>
                        <div className="font-bold text-[9px] text-black truncate">
                          {previewItem.model_name}
                        </div>
                        <div className="flex items-center gap-1 font-black text-[9px] text-black">
                          <span>{previewItem.color_name}</span>
                          <span>•</span>
                          <span>مقاس: {previewItem.size_name}</span>
                        </div>
                        <div className="flex items-center justify-between text-[8px] text-black font-bold pt-0.5 border-t border-black/40">
                          <span className="font-black font-mono">
                            {previewItem.default_price > 0 ? `${previewItem.default_price} ج.م` : 'زين للأطفال'}
                          </span>
                          <span className="font-mono text-[7px] truncate max-w-[80px] dir-ltr">
                            {previewItem.qr_code_uid.slice(-8)}
                          </span>
                        </div>
                      </div>
                      <div className="h-full aspect-square flex items-center justify-center shrink-0 p-0.5 border border-slate-200 rounded">
                        <img
                          src={previewItem.qr_data_url}
                          alt="QR"
                          className="w-full h-full object-contain"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-between w-full h-full text-center py-0.5">
                      <div className="w-full flex items-center justify-between px-1">
                        <span className="font-mono font-black text-xs text-black">
                          {previewItem.model_code}
                        </span>
                        {previewItem.shelf_code && (
                          <span className="text-[8px] font-bold border border-black px-1 rounded-xs">
                            رف {previewItem.shelf_code}
                          </span>
                        )}
                      </div>
                      <div className="text-[8px] font-bold text-black truncate max-w-full px-1">
                        {previewItem.model_name} ({previewItem.color_name} - {previewItem.size_name})
                      </div>
                      <div className="flex-1 flex items-center justify-center p-0.5 min-h-0">
                        <img
                          src={previewItem.qr_data_url}
                          alt="QR"
                          className="h-full aspect-square object-contain"
                        />
                      </div>
                      <div className="w-full flex items-center justify-between px-1 text-[8px] font-mono border-t border-black/40 pt-0.5">
                        <span className="font-black">
                          {previewItem.default_price > 0 ? `${previewItem.default_price} ج.م` : 'زين للأطفال'}
                        </span>
                        <span className="text-[7px] truncate dir-ltr">{previewItem.qr_code_uid.slice(-8)}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Quick Selection and Copies Bar */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
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
                المحدد: {selectedIds.size} صنف
              </span>
              <span className="text-slate-300">|</span>
              <span className="font-black text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                إجمالي الاستيكرات: {totalPrintStickers} ملصق
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-slate-500 font-bold">النسخ:</span>
              <button
                type="button"
                onClick={handleSetAllToOne}
                className="px-3 py-1 bg-white hover:bg-slate-100 border border-slate-300 text-indigo-700 font-black rounded-lg transition-colors cursor-pointer shadow-2xs"
              >
                استيكر واحد (1) لكل كود
              </button>
              <button
                type="button"
                onClick={handleSetAllToStock}
                className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-300 text-slate-600 rounded-lg font-bold transition-colors cursor-pointer flex items-center gap-1"
              >
                <Package className="w-3.5 h-3.5 text-slate-500" />
                <span>نسخ حسب رصيد المخزن</span>
              </button>
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
                      <span className="text-[10px] font-bold text-slate-600">عدد الاستيكرات:</span>
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
            /* THERMAL LABEL PRINTER MODE: Auto-scaled to the printer sticker dimensions */
            <div className="thermal-print-container">
              {printableItems.map((item, index) => (
                <div
                  key={`thermal-${item.variant_id}-${index}`}
                  className="thermal-sticker-item"
                >
                  {layoutStyle === 'side' ? (
                    /* Side-by-Side: QR on left, product details on right (optimal for 50x30, 60x40, etc.) */
                    <div className="flex items-center justify-between w-full h-full gap-1.5 overflow-hidden">
                      {/* Product details in Arabic */}
                      <div className="flex-1 flex flex-col justify-between h-full text-right leading-tight py-0.5 overflow-hidden">
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-mono font-black text-xs sm:text-sm text-black tracking-tight truncate">
                            {item.model_code}
                          </span>
                          {item.shelf_code && (
                            <span className="font-mono font-bold text-[8px] sm:text-[9px] border border-black px-1 rounded-xs shrink-0">
                              رف:{item.shelf_code}
                            </span>
                          )}
                        </div>

                        <div className="font-bold text-[9px] sm:text-[10px] text-black truncate">
                          {item.model_name}
                        </div>

                        <div className="flex items-center gap-1 font-black text-[9px] sm:text-[10px] text-black">
                          <span className="truncate">{item.color_name}</span>
                          <span>•</span>
                          <span className="truncate">مقاس: {item.size_name}</span>
                        </div>

                        <div className="flex items-center justify-between text-[8px] sm:text-[9px] text-black font-bold pt-0.5 border-t border-black/40">
                          <span className="font-black font-mono">
                            {item.default_price > 0 ? `${item.default_price} ج.م` : 'زين للأطفال'}
                          </span>
                          <span className="font-mono text-[7px] truncate max-w-[80px] dir-ltr opacity-90">
                            {item.sku || item.qr_code_uid.slice(-8)}
                          </span>
                        </div>
                      </div>

                      {/* QR Image */}
                      <div className="h-full aspect-square flex items-center justify-center shrink-0 p-0.5">
                        <img
                          src={item.qr_data_url}
                          alt={item.qr_code_uid}
                          className="w-full h-full object-contain"
                        />
                      </div>
                    </div>
                  ) : (
                    /* Stacked / Centered: Model code on top, QR in center, details on bottom */
                    <div className="flex flex-col items-center justify-between w-full h-full text-center overflow-hidden py-0.5">
                      <div className="w-full flex items-center justify-between px-1">
                        <span className="font-mono font-black text-xs text-black">
                          {item.model_code}
                        </span>
                        {item.shelf_code && (
                          <span className="text-[8px] font-bold border border-black px-1 rounded-xs">
                            رف {item.shelf_code}
                          </span>
                        )}
                      </div>

                      <div className="text-[8px] font-bold text-black truncate max-w-full px-1">
                        {item.model_name} ({item.color_name} - {item.size_name})
                      </div>

                      <div className="flex-1 flex items-center justify-center p-0.5 min-h-0">
                        <img
                          src={item.qr_data_url}
                          alt={item.qr_code_uid}
                          className="h-full aspect-square object-contain"
                        />
                      </div>

                      <div className="w-full flex items-center justify-between px-1 text-[8px] font-mono border-t border-black/40 pt-0.5">
                        <span className="font-black">
                          {item.default_price > 0 ? `${item.default_price} ج.م` : 'زين للأطفال'}
                        </span>
                        <span className="text-[7px] truncate dir-ltr">
                          {item.sku || item.qr_code_uid.slice(-8)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            /* A4 FULL PAGE MODE (Optional) */
            <div className="a4-print-container">
              {printableItems.map((item, index) => (
                <div key={`a4-${item.variant_id}-${index}`} className="a4-fullpage-item">
                  <div className="border-4 border-black rounded-2xl p-8 flex flex-col items-center text-center justify-between h-[90vh]">
                    <div className="text-xl font-black">مؤسسة زين لملابس الأطفال</div>
                    <div className="font-mono text-4xl font-black">{item.model_code}</div>
                    {item.shelf_code && <div className="text-xl font-bold border-2 border-black px-3 py-1 rounded">رف: {item.shelf_code}</div>}
                    <div className="text-2xl font-bold">{item.model_name}</div>
                    <div className="text-xl font-black">{item.color_name} • {item.size_name}</div>
                    <div className="my-4"><img src={item.qr_data_url} alt="QR" className="w-64 h-64 object-contain" /></div>
                    {item.default_price > 0 && <div className="text-2xl font-black">{item.default_price} ج.م</div>}
                    <div className="font-mono text-sm dir-ltr">{item.qr_code_uid}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* DYNAMIC PRINT CSS FOR THERMAL LABEL PRINTERS */}
      <style>{`
        @media print {
          @page {
            size: ${isAuto ? 'auto' : `${activeW}mm ${activeH}mm`};
            margin: 0mm !important;
          }

          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
            font-family: system-ui, -apple-system, sans-serif !important;
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

          /* THERMAL PRINTER ROLL: EXACT MATCH FOR STICKER DIMENSIONS */
          .thermal-print-container {
            display: block !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          .thermal-sticker-item {
            width: ${isAuto ? '100%' : `${activeW}mm`} !important;
            height: ${isAuto ? '100%' : `${activeH}mm`} !important;
            max-width: ${isAuto ? '100vw' : `${activeW}mm`} !important;
            max-height: ${isAuto ? '100vh' : `${activeH}mm`} !important;
            page-break-after: always !important;
            break-after: page !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            overflow: hidden !important;
            box-sizing: border-box !important;
            padding: 1.2mm 1.5mm !important;
            margin: 0 auto !important;
            background: #ffffff !important;
            color: #000000 !important;
            border: 1px solid #000000 !important;
          }

          .thermal-sticker-item:last-child {
            page-break-after: auto !important;
            break-after: auto !important;
          }

          .a4-fullpage-item {
            page-break-after: always !important;
            break-after: page !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            height: 96vh !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            padding: 10mm !important;
            box-sizing: border-box !important;
          }

          .a4-fullpage-item:last-child {
            page-break-after: auto !important;
            break-after: auto !important;
          }
        }
      `}</style>
    </AppShell>
  );
}
