'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDraftAutosave } from '@/lib/hooks/useDraftAutosave';
import { PageDraftRestoreGate } from '@/components/erp/PageDraftRestoreGate';
import { useRouter } from 'next/navigation';
import { useOwnTabSearchParams } from '@/lib/navigation/tab-route-lock';
import { Receipt } from 'lucide-react';
import { Button } from '@/components/ui';
import { toast } from '@/lib/feedback/toast';
import { confirmAction } from '@/lib/feedback/confirm';
import { printOperationalDocument } from '@/lib/print/printOperationalDocument';
import { ErpDocumentLayout } from '@/components/erp/ErpDocumentLayout';
import { ErpDocumentPageHeader } from '@/components/erp/ErpDocumentPageHeader';
import { DocumentBrowseDrawer } from '@/components/erp/DocumentBrowseDrawer';
import { GenericRecordsList } from '@/components/erp/GenericRecordsList';
import { DatePickerWithHijri } from '@/components/ui/DatePickerWithHijri';
import { CustomerSelect } from '@/app/components/form/PartySelect';
import { WarehouseSelect } from '@/app/components/form/WarehouseSelect';
import { WarehouseItemScopeToggle } from '@/components/form/WarehouseItemScopeToggle';
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
import {
  mapSalesFormToM5CreateBody,
  mapSalesFormToM5UpdateBody,
  type M5FormData,
} from '@/lib/invoices/mapFormToM5Invoice';
import { finishDocumentSave } from '@/lib/documents/finish-save';
import {
  DOCUMENT_CANCELLED_LABEL,
  savedDocumentRowStatus,
} from '@/lib/documents/document-status-labels';
import { restoreCancelledDocument } from '@/lib/documents/restore-cancelled-document';
import { invalidateStockViews } from '@/lib/invoices/invalidate-stock-views';
import { toHijriDate } from '@/lib/hijri-date';
import type { ApiError } from '@/lib/api/types';
import dynamic from 'next/dynamic';
import { apiClient } from '@/lib/api/client';
import { SalesOrderLinesTable } from '@/components/inventory/sales-order/SalesOrderLinesTable';
import {
  SalesOrderWorkOrderPanel,
  type WorkOrderPanelData,
} from '@/components/inventory/sales-order/SalesOrderWorkOrderPanel';
import { packSalesOrderLineNotes, unpackSalesOrderLineNotes } from '@/lib/invoices/sales-order-line-meta';
import {
  extractPaymentInstallments,
  stripPaymentInstallmentsNote,
  withPaymentInstallmentsNote,
  type PaymentInstallmentRow,
} from '@/lib/invoices/payment-installments';
import type { InternalNoteEntry } from '@/lib/invoices/payment-split.types';
import {
  commercialLineParts,
  emptyCommercialLine,
  isEnteredCommercialLine,
  type CommercialDocumentLine,
} from '@/components/inventory/commercial/commercial-line-types';
import { DocumentSourceLoadBar } from '@/components/invoices/DocumentSourceLoadBar';
import {
  mapSourcePayloadToCommercialLines,
  stockHeaderFieldsFromSource,
} from '@/lib/inventory/apply-source-to-stock-document';
import type { SourceHydratePayload } from '@/lib/invoices/sourceDocument';
import { isTransactionSerialAutomatic } from '@/lib/transaction-settings/serial-mode';
import { findBelowCostLine, SELL_BELOW_COST_MESSAGE } from '@/lib/accounting-settings/guardrail-hints';
import {
  shouldLockLoadedSource,
  shouldShowAllAccountsInPartyField,
  type TransactionSettings,
} from '@/lib/transaction-settings/types';
import { maybeAutoPrintAfterSave } from '@/lib/printer/print-prefs';
import { postStoreDocumentAfterSave } from '@/lib/inventory/post-store-document-after-save';
import { STORE_SAVE_AND_POST_LABEL } from '@/lib/inventory/store-document-save-post';
import { invalidateAfterTransactionSettingsSave } from '@/lib/inventory/transaction-settings-invalidate';
import { sumPartyInvoiceExtras, type InvoiceAdjustmentApiRow } from '@/lib/invoices/invoice-adjustments';
import { useInvoiceExtras } from '@/lib/invoices/use-invoice-extras';
import { InvoiceExtrasPanel } from '@/components/inventory/invoices/InvoiceExtrasPanel';
import { InternalNotesScratchpad } from '@/components/documents/InternalNotesScratchpad';

const PaymentInstallmentsModal = dynamic(
  () =>
    import('@/components/invoices/PaymentInstallmentsModal').then((m) => ({
      default: m.PaymentInstallmentsModal,
    })),
  { ssr: false }
);

