'use client';

import React, { useState, useEffect } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import {
  ShieldCheck,
  Plus,
  User,
  Lock,
  Mail,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Settings2,
  Check,
  X,
  Users as UsersIcon,
} from 'lucide-react';

export default function UsersPage() {
  const [activeTab, setActiveTab] = useState<'users' | 'permissions'>('users');
  const [users, setUsers] = useState<any[]>([]);
  const [permissions, setPermissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [permLoading, setPermLoading] = useState(false);

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'sales' | 'warehouse'>('sales');
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState('');
  const [modalSuccess, setModalSuccess] = useState('');

  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/users');
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPermissions = async () => {
    try {
      setPermLoading(true);
      const res = await fetch('/api/permissions');
      if (res.ok) {
        const data = await res.json();
        setPermissions(data.permissions || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setPermLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchPermissions();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalLoading(true);
    setModalError('');
    setModalSuccess('');

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          full_name: fullName,
          email,
          password,
          role,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل إنشاء المستخدم');

      setModalSuccess('تم إنشاء المستخدم بنجاح.');
      setTimeout(() => {
        setIsModalOpen(false);
        setUsername('');
        setFullName('');
        setEmail('');
        setPassword('');
        fetchUsers();
      }, 1200);
    } catch (err: any) {
      setModalError(err.message);
    } finally {
      setModalLoading(false);
    }
  };

  const handleTogglePermission = async (roleKey: string, permKey: string, currentAllowed: boolean) => {
    try {
      const newAllowed = !currentAllowed;
      const res = await fetch('/api/permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: roleKey,
          permission_key: permKey,
          allowed: newAllowed,
        }),
      });

      if (!res.ok) throw new Error('فشل تحديث الصلاحية');

      setPermissions((prev) =>
        prev.map((p) =>
          p.role === roleKey && p.permission_key === permKey ? { ...p, allowed: newAllowed } : p
        )
      );

      setMessage({
        text: `تم تحديث الصلاحية [${permKey}] للدور [${roleKey}] بنجاح.`,
        type: 'success',
      });
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const roleBadges: Record<string, { label: string; badge: string; desc: string }> = {
    admin: {
      label: 'مالك / مدير النظام',
      badge: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      desc: 'صلاحيات كاملة على المخزن والطلبات والوارد والتسويات والتقارير وإدارة الموظفين',
    },
    sales: {
      label: 'موظف مبيعات',
      badge: 'bg-blue-100 text-blue-800 border-blue-300',
      desc: 'إنشاء وتعديل مسودات الطلبات المشكلة، عرض المخزون المتاح، لا يمكنه تعديل الأرصدة يدوياً',
    },
    warehouse: {
      label: 'أمين مستودع',
      badge: 'bg-amber-100 text-amber-800 border-amber-300',
      desc: 'تجهيز الطلبات وتغليفها وشحنها، استلام بضاعة الموردين، فحص المرتجعات والجرد',
    },
  };

  // Group permissions by permission_key
  const permissionKeys = Array.from(new Set(permissions.map((p) => p.permission_key)));

  const permissionLabels: Record<string, string> = {
    'customers.view': 'عرض بيانات وملفات العملاء',
    'customers.manage': 'إضافة وتعديل بيانات العملاء',
    'products.view': 'عرض الموديلات والكتالوج',
    'products.manage': 'إضافة وتعديل الموديلات والمتغيرات',
    'qr.generate': 'توليد رموز QR للمتغيرات',
    'qr.print': 'معاينة وطباعة بطاقات QR',
    'shelves.view': 'عرض الأرفف والمواقع التخزينية',
    'shelves.manage': 'إدارة الأرفف وتعيين مواقع الأصناف',
    'orders.create': 'إنشاء طلبات مبيعات جديدة',
    'orders.confirm': 'تأكيد وحجز بضاعة الطلبات',
    'orders.pick': 'التقاط وتجهيز أصناف الأوردر',
    'orders.review': 'مراجعة الأوردر ومسح الباركود',
    'orders.confirm_review': 'تأكيد ومطابقة مراجعة الأوردر',
    'orders.ship': 'تسجيل شحن الطلبات',
    'orders.deliver': 'تأكيد تسليم الطلب للعميل',
    'inventory.view': 'عرض أرصدة وحركات المخزن',
    'inventory.audit_create': 'إنشاء جلسات جرد جديدة',
    'inventory.audit_count': 'إدخال العد الفعلي للجرد',
    'inventory.audit_approve': 'اعتماد فروق الجرد وتطبيق التسويات',
    'returns.create': 'تسجيل طلبات المرتجعات',
    'returns.approve': 'الموافقة واعتماد طلبات المرتجعات',
    'returns.inspect': 'فحص الجودة الفني للمرتجع',
    'returns.restock': 'إعادة التخزين للمخزن المتاح',
    'reports.view': 'عرض التقارير والإحصائيات',
    'users.manage': 'إدارة حسابات وصلاحيات المستخدمين',
  };

  return (
    <AppShell
      title="المستخدمون والصلاحيات الرقابية (Users & Permissions Matrix)"
      subtitle="إدارة حسابات الموظفين وفرض الصلاحيات على مستوى الخادم لضمان أمان ودقة المخزون"
    >
      <div className="space-y-6">
        {/* Role Explanation Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Object.entries(roleBadges).map(([key, r]) => (
            <div key={key} className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1.5">
              <span className={`inline-block text-[11px] font-black px-2.5 py-0.5 rounded-md border ${r.badge}`}>
                {r.label}
              </span>
              <p className="text-xs text-slate-600 leading-relaxed">{r.desc}</p>
            </div>
          ))}
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

        {/* Tab switcher */}
        <div className="flex border-b border-slate-200 text-xs font-bold gap-3">
          <button
            onClick={() => setActiveTab('users')}
            className={`pb-3 px-4 border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
              activeTab === 'users'
                ? 'border-indigo-600 text-indigo-700 font-black'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <UsersIcon className="w-4 h-4" />
            <span>حسابات المستخدمين ({users.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('permissions')}
            className={`pb-3 px-4 border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
              activeTab === 'permissions'
                ? 'border-indigo-600 text-indigo-700 font-black'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Settings2 className="w-4 h-4" />
            <span>مصفوفة الصلاحيات للأدوار الثلاثة</span>
          </button>
        </div>

        {activeTab === 'users' ? (
          <div className="space-y-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700">
                إجمالي حسابات الموظفين: {users.length} مستخدم
              </span>

              <button
                onClick={() => {
                  setIsModalOpen(true);
                  setModalError('');
                  setModalSuccess('');
                }}
                className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة مستخدم جديد</span>
              </button>
            </div>

            {/* Users Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              {loading ? (
                <div className="py-20 text-center">
                  <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-500">جارٍ قراءة حسابات المستخدمين...</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-3 px-4">اسم المستخدم</th>
                        <th className="py-3 px-4">الاسم بالكامل</th>
                        <th className="py-3 px-4">البريد الإلكتروني</th>
                        <th className="py-3 px-4">الدور الوظيفي</th>
                        <th className="py-3 px-4">تاريخ الإنشاء</th>
                        <th className="py-3 px-4 text-center">الحالة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {users.map((u) => {
                        const r = roleBadges[u.role] || { label: u.role, badge: 'bg-slate-100 text-slate-700' };
                        return (
                          <tr key={u.id} className="hover:bg-slate-50">
                            <td className="py-3.5 px-4 font-mono font-black text-indigo-700">{u.username}</td>
                            <td className="py-3.5 px-4 font-bold text-slate-900">{u.full_name}</td>
                            <td className="py-3.5 px-4 text-slate-500 font-mono">{u.email || '—'}</td>
                            <td className="py-3.5 px-4">
                              <span className={`px-2.5 py-0.5 rounded-md font-bold text-[10px] border ${r.badge}`}>
                                {r.label}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-slate-500 font-mono text-[11px]">
                              {new Date(u.created_at).toLocaleDateString('ar-EG')}
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                                نشط
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <span className="text-xs font-black text-slate-800">
                مصفوفة الصلاحيات المركزية (Role Permissions Table) - انقر على الصلاحية لتفعيلها أو إيقافها
              </span>
            </div>

            {permLoading ? (
              <div className="py-20 text-center">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-500">جارٍ قراءة مصفوفة الصلاحيات...</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">الميزة / الإجراء</th>
                      <th className="py-3 px-4">كود الصلاحية</th>
                      <th className="py-3 px-4 text-center">المالك / المدير (Admin)</th>
                      <th className="py-3 px-4 text-center">المبيعات (Sales)</th>
                      <th className="py-3 px-4 text-center">أمين المستودع (Warehouse)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {permissionKeys.map((key) => {
                      const adminPerm = permissions.find((p) => p.role === 'admin' && p.permission_key === key);
                      const salesPerm = permissions.find((p) => p.role === 'sales' && p.permission_key === key);
                      const whPerm = permissions.find((p) => p.role === 'warehouse' && p.permission_key === key);

                      const adminAllowed = adminPerm?.allowed ?? true;
                      const salesAllowed = salesPerm?.allowed ?? false;
                      const whAllowed = whPerm?.allowed ?? false;

                      return (
                        <tr key={key} className="hover:bg-slate-50">
                          <td className="py-3 px-4 font-bold text-slate-900">
                            {permissionLabels[key] || key}
                          </td>
                          <td className="py-3 px-4 font-mono text-[11px] text-slate-500">{key}</td>

                          {/* Admin */}
                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={() => handleTogglePermission('admin', key, adminAllowed)}
                              className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                                adminAllowed
                                  ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                                  : 'bg-rose-50 border-rose-300 text-rose-700'
                              }`}
                              title={adminAllowed ? 'مفعل (انقر للتعطيل)' : 'معطل (انقر للتفعيل)'}
                            >
                              {adminAllowed ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                            </button>
                          </td>

                          {/* Sales */}
                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={() => handleTogglePermission('sales', key, salesAllowed)}
                              className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                                salesAllowed
                                  ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                                  : 'bg-slate-100 border-slate-200 text-slate-400'
                              }`}
                              title={salesAllowed ? 'مفعل (انقر للتعطيل)' : 'معطل (انقر للتفعيل)'}
                            >
                              {salesAllowed ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                            </button>
                          </td>

                          {/* Warehouse */}
                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={() => handleTogglePermission('warehouse', key, whAllowed)}
                              className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                                whAllowed
                                  ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                                  : 'bg-slate-100 border-slate-200 text-slate-400'
                              }`}
                              title={whAllowed ? 'مفعل (انقر للتعطيل)' : 'معطل (انقر للتفعيل)'}
                            >
                              {whAllowed ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* New User Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-black text-slate-900 text-base">إضافة مستخدم جديد للنظام</h3>
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
            {modalSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{modalSuccess}</span>
              </div>
            )}

            <form onSubmit={handleCreateUser} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">الاسم الكامل للموظف *</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="مثال: أحمد عبد الرحمن"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:bg-white focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">اسم المستخدم (لتسجيل الدخول) *</label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase())}
                  placeholder="ahmed_sales"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-mono focus:bg-white focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">الدور الوظيفي والصلاحيات *</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as any)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-bold focus:bg-white focus:border-indigo-500"
                >
                  <option value="sales">موظف مبيعات (Sales)</option>
                  <option value="warehouse">أمين مستودع وتجهيز (Warehouse)</option>
                  <option value="admin">مالك / مدير النظام (Admin)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">كلمة المرور الأولية *</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="6 أحرف على الأقل"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:bg-white focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">البريد الإلكتروني (اختياري)</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ahmed@zain.eg"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:bg-white focus:border-indigo-500"
                />
              </div>

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
                  <span>حفظ وإنشاء الحساب</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
