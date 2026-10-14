'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { apiClient } from '@/lib/api/client';
import { useApiMutation, useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';
import { withItemCodeHierarchy } from '@/lib/contracting/boq-hierarchy';
import { commitTenderBoqRows, previewTenderBoqExcel, type TenderExcelPreview } from '@/lib/contracting/tender-excel-transfer';
import { formatEgp, formatQty } from '@/lib/subcontracts/money';
import { cn } from '@/lib/utils';
import {
  analysisElementCost,
  BOQ_UNITS,
  CATALOG_KIND_AR,
  CATALOG_KINDS,
  COST_ELEMENT_AR,
  QUOTATION_STATUS_AR,
  TENDER_STATUS_AR,
  tenderIsLocked,
} from './tender-labels';

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
  clientSuppliedRate: string | null;
  notes: string | null;
  directUnitCost: string;
  sellingUnitRate: string;
  markupRate: string;
  pricingMethod: string;
  rateAnalysisItems: Array<{
    id: string;
    costElementType: string;
    descriptionAr: string;
    unit: string;
    consumptionQuotaPerUnit: string;
    unitCost: string;
    wasteFactorRate?: string;
    totalCostPerUnit: string;
    notes?: string | null;
  }>;
};

type CatalogRow = {
  id: string;
  itemCode: string;
  descriptionAr: string;
  unit: string;
  kind: string;
  groupName: string | null;
  notes: string | null;
};

