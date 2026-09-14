'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRightLeft, Receipt } from 'lucide-react';
import { Button } from '@/components/ui';
import { printOperationalDocument } from '@/lib/print/printOperationalDocument';
import { ErpDocumentLayout } from '@/components/erp/ErpDocumentLayout';
import { ErpDocumentPageHeader } from '@/components/erp/ErpDocumentPageHeader';
import { DocumentBrowseDrawer } from '@/components/erp/DocumentBrowseDrawer';
import { GenericRecordsList } from '@/components/erp/GenericRecordsList';
import { DatePickerWithHijri } from '@/components/ui/DatePickerWithHijri';
import { CustomerSelect } from '@/app/components/form/PartySelect';
import { WarehouseSelect } from '@/app/components/form/WarehouseSelect';
import { CostCenterSelect } from '@/app/components/form/CostCenterSelect';
import {
  ErpFormHeaderCard,
  erpInputClass,
  erpLabelClass,
} from '@/components/erp';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';
import { useApiMutation, useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';
import { useDocumentConvertMutation } from '@/lib/hooks/useDocumentConvert';
import { toHijriDate } from '@/lib/hijri-date';
import type { ApiError } from '@/lib/api/types';
import { CommercialLinesTable } from '@/components/inventory/commercial/CommercialLinesTable';
import {
  commercialLineParts,
  emptyCommercialLine,
  isEnteredCommercialLine,
  type CommercialDocumentLine,
} from '@/components/inventory/commercial/commercial-line-types';

type QuoteRecord = {
  id: string;
  quoteNumber?: string | null;
  description?: string | null;
  date?: string;
  validUntil?: string | null;
  customerId?: string | null;
  warehouseId?: string | null;
  costCenterId?: string | null;
  delegateId?: string | null;
  currencyId?: string | null;
  isPosted?: boolean;
  isApproved?: boolean;
  isConverted?: boolean;
  invoiceId?: string | null;
  lines?: Array<{
    itemId: string;
    unitId?: string;
    quantity?: number | string;
    unitPrice?: number | string;
    discountPercentage?: number | string;
    taxPercentage?: number | string;
    item?: { code?: string; arabicName?: string };
    unit?: { arabicName?: string };
  }>;
};

function todayIso() {
  return new Date().toISOString().split('T')[0];
}

function plusDays(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function quoteStatus(quote?: QuoteRecord | null, validUntil?: string) {
  if (quote?.isConverted) return { tone: 'info' as const, label: 'محول لفاتورة (Converted)' };
  if (validUntil && validUntil < todayIso() && !quote?.isConverted) {
    return { tone: 'danger' as const, label: 'منتهي الصلاحية (Expired)' };
  }
  if (quote?.isApproved) return { tone: 'success' as const, label: 'مقبول (Accepted)' };
  if (quote?.isPosted) return { tone: 'info' as const, label: 'معتمد ومُرسل (Sent)' };
  return { tone: 'warning' as const, label: 'مسودة (Draft)' };
}

export function PriceQuoteForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const quoteIdFromUrl = searchParams.get('quoteId') || searchParams.get('id');
  const invalidateQuery = useInvalidateQuery();
  const convertMutation = useDocumentConvertMutation();
  const [selectedId, setSelectedId] = useState<string | null>(() => quoteIdFromUrl?.trim() || null);
  const [browseOpen, setBrowseOpen] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [quoteNumber, setQuoteNumber] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(todayIso());
  const [validUntil, setValidUntil] = useState(plusDays(30));
  const [customerId, setCustomerId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [costCenterId, setCostCenterId] = useState('');
  const [delegateId, setDelegateId] = useState('');
  const [currencyId, setCurrencyId] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('');
  const [deliveryPeriod, setDeliveryPeriod] = useState('');
  const [lines, setLines] = useState<CommercialDocumentLine[]>([emptyCommercialLine()]);

  const { data: quoteResponse } = useApiQuery<QuoteRecord>(
    ['price-quote', selectedId ?? ''],
    selectedId ? `/inventory/price-quotes/${selectedId}` : '/inventory/price-quotes',
    undefined,
    { enabled: Boolean(selectedId) }
  );
  const loaded = quoteResponse?.data ?? null;

  const { data: currenciesResponse } = useApiQuery<{ id: string; code: string; arabicName: string }[]>(
    ['currencies'],
    '/accounting/currencies',
    { limit: 100, isActive: true }
  );
  const currencies = useMemo(() => currenciesResponse?.data ?? [], [currenciesResponse?.data]);

  const { data: delegatesResponse } = useApiQuery<{ id: string; arabicName: string }[]>(
    ['delegates'],
    '/accounting/delegates',
    { limit: 500, isActive: true }
  );
  const delegates = delegatesResponse?.data ?? [];

  useEffect(() => {
    const id = quoteIdFromUrl?.trim();
    if (id && id !== selectedId) setSelectedId(id);
  }, [quoteIdFromUrl, selectedId]);

  useEffect(() => {
    if (currencies.length && !currencyId) {
      setCurrencyId((currencies.find((c) => c.code === 'EGP') || currencies[0]).id);
    }
  }, [currencies, currencyId]);

  useEffect(() => {
    if (!loaded || !selectedId) return;
    setQuoteNumber(loaded.quoteNumber || '');
    setDescription(loaded.description || '');
    setDate(loaded.date ? String(loaded.date).slice(0, 10) : todayIso());
    setValidUntil(loaded.validUntil ? String(loaded.validUntil).slice(0, 10) : plusDays(30));
    setCustomerId(loaded.customerId || '');
    setWarehouseId(loaded.warehouseId || '');
    setCostCenterId(loaded.costCenterId || '');
    setDelegateId(loaded.delegateId || '');
    setCurrencyId(loaded.currencyId || currencyId);
    setLines(
      (loaded.lines ?? []).map((line) => ({
        itemId: line.itemId,
        itemCode: line.item?.code || '',
        itemName: line.item?.arabicName || '',
        unitId: line.unitId || '',
        unitName: line.unit?.arabicName || '',
        quantity: Number(line.quantity) || 0,
        unitPrice: Number(line.unitPrice) || 0,
        discount: Number(line.discountPercentage) || 0,
        taxRate: Number(line.taxPercentage) || 14,
        notes: '',
        costCenterId: loaded.costCenterId || '',
      }))
    );
  }, [loaded, selectedId, currencyId]);

  const entered = useMemo(() => lines.filter(isEnteredCommercialLine), [lines]);
  const totals = useMemo(() => {
    return entered.reduce(
      (acc, line) => {
        const parts = commercialLineParts(line);
        acc.gross += parts.gross;
        acc.discount += parts.discountValue;
        acc.tax += parts.taxValue;
        acc.net += parts.net;
        return acc;
      },
      { gross: 0, discount: 0, tax: 0, net: 0 }
    );
  }, [entered]);

  const status = quoteStatus(loaded, validUntil);
  const converted = Boolean(loaded?.isConverted);

  const saveMutation = useApiMutation<QuoteRecord, Record<string, unknown>>('/inventory/price-quotes', 'POST', {
    showSuccessToast: false,
    onSuccess: (res) => {
      setSuccess('تم حفظ عرض السعر');
      invalidateQuery(['price-quotes']);
      if (res.data?.id) setSelectedId(res.data.id);
    },
    onError: (err: ApiError) => setError(err.message || 'تعذر حفظ عرض السعر'),
  });

  const handleSave = () => {
    setError('');
    if (!customerId) {
      setError('يرجى اختيار العميل');
      return;
    }
    if (entered.length === 0) {
      setError('أضف صنفاً واحداً على الأقل');
      return;
    }
    const missingUnit = entered.find((line) => !line.unitId);
    if (missingUnit) {
      setError('اختر الصنف من الدليل حتى تُحدد الوحدة تلقائياً');
      return;
    }
    saveMutation.mutate({
      quoteNumber: quoteNumber || undefined,
      description: description || undefined,
      date: new Date(`${date}T12:00:00`).toISOString(),
      hijriDate: toHijriDate(date),
      validUntil: validUntil ? new Date(`${validUntil}T12:00:00`).toISOString() : undefined,
      customerId,
      warehouseId: warehouseId || undefined,
      costCenterId: costCenterId || undefined,
      delegateId: delegateId || undefined,
      currencyId: currencyId || undefined,
      paymentMethod: 'credit',
      isSalesTaxInvoice: true,
      conditions: [paymentTerms, deliveryPeriod].filter(Boolean),
      lines: entered.map((line) => {
        const parts = commercialLineParts(line);
        return {
          itemId: line.itemId,
          unitId: line.unitId,
          quantity: line.quantity,
          baseQuantity: line.quantity,
          unitPrice: line.unitPrice,
          total: parts.gross,
          discountPercentage: line.discount,
          discountValue: parts.discountValue,
          taxPercentage: line.taxRate,
          taxValue: parts.taxValue,
          netTotal: parts.net,
        };
      }),
    });
  };

  const handleConvert = async (kind: 'invoice' | 'order') => {
    if (!selectedId) {
      setError(kind === 'order' ? 'احفظ عرض السعر أولاً ثم حوّله إلى أمر بيع' : 'احفظ عرض السعر أولاً ثم حوّله إلى فاتورة');
      return;
    }
    if (converted) return;
    try {
      const res = await convertMutation.mutateAsync({
        type: kind === 'order' ? 'PRICE_QUOTE_TO_SALES_ORDER' : 'PRICE_QUOTE_TO_SALE_INVOICE',
        sourceId: selectedId,
      });
      const targetId = res.data?.target?.id;
      if (kind === 'order') {
        router.push(
          targetId
            ? `/sales/orders/new?orderId=${encodeURIComponent(targetId)}`
            : '/sales/orders/new'
        );
        return;
      }
      router.push(
        targetId
          ? `/sales/invoices/new?invoiceId=${encodeURIComponent(targetId)}`
          : '/sales/invoices/new'
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر التحويل');
    }
  };

  const resetNew = () => {
    setSelectedId(null);
    setQuoteNumber('');
    setDescription('');
    setDate(todayIso());
    setValidUntil(plusDays(30));
    setCustomerId('');
    setLines([emptyCommercialLine()]);
    setError('');
    setSuccess('');
  };

  const money = (n: number) => n.toLocaleString('ar-EG', { minimumFractionDigits: 2 });

  return (
    <ErpDocumentLayout>
      <div className="flex min-h-[calc(100dvh-3rem)] flex-col pb-4">
        <ErpDocumentPageHeader
          breadcrumbs={[
            { href: '/inventory', label: 'المخازن' },
            { label: 'العمليات' },
            { label: 'عرض سعر مبيعات' },
          ]}
          title="عرض سعر مبيعات"
          docNumber={quoteNumber || 'QT-XXXX'}
          statusTone={status.tone}
          statusLabel={status.label}
          onSaveDraft={handleSave}
          saveLabel="حفظ عرض السعر"
          savePending={saveMutation.isPending}
          canSave
          hideStandalonePost
          onBrowseList={() => setBrowseOpen(true)}
          browseListLabel="السابق"
          favoriteHref="/inventory/operations/price-quote"
          favoriteLabel="عرض سعر"
          moreMenuItems={[
            { id: 'new', label: 'عرض جديد', onClick: resetNew },
            {
              id: 'print',
              label: 'طباعة',
              onClick: () => {
                void printOperationalDocument({
                  title: 'عرض سعر',
                  documentNo: quoteNumber || 'مسودة',
                  documentDate: date,
                  buyerName: description || undefined,
                  currency: currencies.find((c) => c.id === currencyId)?.code,
                  lines: entered.map((line) => {
                    const parts = commercialLineParts(line);
                    return {
                      description: [line.itemCode, line.itemName].filter(Boolean).join(' — ') || 'صنف',
                      quantity: line.quantity,
                      unitPrice: line.unitPrice,
                      taxPercent: line.taxRate,
                      taxAmount: parts.taxValue,
                      total: parts.net,
                    };
                  }),
                });
              },
            },
            {
              id: 'duplicate',
              label: 'تكرار',
              onClick: () => {
                setSelectedId(null);
                setQuoteNumber('');
                setSuccess('تم تجهيز نسخة جديدة من العرض');
              },
            },
            { id: 'cancel', label: 'إلغاء', onClick: resetNew },
          ]}
        />

        {error ? <ErrorToast message={error} onClose={() => setError('')} /> : null}
        {success ? <SuccessToast message={success} onClose={() => setSuccess('')} /> : null}

        <ErpFormHeaderCard
          extrasLabel="خيارات إضافية"
          row1={
            <>
              <div className="space-y-1">
                <label className={erpLabelClass}>رقم العرض</label>
                <input className={erpInputClass} value={quoteNumber} onChange={(e) => setQuoteNumber(e.target.value)} />
              </div>
              <DatePickerWithHijri label="تاريخ عرض السعر" value={date} onChange={setDate} />
              <DatePickerWithHijri label="تاريخ انتهاء العرض" value={validUntil} onChange={setValidUntil} />
            </>
          }
          row2={
            <>
              <div className="space-y-1">
                <label className={erpLabelClass}>العميل</label>
                <CustomerSelect value={customerId} onChange={setCustomerId} className={erpInputClass} />
              </div>
              <div className="space-y-1">
                <label className={erpLabelClass}>الشرح / البيان</label>
                <input
                  className={erpInputClass}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="بيان عرض السعر"
                />
              </div>
              <div className="space-y-1">
                <label className={erpLabelClass}>المخزن</label>
                <WarehouseSelect value={warehouseId} onChange={setWarehouseId} className={erpInputClass} />
              </div>
              <div className="space-y-1">
                <label className={erpLabelClass}>العملة</label>
                <select className={erpInputClass} value={currencyId} onChange={(e) => setCurrencyId(e.target.value)}>
                  {currencies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.arabicName || c.code}
                    </option>
                  ))}
                </select>
              </div>
            </>
          }
          extras={
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1">
                <label className={erpLabelClass}>المندوب</label>
                <select className={erpInputClass} value={delegateId} onChange={(e) => setDelegateId(e.target.value)}>
                  <option value="">—</option>
                  {delegates.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.arabicName}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className={erpLabelClass}>مركز التكلفة / المشروع</label>
                <CostCenterSelect value={costCenterId} onChange={setCostCenterId} className={erpInputClass} />
              </div>
              <div className="space-y-1">
                <label className={erpLabelClass}>شروط الدفع</label>
                <input className={erpInputClass} value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className={erpLabelClass}>فترة التوريد المتوقعة</label>
                <input className={erpInputClass} value={deliveryPeriod} onChange={(e) => setDeliveryPeriod(e.target.value)} />
              </div>
            </div>
          }
        />

        <div className="mt-3">
          <CommercialLinesTable lines={lines} onChange={setLines} />
        </div>

        <div className="sticky bottom-0 z-30 mt-auto flex w-full flex-wrap items-center justify-between gap-3 border-t border-border/80 bg-background/95 px-6 py-3 shadow-lg backdrop-blur-md">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={converted || convertMutation.isPending}
              className="gap-1.5 border-primary/30 font-semibold text-primary hover:bg-primary/10"
              onClick={() => void handleConvert('invoice')}
            >
              <ArrowRightLeft className="h-3.5 w-3.5" />
              تحويل إلى فاتورة مبيعات
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={converted || convertMutation.isPending}
              className="gap-1.5 border-emerald-600/30 font-semibold text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
              onClick={() => void handleConvert('order')}
            >
              <Receipt className="h-3.5 w-3.5" />
              تحويل إلى أمر بيع
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs">
            <span>قبل الضريبة: <b className="font-mono">{money(totals.gross)}</b></span>
            <span>الخصم: <b className="font-mono">{money(totals.discount)}</b></span>
            <span>ضريبة 14%: <b className="font-mono">{money(totals.tax)}</b></span>
            <span className="text-sm">
              إجمالي عرض السعر:{' '}
              <b className="font-mono text-base text-emerald-600">{money(totals.net)} ج.م</b>
            </span>
          </div>
        </div>

        <DocumentBrowseDrawer open={browseOpen} onClose={() => setBrowseOpen(false)} title="عروض الأسعار السابقة">
          <GenericRecordsList
            apiPath="/inventory/price-quotes"
            listKey="price-quotes-browse"
            paging="skip"
            selectedId={selectedId}
            columns={[
              { id: 'num', header: 'الرقم', getValue: (r) => String(r.quoteNumber ?? r.id.slice(0, 8)) },
              {
                id: 'date',
                header: 'التاريخ',
                getValue: (r) => (r.date ? new Date(String(r.date)).toLocaleDateString('ar-EG') : '—'),
              },
              {
                id: 'net',
                header: 'الصافي',
                getValue: (r) => Number(r.netAmount ?? 0).toLocaleString('ar-EG'),
              },
            ]}
            resolveStatus={(r) =>
              r.isConverted
                ? { variant: 'info', label: 'محول' }
                : { variant: 'warning', label: 'مسودة' }
            }
            onSelect={(id) => {
              setSelectedId(id);
              setBrowseOpen(false);
            }}
          />
        </DocumentBrowseDrawer>
      </div>
    </ErpDocumentLayout>
  );
}
