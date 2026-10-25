'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Warehouse,
  PlusCircle,
  FileSpreadsheet,
  RefreshCw,
  Menu,
  Search,
  X,
  Loader2,
  Package,
  Users,
  FileText,
  Boxes,
  RotateCcw,
  ClipboardList,
} from 'lucide-react';

interface HeaderProps {
  onRefresh?: () => void;
  title?: string;
  subtitle?: string;
  onOpenMobileMenu?: () => void;
}

export function Header({ onRefresh, title, subtitle, onOpenMobileMenu }: HeaderProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard shortcut Ctrl+K to focus search
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      } else if (e.key === 'Escape') {
        setIsOpen(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    setIsOpen(true);

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery.trim())}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data.results || []);
        }
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSelectResult = (url: string) => {
    setIsOpen(false);
    setSearchQuery('');
    router.push(url);
  };

  const currentDate = new Date().toLocaleDateString('ar-EG', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'products':
        return <Package className="w-4 h-4 text-indigo-600" />;
      case 'customers':
        return <Users className="w-4 h-4 text-emerald-600" />;
      case 'orders':
        return <FileText className="w-4 h-4 text-blue-600" />;
      case 'shelves':
        return <Boxes className="w-4 h-4 text-amber-600" />;
      case 'returns':
        return <RotateCcw className="w-4 h-4 text-rose-600" />;
      case 'audits':
        return <ClipboardList className="w-4 h-4 text-purple-600" />;
      default:
        return <Search className="w-4 h-4 text-slate-400" />;
    }
  };

  // Group results by category
  const groupedResults = results.reduce((acc: Record<string, any[]>, item) => {
    const key = item.categoryLabel || 'أخرى';
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  return (
    <header className="bg-white border-b border-slate-200 px-4 sm:px-6 lg:px-8 py-2.5 sticky top-0 z-30 shadow-xs flex items-center justify-between gap-3 min-h-[58px]">
      {/* Right side: Mobile Menu Hamburger & Title */}
      <div className="flex items-center gap-3 min-w-0 shrink-0">
        <button
          onClick={onOpenMobileMenu}
          className="p-2 -mr-1 rounded-xl text-slate-700 hover:text-slate-900 hover:bg-slate-100 lg:hidden border border-slate-200 transition-colors"
          aria-label="فتح القائمة الرئيسية"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="min-w-0 hidden sm:block">
          {title ? (
            <div>
              <h1 className="text-base sm:text-lg font-black text-slate-900 truncate">
                {title}
              </h1>
              {subtitle && (
                <p className="text-[11px] text-slate-500 font-medium truncate hidden md:block">
                  {subtitle}
                </p>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-slate-700 text-xs">
              <span className="font-bold text-slate-900">منظومة زين</span>
              <span className="text-slate-400">•</span>
              <span className="text-slate-500">{currentDate}</span>
            </div>
          )}
        </div>
      </div>

      {/* Middle: Universal Search Bar */}
      <div className="flex-1 max-w-lg mx-2 relative" ref={dropdownRef}>
        <div className="relative flex items-center">
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onFocus={() => {
              if (searchQuery.trim()) setIsOpen(true);
            }}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث شامل: موديل، عميل، هاتف، رقم طلب، رف، باركود... (Ctrl+K)"
            className="w-full bg-slate-100 hover:bg-slate-50 focus:bg-white border border-slate-200 focus:border-indigo-500 rounded-xl py-2 pr-9 pl-8 text-xs font-medium text-slate-900 transition-all outline-hidden shadow-2xs"
          />
          <Search className="w-4 h-4 text-slate-400 absolute right-3 pointer-events-none" />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('');
                setIsOpen(false);
              }}
              className="absolute left-2.5 p-1 text-slate-400 hover:text-slate-600 rounded-md"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Global Search Dropdown Results */}
        {isOpen && (
          <div className="absolute left-0 right-0 mt-2 bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden z-50 max-h-[75vh] flex flex-col">
            {isSearching ? (
              <div className="p-8 text-center text-slate-500 text-xs flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                <span>جارٍ البحث في قاعدة البيانات...</span>
              </div>
            ) : results.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                <Search className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p>لا توجد نتائج مطابقة لـ "{searchQuery}"</p>
                <p className="text-[10px] text-slate-400 mt-1">
                  يمكنك البحث بكود الموديل، هاتف العميل، رقم الفاتورة، أو كود الرف.
                </p>
              </div>
            ) : (
              <div className="overflow-y-auto divide-y divide-slate-100">
                {Object.entries(groupedResults).map(([categoryLabel, categoryItems]) => (
                  <div key={categoryLabel} className="p-2">
                    <div className="px-3 py-1 text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center justify-between">
                      <span>{categoryLabel}</span>
                      <span>({categoryItems.length})</span>
                    </div>

                    <div className="space-y-0.5 mt-1">
                      {categoryItems.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => handleSelectResult(item.url)}
                          className="w-full text-right p-2.5 hover:bg-slate-50 rounded-xl transition-colors flex items-center justify-between group cursor-pointer"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="p-2 rounded-lg bg-slate-100 group-hover:bg-white group-hover:shadow-2xs transition-all shrink-0">
                              {getCategoryIcon(item.category)}
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-xs text-slate-900 group-hover:text-indigo-600 truncate transition-colors">
                                {item.title}
                              </p>
                              <p className="text-[11px] text-slate-500 truncate">{item.subtitle}</p>
                            </div>
                          </div>

                          {item.badge && (
                            <span className="shrink-0 text-[10px] px-2 py-0.5 font-bold rounded-md bg-slate-100 text-slate-700 mr-2">
                              {item.badge}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Left side: Actions & Warehouse Indicator */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Active Warehouse Tag */}
        <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold">
          <Warehouse className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span>المستودع الرئيسي</span>
        </div>

        {/* Quick New Order Button */}
        <Link
          href="/orders/new"
          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
        >
          <PlusCircle className="w-4 h-4 shrink-0" />
          <span className="hidden sm:inline">طلب جديد</span>
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
