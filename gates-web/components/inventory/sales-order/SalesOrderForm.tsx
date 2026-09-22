'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDraftAutosave } from '@/lib/hooks/useDraftAutosave';
import { PageDraftRestoreBanner } from '@/components/erp/PageDraftRestoreBanner';
import { useRouter } from 'next/navigation';
import { useOwnTabSearchParams } from '@/lib/navigation/tab-route-lock';
import { Receipt } from 'lucide-react';
import { Button } from '@/components/ui';
import { toast } from '@/lib/feedback/toast';
import { confirmAction } from '@/lib/feedback/confirm';
import { deleteDraftDocument } from '@/lib/documents/deleteDraftDocument';
import { printOperationalDocument } from '@/lib/print/printOperationalDocument';
import { ErpDocumentLayout } from '@/components/erp/ErpDocumentLayout';
import { ErpDocumentPageHeader } from '@/components/erp/ErpDocumentPageHeader';
import { DocumentBrowseDrawer } from '@/components/erp/DocumentBrowseDrawer';
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
import { mapSalesFormToM5CreateBody, mapSalesFormToM5UpdateBody } from '@/lib/invoices/mapFormToM5Invoice';
import { toHijriDate } from '@/lib/hijri-date';
import type { ApiError } from '@/lib/api/types';
import { CommercialLinesTable } from '@/components/inventory/commercial/CommercialLinesTable';
import {
  commercialLineParts,
  emptyCommercialLine,
  isEnteredCommercialLine,
  type CommercialDocumentLine,
} from '@/components/inventory/commercial/commercial-line-types';

const ORDER_PREFIX = '[أمر بيع]';

