'use client';

import Image from 'next/image';

import React, { useState, useEffect } from "react";
import { ExtractsPageChrome } from '@/components/extracts/ExtractsPageChrome';
import { DASH_PANEL } from '@/components/dashboard-primitives';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ActionButtons } from "@/components/ui/ActionButtons";
import ProjectHeader, { type ProjectHeaderForm } from "@/components/ProjectHeader";
import { apiClient } from "@/lib/api/client";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useApiQuery, useInvalidateQuery } from "@/lib/hooks/useApi";
import { AiKnowledgeUploadButton } from "@/components/ai/AiKnowledgeUploadButton";
import ErrorToast from "@/components/ErrorToast";
import SuccessToast from "@/components/SuccessToast";
import type { ApiError } from '@/lib/api/types';

type ExtractProjectListItem = {
  id: string;
  arabicName?: string;
  serial?: string;
  englishName?: string;
};

type ExtractWorkItemRow = {
  id: string;
  itemGroupCode?: string | null;
  itemGroupName?: string | null;
  itemNumber?: string | null;
  arabicName?: string | null;
  quantity?: number | string | null;
  unit?: string | null;
  building?: { unitNumber?: string | null; modelNumber?: string | null };
};

type ExtractBuildingRow = {
  id: string;
  arabicName?: string | null;
  groupNumber?: string | null;
  modelNumber?: string | null;
  unitNumber?: string | null;
};

const tabs = [
  "المخطط التنفيذي وبنود الأعمال",
  "إسناد بنود الأعمال لمقاول",
  "مستخلصات مقاول الباطن",
  "مستخلصات المالك"
];

