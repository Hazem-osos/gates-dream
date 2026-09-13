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
import type { ApiError } from '@/lib/api/types';

type ExtractProjectOption = {
  id: string;
  arabicName?: string;
  serial?: string;
};

type ManpowerLogRow = {
  id: string;
  workerName: string;
  workerType?: string | null;
  notes?: string | null;
  total?: number | string | null;
  wage?: number | string | null;
};

export default function ManpowerLogPage() {
  const invalidateQuery = useInvalidateQuery();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [formData, setFormData] = useState({
    serial: '',
    date: '',
    hijriDate: '',
    contractorId: '',
    projectId: '',
  });

  const { data: projectsResponse } = useApiQuery<ExtractProjectOption[]>(
    ['projects'],
    '/extracts/projects',
    { limit: 1000, isActive: true }
  );
  const projects = projectsResponse?.data || [];

  const logQueryParams = useMemo(() => {
    if (!formData.projectId) return undefined;
    return { projectId: formData.projectId, page, limit: pageSize };
  }, [formData.projectId, page, pageSize]);

  const { data: logsResponse, isLoading: logsLoading } = useApiQuery<ManpowerLogRow[]>(
    ['manpower-logs', logQueryParams, page],
    '/extracts/manpower-logs',
    logQueryParams,
    { enabled: !!formData.projectId }
  );
  const logRows = logsResponse?.data ?? [];
  const logsRowsTotal = logsResponse?.pagination?.total ?? logsResponse?.meta?.total ?? logRows.length;

  useEffect(() => {
    setPage(1);
  }, [formData.projectId]);

  const logsTotal = useMemo(() => {
    let sum = 0;
    for (const row of logRows) {
      const raw = row.total ?? row.wage;
      const n = typeof raw === 'string' ? parseFloat(raw) : Number(raw);
      if (!Number.isNaN(n)) sum += n;
    }
    return sum;
  }, [logRows]);

  // Manpower log mutation
  const manpowerLogMutation = useApiMutation<unknown, Record<string, unknown>>(
    '/extracts/manpower-logs',
    'POST',
    {
      onSuccess: () => {
        setSuccess('تم حفظ سركي العمالة بنجاح');
        invalidateQuery(['manpower-logs']);
        handleCancel();
      },
      onError: (error: ApiError) => {
        setError(error.message || 'حدث خطأ أثناء الحفظ');
      },
    }
  );

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    setFormData(prev => ({ ...prev, date: today, hijriDate: today }));
  }, []);

  const handleSave = () => {
    setError('');
    setSuccess('');

    if (!formData.date) {
      setError('يرجى تحديد التاريخ');
      return;
    }

    const requestBody: Record<string, unknown> = {
      serial: formData.serial || undefined,
      date: new Date(formData.date).toISOString(),
      hijriDate: formData.hijriDate || undefined,
      contractorId: formData.contractorId || undefined,
      projectId: formData.projectId || undefined,
    };

    manpowerLogMutation.mutate(requestBody);
  };

  const handleCancel = () => {
    setFormData({
      serial: '',
      date: '',
      hijriDate: '',
      contractorId: '',
      projectId: '',
    });
    setError('');
    setSuccess('');
  };

  return (
    <ExtractsPageChrome title=" سركي العمالة">
      <div className={`${DASH_PANEL} p-5`}>
            {/* Top Navigation/Header Section */}
            <div className="mb-6">
              {/* Pagination Controls (Top Left) */}
              <div className="mb-4 flex justify-end">
                <Pagination page={page} pageSize={pageSize} total={logsRowsTotal} onPageChange={setPage} />
              </div>
              
              {/* Global Action Buttons (Top Right) */}
              <div className="flex justify-between items-center mb-4">
                <div className="flex gap-2">
                  <Button className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-md">
                    القيد
                  </Button>
                  <Input defaultValue="0000012345" className="text-right w-48" readOnly />
                </div>
              </div>

              {/* Help/Search Icons */}
     
            </div>

            {/* Main Content Area - Input Forms and Filters */}
            <div className="bg-white rounded-2xl p-6 border border-[#E6F0F7] mb-6">
              {/* Main Form Section */}
              <div className="grid grid-cols-2 gap-6 mb-6">
                {/* Left Column */}
                
                <div className="space-y-4">
                  <div className="flex gap-2 items-center">
                    <label className="w-20 text-zinc-800 text-right text-sm font-medium">الكود</label>
                    <Input defaultValue="000000000001" className="text-right flex-1" readOnly />
                  </div>
                  <div className="flex gap-2 items-center">
                    <label className="w-24 text-zinc-800 text-right text-sm font-medium">تاريخ السركي</label>
                    <Input type="date" defaultValue="2025-11-26" className="text-right flex-1" />
                  </div>
                  
                  <div className="flex gap-2 items-center">
                    <label className="w-28 text-zinc-800 text-right text-sm font-medium">المشروع</label>
                    <select
                      className="text-right flex-1 p-2 rounded-lg border border-[#D6EAF3] bg-[#F6FBFD]"
                      value={formData.projectId}
                      onChange={(e) => setFormData((p) => ({ ...p, projectId: e.target.value }))}
                    >
                      <option value="">اختر المشروع</option>
                      {projects.map((p: { id: string; arabicName?: string; serial?: string }) => (
                        <option key={p.id} value={p.id}>
                          {p.arabicName ?? p.serial ?? p.id}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex gap-2 items-center">
                    <label className="w-28 text-zinc-800 text-right text-sm font-medium">مقاول العمال</label>
                    <div className="flex gap-2 flex-1">
                      <Button className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-md whitespace-nowrap">
                        مقاول رقم 1
                      </Button>
                      <div className="relative flex-1">
                        <Input defaultValue="00000000000001" className="text-right pr-10" readOnly />
                        <Image src="/magnifying-glass-1.svg" alt="بحث" width={16} height={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4" />
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Right Column */}
                <div className="space-y-4">
                  <div className="flex gap-2 items-start">
                    <label className="w-20 text-zinc-800 text-right text-sm font-medium mt-3">الشرح</label>
                    <textarea 
                      placeholder="إدخل الشرح"
                      className="text-right flex-1 p-3 rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] text-[#094C6B] min-h-[80px] resize-none focus:border-[#0E79AA] focus:ring-[#0E79AA]"
                    />
                  </div>
                  
                  <div className="flex gap-2 items-center">
                    <label className="w-28 text-zinc-800 text-right text-sm font-medium">مركز التكلفة</label>
                    <div className="flex gap-2 flex-1">
                      <Button className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-md whitespace-nowrap">
                        م التكلفة رقم 1
                      </Button>
                      <div className="relative flex-1">
                        <Input defaultValue="00000000000001" className="text-right pr-10" readOnly />
                        <Image src="/magnifying-glass-1.svg" alt="بحث" width={16} height={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
   
            </div>

            {/* Data Table Section */}
            <div className="mb-6">
              <div className="overflow-x-auto border border-[#E6F0F7] rounded-lg">
                <table id="manpower-log-table" className="w-full text-center">
                  <thead>
                    <tr className="bg-slate-50/80 text-slate-600 font-semibold">
                      <th className="py-4 px-4 text-sm">م</th>
                      <th className="py-4 px-4 text-sm">إسم العامل</th>
                      <th className="py-4 px-4 text-sm">رقم البطاقة</th>
                      <th className="py-4 px-4 text-sm">بيان الأعمال</th>
                      <th className="py-4 px-4 text-sm">المبلغ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!formData.projectId ? (
                      <tr>
                        <td colSpan={5} className="py-6">
                          <EmptyState title="اختر المشروع لعرض سجل العمالة." />
                        </td>
                      </tr>
                    ) : logsLoading ? (
                      <tr>
                        <td colSpan={5} className="py-6 text-sm text-gray-600">جاري التحميل…</td>
                      </tr>
                    ) : logRows.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-6">
                          <EmptyState title="لا توجد حركات عمالة لهذا المشروع." />
                        </td>
                      </tr>
                    ) : (
                      logRows.map((row, index) => {
                        const amount = row.total ?? row.wage;
                        const n = typeof amount === 'string' ? parseFloat(amount) : Number(amount);
                        return (
                          <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50/80">
                            <td className="py-4 px-4 text-sm text-black">{index + 1}</td>
                            <td className="py-4 px-4 text-sm text-black">{row.workerName}</td>
                            <td className="py-4 px-4 text-sm text-black">{row.workerType ?? '—'}</td>
                            <td className="py-4 px-4 text-sm text-black">{row.notes ?? '—'}</td>
                            <td className="py-4 px-4 text-sm text-black">{Number.isNaN(n) ? '—' : formatMoneyAr(n)}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="flex justify-center items-center gap-4">
                <div className="bg-gray-100 px-4 py-2 rounded-lg">
                  <span className="text-gray-700 text-sm">—</span>
                </div>
                <Button className="bg-[#0E78AA] text-white px-8 py-3 rounded-lg hover:bg-[#094C6B] transition-colors">
                  التالي
                </Button>
              </div>
            {/* Bottom Action Buttons and Summary */}
            <div className="flex items-center gap-4">
                <div className="bg-gray-100 px-4 py-2 rounded-lg">
                  <span className="text-gray-700 text-sm">{formData.projectId ? formatMoneyAr(logsTotal) : '—'}</span>
                </div>
                <label className="text-zinc-800 text-sm font-medium">الإجمالي</label>
              </div>
            <div className="flex flex-row-reverse gap-4 mt-8 justify-between">
              <div className="flex flex-row-reverse">
                {error && <ErrorToast message={error} onClose={() => setError('')} />}
                {success && <SuccessToast message={success} onClose={() => setSuccess('')} />}
                <ActionButtons
                  onSave={handleSave}
                  onCancel={handleCancel}
                  saveText={manpowerLogMutation.isPending ? 'جاري الحفظ...' : 'حفظ'}
                />
              </div>
              <div className="flex flex-row-reverse gap-4 items-center">
                <CrudButtons
                  onPrevious={() =>
                    document.getElementById('manpower-log-table')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  }
                />
                <Button className="bg-[#0E78AA] text-white w-40 py-3 rounded-lg hover:bg-[#094C6B] transition flex items-center gap-2">
                  <span className="text-xl">✖️</span> إلغاء
                </Button>
              </div>
            </div>
      </div>
    </ExtractsPageChrome>
  );
}