function addDaysIso(iso: string, days: number) {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysBetween(start: string, end: string) {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (!Number.isFinite(ms)) return 0;
  return Math.max(0, Math.round(ms / 86400000));
}

type WorkOrderApi = {
  id: string;
  orderNumber: string;
  workDate: string;
  processMetadata?: Record<string, unknown> | null;
  salesOrder?: { invoiceNumber?: string | null };
  lines?: Array<{
    itemId: string;
    plannedQuantity: string | number;
    lineDescription?: string | null;
    imageUrl?: string | null;
    item?: { arabicName: string };
  }>;
};

function mapWorkOrderToPanel(wo: WorkOrderApi): WorkOrderPanelData {
  const meta = wo.processMetadata ?? {};
  return {
    id: wo.id,
    orderNumber: wo.orderNumber,
    salesOrderNumber: String(meta.salesOrderNumber ?? wo.salesOrder?.invoiceNumber ?? ''),
    workDate: String(wo.workDate).slice(0, 10),
    deliveryLeadDays: Number(meta.deliveryLeadDays ?? 0),
    expectedDeliveryDate: String(meta.expectedDeliveryDate ?? '').slice(0, 10),
    lines: (wo.lines ?? []).map((l) => ({
      itemId: l.itemId,
      itemName: l.item?.arabicName ?? '',
      quantity: Number(l.plannedQuantity) || 0,
      specifications: l.lineDescription ?? '',
      imageUrl: l.imageUrl ?? '',
    })),
  };
}

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
  internalNotes?: InternalNoteEntry[] | null;
  customer?: { arabicName?: string | null };
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
  if (order?.isCancelled) return { tone: 'danger' as const, label: DOCUMENT_CANCELLED_LABEL };
  if (order?.isPosted) return { tone: 'info' as const, label: 'مرحّل' };
  if (order?.convertedInvoiceId) return { tone: 'success' as const, label: 'تم التوريد بالكامل (Fulfilled)' };
  if (order?.id) return { tone: 'warning' as const, label: 'لم يتم التوريد (Pending Fulfillment)' };
  return { tone: 'warning' as const, label: 'لم يتم التوريد (Pending Fulfillment)' };
}

const INVENTORY_SALES_ORDER_HREF = '/inventory/operations/sales-order';
const MANUFACTURING_SALES_ORDER_HREF = '/manufacturing/operations/sales-order';

export type SalesOrderFormProps = {
  /** Inventory operations (default) vs manufacturing operations shell */
  context?: 'inventory' | 'manufacturing';
};

