'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import {
  RotateCcw,
  Plus,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldCheck,
  Search,
  Check,
  XCircle,
  FileText,
  Clock,
  ThumbsUp,
  ThumbsDown,
  PackageCheck,
  Building2,
  ArrowRight,
} from 'lucide-react';

export default function ReturnsWorkspacePage() {
  const [activeTab, setActiveTab] = useState<'all' | 'pending_approval' | 'inspection'>('all');
  const [returns, setReturns] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // New Return Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [customerOrders, setCustomerOrders] = useState<any[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [selectedOrderItems, setSelectedOrderItems] = useState<any[]>([]);
  const [returnReason, setReturnReason] = useState('');
  const [returnItems, setReturnItems] = useState<
    Array<{ variant_id: number; returned_quantity: number; label: string; max_qty?: number }>
  >([]);
  const [inventorySearch, setInventorySearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState('');

  // Rejection Modal
  const [rejectingReturn, setRejectingReturn] = useState<any>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectLoading, setRejectLoading] = useState(false);

  // Approval Modal/Action
  const [approvingReturn, setApprovingReturn] = useState<any>(null);
  const [approvalNotes, setApprovalNotes] = useState('');
  const [approveLoading, setApproveLoading] = useState(false);

  // Inspect Modal
  const [inspectingItem, setInspectingItem] = useState<any>(null);
  const [inspectionDisposition, setInspectionDisposition] = useState<'sellable' | 'damaged'>('sellable');
  const [inspectionNotes, setInspectionNotes] = useState('');
  const [inspectLoading, setInspectLoading] = useState(false);

  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const fetchReturns = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/returns');
      if (res.ok) {
        const data = await res.json();
        setReturns(data.returns || []);
        setItems(data.items || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReturns();
    fetch('/api/customers')
      .then((r) => r.json())
      .then((d) => setCustomers(d.customers || []))
      .catch((err) => console.error(err));
  }, []);

  // When customer is selected in Create Modal, fetch their orders
  useEffect(() => {
    if (!selectedCustomerId) {
      setCustomerOrders([]);
      setSelectedOrderId('');
      setSelectedOrderItems([]);
      return;
    }

    fetch(`/api/customers/${selectedCustomerId}`)
      .then((r) => r.json())
      .then((d) => {
        setCustomerOrders(d.orders || []);
      })
      .catch((e) => console.error(e));
  }, [selectedCustomerId]);

  // When order is selected in Create Modal, load its items
  useEffect(() => {
    if (!selectedOrderId) {
      setSelectedOrderItems([]);
      return;
    }

    fetch(`/api/orders/${selectedOrderId}`)
      .then((r) => r.json())
      .then((d) => {
        setSelectedOrderItems(d.items || []);
      })
      .catch((e) => console.error(e));
  }, [selectedOrderId]);

  // Search inventory for manual variant addition
  useEffect(() => {
    if (!inventorySearch.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/inventory?limit=10&search=${encodeURIComponent(inventorySearch.trim())}`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.items || []);
        }
      } catch (err) {
        console.error(err);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [inventorySearch]);

  const handleAddReturnItemFromOrder = (orderItem: any) => {
    const shipped = Number(orderItem.shipped_quantity || 0);
    const existing = returnItems.find((i) => i.variant_id === orderItem.variant_id);
    if (existing) {
      if (existing.returned_quantity < (existing.max_qty || 999)) {
        existing.returned_quantity += 1;
        setReturnItems([...returnItems]);
      }
    } else {
      setReturnItems([
        ...returnItems,
        {
          variant_id: orderItem.variant_id,
          returned_quantity: Math.min(1, shipped),
          label: `${orderItem.model_code} - ${orderItem.color_name} (${orderItem.size_name})`,
          max_qty: shipped,
        },
      ]);
    }
  };

  const handleAddReturnItemFromSearch = (v: any) => {
    const existing = returnItems.find((i) => i.variant_id === v.variant_id);
    if (existing) {
      existing.returned_quantity += 1;
      setReturnItems([...returnItems]);
    } else {
      setReturnItems([
        ...returnItems,
        {
          variant_id: v.variant_id,
          returned_quantity: 1,
          label: `${v.model_code} - ${v.color_name} (${v.size_name})`,
        },
      ]);
    }
  };

  const handleCreateReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId) {
      setModalError('يرجى تحديد العميل.');
      return;
    }
    if (!returnReason.trim()) {
      setModalError('سبب الإرجاع إلزامي.');
      return;
    }
    if (returnItems.length === 0) {
      setModalError('يجب تحديد صنف واحد على الأقل مرتجع.');
      return;
    }

    setModalLoading(true);
    setModalError('');

    try {
      const res = await fetch('/api/returns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: Number(selectedCustomerId),
          order_id: selectedOrderId ? Number(selectedOrderId) : undefined,
          reason: returnReason,
          items: returnItems.map((i) => ({
            variant_id: i.variant_id,
            returned_quantity: i.returned_quantity,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل تسجيل المرتجع');

      setIsModalOpen(false);
      setSelectedCustomerId('');
      setSelectedOrderId('');
      setReturnReason('');
      setReturnItems([]);
      setMessage({
        text: `تم تسجيل طلب المرتجع بنجاح برقم (${data.returnNumber}). الطلب الآن بانتظار الاعتماد.`,
        type: 'success',
      });
      fetchReturns();
    } catch (err: any) {
      setModalError(err.message);
    } finally {
      setModalLoading(false);
    }
  };

  const handleApproveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!approvingReturn) return;

    setApproveLoading(true);
    try {
      const res = await fetch(`/api/returns/${approvingReturn.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: approvalNotes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل اعتماد المرتجع');

      setMessage({
        text: `تمت الموافقة على طلب المرتجع (${approvingReturn.return_number}). الأصناف جاهزة الآن للفحص الفني واستلام البضاعة.`,
        type: 'success',
      });
      setApprovingReturn(null);
      setApprovalNotes('');
      fetchReturns();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setApproveLoading(false);
    }
  };

  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingReturn) return;
    if (!rejectionReason.trim()) {
      alert('سبب الرفض إلزامي.');
      return;
    }

    setRejectLoading(true);
    try {
      const res = await fetch(`/api/returns/${rejectingReturn.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectionReason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل رفض المرتجع');

      setMessage({
        text: `تم رفض طلب المرتجع (${rejectingReturn.return_number}) وتوثيق السبب. لم يتأثر رصيد المخزن.`,
        type: 'success',
      });
      setRejectingReturn(null);
      setRejectionReason('');
      fetchReturns();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setRejectLoading(false);
    }
  };

  const handleInspectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inspectingItem) return;

    setInspectLoading(true);
    try {
      const res = await fetch(`/api/returns/${inspectingItem.return_id}/inspect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: inspectingItem.id,
          disposition: inspectionDisposition,
          inspectionNotes,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل فحص البند');

      setMessage({
        text:
          inspectionDisposition === 'sellable'
            ? 'تم اعتماد البند كبضاعة سليمة وإعادة إضافتها فوراً للمخزون المتاح للبيع مع تسجيل حركة RETURN_SELLABLE.'
            : 'تم توثيق البند كبضاعة تالفة - تم عزلها ومنع إضافتها للمخزن المتاح للبيع.',
        type: 'success',
      });

      setInspectingItem(null);
      fetchReturns();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setInspectLoading(false);
    }
  };

  // Filter lists based on tab
  const pendingApprovalReturns = returns.filter(
    (r) => r.status === 'pending_approval' || r.status === 'draft' || r.status === 'pending'
  );
  const inspectionReturns = returns.filter(
    (r) => r.status === 'approved' || r.status === 'inspected'
  );

  const displayedReturns =
    activeTab === 'pending_approval'
      ? pendingApprovalReturns
      : activeTab === 'inspection'
      ? inspectionReturns
      : returns;

  return (
    <AppShell
      title="المرتجعات وإدارة الموافقات (Returns & Restocking)"
      subtitle="دورة إرجاع آمنة: طلب المرتجع ← مراجعة الشحنة الأصلية ← الاعتماد/الرفض ← الفحص الفني ← إعادة التخزين"
    >
      <div className="space-y-6">
        {/* Top bar with stats & rules */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 text-xs text-amber-900 font-bold flex items-center gap-3">
            <ShieldCheck className="w-5 h-5 text-amber-700 shrink-0" />
            <div>
              <p className="font-black">قواعد سلامة المخزون والمرتجعات:</p>
              <p className="font-normal text-amber-800 text-[11px]">
                طلب المرتجع أو اعتماده لا يزيد الرصيد نهائياً. يتم زيادة المخزون فقط بعد الفحص الفني للقطع السليمة واعتمادها.
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center justify-center gap-2 px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-sm transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>تسجيل طلب مرتجع جديد</span>
          </button>
        </div>

        {/* Metrics Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200">
            <div className="text-slate-500 text-xs font-bold mb-1">إجمالي المرتجعات</div>
            <div className="text-2xl font-black text-slate-800 font-mono">{returns.length}</div>
          </div>
          <div className="bg-amber-50 p-4 rounded-2xl border border-amber-200">
            <div className="text-amber-700 text-xs font-bold mb-1">بانتظار الموافقة</div>
            <div className="text-2xl font-black text-amber-800 font-mono">{pendingApprovalReturns.length}</div>
          </div>
          <div className="bg-blue-50 p-4 rounded-2xl border border-blue-200">
            <div className="text-blue-700 text-xs font-bold mb-1">جاهز للفحص واستلام البضاعة</div>
            <div className="text-2xl font-black text-blue-800 font-mono">{inspectionReturns.length}</div>
          </div>
          <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-200">
            <div className="text-emerald-700 text-xs font-bold mb-1">مكتمل الفحص والتسوية</div>
            <div className="text-2xl font-black text-emerald-800 font-mono">
              {returns.filter((r) => r.status === 'completed').length}
            </div>
          </div>
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

        {/* Tab navigation */}
        <div className="flex border-b border-slate-200 text-xs font-bold gap-2">
          <button
            onClick={() => setActiveTab('all')}
            className={`pb-3 px-4 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'all'
                ? 'border-indigo-600 text-indigo-700 font-black'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            كافة طلبات المرتجعات ({returns.length})
          </button>
          <button
            onClick={() => setActiveTab('pending_approval')}
            className={`pb-3 px-4 border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
              activeTab === 'pending_approval'
                ? 'border-amber-600 text-amber-700 font-black'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>طلبات بانتظار الاعتماد والموافقة</span>
            {pendingApprovalReturns.length > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white font-mono text-[10px]">
                {pendingApprovalReturns.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('inspection')}
            className={`pb-3 px-4 border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
              activeTab === 'inspection'
                ? 'border-blue-600 text-blue-700 font-black'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>فحص البضاعة المرتجعة وإعادة التخزين</span>
            {inspectionReturns.length > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-blue-500 text-white font-mono text-[10px]">
                {inspectionReturns.length}
              </span>
            )}
          </button>
        </div>

        {/* Returns Table / Cards */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          {loading ? (
            <div className="py-20 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-500">جارٍ قراءة طلبات المرتجعات...</p>
            </div>
          ) : displayedReturns.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-xs">
              <RotateCcw className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p>لا توجد طلبات في هذا القسم حالياً.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {displayedReturns.map((ret) => {
                const retItems = items.filter((i) => i.return_id === ret.id);
                const isPendingApproval =
                  ret.status === 'pending_approval' || ret.status === 'draft' || ret.status === 'pending';

                return (
                  <div key={ret.id} className="p-5 space-y-4">
                    {/* Header of Return Card */}
                    <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-black text-sm text-indigo-700">{ret.return_number}</span>
                        <span className="font-bold text-slate-900">
                          العميل: <strong className="text-indigo-900">{ret.customer_name}</strong>
                        </span>
                        {ret.order_number && (
                          <span className="bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-lg font-mono font-bold">
                            فاتورة الأصل: {ret.order_number}
                          </span>
                        )}
                        <span className="text-slate-500">سبب الإرجاع: {ret.reason}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 text-[11px]">
                          {new Date(ret.created_at).toLocaleDateString('ar-EG')}
                        </span>
                        <span
                          className={`px-3 py-1 rounded-full font-bold text-[11px] ${
                            ret.status === 'completed'
                              ? 'bg-emerald-100 text-emerald-800'
                              : ret.status === 'approved'
                              ? 'bg-blue-100 text-blue-800'
                              : ret.status === 'rejected'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {ret.status === 'completed'
                            ? 'مكتمل ومعتمد'
                            : ret.status === 'approved'
                            ? 'معتمد - بانتظار الفحص'
                            : ret.status === 'rejected'
                            ? 'مرفوض'
                            : 'بانتظار الموافقة والاعتماد'}
                        </span>
                      </div>
                    </div>

                    {/* Metadata summary (requester, approver, rejector) */}
                    <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <div>الموظف مقدم الطلب: <strong>{ret.created_by_name || 'غير محدد'}</strong></div>
                      {ret.approved_by_name && (
                        <div className="text-blue-700">
                          تم الاعتماد بواسطة: <strong>{ret.approved_by_name}</strong> ({new Date(ret.approved_at).toLocaleDateString('ar-EG')})
                        </div>
                      )}
                      {ret.rejected_by_name && (
                        <div className="text-rose-700">
                          تم الرفض بواسطة: <strong>{ret.rejected_by_name}</strong> - السبب: <em>"{ret.rejection_reason}"</em>
                        </div>
                      )}
                    </div>

                    {/* Items table for this return */}
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <table className="w-full text-right text-xs">
                        <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                          <tr>
                            <th className="py-2 px-3">كود الموديل</th>
                            <th className="py-2 px-3">اسم الموديل</th>
                            <th className="py-2 px-3">اللون</th>
                            <th className="py-2 px-3">المقاس</th>
                            <th className="py-2 px-3 text-center">الكمية المرتجعة</th>
                            <th className="py-2 px-3 text-center">قرار الفحص</th>
                            <th className="py-2 px-3 text-center">حالة الرصيد</th>
                            <th className="py-2 px-3 text-center">إجراء الفحص</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {retItems.map((item) => (
                            <tr key={item.id} className="hover:bg-slate-50">
                              <td className="py-2 px-3 font-mono font-black text-indigo-900">{item.model_code}</td>
                              <td className="py-2 px-3 font-bold text-slate-800">{item.model_name}</td>
                              <td className="py-2 px-3">{item.color_name}</td>
                              <td className="py-2 px-3">{item.size_name}</td>
                              <td className="py-2 px-3 text-center font-black">{item.returned_quantity}</td>
                              <td className="py-2 px-3 text-center">
                                <span
                                  className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                                    item.disposition === 'sellable'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : item.disposition === 'damaged'
                                      ? 'bg-rose-100 text-rose-800'
                                      : 'bg-slate-100 text-slate-700'
                                  }`}
                                >
                                  {item.disposition === 'sellable'
                                    ? 'سليم لإعادة البيع'
                                    : item.disposition === 'damaged'
                                    ? 'تالف - هالك'
                                    : 'بانتظار الفحص'}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-center">
                                {item.restocked ? (
                                  <span className="text-emerald-700 font-bold text-[10px] flex items-center justify-center gap-1">
                                    <Check className="w-3.5 h-3.5" />
                                    <span>أعيد للمخزن</span>
                                  </span>
                                ) : (
                                  <span className="text-slate-400 text-[10px]">
                                    {item.disposition === 'damaged' ? 'معزول عن المخزن' : 'معلق'}
                                  </span>
                                )}
                              </td>
                              <td className="py-2 px-3 text-center">
                                {ret.status === 'approved' || ret.status === 'inspected' ? (
                                  !item.restocked && item.disposition === 'pending' ? (
                                    <button
                                      onClick={() => setInspectingItem(item)}
                                      className="px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-lg text-[11px] transition-colors cursor-pointer"
                                    >
                                      فحص واتخاذ قرار
                                    </button>
                                  ) : (
                                    <span className="text-slate-400 text-[10px]">مكتمل</span>
                                  )
                                ) : (
                                  <span className="text-slate-400 text-[10px]">
                                    {isPendingApproval ? 'بانتظار اعتماد الطلب' : 'غير متاح'}
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Actions if pending approval */}
                    {isPendingApproval && (
                      <div className="flex items-center justify-end gap-3 pt-2">
                        <button
                          onClick={() => setRejectingReturn(ret)}
                          className="px-4 py-2 border border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
                        >
                          <ThumbsDown className="w-3.5 h-3.5" />
                          <span>رفض طلب المرتجع</span>
                        </button>
                        <button
                          onClick={() => setApprovingReturn(ret)}
                          className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
                        >
                          <ThumbsUp className="w-3.5 h-3.5" />
                          <span>اعتماد والموافقة على المرتجع</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Approval Confirmation Modal */}
      {approvingReturn && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-black text-slate-900 text-base">اعتماد والموافقة على طلب المرتجع</h3>
              <button onClick={() => setApprovingReturn(null)} className="text-slate-400 hover:text-slate-600 font-bold">
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600">
              أنت بصدد اعتماد طلب المرتجع رقم{' '}
              <strong className="text-indigo-700 font-mono">{approvingReturn.return_number}</strong> للعميل{' '}
              <strong>{approvingReturn.customer_name}</strong>.
            </p>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 font-bold">
              تذكير: الموافقة تعني قبول استلام البضاعة من العميل لفحصها، ولن تزيد رصيد المخزن المتاح حتى يتم الفحص الفني.
            </div>

            <form onSubmit={handleApproveSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">ملاحظات الاعتماد (اختياري)</label>
                <textarea
                  rows={2}
                  value={approvalNotes}
                  onChange={(e) => setApprovalNotes(e.target.value)}
                  placeholder="أي تعليمات لقسم الفحص والمخزن..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:bg-white focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setApprovingReturn(null)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={approveLoading}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {approveLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>تأكيد الموافقة</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Rejection Modal */}
      {rejectingReturn && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-black text-rose-900 text-base">رفض طلب المرتجع</h3>
              <button onClick={() => setRejectingReturn(null)} className="text-slate-400 hover:text-slate-600 font-bold">
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600">
              سيتم رفض طلب المرتجع رقم{' '}
              <strong className="text-indigo-700 font-mono">{rejectingReturn.return_number}</strong> نهائياً ولن يؤثر
              على رصيد المخزن.
            </p>

            <form onSubmit={handleRejectSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">سبب الرفض الإلزامي *</label>
                <textarea
                  required
                  rows={3}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="اكتب سبب الرفض بالتفصيل (مثل: تجاوز مهلة الإرجاع، تلف ناتج عن سوء استخدام...)"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:bg-white focus:border-rose-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setRejectingReturn(null)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={rejectLoading}
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {rejectLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>تأكيد رفض المرتجع</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Inspect Item Modal */}
      {inspectingItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-black text-slate-900 text-base">فحص بند المرتجع واعتماد إعادة التخزين</h3>
              <button onClick={() => setInspectingItem(null)} className="text-slate-400 hover:text-slate-600 font-bold">
                ✕
              </button>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
              <p className="font-bold text-slate-900">
                {inspectingItem.model_code} - {inspectingItem.model_name}
              </p>
              <p className="text-slate-600">
                اللون: <strong>{inspectingItem.color_name}</strong> • المقاس: <strong>{inspectingItem.size_name}</strong>
              </p>
              <p className="text-slate-600">
                الكمية المرتجعة: <strong>{inspectingItem.returned_quantity} قطعة</strong>
              </p>
            </div>

            <form onSubmit={handleInspectSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-2">قرار الفحص الفني *</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setInspectionDisposition('sellable')}
                    className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                      inspectionDisposition === 'sellable'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-950 font-black shadow-xs'
                        : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 mx-auto mb-1" />
                    <span>سليم وصالح لإعادة البيع</span>
                    <span className="block text-[10px] text-emerald-700 mt-1 font-normal">
                      (يعاد فوراً للمخزن المتاح)
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setInspectionDisposition('damaged')}
                    className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                      inspectionDisposition === 'damaged'
                        ? 'bg-rose-50 border-rose-500 text-rose-950 font-black shadow-xs'
                        : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    <XCircle className="w-5 h-5 text-rose-600 mx-auto mb-1" />
                    <span>تالف / به عيب صناعة</span>
                    <span className="block text-[10px] text-rose-700 mt-1 font-normal">
                      (يمنع إعادته للمخزن)
                    </span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">تقرير الفحص والملاحظات</label>
                <textarea
                  rows={2}
                  value={inspectionNotes}
                  onChange={(e) => setInspectionNotes(e.target.value)}
                  placeholder="حالة التغليف، البطاقات، سبب الرفض أو القبول..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:bg-white focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setInspectingItem(null)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={inspectLoading}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {inspectLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>اعتماد قرار الفحص</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Return Request Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-black text-slate-900 text-base">تسجيل طلب إرجاع بضاعة جديد</h3>
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

            <form onSubmit={handleCreateReturn} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">العميل صاحب المرتجع *</label>
                <select
                  required
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-bold focus:bg-white focus:border-indigo-500"
                >
                  <option value="">-- اختر العميل --</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.phone})
                    </option>
                  ))}
                </select>
              </div>

              {/* Order selector (Optional but recommended) */}
              {selectedCustomerId && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">ربط بفاتورة مبيعات سابقة (موصى به):</label>
                  <select
                    value={selectedOrderId}
                    onChange={(e) => setSelectedOrderId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:bg-white focus:border-indigo-500"
                  >
                    <option value="">-- بدون ربط بفاتورة محددة (إرجاع يدوي) --</option>
                    {customerOrders.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.order_number} ({new Date(o.order_date).toLocaleDateString('ar-EG')}) - الحالة:{' '}
                        {o.status}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Items from selected order */}
              {selectedOrderId && selectedOrderItems.length > 0 && (
                <div className="border border-slate-200 rounded-xl p-3 bg-indigo-50/50 space-y-2">
                  <div className="font-bold text-indigo-900 flex items-center justify-between">
                    <span>أصناف الفاتورة المشحونة (انقر للإضافة للطلب):</span>
                  </div>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {selectedOrderItems.map((oi) => {
                      const shipped = Number(oi.shipped_quantity || 0);
                      return (
                        <div
                          key={oi.id}
                          className="flex items-center justify-between p-2 bg-white rounded-lg border border-slate-200 text-xs"
                        >
                          <div>
                            <span className="font-mono font-bold text-indigo-900">{oi.model_code}</span> -{' '}
                            <span>{oi.color_name}</span> ({oi.size_name})
                            <span className="text-slate-500 mr-2">
                              (المشحون: <strong className="text-slate-800">{shipped}</strong>)
                            </span>
                          </div>
                          <button
                            type="button"
                            disabled={shipped <= 0}
                            onClick={() => handleAddReturnItemFromOrder(oi)}
                            className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-30 text-white rounded-md font-bold text-[11px] cursor-pointer"
                          >
                            + إضافة
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">سبب الإرجاع *</label>
                <input
                  type="text"
                  required
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  placeholder="مثال: مقاس غير مناسب للزبون، فحص إضافي..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:bg-white focus:border-indigo-500"
                />
              </div>

              {/* Search variant if manual */}
              {!selectedOrderId && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">ابحث عن الصنف لإضافته:</label>
                  <input
                    type="text"
                    value={inventorySearch}
                    onChange={(e) => setInventorySearch(e.target.value)}
                    placeholder="كود الموديل أو اللون..."
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:bg-white focus:border-indigo-500"
                  />

                  {searchResults.length > 0 && (
                    <div className="mt-2 border border-slate-200 rounded-xl p-2 max-h-36 overflow-y-auto space-y-1">
                      {searchResults.map((v) => (
                        <button
                          key={v.variant_id}
                          type="button"
                          onClick={() => handleAddReturnItemFromSearch(v)}
                          className="w-full text-right p-2 rounded-lg bg-slate-50 hover:bg-slate-100 flex items-center justify-between"
                        >
                          <span>
                            {v.model_code} - {v.color_name} ({v.size_name})
                          </span>
                          <span className="text-indigo-600 font-bold">+ إضافة</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Chosen return items */}
              {returnItems.length > 0 && (
                <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 space-y-2">
                  <span className="font-bold text-slate-800">الأصناف المحددة للإرجاع ({returnItems.length}):</span>
                  {returnItems.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs bg-white p-2 rounded-lg border border-slate-200">
                      <span className="font-bold text-slate-800">{item.label}</span>
                      <div className="flex items-center gap-2">
                        <label className="text-slate-500">الكمية:</label>
                        <input
                          type="number"
                          min="1"
                          max={item.max_qty}
                          value={item.returned_quantity}
                          onChange={(e) => {
                            const updated = [...returnItems];
                            let val = Math.max(1, Number(e.target.value));
                            if (item.max_qty && val > item.max_qty) {
                              val = item.max_qty;
                            }
                            updated[idx].returned_quantity = val;
                            setReturnItems(updated);
                          }}
                          className="w-16 bg-slate-50 border border-slate-300 rounded px-2 py-0.5 text-center font-bold"
                        />
                        {item.max_qty && (
                          <span className="text-[10px] text-slate-400">/ أقصى {item.max_qty}</span>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setReturnItems(returnItems.filter((_, i) => i !== idx));
                          }}
                          className="text-rose-500 hover:text-rose-700 text-xs px-1"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

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
                  <span>حفظ طلب الإرجاع</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