type OrderRecord = {
  id: string;
  invoiceNumber?: string | null;
  description?: string | null;
  date?: string;
  dueDate?: string | null;
  customerId?: string | null;
  warehouseId?: string | null;
  costCenterId?: string | null;
  representativeId?: string | null;
  currencyId?: string | null;
  isPosted?: boolean;
  isCancelled?: boolean;
  convertedInvoiceId?: string | null;
  version?: number;
  currency?: { code?: string };
  lines?: Array<{
    itemId: string;
    unitId?: string;
    quantity?: number | string;
    unitPrice?: number | string;
    discountPercent?: number | string;
    taxPercent?: number | string;
    lineNotes?: string | null;
    costCenterId?: string | null;
    item?: { code?: string; arabicName?: string };
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

function orderStatus(order?: OrderRecord | null) {
  if (order?.isCancelled) return { tone: 'danger' as const, label: 'ملغي (Cancelled)' };
  if (order?.convertedInvoiceId) return { tone: 'success' as const, label: 'تم التوريد بالكامل (Fulfilled)' };
  if (order?.id) return { tone: 'warning' as const, label: 'لم يتم التوريد (Pending Fulfillment)' };
  return { tone: 'warning' as const, label: 'لم يتم التوريد (Pending Fulfillment)' };
}

export function SalesOrderForm() {
  const router = useRouter();
  const searchParams = useOwnTabSearchParams();
  const orderIdFromUrl = searchParams.get('orderId') || searchParams.get('invoiceId');
  const invalidateQuery = useInvalidateQuery();
  const convertMutation = useDocumentConvertMutation();
  const [selectedId, setSelectedId] = useState<string | null>(() => orderIdFromUrl?.trim() || null);
  const [browseOpen, setBrowseOpen] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [orderNumber, setOrderNumber] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(todayIso());
  const [deliveryDate, setDeliveryDate] = useState(plusDays(7));
  const [customerId, setCustomerId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [costCenterId, setCostCenterId] = useState('');
  const [delegateId, setDelegateId] = useState('');
  const [currencyId, setCurrencyId] = useState('');
  const [shippingTerms, setShippingTerms] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('');
  const [lines, setLines] = useState<CommercialDocumentLine[]>([emptyCommercialLine()]);

  const salesOrderDraft = useMemo(
    () => ({
      orderNumber,
      description,
      date,
      deliveryDate,
      customerId,
      warehouseId,
      costCenterId,
      delegateId,
      currencyId,
      shippingTerms,
      paymentTerms,
      lines,
    }),
    [
      costCenterId,
      currencyId,
      customerId,
      date,
      delegateId,
      deliveryDate,
      description,
      lines,
      orderNumber,
      paymentTerms,
      shippingTerms,
      warehouseId,
    ]
  );
  const applySalesOrderDraft = useCallback((payload: typeof salesOrderDraft) => {
    setOrderNumber(payload.orderNumber);
    setDescription(payload.description);
    setDate(payload.date);
    setDeliveryDate(payload.deliveryDate);
    setCustomerId(payload.customerId);
    setWarehouseId(payload.warehouseId);
    setCostCenterId(payload.costCenterId);
    setDelegateId(payload.delegateId);
    setCurrencyId(payload.currencyId);
    setShippingTerms(payload.shippingTerms);
    setPaymentTerms(payload.paymentTerms);
    setLines(payload.lines?.length ? payload.lines : [emptyCommercialLine()]);
  }, []);
  const skipServerHydrateRef = useRef(false);
  const {
    restoreOffer,
    acceptRestore,
    dismissRestore,
    clearDraft,
  } = useDraftAutosave({
    documentType: 'sales-order',
    value: salesOrderDraft,
    mode: selectedId ? 'edit' : 'new',
    documentId: selectedId,
    enabled: true,
    applyRestore: (payload) => {
      skipServerHydrateRef.current = true;
      applySalesOrderDraft(payload);
    },
    isEmpty: (draft) =>
      !draft.customerId?.trim() &&
      !draft.description?.trim() &&
      !(draft.lines ?? []).some((line) => isEnteredCommercialLine(line)),
    restoreMessage: 'تم استعادة مسودة أمر البيع',
  });

  const { data: orderResponse } = useApiQuery<OrderRecord>(
    ['invoice', selectedId ?? ''],
    selectedId ? `/invoices/${selectedId}` : '/invoices',
    undefined,
    { enabled: Boolean(selectedId) }
  );
  const loaded = orderResponse?.data ?? null;

  const { data: browseResponse } = useApiQuery<OrderRecord[]>(
    ['invoices', 'sales-orders-browse'],
    '/invoices',
    { invoiceKind: 'SALE', isPosted: false, limit: 200 },
    { enabled: browseOpen }
  );
  const previousOrders = (browseResponse?.data ?? []).filter((row) =>
    String(row.description || '').includes(ORDER_PREFIX)
  );

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

  const { data: itemsResponse } = useApiQuery<{ id: string; units?: { unit?: { id: string }; unitId?: string; isBaseUnit?: boolean }[] }[]>(
    ['items', 'sales-order'],
    '/inventory/items',
    { limit: 200, isActive: true }
  );
  const items = itemsResponse?.data ?? [];

  const skipUrlHydrateRef = useRef(false);

  useEffect(() => {
    const id = orderIdFromUrl?.trim();
    if (skipUrlHydrateRef.current) {
      if (!id) skipUrlHydrateRef.current = false;
      return;
    }
    if (id && id !== selectedId) setSelectedId(id);
  }, [orderIdFromUrl, selectedId]);

  useEffect(() => {
    if (currencies.length && !currencyId) {
      setCurrencyId((currencies.find((c) => c.code === 'EGP') || currencies[0]).id);
    }
  }, [currencies, currencyId]);

  useEffect(() => {
    if (skipServerHydrateRef.current) {
      skipServerHydrateRef.current = false;
      return;
    }
    if (!loaded || !selectedId) return;
    setOrderNumber(loaded.invoiceNumber || '');
    setDescription(String(loaded.description || '').replace(/^\[أمر بيع\]\s*/, ''));
    setDate(loaded.date ? String(loaded.date).slice(0, 10) : todayIso());
    setDeliveryDate(loaded.dueDate ? String(loaded.dueDate).slice(0, 10) : plusDays(7));
    setCustomerId(loaded.customerId || '');
    setWarehouseId(loaded.warehouseId || '');
    setCostCenterId(loaded.costCenterId || '');
    setDelegateId(loaded.representativeId || '');
    setCurrencyId(loaded.currencyId || currencyId);
    setLines(
      (loaded.lines ?? []).map((line) => ({
        itemId: line.itemId,
        itemCode: line.item?.code || '',
        itemName: line.item?.arabicName || '',
        unitId: line.unitId || '',
        unitName: '',
        quantity: Number(line.quantity) || 0,
        unitPrice: Number(line.unitPrice) || 0,
        discount: Number(line.discountPercent) || 0,
        taxRate: Number(line.taxPercent) || 14,
        notes: line.lineNotes || '',
        costCenterId: line.costCenterId || '',
      }))
    );
  }, [loaded, selectedId, currencyId]);

  const entered = useMemo(() => lines.filter(isEnteredCommercialLine), [lines]);
  const totals = useMemo(
    () =>
      entered.reduce(
        (acc, line) => {
          const parts = commercialLineParts(line);
          acc.gross += parts.gross;
          acc.discount += parts.discountValue;
          acc.tax += parts.taxValue;
          acc.net += parts.net;
          return acc;
        },
        { gross: 0, discount: 0, tax: 0, net: 0 }
      ),
    [entered]
  );
  const status = orderStatus(loaded);

  const saveMutation = useApiMutation<OrderRecord, Record<string, unknown>>('/invoices', 'POST', {
    showSuccessToast: false,
    onSuccess: () => {
      invalidateQuery(['invoices']);
      resetNew();
      setSuccess('تم حفظ أمر البيع');
    },
    onError: (err: ApiError) => setError(err.message || 'تعذر حفظ أمر البيع'),
  });

  const updateMutation = useApiMutation<OrderRecord, Record<string, unknown>>(
    selectedId ? `/invoices/${selectedId}` : '/invoices',
    'PUT',
    {
      showSuccessToast: false,
      onSuccess: () => {
        invalidateQuery(['invoices']);
        resetNew();
        setSuccess('تم تحديث أمر البيع');
      },
      onError: (err: ApiError) => setError(err.message || 'تعذر تحديث أمر البيع'),
    }
  );

  const cancelMutation = useApiMutation<unknown, Record<string, unknown>>(
    selectedId ? `/invoices/${selectedId}/cancel` : '/invoices',
    'POST',
    {
      showSuccessToast: false,
      onSuccess: () => {
        setSuccess('تم إلغاء أمر البيع');
        invalidateQuery(['invoices']);
        invalidateQuery(['invoice', selectedId ?? '']);
      },
      onError: (err: ApiError) => setError(err.message || 'تعذر إلغاء أمر البيع'),
    }
  );

  const buildOrderBody = () => {
    const notes = [shippingTerms, paymentTerms].filter(Boolean).join(' — ');
    const desc = `${ORDER_PREFIX} ${description || ''}`.trim();
    return {
      invoiceNumber: orderNumber || undefined,
      description: notes ? `${desc} — ${notes}` : desc,
      date,
      dueDate: deliveryDate,
      hijriDate: toHijriDate(date),
      customerId,
      warehouseId,
      currencyId,
      costCenterId: costCenterId || undefined,
      delegateId: delegateId || undefined,
      paymentMethod: 'credit',
      lines: entered.map((line) => ({
        itemId: line.itemId,
        unitId: line.unitId,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        discount: line.discount,
        taxRate: line.taxRate,
        lineNotes: line.notes,
        costCenterId: line.costCenterId || undefined,
      })),
    };
  };

  const handleSave = () => {
    setError('');
    if (!customerId) {
      setError('يرجى اختيار العميل');
      return;
    }
    if (!warehouseId) {
      setError('يرجى اختيار المخزن');
      return;
    }
    if (entered.length === 0) {
      setError('أضف صنفاً واحداً على الأقل');
      return;
    }
    const form = buildOrderBody();
    if (selectedId) {
      updateMutation.mutate(
        mapSalesFormToM5UpdateBody(form, {
          invoiceKind: 'SALE',
          currencies,
          items,
          expectedVersion: loaded?.version,
        })
      );
      return;
    }
    saveMutation.mutate(mapSalesFormToM5CreateBody(form, { invoiceKind: 'SALE', currencies, items }));
  };

  const handleGenerateInvoice = async () => {
    if (!selectedId) {
      setError('احفظ أمر البيع أولاً ثم أصدر الفاتورة');
      return;
    }
    try {
      const res = await convertMutation.mutateAsync({
        type: 'SALES_ORDER_TO_SALE_INVOICE',
        sourceId: selectedId,
      });
      const invoiceId = res.data?.target?.id;
      router.push(
        invoiceId
          ? `/sales/invoices/new?invoiceId=${encodeURIComponent(invoiceId)}`
          : '/sales/invoices/new'
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر إصدار الفاتورة');
    }
  };

  const resetNew = () => {
    skipUrlHydrateRef.current = true;
    setSelectedId(null);
    setOrderNumber('');
    setDescription('');
    setDate(todayIso());
    setDeliveryDate(plusDays(7));
    setCustomerId('');
    setLines([emptyCommercialLine()]);
    setError('');
    setSuccess('');
    const params = new URLSearchParams(searchParams.toString());
    params.delete('orderId');
    params.delete('invoiceId');
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : window.location.pathname, { scroll: false });
    clearDraft();
  };

  const money = (n: number) => n.toLocaleString('ar-EG', { minimumFractionDigits: 2 });

  return (
    <ErpDocumentLayout>
      {restoreOffer && !selectedId ? (
        <PageDraftRestoreBanner
          message="يوجد مسودة أمر بيع غير محفوظة."
          onRestore={() => {
            const payload = acceptRestore();
            if (!payload) return;
            applySalesOrderDraft(payload);
            setSuccess('تم استعادة مسودة أمر البيع');
          }}
          onDismiss={dismissRestore}
        />
      ) : null}
      <div className="flex min-h-[calc(100dvh-3rem)] flex-col pb-4">
        <ErpDocumentPageHeader
          breadcrumbs={[
            { href: '/inventory', label: 'المخازن' },
            { label: 'العمليات' },
            { label: 'أمر بيع' },
          ]}
          title="أمر بيع / حجز بضاعة"
          docNumber={orderNumber || 'SO-XXXX'}
          statusTone={status.tone}
          statusLabel={status.label}
          onSaveDraft={handleSave}
          saveLabel="حفظ أمر البيع"
          savePending={saveMutation.isPending || updateMutation.isPending}
          canSave={!loaded?.isCancelled && !loaded?.convertedInvoiceId}
          hideStandalonePost
          onBrowseList={() => setBrowseOpen(true)}
          browseListLabel="السابق"
          onEdit={() => {
            if (!selectedId) return;
            if (loaded?.isCancelled) {
              setError('لا يمكن تعديل أمر ملغي');
              return;
            }
          }}
          editDisabled={!selectedId || Boolean(loaded?.isCancelled)}
          favoriteHref="/inventory/operations/sales-order"
          favoriteLabel="أمر بيع"
          moreMenuItems={[
            { id: 'new', label: 'أمر جديد', onClick: resetNew },
            {
              id: 'print',
              label: 'طباعة',
              onClick: () => {
                void printOperationalDocument({
                  title: 'أمر بيع',
                  documentNo: orderNumber || 'مسودة',
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
                setOrderNumber('');
                setSuccess('تم تجهيز نسخة جديدة من الأمر');
              },
            },
            {
              id: 'cancel',
              label: 'إلغاء الأمر',
              disabled: !selectedId || Boolean(loaded?.isCancelled || loaded?.convertedInvoiceId),
              onClick: () => {
                if (selectedId) cancelMutation.mutate({});
              },
            },
          ]}
        />

        {error ? <ErrorToast message={error} onClose={() => setError('')} /> : null}
        {success ? <SuccessToast message={success} onClose={() => setSuccess('')} /> : null}

        <ErpFormHeaderCard
          extrasLabel="خيارات إضافية"
          row1={
            <>
              <div className="space-y-1">
                <label className={erpLabelClass}>رقم الأمر</label>
                <input className={erpInputClass} value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} />
              </div>
              <DatePickerWithHijri label="تاريخ أمر البيع" value={date} onChange={setDate} />
              <DatePickerWithHijri label="تاريخ التسليم المتوقع" value={deliveryDate} onChange={setDeliveryDate} />
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
                <input className={erpInputClass} value={description} onChange={(e) => setDescription(e.target.value)} />
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
            <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              <div className="space-y-1">
                <label className={erpLabelClass}>مندوب المبيعات</label>
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
                <label className={erpLabelClass}>كود المشروع / مركز التكلفة</label>
                <CostCenterSelect value={costCenterId} onChange={setCostCenterId} className={erpInputClass} />
              </div>
              <div className="space-y-1">
                <label className={erpLabelClass}>شروط الشحن والتسليم</label>
                <input className={erpInputClass} value={shippingTerms} onChange={(e) => setShippingTerms(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className={erpLabelClass}>شروط السداد</label>
                <input className={erpInputClass} value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} />
              </div>
            </div>
          }
        />

        <div className="mt-3">
          <CommercialLinesTable
            lines={lines}
            onChange={setLines}
            headerDescription={description}
          />
        </div>

        <div className="sticky bottom-0 z-30 mt-auto flex w-full flex-wrap items-center justify-between gap-3 border-t border-border/80 bg-background/95 px-6 py-3 shadow-lg backdrop-blur-md">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
              {status.label}
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-1.5 border-emerald-600/30 font-semibold text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
              disabled={!selectedId || Boolean(loaded?.convertedInvoiceId || loaded?.isCancelled) || convertMutation.isPending}
              onClick={() => void handleGenerateInvoice()}
            >
              <Receipt className="h-3.5 w-3.5" />
              إصدار فاتورة مبيعات من هذا الأمر
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs">
            <span>قبل الضريبة: <b className="font-mono">{money(totals.gross)}</b></span>
            <span>الخصم: <b className="font-mono">{money(totals.discount)}</b></span>
            <span>ضريبة 14%: <b className="font-mono">{money(totals.tax)}</b></span>
            <span className="text-sm">
              الإجمالي: <b className="font-mono text-base text-emerald-600">{money(totals.net)} ج.م</b>
            </span>
          </div>
        </div>

        <DocumentBrowseDrawer open={browseOpen} onClose={() => setBrowseOpen(false)} title="أوامر البيع السابقة">
          {previousOrders.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">لا توجد أوامر بيع سابقة</p>
          ) : (
            <ul className="divide-y divide-border/70">
              {previousOrders.map((row) => (
                <li key={row.id} className="flex items-center gap-2 px-2">
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center justify-between px-3 py-2.5 text-right text-sm hover:bg-muted/40"
                    onClick={() => {
                      setSelectedId(row.id);
                      setBrowseOpen(false);
                    }}
                  >
                    <span className="font-mono font-semibold text-primary">
                      {row.invoiceNumber || row.id.slice(0, 8)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {row.date ? new Date(row.date).toLocaleDateString('ar-EG') : '—'}
                    </span>
                  </button>
                  {!row.isCancelled ? (
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={async () => {
                        if (!(await confirmAction('حذف هذه المسودة؟'))) return;
                        try {
                          await deleteDraftDocument('/invoices', row.id);
                          toast.success('تم حذف المسودة');
                          invalidateQuery(['invoices']);
                          if (selectedId === row.id) {
                            setSelectedId(null);
                            setBrowseOpen(false);
                          }
                        } catch (error) {
                          toast.error(error instanceof Error ? error.message : 'تعذر حذف المسودة');
                        }
                      }}
                    >
                      حذف المسودة
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </DocumentBrowseDrawer>
      </div>
    </ErpDocumentLayout>
  );
}