export function SalesOrderForm({ context = 'inventory' }: SalesOrderFormProps) {
  const isManufacturing = context === 'manufacturing';
  const routeHref =
    context === 'manufacturing' ? MANUFACTURING_SALES_ORDER_HREF : INVENTORY_SALES_ORDER_HREF;
  const breadcrumbs =
    context === 'manufacturing'
      ? [
          { href: '/manufacturing', label: 'التصنيع' },
          { label: 'عمليات التصنيع' },
          { label: 'أمر البيع' },
        ]
      : [
          { href: '/inventory', label: 'المخازن' },
          { label: 'العمليات' },
          { label: 'أمر بيع' },
        ];
  const router = useRouter();
  const searchParams = useOwnTabSearchParams();
  const orderIdFromUrl = searchParams.get('orderId') || searchParams.get('invoiceId');
  const workOrderIdFromUrl = searchParams.get('workOrderId')?.trim() || null;
  const invalidateQuery = useInvalidateQuery();
  const convertMutation = useDocumentConvertMutation();
  const [selectedId, setSelectedId] = useState<string | null>(() => orderIdFromUrl?.trim() || null);
  const [browseOpen, setBrowseOpen] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [restorePending, setRestorePending] = useState(false);

  const [orderNumber, setOrderNumber] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(todayIso());
  const [deliveryLeadDays, setDeliveryLeadDays] = useState(7);
  const [deliveryDate, setDeliveryDate] = useState(plusDays(7));
  const [paymentInstallments, setPaymentInstallments] = useState<PaymentInstallmentRow[]>([]);
  const [internalNotes, setInternalNotes] = useState<InternalNoteEntry[]>([]);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [workOrderPanel, setWorkOrderPanel] = useState<WorkOrderPanelData | null>(null);
  const [workOrderBusy, setWorkOrderBusy] = useState(false);
  const [customerId, setCustomerId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [costCenterId, setCostCenterId] = useState('');
  const [delegateId, setDelegateId] = useState('');
  const [currencyId, setCurrencyId] = useState('');
  const [shippingTerms, setShippingTerms] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('');
  const [lines, setLines] = useState<CommercialDocumentLine[]>([emptyCommercialLine()]);
  const [sourceBarKey, setSourceBarKey] = useState(0);
  const [postFlowPending, setPostFlowPending] = useState(false);
  const {
    invoiceExtras,
    setInvoiceExtras,
    extrasOpen,
    setExtrasOpen,
    loadAdjustments,
    resetExtras,
    getExtrasPayload,
    validateExtras,
  } = useInvoiceExtras();

  const { data: salesOrderSettingsRes } = useApiQuery<TransactionSettings>(
    ['transaction-settings', 'SALES_ORDER'],
    '/transaction-settings/SALES_ORDER'
  );
  const salesTxSettings = salesOrderSettingsRes?.data;
  const serialAutomatic = isTransactionSerialAutomatic(salesTxSettings?.numberingMode);
  const autoPostOnSave = salesTxSettings?.autoPostOnSave === true;
  const [loadedSourceId, setLoadedSourceId] = useState('');
  const lockLoadedSource = shouldLockLoadedSource(salesTxSettings, loadedSourceId);
  const defaultWarehouseFromSettings = salesTxSettings?.defaultWarehouseId ?? '';
  const salesOrderSaveLabel =
    isManufacturing ? 'حفظ' : autoPostOnSave ? STORE_SAVE_AND_POST_LABEL : 'حفظ';

  useEffect(() => {
    if (selectedId || warehouseId || !defaultWarehouseFromSettings) return;
    setWarehouseId(defaultWarehouseFromSettings);
  }, [selectedId, warehouseId, defaultWarehouseFromSettings]);

  const salesOrderDraft = useMemo(
    () => ({
      orderNumber,
      description,
      date,
      deliveryLeadDays,
      deliveryDate,
      customerId,
      warehouseId,
      costCenterId,
      delegateId,
      currencyId,
      shippingTerms,
      paymentTerms,
      lines,
      internalNotes,
    }),
    [
      costCenterId,
      currencyId,
      customerId,
      date,
      delegateId,
      deliveryLeadDays,
      deliveryDate,
      description,
      internalNotes,
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
    setDeliveryLeadDays(payload.deliveryLeadDays ?? 7);
    setDeliveryDate(payload.deliveryDate);
    setCustomerId(payload.customerId);
    setWarehouseId(payload.warehouseId);
    setCostCenterId(payload.costCenterId);
    setDelegateId(payload.delegateId);
    setCurrencyId(payload.currencyId);
    setShippingTerms(payload.shippingTerms);
    setPaymentTerms(payload.paymentTerms);
    setLines(payload.lines?.length ? payload.lines : [emptyCommercialLine()]);
    setInternalNotes(Array.isArray(payload.internalNotes) ? payload.internalNotes : []);
  }, []);
  const skipServerHydrateRef = useRef(false);
  const postAfterSaveRef = useRef(false);
  const {
    restoreOffer,
    acceptRestore,
    dismissRestore,
    clearDraft,
  } = useDraftAutosave({
    documentType: isManufacturing ? 'manufacturing-sales-order' : 'sales-order',
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
  const isPosted = Boolean(loaded?.isPosted);


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

  const { data: itemsResponse } = useApiQuery<
    {
      id: string;
      averageCost?: number | string | null;
      lastPurchasePrice?: number | string | null;
      units?: { unit?: { id: string }; unitId?: string; isBaseUnit?: boolean }[];
    }[]
  >(['items', 'sales-order'], '/inventory/items', { limit: 200, isActive: true });
  const items = itemsResponse?.data ?? [];
  const enforceBelowCost = !isManufacturing && salesTxSettings?.preventSellingBelowCost !== false;

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
    if (!date || deliveryLeadDays < 0) return;
    setDeliveryDate(addDaysIso(date, deliveryLeadDays));
  }, [date, deliveryLeadDays]);

  const { data: workOrderBySalesRes, refetch: refetchWorkOrder } = useApiQuery<WorkOrderApi | null>(
    ['manufacturing-work-order-by-sales', selectedId ?? ''],
    selectedId ? `/manufacturing/work-orders/by-sales-order/${selectedId}` : '',
    undefined,
    { enabled: Boolean(isManufacturing && selectedId) }
  );
  const linkedManufacturingWorkOrder = workOrderBySalesRes?.data ?? null;
  const hasLinkedManufacturingWorkOrder = Boolean(linkedManufacturingWorkOrder?.id);

  useEffect(() => {
    const wo = workOrderBySalesRes?.data;
    if (wo) setWorkOrderPanel(mapWorkOrderToPanel(wo));
    else if (!workOrderIdFromUrl) setWorkOrderPanel(null);
  }, [workOrderBySalesRes?.data, workOrderIdFromUrl]);

  useEffect(() => {
    if (!workOrderIdFromUrl) return;
    void apiClient
      .get<WorkOrderApi>(`/manufacturing/work-orders/${workOrderIdFromUrl}`)
      .then((res) => {
        const wo = res.data;
        if (!wo) return;
        setWorkOrderPanel(mapWorkOrderToPanel(wo));
        const salesId = (wo.processMetadata as { salesOrderInvoiceId?: string })?.salesOrderInvoiceId;
        if (salesId && salesId !== selectedId) setSelectedId(salesId);
      })
      .catch(() => undefined);
  }, [workOrderIdFromUrl, selectedId]);

  useEffect(() => {
    if (skipServerHydrateRef.current) {
      skipServerHydrateRef.current = false;
      return;
    }
    if (!loaded || !selectedId) return;
    setOrderNumber(loaded.invoiceNumber || '');
    setDescription(String(loaded.description || '').replace(/^\[أمر بيع\]\s*/, ''));
    setDate(loaded.date ? String(loaded.date).slice(0, 10) : todayIso());
    const due = loaded.dueDate ? String(loaded.dueDate).slice(0, 10) : plusDays(7);
    const docDate = loaded.date ? String(loaded.date).slice(0, 10) : todayIso();
    setDeliveryDate(due);
    setDeliveryLeadDays(daysBetween(docDate, due));
    setCustomerId(loaded.customerId || '');
    const notesList = Array.isArray(loaded.internalNotes) ? loaded.internalNotes : [];
    setPaymentInstallments(extractPaymentInstallments(notesList));
    setInternalNotes(stripPaymentInstallmentsNote(notesList));
    setWarehouseId(loaded.warehouseId || '');
    setCostCenterId(loaded.costCenterId || '');
    setDelegateId(loaded.representativeId || '');
    setCurrencyId(loaded.currencyId || currencyId);
    setLines(
      (loaded.lines ?? []).map((line) => {
        const extras = unpackSalesOrderLineNotes(line.lineNotes);
        return {
          itemId: line.itemId,
          itemCode: line.item?.code || '',
          itemName: line.item?.arabicName || '',
          unitId: line.unitId || '',
          unitName: '',
          quantity: Number(line.quantity) || 0,
          unitPrice: Number(line.unitPrice) || 0,
          discount: Number(line.discountPercent) || 0,
          taxRate: Number(line.taxPercent) || 14,
          notes: extras.specifications || '',
          specifications: extras.specifications || '',
          imageUrl: extras.imageUrl || '',
          costCenterId: line.costCenterId || '',
        };
      })
    );
    loadAdjustments((loaded as { adjustments?: InvoiceAdjustmentApiRow[] }).adjustments);
  }, [loaded, selectedId, currencyId, loadAdjustments]);

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
  const extrasNet = useMemo(
    () => sumPartyInvoiceExtras(invoiceExtras, totals.gross - totals.discount, 1),
    [invoiceExtras, totals.discount, totals.gross]
  );
  const orderNetTotal = totals.net + extrasNet;
  const status = orderStatus(loaded);

  const saveMutation = useApiMutation<OrderRecord, Record<string, unknown>>('/invoices', 'POST', {
    showSuccessToast: false,
    onSuccess: (res) => {
      invalidateStockViews(invalidateQuery);
      const id = res.data?.id;
      const shouldPost = postAfterSaveRef.current;
      postAfterSaveRef.current = false;
      const finish = (posted: boolean) => {
      maybeAutoPrintAfterSave(salesTxSettings?.autoPrintOnSave, printOrder);
      finishDocumentSave({
        label: isManufacturing ? 'أمر البيع للتصنيع' : 'أمر بيع',
        number: res.data?.invoiceNumber || orderNumber,
        posted,
        savedId: id,
        cleared: isManufacturing,
        clearDraft,
        onOpen: isManufacturing
          ? undefined
          : (saved) => {
              setSelectedId(saved);
              const params = new URLSearchParams(searchParams.toString());
              params.set('orderId', saved);
              const qs = params.toString();
              router.replace(qs ? `?${qs}` : window.location.pathname, { scroll: false });
            },
        reset: () => resetNew(),
      });
      };
      if (shouldPost && id) {
        void postStoreDocumentAfterSave({
          postPath: `/invoices/${id}/post`,
          onPosted: () => {
            invalidateQuery(['invoice', id]);
            finish(true);
          },
          onPostFailed: (message) => setError(message),
        });
        return;
      }
      finish(false);
    },
    onError: (err: ApiError) => {
      postAfterSaveRef.current = false;
      setError(err.message || 'تعذر حفظ أمر البيع');
    },
  });

  const updateMutation = useApiMutation<OrderRecord, Record<string, unknown>>(
    selectedId ? `/invoices/${selectedId}` : '/invoices',
    'PUT',
    {
      showSuccessToast: false,
      onSuccess: () => {
        invalidateStockViews(invalidateQuery);
        const id = selectedId;
        const shouldPost = postAfterSaveRef.current;
        postAfterSaveRef.current = false;
        const finish = (posted: boolean) => {
        maybeAutoPrintAfterSave(salesTxSettings?.autoPrintOnSave, printOrder);
        finishDocumentSave({
          label: isManufacturing ? 'أمر البيع للتصنيع' : 'أمر بيع',
          number: orderNumber,
          posted,
          savedId: id,
          cleared: isManufacturing,
          clearDraft,
          onOpen: isManufacturing
            ? undefined
            : (saved) => {
                setSelectedId(saved);
                const params = new URLSearchParams(searchParams.toString());
                params.set('orderId', saved);
                const qs = params.toString();
                router.replace(qs ? `?${qs}` : window.location.pathname, { scroll: false });
              },
          reset: () => resetNew(),
        });
        };
        if (shouldPost && id) {
          void postStoreDocumentAfterSave({
            postPath: `/invoices/${id}/post`,
            onPosted: () => {
              invalidateQuery(['invoice', id]);
              finish(true);
            },
            onPostFailed: (message) => setError(message),
          });
          return;
        }
        finish(false);
      },
      onError: (err: ApiError) => {
        postAfterSaveRef.current = false;
        setError(err.message || 'تعذر تحديث أمر البيع');
      },
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
        invalidateQuery(['sales-orders-browse']);
        invalidateQuery(['invoice', selectedId ?? '']);
      },
      onError: (err: ApiError) => setError(err.message || 'تعذر إلغاء أمر البيع'),
    }
  );

  const handleRestoreCancelledOrder = async () => {
    if (!selectedId) return;
    setRestorePending(true);
    try {
      if (isManufacturing) {
        await apiClient.post(`/invoices/${selectedId}/restore`, {});
      } else {
        await restoreCancelledDocument({
          restorePath: `/invoices/${selectedId}/restore`,
          postPath: `/invoices/${selectedId}/post`,
          kind: 'invoice',
          autoPostOnSave: salesTxSettings?.autoPostOnSave,
        });
      }
      invalidateQuery(['invoices']);
      invalidateQuery(['sales-orders-browse']);
      invalidateQuery(['invoice', selectedId]);
      setSuccess('تم استعادة أمر البيع');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر استعادة أمر البيع');
    } finally {
      setRestorePending(false);
    }
  };

  const buildOrderBody = () => {
    const notes = [shippingTerms, paymentTerms].filter(Boolean).join(' — ');
    const desc = (description || '').trim();
    const notesWithInstallments = withPaymentInstallmentsNote(internalNotes, paymentInstallments);
    return {
      invoiceNumber: serialAutomatic && !selectedId ? undefined : orderNumber || undefined,
      description: notes ? `${desc} — ${notes}` : desc,
      date,
      dueDate: deliveryDate,
      hijriDate: toHijriDate(date),
      customerId,
      warehouseId,
      currencyId,
      costCenterId: costCenterId || undefined,
      delegateId: delegateId || undefined,
      paymentMethod: 'credit' as M5FormData['paymentMethod'],
      internalNotes: notesWithInstallments,
      installments: paymentInstallments.length ? paymentInstallments : undefined,
      lines: entered.map((line) => ({
        itemId: line.itemId,
        unitId: line.unitId,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        discount: line.discount,
        taxRate: line.taxRate,
        lineNotes: packSalesOrderLineNotes(
          line.specifications || line.notes || '',
          line.imageUrl
        ),
        costCenterId: line.costCenterId || undefined,
      })),
      adjustments: getExtrasPayload(),
    };
  };

  const handleCreateWorkOrder = async () => {
    setError('');
    if (!selectedId) {
      setError('احفظ أمر البيع أولاً ثم أنشئ أمر الشغل');
      return;
    }
    setWorkOrderBusy(true);
    try {
      const res = await apiClient.post<WorkOrderApi>(
        `/manufacturing/work-orders/from-sales-order/${selectedId}`
      );
      if (res.data) {
        setWorkOrderPanel(mapWorkOrderToPanel(res.data));
        setSuccess('تم إنشاء أمر الشغل من أمر البيع');
        void refetchWorkOrder();
      }
    } catch (err) {
      setError((err as ApiError).message || 'تعذر إنشاء أمر الشغل');
    } finally {
      setWorkOrderBusy(false);
    }
  };

  const handleSaveWorkOrderLines = async () => {
    if (!workOrderPanel?.id) return;
    setWorkOrderBusy(true);
    try {
      const payload = {
        workDate: workOrderPanel.workDate,
        modelQuantity: 1,
        status: 'CONFIRMED',
        processMetadata: {
          salesOrderNumber: workOrderPanel.salesOrderNumber,
          deliveryLeadDays: workOrderPanel.deliveryLeadDays,
          expectedDeliveryDate: workOrderPanel.expectedDeliveryDate,
        },
        lines: workOrderPanel.lines
          .filter((l) => l.itemId && l.quantity > 0)
          .map((l, index) => ({
            itemId: l.itemId,
            plannedQuantity: l.quantity,
            lineDescription: l.specifications || null,
            imageUrl: l.imageUrl || null,
            lineOrder: index + 1,
          })),
      };
      const res = await apiClient.put<WorkOrderApi>(
        `/manufacturing/work-orders/${workOrderPanel.id}`,
        payload
      );
      if (res.data) setWorkOrderPanel(mapWorkOrderToPanel(res.data));
      setSuccess('تم تحديث أصناف أمر الشغل');
    } catch (err) {
      setError((err as ApiError).message || 'تعذر حفظ أمر الشغل');
    } finally {
      setWorkOrderBusy(false);
    }
  };

  const postExistingOrder = () => {
    if (!selectedId) {
      requestExplicitPostAfterSave();
      return;
    }
    setPostFlowPending(true);
    void apiClient
      .post(`/invoices/${selectedId}/post`)
      .then(() => {
        setSuccess('تم ترحيل أمر البيع');
        invalidateQuery(['invoice', selectedId]);
        invalidateStockViews(invalidateQuery);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'تعذر الترحيل');
      })
      .finally(() => setPostFlowPending(false));
  };

  const requestPostAfterSave = () => {
    if (isPosted || loaded?.isCancelled || loaded?.convertedInvoiceId) return;
    postAfterSaveRef.current = autoPostOnSave;
    handleSave();
  };

  const requestExplicitPostAfterSave = () => {
    if (isPosted || loaded?.isCancelled || loaded?.convertedInvoiceId) return;
    postAfterSaveRef.current = true;
    handleSave();
  };

  const printOrder = () => {
    void printOperationalDocument({
      title: 'أمر بيع',
      documentNo: orderNumber || 'جديد',
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
  };

  const handleSave = () => {
    setError('');
    const extrasValidation = validateExtras();
    if (extrasValidation) {
      setError(extrasValidation);
      setExtrasOpen(true);
      return;
    }
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
    if (enforceBelowCost && findBelowCostLine(entered, items)) {
      setError(SELL_BELOW_COST_MESSAGE);
      return;
    }
    if (!selectedId && !serialAutomatic && !orderNumber.trim()) {
      setError('أدخل رقم أمر البيع — الترقيم يدوي في إعدادات المستند');
      return;
    }
    const form = buildOrderBody() as unknown as M5FormData;
    if (selectedId) {
      updateMutation.mutate(
        mapSalesFormToM5UpdateBody(form, {
          invoiceKind: 'SALES_ORDER',
          currencies,
          items,
          expectedVersion: loaded?.version,
        })
      );
      return;
    }
    saveMutation.mutate(mapSalesFormToM5CreateBody(form, { invoiceKind: 'SALES_ORDER', currencies, items }));
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
    setDeliveryLeadDays(7);
    setDeliveryDate(plusDays(7));
    setWorkOrderPanel(null);
    setCustomerId('');
    setLines([emptyCommercialLine()]);
    setLoadedSourceId('');
    setSourceBarKey((k) => k + 1);
    resetExtras();
    setError('');
    setSuccess('');
    if (isManufacturing) {
      setWarehouseId(defaultWarehouseFromSettings || '');
      setCostCenterId('');
    }
    const params = new URLSearchParams(searchParams.toString());
    params.delete('orderId');
    params.delete('invoiceId');
    params.delete('workOrderId');
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : window.location.pathname, { scroll: false });
    clearDraft();
  };

  const money = (n: number) => n.toLocaleString('ar-EG', { minimumFractionDigits: 2 });

  const handleSourceHydrate = (payload: SourceHydratePayload) => {
    const header = stockHeaderFieldsFromSource(payload, description);
    if (header.customerId) setCustomerId(header.customerId);
    if (header.warehouseId) setWarehouseId(header.warehouseId);
    if (header.description) setDescription(header.description);
    const mapped = mapSourcePayloadToCommercialLines(payload);
    setLines(mapped.length ? mapped : [emptyCommercialLine()]);
    setLoadedSourceId(payload.sourceId);
    loadAdjustments(payload.adjustments);
    toast.success(`تم تحميل الأمر من ${payload.sourceNumber}`);
  };

  return (
    <ErpDocumentLayout>
      <PageDraftRestoreGate<typeof salesOrderDraft>
        restoreOffer={restoreOffer}
        hide={Boolean(selectedId)}
        message="يوجد مسودة أمر بيع غير محفوظة."
        acceptRestore={acceptRestore}
        dismissRestore={dismissRestore}
        onRestored={(payload) => {
          applySalesOrderDraft(payload);
          setSuccess('تم استعادة مسودة أمر البيع');
        }}
      />
      <div className="flex min-h-[calc(100dvh-3rem)] flex-col pb-4">
        <ErpDocumentPageHeader
          breadcrumbs={breadcrumbs}
          title={isManufacturing ? 'أمر البيع للتصنيع' : 'أمر البيع'}
          docNumber={orderNumber || 'SO-XXXX'}
          statusTone={status.tone}
          statusLabel={status.label}
          onSaveDraft={isManufacturing ? handleSave : requestPostAfterSave}
          saveLabel={salesOrderSaveLabel}
          savePending={saveMutation.isPending || updateMutation.isPending}
          canSave={!isPosted && !loaded?.isCancelled && !loaded?.convertedInvoiceId}
          canPost={Boolean(selectedId) && !isPosted && !loaded?.isCancelled}
          onPost={() => postExistingOrder()}
          hideStandalonePost
          lockWhenPosted={!isManufacturing}
          lifecycle={{
            documentId: selectedId,
            isPosted,
            isCancelled: Boolean(loaded?.isCancelled),
          }}
          saveDisabledHint={
            isManufacturing
              ? 'أكمل العميل والمخزن والأصناف قبل الحفظ'
              : undefined
          }
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
          favoriteHref={routeHref}
          favoriteLabel="أمر بيع"
          currentId={selectedId}
          standardActions={{
            hasDocument: Boolean(selectedId),
            isPosted,
            isCancelled: Boolean(loaded?.isCancelled),
            postPending: postFlowPending,
            unpostPending: postFlowPending,
            onPost: () => postExistingOrder(),
            onUnpost: () => {
              if (!selectedId) return;
              setPostFlowPending(true);
              void apiClient
                .post(`/invoices/${selectedId}/unpost`)
                .then(() => {
                  setSuccess('تم فك ترحيل أمر البيع');
                  invalidateQuery(['invoice', selectedId]);
                })
                .catch((err: unknown) => {
                  setError(err instanceof Error ? err.message : 'تعذر فك الترحيل');
                })
                .finally(() => setPostFlowPending(false));
            },
            onEdit: () => {
              if (isPosted) setError('يجب فك الترحيل أولاً للتعديل');
            },
            onNew: resetNew,
            newLabel: 'أمر جديد',
            onPrint: printOrder,
            onVoid: async () => {
              if (!selectedId) return;
              if (isManufacturing && hasLinkedManufacturingWorkOrder) {
                setError(
                  `لا يمكن إلغاء أمر البيع — مربوط بأمر الشغل ${linkedManufacturingWorkOrder?.orderNumber ?? ''}. ألغِ أمر الشغل من التخطيط أولاً.`
                );
                return;
              }
              const ok = await confirmAction({
                message: isManufacturing
                  ? 'إلغاء أمر البيع للتصنيع؟ (لا يؤثر على فواتير المبيعات)'
                  : 'إلغاء أمر البيع؟',
                confirmLabel: 'إلغاء',
                tone: 'danger',
              });
              if (!ok) return;
              cancelMutation.mutate({});
            },
            voidPending: cancelMutation.isPending,
            onRestore: () => void handleRestoreCancelledOrder(),
            restorePending,
            restoreLabel: 'استعادة الأمر',
            transactionSettingsDocumentType: 'SALES_ORDER',
            onTransactionSettingsSaved: () => {
              invalidateAfterTransactionSettingsSave(invalidateQuery, 'SALES_ORDER');
            },
          }}
        />

        {error ? <ErrorToast message={error} onClose={() => setError('')} /> : null}
        {success ? <SuccessToast message={success} onClose={() => setSuccess('')} /> : null}

        {isManufacturing && hasLinkedManufacturingWorkOrder && linkedManufacturingWorkOrder ? (
          <p className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
            مربوط بأمر الشغل{' '}
            <span className="font-semibold">{linkedManufacturingWorkOrder.orderNumber}</span> — يمكنك{' '}
            <strong>التعديل والحفظ</strong> في أي وقت. إلغاء أو حذف أمر البيع غير متاح قبل إلغاء أمر
            الشغل من التخطيط الإنتاجي.
          </p>
        ) : null}

        <ErpFormHeaderCard
          fieldsDisabled={lockLoadedSource}
          extrasLabel={isManufacturing ? undefined : 'خيارات إضافية'}
          sourceActions={
            isManufacturing
              ? undefined
              : (
                <DocumentSourceLoadBar
                  key={sourceBarKey}
                  hasExistingLines={entered.length > 0}
                  disabled={Boolean(loaded?.isPosted || loaded?.convertedInvoiceId)}
                  currentAffectsStock={false}
                  onHydrate={handleSourceHydrate}
                />
              )
          }
          headerActions={
            <div className="flex flex-wrap items-center gap-2">
              <InternalNotesScratchpad
                notes={internalNotes}
                onChange={setInternalNotes}
                disabled={Boolean(loaded?.isPosted || loaded?.convertedInvoiceId || lockLoadedSource)}
                className="inline-flex"
              />
              {!isManufacturing ? (
                <Button type="button" size="sm" variant="outline" onClick={() => setPaymentModalOpen(true)}>
                  شروط الدفع
                </Button>
              ) : null}
            </div>
          }
          row1={
            <>
              <div className="space-y-1">
                <label className={erpLabelClass}>رقم أمر البيع</label>
                <input
                  className={erpInputClass}
                  value={orderNumber}
                  onChange={(e) => setOrderNumber(e.target.value)}
                  placeholder={serialAutomatic ? 'يُولَّد تلقائياً' : 'أدخل الرقم يدوياً'}
                  readOnly={serialAutomatic || Boolean(loaded?.isPosted)}
                />
              </div>
              <div className="space-y-1">
                <label className={erpLabelClass}>اسم العميل</label>
                <CustomerSelect
                  value={customerId}
                  onChange={setCustomerId}
                  className={erpInputClass}
                  includeAllAccounts={shouldShowAllAccountsInPartyField(salesTxSettings)}
                />
              </div>
              <div className="space-y-1">
                <label className={erpLabelClass}>
                  المخزن <span className="text-rose-600" aria-hidden="true">*</span>
                </label>
                <WarehouseSelect
                  value={warehouseId}
                  onChange={setWarehouseId}
                  className={erpInputClass}
                  leafOnly
                  emptyLabel="اختر المخزن"
                  disabled={Boolean(loaded?.isCancelled || loaded?.convertedInvoiceId)}
                />
                <WarehouseItemScopeToggle />
              </div>
              <DatePickerWithHijri label="التاريخ" value={date} onChange={setDate} />
              <div className="space-y-1">
                <label className={erpLabelClass}>مدة التسليم (يوم)</label>
                <input
                  type="number"
                  min={0}
                  className={erpInputClass}
                  value={deliveryLeadDays}
                  onChange={(e) => setDeliveryLeadDays(Number(e.target.value) || 0)}
                />
              </div>
              <DatePickerWithHijri
                label="تاريخ التسليم المتوقع"
                value={deliveryDate}
                onChange={setDeliveryDate}
              />
            </>
          }
          row2={
            <>
              <div className="space-y-1 md:col-span-2">
                <label className={erpLabelClass}>الشرح / البيان</label>
                <input className={erpInputClass} value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
              {!isManufacturing ? (
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
              ) : null}
            </>
          }
          extras={
            isManufacturing
              ? undefined
              : (
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
              )
          }
        />

        <div className="mt-3">
          <SalesOrderLinesTable
            lines={lines}
            onChange={setLines}
            warehouseId={warehouseId}
            mode={isManufacturing ? 'manufacturing' : 'full'}
            disabled={Boolean(loaded?.isCancelled || loaded?.convertedInvoiceId || lockLoadedSource)}
            onImageError={(message) => setError(message)}
            enforceBelowCost={enforceBelowCost}
          />
        </div>

        {!isManufacturing ? (
          <InvoiceExtrasPanel
            open={extrasOpen}
            onToggle={() => setExtrasOpen((v) => !v)}
            rows={invoiceExtras}
            onChange={setInvoiceExtras}
            currencies={currencies}
            defaultCurrency={currencies.find((c) => c.id === currencyId)?.code ?? 'EGP'}
            defaultExchangeRate={1}
            defaultCostCenterId={costCenterId || ''}
            disabled={Boolean(loaded?.isPosted || loaded?.isCancelled || loaded?.convertedInvoiceId || lockLoadedSource)}
            count={getExtrasPayload().length}
            headerDescription={description}
          />
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            className="bg-[#0E78AA] hover:bg-[#0B6188]"
            disabled={!selectedId || workOrderBusy || Boolean(workOrderPanel)}
            onClick={() => void handleCreateWorkOrder()}
          >
            إنشاء أمر شغل
          </Button>
          {workOrderPanel ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={workOrderBusy}
              onClick={() => void handleSaveWorkOrderLines()}
            >
              حفظ أصناف أمر الشغل
            </Button>
          ) : null}
        </div>

        <div className="mt-4">
          <SalesOrderWorkOrderPanel
            workOrder={workOrderPanel}
            disabled={workOrderBusy}
            onLinesChange={(nextLines) =>
              setWorkOrderPanel((prev) => (prev ? { ...prev, lines: nextLines } : prev))
            }
          />
        </div>

        {!isManufacturing ? (
          <PaymentInstallmentsModal
            open={paymentModalOpen}
            onClose={() => setPaymentModalOpen(false)}
            remainingAmount={orderNetTotal}
            startDate={date}
            initial={paymentInstallments}
            onConfirm={(rows) => {
              setPaymentInstallments(rows);
              setPaymentModalOpen(false);
            }}
          />
        ) : null}

        {isManufacturing ? (
          <p className="mt-4 text-xs text-slate-500">
            بعد الحفظ استخدم «إنشاء أمر شغل» ثم أمر الشغل (نماذج التصنيع) — بدون فواتير مبيعات من هذه الشاشة.
          </p>
        ) : (
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
            <div className="text-sm">
              الإجمالي:{' '}
              <b className="font-mono text-base text-emerald-600">{money(orderNetTotal)} ج.م</b>
            </div>
          </div>
        )}

        <DocumentBrowseDrawer open={browseOpen} onClose={() => setBrowseOpen(false)} title="أوامر البيع السابقة">
          <GenericRecordsList
            apiPath="/invoices"
            listKey="sales-orders-browse"
            extraParams={{ invoiceKind: 'SALES_ORDER', includeCancelled: true }}
            selectedId={selectedId}
            columns={[
              {
                id: 'num',
                header: 'الرقم',
                getValue: (r) => String(r.invoiceNumber ?? r.id.slice(0, 8)),
              },
              {
                id: 'date',
                header: 'التاريخ',
                getValue: (r) => (r.date ? new Date(String(r.date)).toLocaleDateString('ar-EG') : '—'),
              },
              {
                id: 'party',
                header: 'العميل',
                getValue: (r) => {
                  const c = r.customer as { arabicName?: string } | undefined;
                  return c?.arabicName || '—';
                },
              },
            ]}
            resolveStatus={(r) => {
              if (r.isCancelled) {
                const st = savedDocumentRowStatus({ isCancelled: true, isPosted: false });
                return { variant: st.tone, label: st.label };
              }
              if (r.convertedInvoiceId) {
                return { variant: 'success' as const, label: 'تم التوريد بالكامل' };
              }
              const st = savedDocumentRowStatus({
                isPosted: Boolean(r.isPosted),
                isCancelled: false,
              });
              return { variant: st.tone, label: st.label };
            }}
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
