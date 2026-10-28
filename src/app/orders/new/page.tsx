'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import {
  ShoppingCart,
  Plus,
  Trash2,
  Search,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  UserPlus,
  Warehouse,
  Tag,
  DollarSign,
  Store,
  Phone,
  User,
  MapPin,
  X,
  Edit2,
} from 'lucide-react';

export default function NewOrderPage() {
  const router = useRouter();

  // Customer state & search
  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [customerSearch, setCustomerSearch] = useState<string>('');
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
  const [customerSearching, setCustomerSearching] = useState(false);
  const customerDropdownRef = useRef<HTMLDivElement>(null);

  const [orderDate, setOrderDate] = useState('');
  const [notes, setNotes] = useState('');
  const [orderDiscount, setOrderDiscount] = useState('0');

  // Order Items
  const [items, setItems] = useState<
    Array<{
      variant_id: number;
      model_code: string;
      model_name: string;
      color_name: string;
      size_name: string;
      sku: string;
      available_quantity: number;
      quantity: number;
      unit_price: number;
      line_discount: number;
    }>
  >([]);

  // Item Picker Search & Selection
  const [inventorySearch, setInventorySearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Quick Customer Create Modal
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [newCustStoreName, setNewCustStoreName] = useState('');
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustAddress, setNewCustAddress] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setOrderDate(new Date().toISOString().slice(0, 10));
    fetch('/api/customers')
      .then((r) => r.json())
      .then((d) => setCustomers(d.customers || []))
      .catch((err) => console.error(err));
  }, []);

  // Close customer dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        customerDropdownRef.current &&
        !customerDropdownRef.current.contains(event.target as Node)
      ) {
        setIsCustomerDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Server search debouncer for customers
  useEffect(() => {
    if (!customerSearch.trim()) return;

    const timer = setTimeout(async () => {
      setCustomerSearching(true);
      try {
        const res = await fetch(
          `/api/customers?search=${encodeURIComponent(customerSearch.trim())}`
        );
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.customers)) {
            setCustomers((prev) => {
              const map = new Map(prev.map((c) => [c.id, c]));
              data.customers.forEach((c: any) => map.set(c.id, c));
              return Array.from(map.values());
            });
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setCustomerSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [customerSearch]);

  // In-memory filtered customers list matching name, store name, phone, alternate phone, customer code, or address
  const filteredCustomers = customers.filter((c) => {
    if (!customerSearch.trim()) return true;
    const q = customerSearch.trim().toLowerCase();
    const nameMatch = (c.name || '').toLowerCase().includes(q);
    const storeMatch = (c.store_name || '').toLowerCase().includes(q);
    const phoneMatch =
      (c.phone || '').includes(q) || (c.alternate_phone || '').includes(q);
    const codeMatch = (c.customer_code || '').toLowerCase().includes(q);
    const addressMatch = (c.address || '').toLowerCase().includes(q);
    return nameMatch || storeMatch || phoneMatch || codeMatch || addressMatch;
  });

  // Search variants
  useEffect(() => {
    if (!inventorySearch.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await fetch(`/api/inventory?limit=15&search=${encodeURIComponent(inventorySearch.trim())}`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.items || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setSearchLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [inventorySearch]);

  const handleAddItem = (variant: any) => {
    // Check if variant already in order
    const existingIndex = items.findIndex((i) => i.variant_id === variant.variant_id);
    if (existingIndex >= 0) {
      const updated = [...items];
      updated[existingIndex].quantity += 1;
      setItems(updated);
    } else {
      setItems([
        ...items,
        {
          variant_id: variant.variant_id,
          model_code: variant.model_code,
          model_name: variant.model_name,
          color_name: variant.color_name,
          size_name: variant.size_name,
          sku: variant.sku,
          available_quantity: Number(variant.available_quantity || 0),
          quantity: 1,
          unit_price: Number(variant.default_price || 0),
          line_discount: 0,
        },
      ]);
    }
  };

  const handleUpdateItem = (index: number, field: string, val: any) => {
    const updated = [...items];
    (updated[index] as any)[field] = val;
    setItems(updated);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, idx) => idx !== index));
  };

  const handleSelectCustomer = (customer: any) => {
    setSelectedCustomer(customer);
    setSelectedCustomerId(String(customer.id));
    setCustomerSearch('');
    setIsCustomerDropdownOpen(false);
    setError('');
  };

  const handleClearSelectedCustomer = () => {
    setSelectedCustomer(null);
    setSelectedCustomerId('');
    setCustomerSearch('');
    setIsCustomerDropdownOpen(false);
  };

  const handleQuickCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustName.trim() || !newCustPhone.trim()) return;

    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newCustName.trim(),
          store_name: newCustStoreName.trim() || null,
          phone: newCustPhone.trim(),
          address: newCustAddress.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل إضافة العميل');

      const created = data.customer;
      setCustomers((prev) => [created, ...prev]);
      handleSelectCustomer(created);
      setIsCustomerModalOpen(false);
      setNewCustStoreName('');
      setNewCustName('');
      setNewCustPhone('');
      setNewCustAddress('');
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Totals calculations
  let subtotal = 0;
  let totalPieces = 0;
  for (const item of items) {
    const q = Number(item.quantity || 0);
    const p = Number(item.unit_price || 0);
    const d = Number(item.line_discount || 0);
    subtotal += q * p - d;
    totalPieces += q;
  }
  const discountVal = Number(orderDiscount || 0);
  const totalAmount = Math.max(0, subtotal - discountVal);

  const handleSaveOrder = async (confirmImmediately = false) => {
    if (!selectedCustomerId) {
      setError('يرجى تحديد العميل صاحب الطلب.');
      return;
    }
    if (items.length === 0) {
      setError('يجب إضافة صنف واحد على الأقل في الطلب.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: Number(selectedCustomerId),
          order_date: orderDate,
          notes,
          discount_amount: discountVal,
          items: items.map((i) => ({
            variant_id: i.variant_id,
            quantity: Number(i.quantity),
            unit_price: Number(i.unit_price),
            line_discount: Number(i.line_discount || 0),
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل حفظ الطلب');

      if (confirmImmediately) {
        // Confirm and reserve stock
        const confirmRes = await fetch(`/api/orders/${data.orderId}/actions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'confirm' }),
        });
        const confirmData = await confirmRes.json();
        if (!confirmRes.ok) {
          throw new Error(`تم حفظ الطلب كمسودة ولكن تعذر تأكيده: ${confirmData.error}`);
        }
      }

      router.push(`/orders/${data.orderId}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppShell
      title="إنشاء طلب جملة مشكل جديد"
      subtitle="واجهة إدخال فائقة السرعة للموظفين لمعالجة مئات الموديلات والقطع في طلب واحد"
    >
      <div className="space-y-6">
        {/* Back Link */}
        <div className="flex items-center justify-between">
          <Link
            href="/orders"
            className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors"
          >
            <ArrowRight className="w-4 h-4" />
            <span>العودة لقائمة الطلبات</span>
          </Link>
        </div>

        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs font-bold flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
            <span className="whitespace-pre-line leading-relaxed">{error}</span>
          </div>
        )}

        {/* Customer & Order Header */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 text-xs">
            {/* Searchable Customer Picker with Name, Store Name, and Phone Search */}
            <div className="lg:col-span-6 relative" ref={customerDropdownRef}>
              <div className="flex items-center justify-between mb-1.5">
                <label className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Store className="w-4 h-4 text-indigo-600" />
                  <span>العميل (البحث بالاسم، اسم المحل، أو رقم الموبايل) *</span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setNewCustStoreName(customerSearch.trim());
                    setNewCustName('');
                    setNewCustPhone('');
                    setIsCustomerModalOpen(true);
                  }}
                  className="text-indigo-600 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>+ إضافة عميل / محل جديد</span>
                </button>
              </div>

              {selectedCustomer ? (
                /* Selected Customer Display Card */
                <div className="bg-gradient-to-r from-indigo-50/90 via-white to-emerald-50/80 border-2 border-indigo-400 rounded-xl p-3 flex items-center justify-between gap-3 shadow-2xs">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                      <Store className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {selectedCustomer.store_name ? (
                          <>
                            <span className="font-black text-sm text-slate-900">
                              {selectedCustomer.store_name}
                            </span>
                            <span className="text-slate-400 font-bold">•</span>
                            <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                              <User className="w-3 h-3 text-slate-400" />
                              {selectedCustomer.name}
                            </span>
                          </>
                        ) : (
                          <span className="font-black text-sm text-slate-900">
                            {selectedCustomer.name}
                          </span>
                        )}
                        {selectedCustomer.customer_code && (
                          <span className="font-mono text-[10px] text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded font-bold">
                            {selectedCustomer.customer_code}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 mt-1">
                        <span className="font-mono font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded flex items-center gap-1">
                          <Phone className="w-3 h-3 text-emerald-600" />
                          {selectedCustomer.phone}
                        </span>
                        {selectedCustomer.alternate_phone && (
                          <span className="font-mono text-slate-500">
                            / {selectedCustomer.alternate_phone}
                          </span>
                        )}
                        {selectedCustomer.address && (
                          <span className="truncate flex items-center gap-1 text-slate-500">
                            <MapPin className="w-3 h-3 text-slate-400" />
                            {selectedCustomer.address}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleClearSelectedCustomer}
                    className="px-3 py-1.5 bg-white hover:bg-slate-100 text-rose-700 border border-slate-300 rounded-lg font-bold text-xs flex items-center gap-1 transition-all cursor-pointer shadow-2xs shrink-0"
                    title="تغيير العميل والبحث عن عميل آخر"
                  >
                    <span>تغيير</span>
                    <X className="w-3.5 h-3.5 text-rose-500" />
                  </button>
                </div>
              ) : (
                /* Customer Search Input & Results Dropdown */
                <div className="relative">
                  <div className="relative">
                    <input
                      type="text"
                      value={customerSearch}
                      onChange={(e) => {
                        setCustomerSearch(e.target.value);
                        setIsCustomerDropdownOpen(true);
                      }}
                      onFocus={() => setIsCustomerDropdownOpen(true)}
                      placeholder="ابحث باسم المحل (مثال: كيدز شوب)، اسم العميل، أو رقم الموبايل..."
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 pr-10 text-xs font-bold text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all shadow-2xs"
                    />
                    <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
                    {customerSearching && (
                      <Loader2 className="w-4 h-4 animate-spin text-indigo-600 absolute left-3.5 top-3" />
                    )}
                  </div>

                  {/* Dropdown Results */}
                  {isCustomerDropdownOpen && (
                    <div className="absolute top-full left-0 right-0 mt-1 z-30 bg-white border border-slate-300 rounded-xl shadow-xl max-h-64 overflow-y-auto divide-y divide-slate-100">
                      {filteredCustomers.length > 0 ? (
                        filteredCustomers.slice(0, 25).map((c) => (
                          <div
                            key={c.id}
                            onClick={() => handleSelectCustomer(c)}
                            className="p-3 hover:bg-indigo-50/80 transition-colors cursor-pointer flex items-center justify-between text-right gap-2"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-black text-xs text-slate-900 flex items-center gap-1">
                                  <Store className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                                  <span>{c.store_name ? c.store_name : c.name}</span>
                                </span>
                                {c.store_name && c.name && (
                                  <span className="text-[11px] text-slate-600 font-bold flex items-center gap-0.5">
                                    <User className="w-3 h-3 text-slate-400" />
                                    <span>{c.name}</span>
                                  </span>
                                )}
                                {c.customer_code && (
                                  <span className="font-mono text-[9px] text-slate-500 bg-slate-100 px-1 py-0.2 rounded font-bold">
                                    {c.customer_code}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-3 text-[11px] text-slate-600 mt-1">
                                <span className="font-mono font-bold text-emerald-700 flex items-center gap-1">
                                  <Phone className="w-3 h-3 text-emerald-500" />
                                  {c.phone}
                                </span>
                                {c.alternate_phone && (
                                  <span className="font-mono text-slate-400">
                                    / {c.alternate_phone}
                                  </span>
                                )}
                                {c.address && (
                                  <span className="truncate flex items-center gap-1 text-slate-500">
                                    <MapPin className="w-3 h-3 text-slate-400" />
                                    {c.address}
                                  </span>
                                )}
                              </div>
                            </div>

                            <button
                              type="button"
                              className="px-2.5 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-600 hover:text-white rounded-lg text-[11px] font-black transition-all shrink-0 cursor-pointer"
                            >
                              اختيار
                            </button>
                          </div>
                        ))
                      ) : (
                        <div className="p-4 text-center text-xs space-y-2">
                          <p className="text-slate-500 font-bold">
                            لم يتم العثور على عميل أو محل مطابق لـ &quot;{customerSearch}&quot;
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              setNewCustStoreName(customerSearch.trim());
                              setNewCustName('');
                              setNewCustPhone('');
                              setIsCustomerModalOpen(true);
                              setIsCustomerDropdownOpen(false);
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs transition-colors cursor-pointer"
                          >
                            <UserPlus className="w-3.5 h-3.5" />
                            <span>+ إضافة &quot;{customerSearch}&quot; كعميل جديد الآن</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Date */}
            <div className="lg:col-span-3">
              <label className="block font-bold text-slate-700 mb-1">تاريخ الطلب *</label>
              <input
                type="date"
                required
                value={orderDate}
                onChange={(e) => setOrderDate(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:bg-white focus:border-indigo-500 font-bold"
              />
            </div>

            {/* Notes */}
            <div className="lg:col-span-3">
              <label className="block font-bold text-slate-700 mb-1">ملاحظات الطلب أو الشحن</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="تعليمات التوصيل أو رغبات العميل..."
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:bg-white focus:border-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* Quick Item Picker Search Bar */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <label className="block text-xs font-black text-slate-800">
            البحث السريع لإضافة الأصناف للطلب المشكل (بالكود، اسم الموديل، اللون، أو الباركود):
          </label>
          <div className="relative">
            <input
              type="text"
              value={inventorySearch}
              onChange={(e) => setInventorySearch(e.target.value)}
              placeholder="اكتب كود الموديل (مثال: K101) أو اسم الصنف أو اللون لإظهار المتغيرات فوراً..."
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 pr-11 text-sm font-bold text-slate-900 focus:bg-white focus:border-indigo-500 transition-colors"
            />
            <Search className="w-5 h-5 text-slate-400 absolute right-3.5 top-3.5" />
            {searchLoading && <Loader2 className="w-4 h-4 animate-spin text-indigo-600 absolute left-3.5 top-3.5" />}
          </div>

          {/* Quick Search Results Dropdown/Grid */}
          {searchResults.length > 0 && (
            <div className="border border-indigo-200 rounded-xl bg-indigo-50/40 p-3 max-h-60 overflow-y-auto space-y-1.5">
              <span className="text-[11px] font-bold text-indigo-900 block mb-1">
                اضغط على الصنف لإضافته للطلب مباشرة:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {searchResults.map((v) => {
                  const available = Number(v.available_quantity || 0);
                  const isShortage = available <= 0;

                  return (
                    <button
                      key={v.variant_id}
                      type="button"
                      onClick={() => handleAddItem(v)}
                      className="p-2.5 rounded-xl border border-white bg-white hover:border-indigo-400 shadow-2xs text-right transition-all flex items-center justify-between cursor-pointer"
                    >
                      <div className="min-w-0">
                        <p className="font-black text-xs text-slate-900 truncate">
                          {v.model_code} - {v.model_name}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {v.color_name} • {v.size_name}
                        </p>
                      </div>
                      <div className="text-left shrink-0 mr-2">
                        <span className="block font-black text-xs text-indigo-700">
                          {v.default_price} ج.م
                        </span>
                        <span
                          className={`text-[10px] font-bold ${
                            isShortage ? 'text-rose-600' : 'text-emerald-700'
                          }`}
                        >
                          {available} متاح
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Order Items Lines Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs font-bold text-slate-800">
            <span>بنود الطلب المشكل ({items.length} صنف مختلف)</span>
            <span className="text-indigo-700">إجمالي القطع المطلوبة: {totalPieces} قطعة</span>
          </div>

          {items.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-xs">
              لم تتم إضافة أي أصناف بعد. ابحث في الحقل أعلاه لإضافة الموديلات والمقاسات.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">كود الموديل</th>
                    <th className="py-3 px-4">اسم الموديل</th>
                    <th className="py-3 px-4">اللون</th>
                    <th className="py-3 px-4">المقاس</th>
                    <th className="py-3 px-4 text-center">المتاح حالياً</th>
                    <th className="py-3 px-4 text-center w-28">الكمية المطلوبة</th>
                    <th className="py-3 px-4 text-center w-28">سعر القطعة (ج.م)</th>
                    <th className="py-3 px-4 text-center w-28">خصم البند (ج.م)</th>
                    <th className="py-3 px-4 text-center">الإجمالي</th>
                    <th className="py-3 px-4 text-center">إزالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item, idx) => {
                    const lineTotal = item.quantity * item.unit_price - item.line_discount;
                    const isShortage = item.available_quantity < item.quantity;

                    return (
                      <tr key={item.variant_id} className="hover:bg-slate-50">
                        <td className="py-3 px-4 font-mono font-black text-indigo-700">
                          {item.model_code}
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-900">{item.model_name}</td>
                        <td className="py-3 px-4 font-semibold text-slate-800">{item.color_name}</td>
                        <td className="py-3 px-4 font-semibold text-slate-800">{item.size_name}</td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`font-black text-xs px-2 py-0.5 rounded-md ${
                              isShortage ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {item.available_quantity} متاح
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => handleUpdateItem(idx, 'quantity', Math.max(1, Number(e.target.value)))}
                            className="w-20 text-center bg-slate-50 border border-slate-300 rounded-lg py-1 font-black text-slate-900"
                          />
                        </td>
                        <td className="py-3 px-4 text-center">
                          <input
                            type="number"
                            step="0.5"
                            min="0"
                            value={item.unit_price}
                            onChange={(e) => handleUpdateItem(idx, 'unit_price', Math.max(0, Number(e.target.value)))}
                            className="w-20 text-center bg-slate-50 border border-slate-300 rounded-lg py-1 font-bold text-slate-900"
                          />
                        </td>
                        <td className="py-3 px-4 text-center">
                          <input
                            type="number"
                            step="0.5"
                            min="0"
                            value={item.line_discount}
                            onChange={(e) => handleUpdateItem(idx, 'line_discount', Math.max(0, Number(e.target.value)))}
                            className="w-20 text-center bg-slate-50 border border-slate-300 rounded-lg py-1 text-slate-700"
                          />
                        </td>
                        <td className="py-3 px-4 text-center font-black text-sm text-slate-900">
                          {lineTotal.toLocaleString('ar-EG')} ج.م
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            className="p-1 rounded-lg text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Order Summary & Financials */}
          <div className="p-4 sm:p-6 bg-slate-50 border-t border-slate-200 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 sm:gap-6">
            <div className="space-y-1 text-[11px] sm:text-xs text-slate-500">
              <p>• تأكيد الطلب يحجز الكميات المطلوبة آلياً ويمنع بيعها لعميل آخر.</p>
              <p>• لا يتم خصم المخزون الفعلي إلا عند خطوة الشحن والتسليم النهائي للمستودع.</p>
            </div>

            <div className="w-full md:w-72 space-y-2 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>المجموع الفرعي:</span>
                <span className="font-bold text-slate-900">{subtotal.toLocaleString('ar-EG')} ج.م</span>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <span>خصم الطلب الإجمالي:</span>
                <input
                  type="number"
                  min="0"
                  value={orderDiscount}
                  onChange={(e) => setOrderDiscount(e.target.value)}
                  className="w-24 text-center bg-white border border-slate-300 rounded-lg py-1 text-xs font-bold"
                />
              </div>
              <div className="flex justify-between text-sm font-black text-slate-900 pt-2 border-t border-slate-200">
                <span>الإجمالي النهائي للطلب:</span>
                <span className="text-indigo-700 text-base">{totalAmount.toLocaleString('ar-EG')} ج.م</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="p-4 bg-white border-t border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2.5 sm:gap-3">
            <button
              type="button"
              onClick={() => handleSaveOrder(false)}
              disabled={submitting}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs transition-colors cursor-pointer disabled:opacity-50 text-center"
            >
              حفظ كمسودة فقط
            </button>

            <button
              type="button"
              onClick={() => handleSaveOrder(true)}
              disabled={submitting}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>جارٍ الحفظ والحجز...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>حفظ وتأكيد وحجز المخزون فوراً</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Quick Customer Modal */}
      {isCustomerModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-black text-slate-900 text-base">إضافة عميل / محل ملابس جديد</h3>
              <button
                type="button"
                onClick={() => setIsCustomerModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleQuickCreateCustomer} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">اسم المحل / المتجر (Store Name)</label>
                <input
                  type="text"
                  value={newCustStoreName}
                  onChange={(e) => setNewCustStoreName(e.target.value)}
                  placeholder="مثال: محل كيدز فاشون للأطفال"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:bg-white focus:border-indigo-500 font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">اسم العميل / المسؤول *</label>
                <input
                  type="text"
                  required
                  value={newCustName}
                  onChange={(e) => setNewCustName(e.target.value)}
                  placeholder="مثال: أحمد عبد الله"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:bg-white focus:border-indigo-500 font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">رقم الموبايل *</label>
                <input
                  type="text"
                  required
                  value={newCustPhone}
                  onChange={(e) => setNewCustPhone(e.target.value)}
                  placeholder="01012345678"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:bg-white focus:border-indigo-500 font-bold font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">العنوان أو المحافظة</label>
                <input
                  type="text"
                  value={newCustAddress}
                  onChange={(e) => setNewCustAddress(e.target.value)}
                  placeholder="العتبة - القاهرة"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:bg-white focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCustomerModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold cursor-pointer shadow-xs"
                >
                  حفظ واختيار العميل فوراً
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
