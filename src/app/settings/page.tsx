'use client';

import React, { useState, useEffect } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import {
  Settings,
  Warehouse,
  History,
  ShieldCheck,
  Database,
  DownloadCloud,
  Loader2,
  FileText,
  Server,
  Lock,
} from 'lucide-react';

export default function SettingsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'audit' | 'backup' | 'warehouse'>('audit');

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/audit-logs');
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  return (
    <AppShell
      title="إعدادات المنظومة وسجل التدقيق الرقابي"
      subtitle="سجل تدقيق رقابي غير قابل للتعديل لكافة العمليات الحساسة، وإرشادات النسخ الاحتياطي وحماية البيانات"
    >
      <div className="space-y-6">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 bg-slate-200/80 p-1.5 rounded-2xl w-fit">
          <button
            onClick={() => setActiveTab('audit')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'audit' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <History className="w-4 h-4" />
            <span>سجل التدقيق الرقابي ({logs.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('backup')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'backup' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>النسخ الاحتياطي واستعادة البيانات</span>
          </button>

          <button
            onClick={() => setActiveTab('warehouse')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'warehouse' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Warehouse className="w-4 h-4" />
            <span>المستودعات ومواقع التخزين</span>
          </button>
        </div>

        {/* Tab 1: Audit Logs */}
        {activeTab === 'audit' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs font-bold text-slate-800">
              <span>سجل التدقيق الرقابي (Audit Trail) - أحدث 150 عملية نظام</span>
              <span className="text-slate-500 font-normal">تسجيل تلقائي لإجراءات الدخول، تعديل المخزون، أوامر البيع، والحجوزات</span>
            </div>

            {loading ? (
              <div className="py-20 text-center">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-500">جارٍ قراءة سجل التدقيق الرقابي...</p>
              </div>
            ) : logs.length === 0 ? (
              <div className="py-16 text-center text-slate-400 text-xs">
                لا توجد سجلات تدقيق حتى الآن.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">التاريخ والوقت</th>
                      <th className="py-3 px-4">المستخدم</th>
                      <th className="py-3 px-4">الإجراء</th>
                      <th className="py-3 px-4">نوع الكيان</th>
                      <th className="py-3 px-4">معرّف الكيان</th>
                      <th className="py-3 px-4">تفاصيل وبيانات العملية</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {logs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-4 text-slate-500 font-mono text-[11px]">
                          {new Date(log.created_at).toLocaleString('ar-EG')}
                        </td>
                        <td className="py-2.5 px-4 font-bold text-slate-900">{log.username || 'النظام'}</td>
                        <td className="py-2.5 px-4">
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-mono text-[11px] font-bold">
                            {log.action}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 font-semibold text-slate-600">{log.entity_type}</td>
                        <td className="py-2.5 px-4 font-mono font-bold text-indigo-700">{log.entity_id || '—'}</td>
                        <td className="py-2.5 px-4 text-slate-500 font-mono text-[11px] max-w-sm truncate">
                          {typeof log.details === 'object' ? JSON.stringify(log.details) : String(log.details || '—')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Backup & Restore */}
        {activeTab === 'backup' && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-900">إرشادات النسخ الاحتياطي واستعادة قاعدة بيانات PostgreSQL</h3>
              <p className="text-xs text-slate-500 mt-1">
                إجراءات أمنية معتمدة لحفظ نسخ دورية واستعادة بيانات المخزن والطلبات
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center gap-2 font-black text-slate-900 text-sm">
                  <DownloadCloud className="w-5 h-5 text-indigo-600" />
                  <span>1. أخذ نسخة احتياطية كاملة (Backup via pg_dump)</span>
                </div>
                <p className="text-slate-600 leading-relaxed">
                  يمكن لمدير النظام أو مسؤول السيرفر تشغيل الأمر التالي عبر الطرفية لتصدير نسخة كاملة مع الهيكل والبيانات:
                </p>
                <div className="p-3 bg-slate-900 text-emerald-400 rounded-xl font-mono text-left text-[11px] overflow-x-auto" dir="ltr">
                  pg_dump -h localhost -U postgres -d zain_inventory -F c -b -v -f &quot;backup_$(date +%Y%m%d).dump&quot;
                </div>
                <p className="text-slate-500 text-[11px]">
                  ملاحظة: في وضع PGlite المدمج، يتم حفظ البيانات في المجلد المحلي <code className="bg-slate-200 px-1 rounded">./data/pgdata</code> ويمكن نسخه احتياطياً مباشرة.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center gap-2 font-black text-slate-900 text-sm">
                  <Server className="w-5 h-5 text-emerald-600" />
                  <span>2. إجراء استعادة البيانات (Restore Procedure)</span>
                </div>
                <p className="text-slate-600 leading-relaxed">
                  لاستعادة النسخة الاحتياطية في بيئة جديدة أو بعد حدوث طارئ، قم بتشغيل أمر <code className="bg-slate-200 px-1 rounded">pg_restore</code>:
                </p>
                <div className="p-3 bg-slate-900 text-emerald-400 rounded-xl font-mono text-left text-[11px] overflow-x-auto" dir="ltr">
                  pg_restore -h localhost -U postgres -d zain_inventory -v --clean &quot;backup_file.dump&quot;
                </div>
                <p className="text-slate-500 text-[11px]">
                  يتم التحقق من تطابق القيود والمفاتيح الأجنبية آلياً أثناء الاستعادة دون حدوث تضارب في الأرصدة.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-indigo-50/70 border border-indigo-200/60 text-xs text-indigo-900 space-y-1">
              <p className="font-bold">توصيات دورية لأصحاب العمل:</p>
              <p>• يُنصح بجدولة نسخة احتياطية يومية في نهاية ساعات العمل الرسمية بعد إغلاق كافة فواتير اليوم.</p>
              <p>• حفظ النسخ الاحتياطية على وسيط تخزين خارجي أو سحابي منفصل ومحمي بكلمة سر قوية.</p>
            </div>
          </div>
        )}

        {/* Tab 3: Warehouse Locations */}
        {activeTab === 'warehouse' && (
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-900">مواقع ومستودعات التخزين</h3>
              <p className="text-xs text-slate-500 mt-1">
                المنظومة مهيأة افتراضياً مع المستودع الرئيسي، وتدعم توسعة مواقع التخزين والأرفف عند الحاجة
              </p>
            </div>

            <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/40 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold">
                  <Warehouse className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-black text-sm text-slate-900">المستودع الرئيسي (MAIN)</h4>
                  <p className="text-xs text-slate-600">المستودع المركزي للبضاعة الجاهزة واستلامات المصانع وتجهيز الطلبات</p>
                </div>
              </div>
              <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs">
                نشط - افتراضي
              </span>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
