'use client';

import { useMemo, useState } from 'react';
import { useBackendReachability } from '@/lib/hooks/useBackendReachability';
import { ExtractsPageChrome } from '@/components/extracts/ExtractsPageChrome';
import { AppTable, CompactFormField, FormSectionCard, compactControlClass } from '@/components/ui';
import { Button } from '@/components/ui/button';
import { useApiQuery } from '@/lib/hooks/useApi';
import { apiClient } from '@/lib/api/client';
import { withItemCodeHierarchy, workItemHierarchyHints, sumExecutable } from '@/lib/contracting/boq-hierarchy';
import {
  buildLegacyExtractPayload,
  mapExtractContractError,
} from '@/lib/contracting/mostakhlasat-contracts';
import { formatEgp, formatQty, toMoney } from '@/lib/subcontracts/money';
import ErrorToast from '@/components/ErrorToast';

type WorkItemRow = {
  id: string;
  projectId?: string;
  parentId?: string | null;
  isExecutable?: boolean;
  _count?: { children?: number };
  itemNumber: string;
  itemGroupName?: string | null;
  itemGroupCode?: string | null;
  arabicName: string;
  englishName?: string | null;
  quantity?: number | string | null;
  unit?: string | null;
  unitPrice?: number | string | null;
  totalPrice?: number | string | null;
  notes?: string | null;
};

type ProjectOption = { id: string; arabicName?: string; serial?: string };
type ContractorOption = { id: string; arabicName?: string; serial?: string };
type PreviewResult = {
  totalValue: number;
  previousWorkTotal: number;
  previousExtractCount: number;
  items: Array<{
    workItemId?: string | null;
    itemName: string;
    currentQuantity: number;
    previousQuantity: number;
    cumulativeQuantity: number;
    remainingQuantity?: number;
    totalPrice: number | null;
  }>;
};

type SavedExtract = {
  id: string;
  extractNumber?: string | null;
  totalValue?: number | string | null;
  previousWorkTotal?: number | string | null;
  items?: PreviewResult['items'];
};

