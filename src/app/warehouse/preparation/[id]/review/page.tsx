'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import {
  QrCode,
  Camera,
  CameraOff,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  XCircle,
  RotateCcw,
  ArrowRight,
  Loader2,
  Check,
  Package,
  Layers,
  Search,
  Volume2,
  VolumeX,
} from 'lucide-react';

function OrderReviewQrContent() {
  const router = useRouter();
  const params = useParams();
  const orderId = params.id as string;

  const [sessionData, setSessionData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Scanner state
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [isSubmittingScan, setIsSubmittingScan] = useState(false);
  const [lastScanResult, setLastScanResult] = useState<any>(null);
  const [confirmingReview, setConfirmingReview] = useState(false);
  const [confirmError, setConfirmError] = useState('');
  const [confirmSuccess, setConfirmSuccess] = useState(false);

  const html5QrCodeRef = useRef<any>(null);
  const manualInputRef = useRef<HTMLInputElement>(null);

  const fetchSession = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/preparation/${orderId}/review`);
      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || 'تعذر تحميل جلسة المراجعة');
      }
      const json = await res.json();
      setSessionData(json);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSession();
  }, [orderId]);

  // Handle camera start/stop
  const startCamera = async () => {
    try {
      setIsCameraActive(true);
      const { Html5Qrcode } = await import('html5-qrcode');

      if (!html5QrCodeRef.current) {
        html5QrCodeRef.current = new Html5Qrcode('qr-reader-container');
      }

      await html5QrCodeRef.current.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        (decodedText: string) => {
          handleScanCode(decodedText);
        },
        () => {
          // Frame error (ignore)
        }
      );
    } catch (err: any) {
      console.error('Camera start error:', err);
      alert('تعذر فتح الكاميرا: ' + (err.message || 'يرجى التأكد من السماح بالوصول للكاميرا.'));
      setIsCameraActive(false);
    }
  };

  const stopCamera = async () => {
    if (html5QrCodeRef.current && isCameraActive) {
      try {
        await html5QrCodeRef.current.stop();
        html5QrCodeRef.current = null;
      } catch (e) {
        console.error('Camera stop error:', e);
      }
    }
    setIsCameraActive(false);
  };

  useEffect(() => {
    return () => {
      if (html5QrCodeRef.current && isCameraActive) {
        try {
          html5QrCodeRef.current.stop();
        } catch {}
      }
    };
  }, [isCameraActive]);

  const handleScanCode = async (codeToScan: string) => {
    if (!codeToScan.trim() || isSubmittingScan) return;
    if (!sessionData?.session?.id) return;

    try {
      setIsSubmittingScan(true);
      const idempotencyKey = `SCAN-${sessionData.session.id}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

      const res = await fetch(`/api/preparation/${orderId}/review/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionData.session.id,
          code: codeToScan.trim(),
          idempotency_key: idempotencyKey,
        }),
      });

      const result = await res.json();
      setLastScanResult(result);

      if (res.ok) {
        setManualCode('');
        // Refresh session items & scans
        fetchSession();
      }
    } catch (err: any) {
      console.error('Scan error:', err);
    } finally {
      setIsSubmittingScan(false);
      if (manualInputRef.current) {
        manualInputRef.current.focus();
      }
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      handleScanCode(manualCode.trim());
    }
  };

  const handleUndo = async (scanId: number) => {
    if (!confirm('هل تريد التراجع عن تسجيل هذه القطعة؟')) return;
    try {
      const res = await fetch(`/api/preparation/${orderId}/review/undo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionData.session.id,
          scan_id: scanId,
        }),
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || 'فشل التراجع عن الفحص');
      fetchSession();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleConfirmCompletion = async () => {
    if (!sessionData?.session?.id) return;
    try {
      setConfirmingReview(true);
      setConfirmError('');
      const res = await fetch(`/api/preparation/${orderId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionData.session.id,
        }),
      });

      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || 'فشل تأكيد المراجعة');

      setConfirmSuccess(true);
      setTimeout(() => {
        router.push(`/warehouse/preparation/${orderId}`);
      }, 1500);
    } catch (err: any) {
      setConfirmError(err.message);
    } finally {
      setConfirmingReview(false);
    }
  };

  if (loading) {
    return (
      <AppShell title="مراجعة الأوردر والباركود" subtitle="جارٍ التحميل...">
        <div className="py-24 text-center">
          <Loader2 className="w-10 h-10 animate-spin text-indigo-600 mx-auto mb-3" />
          <p className="text-xs font-bold text-slate-500">جارٍ تهيئة جلسة الفحص وتجهيز الباركود...</p>
        </div>
      </AppShell>
    );
  }

  if (error || !sessionData) {
    return (
      <AppShell title="خطأ في جلسة المراجعة" subtitle="تعذر جلب البيانات">
        <div className="p-8 max-w-xl mx-auto bg-white rounded-2xl border border-rose-200 text-center space-y-4">
          <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto" />
          <h2 className="text-base font-black text-slate-900">{error}</h2>
          <Link
            href={`/warehouse/preparation/${orderId}`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-bold"
          >
            <ArrowRight className="w-4 h-4" />
            <span>العودة لشاشة الفاتورة</span>
          </Link>
        </div>
      </AppShell>
    );
  }

  const { session, items, scans } = sessionData;

  const totalRequired = items.reduce((acc: number, it: any) => acc + Number(it.quantity_required), 0);
  const totalScanned = items.reduce((acc: number, it: any) => acc + Number(it.quantity_scanned || 0), 0);
  const totalMissing = Math.max(0, totalRequired - totalScanned);
  const completedVariantsCount = items.filter((it: any) => it.quantity_scanned >= it.quantity_required).length;
  const incompleteVariantsCount = items.length - completedVariantsCount;
  const excessScansCount = scans.filter((s: any) => s.status === 'excess').length;
  const wrongScansCount = scans.filter((s: any) => s.status === 'wrong').length;

  const canConfirm = totalMissing === 0 && excessScansCount === 0 && session.status === 'in_progress';

  return (
    <AppShell
      title={`مراجعة الأوردر وفحص الباركود: فاتورة #${orderId}`}
      subtitle="يقوم الموظف بمسح استيكر QR لكل قطعة ملابس للتحقق من مطابقة الموديل واللون والمقاس والكمية"
    >
      <div className="space-y-6">
        {/* Navigation Header */}
        <div className="flex items-center justify-between">
          <Link
            href={`/warehouse/preparation/${orderId}`}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors"
          >
            <ArrowRight className="w-4 h-4" />
            <span>العودة لشاشة تحضير الفاتورة</span>
          </Link>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-600">
              جلسة مراجعة رقم: <span className="font-mono text-indigo-700 font-black">#{session.id}</span>
            </span>
          </div>
        </div>

        {/* Live Metrics Dashboard */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
            <span className="text-[11px] font-bold text-slate-500">إجمالي المطلوب</span>
            <div className="mt-1 text-2xl font-black text-slate-900">{totalRequired}</div>
            <div className="text-[10px] text-slate-400">قطعة بالفاتورة</div>
          </div>

          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
            <span className="text-[11px] font-bold text-slate-500">تم مسحه بنجاح</span>
            <div className="mt-1 text-2xl font-black text-emerald-600">{totalScanned}</div>
            <div className="text-[10px] text-emerald-700 font-bold">
              {totalRequired > 0 ? `${Math.round((totalScanned / totalRequired) * 100)}% مستوفى` : '0%'}
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
            <span className="text-[11px] font-bold text-slate-500">القطع الناقصة</span>
            <div className={`mt-1 text-2xl font-black ${totalMissing > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
              {totalMissing}
            </div>
            <div className="text-[10px] text-slate-400">بانتظار الفحص</div>
          </div>

          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
            <span className="text-[11px] font-bold text-slate-500">أصناف مكتملة</span>
            <div className="mt-1 text-2xl font-black text-indigo-600">
              {completedVariantsCount} / {items.length}
            </div>
            <div className="text-[10px] text-indigo-700 font-bold">متغيرات مطابقة 100%</div>
          </div>

          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
            <span className="text-[11px] font-bold text-slate-500">قطع زائدة</span>
            <div className={`mt-1 text-2xl font-black ${excessScansCount > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
              {excessScansCount}
            </div>
            <div className="text-[10px] text-slate-400">تجاوزت المطلوب</div>
          </div>

          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
            <span className="text-[11px] font-bold text-slate-500">أصناف غير مطلوبة</span>
            <div className={`mt-1 text-2xl font-black ${wrongScansCount > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
              {wrongScansCount}
            </div>
            <div className="text-[10px] text-slate-400">تم رفضها تلقائياً</div>
          </div>
        </div>

        {/* Scanning Controls Box */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Scanner Box (Left Column on large) */}
          <div className="lg:col-span-5 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-black text-slate-900 text-sm flex items-center gap-2">
                <QrCode className="w-5 h-5 text-indigo-600" />
                <span>ماسح الباركود وQR المباشر</span>
              </h3>
              <div className="flex items-center gap-2">
                {!isCameraActive ? (
                  <button
                    onClick={startCamera}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>تشغيل الكاميرا</span>
                  </button>
                ) : (
                  <button
                    onClick={stopCamera}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    <CameraOff className="w-3.5 h-3.5" />
                    <span>إيقاف الكاميرا</span>
                  </button>
                )}
              </div>
            </div>

            {/* Camera Preview Area */}
            {isCameraActive ? (
              <div className="relative rounded-2xl overflow-hidden bg-slate-950 aspect-square flex items-center justify-center border-2 border-indigo-500">
                <div id="qr-reader-container" className="w-full h-full" />
                <div className="absolute top-3 right-3 bg-slate-900/80 text-white px-2.5 py-1 rounded-full text-[10px] font-bold">
                  الكاميرا نشطة - وجّه الملصق
                </div>
              </div>
            ) : (
              <div
                onClick={startCamera}
                className="rounded-2xl border-2 border-dashed border-slate-300 p-8 text-center bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer space-y-2"
              >
                <Camera className="w-10 h-10 text-slate-400 mx-auto" />
                <div className="font-bold text-slate-700 text-xs">اضغط هنا لتشغيل كاميرا الهاتف أو اللابتوب</div>
                <div className="text-[11px] text-slate-400">
                  يمكن أيضاً استخدام قارئ الباركود اللاسلكي USB مباشرة بالكتابة أدناه
                </div>
              </div>
            )}

            {/* Manual SKU / Barcode Fallback Input */}
            <form onSubmit={handleManualSubmit} className="space-y-2 pt-2 border-t border-slate-100">
              <label className="block font-bold text-slate-700 text-xs">
                إدخال يدوي أو مسح بسكانر خارجي (USB / بلوتوث):
              </label>
              <div className="flex items-center gap-2">
                <input
                  ref={manualInputRef}
                  type="text"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  placeholder="امسح الباركود أو اكتب الكود واضغط Enter..."
                  className="flex-1 bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:bg-white focus:border-indigo-500"
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={isSubmittingScan || !manualCode.trim()}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingScan ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>فحص</span>}
                </button>
              </div>
              <p className="text-[10px] text-slate-400">
                يدعم قارئ الباركود اليدوي إرسال مفتاح Enter تلقائياً بعد كل مسح
              </p>
            </form>

            {/* Live Scan Outcome Banner */}
            {lastScanResult && (
              <div
                className={`p-4 rounded-xl border text-xs space-y-1 transition-all ${
                  lastScanResult.outcome === 'correct'
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                    : lastScanResult.outcome === 'excess'
                    ? 'bg-amber-50 border-amber-300 text-amber-900'
                    : lastScanResult.outcome === 'wrong'
                    ? 'bg-rose-50 border-rose-300 text-rose-900'
                    : 'bg-slate-100 border-slate-300 text-slate-800'
                }`}
              >
                <div className="flex items-center gap-2 font-black text-sm">
                  {lastScanResult.outcome === 'correct' && <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
                  {lastScanResult.outcome === 'excess' && <AlertTriangle className="w-5 h-5 text-amber-600" />}
                  {lastScanResult.outcome === 'wrong' && <XCircle className="w-5 h-5 text-rose-600" />}
                  {lastScanResult.outcome === 'unknown' && <AlertCircle className="w-5 h-5 text-slate-600" />}
                  <span>{lastScanResult.message}</span>
                </div>
                {lastScanResult.variant && (
                  <div className="text-[11px] text-slate-600 pt-1 flex items-center justify-between">
                    <span>
                      الموديل: {lastScanResult.variant.model_code} • الرف: {lastScanResult.variant.shelf_code || 'غير محدد'}
                    </span>
                    {lastScanResult.remaining_quantity !== undefined && (
                      <span className="font-bold">المتبقي: {lastScanResult.remaining_quantity} قطعة</span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Verification Items Checklist Table (Right Column) */}
          <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col justify-between">
            <div>
              <div className="p-4 bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-800 flex items-center justify-between">
                <span>جدول مطابقة الأصناف بالفاتورة ({items.length} صنف)</span>
                <span className="text-slate-500 font-mono">
                  {completedVariantsCount} من {items.length} مكتمل
                </span>
              </div>

              <div className="overflow-x-auto max-h-[460px] overflow-y-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0 border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">الموديل</th>
                      <th className="py-2.5 px-3">اللون</th>
                      <th className="py-2.5 px-3">المقاس</th>
                      <th className="py-2.5 px-3">الرف</th>
                      <th className="py-2.5 px-3 text-center">المطلوب</th>
                      <th className="py-2.5 px-3 text-center">المفحوص</th>
                      <th className="py-2.5 px-3 text-center">المتبقي</th>
                      <th className="py-2.5 px-3 text-center">الحالة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.map((it: any) => {
                      const req = Number(it.quantity_required);
                      const scanned = Number(it.quantity_scanned || 0);
                      const rem = Math.max(0, req - scanned);
                      const isDone = scanned >= req;

                      return (
                        <tr
                          key={it.variant_id}
                          className={`hover:bg-slate-50 transition-colors ${isDone ? 'bg-emerald-50/40' : ''}`}
                        >
                          <td className="py-2.5 px-3 font-bold font-mono text-indigo-700">
                            {it.model_code}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-slate-800">{it.color_name}</td>
                          <td className="py-2.5 px-3 text-slate-700">{it.size_name}</td>
                          <td className="py-2.5 px-3">
                            <span className="font-mono text-[10px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded">
                              {it.shelf_code || '—'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center font-bold font-mono">{req}</td>
                          <td className="py-2.5 px-3 text-center font-bold font-mono text-emerald-700">
                            {scanned}
                          </td>
                          <td className="py-2.5 px-3 text-center font-bold font-mono">
                            {rem > 0 ? (
                              <span className="text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded font-black">
                                {rem}
                              </span>
                            ) : (
                              <span className="text-slate-400">0</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {isDone ? (
                              <span className="inline-flex items-center gap-1 text-emerald-700 font-bold text-[11px]">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>مكتمل</span>
                              </span>
                            ) : (
                              <span className="text-amber-700 font-bold text-[11px]">ناقص ({rem})</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Final Confirmation Action Bar */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div>
                {canConfirm ? (
                  <div className="flex items-center gap-2 text-emerald-700 font-bold text-xs">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <span>تمت مطابقة وفحص 100% من أصناف الفاتورة بنجاح! جاهز للاعتماد.</span>
                  </div>
                ) : (
                  <div className="text-amber-800 text-xs font-bold">
                    <span>بانتظار استكمال فحص كافة القطع الناقصة ({totalMissing} قطعة متبقية).</span>
                  </div>
                )}
                {confirmError && (
                  <div className="text-rose-600 font-bold text-xs mt-1">{confirmError}</div>
                )}
                {confirmSuccess && (
                  <div className="text-emerald-700 font-bold text-xs mt-1">
                    تم اعتماد مراجعة الأوردر بنجاح! جارٍ التحويل...
                  </div>
                )}
              </div>

              <button
                onClick={handleConfirmCompletion}
                disabled={!canConfirm || confirmingReview}
                className="px-6 py-2.5 rounded-xl font-black text-xs text-white shadow-xs transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed bg-emerald-600 hover:bg-emerald-700"
              >
                {confirmingReview ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                <span>تأكيد مراجعة الأوردر</span>
              </button>
            </div>
          </div>
        </div>

        {/* Scan Audit Log History */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="font-black text-slate-900 text-sm flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-slate-600" />
              <span>سجل حركات الفحص في هذه الجلسة ({scans.length} عملية فحص)</span>
            </h3>
            <span className="text-xs text-slate-400">يمكن التراجع عن أي فحص مسجل بالخطأ</span>
          </div>

          {scans.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs">
              لم يتم تسجيل أي عمليات فحص بعد في هذه الجلسة.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">الوقت</th>
                    <th className="py-2.5 px-3">الصنف والموديل</th>
                    <th className="py-2.5 px-3">اللون والمقاس</th>
                    <th className="py-2.5 px-3">الكود الممسوح</th>
                    <th className="py-2.5 px-3">نتيجة الفحص</th>
                    <th className="py-2.5 px-3">الموظف</th>
                    <th className="py-2.5 px-3 text-center">إجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {scans.slice(0, 30).map((scan: any) => (
                    <tr key={scan.id} className="hover:bg-slate-50">
                      <td className="py-2 px-3 text-slate-400 font-mono text-[11px]">
                        {new Date(scan.created_at).toLocaleTimeString('ar-EG')}
                      </td>
                      <td className="py-2 px-3 font-bold text-slate-900">
                        {scan.model_code} - {scan.model_name}
                      </td>
                      <td className="py-2 px-3 text-slate-700">
                        {scan.color_name} / {scan.size_name}
                      </td>
                      <td className="py-2 px-3 font-mono text-slate-500 text-[11px] dir-ltr">
                        {scan.scanned_identifier}
                      </td>
                      <td className="py-2 px-3">
                        {scan.status === 'valid' && (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                            قطعة صحيحة
                          </span>
                        )}
                        {scan.status === 'excess' && (
                          <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold text-[10px]">
                            قطعة زائدة
                          </span>
                        )}
                        {scan.status === 'wrong' && (
                          <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 font-bold text-[10px]">
                            صنف غير مطلوب
                          </span>
                        )}
                        {scan.status === 'undone' && (
                          <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-600 font-bold text-[10px]">
                            تم التراجع
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-slate-600">{scan.user_name || '—'}</td>
                      <td className="py-2 px-3 text-center">
                        {scan.status !== 'undone' && (
                          <button
                            onClick={() => handleUndo(scan.id)}
                            className="px-2.5 py-1 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg text-[10px] font-bold transition-colors cursor-pointer"
                          >
                            تراجع
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

export default function OrderReviewQrPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-slate-50 font-sans text-slate-500" dir="rtl">
          جاري تجهيز ماسح الـ QR ومحطة المراجعة...
        </div>
      }
    >
      <OrderReviewQrContent />
    </Suspense>
  );
}