type TenderDetail = {
  id: string;
  tenderNumber: string;
  nameAr: string;
  description: string | null;
  status: string;
  currencyCode: string;
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
  const [tab, setTab] = useState<TabId>('header');
  const [selectedBoqId, setSelectedBoqId] = useState<string | null>(null);
  const [selectedQtnId, setSelectedQtnId] = useState<string | null>(null);
  const [excelPreview, setExcelPreview] = useState<TenderExcelPreview | null>(null);
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
  const catalogQ = useApiQuery<CatalogRow[]>(['contracting-item-catalog'], '/contracting/item-catalog');

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
    { onSuccess: refreshAll }
  );
  const removeBoqLine = useMutation({
    mutationFn: (lineId: string) => apiClient.delete(`/contracting/tenders/boq/${lineId}`),
    onSuccess: () => refreshAll(),
  });
  const boqLineIdForMutations = selectedBoqId ?? t?.boqItems[0]?.id ?? 'x';
  const saveRate = useApiMutation<unknown, { items: unknown[] }>(
    `/contracting/tenders/boq/${boqLineIdForMutations}/rate-analysis`,
    'POST',
    { onSuccess: refreshAll }
  );
  const savePricing = useApiMutation<unknown, Record<string, unknown>>(
    `/contracting/tenders/boq/${boqLineIdForMutations}/pricing`,
    'POST',
    { onSuccess: refreshAll }
  );
  const applyMarkup = useApiMutation<unknown, { markupRate: number }>(
    `/contracting/tenders/${tenderId}/pricing/markup`,
    'POST',
    { onSuccess: refreshAll }
  );
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
  const selectedQtn = useMemo(
    () => t?.quotations.find((q) => q.id === selectedQtnId) ?? null,
    [t, selectedQtnId]
  );

  const [headerForm, setHeaderForm] = useState({
    nameAr: '',
    description: '',
    currencyCode: 'EGP',
    submissionDeadline: '',
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
      submissionDeadline: t.submissionDeadline?.slice(0, 10) ?? '',
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
    t?.submissionDeadline,
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
  const [pickedCatalogIds, setPickedCatalogIds] = useState<string[]>([]);

  const [rateForm, setRateForm] = useState({
    costElementType: 'MATERIAL',
    descriptionAr: 'مواد',
    unit: 'M3',
    consumptionQuotaPerUnit: '1',
    wasteFactorRate: '0',
    unitCost: '',
  });

  const [priceForm, setPriceForm] = useState({
    pricingMethod: 'COST_PLUS_MARKUP',
    markupRate: '0.2',
    targetMarginRate: '0.166667',
    sellingUnitRate: '',
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

  if (awardResult) {
    return (
      <div className="mx-auto max-w-3xl space-y-6 p-4" dir="rtl">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 space-y-4">
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
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1400px] space-y-4 p-4" dir="rtl">
      <PageHeader
        title={t ? `${t.tenderNumber} — ${t.nameAr}` : 'العطاء'}
        breadcrumbs={[{ label: 'العطاءات', href: '/contracting/tenders' }, { label: t?.tenderNumber ?? '…' }]}
      />

      {t && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-white p-4">
          <StatusBadge label={TENDER_STATUS_AR[t.status] ?? t.status} tone={t.status === 'AWARDED' ? 'success' : t.status === 'LOST' ? 'danger' : 'info'} />
          <span className="text-sm text-muted-foreground">رقم العطاء: {t.tenderNumber}</span>
          <span className="text-sm text-muted-foreground">المالك: {t.customer.arabicName}</span>
          <span className="text-sm text-muted-foreground">الاستشاري: {t.consultantName || '—'}</span>
          <span className="text-sm text-muted-foreground">العملة: {t.currencyCode}</span>
          <span className="text-sm text-muted-foreground">تاريخ الإنشاء: {t.createdAt.slice(0, 10)}</span>
        </div>
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

      <nav className="flex flex-wrap gap-2 rounded-xl border bg-white p-2">
        {TABS.map((x) => (
          <button
            key={x.id}
            type="button"
            onClick={() => setTab(x.id)}
            className={cn(
              'rounded-lg px-3 py-1.5 text-sm font-bold',
              tab === x.id ? 'bg-brand text-white' : 'text-[#094C6B] hover:bg-[#F6FBFD]'
            )}
          >
            {x.label}
          </button>
        ))}
      </nav>

      {tab === 'header' && t && (
        <section className="rounded-xl border bg-white p-4 space-y-4">
          <div className="grid gap-3 text-sm sm:grid-cols-3">
            <div>
              <div className="text-xs text-slate-500">رقم العطاء</div>
              <div className="font-mono font-bold">{t.tenderNumber}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">المالك / العميل</div>
              <div className="font-bold">{t.customer.arabicName}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">حالة الاعتماد</div>
              <StatusBadge label={TENDER_STATUS_AR[t.status] ?? t.status} tone={t.status === 'AWARDED' ? 'success' : t.status === 'LOST' ? 'danger' : 'info'} />
            </div>
          </div>
          {!locked ? (
            <>
              <label className="block text-xs">
                اسم العطاء
                <input className="mt-1 w-full rounded border px-3 py-2 text-sm" value={headerForm.nameAr} onChange={(e) => setHeaderForm({ ...headerForm, nameAr: e.target.value })} />
              </label>
              <textarea className="w-full rounded border px-3 py-2 text-sm" rows={3} value={headerForm.description} onChange={(e) => setHeaderForm({ ...headerForm, description: e.target.value })} placeholder="وصف / ملاحظات العطاء" />
              <div className="grid gap-2 sm:grid-cols-3">
                <label className="text-xs">الاستشاري<input className="mt-1 w-full rounded border px-2 py-1 text-sm" value={headerForm.consultantName} onChange={(e) => setHeaderForm({ ...headerForm, consultantName: e.target.value })} /></label>
                <label className="text-xs">مدير المشروع<input className="mt-1 w-full rounded border px-2 py-1 text-sm" value={headerForm.projectManagerName} onChange={(e) => setHeaderForm({ ...headerForm, projectManagerName: e.target.value })} /></label>
                <label className="text-xs">مصدر التمويل<input className="mt-1 w-full rounded border px-2 py-1 text-sm" value={headerForm.fundingSource} onChange={(e) => setHeaderForm({ ...headerForm, fundingSource: e.target.value })} /></label>
                <label className="text-xs">العملة<input className="mt-1 w-full rounded border px-2 py-1 text-sm" value={headerForm.currencyCode} onChange={(e) => setHeaderForm({ ...headerForm, currencyCode: e.target.value })} /></label>
                <label className="text-xs">تاريخ / موعد التقديم<input type="date" className="mt-1 w-full rounded border px-2 py-1 text-sm" value={headerForm.submissionDeadline} onChange={(e) => setHeaderForm({ ...headerForm, submissionDeadline: e.target.value })} /></label>
                <label className="text-xs">موقع المشروع<input className="mt-1 w-full rounded border px-2 py-1 text-sm" value={headerForm.location} onChange={(e) => setHeaderForm({ ...headerForm, location: e.target.value })} /></label>
                <label className="text-xs">بداية المشروع<input type="date" className="mt-1 w-full rounded border px-2 py-1 text-sm" value={headerForm.expectedStart} onChange={(e) => setHeaderForm({ ...headerForm, expectedStart: e.target.value })} /></label>
                <label className="text-xs">نهاية المشروع<input type="date" className="mt-1 w-full rounded border px-2 py-1 text-sm" value={headerForm.expectedEnd} onChange={(e) => setHeaderForm({ ...headerForm, expectedEnd: e.target.value })} /></label>
                <label className="text-xs">مدة العقد (يوم)<input type="number" className="mt-1 w-full rounded border px-2 py-1 text-sm" value={headerForm.contractDurationDays} onChange={(e) => setHeaderForm({ ...headerForm, contractDurationDays: e.target.value })} /></label>
                <label className="text-xs">غرامة التأخير (نسبة، مثال 0.01 = 1%)<input type="number" step="0.0001" className="mt-1 w-full rounded border px-2 py-1 text-sm" value={headerForm.delayPenaltyRate} onChange={(e) => setHeaderForm({ ...headerForm, delayPenaltyRate: e.target.value })} /></label>
              </div>
              <button type="button" className="rounded-lg bg-brand px-4 py-2 text-sm text-white" onClick={() => patchTender.mutate(headerForm)}>
                حفظ بيانات العطاء
              </button>
            </>
          ) : (
            <div className="grid gap-3 text-sm sm:grid-cols-3">
              <p><span className="text-slate-500">الاستشاري: </span>{t.consultantName || '—'}</p>
              <p><span className="text-slate-500">مدير المشروع: </span>{t.projectManagerName || '—'}</p>
              <p><span className="text-slate-500">مصدر التمويل: </span>{t.fundingSource || '—'}</p>
              <p><span className="text-slate-500">الموقع: </span>{t.location || '—'}</p>
              <p><span className="text-slate-500">موعد التقديم: </span>{t.submissionDeadline?.slice(0, 10) || '—'}</p>
              <p><span className="text-slate-500">البداية: </span>{t.expectedStart?.slice(0, 10) || '—'}</p>
              <p><span className="text-slate-500">النهاية: </span>{t.expectedEnd?.slice(0, 10) || '—'}</p>
              <p><span className="text-slate-500">المدة (يوم): </span>{t.contractDurationDays ?? '—'}</p>
              <p><span className="text-slate-500">غرامة التأخير: </span>{t.delayPenaltyRate != null ? `${(Number(t.delayPenaltyRate) * 100).toFixed(2)}%` : '—'}</p>
              <p><span className="text-slate-500">تاريخ الترسية: </span>{t.award?.awardedAt?.slice(0, 10) || '—'}</p>
              <p className="sm:col-span-3 whitespace-pre-wrap">{t.description || '—'}</p>
            </div>
          )}
          {!locked && t.status !== 'LOST' && (
            <div className="border-t pt-3">
              <button
                type="button"
                className="rounded-lg border border-red-300 px-3 py-1 text-sm text-red-700"
                onClick={() => {
                  const lostReason = window.prompt('سبب الخسارة') ?? '';
                  markLost.mutate({ lostReason, competitorName: window.prompt('المنافس') ?? undefined });
                }}
              >
                اعتبار العطاء غير فائز
              </button>
            </div>
          )}
        </section>
      )}

      {tab === 'boq' && t && (
        <section className="space-y-4">
          {!locked && (
            <div className="rounded-xl border bg-white p-4 space-y-3">
              <div className="font-bold">إضافة بند لجدول الكميات</div>
              <div className="grid gap-2 sm:grid-cols-6">
                <input placeholder="الكود (1 / 1.1 / 1.1.1)" className="rounded border px-2 py-1 text-sm" value={boqForm.itemCode} onChange={(e) => setBoqForm({ ...boqForm, itemCode: e.target.value })} />
                <input placeholder="البند / البيان" className="rounded border px-2 py-1 text-sm sm:col-span-2" value={boqForm.descriptionAr} onChange={(e) => setBoqForm({ ...boqForm, descriptionAr: e.target.value })} />
                <select className="rounded border px-2 py-1 text-sm" value={boqForm.unit} onChange={(e) => setBoqForm({ ...boqForm, unit: e.target.value })}>
                  {BOQ_UNITS.map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
                <input placeholder="الكمية" type="number" className="rounded border px-2 py-1 text-sm" value={boqForm.quantity} onChange={(e) => setBoqForm({ ...boqForm, quantity: e.target.value })} />
                <select className="rounded border px-2 py-1 text-sm" value={boqForm.kind} onChange={(e) => setBoqForm({ ...boqForm, kind: e.target.value })}>
                  {CATALOG_KINDS.map((k) => (
                    <option key={k} value={k}>{CATALOG_KIND_AR[k]}</option>
                  ))}
                </select>
                <input placeholder="الموسم / الفصل" className="rounded border px-2 py-1 text-sm" value={boqForm.sectionName} onChange={(e) => setBoqForm({ ...boqForm, sectionName: e.target.value })} />
                <input placeholder="ملاحظات" className="rounded border px-2 py-1 text-sm sm:col-span-2" value={boqForm.notes} onChange={(e) => setBoqForm({ ...boqForm, notes: e.target.value })} />
              </div>
              <button
                type="button"
                className="rounded-lg bg-brand px-3 py-1 text-sm text-white"
                onClick={() =>
                  addBoq.mutate({
                    ...boqForm,
                    quantity: Number(boqForm.quantity),
                  })
                }
              >
                إضافة بند
              </button>
              <div className="border-t pt-3 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-bold text-sm">من دليل بنود الأعمال</div>
                  <Link className="text-xs text-brand underline" href="/contracting/catalog/work-items">فتح الدليل</Link>
                </div>
                <div className="max-h-40 overflow-auto rounded border text-xs">
                  {(catalogQ.data?.data ?? []).map((c) => (
                    <label key={c.id} className="flex items-center gap-2 border-b px-2 py-1">
                      <input
                        type="checkbox"
                        checked={pickedCatalogIds.includes(c.id)}
                        onChange={(e) =>
                          setPickedCatalogIds((prev) =>
                            e.target.checked ? [...prev, c.id] : prev.filter((id) => id !== c.id)
                          )
                        }
                      />
                      <span className="font-mono">{c.itemCode}</span>
                      <span>{c.descriptionAr}</span>
                      <span className="text-slate-500">{CATALOG_KIND_AR[c.kind] ?? c.kind}</span>
                      <span>{c.unit}</span>
                    </label>
                  ))}
                  {!catalogQ.data?.data?.length ? (
                    <p className="p-2 text-slate-500">الدليل فارغ — أضف بنوداً من شاشة دليل بنود الأعمال.</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  disabled={!pickedCatalogIds.length || addFromCatalog.isPending}
                  className="rounded-lg border px-3 py-1 text-sm disabled:opacity-50"
                  onClick={() => {
                    addFromCatalog.mutate({ catalogIds: pickedCatalogIds });
                    setPickedCatalogIds([]);
                  }}
                >
                  إضافة المحدد إلى الجدول
                </button>
              </div>
              <div className="border-t pt-3">
                <label className="text-sm font-bold">استيراد جدول الكميات من Excel</label>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  className="mt-1 block text-sm"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) excelMut.mutate(f);
                  }}
                />
              </div>
            </div>
          )}
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
              <button type="button" className="rounded-lg bg-emerald-600 px-3 py-1 text-sm text-white disabled:opacity-50" disabled={excelPreview.validRowsCount === 0} onClick={() => excelCommit.mutate()}>
                تأكيد الاستيراد
              </button>
            </div>
          )}
          <div className="overflow-x-auto rounded-xl border bg-white">
            <table className="min-w-full text-xs">
              <thead className="bg-[#F6FBFD]">
                <tr>
                  <th className="px-2 py-2">الكود</th>
                  <th className="px-2 py-2">النوع</th>
                  <th className="px-2 py-2">البند</th>
                  <th className="px-2 py-2">الوحدة</th>
                  <th className="px-2 py-2">كمية التحليل</th>
                  <th className="px-2 py-2">سعر التحليل</th>
                  <th className="px-2 py-2">إجمالي التحليل</th>
                  <th className="px-2 py-2">سعر البيع</th>
                  <th className="px-2 py-2">إجمالي البيع</th>
                  <th className="px-2 py-2">ملاحظات</th>
                  {!locked && <th className="px-2 py-2" />}
                </tr>
              </thead>
              <tbody>
                {withItemCodeHierarchy(t.boqItems, (b) => b.itemCode).map((b) => {
                  const qty = Number(b.quantity);
                  const analysisUnit = Number(b.directUnitCost);
                  const sellingUnit = Number(b.sellingUnitRate);
                  return (
                    <tr
                      key={b.id}
                      className={`border-t cursor-pointer ${b.__isParent ? 'bg-[#EEF6FA]' : ''} ${selectedBoqId === b.id ? 'outline outline-1 outline-brand' : ''}`}
                      onClick={() => setSelectedBoqId(b.id)}
                    >
                      <td className="px-2 py-2 font-mono" style={{ paddingInlineStart: 8 + b.__depth * 14 }}>
                        {b.itemCode}
                        {b.__isParent ? <span className="mr-1 text-[10px] text-[#0E78AA]"> رئيسي</span> : null}
                      </td>
                      <td className="px-2 py-2">{CATALOG_KIND_AR[b.kind ?? ''] ?? (b.__isParent ? 'رئيسي' : 'تنفيذي')}</td>
                      <td className="px-2 py-2">{b.descriptionAr}</td>
                      <td className="px-2 py-2">{b.unit}</td>
                      <td className="px-2 py-2">{b.__isParent ? '—' : formatQty(qty)}</td>
                      <td className="px-2 py-2">{b.__isParent ? '—' : formatEgp(analysisUnit)}</td>
                      <td className="px-2 py-2">{b.__isParent ? '—' : formatEgp(qty * analysisUnit)}</td>
                      <td className="px-2 py-2">{b.__isParent ? '—' : formatEgp(sellingUnit)}</td>
                      <td className="px-2 py-2">{b.__isParent ? '—' : formatEgp(qty * sellingUnit)}</td>
                      <td className="px-2 py-2">{b.notes || b.sectionName || '—'}</td>
                      {!locked && (
                        <td className="px-2 py-2">
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
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === 'analysis' && t && (
        <section className="grid gap-4 lg:grid-cols-[220px_1fr]">
          <div className="rounded-xl border bg-white p-3 max-h-[32rem] overflow-auto">
            {t.boqItems.map((b) => (
              <button key={b.id} type="button" className={cn('block w-full text-right px-2 py-2 text-sm border-b', selectedBoq?.id === b.id && 'bg-[#F6FBFD]')} onClick={() => setSelectedBoqId(b.id)}>
                {b.itemCode} — {b.descriptionAr}
              </button>
            ))}
          </div>
          {selectedBoq && (
            <div className="rounded-xl border bg-white p-4 space-y-3 overflow-x-auto">
              <div className="font-bold">تحليل سعر البند — {selectedBoq.itemCode} {selectedBoq.descriptionAr}</div>
              <p className="text-xs text-slate-500">
                تكلفة العنصر = الحصة × (1 + الهالك) × سعر الوحدة. مثال: 0.15 × 13,500 = 2,025
              </p>
              <table className="min-w-full text-xs">
                <thead className="bg-[#F6FBFD]">
                  <tr>
                    <th className="px-2 py-1">العنصر</th>
                    <th className="px-2 py-1">البيان</th>
                    <th className="px-2 py-1">الوحدة</th>
                    <th className="px-2 py-1">الحصة</th>
                    <th className="px-2 py-1">الهالك</th>
                    <th className="px-2 py-1">سعر الوحدة</th>
                    <th className="px-2 py-1">المعادلة</th>
                    <th className="px-2 py-1">تكلفة العنصر</th>
                    {!locked && <th className="px-2 py-1" />}
                  </tr>
                </thead>
                <tbody>
                  {selectedBoq.rateAnalysisItems.map((r) => {
                    const quota = Number(r.consumptionQuotaPerUnit);
                    const waste = Number(r.wasteFactorRate ?? 0);
                    const unitCost = Number(r.unitCost);
                    const cost = analysisElementCost(quota, waste, unitCost);
                    return (
                      <tr key={r.id} className="border-t">
                        <td className="px-2 py-1">{COST_ELEMENT_AR[r.costElementType] ?? r.costElementType}</td>
                        <td className="px-2 py-1">{r.descriptionAr}</td>
                        <td className="px-2 py-1">{r.unit}</td>
                        <td className="px-2 py-1">{formatQty(quota)}</td>
                        <td className="px-2 py-1">{(waste * 100).toFixed(1)}%</td>
                        <td className="px-2 py-1">{formatEgp(unitCost)}</td>
                        <td className="px-2 py-1 font-mono" dir="ltr">
                          {quota} × {waste > 0 ? `(1+${waste}) × ` : ''}{unitCost}
                        </td>
                        <td className="px-2 py-1 font-bold">{formatEgp(Number(r.totalCostPerUnit) || cost)}</td>
                        {!locked && (
                          <td className="px-2 py-1">
                            <button
                              type="button"
                              className="text-red-600"
                              onClick={() =>
                                saveRate.mutate({
                                  items: selectedBoq.rateAnalysisItems
                                    .filter((x) => x.id !== r.id)
                                    .map((x) => ({
                                      costElementType: x.costElementType,
                                      descriptionAr: x.descriptionAr,
                                      unit: x.unit,
                                      consumptionQuotaPerUnit: Number(x.consumptionQuotaPerUnit),
                                      unitCost: Number(x.unitCost),
                                      wasteFactorRate: Number(x.wasteFactorRate ?? 0),
                                    })),
                                })
                              }
                            >
                              حذف
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!locked && (
                <div className="grid gap-2 sm:grid-cols-6 text-sm">
                  <select value={rateForm.costElementType} onChange={(e) => setRateForm({ ...rateForm, costElementType: e.target.value, descriptionAr: COST_ELEMENT_AR[e.target.value] ?? e.target.value })}>
                    {Object.entries(COST_ELEMENT_AR).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                  <input placeholder="البيان" value={rateForm.descriptionAr} onChange={(e) => setRateForm({ ...rateForm, descriptionAr: e.target.value })} className="rounded border px-2 py-1" />
                  <input placeholder="الوحدة" value={rateForm.unit} onChange={(e) => setRateForm({ ...rateForm, unit: e.target.value })} className="rounded border px-2 py-1" />
                  <input placeholder="الحصة" type="number" step="0.0001" value={rateForm.consumptionQuotaPerUnit} onChange={(e) => setRateForm({ ...rateForm, consumptionQuotaPerUnit: e.target.value })} className="rounded border px-2 py-1" />
                  <input placeholder="هالك 0.1=10%" type="number" step="0.0001" value={rateForm.wasteFactorRate} onChange={(e) => setRateForm({ ...rateForm, wasteFactorRate: e.target.value })} className="rounded border px-2 py-1" />
                  <input placeholder="سعر الوحدة" value={rateForm.unitCost} onChange={(e) => setRateForm({ ...rateForm, unitCost: e.target.value })} className="rounded border px-2 py-1" />
                  <button
                    type="button"
                    className="rounded-lg bg-brand px-3 py-1 text-sm text-white sm:col-span-6"
                    onClick={() =>
                      saveRate.mutate({
                        items: [
                          ...selectedBoq.rateAnalysisItems.map((x) => ({
                            costElementType: x.costElementType,
                            descriptionAr: x.descriptionAr,
                            unit: x.unit,
                            consumptionQuotaPerUnit: Number(x.consumptionQuotaPerUnit),
                            unitCost: Number(x.unitCost),
                            wasteFactorRate: Number(x.wasteFactorRate ?? 0),
                          })),
                          {
                            costElementType: rateForm.costElementType,
                            descriptionAr: rateForm.descriptionAr,
                            unit: rateForm.unit,
                            consumptionQuotaPerUnit: Number(rateForm.consumptionQuotaPerUnit),
                            unitCost: Number(rateForm.unitCost),
                            wasteFactorRate: Number(rateForm.wasteFactorRate || 0),
                          },
                        ],
                      })
                    }
                  >
                    إضافة عنصر تحليل
                  </button>
                </div>
              )}
              <div className="grid gap-1 text-sm sm:grid-cols-3 border-t pt-2">
                <div>تكلفة الوحدة المباشرة: {formatEgp(Number(selectedBoq.directUnitCost))}</div>
                <div>كمية البند: {formatQty(Number(selectedBoq.quantity))}</div>
                <div>إجمالي التحليل: {formatEgp(Number(selectedBoq.quantity) * Number(selectedBoq.directUnitCost))}</div>
              </div>
            </div>
          )}
        </section>
      )}

      {tab === 'pricing' && t && (
        <section className="rounded-xl border bg-white p-4 space-y-4">
          <div className="rounded-lg bg-[#F6FBFD] p-3 text-xs space-y-1">
            <div>مصاريف عامة: {(Number(t.generalOverheadRate) * 100).toFixed(1)}% — موقع: {(Number(t.siteOverheadRate) * 100).toFixed(1)}% — مخاطر: {(Number(t.contingencyRiskRate) * 100).toFixed(1)}%</div>
            <div>بيع البند (تكلفة + markup) = التكلفة المباشرة × (1 + معدل الربح/الهامش على التكلفة)</div>
            <div>هامش البيع = (البيع − التكلفة) / البيع × 100 — لا تُحتسب ضريبة منفصلة حالياً</div>
          </div>
          {!t.boqItems.length ? (
            <p className="text-sm text-muted-foreground">أضف بنود جدول الكميات أولاً.</p>
          ) : selectedBoq ? (
            <>
          <select className="rounded border px-2 py-1 text-sm" value={selectedBoqId ?? selectedBoq.id} onChange={(e) => setSelectedBoqId(e.target.value)}>
            {t.boqItems.map((b) => (
              <option key={b.id} value={b.id}>{b.itemCode} — {b.descriptionAr}</option>
            ))}
          </select>
          {!locked && (
            <>
              <select value={priceForm.pricingMethod} onChange={(e) => setPriceForm({ ...priceForm, pricingMethod: e.target.value })} className="rounded border px-2 py-1 text-sm">
                <option value="COST_PLUS_MARKUP">تكلفة + Markup</option>
                <option value="MANUAL_SELLING">سعر بيع يدوي</option>
                <option value="TARGET_MARGIN">هامش مستهدف</option>
              </select>
              {priceForm.pricingMethod === 'COST_PLUS_MARKUP' && (
                <input type="number" step="0.01" placeholder="Markup (0.2 = 20%)" className="rounded border px-2 py-1 text-sm" value={priceForm.markupRate} onChange={(e) => setPriceForm({ ...priceForm, markupRate: e.target.value })} />
              )}
              {priceForm.pricingMethod === 'TARGET_MARGIN' && (
                <input type="number" step="0.0001" placeholder="هامش (0.166667)" className="rounded border px-2 py-1 text-sm" value={priceForm.targetMarginRate} onChange={(e) => setPriceForm({ ...priceForm, targetMarginRate: e.target.value })} />
              )}
              {priceForm.pricingMethod === 'MANUAL_SELLING' && (
                <input type="number" placeholder="سعر البيع" className="rounded border px-2 py-1 text-sm" value={priceForm.sellingUnitRate} onChange={(e) => setPriceForm({ ...priceForm, sellingUnitRate: e.target.value })} />
              )}
              <button
                type="button"
                className="rounded-lg bg-brand px-3 py-1 text-sm text-white"
                onClick={() =>
                  savePricing.mutate({
                    pricingMethod: priceForm.pricingMethod,
                    markupRate: Number(priceForm.markupRate),
                    targetMarginRate: Number(priceForm.targetMarginRate),
                    sellingUnitRate: priceForm.sellingUnitRate ? Number(priceForm.sellingUnitRate) : undefined,
                  })
                }
              >
                تطبيق تسعير البند
              </button>
              <button type="button" className="rounded-lg border px-3 py-1 text-sm mr-2" onClick={() => applyMarkup.mutate({ markupRate: Number(t.defaultMarkupRate) || 0.2 })}>
                تسعير كل البنود بـ markup العطاء ({(Number(t.defaultMarkupRate) * 100).toFixed(0)}%)
              </button>
            </>
          )}
          <div className="text-sm grid gap-1 sm:grid-cols-2">
            <div>تكلفة الوحدة: {formatEgp(Number(selectedBoq.directUnitCost))}</div>
            <div>سعر البيع: {formatEgp(Number(selectedBoq.sellingUnitRate))}</div>
            <div>Markup: {(Number(selectedBoq.markupRate) * 100).toFixed(2)}%</div>
            <div>إجمالي البيع: {formatEgp(Number(selectedBoq.quantity) * Number(selectedBoq.sellingUnitRate))}</div>
          </div>
            </>
          ) : null}
        </section>
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
          <div className="overflow-x-auto rounded-xl border bg-white">
            <table className="min-w-full text-xs">
              <thead className="bg-[#F6FBFD]">
                <tr>
                  <th className="px-2 py-2">الكود</th>
                  <th className="px-2 py-2">الكمية</th>
                  <th className="px-2 py-2">تكلفة الوحدة</th>
                  <th className="px-2 py-2">إجمالي التحليل</th>
                  <th className="px-2 py-2">سعر البيع</th>
                  <th className="px-2 py-2">إجمالي البيع</th>
                  <th className="px-2 py-2">الربح</th>
                </tr>
              </thead>
              <tbody>
                {sum.lines.map((l) => (
                  <tr key={l.tenderBoqItemId} className="border-t">
                    <td className="px-2 py-2 font-mono">{l.itemCode}</td>
                    <td className="px-2 py-2">{formatQty(l.quantity ?? 0)}</td>
                    <td className="px-2 py-2">{formatEgp(l.directUnitCost)}</td>
                    <td className="px-2 py-2">{formatEgp(l.directTotal ?? 0)}</td>
                    <td className="px-2 py-2">{formatEgp(l.sellingUnitRate)}</td>
                    <td className="px-2 py-2">{formatEgp(l.sellingTotal ?? 0)}</td>
                    <td className="px-2 py-2">{formatEgp(l.profit ?? 0)}</td>
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
            <button
              type="button"
              className="rounded-lg bg-brand px-4 py-2 text-sm text-white"
              onClick={() => {
                const preview = [
                  `العميل: ${t.customer.arabicName}`,
                  `العملة: ${t.currencyCode}`,
                  `بنود BOQ: ${t.boqItems.length}`,
                  sum ? `قيمة البيع (ملخص): ${formatEgp(sum.sellingValue)}` : '',
                  sum ? `التكلفة المباشرة: ${formatEgp(sum.directCost)}` : '',
                ]
                  .filter(Boolean)
                  .join('\n');
                if (window.confirm(`معاينة قبل إنشاء عرض السعر:\n\n${preview}\n\nمتابعة؟`)) {
                  createQtn.mutate({});
                }
              }}
            >
              إنشاء عرض / مراجعة جديدة
            </button>
          )}
          <div className="overflow-x-auto rounded-xl border bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-[#F6FBFD]">
                <tr>
                  <th className="px-2 py-2">العرض</th>
                  <th className="px-2 py-2">Rev</th>
                  <th className="px-2 py-2">الحالة</th>
                  <th className="px-2 py-2">الإجمالي</th>
                  <th className="px-2 py-2">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {t.quotations.map((q) => (
                  <tr key={q.id} className="border-t">
                    <td className="px-2 py-2">{q.quotationNumber}</td>
                    <td className="px-2 py-2">{q.revisionNumber}</td>
                    <td className="px-2 py-2">{QUOTATION_STATUS_AR[q.status] ?? q.status}</td>
                    <td className="px-2 py-2">{formatEgp(Number(q.grandTotal))}</td>
                    <td className="px-2 py-2 space-x-1 space-x-reverse">
                      <button type="button" className="text-brand underline text-xs" onClick={() => setSelectedQtnId(q.id)}>
                        فتح
                      </button>
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
              <div>الحالة: {QUOTATION_STATUS_AR[selectedQtn.status] ?? selectedQtn.status}</div>
              <div>Subtotal: {formatEgp(Number(selectedQtn.subtotalSelling))} — Tax: {formatEgp(Number(selectedQtn.taxAmount))} — Grand: {formatEgp(Number(selectedQtn.grandTotal))}</div>
              {selectedQtn.status === 'DRAFT' && !locked && (
                <div className="flex flex-wrap gap-2 items-center">
                  <input
                    type="number"
                    placeholder="خصم"
                    defaultValue={Number(selectedQtn.discountAmount)}
                    onBlur={(e) =>
                      qtnAction.mutate({
                        quotationId: selectedQtn.id,
                        action: 'patch',
                        body: { discountAmount: Number(e.target.value) },
                      })
                    }
                    className="rounded border px-2 py-1 w-32"
                  />
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
                    className="rounded border px-2 py-1 text-xs"
                    title="صالح حتى"
                  />
                </div>
              )}
              <table className="w-full text-xs mt-2">
                <tbody>
                  {selectedQtn.lines.map((l) => (
                    <tr key={l.id} className="border-t">
                      <td>{l.itemCodeSnapshot}</td>
                      <td>{l.descriptionArSnapshot}</td>
                      <td>{formatQty(Number(l.quantitySnapshot))}</td>
                      <td>
                        {selectedQtn.status === 'DRAFT' && !locked ? (
                          <input
                            type="number"
                            className="w-24 rounded border px-1"
                            defaultValue={Number(l.sellingUnitRateSnapshot)}
                            onBlur={(e) =>
                              patchQtnLineRate.mutate({
                                quotationId: selectedQtn.id,
                                tenderBoqItemId: l.tenderBoqItemId,
                                sellingUnitRate: Number(e.target.value),
                              })
                            }
                          />
                        ) : (
                          formatEgp(Number(l.sellingUnitRateSnapshot))
                        )}
                      </td>
                      <td>{formatEgp(Number(l.lineAmountSnapshot))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {selectedQtn.status === 'DRAFT' && sum && sum.sellingValue < sum.directCost && (
                <p className="text-amber-700 text-xs">تحذير: قيمة البيع أقل من التكلفة المباشرة</p>
              )}
            </div>
          )}
        </section>
      )}

      {tab === 'award' && t && (
        <section className="rounded-xl border bg-white p-4 space-y-3 text-sm">
          <h3 className="font-bold">بيانات الترسية والعقد</h3>
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
    </div>
  );
}
