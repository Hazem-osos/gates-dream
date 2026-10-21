'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ExtractsPageChrome } from '@/components/extracts/ExtractsPageChrome';
import { ErpFormHeaderCard, erpInputClass, erpLabelClass, type ErpHeaderMenuItem } from '@/components/erp';
import {
  dataEntryGridBodyCellClass,
  dataEntryGridHeadCellClass,
  dataEntryGridHeadRowClass,
  dataEntryGridWrapClass,
} from '@/components/ui/data-entry-grid/tokens';
import { dateControlClass } from '@/app/components/ui/forms/formTokens';
import { FormSectionCard } from '@/components/ui';
import { apiClient } from '@/lib/api/client';
import { useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';
import { useOwnTabSearchParams } from '@/lib/navigation/tab-route-lock';
import { BOQ_UNIT_LABEL, CLIENT_CONTRACT_STATUS_AR } from '@/lib/contracting/labels';
import {
  contractAdvanceAmountFromPercent,
  contractAdvancePercent,
} from '@/lib/contracting/client-contract-display';
import { withItemCodeHierarchy } from '@/lib/contracting/boq-hierarchy';
import {
  formatEgp,
  formatQty,
  percentInputToRate,
  rateToPercentInput,
  toDateInput,
  toMoney,
} from '@/lib/subcontracts/money';
import { confirmAction } from '@/lib/feedback/confirm';
import { toast } from '@/lib/feedback/toast';
import { cn } from '@/lib/utils';
import {
  isQuotationHeaderItem,
  QUOTATION_DOC_STATUS_AR,
  QUOTATION_STATUS_AR,
} from '@/components/contracting/tender/tender-labels';

type Party = { id: string; arabicName: string; serial?: string | null; code?: string | null };

type BoqRow = {
  id: string;
  itemCode: string;
  descriptionAr: string;
  unit: string;
  contractQuantity: number | string;
  unitSellingPrice: number | string;
  totalSellingPrice: number | string;
  isExecutable?: boolean;
  kind?: string | null;
};

type TenderOption = {
  id: string;
  tenderNumber: string;
  nameAr: string;
  status: string;
  customer: Party;
};

type TenderDetail = TenderOption & {
  description?: string | null;
  location?: string | null;
  consultantName?: string | null;
  projectManagerName?: string | null;
  expectedStart?: string | null;
  expectedEnd?: string | null;
  contractDurationDays?: number | null;
  delayPenaltyRate?: number | string | null;
  boqItems?: Array<{
    id: string;
    itemCode: string;
    descriptionAr: string;
    unit: string;
    quantity: number | string;
    sellingUnitRate: number | string;
    isExecutable?: boolean;
    kind?: string | null;
  }>;
  quotations?: Array<{
    id: string;
    quotationNumber: string;
    revisionNumber: number;
    status: string;
    grandTotal?: number | string;
    discountAmount?: number | string;
    subtotalSelling?: number | string;
  }>;
  award?: {
    clientContract?: { id: string; contractNumber: string } | null;
    project?: { id: string; projectCode: string } | null;
  } | null;
};

type ContractDoc = {
  id: string;
  contractNumber: string;
  contractDate: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'COMPLETED';
  totalContractValue: number | string;
  advancePaymentAmount: number | string;
  advanceRecoveryRate: number | string;
  retentionRate: number | string;
  finalRetentionRate?: number | string;
  engineeringStampsRate: number | string;
  otherDeductionsRate?: number | string;
  otherDeductionsNotes?: string | null;
  plannedStart?: string | null;
  plannedEnd?: string | null;
  contractDurationDays?: number | null;
  delayPenaltyRate?: number | string | null;
  sourceTenderId?: string | null;
  sourceQuotationId?: string | null;
  client?: Party | null;
  project?: { id: string; projectCode: string; projectName: string } | null;
  sourceTender?: {
    id: string;
    tenderNumber: string;
    nameAr: string;
    description?: string | null;
    location?: string | null;
    consultantName?: string | null;
    projectManagerName?: string | null;
    customer?: Party | null;
  } | null;
  sourceQuotation?: {
    id: string;
    quotationNumber: string;
    revisionNumber: number;
    status: string;
    grandTotal?: number | string;
    discountAmount?: number | string;
    subtotalSelling?: number | string;
  } | null;
  boqItems?: BoqRow[];
  deductionLines?: Array<{
    definitionId: string;
    deductionRate: number | string;
    applyOnExtract?: boolean;
    notes?: string | null;
    definition?: { id: string; code: string; nameAr: string };
  }>;
};

type DeductionDefinition = {
  id: string;
  code: string;
  nameAr: string;
  deductionRate: number | string;
};

type ContractDeductionRow = {
  key: string;
  definitionId: string;
  ratePct: string;
  applyOnExtract: boolean;
  notes: string;
};

function newDeductionRow(partial?: Partial<ContractDeductionRow>): ContractDeductionRow {
  return {
    key: partial?.key ?? `ded-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    definitionId: partial?.definitionId ?? '',
    ratePct: partial?.ratePct ?? '0',
    applyOnExtract: partial?.applyOnExtract ?? true,
    notes: partial?.notes ?? '',
  };
}

const PAGE_HREF = '/extracts/operations/client-contract';

function unitLabel(unit: string) {
  return BOQ_UNIT_LABEL[unit as keyof typeof BOQ_UNIT_LABEL] ?? unit;
}

export default function ClientContractPage() {
  const router = useRouter();
  const searchParams = useOwnTabSearchParams();
  const contractId = searchParams.get('id');
  const presetTenderId = searchParams.get('tenderId') ?? '';
  const invalidate = useInvalidateQuery();

  const [tenderId, setTenderId] = useState(presetTenderId);
  const [contractDate, setContractDate] = useState(toDateInput(new Date()));
  const [plannedStart, setPlannedStart] = useState('');
  const [plannedEnd, setPlannedEnd] = useState('');
  const [advanceAmount, setAdvanceAmount] = useState('0');
  const [advancePct, setAdvancePct] = useState('0');
  const [contractDeductionRows, setContractDeductionRows] = useState<ContractDeductionRow[]>(() => [
    newDeductionRow(),
  ]);
  const [recoverFromExtract, setRecoverFromExtract] = useState(true);
  const [status, setStatus] = useState<'ACTIVE' | 'SUSPENDED' | 'COMPLETED'>('ACTIVE');
  const [saving, setSaving] = useState(false);

  const tendersQ = useApiQuery<TenderOption[]>(['contracting-tenders'], '/contracting/tenders');
  const deductionDefsQ = useApiQuery<DeductionDefinition[]>(
    ['contract-deduction-definitions'],
    '/extracts/contract-deduction-definitions',
    undefined,
    { staleTime: 60_000 }
  );
  const deductionDefinitions = deductionDefsQ.data?.data ?? [];

  const contractQ = useApiQuery<ContractDoc>(
    ['client-contract', contractId],
    `/contracting/client-billing/contracts/${contractId}`,
    undefined,
    { enabled: Boolean(contractId) }
  );
  const previewTenderQ = useApiQuery<TenderDetail>(
    ['contract-tender-preview', tenderId],
    `/contracting/tenders/${tenderId}`,
    undefined,
    { enabled: Boolean(tenderId) && !contractId }
  );

  const doc = contractId ? contractQ.data?.data ?? null : null;
  const tenders = tendersQ.data?.data ?? [];
  const previewTender = tenderId && !contractId ? previewTenderQ.data?.data ?? null : null;
  const awardedContractId = previewTender?.award?.clientContract?.id;
  const acceptedQuote = previewTender?.quotations?.find((q) => q.status === 'ACCEPTED') ?? null;
  const locked = doc ? doc.status !== 'ACTIVE' : false;

  useEffect(() => {
    if (contractId || !tenderId || !awardedContractId) return;
    router.replace(`${PAGE_HREF}?id=${awardedContractId}`);
  }, [contractId, tenderId, awardedContractId, router]);

  useEffect(() => {
    if (!doc) return;
    setTenderId(doc.sourceTenderId ?? '');
    setContractDate(toDateInput(doc.contractDate));
    setPlannedStart(toDateInput(doc.plannedStart));
    setPlannedEnd(toDateInput(doc.plannedEnd));
    setAdvanceAmount(String(toMoney(doc.advancePaymentAmount)));
    setAdvancePct(String(contractAdvancePercent(doc.advancePaymentAmount, doc.totalContractValue)));
    const lines = doc.deductionLines ?? [];
    setContractDeductionRows(
      lines.length
        ? lines.map((line) =>
            newDeductionRow({
              definitionId: line.definitionId,
              ratePct: rateToPercentInput(line.deductionRate),
              applyOnExtract: line.applyOnExtract ?? true,
              notes: line.notes ?? '',
            })
          )
        : [newDeductionRow()]
    );
    setRecoverFromExtract(toMoney(doc.advanceRecoveryRate) > 0);
    setStatus(doc.status);
  }, [doc]);

  const tender = doc?.sourceTender ?? previewTender;
  const owner = doc?.client ?? tender?.customer;
  const quotation = doc?.sourceQuotation ?? acceptedQuote;
  const totalValue = doc
    ? toMoney(doc.totalContractValue)
    : toMoney(acceptedQuote?.grandTotal ?? acceptedQuote?.subtotalSelling);

  const onAdvanceAmountChange = (value: string) => {
    setAdvanceAmount(value);
    setAdvancePct(String(contractAdvancePercent(value, totalValue)));
  };

  const onAdvancePctChange = (value: string) => {
    setAdvancePct(value);
    setAdvanceAmount(String(contractAdvanceAmountFromPercent(value, totalValue)));
  };

  const buildDeductionLinesPayload = () =>
    contractDeductionRows
      .filter((row) => row.definitionId)
      .map((row) => ({
        definitionId: row.definitionId,
        deductionRate: percentInputToRate(row.ratePct),
        applyOnExtract: row.applyOnExtract,
        notes: row.notes.trim() || null,
      }));

  const onPickDefinition = (key: string, definitionId: string) => {
    const def = deductionDefinitions.find((d) => d.id === definitionId);
    setContractDeductionRows((rows) =>
      rows.map((row) =>
        row.key === key
          ? {
              ...row,
              definitionId,
              ratePct: def ? rateToPercentInput(def.deductionRate) : row.ratePct,
            }
          : row
      )
    );
  };

  const lines = useMemo(() => {
    const raw = doc?.boqItems?.length
      ? doc.boqItems.map((row) => ({
          key: row.id,
          itemCode: row.itemCode,
          descriptionAr: row.descriptionAr,
          unit: row.unit,
          quantity: toMoney(row.contractQuantity),
          rate: toMoney(row.unitSellingPrice),
          amount: toMoney(row.totalSellingPrice) || toMoney(row.contractQuantity) * toMoney(row.unitSellingPrice),
          isExecutable: row.isExecutable,
          kind: row.kind,
        }))
      : (previewTender?.boqItems ?? []).map((row) => ({
          key: row.id,
          itemCode: row.itemCode,
          descriptionAr: row.descriptionAr,
          unit: row.unit,
          quantity: toMoney(row.quantity),
          rate: toMoney(row.sellingUnitRate),
          amount: toMoney(row.quantity) * toMoney(row.sellingUnitRate),
          isExecutable: row.isExecutable,
          kind: row.kind,
        }));
    return withItemCodeHierarchy(raw, (row) => row.itemCode, {
      id: (row) => row.key,
      isExecutable: (row) => row.isExecutable,
    }).filter((row) => row.__isParent || isQuotationHeaderItem(row.kind, row.isExecutable));
  }, [doc, previewTender]);

  const statusLabel = doc
    ? CLIENT_CONTRACT_STATUS_AR[doc.status]
    : acceptedQuote
      ? 'جاهز للترسية'
      : 'جديد';

  const goTo = (id?: string | null, nextTenderId?: string) => {
    const params = new URLSearchParams();
    if (id) params.set('id', id);
    else if (nextTenderId) params.set('tenderId', nextTenderId);
    const qs = params.toString();
    router.replace(qs ? `${PAGE_HREF}?${qs}` : PAGE_HREF);
  };

  const refresh = () => {
    invalidate(['client-contract', contractId]);
    invalidate(['client-contracts']);
    invalidate(['contract-tender-preview', tenderId]);
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      if (!contractId) {
        if (!tenderId || !acceptedQuote) {
          toast.error('اعتمد عرض سعر للعطاء أولاً ثم أنشئ التعاقد');
          return;
        }
        const ok = await confirmAction({
          title: 'ترسية العطاء وإنشاء التعاقد',
          message: 'سيتم إنشاء عقد المالك والمشروع وجدول الكميات من العرض المعتمد.',
          confirmLabel: 'إنشاء التعاقد',
        });
        if (!ok) return;
        const awarded = await apiClient.post<{
          clientContract?: { id: string };
        }>(`/contracting/tenders/${tenderId}/award`, {
          quotationId: acceptedQuote.id,
          idempotencyKey: `award-ui-${tenderId}-${Date.now()}`,
        });
        const id = awarded.data?.clientContract?.id;
        if (!id) {
          toast.error('تعذر إنشاء التعاقد');
          return;
        }
        await apiClient.patch(`/contracting/client-billing/contracts/${id}`, {
          contractDate: contractDate || undefined,
          plannedStart: plannedStart || null,
          plannedEnd: plannedEnd || null,
          advancePaymentAmount: toMoney(advanceAmount),
          advanceRecoveryRate: recoverFromExtract ? 1 : 0,
          deductionLines: buildDeductionLinesPayload(),
          status,
        });
        invalidate(['client-contracts']);
        goTo(id);
        return;
      }
      if (locked && status === doc?.status) {
        toast.error('العقد غير ساري — عدّل حالة التعامل أولاً');
        return;
      }
      await apiClient.patch(`/contracting/client-billing/contracts/${contractId}`, {
        contractDate: contractDate || undefined,
        plannedStart: plannedStart || null,
        plannedEnd: plannedEnd || null,
        advancePaymentAmount: toMoney(advanceAmount),
        advanceRecoveryRate: recoverFromExtract ? Math.max(toMoney(doc?.advanceRecoveryRate) || 1, 0.000001) : 0,
        deductionLines: buildDeductionLinesPayload(),
        status,
      });
      refresh();
    } catch {
      /* apiClient already surfaces the error */
    } finally {
      setSaving(false);
    }
  };

  const moreMenuItems: ErpHeaderMenuItem[] = [
    ...(doc?.project?.id
      ? [{ id: 'project', label: 'فتح المشروع', onClick: () => router.push(`/contracting/projects/${doc.project!.id}`) }]
      : []),
    ...(doc?.sourceTenderId || tenderId
      ? [
          {
            id: 'tender',
            label: 'فتح العطاء',
            onClick: () => router.push(`/contracting/tenders/${doc?.sourceTenderId || tenderId}`),
          },
        ]
      : []),
    ...(quotation && !doc
      ? [
          {
            id: 'quote',
            label: 'فتح عرض السعر',
            onClick: () => router.push(`/extracts/operations/tender-price-quote?id=${quotation.id}`),
          },
        ]
      : []),
    ...(doc?.sourceQuotationId
      ? [
          {
            id: 'quote-doc',
            label: 'فتح عرض السعر',
            onClick: () => router.push(`/extracts/operations/tender-price-quote?id=${doc.sourceQuotationId}`),
          },
        ]
      : []),
    { id: 'print', label: 'طباعة', onClick: () => window.print() },
  ];

  return (
    <ExtractsPageChrome
      title="تعاقد مع العميل"
      breadcrumbs={[
        { href: '/extracts', label: 'المستخلصات' },
        { href: '/contracting', label: 'المقاولات' },
        { href: '/contracting/tenders', label: 'العطاءات' },
        { label: 'تعاقد مع العميل' },
      ]}
      statusLabel={statusLabel}
      docNumber={doc?.contractNumber}
      favoriteHref={PAGE_HREF}
      currentId={contractId}
      onNew={() => {
        setTenderId('');
        setContractDate(toDateInput(new Date()));
        setPlannedStart('');
        setPlannedEnd('');
        setAdvanceAmount('0');
        setAdvancePct('0');
        setContractDeductionRows([newDeductionRow()]);
        setRecoverFromExtract(true);
        setStatus('ACTIVE');
        goTo(null);
      }}
      onSave={() => void save()}
      savePending={saving}
      canSave={Boolean(contractId ? true : tenderId && acceptedQuote)}
      saveLabel={contractId ? 'حفظ' : 'ترسية وإنشاء التعاقد'}
      moreMenuItems={moreMenuItems}
      browseList={{
        title: 'التعاقدات السابقة',
        apiPath: '/contracting/client-billing/contracts',
        listKey: 'client-contracts',
        selectedId: contractId,
        columns: [
          { id: 'contractNumber', header: 'رقم التعاقد', getValue: (row) => String(row.contractNumber ?? '') },
          {
            id: 'owner',
            header: 'المالك',
            getValue: (row) => String((row.client as { arabicName?: string } | undefined)?.arabicName ?? ''),
          },
          {
            id: 'tenderNumber',
            header: 'رقم العطاء',
            getValue: (row) =>
              String((row.sourceTender as { tenderNumber?: string } | undefined)?.tenderNumber ?? ''),
          },
          {
            id: 'status',
            header: 'الحالة',
            getValue: (row) =>
              CLIENT_CONTRACT_STATUS_AR[String(row.status) as keyof typeof CLIENT_CONTRACT_STATUS_AR] ??
              String(row.status ?? ''),
          },
          {
            id: 'totalContractValue',
            header: 'قيمة التعاقد',
            getValue: (row) => formatEgp(row.totalContractValue as number | string | null),
          },
        ],
        onSelect: (id) => goTo(id),
      }}
    >
      {contractQ.isError ? <p className="text-sm text-destructive">تعذر تحميل التعاقد.</p> : null}

      <ErpFormHeaderCard
        extrasLabel="بيانات العطاء وعرض السعر"
        extras={
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className={erpLabelClass}>العنوان</label>
              <input className={erpInputClass} value={tender?.location ?? ''} readOnly disabled />
            </div>
            <div>
              <label className={erpLabelClass}>مدير المشروع</label>
              <input className={erpInputClass} value={tender?.projectManagerName ?? ''} readOnly disabled />
            </div>
            <div>
              <label className={erpLabelClass}>الاستشاري العام</label>
              <input className={erpInputClass} value={tender?.consultantName ?? ''} readOnly disabled />
            </div>
            <div>
              <label className={erpLabelClass}>المشروع</label>
              <input className={erpInputClass} value={doc?.project?.projectName ?? tender?.nameAr ?? ''} readOnly disabled />
            </div>
            <div>
              <label className={erpLabelClass}>رقم التسعير / عرض السعر</label>
              <input
                className={erpInputClass}
                value={quotation ? `${quotation.quotationNumber} / ${quotation.revisionNumber}` : ''}
                readOnly
                disabled
              />
            </div>
            <div>
              <label className={erpLabelClass}>حالة عرض السعر</label>
              <input
                className={erpInputClass}
                value={
                  quotation
                    ? QUOTATION_DOC_STATUS_AR[quotation.status] ?? QUOTATION_STATUS_AR[quotation.status] ?? quotation.status
                    : ''
                }
                readOnly
                disabled
              />
            </div>
            <div>
              <label className={erpLabelClass}>نوع العقد</label>
              <input className={erpInputClass} value="عقد تنفيذ" readOnly disabled />
            </div>
            <div className="sm:col-span-2">
              <label className={erpLabelClass}>وصف العطاء</label>
              <input className={erpInputClass} value={tender?.description ?? tender?.nameAr ?? ''} readOnly disabled />
            </div>
          </div>
        }
        row1={
          <>
            <div>
              <label className={erpLabelClass}>العطاء</label>
              <select
                className={erpInputClass}
                value={tenderId}
                disabled={Boolean(contractId)}
                onChange={(e) => {
                  const next = e.target.value;
                  setTenderId(next);
                  if (!contractId) goTo(null, next || undefined);
                }}
              >
                <option value="">— اختر العطاء —</option>
                {tenders.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.tenderNumber} — {row.nameAr} — {row.customer.arabicName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={erpLabelClass}>تاريخ التحرير</label>
              <input
                type="date"
                className={cn(erpInputClass, dateControlClass)}
                value={contractDate}
                onChange={(e) => setContractDate(e.target.value)}
                disabled={locked}
              />
            </div>
            <div>
              <label className={erpLabelClass}>تاريخ الاستلام الابتدائي</label>
              <input
                type="date"
                className={cn(erpInputClass, dateControlClass)}
                value={plannedStart}
                onChange={(e) => setPlannedStart(e.target.value)}
                disabled={locked}
              />
            </div>
            <div>
              <label className={erpLabelClass}>تاريخ الاستلام النهائي</label>
              <input
                type="date"
                className={cn(erpInputClass, dateControlClass)}
                value={plannedEnd}
                onChange={(e) => setPlannedEnd(e.target.value)}
                disabled={locked}
              />
            </div>
          </>
        }
        row2={
          <>
            <div>
              <label className={erpLabelClass}>رقم التعاقد</label>
              <input className={erpInputClass} value={doc?.contractNumber ?? ''} readOnly disabled />
            </div>
            <div>
              <label className={erpLabelClass}>رقم العطاء</label>
              <input className={erpInputClass} value={tender?.tenderNumber ?? ''} readOnly disabled />
            </div>
            <div>
              <label className={erpLabelClass}>المالك</label>
              <input className={erpInputClass} value={owner?.arabicName ?? ''} readOnly disabled />
            </div>
            <div>
              <label className={erpLabelClass}>كود المالك</label>
              <input className={erpInputClass} value={owner?.serial || owner?.code || ''} readOnly disabled />
            </div>
          </>
        }
      />

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <FormSectionCard title="قيمة التعاقد والتحصيل">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={erpLabelClass}>إجمالي قيمة التعاقد</label>
              <input className={erpInputClass} value={totalValue ? formatEgp(totalValue) : ''} readOnly disabled />
            </div>
            <div>
              <label className={erpLabelClass}>قيمة الدفعة المقدمة</label>
              <input
                type="number"
                className={erpInputClass}
                value={advanceAmount}
                onChange={(e) => onAdvanceAmountChange(e.target.value)}
                disabled={locked}
              />
            </div>
            <div>
              <label className={erpLabelClass}>نسبة الدفعة المقدمة</label>
              <input
                type="number"
                className={erpInputClass}
                value={advancePct}
                onChange={(e) => onAdvancePctChange(e.target.value)}
                disabled={locked}
              />
            </div>
            <div>
              <label className={erpLabelClass}>إيقافات التعامل</label>
              <select
                className={erpInputClass}
                value={status}
                onChange={(e) => setStatus(e.target.value as typeof status)}
              >
                <option value="ACTIVE">ساري</option>
                <option value="SUSPENDED">موقوف</option>
                <option value="COMPLETED">مكتمل</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className={erpLabelClass}>طريقة التحصيل</label>
              <div className="flex flex-wrap gap-4 pt-1 text-sm">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    name="collection"
                    checked={recoverFromExtract}
                    onChange={() => setRecoverFromExtract(true)}
                    disabled={locked}
                  />
                  على المستخلص
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    name="collection"
                    checked={!recoverFromExtract}
                    onChange={() => setRecoverFromExtract(false)}
                    disabled={locked}
                  />
                  على العقد
                </label>
              </div>
            </div>
          </div>
        </FormSectionCard>

        <FormSectionCard title="خصومات العقد على المستخلص" subtitle="اختر الخصومات من شاشة تعريف الخصومات">
          <p className="mb-2 text-sm sm:col-span-2">
            <Link href="/extracts/operations/contract-deduction-definition" className="font-semibold text-[#0E78AA] underline">
              فتح تعريف الخصومات
            </Link>
          </p>
          <div className="mb-2 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={locked}
              onClick={() => setContractDeductionRows((rows) => [...rows, newDeductionRow()])}
            >
              إضافة خصم
            </Button>
          </div>
          <div className={dataEntryGridWrapClass}>
            <table className="min-w-full text-sm">
              <thead className={dataEntryGridHeadRowClass}>
                <tr>
                  <th className={dataEntryGridHeadCellClass}>الخصم</th>
                  <th className={dataEntryGridHeadCellClass}>النسبة %</th>
                  <th className={dataEntryGridHeadCellClass}>القيمة</th>
                  <th className={dataEntryGridHeadCellClass}>من المستخلص</th>
                  <th className={dataEntryGridHeadCellClass}>التفاصيل</th>
                  {!locked ? <th className={dataEntryGridHeadCellClass} /> : null}
                </tr>
              </thead>
              <tbody>
                <tr className="bg-[#F6FBFD]">
                  <td className={dataEntryGridBodyCellClass}>دفعة مقدمة</td>
                  <td className={cn(dataEntryGridBodyCellClass, 'tabular-nums text-end')}>{advancePct}</td>
                  <td className={cn(dataEntryGridBodyCellClass, 'tabular-nums text-end')}>{formatEgp(advanceAmount)}</td>
                  <td className={dataEntryGridBodyCellClass}>{recoverFromExtract ? 'نعم' : 'لا'}</td>
                  <td className={dataEntryGridBodyCellClass} />
                  {!locked ? <td className={dataEntryGridBodyCellClass} /> : null}
                </tr>
                {contractDeductionRows.map((row) => {
                  const def = deductionDefinitions.find((d) => d.id === row.definitionId);
                  const rate = percentInputToRate(row.ratePct);
                  return (
                    <tr key={row.key}>
                      <td className={dataEntryGridBodyCellClass}>
                        <select
                          className={erpInputClass}
                          value={row.definitionId}
                          disabled={locked}
                          onChange={(e) => onPickDefinition(row.key, e.target.value)}
                        >
                          <option value="">— اختر خصماً —</option>
                          {deductionDefinitions.map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.code} — {d.nameAr}
                            </option>
                          ))}
                        </select>
                        {def ? <p className="mt-0.5 text-[10px] text-slate-500">{def.code}</p> : null}
                      </td>
                      <td className={dataEntryGridBodyCellClass}>
                        <input
                          type="number"
                          className={erpInputClass}
                          value={row.ratePct}
                          disabled={locked || !row.definitionId}
                          onChange={(e) =>
                            setContractDeductionRows((rows) =>
                              rows.map((r) => (r.key === row.key ? { ...r, ratePct: e.target.value } : r))
                            )
                          }
                        />
                      </td>
                      <td className={cn(dataEntryGridBodyCellClass, 'tabular-nums text-end')}>
                        {row.definitionId ? formatEgp(totalValue * rate) : '—'}
                      </td>
                      <td className={dataEntryGridBodyCellClass}>
                        <input
                          type="checkbox"
                          checked={row.applyOnExtract}
                          disabled={locked || !row.definitionId}
                          onChange={(e) =>
                            setContractDeductionRows((rows) =>
                              rows.map((r) =>
                                r.key === row.key ? { ...r, applyOnExtract: e.target.checked } : r
                              )
                            )
                          }
                        />
                      </td>
                      <td className={dataEntryGridBodyCellClass}>
                        <input
                          className={erpInputClass}
                          value={row.notes}
                          disabled={locked || !row.definitionId}
                          onChange={(e) =>
                            setContractDeductionRows((rows) =>
                              rows.map((r) => (r.key === row.key ? { ...r, notes: e.target.value } : r))
                            )
                          }
                          placeholder="تفاصيل"
                        />
                      </td>
                      {!locked ? (
                        <td className={dataEntryGridBodyCellClass}>
                          <button
                            type="button"
                            className="text-xs text-red-600"
                            disabled={contractDeductionRows.length <= 1}
                            onClick={() =>
                              setContractDeductionRows((rows) => rows.filter((r) => r.key !== row.key))
                            }
                          >
                            حذف
                          </button>
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </FormSectionCard>
      </div>

      <FormSectionCard title="بنود التعاقد" className="mt-3">
        <div className={dataEntryGridWrapClass}>
          <table className="min-w-full text-sm">
            <thead className={dataEntryGridHeadRowClass}>
              <tr>
                <th className={dataEntryGridHeadCellClass}>البند</th>
                <th className={dataEntryGridHeadCellClass}>الكود</th>
                <th className={dataEntryGridHeadCellClass}>الوحدة</th>
                <th className={dataEntryGridHeadCellClass}>الكمية</th>
                <th className={dataEntryGridHeadCellClass}>سعر بعد الخصومات والإضافات</th>
                <th className={dataEntryGridHeadCellClass}>الإجمالي</th>
              </tr>
            </thead>
            <tbody>
              {lines.length === 0 ? (
                <tr>
                  <td className={cn(dataEntryGridBodyCellClass, 'py-6 text-center text-muted-foreground')} colSpan={6}>
                    {tenderId ? 'لا توجد بنود رئيسية على هذا العطاء.' : 'اختر عطاءً لعرض بنود التعاقد.'}
                  </td>
                </tr>
              ) : (
                lines.map((line) => (
                  <tr key={line.key}>
                    <td className={dataEntryGridBodyCellClass}>{line.descriptionAr}</td>
                    <td className={dataEntryGridBodyCellClass}>{line.itemCode}</td>
                    <td className={dataEntryGridBodyCellClass}>{unitLabel(line.unit)}</td>
                    <td className={cn(dataEntryGridBodyCellClass, 'tabular-nums text-end')}>{formatQty(line.quantity)}</td>
                    <td className={cn(dataEntryGridBodyCellClass, 'tabular-nums text-end font-semibold text-[#094C6B]')}>
                      {formatEgp(line.rate)}
                    </td>
                    <td className={cn(dataEntryGridBodyCellClass, 'tabular-nums text-end font-semibold text-[#094C6B]')}>
                      {formatEgp(line.amount)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          الإضافات على العقد (زيادة كميات / فرق أسعار) تتم من أوامر التغيير، وليس من بنود الأساس.
        </p>
      </FormSectionCard>
    </ExtractsPageChrome>
  );
}
