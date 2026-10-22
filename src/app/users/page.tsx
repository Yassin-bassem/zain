'use client';

import React, { useState, useEffect } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { ShieldCheck, Plus, User, Lock, Mail, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    fetchUsers();
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
      desc: 'تجهيز الطلبات وتغليفها وشحنها، استلام بضاعة الموردين، فحص المرتجعات',
    },
  };

  return (
    <AppShell
      title="إدارة المستخدمين والصلاحيات الرقابية"
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

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <span className="text-xs font-bold text-slate-700">
            إجمالي حسابات المستخدمين: {users.length} حساب
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
