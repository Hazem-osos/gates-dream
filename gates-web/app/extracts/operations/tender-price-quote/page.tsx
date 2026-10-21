'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ExtractsPageChrome } from '@/components/extracts/ExtractsPageChrome';
import {
  ErpFormHeaderCard,
  erpInputClass,
  erpLabelClass,
  type ErpHeaderMenuItem,
} from '@/components/erp';
import {
  dataEntryGridBodyCellClass,
  dataEntryGridHeadCellClass,
  dataEntryGridHeadRowClass,
  dataEntryGridNumericInputClass,
  dataEntryGridWrapClass,
} from '@/components/ui/data-entry-grid/tokens';
import { dateControlClass } from '@/app/components/ui/forms/formTokens';
import { FormSectionCard } from '@/components/ui';
import { apiClient } from '@/lib/api/client';
import { useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';
import { useOwnTabSearchParams } from '@/lib/navigation/tab-route-lock';
import { BOQ_UNIT_LABEL } from '@/lib/contracting/labels';
import { formatEgp, formatQty, toMoney } from '@/lib/subcontracts/money';
import { confirmAction } from '@/lib/feedback/confirm';
import { toast } from '@/lib/feedback/toast';
import { cn } from '@/lib/utils';
import {
  QUOTATION_DOC_STATUS_AR,
  QUOTATION_STATUS_AR,
  isQuotationHeaderItem,
  quotationLineKindLabel,
  tenderIsLocked,
} from '@/components/contracting/tender/tender-labels';

type TenderOption = {
  id: string;
  tenderNumber: string;
  nameAr: string;
  status: string;
  description?: string | null;
  customer: { id: string; arabicName: string; serial?: string | null; code?: string | null };
};

type BoqItem = {
  id: string;
  itemCode: string;
  descriptionAr: string;
  unit: string;
  quantity: number | string;
  sellingUnitRate: number | string;
  kind?: string | null;
  isExecutable?: boolean;
  notes?: string | null;
};

type QuotationLine = {
  id: string;
  tenderBoqItemId: string;
  itemCodeSnapshot: string;
  descriptionArSnapshot: string;
  unitSnapshot: string;
  quantitySnapshot: number | string;
  sellingUnitRateSnapshot: number | string;
  lineAmountSnapshot: number | string;
  tenderBoqItem?: {
    kind?: string | null;
    notes?: string | null;
    isExecutable?: boolean;
    sectionName?: string | null;
  } | null;
};

type QuotationDoc = {
  id: string;
  quotationNumber: string;
  revisionNumber: number;
  status: string;
  notes?: string | null;
  quoteDate?: string | null;
  validUntil?: string | null;
  paymentTerms?: string | null;
  deliveryTerms?: string | null;
  discountAmount?: number | string | null;
  subtotalSelling?: number | string | null;
  grandTotal?: number | string | null;
  totalDirectCost?: number | string | null;
  createdAt: string;
  submittedAt?: string | null;
  tenderId: string;
  lines: QuotationLine[];
  tender: TenderOption & {
    description?: string | null;
    boqItems?: BoqItem[];
  };
};

type GridLine = {
  key: string;
  tenderBoqItemId: string;
  itemCode: string;
  descriptionAr: string;
  unit: string;
  quantity: number;
  rate: number;
  amount: number;
  kindLabel: string;
  notes: string;
  kind?: string | null;
  isExecutable?: boolean | null;
};

const PAGE_HREF = '/extracts/operations/tender-price-quote';

function unitLabel(unit: string) {
  return BOQ_UNIT_LABEL[unit as keyof typeof BOQ_UNIT_LABEL] ?? unit;
}

function toDateInput(value?: string | null) {
  if (!value) return '';
  return value.slice(0, 10);
}

function todayInputDate() {
  return new Date().toISOString().slice(0, 10);
}

function isHeaderBoq(item: { kind?: string | null; isExecutable?: boolean | null }) {
  return isQuotationHeaderItem(item.kind, item.isExecutable);
}

export default function TenderPriceQuotePage() {
  const router = useRouter();
  const searchParams = useOwnTabSearchParams();
  const quotationId = searchParams.get('id');
  const presetTenderId = searchParams.get('tenderId') ?? '';
  const invalidate = useInvalidateQuery();

  const [tenderId, setTenderId] = useState(presetTenderId);
  const [notes, setNotes] = useState('');
  const [quoteDate, setQuoteDate] = useState(todayInputDate);
  const [validUntil, setValidUntil] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('');
  const [deliveryTerms, setDeliveryTerms] = useState('');
  const [discountAmount, setDiscountAmount] = useState('0');
  const [saving, setSaving] = useState(false);

  const tendersQ = useApiQuery<TenderOption[]>(['contracting-tenders'], '/contracting/tenders');
  const quotationQ = useApiQuery<QuotationDoc>(
    ['contract-quotation', quotationId],
    `/contracting/tenders/quotations/${quotationId}`,
    undefined,
    { enabled: Boolean(quotationId) }
  );
  const previewTenderQ = useApiQuery<TenderOption & { description?: string | null; boqItems?: BoqItem[] }>(
    ['contract-tender-preview', tenderId],
    `/contracting/tenders/${tenderId}`,
    undefined,
    { enabled: Boolean(tenderId) && !quotationId }
  );

  const qtn = quotationQ.data?.data ?? null;
  const tenders = tendersQ.data?.data ?? [];
  const previewTender = previewTenderQ.data?.data ?? null;
  const tender = qtn?.tender ?? previewTender;
  const locked = Boolean(qtn && qtn.status !== 'DRAFT') || tenderIsLocked(tender?.status ?? '');
  const isDraft = qtn?.status === 'DRAFT';

  useEffect(() => {
    if (!qtn) return;
    setTenderId(qtn.tenderId);
    setNotes(qtn.notes ?? '');
    setQuoteDate(toDateInput(qtn.quoteDate ?? qtn.createdAt) || todayInputDate());
    setValidUntil(toDateInput(qtn.validUntil));
    setPaymentTerms(qtn.paymentTerms ?? '');
    setDeliveryTerms(qtn.deliveryTerms ?? '');
    setDiscountAmount(String(toMoney(qtn.discountAmount)));
  }, [qtn]);

  useEffect(() => {
    if (quotationId || !presetTenderId) return;
    setTenderId(presetTenderId);
  }, [quotationId, presetTenderId]);

  const lines: GridLine[] = useMemo(() => {
    const boq = (qtn?.tender.boqItems ?? previewTender?.boqItems ?? []) as BoqItem[];
    const boqById = new Map(boq.map((item) => [item.id, item]));
    const notesByCode = new Map(boq.map((item) => [item.itemCode, item.notes ?? '']));

    const raw: GridLine[] =
      qtn && qtn.status !== 'DRAFT' && qtn.lines.length
        ? qtn.lines.map((line) => {
            const qty = toMoney(line.quantitySnapshot);
            const rate = toMoney(line.sellingUnitRateSnapshot);
            const boqItem = boqById.get(line.tenderBoqItemId);
            const kind = line.tenderBoqItem?.kind ?? boqItem?.kind;
            const isExecutable = line.tenderBoqItem?.isExecutable ?? boqItem?.isExecutable;
            return {
              key: line.id,
              tenderBoqItemId: line.tenderBoqItemId,
              itemCode: line.itemCodeSnapshot,
              descriptionAr: line.descriptionArSnapshot,
              unit: line.unitSnapshot,
              quantity: qty,
              rate,
              amount: toMoney(line.lineAmountSnapshot) || qty * rate,
              kindLabel: quotationLineKindLabel(kind, isExecutable),
              notes:
                line.tenderBoqItem?.notes ??
                boqItem?.notes ??
                notesByCode.get(line.itemCodeSnapshot) ??
                '',
              kind,
              isExecutable,
            };
          })
        : boq.map((item) => {
            const qty = toMoney(item.quantity);
            const rate = toMoney(item.sellingUnitRate);
            return {
              key: item.id,
              tenderBoqItemId: item.id,
              itemCode: item.itemCode,
              descriptionAr: item.descriptionAr,
              unit: item.unit,
              quantity: qty,
              rate,
              amount: qty * rate,
              kindLabel: quotationLineKindLabel(item.kind, item.isExecutable),
              notes: item.notes ?? '',
              kind: item.kind,
              isExecutable: item.isExecutable,
            };
          });

    return raw.filter((line) => isHeaderBoq({ kind: line.kind, isExecutable: line.isExecutable }));
  }, [qtn, previewTender]);

  const subtotal = useMemo(
    () => (qtn ? toMoney(qtn.subtotalSelling) : lines.reduce((sum, line) => sum + line.amount, 0)),
    [qtn, lines]
  );
  const discount = toMoney(discountAmount);
  const grandTotal = qtn ? toMoney(qtn.grandTotal) : Math.max(0, subtotal - discount);
  const ownerCode = tender?.customer.serial || tender?.customer.code || '';
  const statusLabel = qtn
    ? QUOTATION_DOC_STATUS_AR[qtn.status] ?? QUOTATION_STATUS_AR[qtn.status] ?? qtn.status
    : 'جديد';

  const goTo = (id?: string | null, nextTenderId?: string) => {
    const params = new URLSearchParams();
    if (id) params.set('id', id);
    else if (nextTenderId) params.set('tenderId', nextTenderId);
    const qs = params.toString();
    router.replace(qs ? `${PAGE_HREF}?${qs}` : PAGE_HREF);
  };

  const refreshQuote = () => {
    invalidate(['contract-quotation', quotationId]);
    invalidate(['contracting-quotations']);
    invalidate(['contract-tender-preview', tenderId]);
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      if (!quotationId) {
        if (!tenderId) {
          toast.error('اختر العطاء أولاً');
          return;
        }
        const created = await apiClient.post<{ id: string }>(`/contracting/tenders/${tenderId}/quotations`, {
          quoteDate: quoteDate || null,
        });
        const id = created.data?.id;
        if (!id) {
          toast.error('تعذر إنشاء عرض السعر');
          return;
        }
        await apiClient.patch(`/contracting/tenders/quotations/${id}`, {
          notes: notes.trim() || null,
          quoteDate: quoteDate || null,
          validUntil: validUntil || null,
          paymentTerms: paymentTerms.trim() || null,
          deliveryTerms: deliveryTerms.trim() || null,
          discountAmount: discount,
        });
        invalidate(['contracting-quotations']);
        goTo(id);
        return;
      }
      if (!isDraft) {
        toast.error('لا يمكن تعديل عرض مُرسل أو معتمد');
        return;
      }
      await apiClient.patch(`/contracting/tenders/quotations/${quotationId}`, {
        notes: notes.trim() || null,
        quoteDate: quoteDate || null,
        validUntil: validUntil || null,
        paymentTerms: paymentTerms.trim() || null,
        deliveryTerms: deliveryTerms.trim() || null,
        discountAmount: discount,
      });
      refreshQuote();
    } catch {
      /* apiClient already surfaces the error */
    } finally {
      setSaving(false);
    }
  };

  const patchLineRate = async (tenderBoqItemId: string, sellingUnitRate: number) => {
    if (!quotationId || !isDraft || locked) return;
    try {
      await apiClient.post(`/contracting/tenders/quotations/${quotationId}/line-rate`, {
        tenderBoqItemId,
        sellingUnitRate,
      });
      refreshQuote();
    } catch {
      /* apiClient already surfaces the error */
    }
  };

  const runAction = async (action: 'submit' | 'accept' | 'reject') => {
    if (!quotationId) return;
    const ok = await confirmAction({
      title: action === 'reject' ? 'رفض عرض السعر' : action === 'accept' ? 'اعتماد عرض السعر' : 'إرسال عرض السعر',
      message:
        action === 'submit'
          ? 'سيتم تثبيت بنود العرض وإرسالها. لا يمكن تعديل الأسعار بعد الإرسال.'
          : action === 'accept'
            ? 'سيتم اعتماد هذا الإصدار كعرض نهائي لهذا العطاء.'
            : 'سيتم رفض هذا الإصدار.',
      confirmLabel: action === 'reject' ? 'رفض' : 'متابعة',
      tone: action === 'reject' ? 'danger' : 'info',
    });
    if (!ok) return;
    try {
      await apiClient.post(`/contracting/tenders/quotations/${quotationId}/${action}`, {});
      refreshQuote();
    } catch {
      /* apiClient already surfaces the error */
    }
  };

  const moreMenuItems: ErpHeaderMenuItem[] = [
    ...(qtn?.status === 'DRAFT'
      ? [{ id: 'submit', label: 'إرسال العرض', onClick: () => void runAction('submit') }]
      : []),
    ...(qtn?.status === 'SUBMITTED'
      ? [
          { id: 'accept', label: 'اعتماد كعرض نهائي', onClick: () => void runAction('accept') },
          { id: 'reject', label: 'رفض', onClick: () => void runAction('reject'), destructive: true },
        ]
      : []),
    ...(qtn
      ? [{ id: 'open-tender', label: 'فتح العطاء', onClick: () => router.push(`/contracting/tenders/${qtn.tenderId}`) }]
      : []),
    { id: 'print', label: 'طباعة', onClick: () => window.print() },
  ];

  return (
    <ExtractsPageChrome
      title="عرض سعر"
      breadcrumbs={[
        { href: '/extracts', label: 'المستخلصات' },
        { href: '/contracting', label: 'المقاولات' },
        { href: '/contracting/tenders', label: 'العطاءات' },
        { label: 'عرض سعر' },
      ]}
      statusLabel={statusLabel}
      docNumber={qtn?.quotationNumber}
      favoriteHref={PAGE_HREF}
      currentId={quotationId}
      onNew={() => {
        setTenderId('');
        setNotes('');
        setQuoteDate(todayInputDate());
        setValidUntil('');
        setPaymentTerms('');
        setDeliveryTerms('');
        setDiscountAmount('0');
        goTo(null);
      }}
      onSave={() => void save()}
      savePending={saving}
      canSave={Boolean(quotationId ? isDraft && !locked : tenderId)}
      saveLabel={quotationId ? 'حفظ' : 'إنشاء عرض السعر'}
      moreMenuItems={moreMenuItems}
      browseList={{
        title: 'عروض الأسعار السابقة',
        apiPath: '/contracting/tenders/quotations',
        listKey: 'contracting-quotations',
        selectedId: quotationId,
        columns: [
          { id: 'quotationNumber', header: 'رقم العرض', getValue: (row) => String(row.quotationNumber ?? '') },
          {
            id: 'quoteDate',
            header: 'تاريخ العرض',
            getValue: (row) => String(row.quoteDate ?? row.createdAt ?? '').slice(0, 10),
          },
          {
            id: 'tenderNumber',
            header: 'رقم العطاء',
            getValue: (row) => String((row.tender as { tenderNumber?: string } | undefined)?.tenderNumber ?? ''),
          },
          {
            id: 'owner',
            header: 'المالك',
            getValue: (row) =>
              String((row.tender as { customer?: { arabicName?: string } } | undefined)?.customer?.arabicName ?? ''),
          },
          {
            id: 'status',
            header: 'الحالة',
            getValue: (row) =>
              QUOTATION_DOC_STATUS_AR[String(row.status)] ?? QUOTATION_STATUS_AR[String(row.status)] ?? String(row.status ?? ''),
          },
          {
            id: 'grandTotal',
            header: 'الإجمالي',
            getValue: (row) => formatEgp(row.grandTotal as number | string | null),
          },
        ],
        onSelect: (id) => goTo(id),
      }}
    >
      {quotationQ.isError ? (
        <p className="text-sm text-destructive">تعذر تحميل عرض السعر.</p>
      ) : null}

      <ErpFormHeaderCard
        extrasLabel="بيانات التسعير والعطاء"
        extras={
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className={erpLabelClass}>سبب حالة المراجعة</label>
              <input
                className={erpInputClass}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={locked || Boolean(quotationId && !isDraft)}
              />
            </div>
            <div>
              <label className={erpLabelClass}>صالح حتى</label>
              <input
                type="date"
                className={cn(erpInputClass, dateControlClass)}
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                disabled={locked || Boolean(quotationId && !isDraft)}
              />
            </div>
            <div>
              <label className={erpLabelClass}>شروط الدفع</label>
              <input
                className={erpInputClass}
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value)}
                disabled={locked || Boolean(quotationId && !isDraft)}
              />
            </div>
            <div>
              <label className={erpLabelClass}>شروط التوريد</label>
              <input
                className={erpInputClass}
                value={deliveryTerms}
                onChange={(e) => setDeliveryTerms(e.target.value)}
                disabled={locked || Boolean(quotationId && !isDraft)}
              />
            </div>
            <div>
              <label className={erpLabelClass}>الخصم</label>
              <input
                type="number"
                className={erpInputClass}
                value={discountAmount}
                onChange={(e) => setDiscountAmount(e.target.value)}
                disabled={locked || Boolean(quotationId && !isDraft)}
              />
            </div>
            <div>
              <label className={erpLabelClass}>نوع العطاء</label>
              <input className={erpInputClass} value={tender?.nameAr ?? ''} readOnly disabled />
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
                disabled={Boolean(quotationId)}
                onChange={(e) => {
                  const next = e.target.value;
                  setTenderId(next);
                  if (!quotationId) goTo(null, next || undefined);
                }}
              >
                <option value="">— اختر العطاء —</option>
                {tenders.map((row) => (
                  <option key={row.id} value={row.id} disabled={tenderIsLocked(row.status)}>
                    {row.tenderNumber} — {row.nameAr} — {row.customer.arabicName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={erpLabelClass}>تاريخ العرض</label>
              <input
                type="date"
                className={cn(erpInputClass, dateControlClass)}
                value={quoteDate}
                onChange={(e) => setQuoteDate(e.target.value)}
                disabled={locked || Boolean(quotationId && !isDraft)}
              />
            </div>
            <div>
              <label className={erpLabelClass}>العدد اليدوي</label>
              <input className={erpInputClass} value={qtn ? String(qtn.revisionNumber) : ''} readOnly disabled />
            </div>
            <div>
              <label className={erpLabelClass}>حالة عرض السعر</label>
              <input className={erpInputClass} value={qtn ? statusLabel : ''} readOnly disabled />
            </div>
          </>
        }
        row2={
          <>
            <div>
              <label className={erpLabelClass}>رقم التسعير</label>
              <input className={erpInputClass} value={qtn?.quotationNumber ?? ''} readOnly disabled />
            </div>
            <div>
              <label className={erpLabelClass}>رقم العطاء</label>
              <input className={erpInputClass} value={tender?.tenderNumber ?? ''} readOnly disabled />
            </div>
            <div>
              <label className={erpLabelClass}>المالك</label>
              <input className={erpInputClass} value={tender?.customer.arabicName ?? ''} readOnly disabled />
            </div>
            <div>
              <label className={erpLabelClass}>كود المالك</label>
              <input className={erpInputClass} value={ownerCode} readOnly disabled />
            </div>
          </>
        }
      />

      <FormSectionCard title="بنود عرض السعر" className="mt-3">
        <div className={dataEntryGridWrapClass}>
          <table className="min-w-full text-sm">
            <thead className={dataEntryGridHeadRowClass}>
              <tr>
                <th className={dataEntryGridHeadCellClass}>البند</th>
                <th className={dataEntryGridHeadCellClass}>الكود</th>
                <th className={dataEntryGridHeadCellClass}>الوحدة</th>
                <th className={dataEntryGridHeadCellClass}>الكمية</th>
                <th className={dataEntryGridHeadCellClass}>السعر</th>
                <th className={dataEntryGridHeadCellClass}>القيمة</th>
                <th className={dataEntryGridHeadCellClass}>الحالة</th>
                <th className={dataEntryGridHeadCellClass}>ملاحظات</th>
              </tr>
            </thead>
            <tbody>
              {lines.length === 0 ? (
                <tr>
                  <td className={cn(dataEntryGridBodyCellClass, 'py-6 text-center text-muted-foreground')} colSpan={8}>
                    {tenderId ? 'لا توجد بنود على هذا العطاء بعد.' : 'اختر عطاءً لعرض البنود.'}
                  </td>
                </tr>
              ) : (
                lines.map((line) => (
                  <tr key={line.key}>
                    <td className={dataEntryGridBodyCellClass}>{line.descriptionAr}</td>
                    <td className={dataEntryGridBodyCellClass}>{line.itemCode}</td>
                    <td className={dataEntryGridBodyCellClass}>{unitLabel(line.unit)}</td>
                    <td className={cn(dataEntryGridBodyCellClass, 'tabular-nums text-end')}>{formatQty(line.quantity)}</td>
                    <td className={dataEntryGridBodyCellClass}>
                      {quotationId && isDraft && !locked ? (
                        <input
                          type="number"
                          className={dataEntryGridNumericInputClass}
                          defaultValue={line.rate}
                          key={`${line.key}-${line.rate}`}
                          onBlur={(e) => {
                            const next = Number(e.target.value);
                            if (!Number.isFinite(next) || next === line.rate) return;
                            void patchLineRate(line.tenderBoqItemId, next);
                          }}
                        />
                      ) : (
                        <span className="block tabular-nums text-end font-semibold text-[#094C6B]">
                          {formatEgp(line.rate)}
                        </span>
                      )}
                    </td>
                    <td className={cn(dataEntryGridBodyCellClass, 'tabular-nums text-end font-semibold text-[#094C6B]')}>
                      {formatEgp(line.amount)}
                    </td>
                    <td className={dataEntryGridBodyCellClass}>{line.kindLabel}</td>
                    <td className={dataEntryGridBodyCellClass}>{line.notes || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-end gap-6 text-sm">
          <div>
            الإجمالي الفرعي:{' '}
            <span className="font-semibold tabular-nums text-[#094C6B]">{formatEgp(subtotal)}</span>
          </div>
          <div>
            الخصم: <span className="font-semibold tabular-nums">{formatEgp(discount)}</span>
          </div>
          <div>
            الإجمالي:{' '}
            <span className="text-base font-bold tabular-nums text-[#0E78AA]">{formatEgp(grandTotal)}</span>
          </div>
        </div>
      </FormSectionCard>
    </ExtractsPageChrome>
  );
}
