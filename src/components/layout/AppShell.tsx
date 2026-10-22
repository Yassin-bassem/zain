'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { Loader2 } from 'lucide-react';

interface AppShellProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
}

export function AppShell({ children, title, subtitle }: AppShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = async () => {
    try {
      const res = await fetch('/api/auth/me');
      const data = await res.json();

      if (data.isInitialSetupRequired && pathname !== '/setup') {
        router.push('/setup');
        return;
      }

      if (!data.user && pathname !== '/login' && pathname !== '/setup') {
        router.push('/login');
        return;
      }

      setUser(data.user);
    } catch {
      if (pathname !== '/login' && pathname !== '/setup') {
        router.push('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();
  }, [pathname]);

  if (loading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-900 text-slate-100 gap-3">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
        <p className="text-sm font-bold text-slate-300">جارٍ التحميل والتأكد من الجلسة...</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100">
      <Sidebar user={user} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header title={title} subtitle={subtitle} onRefresh={fetchUser} />
        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          <div className="max-w-7xl mx-auto space-y-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
