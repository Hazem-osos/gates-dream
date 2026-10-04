'use client';

import Image from 'next/image';

import React, { useState, useEffect } from "react";
import { FolderKanban } from 'lucide-react';
import { ExtractsPageChrome } from '@/components/extracts/ExtractsPageChrome';
import {
  AppTable,
  CompactFormField,
  FormSectionCard,
  compactControlClass,
} from '@/components/ui';
import { Button } from "@/components/ui/button";
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

const WORK_ITEM_COLUMNS = [
  { id: 'idx', header: 'م', cell: (_row: ExtractWorkItemRow, index: number) => index + 1 },
  { id: 'unitNo', header: 'رقم الوحدة', cell: (w: ExtractWorkItemRow) => w.building?.unitNumber ?? '—' },
  { id: 'model', header: 'رقم النموذج', cell: (w: ExtractWorkItemRow) => w.building?.modelNumber ?? '—' },
  { id: 'groupCode', header: 'كود المجموعة', cell: (w: ExtractWorkItemRow) => w.itemGroupCode ?? '—' },
  { id: 'group', header: 'مجموعة البند', cell: (w: ExtractWorkItemRow) => w.itemGroupName ?? '—' },
  { id: 'itemNo', header: 'رقم البند', cell: (w: ExtractWorkItemRow) => w.itemNumber ?? '—' },
  { id: 'name', header: 'إسم بند الأعمال', cell: (w: ExtractWorkItemRow) => w.arabicName ?? '—' },
  { id: 'qty', header: 'الكمية', cell: (w: ExtractWorkItemRow) => (w.quantity != null ? String(w.quantity) : '—') },
  { id: 'unit', header: 'الوحدة', cell: (w: ExtractWorkItemRow) => w.unit ?? '—' },
];

