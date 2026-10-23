'use client';

import React from 'react';
import Link from 'next/link';
import { Warehouse, PlusCircle, FileSpreadsheet, RefreshCw, Menu } from 'lucide-react';

interface HeaderProps {
  onRefresh?: () => void;
  title?: string;
  subtitle?: string;
  onOpenMobileMenu?: () => void;
}

export function Header({ onRefresh, title, subtitle, onOpenMobileMenu }: HeaderProps) {
  const currentDate = new Date().toLocaleDateString('ar-EG', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

  return (
    <header className="bg-white border-b border-slate-200 px-4 sm:px-6 lg:px-8 py-3 sticky top-0 z-20 shadow-xs flex items-center justify-between gap-3 min-h-[58px]">
      {/* Right side: Mobile Menu Hamburger & Title */}
      <div className="flex items-center gap-3 min-w-0">
        {/* Mobile Hamburger Button */}
        <button
          onClick={onOpenMobileMenu}
          className="p-2 -mr-1 rounded-xl text-slate-700 hover:text-slate-900 hover:bg-slate-100 lg:hidden border border-slate-200 transition-colors"
          aria-label="فتح القائمة الرئيسية"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Title / Breadcrumb */}
        <div className="min-w-0">
          {title ? (
            <div>
              <h1 className="text-base sm:text-lg lg:text-xl font-black text-slate-900 truncate">
                {title}
              </h1>
              {subtitle && (
                <p className="text-[11px] sm:text-xs text-slate-500 font-medium truncate hidden sm:block">
                  {subtitle}
                </p>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-slate-700 text-xs sm:text-sm">
              <span className="font-bold text-slate-900">منظومة زين</span>
              <span className="text-slate-400">•</span>
              <span className="text-slate-500 text-xs">{currentDate}</span>
            </div>
          )}
        </div>
      </div>

      {/* Left side: Actions & Warehouse Indicator */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Active Warehouse Tag (Compact on small screens) */}
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold">
          <Warehouse className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span>المستودع الرئيسي</span>
        </div>

        {/* Quick New Order Button */}
        <Link
          href="/orders/new"
          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
        >
          <PlusCircle className="w-4 h-4 shrink-0" />
          <span className="hidden xs:inline">طلب جديد</span>
          <span className="xs:hidden">طلب</span>
        </Link>

        {/* Quick Excel Import Button (Hidden on very narrow mobile, visible in sidebar) */}
        <Link
          href="/import"
          className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors border border-slate-300"
        >
          <FileSpreadsheet className="w-3.5 h-3.5 text-slate-600 shrink-0" />
          <span>استيراد شيت</span>
        </Link>

        {/* Optional Refresh */}
        {onRefresh && (
          <button
            onClick={onRefresh}
            title="تحديث البيانات"
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors border border-slate-200"
            aria-label="تحديث"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        )}
      </div>
    </header>
  );
}
