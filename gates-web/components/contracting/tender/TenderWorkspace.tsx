'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { ChevronDown, ChevronLeft, Plus } from 'lucide-react';
import { ExtractsPageChrome } from '@/components/extracts/ExtractsPageChrome';
import { ErpFormHeaderCard, erpInputClass, erpLabelClass, type ErpHeaderMenuItem } from '@/components/erp';
import type { GenericRecordRow } from '@/components/erp/GenericRecordsList';
import { Button } from '@/components/ui/button';
import { dateControlClass } from '@/app/components/ui/forms/formTokens';
import {
  dataEntryGridBodyCellClass,
  dataEntryGridHeadCellClass,
  dataEntryGridHeadRowClass,
  dataEntryGridInputClass,
  dataEntryGridNumericInputClass,
  dataEntryGridWrapClass,
} from '@/components/ui/data-entry-grid/tokens';
import { apiClient } from '@/lib/api/client';
import { useApiMutation, useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';
import {
  boqHeaderRoleLabel,
  canEnterBoqLineQuantity,
  isHierarchicalRowVisible,
  withItemCodeHierarchy,
} from '@/lib/contracting/boq-hierarchy';
import { commitTenderBoqRows, previewTenderBoqExcel, type TenderExcelPreview } from '@/lib/contracting/tender-excel-transfer';
import { formatEgp, formatQty } from '@/lib/subcontracts/money';
import { confirmAction } from '@/lib/feedback/confirm';
import { toast } from '@/lib/feedback/toast';
import { cn } from '@/lib/utils';
import {
  BOQ_UNITS,
  CATALOG_KIND_AR,
  CATALOG_KINDS,
  COST_ELEMENT_AR,
  isQuotationHeaderItem,
  isTenderHeaderKind,
  QUOTATION_STATUS_AR,
  TENDER_STATUS_AR,
  tenderIsLocked,
} from './tender-labels';
import { TenderWorkItemCatalogPicker } from './TenderWorkItemCatalogPicker';
import { TenderRateAnalysisPanel } from './TenderRateAnalysisPanel';
import { TenderSalesStudyPanel } from './TenderSalesStudyPanel';

type TabId =
  | 'header'
  | 'boq'
  | 'analysis'
  | 'pricing'
  | 'summary'
  | 'quotations'
  | 'award'
  | 'history';

type TenderBoqItem = {
  id: string;
  itemCode: string;
  descriptionAr: string;
  unit: string;
  quantity: string;
  sectionName: string | null;
  kind: string | null;
  isExecutable?: boolean;
  clientSuppliedRate: string | null;
  notes: string | null;
  directUnitCost: string;
  sellingUnitRate: string;
  markupRate: string;
  pricingMethod: string;
  rateAnalysisItems: Array<{
    id: string;
    costElementType: string;
    resourceCode?: string | null;
    descriptionAr: string;
    unit: string;
    consumptionQuotaPerUnit: string;
    unitCost: string;
    wasteFactorRate?: string;
    totalCostPerUnit: string;
    notes?: string | null;
  }>;
};

type TenderDetail = {
  id: string;
  tenderNumber: string;
  nameAr: string;
  description: string | null;
  status: string;
  currencyCode: string;
  issueDate: string | null;
  submissionDeadline: string | null;
  expectedStart: string | null;
  expectedEnd: string | null;
  location: string | null;
  consultantName: string | null;
  projectManagerName: string | null;
  fundingSource: string | null;
  delayPenaltyRate: string | null;
  contractDurationDays: number | null;
  generalOverheadRate: string;
  siteOverheadRate: string;
  contingencyRiskRate: string;
  profitMarginRate?: string;
  contractTaxesRate?: string;
  defaultMarkupRate: string;
  createdAt: string;
  lostReason: string | null;
  competitorName: string | null;
  lostNotes: string | null;
  customer: { id: string; arabicName: string };
  boqItems: TenderBoqItem[];
  quotations: QuotationRow[];
  award: {
    awardedAt: string;
    project: { id: string; projectCode: string; projectName: string };
    clientContract: { id: string; contractNumber: string };
    quotation: { quotationNumber: string; revisionNumber: number };
  } | null;
};

type QuotationRow = {
  id: string;
  quotationNumber: string;
  revisionNumber: number;
  status: string;
  validUntil: string | null;
  subtotalSelling: string;
  discountAmount: string;
  taxAmount: string;
  grandTotal: string;
  expectedMarginPercent: string | null;
  submittedAt: string | null;
  acceptedAt: string | null;
  createdAt: string;
  quoteDate: string | null;
  paymentTerms: string | null;
  deliveryTerms: string | null;
  notes: string | null;
  lines: Array<{
    id: string;
    tenderBoqItemId: string;
    itemCodeSnapshot: string;
    descriptionArSnapshot: string;
    unitSnapshot: string;
    quantitySnapshot: string;
    sellingUnitRateSnapshot: string;
    lineAmountSnapshot: string;
  }>;
};

type PricingSummary = {
  byCategory: Record<string, number>;
  directCost: number;
  overhead: number;
  risk: number;
  expectedCost: number;
  sellingValue: number;
  directProfit: number;
  directMarginPercent: number | null;
  fullyLoadedExpectedProfit: number;
  fullyLoadedExpectedMarginPercent: number | null;
  studySellingValue?: number;
  studyProfit?: number;
  rates?: {
    generalOverheadRate: number;
    siteOverheadRate: number;
    contingencyRiskRate: number;
    profitMarginRate: number;
    contractTaxesRate: number;
  };
  currencyCode: string;
  lines: Array<{
    tenderBoqItemId: string;
    itemCode: string;
    quantity?: number;
    directUnitCost: number;
    sellingUnitRate: number;
    directTotal?: number;
    sellingTotal?: number;
    profit?: number;
    marginPercent: number | null;
    markupPercent?: number;
  }>;
};

const TABS: { id: TabId; label: string }[] = [
  { id: 'header', label: 'بيانات العطاء' },
  { id: 'boq', label: 'جدول الكميات' },
  { id: 'analysis', label: 'تحليل الأسعار' },
  { id: 'pricing', label: 'دراسة البيع' },
  { id: 'summary', label: 'ملخص الدراسة' },
  { id: 'quotations', label: 'عروض الأسعار' },
  { id: 'award', label: 'الترسية' },
  { id: 'history', label: 'السجل' },
];

export function TenderWorkspace({ tenderId }: { tenderId: string }) {
  const router = useRouter();
  const excelInputRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<TabId>('header');
  const [selectedBoqId, setSelectedBoqId] = useState<string | null>(null);
  const [selectedQtnId, setSelectedQtnId] = useState<string | null>(null);
  const [excelPreview, setExcelPreview] = useState<TenderExcelPreview | null>(null);
  const [catalogPickerOpen, setCatalogPickerOpen] = useState(false);
  const [quoteDateInput, setQuoteDateInput] = useState(() => new Date().toISOString().slice(0, 10));
  const [expandedBoqCodes, setExpandedBoqCodes] = useState<Set<string>>(() => new Set());
  const [awardOpen, setAwardOpen] = useState(false);
  const [awardResult, setAwardResult] = useState<{
    projectId: string;
    projectCode: string;
    contractId: string;
    contractNumber: string;
  } | null>(null);
  const idempotencyRef = useRef<string | null>(null);
  const invalidate = useInvalidateQuery();

  const refreshAll = () => {
    invalidate(['tender', tenderId]);
    invalidate(['tender-pricing', tenderId]);
    invalidate(['tender-quotations', tenderId]);
    invalidate(['tender-integrity', tenderId]);
  };

  const tenderQ = useApiQuery<TenderDetail>(['tender', tenderId], `/contracting/tenders/${tenderId}`);
  const summaryQ = useApiQuery<PricingSummary>(
    ['tender-pricing', tenderId],
    `/contracting/tenders/${tenderId}/pricing/summary`
  );
  const integrityQ = useApiQuery<{ ok: boolean; rows: Array<{ status: string; reason: string }> }>(
    ['tender-integrity', tenderId],
    `/contracting/tenders/${tenderId}/integrity`
  );
  const t = tenderQ.data?.data;
  const sum = summaryQ.data?.data;
  const locked = t ? tenderIsLocked(t.status) : true;
  const acceptedQtn = t?.quotations.find((q) => q.status === 'ACCEPTED');

  const patchTender = useApiMutation<unknown, Record<string, unknown>>(
    `/contracting/tenders/${tenderId}`,
    'PATCH',
    { onSuccess: refreshAll }
  );
  const addBoq = useApiMutation<unknown, Record<string, unknown>>(`/contracting/tenders/${tenderId}/boq`, 'POST', {
    onSuccess: refreshAll,
  });
  const addFromCatalog = useApiMutation<unknown, { catalogIds: string[] }>(
    `/contracting/tenders/${tenderId}/boq/from-catalog`,
    'POST',
    {
      onSuccess: () => {
        setCatalogPickerOpen(false);
        refreshAll();
      },
    }
  );
  const pushBoqToCatalog = useApiMutation<{ created: number; skipped: number }, Record<string, never>>(
    `/contracting/tenders/${tenderId}/boq/to-catalog`,
    'POST',
    {
      showSuccessToast: false,
      onSuccess: (res) => {
        const created = res.data?.created ?? 0;
        const skipped = res.data?.skipped ?? 0;
        if (created && skipped) {
          toast.success(`تم حفظ ${created} بند جديد في الدليل — وتخطي ${skipped} موجود مسبقاً`);
        } else if (created) {
          toast.success(`تم حفظ ${created} بند في دليل بنود الأعمال`);
        } else {
          toast.success('كل البنود موجودة بالفعل في دليل بنود الأعمال');
        }
        invalidate(['contracting-item-catalog']);
      },
    }
  );
  const removeBoqLine = useMutation({
    mutationFn: (lineId: string) => apiClient.delete(`/contracting/tenders/boq/${lineId}`),
    onSuccess: () => refreshAll(),
  });
  const createQtn = useApiMutation<{ id: string }, Record<string, unknown>>(
    `/contracting/tenders/${tenderId}/quotations`,
    'POST',
    { onSuccess: refreshAll }
  );
  const qtnAction = useMutation({
    mutationFn: async (input: { quotationId: string; action: 'submit' | 'accept' | 'reject' | 'patch'; body?: Record<string, unknown> }) => {
      const base = `/contracting/tenders/quotations/${input.quotationId}`;
      if (input.action === 'submit') return apiClient.post(`${base}/submit`, {});
      if (input.action === 'accept') return apiClient.post(`${base}/accept`, {});
      if (input.action === 'reject') return apiClient.post(`${base}/reject`, {});
      return apiClient.patch(base, input.body ?? {});
    },
    onSuccess: () => refreshAll(),
  });
  const patchQtnLineRate = useMutation({
    mutationFn: (input: { quotationId: string; tenderBoqItemId: string; sellingUnitRate: number }) =>
      apiClient.post(`/contracting/tenders/quotations/${input.quotationId}/line-rate`, input),
    onSuccess: () => refreshAll(),
  });
  const markLost = useApiMutation<unknown, Record<string, unknown>>(
    `/contracting/tenders/${tenderId}/lost`,
    'POST',
    { onSuccess: refreshAll }
  );
  const awardMut = useApiMutation<
    { project: { id: string; projectCode: string }; clientContract: { id: string; contractNumber: string } },
    { quotationId: string; idempotencyKey: string }
  >(`/contracting/tenders/${tenderId}/award`, 'POST', {
    onSuccess: (res) => {
      const payload = res.data;
      if (payload?.project && payload?.clientContract) {
        setAwardResult({
          projectId: payload.project.id,
          projectCode: payload.project.projectCode,
          contractId: payload.clientContract.id,
          contractNumber: payload.clientContract.contractNumber,
        });
      }
      setAwardOpen(false);
      refreshAll();
    },
  });

  const excelMut = useMutation({
    mutationFn: async (file: File) => previewTenderBoqExcel(tenderId, file),
    onSuccess: setExcelPreview,
  });
  const excelCommit = useMutation({
    mutationFn: async () => {
      const rows = (excelPreview?.rows ?? []).filter((r) => r.isValid && r.data).map((r) => r.data!);
      if (!rows.length) throw new Error('لا توجد سطور صالحة للاستيراد');
      return commitTenderBoqRows(tenderId, rows);
    },
    onSuccess: () => {
      setExcelPreview(null);
      refreshAll();
    },
  });

  const selectedBoq = useMemo(
    () => t?.boqItems.find((b) => b.id === selectedBoqId) ?? t?.boqItems[0],
    [t, selectedBoqId]
  );
  const boqTree = useMemo(
    () => withItemCodeHierarchy(t?.boqItems ?? [], (b) => b.itemCode),
    [t?.boqItems]
  );
  const visibleBoqRows = useMemo(
    () => boqTree.filter((row) => isHierarchicalRowVisible(row.itemCode, expandedBoqCodes)),
    [boqTree, expandedBoqCodes]
  );
  const boqChildCodes = useMemo(() => {
    const codes = boqTree.map((row) => row.itemCode);
    return (code: string) => codes.some((other) => other.startsWith(`${code}.`));
  }, [boqTree]);
  const toggleBoqExpand = (code: string) => {
    setExpandedBoqCodes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };
  const selectedQtn = useMemo(
    () => t?.quotations.find((q) => q.id === selectedQtnId) ?? null,
    [t, selectedQtnId]
  );
  const selectedQtnHeaderRows = useMemo(() => {
    if (!t) return [];
    const byId = new Map(t.boqItems.map((item) => [item.id, item]));
    if (selectedQtn?.lines.length) {
      return selectedQtn.lines
        .map((line) => ({ line, boq: byId.get(line.tenderBoqItemId) ?? null }))
        .filter((row) => isQuotationHeaderItem(row.boq?.kind, row.boq?.isExecutable));
    }
    if (!selectedQtn) return [];
    return t.boqItems
      .filter((item) => isQuotationHeaderItem(item.kind, item.isExecutable))
      .map((boq) => ({ line: null as QuotationRow['lines'][number] | null, boq }));
  }, [selectedQtn, t]);

  const [headerForm, setHeaderForm] = useState({
    nameAr: '',
    description: '',
    currencyCode: 'EGP',
    issueDate: '',
    expectedStart: '',
    expectedEnd: '',
    location: '',
    consultantName: '',
    projectManagerName: '',
    fundingSource: '',
    delayPenaltyRate: '',
    contractDurationDays: '',
  });
  useEffect(() => {
    if (!t?.nameAr) return;
    setHeaderForm({
      nameAr: t.nameAr,
      description: t.description ?? '',
      currencyCode: t.currencyCode,
      issueDate: t.issueDate?.slice(0, 10) ?? t.createdAt.slice(0, 10),
      expectedStart: t.expectedStart?.slice(0, 10) ?? '',
      expectedEnd: t.expectedEnd?.slice(0, 10) ?? '',
      location: t.location ?? '',
      consultantName: t.consultantName ?? '',
      projectManagerName: t.projectManagerName ?? '',
      fundingSource: t.fundingSource ?? '',
      delayPenaltyRate: t.delayPenaltyRate != null ? String(t.delayPenaltyRate) : '',
      contractDurationDays: t.contractDurationDays != null ? String(t.contractDurationDays) : '',
    });
  }, [
    t?.id,
    t?.nameAr,
    t?.description,
    t?.currencyCode,
    t?.issueDate,
    t?.createdAt,
    t?.expectedStart,
    t?.expectedEnd,
    t?.location,
    t?.consultantName,
    t?.projectManagerName,
    t?.fundingSource,
    t?.delayPenaltyRate,
    t?.contractDurationDays,
  ]);

  const [boqForm, setBoqForm] = useState({
    itemCode: '',
    descriptionAr: '',
    unit: 'M3' as string,
    quantity: '',
    sectionName: '',
    kind: 'EXECUTABLE',
    notes: '',
  });

  const readiness = useMemo(() => {
    const blockers = integrityQ.data?.data?.rows.filter((r) => r.status !== 'MATCH') ?? [];
    return {
      accepted: Boolean(acceptedQtn),
      customer: Boolean(t?.customer),
      boq: (t?.boqItems.length ?? 0) > 0,
      integrityOk: integrityQ.data?.data?.ok !== false && blockers.length === 0,
      blockers,
    };
  }, [acceptedQtn, t, integrityQ.data]);

  const moreMenuItems: ErpHeaderMenuItem[] = [
    ...(!locked && t && t.status !== 'LOST'
      ? [
          {
            id: 'lost',
            label: 'اعتبار غير فائز',
            destructive: true,
            onClick: () => {
              const lostReason = window.prompt('سبب الخسارة') ?? '';
              markLost.mutate({ lostReason, competitorName: window.prompt('المنافس') ?? undefined });
            },
          },
        ]
      : []),
    { id: 'print', label: 'طباعة', onClick: () => window.print() },
    ...(!locked
      ? [
          {
            id: 'excel',
            label: 'استيراد Excel',
            onClick: () => excelInputRef.current?.click(),
          },
        ]
      : []),
  ];

  const chrome = {
    title: t?.nameAr ?? 'العطاء',
    docNumber: t?.tenderNumber,
    statusLabel: t ? (TENDER_STATUS_AR[t.status] ?? t.status) : undefined,
    breadcrumbs: [
      { href: '/extracts', label: 'المستخلصات' },
      { href: '/contracting', label: 'المقاولات' },
      { href: '/contracting/tenders', label: 'العطاءات' },
      { label: t?.tenderNumber ?? '…' },
    ],
    favoriteHref: `/contracting/tenders/${tenderId}`,
    currentId: tenderId,
    onNew: () => router.push('/contracting/tenders/new'),
    hideSave: locked,
    onSave: locked ? undefined : () => patchTender.mutate(headerForm),
    savePending: patchTender.isPending,
    canSave: !locked && Boolean(headerForm.nameAr.trim()),
    moreMenuItems,
    browseList: {
      title: 'العطاءات',
      apiPath: '/contracting/tenders',
      listKey: 'contracting-tenders-browse',
      columns: [
        { id: 'num', header: 'الرقم', getValue: (row: GenericRecordRow) => String(row.tenderNumber ?? '') },
        { id: 'name', header: 'الاسم', getValue: (row: GenericRecordRow) => String(row.nameAr ?? '') },
        {
          id: 'status',
          header: 'الحالة',
          getValue: (row: GenericRecordRow) => TENDER_STATUS_AR[String(row.status ?? '')] ?? String(row.status ?? ''),
        },
      ],
      selectedId: tenderId,
      onSelect: (id: string) => router.push(`/contracting/tenders/${id}`),
    },
  };

  if (awardResult) {
    return (
      <ExtractsPageChrome {...chrome} hideSave statusLabel="مرسّى">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 space-y-4">
          <h2 className="text-xl font-bold text-emerald-900">تمت الترسية بنجاح</h2>
          <p className="text-sm">تم إنشاء العقد والمشروع وجدول كميات من العرض المعتمد.</p>
          <div className="flex flex-wrap gap-3">
            <Link className="rounded-lg bg-brand px-4 py-2 text-white text-sm" href={`/contracting/projects/${awardResult.projectId}`}>
              فتح المشروع ({awardResult.projectCode})
            </Link>
            <Link className="rounded-lg border px-4 py-2 text-sm" href={`/contracting/projects/${awardResult.projectId}/client-billing`}>
              فتح العقد ({awardResult.contractNumber})
            </Link>
            <Link className="rounded-lg border px-4 py-2 text-sm" href={`/contracting/projects/${awardResult.projectId}/technical-office`}>
              جدول كميات المشروع
            </Link>
            <Link className="rounded-lg border px-4 py-2 text-sm" href={`/contracting/projects/${awardResult.projectId}/profitability`}>
              مراقبة وربحية المشروع
            </Link>
            <Link className="rounded-lg border px-4 py-2 text-sm" href={`/contracting/projects/${awardResult.projectId}/execution-plan`}>
              مخطط التنفيذ
            </Link>
          </div>
        </div>
      </ExtractsPageChrome>
    );
  }

  return (
    <ExtractsPageChrome {...chrome}>
      <input
        ref={excelInputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) {
            excelMut.mutate(f);
            setTab('boq');
          }
          e.target.value = '';
        }}
      />

      {t && (
        <p className="mb-2 text-sm text-muted-foreground">
          المالك: {t.customer.arabicName} — الاستشاري: {t.consultantName || '—'} — العملة: {t.currencyCode} — الإنشاء: {t.createdAt.slice(0, 10)}
        </p>
      )}

      {t?.award && (
        <div className="rounded-xl border bg-emerald-50 p-3 text-sm flex flex-wrap gap-3 items-center">
          <span className="font-bold">روابط ما بعد الترسية</span>
          <Link className="text-brand underline" href={`/contracting/projects/${t.award.project.id}`}>
            المشروع {t.award.project.projectCode}
          </Link>
          <Link className="text-brand underline" href={`/contracting/projects/${t.award.project.id}/client-billing`}>
            العقد {t.award.clientContract.contractNumber}
          </Link>
        </div>
      )}

      {t?.award && (
        <div className="rounded-xl border bg-[#F6FBFD] p-3 text-sm">
          <div className="font-bold mb-1">سلسلة الترسية</div>
          {t.tenderNumber} → {t.award.quotation.quotationNumber} Rev {t.award.quotation.revisionNumber} →{' '}
          {t.award.clientContract.contractNumber} → {t.award.project.projectCode}
        </div>
      )}

      {!locked && acceptedQtn && !t?.award && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm">
            <div className="font-bold">جاهز للترسية</div>
            <div>عرض معتمد: {acceptedQtn.quotationNumber} Rev {acceptedQtn.revisionNumber}</div>
            {!readiness.integrityOk &&
              readiness.blockers.map((b, i) => (
                <div key={i} className="text-red-700 text-xs">
                  {b.status}: {b.reason}
                </div>
              ))}
          </div>
          <button
            type="button"
            disabled={!readiness.accepted || !readiness.boq || !readiness.integrityOk}
            className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
            onClick={() => setAwardOpen(true)}
          >
            ترسية العطاء
          </button>
        </div>
      )}

      <nav className="mb-3 flex flex-wrap items-center gap-1.5 border-b border-[#E8F1F6] bg-white p-2 rounded-xl">
        {TABS.map((x) => (
          <button
            key={x.id}
            type="button"
            onClick={() => setTab(x.id)}
            className={cn(
              'rounded-full px-3 py-1.5 text-xs sm:text-sm transition-colors',
              tab === x.id ? 'bg-[#0E78AA] text-white font-semibold shadow-sm' : 'text-slate-600 hover:bg-[#F6FBFD] hover:text-slate-900'
            )}
          >
            {x.label}
          </button>
        ))}
      </nav>

      {tab === 'header' && t && (
        <ErpFormHeaderCard
          fieldsDisabled={locked}
          row1={
            <>
              <div>
                <label className={erpLabelClass}>رقم العطاء</label>
                <input className={erpInputClass} value={t.tenderNumber} readOnly />
              </div>
              <div>
                <label className={erpLabelClass}>تاريخ التحرير</label>
                <input type="date" className={cn(erpInputClass, dateControlClass)} value={headerForm.issueDate} onChange={(e) => setHeaderForm({ ...headerForm, issueDate: e.target.value })} readOnly={locked} />
              </div>
              <div>
                <label className={erpLabelClass}>المالك / العميل</label>
                <input className={erpInputClass} value={t.customer.arabicName} readOnly />
              </div>
              <div>
                <label className={erpLabelClass}>اسم العطاء</label>
                <input className={erpInputClass} value={headerForm.nameAr} onChange={(e) => setHeaderForm({ ...headerForm, nameAr: e.target.value })} readOnly={locked} />
              </div>
            </>
          }
          row2={
            <>
              <div>
                <label className={erpLabelClass}>الاستشاري</label>
                <input className={erpInputClass} value={headerForm.consultantName} onChange={(e) => setHeaderForm({ ...headerForm, consultantName: e.target.value })} readOnly={locked} />
              </div>
              <div>
                <label className={erpLabelClass}>مدير المشروع</label>
                <input className={erpInputClass} value={headerForm.projectManagerName} onChange={(e) => setHeaderForm({ ...headerForm, projectManagerName: e.target.value })} readOnly={locked} />
              </div>
              <div>
                <label className={erpLabelClass}>مصدر التمويل</label>
                <input className={erpInputClass} value={headerForm.fundingSource} onChange={(e) => setHeaderForm({ ...headerForm, fundingSource: e.target.value })} readOnly={locked} />
              </div>
              <div>
                <label className={erpLabelClass}>موقع المشروع</label>
                <input className={erpInputClass} value={headerForm.location} onChange={(e) => setHeaderForm({ ...headerForm, location: e.target.value })} readOnly={locked} />
              </div>
            </>
          }
          extras={
            <div className="grid gap-3 sm:grid-cols-4">
              <div>
                <label className={erpLabelClass}>العملة</label>
                <input className={erpInputClass} value={headerForm.currencyCode} onChange={(e) => setHeaderForm({ ...headerForm, currencyCode: e.target.value })} readOnly={locked} />
              </div>
              <div>
                <label className={erpLabelClass}>بداية المشروع</label>
                <input type="date" className={cn(erpInputClass, dateControlClass)} value={headerForm.expectedStart} onChange={(e) => setHeaderForm({ ...headerForm, expectedStart: e.target.value })} readOnly={locked} />
              </div>
              <div>
                <label className={erpLabelClass}>نهاية المشروع</label>
                <input type="date" className={cn(erpInputClass, dateControlClass)} value={headerForm.expectedEnd} onChange={(e) => setHeaderForm({ ...headerForm, expectedEnd: e.target.value })} readOnly={locked} />
              </div>
              <div>
                <label className={erpLabelClass}>مدة العقد (يوم)</label>
                <input type="number" className={erpInputClass} value={headerForm.contractDurationDays} onChange={(e) => setHeaderForm({ ...headerForm, contractDurationDays: e.target.value })} readOnly={locked} />
              </div>
              <div>
                <label className={erpLabelClass}>غرامة التأخير (0.01 = 1%)</label>
                <input type="number" step="0.0001" className={erpInputClass} value={headerForm.delayPenaltyRate} onChange={(e) => setHeaderForm({ ...headerForm, delayPenaltyRate: e.target.value })} readOnly={locked} />
              </div>
              <div className="sm:col-span-4">
                <label className={erpLabelClass}>ملاحظات / وصف</label>
                <textarea className={cn(erpInputClass, 'h-auto min-h-[72px] py-2')} rows={3} value={headerForm.description} onChange={(e) => setHeaderForm({ ...headerForm, description: e.target.value })} readOnly={locked} />
              </div>
            </div>
          }
          extrasLabel="تواريخ العقد والملاحظات"
        />
      )}

      {tab === 'boq' && t && (
        <section className="space-y-3">
          {!locked ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" onClick={() => setCatalogPickerOpen(true)}>
                بنود الأعمال
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={!t.boqItems.length || pushBoqToCatalog.isPending}
                onClick={() => {
                  void (async () => {
                    if (
                      !(await confirmAction({
                        title: 'ترحيل لدليل بنود الأعمال',
                        message:
                          'هيتضاف للدليل البنود اللي مش موجودة هناك بنفس الاسم. اللي موجود مسبقاً هيتتخطى.',
                        confirmLabel: 'ترحيل',
                        tone: 'info',
                      }))
                    ) {
                      return;
                    }
                    pushBoqToCatalog.mutate({});
                  })();
                }}
              >
                {pushBoqToCatalog.isPending ? 'جاري الترحيل…' : 'ترحيل لدليل بنود الأعمال'}
              </Button>
            </div>
          ) : null}
          {excelPreview && (
            <div className="rounded-xl border bg-white p-4 space-y-2">
              <div className="font-bold">معاينة الاستيراد</div>
              <p className="text-xs">صالح: {excelPreview.validRowsCount} — غير صالح: {excelPreview.invalidRowsCount}</p>
              <div className="max-h-48 overflow-auto text-xs">
                {excelPreview.rows.map((r) => (
                  <div key={r.rowNumber} className={r.isValid ? '' : 'text-red-600'}>
                    سطر {r.rowNumber}: {r.isValid ? r.data?.itemCode : r.errors.join(' — ')}
                  </div>
                ))}
              </div>
              <Button type="button" size="sm" disabled={excelPreview.validRowsCount === 0} onClick={() => excelCommit.mutate()}>
                تأكيد الاستيراد
              </Button>
            </div>
          )}
          <div className={dataEntryGridWrapClass}>
            <table className="min-w-full text-sm">
              <thead className={dataEntryGridHeadRowClass}>
                <tr>
                  <th className={dataEntryGridHeadCellClass}>الكود</th>
                  <th className={dataEntryGridHeadCellClass}>النوع</th>
                  <th className={dataEntryGridHeadCellClass}>البند</th>
                  <th className={dataEntryGridHeadCellClass}>الوحدة</th>
                  <th className={dataEntryGridHeadCellClass}>الكمية</th>
                  <th className={dataEntryGridHeadCellClass}>ملاحظات</th>
                  {!locked && <th className={dataEntryGridHeadCellClass} />}
                </tr>
              </thead>
              <tbody>
                <tr className="bg-[#0E78AA] text-white">
                  <td className={cn(dataEntryGridBodyCellClass, 'font-semibold')} colSpan={locked ? 6 : 7}>
                    {t.nameAr}
                  </td>
                </tr>
                {visibleBoqRows.map((b) => {
                  const qty = Number(b.quantity);
                  const header =
                    b.__isParent || b.isExecutable === false || isTenderHeaderKind(b.kind);
                  const headerLabel = boqHeaderRoleLabel(header, b.__depth);
                  const hasKids = b.__isParent || boqChildCodes(b.itemCode);
                  const expanded = expandedBoqCodes.has(b.itemCode);
                  const saveLine = (patch: Partial<TenderBoqItem> & { quantity?: string; unit?: string }) =>
                    addBoq.mutate({
                      lineId: b.id,
                      itemCode: patch.itemCode ?? b.itemCode,
                      descriptionAr: patch.descriptionAr ?? b.descriptionAr,
                      unit: patch.unit ?? b.unit,
                      quantity: Number(patch.quantity ?? b.quantity),
                      kind: patch.kind ?? b.kind,
                      notes: patch.notes ?? b.notes,
                      sectionName: b.sectionName,
                      isExecutable: !isTenderHeaderKind(patch.kind ?? b.kind),
                    });
                  return (
                    <tr
                      key={b.id}
                      className={`cursor-pointer ${header ? 'bg-[#EEF6FA]' : ''} ${selectedBoqId === b.id ? 'outline outline-1 outline-brand' : ''}`}
                      onClick={() => setSelectedBoqId(b.id)}
                    >
                      <td className={dataEntryGridBodyCellClass} style={{ paddingInlineStart: 8 + b.__depth * 14 }}>
                        <div className="flex items-center gap-1">
                          {hasKids ? (
                            <button
                              type="button"
                              className="shrink-0 rounded p-0.5 text-[#0E78AA] hover:bg-white"
                              aria-label={expanded ? 'طي' : 'توسيع'}
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleBoqExpand(b.itemCode);
                              }}
                            >
                              {expanded ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronLeft className="h-4 w-4" />
                              )}
                            </button>
                          ) : (
                            <span className="inline-block w-5" aria-hidden />
                          )}
                          {locked ? (
                            <span className="font-mono">{b.itemCode}</span>
                          ) : (
                            <input
                              className={cn(dataEntryGridInputClass, 'font-mono')}
                              defaultValue={b.itemCode}
                              onClick={(e) => e.stopPropagation()}
                              onBlur={(e) => {
                                const v = e.target.value.trim();
                                if (v && v !== b.itemCode) saveLine({ itemCode: v });
                              }}
                            />
                          )}
                          {headerLabel ? (
                            <span className="mr-1 text-[10px] text-[#0E78AA]"> {headerLabel}</span>
                          ) : null}
                        </div>
                      </td>
                      <td className={dataEntryGridBodyCellClass}>
                        {locked ? (
                          CATALOG_KIND_AR[b.kind ?? ''] ?? (header ? 'رئيسي' : 'تنفيذي')
                        ) : (
                          <select
                            className={dataEntryGridInputClass}
                            defaultValue={b.kind ?? (header ? 'OFFICIAL' : 'EXECUTABLE')}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => saveLine({ kind: e.target.value })}
                          >
                            {CATALOG_KINDS.map((k) => (
                              <option key={k} value={k}>{CATALOG_KIND_AR[k]}</option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td className={dataEntryGridBodyCellClass}>
                        {locked ? (
                          b.descriptionAr
                        ) : (
                          <input
                            className={dataEntryGridInputClass}
                            defaultValue={b.descriptionAr}
                            onClick={(e) => e.stopPropagation()}
                            onBlur={(e) => {
                              const v = e.target.value.trim();
                              if (v && v !== b.descriptionAr) saveLine({ descriptionAr: v });
                            }}
                          />
                        )}
                      </td>
                      <td className={dataEntryGridBodyCellClass}>
                        {locked ? (
                          b.unit
                        ) : (
                          <select
                            className={dataEntryGridInputClass}
                            defaultValue={b.unit}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => {
                              if (e.target.value !== b.unit) saveLine({ unit: e.target.value });
                            }}
                          >
                            {BOQ_UNITS.map((u) => (
                              <option key={u} value={u}>{u}</option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td className={dataEntryGridBodyCellClass}>
                        {!canEnterBoqLineQuantity(header) ? (
                          '—'
                        ) : locked ? (
                          formatQty(qty)
                        ) : (
                          <input
                            type="number"
                            className={dataEntryGridNumericInputClass}
                            defaultValue={qty}
                            onClick={(e) => e.stopPropagation()}
                            onBlur={(e) => {
                              const n = Number(e.target.value);
                              if (Number.isFinite(n) && n !== qty) saveLine({ quantity: String(n) });
                            }}
                          />
                        )}
                      </td>
                      <td className={dataEntryGridBodyCellClass}>
                        {locked ? (
                          b.notes || '—'
                        ) : (
                          <input
                            className={dataEntryGridInputClass}
                            defaultValue={b.notes ?? ''}
                            placeholder="ملاحظات"
                            onClick={(e) => e.stopPropagation()}
                            onBlur={(e) => {
                              if (e.target.value !== (b.notes ?? '')) saveLine({ notes: e.target.value });
                            }}
                          />
                        )}
                      </td>
                      {!locked && (
                        <td className={dataEntryGridBodyCellClass}>
                          <button
                            type="button"
                            className="text-red-600 text-xs disabled:opacity-40"
                            disabled={removeBoqLine.isPending}
                            onClick={(e) => {
                              e.stopPropagation();
                              removeBoqLine.mutate(b.id);
                            }}
                          >
                            حذف
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
                {!locked ? (
                  <tr className="bg-[#F6FBFD]">
                    <td className={dataEntryGridBodyCellClass}>
                      <input className={cn(dataEntryGridInputClass, 'font-mono')} placeholder="1 / 1.1" value={boqForm.itemCode} onChange={(e) => setBoqForm({ ...boqForm, itemCode: e.target.value })} />
                    </td>
                    <td className={dataEntryGridBodyCellClass}>
                      <select className={dataEntryGridInputClass} value={boqForm.kind} onChange={(e) => setBoqForm({ ...boqForm, kind: e.target.value })}>
                        {CATALOG_KINDS.map((k) => (
                          <option key={k} value={k}>{CATALOG_KIND_AR[k]}</option>
                        ))}
                      </select>
                    </td>
                    <td className={dataEntryGridBodyCellClass}>
                      <input className={dataEntryGridInputClass} placeholder="البيان" value={boqForm.descriptionAr} onChange={(e) => setBoqForm({ ...boqForm, descriptionAr: e.target.value })} />
                    </td>
                    <td className={dataEntryGridBodyCellClass}>
                      <select className={dataEntryGridInputClass} value={boqForm.unit} onChange={(e) => setBoqForm({ ...boqForm, unit: e.target.value })}>
                        {BOQ_UNITS.map((u) => (
                          <option key={u} value={u}>{u}</option>
                        ))}
                      </select>
                    </td>
                    <td className={dataEntryGridBodyCellClass}>
                      <input type="number" className={dataEntryGridNumericInputClass} placeholder="كمية" value={boqForm.quantity} onChange={(e) => setBoqForm({ ...boqForm, quantity: e.target.value })} />
                    </td>
                    <td className={dataEntryGridBodyCellClass}>
                      <input className={dataEntryGridInputClass} placeholder="ملاحظات" value={boqForm.notes} onChange={(e) => setBoqForm({ ...boqForm, notes: e.target.value })} />
                    </td>
                    <td className={dataEntryGridBodyCellClass}>
                      <Button
                        type="button"
                        size="sm"
                        className="h-8 gap-1 text-xs font-semibold"
                        disabled={!boqForm.itemCode.trim() || !boqForm.descriptionAr.trim() || addBoq.isPending}
                        onClick={() => {
                          addBoq.mutate({ ...boqForm, quantity: Number(boqForm.quantity) });
                          setBoqForm({ itemCode: '', descriptionAr: '', unit: 'M3', quantity: '', sectionName: '', kind: 'EXECUTABLE', notes: '' });
                        }}
                      >
                        <Plus className="h-3.5 w-3.5" />
                        إضافة
                      </Button>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <TenderWorkItemCatalogPicker
            open={catalogPickerOpen}
            saving={addFromCatalog.isPending}
            onClose={() => setCatalogPickerOpen(false)}
            onConfirm={(catalogIds) => addFromCatalog.mutate({ catalogIds })}
          />
        </section>
      )}

      {tab === 'analysis' && t && (
        <TenderRateAnalysisPanel
          tenderNumber={t.tenderNumber}
          issueDate={t.issueDate}
          quotations={t.quotations}
          boqItems={t.boqItems}
          visibleBoqRows={visibleBoqRows}
          expandedBoqCodes={expandedBoqCodes}
          toggleBoqExpand={toggleBoqExpand}
          boqChildCodes={boqChildCodes}
          locked={locked}
          onRefresh={refreshAll}
        />
      )}

      {tab === 'pricing' && t && (
        <TenderSalesStudyPanel tenderId={tenderId} locked={locked} />
      )}

      {tab === 'summary' && sum && (
        <section className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {Object.entries(COST_ELEMENT_AR).map(([k, label]) => (
              <div key={k} className="rounded-xl border bg-white p-3 text-sm">
                {label}: {formatEgp(sum.byCategory[k] ?? 0)}
              </div>
            ))}
          </div>
          <div className="rounded-xl border bg-white p-4 space-y-2 text-sm">
            <div>التكلفة المباشرة: {formatEgp(sum.directCost)}</div>
            <div>المصاريف الإدارية والموقع: {formatEgp(sum.overhead)} — المخاطر: {formatEgp(sum.risk)}</div>
            <div>التكلفة المتوقعة الكاملة: {formatEgp(sum.expectedCost)}</div>
            <div>قيمة البيع: {formatEgp(sum.sellingValue)}</div>
            <div className="font-bold text-brand">الربح مقابل التكلفة المباشرة: {formatEgp(sum.directProfit)} ({sum.directMarginPercent?.toFixed(2) ?? '—'}%)</div>
            <div className="font-bold">الربح المتوقع بعد المصاريف والمخاطر: {formatEgp(sum.fullyLoadedExpectedProfit)} ({sum.fullyLoadedExpectedMarginPercent?.toFixed(2) ?? '—'}%)</div>
            <p className="text-xs text-muted-foreground">الضريبة: {formatEgp(0)} — حسب المحرك الحالي بدون محرك ضريبة منفصل</p>
          </div>
          <div className={dataEntryGridWrapClass}>
            <table className="min-w-full text-sm">
              <thead className={dataEntryGridHeadRowClass}>
                <tr>
                  <th className={dataEntryGridHeadCellClass}>الكود</th>
                  <th className={dataEntryGridHeadCellClass}>الكمية</th>
                  <th className={dataEntryGridHeadCellClass}>تكلفة الوحدة</th>
                  <th className={dataEntryGridHeadCellClass}>إجمالي التحليل</th>
                  <th className={dataEntryGridHeadCellClass}>سعر البيع</th>
                  <th className={dataEntryGridHeadCellClass}>إجمالي البيع</th>
                  <th className={dataEntryGridHeadCellClass}>الربح</th>
                </tr>
              </thead>
              <tbody>
                {sum.lines.map((l) => (
                  <tr key={l.tenderBoqItemId}>
                    <td className={cn(dataEntryGridBodyCellClass, 'font-mono')}>{l.itemCode}</td>
                    <td className={dataEntryGridBodyCellClass}>{formatQty(l.quantity ?? 0)}</td>
                    <td className={dataEntryGridBodyCellClass}>{formatEgp(l.directUnitCost)}</td>
                    <td className={dataEntryGridBodyCellClass}>{formatEgp(l.directTotal ?? 0)}</td>
                    <td className={dataEntryGridBodyCellClass}>{formatEgp(l.sellingUnitRate)}</td>
                    <td className={dataEntryGridBodyCellClass}>{formatEgp(l.sellingTotal ?? 0)}</td>
                    <td className={dataEntryGridBodyCellClass}>{formatEgp(l.profit ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === 'quotations' && t && (
        <section className="space-y-4">
          {!locked && (
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className={erpLabelClass}>تاريخ العرض</label>
                <input
                  type="date"
                  className={cn(erpInputClass, dateControlClass)}
                  value={quoteDateInput}
                  onChange={(e) => setQuoteDateInput(e.target.value)}
                />
              </div>
              <button
                type="button"
                className="rounded-lg bg-brand px-4 py-2 text-sm text-white"
                onClick={() => {
                  const preview = [
                    `العميل: ${t.customer.arabicName}`,
                    `العملة: ${t.currencyCode}`,
                    `تاريخ العرض: ${quoteDateInput || '—'}`,
                    `بنود BOQ: ${t.boqItems.length}`,
                    sum ? `قيمة البيع (ملخص): ${formatEgp(sum.sellingValue)}` : '',
                    sum ? `التكلفة المباشرة: ${formatEgp(sum.directCost)}` : '',
                  ]
                    .filter(Boolean)
                    .join('\n');
                  if (window.confirm(`معاينة قبل إنشاء عرض السعر:\n\n${preview}\n\nمتابعة؟`)) {
                    createQtn.mutate({ quoteDate: quoteDateInput || null });
                  }
                }}
              >
                إنشاء عرض سعر
              </button>
            </div>
          )}
          <div className={dataEntryGridWrapClass}>
            <table className="min-w-full text-sm">
              <thead className={dataEntryGridHeadRowClass}>
                <tr>
                  <th className={dataEntryGridHeadCellClass}>العرض</th>
                  <th className={dataEntryGridHeadCellClass}>Rev</th>
                  <th className={dataEntryGridHeadCellClass}>تاريخ العرض</th>
                  <th className={dataEntryGridHeadCellClass}>الحالة</th>
                  <th className={dataEntryGridHeadCellClass}>الإجمالي</th>
                  <th className={dataEntryGridHeadCellClass}>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {t.quotations.map((q) => (
                  <tr key={q.id}>
                    <td className={dataEntryGridBodyCellClass}>{q.quotationNumber}</td>
                    <td className={dataEntryGridBodyCellClass}>{q.revisionNumber}</td>
                    <td className={dataEntryGridBodyCellClass}>
                      {q.quoteDate?.slice(0, 10) || q.createdAt.slice(0, 10)}
                    </td>
                    <td className={dataEntryGridBodyCellClass}>{QUOTATION_STATUS_AR[q.status] ?? q.status}</td>
                    <td className={dataEntryGridBodyCellClass}>{formatEgp(Number(q.grandTotal))}</td>
                    <td className={cn(dataEntryGridBodyCellClass, 'space-x-1 space-x-reverse')}>
                      <button type="button" className="text-brand underline text-xs" onClick={() => setSelectedQtnId(q.id)}>
                        فتح
                      </button>
                      <Link
                        href={`/extracts/operations/tender-price-quote?id=${q.id}`}
                        className="text-brand underline text-xs"
                      >
                        مستند
                      </Link>
                      {q.status === 'DRAFT' && !locked && (
                        <button
                          type="button"
                          className="text-xs"
                          onClick={() => qtnAction.mutate({ quotationId: q.id, action: 'submit' })}
                        >
                          إرسال
                        </button>
                      )}
                      {q.status === 'SUBMITTED' && !locked && (
                        <>
                          <button
                            type="button"
                            className="text-xs text-emerald-700"
                            onClick={() => {
                              if (
                                window.confirm(
                                  'تم اعتماد العرض كأساس للترسية.\n\nسيتم اعتماد هذا الإصدار فقط؛ الإصدارات الأخرى تبقى دون تغيير.\n\nمتابعة؟'
                                )
                              ) {
                                qtnAction.mutate({ quotationId: q.id, action: 'accept' });
                              }
                            }}
                          >
                            قبول
                          </button>
                          <button
                            type="button"
                            className="text-xs text-red-600"
                            onClick={() => qtnAction.mutate({ quotationId: q.id, action: 'reject' })}
                          >
                            رفض
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {selectedQtn && (
            <div className="rounded-xl border bg-white p-4 space-y-2 text-sm">
              <div className="font-bold">{selectedQtn.quotationNumber} Rev {selectedQtn.revisionNumber}</div>
              {selectedQtn.status === 'DRAFT' && !locked ? (
                <div>
                  <label className={erpLabelClass}>تاريخ العرض</label>
                  <input
                    type="date"
                    className={cn(erpInputClass, dateControlClass)}
                    defaultValue={selectedQtn.quoteDate?.slice(0, 10) || selectedQtn.createdAt.slice(0, 10)}
                    key={`${selectedQtn.id}-${selectedQtn.quoteDate ?? ''}`}
                    onBlur={(e) => {
                      const next = e.target.value || null;
                      const prev = selectedQtn.quoteDate?.slice(0, 10) || selectedQtn.createdAt.slice(0, 10);
                      if (next !== prev) {
                        qtnAction.mutate({
                          quotationId: selectedQtn.id,
                          action: 'patch',
                          body: { quoteDate: next },
                        });
                      }
                    }}
                  />
                </div>
              ) : (
                <div>تاريخ العرض: {selectedQtn.quoteDate?.slice(0, 10) || selectedQtn.createdAt.slice(0, 10)}</div>
              )}
              <div>الحالة: {QUOTATION_STATUS_AR[selectedQtn.status] ?? selectedQtn.status}</div>
              <div>Subtotal: {formatEgp(Number(selectedQtn.subtotalSelling))} — Tax: {formatEgp(Number(selectedQtn.taxAmount))} — Grand: {formatEgp(Number(selectedQtn.grandTotal))}</div>
              {selectedQtn.status === 'DRAFT' && !locked && (
                <div className="grid gap-2 sm:grid-cols-4">
                  <div>
                    <label className={erpLabelClass}>خصم</label>
                    <input
                      type="number"
                      defaultValue={Number(selectedQtn.discountAmount)}
                      onBlur={(e) =>
                        qtnAction.mutate({
                          quotationId: selectedQtn.id,
                          action: 'patch',
                          body: { discountAmount: Number(e.target.value) },
                        })
                      }
                      className={erpInputClass}
                    />
                  </div>
                  <div>
                    <label className={erpLabelClass}>صالح حتى</label>
                    <input
                      type="date"
                      defaultValue={selectedQtn.validUntil?.slice(0, 10) ?? ''}
                      onBlur={(e) =>
                        qtnAction.mutate({
                          quotationId: selectedQtn.id,
                          action: 'patch',
                          body: { validUntil: e.target.value || null },
                        })
                      }
                      className={cn(erpInputClass, dateControlClass)}
                    />
                  </div>
                  <div>
                    <label className={erpLabelClass}>شروط الدفع</label>
                    <input
                      className={erpInputClass}
                      defaultValue={selectedQtn.paymentTerms ?? ''}
                      onBlur={(e) => {
                        if (e.target.value !== (selectedQtn.paymentTerms ?? '')) {
                          qtnAction.mutate({
                            quotationId: selectedQtn.id,
                            action: 'patch',
                            body: { paymentTerms: e.target.value || null },
                          });
                        }
                      }}
                    />
                  </div>
                  <div>
                    <label className={erpLabelClass}>شروط التوريد</label>
                    <input
                      className={erpInputClass}
                      defaultValue={selectedQtn.deliveryTerms ?? ''}
                      onBlur={(e) => {
                        if (e.target.value !== (selectedQtn.deliveryTerms ?? '')) {
                          qtnAction.mutate({
                            quotationId: selectedQtn.id,
                            action: 'patch',
                            body: { deliveryTerms: e.target.value || null },
                          });
                        }
                      }}
                    />
                  </div>
                </div>
              )}
              <div className={dataEntryGridWrapClass}>
              <table className="min-w-full text-sm">
                <thead className={dataEntryGridHeadRowClass}>
                  <tr>
                    <th className={dataEntryGridHeadCellClass}>الكود</th>
                    <th className={dataEntryGridHeadCellClass}>البيان</th>
                    <th className={dataEntryGridHeadCellClass}>الكمية</th>
                    <th className={dataEntryGridHeadCellClass}>سعر البيع</th>
                    <th className={dataEntryGridHeadCellClass}>الإجمالي</th>
                    <th className={dataEntryGridHeadCellClass}>ملاحظات</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedQtnHeaderRows.map((row) => {
                    const code = row.line?.itemCodeSnapshot ?? row.boq?.itemCode ?? '';
                    const name = row.line?.descriptionArSnapshot ?? row.boq?.descriptionAr ?? '';
                    const qty = Number(row.line?.quantitySnapshot ?? row.boq?.quantity ?? 0);
                    const rate = Number(row.line?.sellingUnitRateSnapshot ?? row.boq?.sellingUnitRate ?? 0);
                    const amount = Number(row.line?.lineAmountSnapshot ?? qty * rate);
                    const boqId = row.line?.tenderBoqItemId ?? row.boq?.id;
                    return (
                    <tr key={row.line?.id ?? row.boq?.id}>
                      <td className={dataEntryGridBodyCellClass}>{code}</td>
                      <td className={dataEntryGridBodyCellClass}>{name}</td>
                      <td className={dataEntryGridBodyCellClass}>{formatQty(qty)}</td>
                      <td className={dataEntryGridBodyCellClass}>
                        {selectedQtn.status === 'DRAFT' && !locked && boqId ? (
                          <input
                            type="number"
                            className={dataEntryGridNumericInputClass}
                            defaultValue={rate}
                            onBlur={(e) =>
                              patchQtnLineRate.mutate({
                                quotationId: selectedQtn.id,
                                tenderBoqItemId: boqId,
                                sellingUnitRate: Number(e.target.value),
                              })
                            }
                          />
                        ) : (
                          formatEgp(rate)
                        )}
                      </td>
                      <td className={dataEntryGridBodyCellClass}>{formatEgp(amount)}</td>
                      <td className={dataEntryGridBodyCellClass}>{row.boq?.notes || '—'}</td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
              {selectedQtn.status === 'DRAFT' && sum && sum.sellingValue < sum.directCost && (
                <p className="text-amber-700 text-xs">تحذير: قيمة البيع أقل من التكلفة المباشرة</p>
              )}
            </div>
          )}
        </section>
      )}

      {tab === 'award' && t && (
        <section className="rounded-xl border bg-white p-4 space-y-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-bold">محضر الترسية والعقد</h3>
            <button type="button" className="rounded-lg border px-3 py-1 text-xs" onClick={() => window.print()}>
              طباعة المحضر
            </button>
          </div>
          <div id="tender-award-minutes" className="space-y-2">
          <p>العطاء {t.tenderNumber} — {t.nameAr}</p>
          <p>المالك: {t.customer.arabicName} — الاستشاري: {t.consultantName || '—'}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <p>تاريخ البداية: {t.expectedStart?.slice(0, 10) || '—'}</p>
            <p>تاريخ النهاية: {t.expectedEnd?.slice(0, 10) || '—'}</p>
            <p>مدة العقد (يوم): {t.contractDurationDays ?? '—'}</p>
            <p>غرامة التأخير: {t.delayPenaltyRate != null ? `${(Number(t.delayPenaltyRate) * 100).toFixed(2)}%` : '—'}</p>
            <p>عرض معتمد: {acceptedQtn ? `${acceptedQtn.quotationNumber} Rev ${acceptedQtn.revisionNumber}` : 'لا يوجد'}</p>
            <p>قيمة البيع المعتمدة: {acceptedQtn ? formatEgp(Number(acceptedQtn.grandTotal)) : '—'}</p>
          </div>
          {t.award ? (
            <div className="rounded-lg bg-emerald-50 p-3 space-y-1">
              <p>تمت الترسية في {t.award.awardedAt.slice(0, 10)}</p>
              <p>العقد {t.award.clientContract.contractNumber} — المشروع {t.award.project.projectCode}</p>
              <p className="text-xs text-slate-600">أسعار البيع تُنسخ إلى جدول كميات المشروع عند الترسية.</p>
              <Link
                href={`/extracts/operations/client-contract?id=${t.award.clientContract.id}`}
                className="inline-block text-sm text-brand underline"
              >
                فتح التعاقد
              </Link>
            </div>
          ) : !locked && acceptedQtn ? (
            <button
              type="button"
              disabled={!readiness.accepted || !readiness.boq || !readiness.integrityOk}
              className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
              onClick={() => setAwardOpen(true)}
            >
              ترسية العطاء وإنشاء العقد والمشروع
            </button>
          ) : (
            <p className="text-slate-500">اعتمد عرض سعر أولاً ثم أتمّ الترسية من هنا.</p>
          )}
          <p className="text-xs text-slate-500">عند الترسية تُنسخ المدة وغرامة التأخير وتواريخ البداية/النهاية إلى العقد والمشروع مع أسعار البيع.</p>
          </div>
        </section>
      )}

      {tab === 'history' && t && (
        <section className="rounded-xl border bg-white p-4 text-sm space-y-2">
          <div>إنشاء العطاء: {t.createdAt.slice(0, 19)}</div>
          {t.quotations.map((q) => (
            <div key={q.id}>
              {q.quotationNumber} Rev {q.revisionNumber}: {QUOTATION_STATUS_AR[q.status]} — إنشاء {q.createdAt.slice(0, 10)}
              {q.submittedAt ? ` — إرسال ${q.submittedAt.slice(0, 10)}` : ''}
              {q.acceptedAt ? ` — اعتماد ${q.acceptedAt.slice(0, 10)}` : ''}
            </div>
          ))}
          {t.award && <div>ترسية: {t.award.awardedAt.slice(0, 10)} → {t.award.clientContract.contractNumber}</div>}
          {t.status === 'LOST' && <div>غير فائز: {t.lostReason}</div>}
        </section>
      )}

      {awardOpen && acceptedQtn && sum && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-w-lg w-full rounded-2xl bg-white p-6 space-y-3" dir="rtl">
            <h3 className="text-lg font-bold">ترسية العطاء وتحويله إلى عقد ومشروع</h3>
            <p className="text-sm">العرض: {acceptedQtn.quotationNumber} Rev {acceptedQtn.revisionNumber}</p>
            <p className="text-sm">قيمة العقد: {formatEgp(Number(acceptedQtn.grandTotal))}</p>
            <p className="text-sm">البداية / النهاية: {t?.expectedStart?.slice(0, 10) || '—'} → {t?.expectedEnd?.slice(0, 10) || '—'}</p>
            <p className="text-sm">المدة: {t?.contractDurationDays ?? '—'} يوم — غرامة التأخير: {t?.delayPenaltyRate != null ? `${(Number(t.delayPenaltyRate) * 100).toFixed(2)}%` : '—'}</p>
            <p className="text-sm">التكلفة المباشرة: {formatEgp(sum.directCost)}</p>
            <p className="text-sm">الربح (مباشر): {formatEgp(sum.directProfit)} ({sum.directMarginPercent?.toFixed(2) ?? '—'}%)</p>
            <p className="text-sm">التكلفة المتوقعة الكاملة: {formatEgp(sum.expectedCost)}</p>
            <p className="text-sm">الربح المتوقع (بعد المصاريف): {formatEgp(sum.fullyLoadedExpectedProfit)}</p>
            <p className="text-sm">الهامش المتوقع: {sum.fullyLoadedExpectedMarginPercent?.toFixed(2) ?? '—'}%</p>
            <p className="text-xs text-muted-foreground">سيتم إنشاء عقد ومشروع وجدول كميات المشروع من العرض المعتمد.</p>
            <div className="flex gap-2 justify-end">
              <button type="button" className="rounded-lg border px-4 py-2 text-sm" onClick={() => setAwardOpen(false)}>إلغاء</button>
              <button
                type="button"
                disabled={awardMut.isPending}
                className="rounded-lg bg-emerald-700 px-4 py-2 text-sm text-white disabled:opacity-50"
                onClick={() => {
                  if (!idempotencyRef.current) idempotencyRef.current = `award-ui-${tenderId}-${Date.now()}`;
                  awardMut.mutate({ quotationId: acceptedQtn.id, idempotencyKey: idempotencyRef.current });
                }}
              >
                تأكيد الترسية
              </button>
            </div>
          </div>
        </div>
      )}
    </ExtractsPageChrome>
  );
}
