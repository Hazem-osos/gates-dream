"use client";

import Image from 'next/image';
import React, { useState, useEffect, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CrudButtons } from '@/components/ui/CrudButtons';
import { Input } from "@/components/ui/input";
import { ActionButtons } from "@/components/ui/ActionButtons";
import { ExtractsPageChrome } from '@/components/extracts/ExtractsPageChrome';
import { DASH_PANEL } from '@/components/dashboard-primitives';
import { useApiQuery, useApiMutation, useInvalidateQuery } from "@/lib/hooks/useApi";
import { useBackendReachability } from "@/lib/hooks/useBackendReachability";
import ErrorToast from "@/components/ErrorToast";
import SuccessToast from "@/components/SuccessToast";
import type { ApiError } from '@/lib/api/types';

function fmt(v: unknown) {
  if (v == null || v === '') return '—';
  return String(v);
}

type ContractingProjectOption = {
  id: string;
  projectName?: string;
  projectCode?: string;
};

type MakeExtractWorkItem = {
  id: string;
  quantity?: number | string | null;
  unit?: string | null;
  arabicName?: string | null;
  itemNumber?: string | null;
  itemGroupName?: string | null;
  itemGroupCode?: string | null;
  notes?: string | null;
  building?: { unitNumber?: string | null; modelNumber?: string | null };
};

