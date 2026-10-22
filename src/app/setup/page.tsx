'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, User, Lock, Mail, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

export default function SetupPage() {
  const router = useRouter();
  const [username, setUsername] = useState('admin');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSetupAllowed, setIsSetupAllowed] = useState(true);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (!data.isInitialSetupRequired) {
          setIsSetupAllowed(false);
        }
      })
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('كلمة المرور وتأكيد كلمة المرور غير متطابقين.');
      return;
    }

    if (password.length < 6) {
      setError('كلمة المرور يجب أن تكون 6 أحرف على الأقل.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          full_name: fullName,
          email,
          password,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'فشل إعداد الحساب الإداري');
      }

      router.push('/');
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isSetupAllowed) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-4">
        <div className="w-full max-w-md bg-slate-950 border border-slate-800 rounded-2xl p-8 text-center">
          <div className="w-12 h-12 bg-emerald-600/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-500/30">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">تم إعداد النظام مسبقاً</h2>
          <p className="text-sm text-slate-400 mb-6">
            يوجد حساب إداري مفعل بالفعل. لأسباب أمنية لا يمكن إنشاء حسابات إدارية جديدة عبر شاشة الإعداد الأولى.
          </p>
          <Link
            href="/login"
            className="inline-block px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-sm transition-colors"
          >
            الانتقال لتسجيل الدخول
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-4 selection:bg-indigo-500 selection:text-white">
      <div className="w-full max-w-lg bg-slate-950/80 border border-slate-800 rounded-2xl shadow-2xl p-8 backdrop-blur-md">
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-emerald-600 rounded-2xl mx-auto flex items-center justify-center text-white text-2xl font-black shadow-lg shadow-emerald-600/40 mb-3">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-wide">الإعداد الأولي لمنظومة زين</h1>
          <p className="text-sm text-slate-400 mt-1">إنشاء حساب المالك / مدير النظام الأول بصلاحيات كاملة</p>
        </div>

        {error && (
          <div className="mb-6 p-3.5 rounded-xl bg-rose-950/50 border border-rose-800/80 text-rose-200 text-sm flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">الاسم بالكامل للمدير أو المالك</label>
            <div className="relative">
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="مثال: يوسف الزيني"
                className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">اسم المستخدم (للإدارة)</label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin"
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
                />
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">البريد الإلكتروني (اختياري)</label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@zain.eg"
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
                />
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">كلمة المرور السرية</label>
              <div className="relative">
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="6 أحرف على الأقل"
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
                />
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">تأكيد كلمة المرور</label>
              <div className="relative">
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="أعد إدخال كلمة المرور"
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
                />
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-sm shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>جارٍ تهيئة حساب المدير...</span>
              </>
            ) : (
              <span>إنشاء الحساب الإداري وبدء العمل</span>
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link href="/login" className="text-xs text-slate-400 hover:text-slate-300 underline">
            العودة لشاشة الدخول
          </Link>
        </div>
      </div>
    </div>
  );
}
