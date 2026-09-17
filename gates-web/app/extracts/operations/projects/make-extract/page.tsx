'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ExtractsPageChrome } from '@/components/extracts/ExtractsPageChrome';
import {
  AppTable,
  CompactFormField,
  FormSectionCard,
  compactControlClass,
} from '@/components/ui';
import { useApiQuery, useApiMutation, useInvalidateQuery } from '@/lib/hooks/useApi';
import { useBackendReachability } from '@/lib/hooks/useBackendReachability';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';
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

const pillClass = (active: boolean) =>
  `${
    active ? 'bg-[#0E78AA] text-white border-[#0E78AA]' : 'bg-white text-[#0A3D5E] border-[#D6EAF3]'
  } inline-flex cursor-pointer items-center rounded-full border px-3 py-1.5 text-xs font-semibold`;

export default function MakeExtractPage() {
  useBackendReachability();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const paramProjectId = searchParams.get('projectId') ?? '';

  const invalidateQuery = useInvalidateQuery();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [statementKind, setStatementKind] = useState<'quantity' | 'percentage'>('quantity');
  const [statementPhase, setStatementPhase] = useState<'current' | 'executive'>('current');
  const [formData, setFormData] = useState({
    serial: '',
    contractorId: '',
    projectId: '',
    extractDate: '',
    description: '',
    grossAmount: '',
    taxNumber: '',
  });

  const { data: projectsResponse } = useApiQuery<ContractingProjectOption[]>(
    ['contracting-projects'],
    '/contracting/projects',
    { limit: 1000 }
  );
  const projects = projectsResponse?.data || [];

  useEffect(() => {
    if (!projects.length) return;
    const fromUrl = paramProjectId && projects.some((p) => p.id === paramProjectId);
    const pick = fromUrl ? paramProjectId : projects[0].id;
    setFormData((prev) => (prev.projectId ? prev : { ...prev, projectId: pick }));
    if (!paramProjectId && pick) {
      const q = new URLSearchParams(searchParams.toString());
      q.set('projectId', pick);
      router.replace(`${pathname}?${q.toString()}`, { scroll: false });
    }
  }, [projects, paramProjectId, pathname, router, searchParams]);

  const effectiveProjectId = useMemo(() => {
    if (formData.projectId) return formData.projectId;
    if (paramProjectId) return paramProjectId;
    return projects[0]?.id ?? '';
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
    if (id) q.set('projectId', id);
    else q.delete('projectId');
    router.replace(`${pathname}?${q.toString()}`, { scroll: false });
  };

  const extractMutation = useApiMutation<unknown, Record<string, unknown>>(
    '/contracting/client-extracts',
    'POST',
    {
      onSuccess: () => {
        setSuccess('تم إنشاء المستخلص بنجاح');
        invalidateQuery(['contracting-client-extracts']);
        handleCancel();
      },
      onError: (apiError: ApiError) => {
        setError(apiError.message || 'حدث خطأ أثناء الإنشاء');
      },
    }
  );

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    setFormData((prev) => ({ ...prev, extractDate: today }));
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

    extractMutation.mutate({
      projectId,
      extractNumber: formData.serial.trim() || `EXT-${Date.now()}`,
      grossAmount,
      periodStart: new Date(formData.extractDate).toISOString(),
      periodEnd: new Date(formData.extractDate).toISOString(),
    });
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
      taxNumber: '',
    });
    setError('');
    setSuccess('');
    if (pid) {
      const q = new URLSearchParams(searchParams.toString());
      q.set('projectId', pid);
      router.replace(`${pathname}?${q.toString()}`, { scroll: false });
    }
  };

  const selectedProject = projects.find((p) => p.id === effectiveProjectId);

  return (
    <ExtractsPageChrome
      title="إنشاء مستخلص جديد"
      breadcrumbs={[
        { href: '/extracts', label: 'المستخلصات' },
        { href: '/extracts/operations/projects', label: 'إدارة المشاريع' },
        { label: 'إنشاء مستخلص جديد' },
      ]}
      onSave={handleSave}
      savePending={extractMutation.isPending}
      onNew={handleCancel}
      statusLabel="جديد"
      favoriteHref="/extracts/operations/projects/make-extract"
      browseList={{
        title: 'المستخلصات السابقة',
        apiPath: '/extracts',
        listKey: 'extracts-browse',
        columns: [
          { id: 'number', header: 'الرقم', getValue: (r) => String(r.extractNumber || r.serial || r.id) },
          { id: 'project', header: 'المشروع', getValue: (r) => String((r.project as { arabicName?: string } | undefined)?.arabicName || '—') },
        ],
        onSelect: (_id, row) => {
          const projectId = String(row.projectId ?? '');
          if (projectId) onProjectChange(projectId);
          setFormData((prev) => ({
            ...prev,
            serial: String(row.extractNumber ?? prev.serial),
            projectId: projectId || prev.projectId,
            grossAmount: row.grossAmount != null ? String(row.grossAmount) : prev.grossAmount,
          }));
        },
      }}
    >
      {error ? <ErrorToast message={error} onClose={() => setError('')} /> : null}
      {success ? <SuccessToast message={success} onClose={() => setSuccess('')} /> : null}

      <FormSectionCard title="بيانات المستخلص" subtitle="المشروع والقيمة وتاريخ الفترة" icon={FileSpreadsheet}>
        <CompactFormField label="المشروع" required>
          <select
            id="make-extract-project"
            data-tour="contracting-project-select"
            value={formData.projectId || effectiveProjectId}
            onChange={(e) => onProjectChange(e.target.value)}
            className={compactControlClass}
          >
            {projects.length === 0 ? (
              <option value="">لا توجد مشاريع</option>
            ) : (
              projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.projectName ?? p.projectCode ?? p.id}
                </option>
              ))
            )}
          </select>
        </CompactFormField>
        <CompactFormField
          label="المسلسل"
          placeholder="رقم المستخلص"
          value={formData.serial}
          onChange={(e) => setFormData((prev) => ({ ...prev, serial: e.target.value }))}
        />
        <CompactFormField
          label="تاريخ المستخلص"
          type="date"
          value={formData.extractDate}
          onChange={(e) => setFormData((prev) => ({ ...prev, extractDate: e.target.value }))}
        />
        <CompactFormField
          label="قيمة المستخلص"
          required
          type="number"
          min={0}
          step="0.01"
          placeholder="0.00"
          value={formData.grossAmount}
          onChange={(e) => setFormData((prev) => ({ ...prev, grossAmount: e.target.value }))}
        />
        <CompactFormField
          label="المقاول"
          placeholder="كود المقاول"
          value={formData.contractorId}
          onChange={(e) => setFormData((prev) => ({ ...prev, contractorId: e.target.value }))}
        />
        <CompactFormField
          label="مأمورية الضرائب"
          readOnly
          value={selectedProject?.projectName ?? ''}
        />
        <CompactFormField
          label="الرقم الضريبي"
          placeholder="إدخل الرقم الضريبي"
          value={formData.taxNumber}
          onChange={(e) => setFormData((prev) => ({ ...prev, taxNumber: e.target.value }))}
        />
        <CompactFormField label="نوع البيان">
          <div className="flex flex-wrap gap-2">
            {[
              { value: 'quantity' as const, label: 'كمية' },
              { value: 'percentage' as const, label: 'نسبة' },
            ].map((opt) => (
              <label key={opt.value} className={pillClass(statementKind === opt.value)}>
                <input
                  type="radio"
                  name="statementKind"
                  className="sr-only"
                  checked={statementKind === opt.value}
                  onChange={() => setStatementKind(opt.value)}
                />
                {opt.label}
              </label>
            ))}
          </div>
        </CompactFormField>
        <CompactFormField label="مرحلة البيان">
          <div className="flex flex-wrap gap-2">
            {[
              { value: 'current' as const, label: 'جاري' },
              { value: 'executive' as const, label: 'تنفيذي' },
            ].map((opt) => (
              <label key={opt.value} className={pillClass(statementPhase === opt.value)}>
                <input
                  type="radio"
                  name="statementPhase"
                  className="sr-only"
                  checked={statementPhase === opt.value}
                  onChange={() => setStatementPhase(opt.value)}
                />
                {opt.label}
              </label>
            ))}
          </div>
        </CompactFormField>
        <CompactFormField label="البيان" className="sm:col-span-2">
          <textarea
            placeholder="أدخل البيان هنا..."
            value={formData.description}
            onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
            className={`${compactControlClass} h-20 max-w-none resize-none py-2`}
          />
        </CompactFormField>
      </FormSectionCard>

      <div className="mb-3 flex flex-wrap gap-2" data-tour="extract-boq-table">
        <Button type="button" variant="secondary" size="sm">
          إختيار بنود الأعمال
        </Button>
        <Button type="button" variant="secondary" size="sm">
          حذف الكل
        </Button>
      </div>

      <AppTable
        columns={[
          { id: 'qty', header: 'الحصر', cell: (row) => fmt(row.quantity) },
          { id: 'unit', header: 'الوحدة', cell: (row) => fmt(row.unit) },
          { id: 'name', header: 'إسم بند الأعمال', cell: (row) => fmt(row.arabicName) },
          { id: 'itemNo', header: 'رقم البند', cell: (row) => fmt(row.itemNumber) },
          { id: 'group', header: 'مجموعة البند', cell: (row) => fmt(row.itemGroupName) },
          { id: 'groupCode', header: 'كود مجموعة البند', cell: (row) => fmt(row.itemGroupCode) },
          { id: 'unitNo', header: 'رقم الوحدة', cell: (row) => fmt(row.building?.unitNumber) },
        ]}
        data={workItems}
        getRowKey={(row) => row.id}
        isLoading={workLoading}
        emptyTitle={!effectiveProjectId ? 'اختر مشروعاً لعرض بنود الأعمال' : 'لا توجد بنود مسجّلة لهذا المشروع'}
        exportFileName="make-extract-items"
      />

      <FormSectionCard title="ملخص الأعمال" className="mt-4">
        <CompactFormField label="إجمالي الأعمال المنفذة" readOnly value="—" />
        <CompactFormField label="إجمالي الأعمال السابقة" readOnly value="—" />
        <CompactFormField label="صافي أعمال الفترة" readOnly value="—" />
      </FormSectionCard>
    </ExtractsPageChrome>
  );
}
