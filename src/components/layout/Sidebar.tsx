'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Layers,
  Palette,
  Warehouse,
  History,
  FileSpreadsheet,
  CheckCircle2,
  FolderArchive,
  ShoppingCart,
  PlusCircle,
  Truck,
  PackageCheck,
  PackagePlus,
  RotateCcw,
  Users,
  Building2,
  BarChart3,
  ShieldCheck,
  Settings,
  LogOut,
  User,
} from 'lucide-react';

interface SidebarProps {
  user: {
    id: number;
    username: string;
    full_name: string;
    role: 'admin' | 'sales' | 'warehouse';
  } | null;
}

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
      router.refresh();
    } catch {
      router.push('/login');
    }
  };

  const roleLabels: Record<string, { label: string; badgeClass: string }> = {
    admin: { label: 'مدير النظام / المالك', badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
    sales: { label: 'موظف مبيعات', badgeClass: 'bg-blue-100 text-blue-800 border-blue-300' },
    warehouse: { label: 'أمين مستودع', badgeClass: 'bg-amber-100 text-amber-800 border-amber-300' },
  };

  const navSections = [
    {
      title: 'الرئيسية',
      items: [
        { href: '/', label: 'لوحة التحكم والمؤشرات', icon: LayoutDashboard },
      ],
    },
    {
      title: 'الموديلات والكتالوج',
      items: [
        { href: '/products', label: 'الموديلات والأصناف', icon: Layers },
        { href: '/products/bulk-variants', label: 'مُوَلّد المتغيرات السريع', icon: PlusCircle, roles: ['admin'] },
        { href: '/attributes', label: 'الألوان والمقاسات', icon: Palette, roles: ['admin'] },
      ],
    },
    {
      title: 'المخزون والأرصدة',
      items: [
        { href: '/inventory', label: 'بحث الأرصدة والمخزن', icon: Warehouse },
        { href: '/inventory/movements', label: 'سجل حركات المخزن', icon: History },
      ],
    },
    {
      title: 'استيراد إكسيل والرصيد الافتتاحي',
      items: [
        { href: '/import', label: 'معالج استيراد الإكسيل', icon: FileSpreadsheet, roles: ['admin'] },
        { href: '/import/opening', label: 'اعتماد الرصيد الافتتاحي', icon: CheckCircle2, roles: ['admin'] },
        { href: '/import/history', label: 'سجل ملفات الاستيراد', icon: FolderArchive, roles: ['admin'] },
      ],
    },
    {
      title: 'طلبات الجملة المشكل',
      items: [
        { href: '/orders/new', label: 'إنشاء طلب جملة سريع', icon: PlusCircle, roles: ['admin', 'sales'] },
        { href: '/orders', label: 'كافة طلبات المبيعات', icon: ShoppingCart },
      ],
    },
    {
      title: 'عمليات المستودع',
      items: [
        { href: '/warehouse/picking', label: 'أوامر التجهيز والالتقاط', icon: PackageCheck, roles: ['admin', 'warehouse'] },
        { href: '/warehouse/shipping', label: 'التغليف والتسليم النهائي', icon: Truck, roles: ['admin', 'warehouse'] },
        { href: '/warehouse/receipts', label: 'استلام بضاعة الموردين', icon: PackagePlus, roles: ['admin', 'warehouse'] },
        { href: '/returns', label: 'فحص المرتجعات والتسويات', icon: RotateCcw, roles: ['admin', 'warehouse'] },
      ],
    },
    {
      title: 'الشركاء والجهات',
      items: [
        { href: '/customers', label: 'العملاء ومحلات الأطفال', icon: Users },
        { href: '/suppliers', label: 'المصانع والموردين', icon: Building2, roles: ['admin', 'warehouse'] },
      ],
    },
    {
      title: 'التقارير والإدارة',
      items: [
        { href: '/reports', label: 'التقارير والإحصائيات', icon: BarChart3 },
        { href: '/users', label: 'المستخدمين والصلاحيات', icon: ShieldCheck, roles: ['admin'] },
        { href: '/settings', label: 'الإعدادات وسجل الرقابة', icon: Settings, roles: ['admin'] },
      ],
    },
  ];

  return (
    <aside className="w-72 bg-slate-900 text-slate-200 flex flex-col h-screen sticky top-0 border-l border-slate-800 shadow-xl select-none z-30">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-black text-xl shadow-lg shadow-indigo-600/30">
            ز
          </div>
          <div>
            <h1 className="font-black text-lg text-white tracking-wide">منظومة زين</h1>
            <p className="text-xs text-slate-400 font-medium">جملة مشكل ملابس أطفال</p>
          </div>
        </div>
      </div>

      {/* User Information Card */}
      {user && (
        <div className="px-4 py-3 mx-3 my-3 rounded-xl bg-slate-800/70 border border-slate-700/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-slate-700 flex items-center justify-center text-slate-200 font-bold border border-slate-600">
              <User className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white truncate">{user.full_name}</p>
              <span
                className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-md border mt-1 ${
                  roleLabels[user.role]?.badgeClass || 'bg-slate-700 text-slate-300'
                }`}
              >
                {roleLabels[user.role]?.label || user.role}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Links with Scroll */}
      <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-5">
        {navSections.map((section, idx) => {
          // Filter items based on user role
          const visibleItems = section.items.filter((item) => {
            if (!item.roles) return true;
            if (!user) return false;
            return item.roles.includes(user.role);
          });

          if (visibleItems.length === 0) return null;

          return (
            <div key={idx} className="space-y-1">
              <p className="px-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                {section.title}
              </p>
              <div className="space-y-0.5 pt-1">
                {visibleItems.map((item) => {
                  const Icon = item.icon;
                  const isActive =
                    item.href === '/'
                      ? pathname === '/'
                      : pathname.startsWith(item.href);

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-semibold transition-all duration-150 ${
                        isActive
                          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20 font-bold'
                          : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                      }`}
                    >
                      <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Footer & Logout */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/40">
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-bold text-rose-400 hover:bg-rose-950/40 hover:text-rose-300 border border-transparent hover:border-rose-900/50 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span>تسجيل الخروج</span>
        </button>
      </div>
    </aside>
  );
}
