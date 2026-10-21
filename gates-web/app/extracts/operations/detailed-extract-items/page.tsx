'use client';

import { useMemo, useState } from 'react';
import { useBackendReachability } from '@/lib/hooks/useBackendReachability';
import { ExtractsPageChrome } from '@/components/extracts/ExtractsPageChrome';
import { AppTable, CompactFormField, FormSectionCard, compactControlClass } from '@/components/ui';
import { Button } from '@/components/ui/button';
import { useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';
import { apiClient } from '@/lib/api/client';
import { withItemCodeHierarchy, workItemHierarchyHints, sumExecutable } from '@/lib/contracting/boq-hierarchy';
import {
  buildLegacyExtractPayload,
  legacyContractorStatementSummary,
  mapExtractContractError,
} from '@/lib/contracting/mostakhlasat-contracts';
import { formatEgp, formatPercent, formatQty, toMoney } from '@/lib/subcontracts/money';
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
  building?: { arabicName?: string | null; unitNumber?: string | null } | null;
};

function qtyPercent(part: number, contract: number): string {
  if (!(contract > 0)) return '—';
  return formatPercent((part / contract) * 100);
}

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
    previousAmount?: number | null;
    currentAmount?: number | null;
    cumulativeAmount?: number | null;
    unitPrice?: number | null;
    totalPrice: number | null;
  }>;
};

type ExtractListRow = {
  id: string;
  extractNumber?: string | null;
  extractDate: string;
  statementType?: string | null;
  totalValue?: number | string | null;
  contractor?: { arabicName?: string | null } | null;
};

function todayInputDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function displayLine(item: PreviewResult['items'][number]): PreviewResult['items'][number] {
  const unit = item.unitPrice != null ? toMoney(item.unitPrice) : null;
  return {
    ...item,
    previousAmount:
      item.previousAmount ?? (unit != null ? unit * toMoney(item.previousQuantity) : null),
    currentAmount: item.currentAmount ?? item.totalPrice,
    cumulativeAmount:
      item.cumulativeAmount ?? (unit != null ? unit * toMoney(item.cumulativeQuantity) : null),
  };
}

function toInputDate(value: string | null | undefined): string {
  if (!value) return todayInputDate();
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return todayInputDate();
  return parsed.toISOString().slice(0, 10);
}

type SavedExtract = {
  id: string;
  extractNumber?: string | null;
  totalValue?: number | string | null;
  previousWorkTotal?: number | string | null;
  items?: PreviewResult['items'];
};

type StoredExtractLine = {
  workItemId?: string | null;
  itemName?: string;
  quantity?: number | string | null;
  previousQuantity?: number | string | null;
  cumulativeQuantity?: number | string | null;
  remainingQuantity?: number | null;
  previousAmount?: number | string | null;
  currentAmount?: number | string | null;
  cumulativeAmount?: number | string | null;
  unitPrice?: number | string | null;
  totalPrice?: number | string | null;
};

type StoredExtractDetail = {
  id: string;
  extractNumber?: string | null;
  extractDate?: string;
  contractorId?: string | null;
  statementType?: 'partial' | 'final' | null;
  statement?: string | null;
  totalValue?: number | string | null;
  previousWorkTotal?: number | string | null;
  items?: StoredExtractLine[];
};

