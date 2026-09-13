'use client';

import Image from 'next/image';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { CrudButtons } from '@/components/ui/CrudButtons';
import { Input } from '@/components/ui/input';
import { ExtractsPageChrome } from '@/components/extracts/ExtractsPageChrome';
import { DASH_PANEL } from '@/components/dashboard-primitives';
import { Pagination } from '@/components/ui/Pagination';
import { ActionButtons } from '@/components/ui/ActionButtons';
import { useApiQuery, useApiMutation, useInvalidateQuery } from '@/lib/hooks/useApi';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatMoneyAr } from '@/lib/formatMoney';
import {
  exportExtractReportRows,
  EXTRACT_PAYMENT_EXPORT_COLUMNS,
  printExtractPaymentReport,
} from '@/lib/reports/simpleReportActions';
import type { ApiError } from '@/lib/api/types';

type ExtractProjectOption = {
  id: string;
  arabicName?: string;
  serial?: string;
};

type ExtractContractorOption = {
  id: string;
  arabicName?: string;
  serial?: string | null;
};

type ExtractPaymentRow = {
  id: string;
  notes?: string | null;
  paymentAmount?: number | string | null;
  itemGroup?: string | null;
  description?: string | null;
  extract?: { extractNumber?: string | null };
  contractor?: { arabicName?: string; serial?: string | null };
};

