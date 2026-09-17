'use client';

import { useBackendReachability } from '@/lib/hooks/useBackendReachability';
import React, { useState, useEffect, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ListChecks } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ExtractsPageChrome } from '@/components/extracts/ExtractsPageChrome';
import {
  AppTable,
  CompactFormField,
  FormSectionCard,
  compactControlClass,
} from '@/components/ui';
import { useApiQuery } from '@/lib/hooks/useApi';

function fmt(v: unknown) {
  if (v == null || v === '') return '—';
  return String(v);
}

export default function AgendaItemsPage() {
  useBackendReachability();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const paramProjectId = searchParams.get('projectId') ?? '';

  const [activeTab, setActiveTab] = useState(0);
  const [showTotalView, setShowTotalView] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const tabs = ['تشطيبات', 'أعمال فوق الأرض', 'أعمال تحت الأرض', 'تجهيزات'];

  const { data: projectsResponse } = useApiQuery<{ id: string; arabicName?: string; serial?: string }[]>(
    ['projects'],
    '/extracts/projects',
    { limit: 1000, isActive: true }
  );
  const projects = projectsResponse?.data ?? [];

  const projectId = useMemo(() => {
    if (paramProjectId) return paramProjectId;
    return projects[0]?.id ?? '';
  }, [paramProjectId, projects]);

  useEffect(() => {
    if (!projects.length) return;
    if (!paramProjectId && projects[0]?.id) {
      const q = new URLSearchParams(searchParams.toString());
      q.set('projectId', projects[0].id);
      router.replace(`${pathname}?${q.toString()}`, { scroll: false });
    }
  }, [projects, paramProjectId, pathname, router, searchParams]);

  const onProjectChange = (id: string) => {
    const q = new URLSearchParams(searchParams.toString());
    if (id) q.set('projectId', id);
    else q.delete('projectId');
    router.replace(`${pathname}?${q.toString()}`, { scroll: false });
  };

  useEffect(() => {
    setPage(1);
  }, [projectId]);

  const { data: workRes, isLoading: workLoading } = useApiQuery<
    {
      id: string;
      arabicName: string;
      itemNumber: string;
      unit?: string | null;
      quantity?: unknown;
      totalPrice?: unknown;
      itemGroupName?: string | null;
    }[]
  >(
    ['extracts-work-items', projectId, 'agenda-items', page],
    '/extracts/work-items',
    { projectId, page, limit: pageSize },
    { enabled: Boolean(projectId) }
  );
  const workItems = workRes?.data ?? [];
  const workItemsTotal = workRes?.pagination?.total ?? workRes?.meta?.total ?? workItems.length;

  const totalQty = useMemo(() => {
    let t = 0;
    for (const w of workItems) {
      const qv = w.quantity != null ? Number(w.quantity) : NaN;
      if (!Number.isNaN(qv)) t += qv;
    }
    return t;
  }, [workItems]);

  const totalValue = useMemo(
    () =>
      workItems.reduce((acc, w) => {
        const v = w.totalPrice != null ? Number(w.totalPrice) : NaN;
        return acc + (Number.isNaN(v) ? 0 : v);
      }, 0),
    [workItems]
  );

  const selectedProjectLabel =
    projects.find((p) => p.id === projectId)?.arabicName ??
    projects.find((p) => p.id === projectId)?.serial ??
    '';

  return (
    <ExtractsPageChrome
      title="عرض بنود الأعمال"
      breadcrumbs={[
        { href: '/extracts', label: 'المستخلصات' },
        { href: '/extracts/operations/projects', label: 'إدارة المشاريع' },
        { label: 'عرض بنود الأعمال' },
      ]}
      statusLabel="عرض"
      favoriteHref="/extracts/operations/projects/agenda-items"
      browseList={{
        title: 'بنود الأعمال',
        apiPath: '/extracts/work-items',
        listKey: 'extract-agenda-browse',
        extraParams: projectId ? { projectId } : undefined,
        columns: [
          { id: 'code', header: 'الكود', getValue: (r) => String(r.itemNumber || r.id) },
          { id: 'name', header: 'البند', getValue: (r) => String(r.arabicName || '—') },
        ],
        onSelect: () => undefined,
      }}
      extraActions={
        <Button type="button" variant="secondary" size="sm" onClick={() => setShowTotalView((v) => !v)}>
          {showTotalView ? 'عرض البنود' : 'إجمالي بنود الأعمال'}
        </Button>
      }
    >
      <FormSectionCard title="تصفية البنود" subtitle="اختر المشروع ثم راجع البنود" icon={ListChecks}>
        <CompactFormField label="المشروع">
          <select
            id="agenda-project"
            value={projectId}
            onChange={(e) => onProjectChange(e.target.value)}
            className={compactControlClass}
          >
            {projects.length === 0 ? (
              <option value="">لا توجد مشاريع</option>
            ) : (
              projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.arabicName ?? p.serial ?? p.id}
                </option>
              ))
            )}
          </select>
        </CompactFormField>
        <CompactFormField label="الإسم العربي" readOnly value={selectedProjectLabel || '—'} />
        <CompactFormField label="الكود" placeholder="" />
        <CompactFormField label="الإسم الإنجليزي" placeholder="إدخل الإسم الإنجليزي" />
        <CompactFormField label="الموازنة الكلية" placeholder="إدخل الموازنة الكلية بالأرقام" />
      </FormSectionCard>

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

      {showTotalView ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <AppTable
            columns={[
              { id: 'name', header: 'إسم البند', cell: (row) => fmt(row.arabicName) },
              { id: 'qty', header: 'الكمية', cell: (row) => fmt(row.quantity) },
              { id: 'value', header: 'القيمة', cell: (row) => fmt(row.totalPrice) },
            ]}
            data={workItems}
            getRowKey={(row) => `${row.id}-sum`}
            isLoading={workLoading}
            emptyTitle={!projectId ? 'اختر مشروعاً' : 'لا توجد بنود'}
            exportFileName="agenda-items-totals"
          />
          <AppTable
            columns={[
              { id: 'idx', header: 'م', cell: (_row, index) => index + 1 },
              { id: 'name', header: 'إسم البند', cell: (row) => fmt(row.arabicName) },
              { id: 'code', header: 'الكود', cell: (row) => fmt(row.itemNumber) },
              { id: 'unit', header: 'الوحدة', cell: (row) => fmt(row.unit) },
              { id: 'qty', header: 'الكمية', cell: (row) => fmt(row.quantity) },
              { id: 'group', header: 'فئة العميل', cell: (row) => fmt(row.itemGroupName) },
            ]}
            data={workItems}
            getRowKey={(row) => row.id}
            isLoading={workLoading}
            emptyTitle={!projectId ? 'اختر مشروعاً' : 'لا توجد بنود'}
            exportFileName="agenda-items-detail"
          />
        </div>
      ) : (
        <AppTable
          columns={[
            { id: 'idx', header: 'م', cell: (_row, index) => index + 1 },
            { id: 'name', header: 'إسم البند', cell: (row) => fmt(row.arabicName) },
            { id: 'code', header: 'الكود', cell: (row) => fmt(row.itemNumber) },
            { id: 'unit', header: 'الوحدة', cell: (row) => fmt(row.unit) },
            { id: 'qty', header: 'الكمية', cell: (row) => fmt(row.quantity) },
            { id: 'total', header: 'إجمالي', cell: (row) => fmt(row.totalPrice) },
            { id: 'group', header: 'البند العام', cell: (row) => fmt(row.itemGroupName) },
          ]}
          data={workItems}
          getRowKey={(row) => row.id}
          isLoading={workLoading}
          emptyTitle={!projectId ? 'اختر مشروعاً لعرض بنود الأعمال' : 'لا توجد بنود مسجّلة لهذا المشروع'}
          exportFileName="agenda-items"
          pagination={{
            page,
            pageSize,
            totalItems: workItemsTotal,
            onPageChange: setPage,
          }}
        />
      )}

      <FormSectionCard title="الإجماليات" className="mt-4">
        <CompactFormField
          label="إجمالي الكمية"
          readOnly
          value={workItems.length ? String(totalQty) : '—'}
        />
        <CompactFormField
          label="إجمالي القيمة"
          readOnly
          value={workItems.length ? String(totalValue) : '—'}
        />
      </FormSectionCard>
    </ExtractsPageChrome>
  );
}
