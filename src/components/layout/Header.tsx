'use client';

import React from 'react';
import Link from 'next/link';
import { Warehouse, PlusCircle, FileSpreadsheet, RefreshCw } from 'lucide-react';

interface HeaderProps {
  onRefresh?: () => void;
  title?: string;
  subtitle?: string;
}

export function Header({ onRefresh, title, subtitle }: HeaderProps) {
  const currentDate = new Date().toLocaleDateString('ar-EG', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <header className="bg-white border-b border-slate-200 px-8 py-4 sticky top-0 z-20 shadow-xs flex flex-wrap items-center justify-between gap-4">
      {/* Title / Breadcrumb */}
      <div>
        {title ? (
          <div>
            <h1 className="text-xl font-black text-slate-900">{title}</h1>
            {subtitle && <p className="text-xs text-slate-500 font-medium mt-0.5">{subtitle}</p>}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-slate-600 text-sm">
            <span className="font-semibold text-slate-800">مرحباً بك،</span>
            <span className="text-slate-500">{currentDate}</span>
          </div>
        )}
      </div>

      {/* Actions & Warehouse Indicator */}
      <div className="flex items-center gap-3">
        {/* Active Warehouse Tag */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
          <Warehouse className="w-3.5 h-3.5 text-emerald-600" />
          <span>المستودع الرئيسي (MAIN)</span>
        </div>

        {/* Quick New Order Button */}
        <Link
          href="/orders/new"
          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-sm transition-colors"
        >
          <PlusCircle className="w-3.5 h-3.5" />
          <span>طلب جملة جديد</span>
        </Link>

        {/* Quick Excel Import Button */}
        <Link
          href="/import"
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors border border-slate-300"
        >
          <FileSpreadsheet className="w-3.5 h-3.5 text-slate-600" />
          <span>استيراد إكسيل</span>
        </Link>

        {/* Optional Refresh */}
        {onRefresh && (
          <button
            onClick={onRefresh}
            title="تحديث البيانات"
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors border border-slate-200"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        )}
      </div>
    </header>
  );
}