function parseNum(v: string): number | undefined {
  const n = parseFloat(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : undefined;
}

function buildProjectNotes(header: ProjectHeaderForm, extraNotes: string): string | undefined {
  const parts = [
    header.address?.trim() ? `العنوان: ${header.address.trim()}` : '',
    header.customerName?.trim()
      ? `العميل: ${[header.customerCode, header.customerName].filter(Boolean).join(' — ')}`
      : '',
    header.customerPhone?.trim() ? `هاتف العميل: ${header.customerPhone.trim()}` : '',
    header.duration?.trim() ? `المدة: ${header.duration.trim()}` : '',
    header.startDate?.trim() ? `تاريخ البدء: ${header.startDate.trim()}` : '',
    header.startDateHijri?.trim() ? `الهجري: ${header.startDateHijri.trim()}` : '',
    extraNotes?.trim(),
  ].filter(Boolean);
  return parts.length ? parts.join('\n') : undefined;
}

function emptyHeader(): ProjectHeaderForm {
  return {
    serial: '',
    arabicName: '',
    englishName: '',
    address: '',
    customerCode: '',
    customerName: '',
    customerPhone: '',
    duration: '',
    startDate: '',
    startDateHijri: '',
  };
}

type FinancialForm = {
  totalValue: string;
  advancePaymentPercentage: string;
  advancePaymentValue: string;
  latePenaltyPercentage: string;
  latePenaltyPerDays: string;
  businessAffairsPercentage: string;
  facilitiesDeductionPercentage: string;
  facilitiesDeductionMax: string;
  otherAddition1: string;
  otherAddition2: string;
  otherDeduction1: string;
  otherDeduction2: string;
  notes: string;
};

function emptyFinancial(): FinancialForm {
  return {
    totalValue: '',
    advancePaymentPercentage: '',
    advancePaymentValue: '',
    latePenaltyPercentage: '',
    latePenaltyPerDays: 'يوم',
    businessAffairsPercentage: '',
    facilitiesDeductionPercentage: '',
    facilitiesDeductionMax: '',
    otherAddition1: '',
    otherAddition2: '',
    otherDeduction1: '',
    otherDeduction2: '',
    notes: '',
  };
}

function mapProjectToFinancial(p: Record<string, unknown>): FinancialForm {
  const additions = (p.otherAdditions as { name?: string; value?: number }[] | null) ?? [];
  const deductions = (p.otherDeductions as { name?: string; value?: number }[] | null) ?? [];
  return {
    totalValue: p.totalValue != null ? String(p.totalValue) : '',
    advancePaymentPercentage:
      p.advancePaymentPercentage != null ? String(p.advancePaymentPercentage) : '',
    advancePaymentValue: p.advancePaymentValue != null ? String(p.advancePaymentValue) : '',
    latePenaltyPercentage:
      p.latePenaltyPercentage != null ? String(p.latePenaltyPercentage) : '',
    latePenaltyPerDays: (p.latePenaltyPerDays as string) || 'يوم',
    businessAffairsPercentage:
      p.businessAffairsPercentage != null ? String(p.businessAffairsPercentage) : '',
    facilitiesDeductionPercentage:
      p.facilitiesDeductionPercentage != null ? String(p.facilitiesDeductionPercentage) : '',
    facilitiesDeductionMax:
      p.facilitiesDeductionMax != null ? String(p.facilitiesDeductionMax) : '',
    otherAddition1: additions[0]?.value != null ? String(additions[0].value) : '',
    otherAddition2: additions[1]?.value != null ? String(additions[1].value) : '',
    otherDeduction1: deductions[0]?.value != null ? String(deductions[0].value) : '',
    otherDeduction2: deductions[1]?.value != null ? String(deductions[1].value) : '',
    notes: typeof p.notes === 'string' ? p.notes : '',
  };
}

function mapProjectToHeader(p: Record<string, unknown>): ProjectHeaderForm {
  return {
    serial: (p.serial as string) ?? '',
    arabicName: (p.arabicName as string) ?? '',
    englishName: (p.englishName as string) ?? '',
    address: '',
    customerCode: '',
    customerName: '',
    customerPhone: '',
    duration: '',
    startDate: '',
    startDateHijri: '',
  };
}

function buildSavePayload(header: ProjectHeaderForm, fin: FinancialForm) {
  const otherAdditions = [fin.otherAddition1, fin.otherAddition2]
    .map((v, i) => ({ name: `إضافة ${i + 1}`, value: parseNum(v) }))
    .filter((x) => x.value != null && x.value >= 0) as { name: string; value: number }[];
  const otherDeductions = [fin.otherDeduction1, fin.otherDeduction2]
    .map((v, i) => ({ name: `خصم ${i + 1}`, value: parseNum(v) }))
    .filter((x) => x.value != null && x.value >= 0) as { name: string; value: number }[];

  return {
    serial: header.serial?.trim() || undefined,
    arabicName: header.arabicName.trim(),
    englishName: header.englishName?.trim() || undefined,
    totalValue: parseNum(fin.totalValue),
    advancePaymentPercentage: parseNum(fin.advancePaymentPercentage),
    advancePaymentValue: parseNum(fin.advancePaymentValue),
    latePenaltyPercentage: parseNum(fin.latePenaltyPercentage),
    latePenaltyPerDays: fin.latePenaltyPerDays?.trim() || 'يوم',
    businessAffairsPercentage: parseNum(fin.businessAffairsPercentage),
    facilitiesDeductionPercentage: parseNum(fin.facilitiesDeductionPercentage),
    facilitiesDeductionMax: parseNum(fin.facilitiesDeductionMax),
    otherAdditions: otherAdditions.length ? otherAdditions : undefined,
    otherDeductions: otherDeductions.length ? otherDeductions : undefined,
    notes: buildProjectNotes(header, fin.notes),
  };
}

function WorkItemsTableBody({
  workLoading,
  workItems,
}: {
  workLoading: boolean;
  workItems: ExtractWorkItemRow[];
}) {
  if (workLoading) {
    return (
      <tr>
        <td colSpan={9} className="py-8 text-center text-gray-500">
          جاري تحميل بنود الأعمال…
        </td>
      </tr>
    );
  }
  if (!workItems.length) {
    return (
      <tr>
        <td colSpan={9} className="py-8 text-center text-gray-500">
          لا توجد بنود مسجّلة لهذا المشروع
        </td>
      </tr>
    );
  }
  return (
    <>
      {workItems.map((w, idx: number) => (
        <tr key={w.id} className="border-b border-slate-100 hover:bg-slate-50/80">
          <td className="py-2 px-2 font-bold text-black">{idx + 1}</td>
          <td className="py-2 px-2 text-black">{w.building?.unitNumber ?? '—'}</td>
          <td className="py-2 px-2 text-black">{w.building?.modelNumber ?? '—'}</td>
          <td className="py-2 px-2 text-black">{w.itemGroupCode ?? '—'}</td>
          <td className="py-2 px-2 text-black">{w.itemGroupName ?? '—'}</td>
          <td className="py-2 px-2 text-black">{w.itemNumber ?? '—'}</td>
          <td className="py-2 px-2 text-black">{w.arabicName ?? '—'}</td>
          <td className="py-2 px-2 text-black">{w.quantity != null ? String(w.quantity) : '—'}</td>
          <td className="py-2 px-2 text-black">{w.unit ?? '—'}</td>
        </tr>
      ))}
    </>
  );
}

export default function ProjectsPage() {
  const invalidateQuery = useInvalidateQuery();
  const [activeTab, setActiveTab] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [headerForm, setHeaderForm] = useState<ProjectHeaderForm>(emptyHeader);
  const [financialForm, setFinancialForm] = useState<FinancialForm>(emptyFinancial);
  const [isNewProject, setIsNewProject] = useState(false);
  const router = useRouter();

  const { data: projectsResponse } = useApiQuery<ExtractProjectListItem[]>(
    ['extracts-projects'],
    '/extracts/projects',
    { limit: 1000 }
  );
  const projects = projectsResponse?.data || [];

  const { data: projectDetailRes } = useApiQuery<Record<string, unknown>>(
    ['extracts-project-detail', selectedProjectId],
    `/extracts/projects/${selectedProjectId}`,
    undefined,
    { enabled: Boolean(selectedProjectId) && !isNewProject }
  );

  useEffect(() => {
    if (isNewProject) return;
    if (!selectedProjectId && projects.length > 0) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId, isNewProject]);

  useEffect(() => {
    if (isNewProject || !projectDetailRes?.data) return;
    const p = projectDetailRes.data as Record<string, unknown>;
    setHeaderForm(mapProjectToHeader(p));
    setFinancialForm(mapProjectToFinancial(p));
  }, [projectDetailRes?.data, isNewProject]);

  const saveProjectMutation = useMutation({
    mutationFn: async () => {
      const payload = buildSavePayload(headerForm, financialForm);
      if (!payload.arabicName) {
        throw new Error('الإسم العربي للمشروع مطلوب');
      }
      if (selectedProjectId && !isNewProject) {
        return apiClient.put(`/extracts/projects/${selectedProjectId}`, payload);
      }
      return apiClient.post('/extracts/projects', payload);
    },
    onSuccess: (res: { data?: { id?: string } }) => {
      setSuccess('تم حفظ المشروع بنجاح');
      setError('');
      setIsNewProject(false);
      const id = res?.data?.id;
      if (id) setSelectedProjectId(id);
      invalidateQuery(['extracts-projects']);
      invalidateQuery(['extracts-project-detail']);
    },
    onError: (err: ApiError) => {
      setError(err.message || 'حدث خطأ أثناء الحفظ');
    },
  });

  const { data: buildingsRes, isLoading: buildingsLoading } = useApiQuery<ExtractBuildingRow[]>(
    ['extracts-buildings', selectedProjectId],
    '/extracts/buildings',
    { projectId: selectedProjectId, limit: 100 },
    { enabled: Boolean(selectedProjectId) }
  );
  const buildingsList = buildingsRes?.data || [];

  const { data: workItemsRes, isLoading: workItemsLoading } = useApiQuery<ExtractWorkItemRow[]>(
    ['extracts-work-items', selectedProjectId],
    '/extracts/work-items',
    { projectId: selectedProjectId, limit: 200 },
    { enabled: Boolean(selectedProjectId) }
  );
  const workItems = workItemsRes?.data || [];

  const handleSave = () => {
    setError('');
    setSuccess('');
    saveProjectMutation.mutate();
  };

  const handleNewProject = () => {
    setIsNewProject(true);
    setSelectedProjectId('');
    setHeaderForm(emptyHeader());
    setFinancialForm(emptyFinancial());
  };

  const handleProjectSelect = (id: string) => {
    setIsNewProject(false);
    setSelectedProjectId(id);
  };

  const handleCancel = () => {
    setError('');
    setSuccess('');
    if (isNewProject && projects.length > 0) {
      setIsNewProject(false);
      setSelectedProjectId(projects[0].id);
    }
  };

  const patchFinancial = (patch: Partial<FinancialForm>) =>
    setFinancialForm((prev) => ({ ...prev, ...patch }));

  return (
    <ExtractsPageChrome title="أرشيف مستندات">
        <ProjectHeader
          value={headerForm}
          onChange={(patch) => setHeaderForm((prev) => ({ ...prev, ...patch }))}
          readOnlyIdentity={Boolean(selectedProjectId) && !isNewProject}
          onNewProject={handleNewProject}
        />
        <div className={`${DASH_PANEL} mb-5 flex flex-row-reverse flex-wrap items-center gap-3 p-5`}>
          <label className="text-sm font-semibold text-[#094C6B]">المشروع المعروض</label>
          <select
            value={isNewProject ? '' : selectedProjectId}
            onChange={(e) => handleProjectSelect(e.target.value)}
            className="min-w-[220px] rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] px-3 py-2 text-right text-[#094C6B]"
          >
            <option value="">{isNewProject ? '— مشروع جديد —' : '— اختر مشروعاً —'}</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.arabicName || p.serial || p.englishName || p.id}
              </option>
            ))}
          </select>
          {selectedProjectId && !isNewProject ? (
            <AiKnowledgeUploadButton
              category="BOQ_SPECIFICATION"
              referenceId={selectedProjectId}
              title={headerForm.arabicName || undefined}
            />
          ) : null}
        </div>
        <div className="mb-5 flex justify-center">
          <div className="flex flex-row-reverse flex-wrap gap-1.5 rounded-xl border border-slate-200/80 bg-slate-50/50 p-1.5">
            {tabs.map((tab, idx) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(idx)}
                className={`rounded-lg px-5 py-2 text-sm font-semibold transition-all duration-200 focus:outline-none
                  ${activeTab === idx
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-white hover:text-slate-900'}
                `}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
        <div className={`${DASH_PANEL} p-5`}>
            {activeTab === 0 && (
              <>
                {/* 5 Action Buttons */}
                <div className="flex flex-row-reverse gap-4 mb-6 px-2">
                  {[
                    { icon: "/tabler_report.svg", label: "بنود الأعمال والحصر" },
                    { icon: "/ic_outline-plus.svg", label: "إنشاء عقد مالك" },
                    { icon: "/grommet-icons_view.svg", label: "تعريف شكل البناء" },
                    { icon: "/tabler_report.svg", label: "مقاسه المشروع", onClick: () => router.push("/extracts/operations/projects/maqaysa") },
                    { icon: "/tabler_report.svg", label: "عرض بنود الأعمال", onClick: () => router.push("/extracts/operations/projects/agenda-items") },
                    { icon: "/tabler_report.svg", label: "البنود العامة للمستخلصات", onClick: () => router.push("/extracts/operations/general-extract-items") },
                  ].map((btn) => (
                    <Button
                      key={btn.label}
                      variant="outline"
                      className="flex items-center gap-2 px-6 py-2 rounded-full border-[#D6EAF3] bg-white text-[#0E79AA] font-bold text-base shadow-md hover:bg-slate-50 hover:text-[#0E79AA] transition-all duration-200 min-w-[170px]"
                      style={{ boxShadow: '0 2px 8px 0 rgba(14,121,170,0.08)' }}
                      onClick={btn.onClick}
                    >
                      <Image src={btn.icon} alt={btn.label} width={20} height={20} className="w-5 h-5" />
                      {btn.label}
                    </Button>
                  ))}
                </div>
                {/* Main Content: Grid + Summary Panel */}
                <div className="flex gap-6">
                  {/* Right Summary Panel */}
                  <div className="w-80 bg-slate-50 rounded-2xl p-6 flex flex-col gap-3 border border-[#D6EAF3]">
                    <div className="flex flex-col gap-2">
                      <label className="text-[#0E79AA] font-bold mb-1">إجمالى عام قيمة المشروع</label>
                      <Input className="bg-white" value={financialForm.totalValue} onChange={(e) => patchFinancial({ totalValue: e.target.value })} />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-[#0E79AA] font-bold mb-1">نسبة الدفعة المقدمة %</label>
                      <Input className="bg-white" value={financialForm.advancePaymentPercentage} onChange={(e) => patchFinancial({ advancePaymentPercentage: e.target.value })} />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-[#0E79AA] font-bold mb-1">قيمة الدفعة المقدمة</label>
                      <Input className="bg-white" value={financialForm.advancePaymentValue} onChange={(e) => patchFinancial({ advancePaymentValue: e.target.value })} />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-[#0E79AA] font-bold mb-1">نسبة غرامة التأخير %</label>
                      <Input className="bg-white" value={financialForm.latePenaltyPercentage} onChange={(e) => patchFinancial({ latePenaltyPercentage: e.target.value })} />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-[#0E79AA] font-bold mb-1">عن كل</label>
                      <Input className="bg-white" value={financialForm.latePenaltyPerDays} onChange={(e) => patchFinancial({ latePenaltyPerDays: e.target.value })} />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-[#0E79AA] font-bold mb-1">نسبة شؤون الأعمال %</label>
                      <Input className="bg-white" value={financialForm.businessAffairsPercentage} onChange={(e) => patchFinancial({ businessAffairsPercentage: e.target.value })} />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-[#0E79AA] font-bold mb-1">نسبة المرافق المستقطعة</label>
                      <Input className="bg-white" value={financialForm.facilitiesDeductionPercentage} onChange={(e) => patchFinancial({ facilitiesDeductionPercentage: e.target.value })} />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-[#0E79AA] font-bold mb-1">حد أقصى</label>
                      <Input className="bg-white" value={financialForm.facilitiesDeductionMax} onChange={(e) => patchFinancial({ facilitiesDeductionMax: e.target.value })} />
                    </div>
                    <div className="flex flex-col gap-2 mt-2">
                      <label className="text-[#0E79AA] font-bold mb-1">إضافات أخرى</label>
                      <Input className="bg-white" value={financialForm.otherAddition1} onChange={(e) => patchFinancial({ otherAddition1: e.target.value })} />
                      <Input className="bg-white" value={financialForm.otherAddition2} onChange={(e) => patchFinancial({ otherAddition2: e.target.value })} />
                    </div>
                    <div className="flex flex-col gap-2 mt-2">
                      <label className="text-[#0E79AA] font-bold mb-1">خصومات أخرى</label>
                      <Input className="bg-white" value={financialForm.otherDeduction1} onChange={(e) => patchFinancial({ otherDeduction1: e.target.value })} />
                      <Input className="bg-white" value={financialForm.otherDeduction2} onChange={(e) => patchFinancial({ otherDeduction2: e.target.value })} />
                    </div>
                    <Button type="button" className="bg-[#0E79AA] text-white mt-2" onClick={handleSave} disabled={saveProjectMutation.isPending}>
                      {saveProjectMutation.isPending ? 'جاري الحفظ…' : 'حفظ'}
                    </Button>
                  </div>
                  <div className="grid grid-cols-3 gap-6 flex-1">
                    {buildingsLoading ? (
                      <div className="col-span-3 py-8 text-center text-gray-500">جاري تحميل المباني…</div>
                    ) : buildingsList.length === 0 ? (
                      <div className="col-span-3 py-8 text-center text-gray-500">
                        لا توجد مبانٍ مسجّلة لهذا المشروع
                      </div>
                    ) : (
                      buildingsList.map((b) => (
                        <div
                          key={b.id}
                          className="relative group bg-[#F6FBFD] rounded-2xl p-4 shadow border border-[#E6F0F7] transition-all duration-200 hover:shadow-lg hover:scale-105"
                        >
                          <div className="absolute top-2 left-1/2 -translate-x-1/2 flex gap-2 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition">
                            <button type="button" className="w-8 h-8 flex items-center justify-center bg-white border border-[#D6EAF3] rounded-lg shadow">
                              <Image src="/lucide_edit.svg" alt="تعديل" width={20} height={20} className="w-5 h-5" />
                            </button>
                            <button type="button" className="w-8 h-8 flex items-center justify-center bg-white border border-[#D6EAF3] rounded-lg shadow">
                              <Image src="/hugeicons_delete-02.svg" alt="حذف" width={20} height={20} className="w-5 h-5" />
                            </button>
                            <button type="button" className="w-8 h-8 flex items-center justify-center bg-white border border-[#D6EAF3] rounded-lg shadow">
                              <Image src="/grommet-icons_view.svg" alt="عرض" width={20} height={20} className="w-5 h-5" />
                            </button>
                          </div>
                          <Image src="/3omara.png" alt="" width={128} height={128} className="w-32 h-32 object-cover rounded-xl mb-2" />
                          <div className="text-[#0E79AA] font-bold mb-2">{b.arabicName || 'مبنى'}</div>
                          <div className="flex gap-2 w-full mb-2">
                            <div className="flex-1">
                              <label className="block text-xs text-gray-500 mb-1">المجموعة</label>
                              <Input className="bg-white text-center" readOnly value={b.groupNumber ?? ''} />
                            </div>
                            <div className="flex-1">
                              <label className="block text-xs text-gray-500 mb-1">النموذج</label>
                              <Input className="bg-white text-center" readOnly value={b.modelNumber ?? ''} />
                            </div>
                            <div className="flex-1">
                              <label className="block text-xs text-gray-500 mb-1">الوحدة</label>
                              <Input className="bg-white text-center" readOnly value={b.unitNumber ?? ''} />
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
            {activeTab === 1 && (
              <>
                {/* Filters and Table for إسناد بنود الأعمال لمقاول */}
                <div className="flex flex-row-reverse gap-4 mb-4">
                  <div className="flex flex-col gap-2 flex-1">
                    <label className="text-[#0E79AA] font-bold mb-1">المقاول</label>
                    <div className="flex gap-2">
                      <Input className="bg-white" defaultValue="0000000001" />
                      <Input className="bg-white" defaultValue="مقاول رقم 1" />
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 flex-1">
                    <label className="text-[#0E79AA] font-bold mb-1">تاريخ الإسناد</label>
                    <div className="flex gap-2">
                      <Input className="bg-white" defaultValue="26-11-2025" />
                    </div>
                  </div>
                </div>
                <div className="flex flex-row-reverse gap-4 mb-4">
                  <div className="flex flex-col gap-2 flex-1">
                    <label className="text-[#0E79AA] font-bold mb-1">الهجري</label>
                    <div className="flex gap-2">
                      <Input className="bg-white" defaultValue="26-11-2025" />
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 flex-1">
                    <label className="text-[#0E79AA] font-bold mb-1">ت. المقاول</label>
                    <div className="flex gap-2">
                      <Input className="bg-white" defaultValue="" placeholder="بحث..." />
                    </div>
                  </div>
                </div>
                {/* 6 Filter Buttons */}
                <div className="flex flex-row-reverse gap-3 mb-4 px-2">
                  {[
                    "تجميع حسب الوحدات",
                    "تجميع حسب المجموعات",
                    "تجميع حسب بنود الأعمال",
                    "إنشاء عقد مقاول باطن",
                    "معاينة العقد"
                  ].map((label) => (
                    <Button
                      key={label}
                      variant="outline"
                      className="flex items-center gap-2 px-6 py-2 rounded-full border-[#D6EAF3] bg-white text-[#0E79AA] font-bold text-base shadow-md hover:bg-slate-50 hover:text-[#0E79AA] transition-all duration-200 min-w-[150px]"
                      style={{ boxShadow: '0 2px 8px 0 rgba(14,121,170,0.08)' }}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
                {/* Table */}
                <div className="overflow-x-auto rounded-2xl border border-[#E6F0F7] bg-white mb-6">
                  <table className="min-w-full text-center border-separate border-spacing-0">
                    <thead>
                      <tr className="bg-slate-50/80 text-slate-600">
                        <th className="py-3 px-2">م</th>
                        <th className="py-3 px-2">رقم الوحدة</th>
                        <th className="py-3 px-2">رقم النموذج</th>
                        <th className="py-3 px-2">كود المجموعة</th>
                        <th className="py-3 px-2">مجموعة البند</th>
                        <th className="py-3 px-2">رقم البند</th>
                        <th className="py-3 px-2">إسم بند الأعمال</th>
                        <th className="py-3 px-2">الكمية</th>
                        <th className="py-3 px-2">الوحدة</th>
                      </tr>
                    </thead>
                    <tbody>
                      <WorkItemsTableBody workLoading={workItemsLoading} workItems={workItems} />
                    </tbody>
                  </table>
                </div>
                {/* Summary Section */}
                <div className="bg-slate-50 rounded-2xl p-6 flex flex-col gap-4 mb-6 border border-[#D6EAF3]">
                  <div className="flex flex-row-reverse gap-4">
                    <div className="flex flex-col flex-1 gap-2">
                      <label className="text-[#0E79AA] font-bold mb-1">نسبة الدفعة المقدمة %</label>
                      <Input className="bg-white" defaultValue="25.4456" />
                    </div>
                    <div className="flex flex-col flex-1 gap-2">
                      <label className="text-[#0E79AA] font-bold mb-1">قيمة الدفعة المقدمة</label>
                      <Input className="bg-white" defaultValue="25.4456" />
                    </div>
                    <div className="flex flex-col flex-1 gap-2">
                      <label className="text-[#0E79AA] font-bold mb-1">نسبة تأمين الأعمال %</label>
                      <Input className="bg-white" defaultValue="25.4456" />
                    </div>
                    <div className="flex flex-col flex-1 gap-2">
                      <label className="text-[#0E79AA] font-bold mb-1">نسبة الضرائب المستقطعة %</label>
                      <Input className="bg-white" defaultValue="25.4456" />
                    </div>
                    <div className="flex flex-col flex-1 gap-2">
                      <label className="text-[#0E79AA] font-bold mb-1">الإجمالي</label>
                      <Input className="bg-white" defaultValue="25.4456" />
                    </div>
                  </div>
                </div>
                {/* Bottom Section */}
                <div className="bg-slate-50 rounded-2xl p-6 flex flex-col gap-4 border border-[#D6EAF3]">
                  <div className="flex flex-row-reverse gap-4 mb-2">
                    <div className="flex flex-col flex-1 gap-2">
                      <label className="text-[#0E79AA] font-bold mb-1">عدد مقاولي الباطن المسند إليهم بنود المشروع</label>
                      <Input className="bg-white" defaultValue="25.4456" />
                    </div>
                    <div className="flex flex-col flex-1 gap-2">
                      <label className="text-[#0E79AA] font-bold mb-1">عدد بنود الأعمال التي لم تسند بعد</label>
                      <Input className="bg-white" defaultValue="0000000001" />
                    </div>
                    <div className="flex flex-col flex-1 gap-2 justify-end">
                      <Button variant="outline" className="flex items-center gap-2 px-6 py-2 rounded-full border-[#D6EAF3] bg-white text-[#0E79AA] font-bold text-base shadow-md hover:bg-slate-50 hover:text-[#0E79AA] transition-all duration-200 min-w-[100px] mt-auto">
                        <Image src="/grommet-icons_view.svg" alt="عرض" width={20} height={20} className="w-5 h-5" />
                        عرض
                      </Button>
                    </div>
                  </div>
                </div>
              </>
            )}
            {activeTab === 2 && (
              <>
                {/* 4 Action Buttons */}
                <div className="flex flex-row-reverse gap-4 mb-6 px-2">
                  {[
                    { label: "إنشاء مستخلص جديد", onClick: () => router.push("/extracts/operations/projects/make-extract") },
                    { label: "معاينة المستخلصات السابقة" },
                    { label: "نقل بنود الأعمال لمقاول آخر" },
                   
                  ].map((btn) => (
                    <Button
                      key={btn.label}
                      variant="outline"
                      className="flex items-center gap-2 px-6 py-2 rounded-full border-[#D6EAF3] bg-white text-[#0E79AA] font-bold text-base shadow-md hover:bg-slate-50 hover:text-[#0E79AA] transition-all duration-200 min-w-[170px]"
                      style={{ boxShadow: '0 2px 8px 0 rgba(14,121,170,0.08)' }}
                      onClick={btn.onClick}
                    >
                      {btn.label}
                    </Button>
                  ))}
                </div>
                {/* Table */}
                <div className="overflow-x-auto rounded-2xl border border-[#E6F0F7] bg-white mb-6">
                  <table className="min-w-full text-center border-separate border-spacing-0">
                    <thead>
                      <tr className="bg-slate-50/80 text-slate-600">
                        <th className="py-3 px-2">م</th>
                        <th className="py-3 px-2">رقم الوحدة</th>
                        <th className="py-3 px-2">رقم النموذج</th>
                        <th className="py-3 px-2">كود المجموعة</th>
                        <th className="py-3 px-2">مجموعة البند</th>
                        <th className="py-3 px-2">رقم البند</th>
                        <th className="py-3 px-2">إسم بند الأعمال</th>
                        <th className="py-3 px-2">الكمية</th>
                        <th className="py-3 px-2">الوحدة</th>
                      </tr>
                    </thead>
                    <tbody>
                      <WorkItemsTableBody workLoading={workItemsLoading} workItems={workItems} />
                    </tbody>
                  </table>
                </div>
                {/* Summary Section */}
                <div className="bg-slate-50 rounded-2xl p-6 flex flex-col gap-4 mb-6 border border-[#D6EAF3]">
                  <div className="flex flex-row-reverse gap-4">
                    <div className="flex flex-col flex-1 gap-2">
                      <label className="text-[#0E79AA] font-bold mb-1">عدد مقاولي الباطن</label>
                      <Input className="bg-white" defaultValue="25.4456" />
                    </div>
                    <div className="flex flex-col flex-1 gap-2">
                      <label className="text-[#0E79AA] font-bold mb-1">رصيد متبقي</label>
                      <Input className="bg-white" defaultValue="25.4456" />
                    </div>
                    <div className="flex flex-col flex-1 gap-2">
                      <label className="text-[#0E79AA] font-bold mb-1">من إجمالي تكلفة</label>
                      <Input className="bg-white" defaultValue="25.4456" />
                    </div>
                  </div>
                </div>
                <div className="bg-slate-50 rounded-2xl p-6 flex flex-col gap-4 border border-[#D6EAF3]">
                  <div className="flex flex-row-reverse gap-4">
                    <div className="flex flex-col flex-1 gap-2">
                      <label className="text-[#0E79AA] font-bold mb-1">عدد المستخلصات المصدرة للمشروع</label>
                      <Input className="bg-white" defaultValue="25" />
                    </div>
                    <div className="flex flex-col flex-1 gap-2">
                      <label className="text-[#0E79AA] font-bold mb-1">بقيمة إجمالية</label>
                      <Input className="bg-white" defaultValue="25.4456" />
                    </div>

                  </div>
                </div>
              </>
            )}
            {activeTab === 3 && (
              <>
                {/* مستخلصات المالك - Owner's Extracts */}
                <div className="grid grid-cols-2 gap-6 mb-6">
                  {/* Right Section - Extract Details */}
                  <div className="space-y-4">
                    <div className="flex gap-2 items-center">
                      <label className="w-28 text-zinc-800 text-right text-sm font-medium">الكود</label>
                      <Input defaultValue="000000000001" className="bg-white text-right flex-1" readOnly />
                    </div>
                    <div className="flex gap-2 items-center">
                      <label className="w-28 text-zinc-800 text-right text-sm font-medium">تاريخ المستخلص</label>
                      <div className="relative flex-1">
                        <Input defaultValue="26-11-2025" className="bg-white text-right pr-10" />
                        <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">📅</span>
                      </div>
                    </div>
                    <div className="flex gap-2 items-start">
                      <label className="w-28 text-zinc-800 text-right text-sm font-medium mt-3">البيان</label>
                      <textarea 
                        placeholder="أدخل البيان هنا..."
                        className="bg-white text-right flex-1 p-3 rounded-lg border border-[#E6F0F7] min-h-[60px] resize-none"
                      />
                    </div>
                    <div className="flex gap-4 mt-4">
                      <Button className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-300 transition flex-1">
                        مستخلصات المقاولين
                      </Button>
                      <Button className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-300 transition flex-1">
                        تنفيذ ذاتي
                      </Button>
                    </div>
                  </div>

                  {/* Left Section - Filter/Search */}
                  <div className="space-y-4">
 
                    <div className="flex gap-2 items-center">
                      <label className="w-28 text-zinc-800 text-right text-sm font-medium">الهجري</label>
                      <Input placeholder="الهجري" className="bg-white text-right flex-1" />
                    </div>
                    <div className="flex gap-2 items-center">
                      <label className="w-28 text-zinc-800 text-right text-sm font-medium">نوع البيان</label>
                      <div className="flex gap-3">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" name="statementType" value="partial" defaultChecked className="w-4 h-4 text-[#0E78AA] bg-white border-2 border-gray-300 rounded-full focus:ring-[#0E78AA] focus:ring-2 focus:ring-offset-2" />
                          <span className="text-zinc-800 text-sm">جزئي</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" name="statementType" value="final" className="w-4 h-4 text-[#0E78AA] bg-white border-2 border-gray-300 rounded-full focus:ring-[#0E78AA] focus:ring-2 focus:ring-offset-2" />
                          <span className="text-zinc-800 text-sm">ختامي</span>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Data Table */}
                <div className="mb-6">
                  <div className="overflow-x-auto rounded-2xl border border-[#E6F0F7] bg-white">
                    <table className="min-w-full text-center border-separate border-spacing-0">
                      <thead>
                        <tr className="bg-slate-50/80 text-slate-600">
                          <th className="py-3 px-4 text-sm font-bold">م</th>
                          <th className="py-3 px-4 text-sm font-bold">رقم الوحدة</th>
                          <th className="py-3 px-4 text-sm font-bold">رقم النموذج</th>
                          <th className="py-3 px-4 text-sm font-bold">كود المجموعة</th>
                          <th className="py-3 px-4 text-sm font-bold">مجموعة البند</th>
                          <th className="py-3 px-4 text-sm font-bold">رقم البند</th>
                          <th className="py-3 px-4 text-sm font-bold">إسم بند الأعمال</th>
                          <th className="py-3 px-4 text-sm font-bold">الكمية</th>
                          <th className="py-3 px-4 text-sm font-bold">الوحدة</th>
                        </tr>
                      </thead>
                      <tbody>
                        <WorkItemsTableBody workLoading={workItemsLoading} workItems={workItems} />
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Summary Section */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="flex gap-2 items-center">
                    <label className="w-36 text-zinc-800 text-right text-sm font-medium">قيمة الدفعة المقدمة</label>
                    <Input defaultValue="—" className="bg-white text-right flex-1 text-sm" readOnly />
                  </div>
                  <div className="flex gap-2 items-center">
                    <label className="w-36 text-zinc-800 text-right text-sm font-medium">صافي أعمال الفترة (المستخلص الحالي)</label>
                    <Input defaultValue="—" className="bg-white text-right flex-1 text-sm" readOnly />
                  </div>
                  <div className="flex gap-2 items-center">
                    <label className="w-36 text-zinc-800 text-right text-sm font-medium">إجمالي الأعمال السابقة بعدد</label>
                    <div className="flex gap-1">
                      <Input defaultValue="0,00" className="bg-white text-right w-20 text-xs" readOnly />
                      <span className="text-xs text-gray-600 mt-2">مستخلص</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 items-center mt-2">
                  <label className="w-36 text-zinc-800 text-right text-sm font-medium">عدد المستخلصات</label>
                  <Input defaultValue="—" className="bg-white text-right w-32 text-sm" readOnly />
                </div>
              </>
            )}
            {error && <ErrorToast message={error} onClose={() => setError('')} />}
            {success && <SuccessToast message={success} onClose={() => setSuccess('')} />}
            
            {/* Bottom Action Buttons */}
            <div className="flex justify-end gap-4 mt-8">
              <ActionButtons 
                onSave={handleSave}
                onCancel={handleCancel}
                saveText={saveProjectMutation.isPending ? 'جاري الحفظ...' : 'حفظ'}
              />
            </div>
        </div>
    </ExtractsPageChrome>
  );
}
