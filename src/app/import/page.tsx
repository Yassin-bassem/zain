'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import {
  FileSpreadsheet,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  FileDown,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Layers,
  Sparkles,
  ShieldCheck,
  RotateCcw,
  SlidersHorizontal,
  Table as TableIcon,
} from 'lucide-react';

export default function ImportWizardPage() {
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5 | 6>(1);
  const [file, setFile] = useState<File | null>(null);
  const [sheets, setSheets] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [sampleRows, setSampleRows] = useState<any[]>([]);
  const [allRows, setAllRows] = useState<any[]>([]);
  const [mapping, setMapping] = useState<any>({
    model_code: '',
    model_name: '',
    color: '',
    size: '',
    quantity: '',
    category: '',
    unit_price: '',
  });

  const [importMode, setImportMode] = useState<'products_variants' | 'opening_stock' | 'stock_adjustment'>('products_variants');
  const [adjustmentReason, setAdjustmentReason] = useState('تسوية جرد دوري عبر ملف إكسيل');
  const [previewResult, setPreviewResult] = useState<any>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [commitSuccess, setCommitSuccess] = useState<any>(null);

  // Step 1: Upload and parse spreadsheet
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);
    setError('');
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('file', uploadedFile);

      const res = await fetch('/api/import/preview', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل قراءة ملف الإكسيل');

      setSheets(data.sheets || []);
      setSelectedSheet(data.selectedSheet || '');
      setHeaders(data.headers || []);
      setSampleRows(data.sampleRows || []);
      setAllRows(data.allRows || []);
      setMapping(data.detectedMapping || {});
      setStep(2);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Step 2 -> 3 & 4: Validate and Preview
  const handleValidate = async () => {
    if (!mapping.model_code || !mapping.model_name || !mapping.color || !mapping.size) {
      setError('حقول (كود الموديل، اسم الموديل، اللون، المقاس) أساسية وإلزامية للربط.');
      return;
    }

    if ((importMode === 'opening_stock' || importMode === 'stock_adjustment') && !mapping.quantity) {
      setError('حقل الكمية إلزامي لوضع استيراد الرصيد الافتتاحي أو تسوية المخزون.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/import/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rows: allRows,
          mapping,
          mode: importMode,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل التحقق من صفوف الملف');

      setPreviewResult(data);
      setStep(4);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Step 5 -> 6: Transactional Commit
  const handleCommit = async () => {
    if (!previewResult || previewResult.validRowsCount === 0) {
      setError('لا توجد صفوف صالحة للتنفيذ.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/import/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file?.name || 'import.xlsx',
          mode: importMode,
          validRows: previewResult.validRows,
          reason: importMode === 'stock_adjustment' ? adjustmentReason : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل اعتماد الاستيراد');

      setCommitSuccess(data);
      setStep(6);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadErrorReport = async () => {
    if (!previewResult?.errors || previewResult.errors.length === 0) return;

    try {
      const res = await fetch('/api/import/error-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ errors: previewResult.errors }),
      });

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `تقرير_أخطاء_${file?.name || 'استيراد'}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      console.error(err);
    }
  };

  const stepLabels = [
    { num: 1, label: 'رفع الملف' },
    { num: 2, label: 'مطابقة الأعمدة' },
    { num: 3, label: 'وضع الاستيراد' },
    { num: 4, label: 'فحص الأخطاء والمعاينة' },
    { num: 5, label: 'تأكيد الحفظ' },
  ];

  return (
    <AppShell
      title="معالج استيراد ملفات الإكسيل (Excel Import Wizard)"
      subtitle="استيراد وتحديث كتالوج الموديلات، الألوان، المقاسات، والرصيد الافتتاحي بدقة وضوابط عدم التكرار"
    >
      <div className="space-y-6">
        {/* Wizard Progress Steps Bar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between overflow-x-auto text-xs font-bold">
          <div className="flex items-center gap-3">
            {[1, 2, 3, 4, 5].map((s) => {
              const isPassed = step > s || (step === 6 && s === 5);
              const isCurrent = step === s || (step === 3 && s === 3);

              return (
                <div key={s} className="flex items-center gap-2">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${
                      isPassed
                        ? 'bg-emerald-600 text-white'
                        : isCurrent
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                        : 'bg-slate-100 text-slate-400'
                    }`}
                  >
                    {isPassed ? <CheckCircle2 className="w-4 h-4" /> : s}
                  </div>
                  <span className={isCurrent ? 'text-indigo-900 font-black' : 'text-slate-500'}>
                    {stepLabels[s - 1].label}
                  </span>
                  {s < 5 && <span className="text-slate-300">←</span>}
                </div>
              );
            })}
          </div>

          <a
            href="/api/import/template"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition-colors text-xs border border-slate-200"
          >
            <FileDown className="w-3.5 h-3.5" />
            <span>تحميل نموذج إكسيل قياسي</span>
          </a>
        </div>

        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-bold text-rose-800 flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {/* STEP 1: Upload File */}
        {step === 1 && (
          <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-xs space-y-6 text-center">
            <div className="max-w-md mx-auto space-y-2">
              <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto shadow-inner">
                <UploadCloud className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-black text-slate-900">اختر أو اسحب ملف الإكسيل أو CSV</h3>
              <p className="text-xs text-slate-500">
                يدعم صيغ (.xlsx, .xls, .csv). يتم الحفاظ على كود الموديل كنص بما في ذلك الأصفار على اليسار، وتطبيع الأرقام المكتوبة بالأرقام الهندية (٠١٢٣٤٥٦٧٨٩).
              </p>
            </div>

            <div className="max-w-md mx-auto">
              <label className="border-2 border-dashed border-slate-300 hover:border-indigo-500 rounded-2xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer bg-slate-50/60 hover:bg-indigo-50/30 transition-all">
                <input
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <FileSpreadsheet className="w-10 h-10 text-slate-400" />
                <span className="text-xs font-bold text-slate-700">اضغط لتحديد الملف من جهازك</span>
                <span className="text-[11px] text-slate-400">ملفات الجملة والموديلات حتى 1500+ موديل</span>
              </label>
            </div>

            {loading && (
              <div className="flex items-center justify-center gap-2 text-xs font-bold text-indigo-600">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>جارٍ فحص وهيكلة ملف الإكسيل...</span>
              </div>
            )}
          </div>
        )}

        {/* STEP 2: Map Columns */}
        {step === 2 && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-black text-slate-900">مطابقة أعمدة الشيت مع حقول النظام</h3>
                <p className="text-xs text-slate-500">
                  ملف: <strong>{file?.name}</strong> • تعرف النظام آلياً على العناوين الشائعة بالعربية والإنجليزية ويمكنك تعديلها يدوياً
                </p>
              </div>

              {sheets.length > 1 && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-bold text-slate-600">اختر ورقة العمل:</span>
                  <select
                    value={selectedSheet}
                    onChange={(e) => setSelectedSheet(e.target.value)}
                    className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 font-bold"
                  >
                    {sheets.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Mode Selection In Step 2 */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <label className="block text-xs font-black text-slate-800">اختر هدف ووضع الاستيراد (Import Mode):</label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <button
                  type="button"
                  onClick={() => setImportMode('products_variants')}
                  className={`p-3 rounded-xl border text-right transition-all cursor-pointer ${
                    importMode === 'products_variants'
                      ? 'bg-indigo-50 border-indigo-500 text-indigo-950 font-bold shadow-xs'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span className="block font-black text-sm">أ. استيراد الموديلات والمتغيرات فقط</span>
                  <span className="block text-[11px] mt-1 text-slate-500">
                    إنشاء وتحديث بطاقات الأصناف دون المساس بالأرصدة إطلاقاً.
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setImportMode('opening_stock')}
                  className={`p-3 rounded-xl border text-right transition-all cursor-pointer ${
                    importMode === 'opening_stock'
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-950 font-bold shadow-xs'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span className="block font-black text-sm">ب. استيراد رصيد افتتاحي معتمد</span>
                  <span className="block text-[11px] mt-1 text-slate-500">
                    تثبيت الأرصدة المبدئية مع فحص عدم التكرار وتسجيل حركة رصيد افتتاحي.
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setImportMode('stock_adjustment')}
                  className={`p-3 rounded-xl border text-right transition-all cursor-pointer ${
                    importMode === 'stock_adjustment'
                      ? 'bg-amber-50 border-amber-500 text-amber-950 font-bold shadow-xs'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span className="block font-black text-sm">ج. تسوية مخزنية مجمعة</span>
                  <span className="block text-[11px] mt-1 text-slate-500">
                    ضبط الأرصدة إلى القيم الجديدة المدخلة وتسجيل فروق الجرد بحساب الفارق.
                  </span>
                </button>
              </div>
            </div>

            {/* Column Mapping Selectors */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">عمود كود الموديل *</label>
                <select
                  value={mapping.model_code}
                  onChange={(e) => setMapping({ ...mapping, model_code: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-bold focus:bg-white focus:border-indigo-500"
                >
                  <option value="">-- اختر العمود من الملف --</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">عمود اسم الموديل *</label>
                <select
                  value={mapping.model_name}
                  onChange={(e) => setMapping({ ...mapping, model_name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-bold focus:bg-white focus:border-indigo-500"
                >
                  <option value="">-- اختر العمود من الملف --</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">عمود اللون *</label>
                <select
                  value={mapping.color}
                  onChange={(e) => setMapping({ ...mapping, color: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-bold focus:bg-white focus:border-indigo-500"
                >
                  <option value="">-- اختر العمود من الملف --</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">عمود المقاس *</label>
                <select
                  value={mapping.size}
                  onChange={(e) => setMapping({ ...mapping, size: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-bold focus:bg-white focus:border-indigo-500"
                >
                  <option value="">-- اختر العمود من الملف --</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  عمود الكمية {importMode !== 'products_variants' ? '*' : '(اختياري)'}
                </label>
                <select
                  value={mapping.quantity}
                  onChange={(e) => setMapping({ ...mapping, quantity: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-bold focus:bg-white focus:border-indigo-500"
                >
                  <option value="">-- اختياري أو غير محدد --</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">عمود القسم / الفئة</label>
                <select
                  value={mapping.category}
                  onChange={(e) => setMapping({ ...mapping, category: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:bg-white focus:border-indigo-500"
                >
                  <option value="">-- اختياري --</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">عمود سعر البيع</label>
                <select
                  value={mapping.unit_price}
                  onChange={(e) => setMapping({ ...mapping, unit_price: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:bg-white focus:border-indigo-500"
                >
                  <option value="">-- اختياري --</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold text-xs"
              >
                اختيار ملف آخر
              </button>

              <button
                type="button"
                onClick={handleValidate}
                disabled={loading}
                className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-2 cursor-pointer shadow-sm disabled:opacity-50"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>فحص الصفوف والتحقق من الأخطاء</span>
                <ArrowLeft className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: Preview and Error Report */}
        {step === 4 && previewResult && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-black text-slate-900">تقرير التحقق ومعاينة الصفوف الصالحة</h3>
                <p className="text-xs text-slate-500">
                  تم فحص كافة الصفوف وتطبيع الأرقام والأحرف وكشف التكرار والكميات السالبة
                </p>
              </div>

              {previewResult.invalidRowsCount > 0 && (
                <button
                  type="button"
                  onClick={handleDownloadErrorReport}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition-colors cursor-pointer"
                >
                  <FileDown className="w-3.5 h-3.5 text-rose-600" />
                  <span>تحميل تقرير الأخطاء بالأرقام الأصلية للصفوف ({previewResult.invalidRowsCount})</span>
                </button>
              )}
            </div>

            {/* Summary Counters */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[11px] font-bold text-slate-500">إجمالي صفوف الملف</span>
                <p className="text-2xl font-black text-slate-900">{previewResult.totalRows}</p>
              </div>

              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                <span className="text-[11px] font-bold text-emerald-700">الصفوف الصالحة للاستيراد</span>
                <p className="text-2xl font-black text-emerald-800">{previewResult.validRowsCount}</p>
              </div>

              <div className="p-4 rounded-xl bg-rose-50 border border-rose-200">
                <span className="text-[11px] font-bold text-rose-700">صفوف بها أخطاء أو تكرار</span>
                <p className="text-2xl font-black text-rose-800">{previewResult.invalidRowsCount}</p>
              </div>

              <div className="p-4 rounded-xl bg-purple-50 border border-purple-200">
                <span className="text-[11px] font-bold text-purple-700">موديلات جديدة ستنشأ</span>
                <p className="text-2xl font-black text-purple-900">{previewResult.newProductsCount}</p>
              </div>
            </div>

            {/* Error Table if any */}
            {previewResult.errors.length > 0 && (
              <div className="border border-rose-200 rounded-xl overflow-hidden">
                <div className="p-3 bg-rose-50 border-b border-rose-200 flex items-center justify-between text-xs font-bold text-rose-800">
                  <span>الأخطاء المكتشفة ({previewResult.errors.length} خطأ)</span>
                  <span className="text-[11px]">لن يتم استيراد الصفوف التي بها أخطاء للحفاظ على دقة المخزن</span>
                </div>
                <div className="max-h-48 overflow-y-auto">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-rose-100/50 text-rose-900 font-bold border-b border-rose-200">
                      <tr>
                        <th className="py-2 px-3">رقم الصف</th>
                        <th className="py-2 px-3">كود الموديل</th>
                        <th className="py-2 px-3">اللون</th>
                        <th className="py-2 px-3">المقاس</th>
                        <th className="py-2 px-3">الحقل</th>
                        <th className="py-2 px-3">سبب الخطأ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-rose-100">
                      {previewResult.errors.slice(0, 15).map((e: any, idx: number) => (
                        <tr key={idx} className="hover:bg-rose-50/50">
                          <td className="py-2 px-3 font-mono font-bold text-rose-800">#{e.rowNumber}</td>
                          <td className="py-2 px-3 font-mono">{e.modelCode || '—'}</td>
                          <td className="py-2 px-3">{e.color || '—'}</td>
                          <td className="py-2 px-3">{e.size || '—'}</td>
                          <td className="py-2 px-3 font-bold text-rose-900">{e.field}</td>
                          <td className="py-2 px-3 text-rose-700">{e.errorMessage}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Sample of Valid Rows */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="p-3 bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-800">
                معاينة عينة من الصفوف الصالحة الجاهزة للحفظ ({Math.min(10, previewResult.validRowsCount)} من إجمالي {previewResult.validRowsCount})
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-bold">
                    <tr>
                      <th className="py-2.5 px-3">كود الموديل</th>
                      <th className="py-2.5 px-3">اسم الموديل</th>
                      <th className="py-2.5 px-3">اللون</th>
                      <th className="py-2.5 px-3">المقاس</th>
                      <th className="py-2.5 px-3">الفئة</th>
                      {importMode !== 'products_variants' && <th className="py-2.5 px-3 text-center">الكمية</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {previewResult.validRows.slice(0, 10).map((r: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-mono font-bold text-indigo-700">{r.modelCode}</td>
                        <td className="py-2 px-3 font-bold text-slate-900">{r.modelName}</td>
                        <td className="py-2 px-3">{r.color}</td>
                        <td className="py-2 px-3">{r.size}</td>
                        <td className="py-2 px-3 text-slate-500">{r.category}</td>
                        {importMode !== 'products_variants' && (
                          <td className="py-2 px-3 text-center font-bold text-emerald-700">{r.quantity}</td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold text-xs"
              >
                تعديل مطابقة الأعمدة
              </button>

              <button
                type="button"
                onClick={handleCommit}
                disabled={loading || previewResult.validRowsCount === 0}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-2 cursor-pointer shadow-sm disabled:opacity-50"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>اعتماد وحفظ البيانات ({previewResult.validRowsCount} صف)</span>
              </button>
            </div>
          </div>
        )}

        {/* STEP 6: Success Completion */}
        {step === 6 && commitSuccess && (
          <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-xs text-center space-y-5">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto border-2 border-emerald-300">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h3 className="text-xl font-black text-slate-900">تم اكتمال الاستيراد بنجاح!</h3>
              <p className="text-xs text-slate-500">
                رقم دفعة الاستيراد: <strong className="font-mono text-indigo-700">{commitSuccess.batchNumber}</strong>
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 max-w-sm mx-auto text-xs text-slate-700 space-y-1">
              <p>تم استيراد وحفظ: <strong>{commitSuccess.importedCount}</strong> صف بدقة تامة.</p>
              <p className="text-[11px] text-slate-500">تم تسجيل العملية في سجل تدقيق الاستيراد.</p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-4">
              <Link
                href="/products"
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-sm transition-colors"
              >
                عرض كتالوج الموديلات
              </Link>

              <Link
                href="/inventory"
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors"
              >
                فحص أرصدة المخزن
              </Link>

              <button
                type="button"
                onClick={() => {
                  setStep(1);
                  setFile(null);
                  setPreviewResult(null);
                  setCommitSuccess(null);
                }}
                className="px-5 py-2.5 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                استيراد ملف جديد
              </button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