export default function DetailedExtractItemsPage() {
  useBackendReachability();
  const invalidateQuery = useInvalidateQuery();
  const [projectId, setProjectId] = useState('');
  const [contractorId, setContractorId] = useState('');
  const [extractNumber, setExtractNumber] = useState('');
  const [extractDate, setExtractDate] = useState(todayInputDate);
  const [statementType, setStatementType] = useState<'partial' | 'final'>('partial');
  const [statement, setStatement] = useState('');
  const [currentQty, setCurrentQty] = useState<Record<string, string>>({});
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [openedExtractId, setOpenedExtractId] = useState<string | null>(null);
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

  const { data: settingsRes } = useApiQuery<{
    advancePaymentPercentage?: number | string | null;
    workInsurancePercentage?: number | string | null;
    taxDeductionPercentage?: number | string | null;
  } | null>(
    ['contractor-settings', 'detailed-extract', contractorId],
    `/extracts/contractors/${contractorId}/settings`,
    undefined,
    { enabled: Boolean(contractorId) }
  );

  const { data: extractsRes } = useApiQuery<ExtractListRow[]>(
    ['extracts-list', 'detailed-items', projectId],
    '/extracts',
    { limit: 50, projectId: projectId || undefined },
    { enabled: Boolean(projectId) }
  );
  const savedExtracts = extractsRes?.data ?? [];

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
      if (row.workItemId) map.set(row.workItemId, displayLine(row));
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
      extractNumber: extractNumber.trim() || undefined,
      extractDate: new Date(`${extractDate}T00:00:00`).toISOString(),
      statementType,
      statement,
      items,
    });
  };

  const loadSavedExtract = async (id: string) => {
    setPreviewError('');
    setPreview(null);
    setSaved(null);
    try {
      const res = await apiClient.get<StoredExtractDetail>(`/extracts/${id}`);
      const row = res.data;
      if (!row) return;
      setOpenedExtractId(id);
      setExtractNumber(row.extractNumber ?? '');
      setExtractDate(toInputDate(row.extractDate));
      setContractorId(row.contractorId ?? '');
      if (row.statementType === 'final' || row.statementType === 'partial') {
        setStatementType(row.statementType);
      }
      setStatement(row.statement ?? '');
      const qty: Record<string, string> = {};
      for (const item of row.items ?? []) {
        if (item.workItemId) qty[item.workItemId] = String(item.quantity ?? '');
      }
      setCurrentQty(qty);
      setSaved({
        id: row.id,
        extractNumber: row.extractNumber,
        totalValue: row.totalValue,
        previousWorkTotal: row.previousWorkTotal,
        items: (row.items ?? []).map((item) => ({
          workItemId: item.workItemId,
          itemName: item.itemName ?? '',
          currentQuantity: toMoney(item.quantity),
          previousQuantity: toMoney(item.previousQuantity),
          cumulativeQuantity: toMoney(item.cumulativeQuantity),
          remainingQuantity: item.remainingQuantity ?? undefined,
          previousAmount: item.previousAmount != null ? toMoney(item.previousAmount) : null,
          currentAmount: item.currentAmount != null ? toMoney(item.currentAmount) : toMoney(item.totalPrice),
          cumulativeAmount: item.cumulativeAmount != null ? toMoney(item.cumulativeAmount) : null,
          unitPrice: item.unitPrice != null ? toMoney(item.unitPrice) : null,
          totalPrice: item.totalPrice != null ? toMoney(item.totalPrice) : null,
        })),
      });
    } catch (err) {
      setPreviewError(mapExtractContractError(err).message);
    }
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
      setOpenedExtractId(res.data?.id ?? null);
      setPreview(null);
      invalidateQuery(['extracts-list', 'detailed-items', projectId]);
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
        onSelect: (id) => setHighlightId(id),
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
              setOpenedExtractId(null);
              setCurrentQty({});
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
        <CompactFormField label="رقم المستخلص">
          <input
            value={extractNumber}
            onChange={(e) => setExtractNumber(e.target.value)}
            className={compactControlClass}
            placeholder="يُترك فارغاً للترقيم اليدوي لاحقاً"
          />
        </CompactFormField>
        <CompactFormField label="تاريخ المستخلص">
          <input
            type="date"
            value={extractDate}
            onChange={(e) => setExtractDate(e.target.value)}
            className={compactControlClass}
          />
        </CompactFormField>
        <CompactFormField label="البيان" className="sm:col-span-2">
          <input
            value={statement}
            onChange={(e) => setStatement(e.target.value)}
            className={compactControlClass}
            placeholder="بيان المستخلص"
          />
        </CompactFormField>
        <CompactFormField label="نوع المستخلص">
          <select
            value={statementType}
            onChange={(e) => setStatementType(e.target.value === 'final' ? 'final' : 'partial')}
            className={compactControlClass}
          >
            <option value="partial">جزئي</option>
            <option value="final">ختامي</option>
          </select>
        </CompactFormField>
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

      {projectId ? (
        <FormSectionCard title="مستخلصات محفوظة" subtitle="فتح مستخلص يعرض كمياته وأسعاره المحفوظة. الترحيل المحاسبي يبقى من شاشة المقاولات.">
          {savedExtracts.length === 0 ? (
            <p className="text-sm text-slate-500">لا توجد مستخلصات محفوظة لهذا المشروع.</p>
          ) : (
            <div className="flex flex-wrap gap-2 sm:col-span-2">
              {savedExtracts.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => void loadSavedExtract(row.id)}
                  className={`rounded-lg border px-3 py-1.5 text-sm ${
                    openedExtractId === row.id ? 'border-[#0E78AA] bg-[#F0F7FB]' : 'border-slate-200'
                  }`}
                >
                  {row.extractNumber || row.id.slice(0, 8)} — {toInputDate(row.extractDate)} —{' '}
                  {formatEgp(row.totalValue)}
                  {row.contractor?.arabicName ? ` — ${row.contractor.arabicName}` : ''}
                </button>
              ))}
            </div>
          )}
        </FormSectionCard>
      ) : null}

      {preview || saved ? (
        <FormSectionCard
          title="تسوية المستخلص"
          subtitle="نفس بيان شاشة المستخلص في البرنامج القديم. الأعمال من السيرفر، والخصومات من نسب إعدادات المقاول على أعمال الفترة. الترحيل المحاسبي يبقى من شاشة المقاولات."
        >
          {(() => {
            const settings = settingsRes?.data;
            const summary = legacyContractorStatementSummary({
              currentWorks: toMoney(preview?.totalValue ?? saved?.totalValue),
              previousWorks: toMoney(preview?.previousWorkTotal ?? saved?.previousWorkTotal),
              advancePercent: settings?.advancePaymentPercentage,
              insurancePercent: settings?.workInsurancePercentage,
              taxPercent: settings?.taxDeductionPercentage,
            });
            const rows = [
              ['إجمالي الأعمال المنفذة', summary.executedWorks],
              ['إجمالي الأعمال السابقة', summary.previousWorks],
              ['صافي أعمال الفترة', summary.currentWorks],
              ['خصم دفعة مقدمة', summary.advanceDeduction],
              ['خصم تأمين أعمال ابتدائي', summary.insuranceDeduction],
              ['خصم ضرائب', summary.taxDeduction],
              ['صافي المستحق للمستخلص الحالي', summary.netPayable],
            ] as const;
            return rows.map(([label, amount]) => (
              <CompactFormField key={label} label={label} readOnly value={formatEgp(amount)} />
            ));
          })()}
        </FormSectionCard>
      ) : null}

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
          { id: 'qty', header: 'الحصر', numeric: true, cell: (row) => (row.__isParent ? '—' : formatQty(row.quantity)) },
          {
            id: 'building',
            header: 'العمارة',
            cell: (row) => row.building?.unitNumber || row.building?.arabicName || '—',
          },
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
            header: 'الفئة',
            numeric: true,
            cell: (row) => {
              if (row.__isParent) return '—';
              const priced = previewByWorkItem.get(row.id)?.unitPrice ?? row.unitPrice;
              return priced == null ? '—' : formatEgp(priced);
            },
          },
          {
            id: 'prevPct',
            header: 'النسبة السابقة',
            numeric: true,
            cell: (row) =>
              row.__isParent
                ? '—'
                : qtyPercent(toMoney(previewByWorkItem.get(row.id)?.previousQuantity), toMoney(row.quantity)),
          },
          {
            id: 'currentPct',
            header: 'النسبة الحالية',
            numeric: true,
            cell: (row) => {
              if (row.__isParent) return '—';
              const current = previewByWorkItem.get(row.id)?.currentQuantity ?? currentQty[row.id];
              return qtyPercent(toMoney(current), toMoney(row.quantity));
            },
          },
          {
            id: 'totalPct',
            header: 'النسبة الإجمالية',
            numeric: true,
            cell: (row) =>
              row.__isParent
                ? '—'
                : qtyPercent(toMoney(previewByWorkItem.get(row.id)?.cumulativeQuantity), toMoney(row.quantity)),
          },
          {
            id: 'periodAmount',
            header: 'قيمة الفترة',
            numeric: true,
            cell: (row) => {
              const line = previewByWorkItem.get(row.id);
              return row.__isParent || !line ? '—' : formatEgp(line.currentAmount);
            },
          },
          {
            id: 'cumulativeAmount',
            header: 'قيمة التراكمي',
            numeric: true,
            cell: (row) => {
              const line = previewByWorkItem.get(row.id);
              return row.__isParent || !line ? '—' : formatEgp(line.cumulativeAmount);
            },
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
        rowClassName={(row) =>
          highlightId === row.id ? 'bg-amber-50' : row.__isParent ? 'bg-[#EEF6FA]' : undefined
        }
      />
    </ExtractsPageChrome>
  );
}
