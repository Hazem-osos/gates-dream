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
                {/* 5 Action Buttons */}
                <div className="mb-4 flex flex-wrap gap-2">
                  {[
                    { label: "بنود الأعمال والحصر" },
                    { label: "إنشاء عقد مالك" },
                    { label: "تعريف شكل البناء" },
                    { label: "مقايسة المشروع", onClick: () => router.push("/extracts/operations/projects/maqaysa") },
                    { label: "عرض بنود الأعمال", onClick: () => router.push("/extracts/operations/projects/agenda-items") },
                    { label: "البنود العامة للمستخلصات", onClick: () => router.push("/extracts/operations/general-extract-items") },
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
                  <CompactFormField label="كود المقاول" placeholder="كود المقاول" />
                  <CompactFormField label="المقاول" placeholder="إسم المقاول" />
                  <CompactFormField label="تاريخ الإسناد" type="date" />
                  <CompactFormField label="ت. المقاول" placeholder="بحث..." />
                </FormSectionCard>
                <div className="mb-4 flex flex-wrap gap-2">
                  {['تجميع حسب الوحدات', 'تجميع حسب المجموعات', 'تجميع حسب بنود الأعمال', 'إنشاء عقد مقاول باطن', 'معاينة العقد'].map((label) => (
                    <Button key={label} type="button" variant="secondary" size="sm">
                      {label}
                    </Button>
                  ))}
                </div>
                <AppTable
                  columns={WORK_ITEM_COLUMNS}
                  data={workItems}
                  getRowKey={(row) => row.id}
                  isLoading={workItemsLoading}
                  emptyTitle="لا توجد بنود مسجّلة لهذا المشروع"
                  exportFileName="project-assignment-items"
                />
                <FormSectionCard title="ملخص الإسناد" className="mt-4">
                  <CompactFormField label="نسبة الدفعة المقدمة %" defaultValue="" />
                  <CompactFormField label="قيمة الدفعة المقدمة" defaultValue="" />
                  <CompactFormField label="نسبة تأمين الأعمال %" defaultValue="" />
                  <CompactFormField label="نسبة الضرائب المستقطعة %" defaultValue="" />
                  <CompactFormField label="عدد مقاولي الباطن" defaultValue="" />
                  <CompactFormField label="بنود غير مسندة" defaultValue="" />
                </FormSectionCard>
              </>
            )}
            {activeTab === 2 && (
              <>
                <div className="mb-4 flex flex-wrap gap-2">
                  <Button type="button" variant="secondary" size="sm" onClick={() => router.push('/extracts/operations/projects/make-extract')}>
                    إنشاء مستخلص جديد
                  </Button>
                  <Button type="button" variant="secondary" size="sm">معاينة المستخلصات السابقة</Button>
                  <Button type="button" variant="secondary" size="sm">نقل بنود الأعمال لمقاول آخر</Button>
                </div>
                <AppTable
                  columns={WORK_ITEM_COLUMNS}
                  data={workItems}
                  getRowKey={(row) => row.id}
                  isLoading={workItemsLoading}
                  emptyTitle="لا توجد بنود مسجّلة لهذا المشروع"
                  exportFileName="project-subcontractor-extracts"
                />
                <FormSectionCard title="ملخص المستخلصات" className="mt-4">
                  <CompactFormField label="عدد مقاولي الباطن" readOnly value="—" />
                  <CompactFormField label="رصيد متبقي" readOnly value="—" />
                  <CompactFormField label="من إجمالي تكلفة" readOnly value="—" />
                  <CompactFormField label="عدد المستخلصات المصدرة" readOnly value="—" />
                  <CompactFormField label="بقيمة إجمالية" readOnly value="—" />
                </FormSectionCard>
              </>
            )}
            {activeTab === 3 && (
              <>
                <FormSectionCard title="مستخلصات المالك">
                  <CompactFormField label="الكود" defaultValue="000000000001" readOnly />
                  <CompactFormField label="تاريخ المستخلص" type="date" />
                  <CompactFormField label="نوع البيان">
                    <div className="flex flex-wrap gap-2">
                      {[
                        { value: 'partial', label: 'جزئي' },
                        { value: 'final', label: 'ختامي' },
                      ].map((opt) => (
                        <label
                          key={opt.value}
                          className="inline-flex cursor-pointer items-center rounded-full border border-[#D6EAF3] bg-white px-3 py-1.5 text-xs font-semibold text-[#0A3D5E] has-[:checked]:border-[#0E78AA] has-[:checked]:bg-[#0E78AA] has-[:checked]:text-white"
                        >
                          <input type="radio" name="statementType" value={opt.value} defaultChecked={opt.value === 'partial'} className="sr-only" />
                          {opt.label}
                        </label>
                      ))}
                    </div>
                  </CompactFormField>
                  <CompactFormField label="البيان" className="sm:col-span-2">
                    <textarea
                      placeholder="أدخل البيان هنا..."
                      className={`${compactControlClass} h-20 max-w-none resize-none py-2`}
                    />
                  </CompactFormField>
                </FormSectionCard>
                <div className="mb-4 flex flex-wrap gap-2">
                  <Button type="button" variant="secondary" size="sm">مستخلصات المقاولين</Button>
                  <Button type="button" variant="secondary" size="sm">تنفيذ ذاتي</Button>
                </div>
                <AppTable
                  columns={WORK_ITEM_COLUMNS}
                  data={workItems}
                  getRowKey={(row) => row.id}
                  isLoading={workItemsLoading}
                  emptyTitle="لا توجد بنود مسجّلة لهذا المشروع"
                  exportFileName="project-owner-extracts"
                />
                <FormSectionCard title="ملخص المالك" className="mt-4">
                  <CompactFormField label="قيمة الدفعة المقدمة" readOnly value="—" />
                  <CompactFormField label="صافي أعمال الفترة" readOnly value="—" />
                  <CompactFormField label="إجمالي الأعمال السابقة" readOnly value="—" />
                  <CompactFormField label="عدد المستخلصات" readOnly value="—" />
                </FormSectionCard>
              </>
            )}
        </div>
    </ExtractsPageChrome>
  );
}