export default function DetailedExtractItemsPage() {
  useBackendReachability();
  const [projectId, setProjectId] = useState('');
  const [contractorId, setContractorId] = useState('');
  const [currentQty, setCurrentQty] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [saved, setSaved] = useState<SavedExtract | null>(null);
  const [previewError, setPreviewError] = useState('');
  const [previewPending, setPreviewPending] = useState(false);
  const [savePending, setSavePending] = useState(false);

  const { data: projectsRes } = useApiQuery<ProjectOption[]>(
    ['extracts-projects', 'detailed-items'],
    '/extracts/projects',
    { limit: 500, isActive: true }
  );
  const projects = projectsRes?.data ?? [];

  const { data: contractorsRes } = useApiQuery<ContractorOption[]>(
    ['extracts-contractors', 'detailed-preview'],
    '/extracts/contractors',
    { limit: 500, isActive: true }
  );
  const contractors = contractorsRes?.data ?? [];

  const { data: itemsResponse, isLoading } = useApiQuery<WorkItemRow[]>(
    ['extract-work-items-detailed', projectId],
    '/extracts/work-items',
    { limit: 500, projectId: projectId || undefined }
  );
  const tableData = itemsResponse?.data ?? [];
  const hierarchical = useMemo(
    () => withItemCodeHierarchy(tableData, (row) => row.itemNumber || '', workItemHierarchyHints),
    [tableData]
  );
  const boqLeafTotal = sumExecutable(hierarchical, (row) => toMoney(row.totalPrice));
  const previewByWorkItem = useMemo(() => {
    const map = new Map<string, PreviewResult['items'][number]>();
    for (const row of saved?.items ?? preview?.items ?? []) {
      if (row.workItemId) map.set(row.workItemId, row);
    }
    return map;
  }, [preview, saved]);

  const extractBody = () => {
    const items = hierarchical
      .filter((row) => row.__isExecutable)
      .map((row) => ({
        workItemId: row.id,
        itemName: row.arabicName,
        itemNumber: row.itemNumber,
        quantity: toMoney(currentQty[row.id] || 0),
        unit: row.unit,
        unitPrice: row.unitPrice != null ? toMoney(row.unitPrice) : undefined,
      }))
      .filter((row) => row.quantity > 0);
    return buildLegacyExtractPayload({
      projectId,
      contractorId: contractorId || undefined,
      extractDate: new Date().toISOString(),
      items,
    });
  };

  const handlePreview = async () => {
    setPreviewError('');
    setPreview(null);
    if (!projectId) {
      setPreviewError('اختر مشروعاً لمعاينة المستخلص');
      return;
    }
    const body = extractBody();
    if (!body.items.length) {
      setPreviewError('أدخل كمية حالية لبند تنفيذي واحد على الأقل');
      return;
    }
    setPreviewPending(true);
    try {
      const res = await apiClient.post<PreviewResult>('/extracts/preview', body);
      setPreview(res.data ?? null);
    } catch (err) {
      setPreviewError(mapExtractContractError(err).message);
    } finally {
      setPreviewPending(false);
    }
  };

  const handleSave = async () => {
    setPreviewError('');
    if (!projectId) {
      setPreviewError('اختر مشروعاً لحفظ المستخلص');
      return;
    }
    const body = extractBody();
    if (!body.items.length) {
      setPreviewError('أدخل كمية حالية لبند تنفيذي واحد على الأقل');
      return;
    }
    setSavePending(true);
    try {
      const res = await apiClient.post<SavedExtract>('/extracts', body);
      setSaved(res.data ?? null);
      setPreview(null);
    } catch (err) {
      setPreviewError(mapExtractContractError(err).message);
    } finally {
      setSavePending(false);
    }
  };

  return (
    <ExtractsPageChrome
      title="البنود التفصيلية للمستخلص"
      breadcrumbs={[
        { href: '/extracts', label: 'المستخلصات' },
        { label: 'العمليات' },
        { label: 'البنود التفصيلية للمستخلص' },
      ]}
      statusLabel="عرض"
      favoriteHref="/extracts/operations/detailed-extract-items"
      browseList={{
        title: 'البنود التفصيلية',
        apiPath: '/extracts/work-items',
        listKey: 'extract-work-items-detailed-browse',
        extraParams: projectId ? { projectId } : undefined,
        columns: [
          { id: 'code', header: 'الكود', getValue: (r) => String(r.itemNumber || r.id) },
          { id: 'group', header: 'البند العام', getValue: (r) => String(r.itemGroupName || '—') },
          { id: 'name', header: 'الاسم', getValue: (r) => String(r.arabicName || '—') },
        ],
        onSelect: () => undefined,
      }}
    >
      {previewError ? <ErrorToast message={previewError} onClose={() => setPreviewError('')} /> : null}

      <FormSectionCard title="تصفية" subtitle="عرض البنود حسب المشروع مع التمييز بين البند الرئيسي والتنفيذي">
        <CompactFormField label="المشروع">
          <select
            value={projectId}
            onChange={(e) => {
              setProjectId(e.target.value);
              setPreview(null);
              setSaved(null);
            }}
            className={compactControlClass}
          >
            <option value="">كل المشاريع</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.arabicName || p.serial || p.id}
              </option>
            ))}
          </select>
        </CompactFormField>
        <CompactFormField label="إجمالي المقايسة (بنود تنفيذية محفوظة)" readOnly value={formatEgp(boqLeafTotal)} />
      </FormSectionCard>

      <FormSectionCard
        title="معاينة مستخلص (غير محفوظ)"
        subtitle="POST /extracts/preview — السيرفر يحسب السابق والتراكمي والإجمالي ويتجاهل أي إجمالي من الشاشة"
      >
        <CompactFormField label="المقاول (مستخلص مقاول)">
          <select
            value={contractorId}
            onChange={(e) => setContractorId(e.target.value)}
            className={compactControlClass}
          >
            <option value="">مستخلص مالك / بدون مقاول</option>
            {contractors.map((c) => (
              <option key={c.id} value={c.id}>
                {c.arabicName || c.serial || c.id}
              </option>
            ))}
          </select>
        </CompactFormField>
        <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
          <Button type="button" onClick={() => void handlePreview()} disabled={previewPending}>
            {previewPending ? 'جاري المعاينة…' : 'معاينة من السيرفر'}
          </Button>
          <Button type="button" variant="secondary" onClick={() => void handleSave()} disabled={savePending}>
            {savePending ? 'جاري الحفظ…' : 'حفظ مسودة'}
          </Button>
          {preview ? (
            <p className="text-sm text-[#0E78AA]">
              معاينة غير محفوظة — إجمالي الفترة: {formatEgp(preview.totalValue)} — سابق:{' '}
              {formatEgp(preview.previousWorkTotal)} من {preview.previousExtractCount} مستخلص
            </p>
          ) : saved ? (
            <p className="text-sm text-emerald-800">
              محفوظ ({saved.extractNumber || saved.id}) — إجمالي الفترة: {formatEgp(saved.totalValue)} —
              الترحيل من شاشة المقاولات وليس من هنا.
            </p>
          ) : (
            <p className="text-xs text-slate-500">المعاينة لا تُحسب كحفظ. الترحيل المحاسبي من شاشة المقاولات.</p>
          )}
        </div>
      </FormSectionCard>

      <AppTable
        columns={[
          {
            id: 'code',
            header: 'الكود',
            cell: (row) => (
              <span style={{ paddingInlineStart: row.__depth * 12 }}>
                {row.itemNumber}
                {row.__isParent ? <span className="mr-1 text-[10px] text-[#0E78AA]"> رئيسي</span> : null}
              </span>
            ),
          },
          { id: 'group', header: 'البند العام', cell: (row) => row.itemGroupName || row.itemGroupCode || '—' },
          { id: 'ar', header: 'الإسم العربي', accessor: 'arabicName' },
          { id: 'en', header: 'الإسم الإنجليزي', accessor: 'englishName' },
          { id: 'qty', header: 'كمية المقايسة', numeric: true, cell: (row) => (row.__isParent ? '—' : formatQty(row.quantity)) },
          {
            id: 'current',
            header: 'كمية الفترة',
            numeric: true,
            cell: (row) =>
              row.__isParent ? (
                '—'
              ) : (
                <input
                  type="number"
                  min={0}
                  step="0.0001"
                  className={compactControlClass}
                  value={currentQty[row.id] ?? ''}
                  onChange={(e) => setCurrentQty((prev) => ({ ...prev, [row.id]: e.target.value }))}
                />
              ),
          },
          {
            id: 'previous',
            header: 'سابق (سيرفر)',
            numeric: true,
            cell: (row) =>
              row.__isParent ? '—' : formatQty(previewByWorkItem.get(row.id)?.previousQuantity),
          },
          {
            id: 'cumulative',
            header: 'تراكمي (سيرفر)',
            numeric: true,
            cell: (row) =>
              row.__isParent ? '—' : formatQty(previewByWorkItem.get(row.id)?.cumulativeQuantity),
          },
          {
            id: 'remaining',
            header: 'متبقي (سيرفر)',
            numeric: true,
            cell: (row) =>
              row.__isParent ? '—' : formatQty(previewByWorkItem.get(row.id)?.remainingQuantity),
          },
          { id: 'unit', header: 'الوحدة', accessor: 'unit' },
          {
            id: 'price',
            header: 'سعر الوحدة',
            numeric: true,
            cell: (row) => (row.__isParent || row.unitPrice == null ? '—' : formatEgp(row.unitPrice)),
          },
          {
            id: 'total',
            header: 'إجمالي المقايسة',
            numeric: true,
            cell: (row) => (row.__isParent || row.totalPrice == null ? '—' : formatEgp(row.totalPrice)),
          },
          { id: 'notes', header: 'ملاحظات', accessor: 'notes' },
        ]}
        data={hierarchical}
        getRowKey={(row) => row.id}
        isLoading={isLoading}
        emptyTitle="لا توجد بنود تفصيلية"
        emptyDescription="أضف البنود من شاشة البنود العامة ثم راجعها هنا."
        exportFileName="detailed-extract-items"
        rowClassName={(row) => (row.__isParent ? 'bg-[#EEF6FA]' : undefined)}
      />
    </ExtractsPageChrome>
  );
}
