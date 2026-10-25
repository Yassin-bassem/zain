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
  X,
  QrCode,
  Boxes,
  ClipboardList,
  ScanLine,
} from 'lucide-react';

interface SidebarProps {
  user: {
    id: number;
    username: string;
    full_name: string;
    role: 'admin' | 'sales' | 'warehouse';
  } | null;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export function Sidebar({ user, isOpenMobile, onCloseMobile }: SidebarProps) {
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

  const handleLinkClick = () => {
    if (onCloseMobile) {
      onCloseMobile();
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
        { href: '/', label: 'لوحة التحكم', icon: LayoutDashboard },
      ],
    },
    {
      title: 'الموديلات والأصناف',
      items: [
        { href: '/products', label: 'المنتجات والموديلات', icon: Layers },
        { href: '/products/labels', label: 'طباعة باركود وQR الأصناف', icon: QrCode, roles: ['admin', 'sales', 'warehouse'] },
        { href: '/products/bulk-variants', label: 'مُوَلّد المتغيرات السريع', icon: PlusCircle, roles: ['admin'] },
        { href: '/attributes', label: 'الألوان والمقاسات', icon: Palette, roles: ['admin'] },
      ],
    },
    {
      title: 'المخزون والمستودع',
      items: [
        { href: '/inventory', label: 'المخزون والأرصدة', icon: Warehouse },
        { href: '/warehouse/shelves', label: 'أرفف ومواقع المستودع', icon: Boxes, roles: ['admin', 'warehouse'] },
        { href: '/inventory/movements', label: 'سجل حركات المخزن', icon: History },
      ],
    },
    {
      title: 'تحضير ومراجعة الطلبات',
      items: [
        { href: '/warehouse/preparation', label: 'تحضير الأوردر (Picking)', icon: PackageCheck, roles: ['admin', 'warehouse'] },
        { href: '/orders/new', label: 'إنشاء طلب جملة مشكل', icon: PlusCircle, roles: ['admin', 'sales'] },
        { href: '/orders', label: 'كافة الفواتير والطلبات', icon: ShoppingCart },
      ],
    },
    {
      title: 'العمليات اللوجستية والجرد',
      items: [
        { href: '/warehouse/receipts', label: 'استلام البضاعة من المصانع', icon: PackagePlus, roles: ['admin', 'warehouse'] },
        { href: '/inventory/audit', label: 'الجرد الفعلي للمخزون', icon: ClipboardList, roles: ['admin', 'warehouse'] },
        { href: '/returns', label: 'المرتجعات والموافقات', icon: RotateCcw, roles: ['admin', 'sales', 'warehouse'] },
      ],
    },
    {
      title: 'الشركاء والجهات',
      items: [
        { href: '/customers', label: 'العملاء ومحلات الأطفال', icon: Users },
        { href: '/suppliers', label: 'الموردون والمصانع', icon: Building2, roles: ['admin', 'warehouse'] },
      ],
    },
    {
      title: 'استيراد إكسيل',
      items: [
        { href: '/import', label: 'معالج استيراد الإكسيل', icon: FileSpreadsheet, roles: ['admin'] },
        { href: '/import/opening', label: 'اعتماد الرصيد الافتتاحي', icon: CheckCircle2, roles: ['admin'] },
        { href: '/import/history', label: 'سجل ملفات الاستيراد', icon: FolderArchive, roles: ['admin'] },
      ],
    },
    {
      title: 'الإدارة والرقابة',
      items: [
        { href: '/reports', label: 'التقارير والإحصائيات', icon: BarChart3 },
        { href: '/users', label: 'المستخدمون والصلاحيات', icon: ShieldCheck, roles: ['admin'] },
        { href: '/settings', label: 'سجل العمليات والإعدادات', icon: Settings, roles: ['admin'] },
      ],
    },
  ];

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpenMobile && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-slate-950/70 z-40 backdrop-blur-xs transition-opacity lg:hidden"
          aria-hidden="true"
        />
      )}

      {/* Main Sidebar Element */}
      <aside
        className={`fixed inset-y-0 right-0 z-50 w-72 bg-slate-900 text-slate-200 flex flex-col h-screen border-l border-slate-800 shadow-2xl transition-transform duration-300 ease-in-out select-none
          lg:static lg:translate-x-0 lg:z-30 lg:shadow-xl lg:shrink-0
          ${isOpenMobile ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Brand Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-black text-xl shadow-lg shadow-indigo-600/30">
              ز
            </div>
            <div>
              <h1 className="font-black text-base sm:text-lg text-white tracking-wide">منظومة زين</h1>
              <p className="text-[11px] sm:text-xs text-slate-400 font-medium">جملة مشكل ملابس أطفال</p>
            </div>
          </div>

          {/* Close button for Mobile */}
          <button
            onClick={onCloseMobile}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 lg:hidden transition-colors"
            aria-label="إغلاق القائمة"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User Information Card */}
        {user && (
          <div className="px-3.5 py-2.5 mx-3 my-2.5 rounded-xl bg-slate-800/70 border border-slate-700/60">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-slate-200 font-bold border border-slate-600 shrink-0">
                <User className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm font-bold text-white truncate">{user.full_name}</p>
                <span
                  className={`inline-block text-[10px] sm:text-[11px] font-semibold px-2 py-0.5 rounded-md border mt-0.5 ${
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
        <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-4">
          {navSections.map((section, idx) => {
            const visibleItems = section.items.filter((item) => {
              if (!item.roles) return true;
              if (!user) return false;
              return item.roles.includes(user.role);
            });

            if (visibleItems.length === 0) return null;

            return (
              <div key={idx} className="space-y-1">
                <p className="px-3 text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  {section.title}
                </p>
                <div className="space-y-0.5 pt-0.5">
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
                        onClick={handleLinkClick}
                        className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all duration-150 ${
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
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs sm:text-sm font-bold text-rose-400 hover:bg-rose-950/40 hover:text-rose-300 border border-transparent hover:border-rose-900/50 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>تسجيل الخروج</span>
          </button>
        </div>
      </aside>
    </>
  );
}