export default function ProjectsPage() {
  const invalidateQuery = useInvalidateQuery();
  const [activeTab, setActiveTab] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [headerForm, setHeaderForm] = useState<ProjectHeaderForm>(emptyHeader);
  const [financialForm, setFinancialForm] = useState<FinancialForm>(emptyFinancial);
  const [isNewProject, setIsNewProject] = useState(false);
  const [showBuildingForm, setShowBuildingForm] = useState(false);
  const [editingBuildingId, setEditingBuildingId] = useState<string | null>(null);
  const [buildingForm, setBuildingForm] = useState({
    arabicName: '',
    groupNumber: '',
    modelNumber: '',
    unitNumber: '',
  });
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

  const saveBuildingMutation = useMutation({
    mutationFn: async () => {
      if (!selectedProjectId) throw new Error('اختر مشروعاً أولاً');
      const payload = {
        projectId: selectedProjectId,
        arabicName: buildingForm.arabicName.trim() || undefined,
        groupNumber: buildingForm.groupNumber.trim() || undefined,
        modelNumber: buildingForm.modelNumber.trim() || undefined,
        unitNumber: buildingForm.unitNumber.trim() || undefined,
      };
      if (editingBuildingId) {
        return apiClient.put(`/extracts/buildings/${editingBuildingId}`, payload);
      }
      return apiClient.post('/extracts/buildings', payload);
    },
    onSuccess: () => {
      setSuccess(editingBuildingId ? 'تم تحديث المبنى' : 'تم إنشاء المبنى');
      setError('');
      setShowBuildingForm(false);
      setEditingBuildingId(null);
      setBuildingForm({ arabicName: '', groupNumber: '', modelNumber: '', unitNumber: '' });
      invalidateQuery(['extracts-buildings', selectedProjectId]);
    },
    onError: (err: ApiError) => setError(err.message || 'تعذر حفظ المبنى'),
  });

  const deleteBuildingMutation = useMutation({
    mutationFn: async (buildingId: string) => {
      await apiClient.delete(`/extracts/buildings/${buildingId}`);
    },
    onSuccess: () => {
      setSuccess('تم حذف المبنى');
      invalidateQuery(['extracts-buildings', selectedProjectId]);
    },
    onError: (err: ApiError) => setError(err.message || 'تعذر حذف المبنى'),
  });

  const openNewBuilding = () => {
    setEditingBuildingId(null);
    setBuildingForm({ arabicName: '', groupNumber: '', modelNumber: '', unitNumber: '' });
    setShowBuildingForm(true);
  };

  const openEditBuilding = (b: ExtractBuildingRow) => {
    setEditingBuildingId(b.id);
    setBuildingForm({
      arabicName: b.arabicName ?? '',
      groupNumber: b.groupNumber ?? '',
      modelNumber: b.modelNumber ?? '',
      unitNumber: b.unitNumber ?? '',
    });
    setShowBuildingForm(true);
  };

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

  const patchFinancial = (patch: Partial<FinancialForm>) =>
    setFinancialForm((prev) => ({ ...prev, ...patch }));

  return (
    <ExtractsPageChrome
      title="إدارة المشاريع"
      breadcrumbs={[
        { href: '/extracts', label: 'المستخلصات' },
        { label: 'العمليات' },
        { label: 'إدارة المشاريع' },
      ]}
      onSave={handleSave}
      savePending={saveProjectMutation.isPending}
      onNew={handleNewProject}
      statusLabel={isNewProject ? 'جديد' : selectedProjectId ? 'تعديل' : 'جديد'}
      docNumber={headerForm.serial || undefined}
      currentId={selectedProjectId || null}
      favoriteHref="/extracts/operations/projects"
      browseList={{
        title: 'المشاريع السابقة',
        apiPath: '/extracts/projects',
        listKey: 'extract-projects-browse',
        selectedId: selectedProjectId || null,
        columns: [
          { id: 'serial', header: 'المسلسل', getValue: (r) => String(r.serial || r.id) },
          { id: 'name', header: 'الاسم', getValue: (r) => String(r.arabicName || r.englishName || '—') },
        ],
        onSelect: (id) => handleProjectSelect(id),
      }}
      extraActions={
        selectedProjectId && !isNewProject ? (
          <AiKnowledgeUploadButton
            category="BOQ_SPECIFICATION"
            referenceId={selectedProjectId}
            title={headerForm.arabicName || undefined}
          />
        ) : null
      }
    >
      {error ? <ErrorToast message={error} onClose={() => setError('')} /> : null}
      {success ? <SuccessToast message={success} onClose={() => setSuccess('')} /> : null}

      <FormSectionCard title="المشروع المعروض" icon={FolderKanban}>
        <CompactFormField label="المشروع">
          <select
            value={isNewProject ? '' : selectedProjectId}
            onChange={(e) => handleProjectSelect(e.target.value)}
            className={compactControlClass}
          >
            <option value="">{isNewProject ? '— مشروع جديد —' : '— اختر مشروعاً —'}</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.arabicName || p.serial || p.englishName || p.id}
              </option>
            ))}
          </select>
        </CompactFormField>
      </FormSectionCard>

      <ProjectHeader
        value={headerForm}
        onChange={(patch) => setHeaderForm((prev) => ({ ...prev, ...patch }))}
        readOnlyIdentity={Boolean(selectedProjectId) && !isNewProject}
      />

      <div className="mb-4 flex flex-wrap items-center justify-center gap-1.5 rounded-xl border border-slate-200/80 bg-slate-50/50 p-1.5">
        {tabs.map((tab, idx) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(idx)}
            className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors ${
              activeTab === idx ? 'bg-[#0E78AA] text-white' : 'text-slate-600 hover:bg-white'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div>
            {activeTab === 0 && (
              <>
                <div className="mb-4 flex flex-wrap gap-2">
                  {[
                    {
                      label: 'بنود الأعمال والحصر',
                      onClick: () =>
                        router.push(
                          selectedProjectId
                            ? `/extracts/operations/projects/agenda-items?projectId=${selectedProjectId}`
                            : '/extracts/operations/projects/agenda-items'
                        ),
                    },
                    {
                      label: 'تعريف شكل البناء',
                      onClick: () => {
                        if (!selectedProjectId) {
                          setError('اختر مشروعاً أولاً');
                          return;
                        }
                        openNewBuilding();
                      },
                    },
                    {
                      label: 'مقايسة المشروع',
                      onClick: () =>
                        router.push(
                          selectedProjectId
                            ? `/extracts/operations/projects/maqaysa?projectId=${selectedProjectId}`
                            : '/extracts/operations/projects/maqaysa'
                        ),
                    },
                    {
                      label: 'عرض بنود الأعمال',
                      onClick: () =>
                        router.push(
                          selectedProjectId
                            ? `/extracts/operations/projects/agenda-items?projectId=${selectedProjectId}`
                            : '/extracts/operations/projects/agenda-items'
                        ),
                    },
                    {
                      label: 'البنود العامة للمستخلصات',
                      onClick: () => router.push('/extracts/operations/general-extract-items'),
                    },
                    {
                      label: 'مستخلصات المقاولات',
                      onClick: () => router.push('/contracting/extracts'),
                    },
                  ].map((btn) => (
                    <Button
                      key={btn.label}
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={btn.onClick}
                    >
                      {btn.label}
                    </Button>
                  ))}
                </div>
                {showBuildingForm ? (
                  <FormSectionCard
                    title={editingBuildingId ? 'تعديل المبنى' : 'تعريف شكل البناء'}
                    className="mb-4"
                  >
                    <CompactFormField
                      label="الاسم"
                      value={buildingForm.arabicName}
                      onChange={(e) =>
                        setBuildingForm((p) => ({ ...p, arabicName: e.target.value }))
                      }
                    />
                    <CompactFormField
                      label="المجموعة"
                      value={buildingForm.groupNumber}
                      onChange={(e) =>
                        setBuildingForm((p) => ({ ...p, groupNumber: e.target.value }))
                      }
                    />
                    <CompactFormField
                      label="النموذج"
                      value={buildingForm.modelNumber}
                      onChange={(e) =>
                        setBuildingForm((p) => ({ ...p, modelNumber: e.target.value }))
                      }
                    />
                    <CompactFormField
                      label="الوحدة"
                      value={buildingForm.unitNumber}
                      onChange={(e) =>
                        setBuildingForm((p) => ({ ...p, unitNumber: e.target.value }))
                      }
                    />
                    <div className="sm:col-span-2 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        disabled={saveBuildingMutation.isPending}
                        onClick={() => saveBuildingMutation.mutate()}
                      >
                        حفظ المبنى
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setShowBuildingForm(false);
                          setEditingBuildingId(null);
                        }}
                      >
                        إلغاء
                      </Button>
                    </div>
                  </FormSectionCard>
                ) : null}
                {/* Main Content: Grid + Summary Panel */}
                <div className="flex gap-6">
                  {/* Right Summary Panel */}
                  <FormSectionCard title="البيانات المالية" className="mb-0 w-full max-w-sm shrink-0" bodyClassName="grid-cols-1">
                    <CompactFormField label="إجمالى عام قيمة المشروع" value={financialForm.totalValue} onChange={(e) => patchFinancial({ totalValue: e.target.value })} />
                    <CompactFormField label="نسبة الدفعة المقدمة %" value={financialForm.advancePaymentPercentage} onChange={(e) => patchFinancial({ advancePaymentPercentage: e.target.value })} />
                    <CompactFormField label="قيمة الدفعة المقدمة" value={financialForm.advancePaymentValue} onChange={(e) => patchFinancial({ advancePaymentValue: e.target.value })} />
                    <CompactFormField label="نسبة غرامة التأخير %" value={financialForm.latePenaltyPercentage} onChange={(e) => patchFinancial({ latePenaltyPercentage: e.target.value })} />
                    <CompactFormField label="عن كل" value={financialForm.latePenaltyPerDays} onChange={(e) => patchFinancial({ latePenaltyPerDays: e.target.value })} />
                    <CompactFormField label="نسبة شؤون الأعمال %" value={financialForm.businessAffairsPercentage} onChange={(e) => patchFinancial({ businessAffairsPercentage: e.target.value })} />
                    <CompactFormField label="نسبة المرافق المستقطعة" value={financialForm.facilitiesDeductionPercentage} onChange={(e) => patchFinancial({ facilitiesDeductionPercentage: e.target.value })} />
                    <CompactFormField label="حد أقصى" value={financialForm.facilitiesDeductionMax} onChange={(e) => patchFinancial({ facilitiesDeductionMax: e.target.value })} />
                    <CompactFormField label="إضافة أخرى 1" value={financialForm.otherAddition1} onChange={(e) => patchFinancial({ otherAddition1: e.target.value })} />
                    <CompactFormField label="إضافة أخرى 2" value={financialForm.otherAddition2} onChange={(e) => patchFinancial({ otherAddition2: e.target.value })} />
                    <CompactFormField label="خصم آخر 1" value={financialForm.otherDeduction1} onChange={(e) => patchFinancial({ otherDeduction1: e.target.value })} />
                    <CompactFormField label="خصم آخر 2" value={financialForm.otherDeduction2} onChange={(e) => patchFinancial({ otherDeduction2: e.target.value })} />
                  </FormSectionCard>
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
                            <button
                              type="button"
                              title="تعديل"
                              className="w-8 h-8 flex items-center justify-center bg-white border border-[#D6EAF3] rounded-lg shadow"
                              onClick={() => openEditBuilding(b)}
                            >
                              <Image src="/lucide_edit.svg" alt="تعديل" width={20} height={20} className="w-5 h-5" />
                            </button>
                            <button
                              type="button"
                              title="حذف"
                              className="w-8 h-8 flex items-center justify-center bg-white border border-[#D6EAF3] rounded-lg shadow"
                              onClick={() => {
                                if (window.confirm('حذف هذا المبنى؟')) {
                                  deleteBuildingMutation.mutate(b.id);
                                }
                              }}
                            >
                              <Image src="/hugeicons_delete-02.svg" alt="حذف" width={20} height={20} className="w-5 h-5" />
                            </button>
                          </div>
                          <Image src="/3omara.png" alt="" width={128} height={128} className="w-32 h-32 object-cover rounded-xl mb-2" />
                          <div className="text-[#0E78AA] font-bold mb-2">{b.arabicName || 'مبنى'}</div>
                          <div className="grid grid-cols-3 gap-2">
                            <CompactFormField label="المجموعة" readOnly value={b.groupNumber ?? ''} />
                            <CompactFormField label="النموذج" readOnly value={b.modelNumber ?? ''} />
                            <CompactFormField label="الوحدة" readOnly value={b.unitNumber ?? ''} />
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
                <FormSectionCard title="إسناد بنود الأعمال">
                  <p className="sm:col-span-2 text-sm text-slate-600">
                    استخدم تعريف المقاول ثم أنشئ عقد باطن من شاشة مقاولي الباطن.
                  </p>
                </FormSectionCard>
                <div className="mb-4 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => router.push('/extracts/operations/contractor')}
                  >
                    تعريف المقاول
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => router.push('/subcontracts/contracts')}
                  >
                    إنشاء عقد مقاول باطن
                  </Button>
                </div>
                <AppTable
                  columns={WORK_ITEM_COLUMNS}
                  data={workItems}
                  getRowKey={(row) => row.id}
                  isLoading={workItemsLoading}
                  emptyTitle="لا توجد بنود مسجّلة لهذا المشروع"
                  exportFileName="project-assignment-items"
                />
              </>
            )}
            {activeTab === 2 && (
              <>
                <div className="mb-4 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => router.push('/contracting/extracts')}
                  >
                    إنشاء مستخلص جديد
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => router.push('/contracting/extracts')}
                  >
                    معاينة المستخلصات السابقة
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => router.push('/subcontracts')}
                  >
                    لوحة مقاولي الباطن
                  </Button>
                </div>
                <AppTable
                  columns={WORK_ITEM_COLUMNS}
                  data={workItems}
                  getRowKey={(row) => row.id}
                  isLoading={workItemsLoading}
                  emptyTitle="لا توجد بنود مسجّلة لهذا المشروع"
                  exportFileName="project-subcontractor-extracts"
                />
              </>
            )}
            {activeTab === 3 && (
              <>
                <FormSectionCard title="مستخلصات المالك">
                  <p className="sm:col-span-2 text-sm text-slate-600">
                    مستخلصات المالك ذات الترحيل المحاسبي تُنشأ من شاشة المقاولات.
                  </p>
                </FormSectionCard>
                <div className="mb-4 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => router.push('/contracting/extracts')}
                  >
                    مستخلصات المقاولات
                  </Button>
                </div>
                <AppTable
                  columns={WORK_ITEM_COLUMNS}
                  data={workItems}
                  getRowKey={(row) => row.id}
                  isLoading={workItemsLoading}
                  emptyTitle="لا توجد بنود مسجّلة لهذا المشروع"
                  exportFileName="project-owner-extracts"
                />
              </>
            )}
        </div>
    </ExtractsPageChrome>
  );
}