export default function ExtractPaymentPage() {
  const invalidateQuery = useInvalidateQuery();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedPaymentIds, setSelectedPaymentIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [formData, setFormData] = useState({
    serial: '',
    description: '',
    projectId: '',
    contractorId: '',
    date: '',
    amount: '',
  });

  // Fetch projects and contractors (for form selects)
  const { data: projectsResponse } = useApiQuery<ExtractProjectOption[]>(
    ['projects'],
    '/extracts/projects',
    { limit: 1000, isActive: true }
  );
  const projects = projectsResponse?.data ?? [];

  const { data: contractorsResponse } = useApiQuery<ExtractContractorOption[]>(
    ['contractors'],
    '/extracts/contractors',
    { limit: 1000, isActive: true }
  );
  const contractors = contractorsResponse?.data ?? [];

  const paymentListParams = useMemo(() => {
    if (!formData.projectId) return undefined;
    const p: Record<string, string | number> = { page, limit: pageSize };
    if (formData.projectId) p.projectId = formData.projectId;
    if (formData.contractorId) p.contractorId = formData.contractorId;
    return p;
  }, [formData.projectId, formData.contractorId, page, pageSize]);

  const { data: paymentsResponse, isLoading: paymentsLoading } = useApiQuery<ExtractPaymentRow[]>(
    ['extract-payments', paymentListParams, page],
    '/extracts/payments',
    paymentListParams,
    { enabled: !!formData.projectId }
  );
  const paymentRows = paymentsResponse?.data ?? [];
  const paymentRowsTotal = paymentsResponse?.pagination?.total ?? paymentsResponse?.meta?.total ?? paymentRows.length;

  useEffect(() => {
    setPage(1);
  }, [formData.projectId, formData.contractorId]);

  const paymentTotal = useMemo(() => {
    let sum = 0;
    for (const row of paymentRows) {
      const n =
        typeof row.paymentAmount === 'string'
          ? parseFloat(row.paymentAmount)
          : Number(row.paymentAmount);
      if (!Number.isNaN(n)) sum += n;
    }
    return sum;
  }, [paymentRows]);

  // Payment mutation
  const paymentMutation = useApiMutation<unknown, Record<string, unknown>>(
    '/extracts/payments',
    'POST',
    {
      onSuccess: () => {
        setSuccess('تم حفظ سداد المستخلص بنجاح');
        invalidateQuery(['extract-payments']);
        handleCancel();
      },
      onError: (error: ApiError) => {
        setError(error.message || 'حدث خطأ أثناء الحفظ');
      },
    }
  );

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    setFormData(prev => ({ ...prev, date: today }));
  }, []);

  const handleSave = () => {
    setError('');
    setSuccess('');

    if (!formData.projectId) {
      setError('يرجى اختيار المشروع');
      return;
    }

    if (!formData.contractorId) {
      setError('يرجى اختيار المقاول');
      return;
    }

    if (!formData.date) {
      setError('يرجى تحديد التاريخ');
      return;
    }

    const requestBody: Record<string, unknown> = {
      serial: formData.serial || undefined,
      description: formData.description || undefined,
      projectId: formData.projectId,
      contractorId: formData.contractorId,
      date: new Date(formData.date).toISOString(),
      amount: formData.amount ? parseFloat(formData.amount) : undefined,
    };

    paymentMutation.mutate(requestBody);
  };

  const handleCancel = () => {
    setFormData({
      serial: '',
      description: '',
      projectId: '',
      contractorId: '',
      date: new Date().toISOString().split('T')[0],
      amount: '',
    });
    setSelectedPaymentIds([]);
    setError('');
    setSuccess('');
  };

  const handleAddNew = () => {
    setFormData((prev) => ({
      serial: '',
      description: '',
      projectId: prev.projectId,
      contractorId: prev.contractorId,
      date: new Date().toISOString().split('T')[0],
      amount: '',
    }));
    setSelectedPaymentIds([]);
    setError('');
  };

  const handleEditSelected = () => {
    if (selectedPaymentIds.length !== 1) {
      setError('اختر سجل سداد واحد للتعديل');
      return;
    }
    const row = paymentRows.find((r) => r.id === selectedPaymentIds[0]);
    if (!row) return;
    setFormData((prev) => ({
      ...prev,
      serial: row.notes ?? '',
      description: row.description ?? '',
      amount:
        row.paymentAmount != null && row.paymentAmount !== ''
          ? String(row.paymentAmount)
          : '',
    }));
    setError('');
  };

  const toggleRowSelection = (id: string) => {
    setSelectedPaymentIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedPaymentIds.length === paymentRows.length) {
      setSelectedPaymentIds([]);
    } else {
      setSelectedPaymentIds(paymentRows.map((r) => r.id));
    }
  };

  const rowsForExport = useMemo(() => {
    if (!selectedPaymentIds.length) return paymentRows;
    const set = new Set(selectedPaymentIds);
    return paymentRows.filter((r) => set.has(r.id));
  }, [paymentRows, selectedPaymentIds]);

  const handlePrint = () => {
    if (!paymentRows.length) {
      setError('لا توجد سجلات للطباعة');
      return;
    }
    printExtractPaymentReport('سداد المستخلص');
  };

  const handleExport = async () => {
    if (!rowsForExport.length) {
      setError('لا توجد سجلات للتصدير');
      return;
    }
    await exportExtractReportRows(
      'extract-payments',
      EXTRACT_PAYMENT_EXPORT_COLUMNS,
      rowsForExport as unknown as Record<string, unknown>[]
    );
  };

  return (
    <ExtractsPageChrome title="سداد المستخلص">
      <div className={`${DASH_PANEL} p-5`}>
            <div className="flex gap-2 items-center mb-4"> 
                              <Button className="bg-[#0E78AA] text-white px-6 py-2 rounded-lg hover:bg-[#094C6B] transition-colors">
                  القيد
                </Button>
              <Input defaultValue="0000012345" className="text-right w-48" readOnly />
            </div>
            <div className="mb-4 flex justify-between items-center gap-4">
             <div>
             <Pagination page={page} pageSize={pageSize} total={paymentRowsTotal} onPageChange={setPage} />
             </div>
             </div>

            {/* Main Form Section */}
            <div className="bg-white rounded-2xl p-6 border border-[#E6F0F7] mb-6">
              <div className="grid grid-cols-2 gap-6">
                {/* Left Column - Extract Details */}
                <div className="space-y-4">
                  <div className="flex gap-2 items-center">
                    <label className="w-20 text-zinc-800 text-right text-sm font-medium">الكود</label>
                    <Input defaultValue="0000012345" className="text-right flex-1" readOnly />
                  </div>
                  <div className="flex gap-2 items-start">
                    <label className="w-20 text-zinc-800 text-right text-sm font-medium mt-3">الشرح</label>
                    <textarea 
                      placeholder="إدخل الشرح"
                      className="text-right flex-1 p-3 rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] text-[#094C6B] min-h-[80px] resize-none focus:border-[#0E79AA] focus:ring-[#0E79AA]"
                    />
                  </div>
                  <div className="flex gap-2 items-center">
                    <label className="w-20 text-zinc-800 text-right text-sm font-medium">المشروع</label>
                    <select
                      className="text-right flex-1 p-2 rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] text-[#094C6B]"
                      value={formData.projectId}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, projectId: e.target.value }))
                      }
                    >
                      <option value="">— اختر مشروعاً —</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.arabicName ?? p.serial ?? p.id}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex gap-2 items-center">
                    <label className="w-20 text-zinc-800 text-right text-sm font-medium">المقاول</label>
                    <select
                      className="text-right flex-1 p-2 rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] text-[#094C6B]"
                      value={formData.contractorId}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, contractorId: e.target.value }))
                      }
                    >
                      <option value="">— اختر مقاولاً —</option>
                      {contractors.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.arabicName ?? c.serial ?? c.id}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Right Column - Payment Details */}
                <div className="space-y-4">
                  <div className="flex gap-2 items-center">
                    <label className="w-20 text-zinc-800 text-right text-sm font-medium">التاريخ</label>
                    <div className="relative flex-1">
                      <Input defaultValue="26-11-2025" className="text-right pr-10" />
                      <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">📅</span>
                    </div>
                  </div>
                  <div className="flex gap-2 items-center">
                    <label className="w-20 text-zinc-800 text-right text-sm font-medium">الصندوق</label>
                    <div className="flex gap-2 flex-1">
                      <div className="relative flex-1">
                        <Input defaultValue="صندوق رقم 1" className="text-right pr-10" readOnly />
                        <Image src="/magnifying-glass-1.svg" alt="بحث" width={16} height={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4" />
                      </div>
                      <Input defaultValue="00000000000001" className="text-right flex-1" readOnly />
                    </div>
                  </div>
                  <div className="flex gap-2 items-center">
                    <label className="w-20 text-zinc-800 text-right text-sm font-medium">تاريخ الإستحقاق</label>
                    <div className="relative flex-1">
                      <Input defaultValue="26-11-2025" className="text-right pr-10" />
                      <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">📅</span>
                    </div>
                  </div>
                  <div className="flex gap-2 items-center">
                    <label className="w-20 text-zinc-800 text-right text-sm font-medium">الهجري</label>
                    <Input defaultValue="26-11-2025" className="text-right flex-1" />
                  </div>
                  <div className="flex gap-2 items-center">
                    <label className="w-20 text-zinc-800 text-right text-sm font-medium">رقم الشيك</label>
                    <Input placeholder="إدخل رقم الشيك" className="text-right flex-1" />
                  </div>
                  <div className="flex gap-2 items-center">
                    <label className="w-20 text-zinc-800 text-right text-sm font-medium">الهجري</label>
                    <Input defaultValue="26-11-2025" className="text-right flex-1" />
                  </div>
                </div>
              </div>

              {/* Next Button and Total */}
              <div className="flex justify-center items-center gap-4 mt-6">
                <div className="bg-gray-100 px-4 py-2 rounded-lg">
                  <span className="text-gray-700 text-sm">—</span>
                </div>
                <Button className="bg-[#0E78AA] text-white px-8 py-3 rounded-lg hover:bg-[#094C6B] transition-colors">
                  التالي
                </Button>
              </div>
            </div>

            {/* Data Table */}
            <div className="mb-6">
              <div className="overflow-x-auto border border-[#E6F0F7] rounded-lg">
                <table id="extract-payment-table" className="w-full text-center">
                  <thead>
                    <tr className="bg-slate-50/80 text-slate-600 font-semibold">
                      <th className="py-4 px-2 text-sm w-10">
                        <input
                          type="checkbox"
                          checked={paymentRows.length > 0 && selectedPaymentIds.length === paymentRows.length}
                          onChange={toggleSelectAll}
                          aria-label="تحديد الكل"
                          className="rounded border-white"
                        />
                      </th>
                      <th className="py-4 px-4 text-sm">ملاحظات</th>
                      <th className="py-4 px-4 text-sm">يدفع</th>
                      <th className="py-4 px-4 text-sm">ما دفع</th>
                      <th className="py-4 px-4 text-sm">مجموعة البند</th>
                      <th className="py-4 px-4 text-sm">القيمة</th>
                      <th className="py-4 px-4 text-sm">إسم المقاول</th>
                      <th className="py-4 px-4 text-sm">المقاول</th>
                      <th className="py-4 px-4 text-sm">المستخلص</th>
                      <th className="py-4 px-4 text-sm">م</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!formData.projectId ? (
                      <tr>
                        <td colSpan={10} className="py-6">
                          <EmptyState title="اختر المشروع (والمقاول) لعرض سجلات السداد." />
                        </td>
                      </tr>
                    ) : paymentsLoading ? (
                      <tr>
                        <td colSpan={9} className="py-6 text-sm text-gray-600">جاري التحميل…</td>
                      </tr>
                    ) : paymentRows.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="py-6">
                          <EmptyState title="لا توجد دفعات مسجلة لهذا الاختيار." />
                        </td>
                      </tr>
                    ) : (
                      paymentRows.map((row, index) => {
                        const amount =
                          typeof row.paymentAmount === 'string'
                            ? parseFloat(row.paymentAmount)
                            : Number(row.paymentAmount);
                        return (
                          <tr
                            key={row.id}
                            className={`border-b border-slate-100 hover:bg-slate-50/80 ${
                              selectedPaymentIds.includes(row.id) ? 'ring-1 ring-[#0E78AA]/40' : ''
                            }`}
                          >
                            <td className="py-4 px-2">
                              <input
                                type="checkbox"
                                checked={selectedPaymentIds.includes(row.id)}
                                onChange={() => toggleRowSelection(row.id)}
                                aria-label={`تحديد سجل ${index + 1}`}
                              />
                            </td>
                            <td className="py-4 px-4 text-sm text-black">{row.notes ?? row.description ?? '—'}</td>
                            <td className="py-4 px-4 text-sm text-black">—</td>
                            <td className="py-4 px-4 text-sm text-black">{formatMoneyAr(amount)}</td>
                            <td className="py-4 px-4 text-sm text-black">{row.itemGroup ?? '—'}</td>
                            <td className="py-4 px-4 text-sm text-black">{formatMoneyAr(amount)}</td>
                            <td className="py-4 px-4 text-sm text-black">{row.contractor?.arabicName ?? '—'}</td>
                            <td className="py-4 px-4 text-sm text-black">{row.contractor?.serial ?? '—'}</td>
                            <td className="py-4 px-4 text-sm text-black">{row.extract?.extractNumber ?? '—'}</td>
                            <td className="py-4 px-4 text-sm text-black">{index + 1}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Summary Section */}
            <div className="bg-white rounded-2xl p-6 border border-[#E6F0F7] mb-6">
              <div className="flex justify-between items-start">
                {/* Left Side - Totals */}
                <div className="space-y-4">
                  <div className="flex gap-2 items-center">
                    <label className="w-32 text-zinc-800 text-right text-sm font-medium">إجمالي المستخلصات</label>
                    <Input value={formatMoneyAr(paymentTotal)} className="text-right w-32 text-sm" readOnly />
                  </div>
                  <div className="flex gap-2 items-center">
                    <label className="w-32 text-zinc-800 text-right text-sm font-medium">إجمالي الدفوع سابقاً</label>
                    <Input value={formatMoneyAr(paymentTotal)} className="text-right w-32 text-sm" readOnly />
                  </div>
                  <div className="flex gap-2 items-center">
                    <label className="w-32 text-zinc-800 text-right text-sm font-medium">إجمالي السند</label>
                    <Input
                      value={formData.amount ? formatMoneyAr(parseFloat(formData.amount)) : '—'}
                      className="text-right w-32 text-sm"
                      readOnly
                    />
                    <Button className="bg-[#0E78AA] text-white px-4 py-2 rounded-md hover:bg-[#094C6B] transition-colors text-sm">
                      التوزيع
                    </Button>
                  </div>
                </div>

                {/* Right Side - Action Buttons */}
                <div className="flex gap-2 flex-wrap items-center">
                  <CrudButtons
                    onAdd={handleAddNew}
                    onEdit={handleEditSelected}
                    onPrevious={() =>
                      document.getElementById('extract-payment-table')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                    }
                  />
                  <Button
                    type="button"
                    onClick={handleCancel}
                    className="bg-[#0E78AA] text-white hover:bg-[#094C6B] px-4 py-2 rounded-md flex items-center gap-2 transition-colors"
                  >
                    <span className="text-lg">✕</span> إلغاء
                  </Button>
                  <Button
                    type="button"
                    onClick={() => void handleExport()}
                    className="bg-[#0E78AA] text-white hover:bg-[#094C6B] px-4 py-2 rounded-md flex items-center gap-2 transition-colors"
                  >
                    تصدير
                  </Button>
                  <Button
                    type="button"
                    onClick={handlePrint}
                    className="bg-[#0E78AA] text-white hover:bg-[#094C6B] px-4 py-2 rounded-md flex items-center gap-2 transition-colors"
                  >
                    <span className="text-lg">🖨️</span> طباعة
                  </Button>
                </div>
              </div>
            </div>

            {error && <ErrorToast message={error} onClose={() => setError('')} />}
            {success && <SuccessToast message={success} onClose={() => setSuccess('')} />}
            
            {/* Bottom Action Buttons */}
            <div className="flex flex-row-reverse mt-10">
            <ActionButtons 
              onSave={handleSave}
              onCancel={handleCancel}
              saveText={paymentMutation.isPending ? 'جاري الحفظ...' : 'حفظ'}
            />
          </div>
      </div>
    </ExtractsPageChrome>
  );
} 