export default function MakeExtractPage() {
  useBackendReachability();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const paramProjectId = searchParams.get("projectId") ?? "";

  const invalidateQuery = useInvalidateQuery();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [formData, setFormData] = useState({
    serial: '',
    contractorId: '',
    projectId: '',
    extractDate: '',
    description: '',
    grossAmount: '',
  });

  const { data: projectsResponse } = useApiQuery<ContractingProjectOption[]>(
    ['contracting-projects'],
    '/contracting/projects',
    { limit: 1000 }
  );
  const projects = projectsResponse?.data || [];

  useEffect(() => {
    if (!projects.length) return;
    const fromUrl = paramProjectId && projects.some((p: { id: string }) => p.id === paramProjectId);
    const pick = fromUrl ? paramProjectId : projects[0].id;
    setFormData((prev) => (prev.projectId ? prev : { ...prev, projectId: pick }));
    if (!paramProjectId && pick) {
      const q = new URLSearchParams(searchParams.toString());
      q.set("projectId", pick);
      router.replace(`${pathname}?${q.toString()}`, { scroll: false });
    }
  }, [projects, paramProjectId, pathname, router, searchParams]);

  const effectiveProjectId = useMemo(() => {
    if (formData.projectId) return formData.projectId;
    if (paramProjectId) return paramProjectId;
    return projects[0]?.id ?? "";
  }, [formData.projectId, paramProjectId, projects]);

  const { data: workRes, isLoading: workLoading } = useApiQuery<MakeExtractWorkItem[]>(
    ['extracts-work-items', effectiveProjectId, 'make-extract'],
    '/extracts/work-items',
    { projectId: effectiveProjectId, limit: 500 },
    { enabled: Boolean(effectiveProjectId) }
  );
  const workItems = workRes?.data || [];

  const onProjectChange = (id: string) => {
    setFormData((prev) => ({ ...prev, projectId: id }));
    const q = new URLSearchParams(searchParams.toString());
    if (id) q.set("projectId", id);
    else q.delete("projectId");
    router.replace(`${pathname}?${q.toString()}`, { scroll: false });
  };

  // Extract mutation
  const extractMutation = useApiMutation<unknown, Record<string, unknown>>(
    '/contracting/client-extracts',
    'POST',
    {
      onSuccess: () => {
        setSuccess('تم إنشاء المستخلص بنجاح');
        invalidateQuery(['contracting-client-extracts']);
        handleCancel();
      },
      onError: (error: ApiError) => {
        setError(error.message || 'حدث خطأ أثناء الإنشاء');
      },
    }
  );

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    setFormData(prev => ({ ...prev, extractDate: today }));
  }, []);

  const handleSave = () => {
    setError('');
    setSuccess('');

    const projectId = formData.projectId || effectiveProjectId;
    if (!projectId) {
      setError('يرجى اختيار المشروع');
      return;
    }

    if (!formData.extractDate) {
      setError('يرجى تحديد تاريخ المستخلص');
      return;
    }

    const grossAmount = Number(formData.grossAmount);
    if (!Number.isFinite(grossAmount) || grossAmount <= 0) {
      setError('يرجى إدخال قيمة المستخلص');
      return;
    }

    const requestBody = {
      projectId,
      extractNumber: formData.serial.trim() || `EXT-${Date.now()}`,
      grossAmount,
      periodStart: new Date(formData.extractDate).toISOString(),
      periodEnd: new Date(formData.extractDate).toISOString(),
    };

    extractMutation.mutate(requestBody);
  };

  const handleCancel = () => {
    const today = new Date().toISOString().split('T')[0];
    const pid = projects[0]?.id ?? '';
    setFormData({
      serial: '',
      contractorId: '',
      projectId: pid,
      extractDate: today,
      description: '',
      grossAmount: '',
    });
    setError('');
    setSuccess('');
    if (pid) {
      const q = new URLSearchParams(searchParams.toString());
      q.set('projectId', pid);
      router.replace(`${pathname}?${q.toString()}`, { scroll: false });
    }
  };

  return (
    <ExtractsPageChrome title="إنشاء مستخلص جديد">
      <div className={`${DASH_PANEL} p-5`}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <div
            className="flex gap-2 items-center flex-row-reverse flex-1 min-w-[200px]"
            data-tour="contracting-project-select"
          >
            <select
              id="make-extract-project"
              value={formData.projectId || effectiveProjectId}
              onChange={(e) => onProjectChange(e.target.value)}
              className="flex-1 max-w-md rounded-lg border border-[#D6EAF3] bg-white px-3 py-2 text-right text-sm text-zinc-800"
            >
              {projects.length === 0 ? (
                <option value="">لا توجد مشاريع</option>
              ) : (
                projects.map((p: { id: string; projectName?: string; projectCode?: string }) => (
                  <option key={p.id} value={p.id}>
                    {p.projectName ?? p.projectCode ?? p.id}
                  </option>
                ))
              )}
            </select>
            <label
              htmlFor="make-extract-project"
              className="w-32 shrink-0 text-sm font-medium text-zinc-800 text-right whitespace-nowrap"
            >
              المشروع
            </label>
          </div>
        </div>

          <div className="grid grid-cols-2 gap-8 mb-6">
            {/* Right Side - Main Statement Details */}
            <div className="flex flex-col gap-4">
              {/* Action Buttons */}
              <div className="flex gap-4 mb-4">
                <Button className="bg-white text-[#0E78AA] border-2 border-[#0E78AA] px-6 py-2 rounded-lg hover:bg-[#0E78AA] hover:text-white transition-all duration-200 font-medium shadow-sm">
                  إختيار بنود الأعمال
                </Button>
                <Button className="bg-white text-red-500 border-2 border-red-500 px-6 py-2 rounded-lg hover:bg-red-500 hover:text-white transition-all duration-200 font-medium shadow-sm">
                  حذف الكل
                </Button>
              </div>

              {/* Code */}
              <div className="flex gap-2 items-center flex-row-reverse">
                <Input defaultValue="000000000001" className="bg-[#F6FBFD] text-right flex-1" readOnly />
                <label className="w-32 text-zinc-800 text-right">الكود</label>
              </div>

              {/* Contractor */}
              <div className="flex gap-2 items-center flex-row-reverse">
                <div className="flex gap-2 flex-1">
                  <div className="relative flex-1">
                    <Input defaultValue="مقاول رقم 1" className="bg-[#F6FBFD] text-right pr-10" readOnly />
                    <Image src="/magnifying-glass-1.svg" alt="بحث" width={16} height={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4" />
                  </div>
                  <Input defaultValue="00000000000001" className="bg-[#F6FBFD] text-right flex-1" readOnly />
                </div>
                <label className="w-32 text-zinc-800 text-right">المقاول</label>
              </div>

              {/* Tax Authority */}
              <div className="flex gap-2 items-center flex-row-reverse">
                <Input defaultValue="مشروع رقم 1" className="bg-[#F6FBFD] text-right flex-1" readOnly />
                <label className="w-32 text-zinc-800 text-right">مأمورية الضرايب</label>
              </div>

              {/* Statement Date */}
              <div className="flex gap-2 items-center flex-row-reverse">
                <div className="relative flex-1">
                  <Input
                    type="date"
                    value={formData.extractDate}
                    onChange={(e) => setFormData((prev) => ({ ...prev, extractDate: e.target.value }))}
                    className="bg-[#F6FBFD] text-right pr-10"
                  />
                </div>
                <label className="w-32 text-zinc-800 text-right">تاريخ المستخلص</label>
              </div>

              {/* Gross amount */}
              <div className="flex gap-2 items-center flex-row-reverse">
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={formData.grossAmount}
                  onChange={(e) => setFormData((prev) => ({ ...prev, grossAmount: e.target.value }))}
                  className="bg-[#F6FBFD] text-right flex-1"
                  placeholder="0.00"
                />
                <label className="w-32 text-zinc-800 text-right">قيمة المستخلص</label>
              </div>

              {/* Serial */}
              <div className="flex gap-2 items-center flex-row-reverse">
                <Input
                  value={formData.serial}
                  onChange={(e) => setFormData((prev) => ({ ...prev, serial: e.target.value }))}
                  className="bg-[#F6FBFD] text-right flex-1"
                  placeholder="رقم المستخلص"
                />
                <label className="w-32 text-zinc-800 text-right">المسلسل</label>
              </div>

              {/* Statement Description */}
              <div className="flex gap-2 items-start flex-row-reverse">
                <textarea 
                  placeholder="أدخل البيان هنا..."
                  className="bg-[#F6FBFD] text-right flex-1 p-3 rounded-lg border border-[#E6F0F7] min-h-[80px] resize-none"
                />
                <label className="w-32 text-zinc-800 text-right mt-3">البيان</label>
              </div>
            </div>

            {/* Left Side - Filtering/Additional Details */}
            <div className="flex flex-col gap-4 m-12">
              {/* Tax Number */}
              <div className="flex gap-2 items-center flex-row-reverse">
                <div className="relative flex-1">
                  <Input placeholder="إدخل الرقم الضريبي" className="bg-[#F6FBFD] text-right pr-10" />
                  <Image src="/magnifying-glass-1.svg" alt="بحث" width={16} height={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4" />
                </div>
                <label className="w-32 text-zinc-800 text-right">الرقم الضريبي</label>
              </div>

              {/* Hijri Date */}
              <div className="flex gap-2 items-center flex-row-reverse">
                <div className="relative flex-1">
                  <Input defaultValue="26-11-2025" className="bg-[#F6FBFD] text-right pr-10" />
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">📅</span>
                </div>
                <label className="w-32 text-zinc-800 text-right">الهجري</label>
              </div>

              {/* Statement Type - First Set */}
              <div className="flex gap-2 items-center flex-row-reverse">
                <div className="bg-gray-100 rounded-lg p-1 flex gap-1">
                  <label className="relative cursor-pointer">
                    <input type="radio" name="statementType1" value="quantity" defaultChecked className="sr-only peer" />
                    <div className="px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 peer-checked:bg-white peer-checked:text-[#0E78AA] peer-checked:shadow-sm text-gray-600">
                      كمية
                    </div>
                  </label>
                  
                  <label className="relative cursor-pointer">
                    <input type="radio" name="statementType1" value="percentage" className="sr-only peer" />
                    <div className="px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 peer-checked:bg-white peer-checked:text-[#0E78AA] peer-checked:shadow-sm text-gray-600">
                      نسبة
                    </div>
                  </label>
                </div>
                <label className="w-32 text-zinc-800 text-right font-medium">نوع البيان</label>
              </div>

              {/* Statement Type - Second Set */}
              <div className="flex gap-2 items-center flex-row-reverse">
                <div className="bg-gray-100 rounded-lg p-1 flex gap-1">
                  <label className="relative cursor-pointer">
                    <input type="radio" name="statementType2" value="current" defaultChecked className="sr-only peer" />
                    <div className="px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 peer-checked:bg-white peer-checked:text-[#0E78AA] peer-checked:shadow-sm text-gray-600">
                      جاري
                    </div>
                  </label>
                  <label className="relative cursor-pointer">
                    <input type="radio" name="statementType2" value="executive" className="sr-only peer" />
                    <div className="px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 peer-checked:bg-white peer-checked:text-[#0E78AA] peer-checked:shadow-sm text-gray-600">
                      تنفيذي
                    </div>
                  </label>
                </div>
                <label className="w-32 text-zinc-800 text-right font-medium">نوع البيان</label>
                <div className="w-32"></div>
              </div>
            </div>
          </div>

          {/* First Data Table */}
          <div className="mb-6" data-tour="extract-boq-table">
            <div className="overflow-x-auto border border-[#E6F0F7] rounded-lg">
              <table className="min-w-full text-center border-separate border-spacing-0">
                <thead>
                  <tr className="bg-slate-50/80 text-slate-600">
                    <th className="py-3 px-2 text-sm">الحصر</th>
                    <th className="py-3 px-2 text-sm">الوحدة</th>
                    <th className="py-3 px-2 text-sm">إسم بند الأعمال</th>
                    <th className="py-3 px-2 text-sm">رقم البند</th>
                    <th className="py-3 px-2 text-sm">مجموعة البند</th>
                    <th className="py-3 px-2 text-sm">كود مجموعة البند</th>
                    <th className="py-3 px-2 text-sm">رقم المجموعة</th>
                    <th className="py-3 px-2 text-sm">رقم النموذج</th>
                    <th className="py-3 px-2 text-sm">رقم الوحدة</th>
                    <th className="py-3 px-2 text-sm">م</th>
                  </tr>
                </thead>
                <tbody>
                  {!effectiveProjectId ? (
                    <tr>
                      <td colSpan={10} className="py-8 text-center text-gray-500">
                        اختر مشروعاً لعرض بنود الأعمال
                      </td>
                    </tr>
                  ) : workLoading ? (
                    <tr>
                      <td colSpan={10} className="py-8 text-center text-gray-500">
                        جاري تحميل بنود الأعمال…
                      </td>
                    </tr>
                  ) : workItems.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-8 text-center text-gray-500">
                        لا توجد بنود مسجّلة لهذا المشروع
                      </td>
                    </tr>
                  ) : (
                    workItems.map((w, idx: number) => (
                      <tr key={w.id} className="border-b border-slate-100 hover:bg-slate-50/80">
                        <td className="py-2 px-2 text-black">{fmt(w.quantity)}</td>
                        <td className="py-2 px-2 text-black">{fmt(w.unit)}</td>
                        <td className="py-2 px-2 text-black">{fmt(w.arabicName)}</td>
                        <td className="py-2 px-2 text-black">{fmt(w.itemNumber)}</td>
                        <td className="py-2 px-2 text-black">{fmt(w.itemGroupName)}</td>
                        <td className="py-2 px-2 text-black">{fmt(w.itemGroupCode)}</td>
                        <td className="py-2 px-2 text-black">—</td>
                        <td className="py-2 px-2 text-black">—</td>
                        <td className="py-2 px-2 text-black">{fmt(w.building?.unitNumber)}</td>
                        <td className="py-2 px-2 text-black">{idx + 1}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Summary Section */}
          <div className="grid grid-cols-3 gap-6 mb-6" data-tour="extract-deductions-panel">
            <div className="flex gap-2 items-center flex-row-reverse">
              <Input defaultValue="—" className="bg-[#F6FBFD] text-right flex-1" readOnly />
              <label className="w-40 text-zinc-800 text-right">إجمالي الأعمال المنفذة</label>
            </div>
            <div className="flex gap-2 items-center flex-row-reverse">
              <div className="flex gap-2">
                <Input defaultValue="—" className="bg-[#F6FBFD] text-right w-24" readOnly />
                <Input defaultValue="0.00" className="bg-[#F6FBFD] text-right w-24" readOnly />
              </div>
              <label className="w-40 text-zinc-800 text-right">إجمالي الأعمال السابقة بعدد</label>
            </div>
            <div className="flex gap-2 items-center flex-row-reverse">
              <Input defaultValue="—" className="bg-[#F6FBFD] text-right flex-1" readOnly />
              <label className="w-40 text-zinc-800 text-right">صافي أعمال الفترة (المستخلص الحالي)</label>
            </div>
          </div>

          {/* Second Data Table */}
          <div className="mb-6">
            <div className="overflow-x-auto border border-[#E6F0F7] rounded-lg">
              <table className="min-w-full text-center border-separate border-spacing-0">
                <thead>
                  <tr className="bg-slate-50/80 text-slate-600">
                    <th className="py-3 px-2 text-sm">كمية حا</th>
                    <th className="py-3 px-2 text-sm">كمية سابقة</th>
                    <th className="py-3 px-2 text-sm">الحصر</th>
                    <th className="py-3 px-2 text-sm">الوحدة</th>
                    <th className="py-3 px-2 text-sm">البيان</th>
                    <th className="py-3 px-2 text-sm">رقم المجموعة</th>
                    <th className="py-3 px-2 text-sm">رقم النموذج</th>
                    <th className="py-3 px-2 text-sm">رقم الوحدة</th>
                    <th className="py-3 px-2 text-sm">م</th>
                  </tr>
                </thead>
                <tbody>
                  {!effectiveProjectId ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-gray-500">
                        اختر مشروعاً لعرض بنود الأعمال
                      </td>
                    </tr>
                  ) : workLoading ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-gray-500">
                        جاري تحميل بنود الأعمال…
                      </td>
                    </tr>
                  ) : workItems.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-gray-500">
                        لا توجد بنود مسجّلة لهذا المشروع
                      </td>
                    </tr>
                  ) : (
                    workItems.map((w, idx: number) => (
                      <tr key={`${w.id}-b`} className="border-b border-slate-100 hover:bg-slate-50/80">
                        <td className="py-2 px-2 text-black">—</td>
                        <td className="py-2 px-2 text-black">—</td>
                        <td className="py-2 px-2 text-black">{fmt(w.quantity)}</td>
                        <td className="py-2 px-2 text-black">{fmt(w.unit)}</td>
                        <td className="py-2 px-2 text-black">{fmt(w.notes ?? w.arabicName)}</td>
                        <td className="py-2 px-2 text-black">—</td>
                        <td className="py-2 px-2 text-black">—</td>
                        <td className="py-2 px-2 text-black">{fmt(w.building?.unitNumber)}</td>
                        <td className="py-2 px-2 text-black">{idx + 1}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

        <div className="flex justify-between items-center">
          <div className="flex gap-2 items-center">
            <CrudButtons />
            <Button className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-6 py-2 rounded-md flex items-center gap-2">
              <span className="text-lg">👁️</span> معاينة
            </Button>
            <Button className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-6 py-2 rounded-md flex items-center gap-2">
              <span className="text-lg">✏️</span> تصميم
            </Button>
          </div>
          {error && <ErrorToast message={error} onClose={() => setError('')} />}
          {success && <SuccessToast message={success} onClose={() => setSuccess('')} />}
          
          <div className="flex flex-row-reverse gap-4" data-tour="extract-post-btn">
            <ActionButtons 
              onSave={handleSave}
              onCancel={handleCancel}
              saveText={extractMutation.isPending ? 'جاري الحفظ...' : 'حفظ'}
            />
          </div>
        </div>
      </div>
    </ExtractsPageChrome>
  );
}
