'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useOwnTabPathname, useOwnTabSearchParams } from '@/lib/navigation/tab-route-lock';
import { useForm, useWatch, type Resolver, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ErpDocumentLayout, ErpDocumentPageHeader } from '@/components/erp';
import { DocumentBrowseDrawer } from '@/components/erp/DocumentBrowseDrawer';
import { GenericRecordsList } from '@/components/erp/GenericRecordsList';
import {
  FormSectionCard,
  CompactFormField,
  AdvancedFieldsSection,
  compactControlClass,
  denseTableWrapClass,
  denseTableClass,
  denseTheadClass,
  denseThClass,
} from '@/components/ui';
import { useApiQuery, useApiMutation, useInvalidateQuery } from '@/lib/hooks/useApi';
import { restoreCancelledDocument } from '@/lib/documents/restore-cancelled-document';
import { apiClient } from '@/lib/api/client';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';
import {
  inventoryPurchaseOrderFormSchema,
  inventoryPurchaseOrderHeaderFormSchema,
  type InventoryPurchaseOrderHeaderFormInput,
} from '@/lib/validation/inventory.schema';
import type { ApiError } from '@/lib/api/types';
import { onFieldErrors } from '@/lib/forms/on-field-errors';
import { finishDocumentSave } from '@/lib/documents/finish-save';
import { invalidateStockViews } from '@/lib/invoices/invalidate-stock-views';
import { postStoreDocumentAfterSave } from '@/lib/inventory/post-store-document-after-save';
import { STORE_SAVE_AND_POST_LABEL } from '@/lib/inventory/store-document-save-post';
import { invalidateAfterTransactionSettingsSave } from '@/lib/inventory/transaction-settings-invalidate';
import {
  useApplyDefaultWarehouseFromTransactionSettings,
  useTransactionDocumentSettings,
} from '@/lib/transaction-settings/use-transaction-document-settings';
import { InternalNotesScratchpad } from '@/components/documents/InternalNotesScratchpad';
import { shouldLockLoadedSource, shouldShowAllAccountsInPartyField } from '@/lib/transaction-settings/types';
import { maybeAutoPrintAfterSave } from '@/lib/printer/print-prefs';
import type { InternalNoteEntry } from '@/lib/invoices/payment-split.types';

import {
  computeInvoiceFinancialSummary,
  computeInvoiceGrossDiscount,
} from '@/lib/invoices/computeInvoiceFinancialSummary';
import { InvoiceExtrasPanel } from '@/components/inventory/invoices/InvoiceExtrasPanel';
import { PurchaseInvoiceBottomSplit } from '@/components/inventory/purchase-invoice/PurchaseInvoiceBottomSplit';
import { useInvoiceExtras } from '@/lib/invoices/use-invoice-extras';
import { extrasFromApi, sumPartyInvoiceExtras, validateInvoiceExtrasForSave } from '@/lib/invoices/invoice-adjustments';
import type { InvoiceAdjustmentApiRow } from '@/lib/invoices/invoice-adjustments';
import { InvoiceLineStockBalanceCell } from '@/components/invoices/InvoiceLineStockBalanceCell';
import { WarehouseSelect } from '@/components/form/WarehouseSelect';
import { CostCenterSelect } from '@/components/form/CostCenterSelect';
import { SupplierSelect } from '@/components/form/PartySelect';
import { ItemSelect } from '@/app/components/form/ItemSelect';
import { toFiniteNumber } from '@/components/dashboard/period';
import {
  isAtOrderLimit,
  reorderPurchaseQuantity,
  type ReorderCandidate,
} from '@/lib/inventory/reorder-items';
import { DocumentSourceLoadBar } from '@/components/invoices/DocumentSourceLoadBar';
import { stockHeaderFieldsFromSource } from '@/lib/inventory/apply-source-to-stock-document';
import type { SourceHydratePayload } from '@/lib/invoices/sourceDocument';
import { toast } from '@/lib/feedback/toast';
import { useDocumentConvertMutation } from '@/lib/hooks/useDocumentConvert';
import { DocumentFollowUpButton } from '@/components/documents/DocumentFollowUpButton';
import { buildPurchaseInvoiceHref } from '@/lib/documents/document-follow-up';
import { printOperationalDocument } from '@/lib/print/printOperationalDocument';
import { useDraftAutosave } from '@/lib/hooks/useDraftAutosave';
import { PageDraftRestoreGate } from '@/components/erp/PageDraftRestoreGate';
import { hasLineWithItem } from '@/lib/drafts/form-lines-draft';

interface Currency {
  id: string;
  code: string;
  arabicName: string;
  englishName?: string;
}

interface PurchaseOrderLine {
  itemId: string;
  itemLabel?: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  tax?: number;
}

function emptyOrderLine(): PurchaseOrderLine {
  return { itemId: '', quantity: 1, unitPrice: 0, discount: 0, tax: 0 };
}

function orderLineNet(line: PurchaseOrderLine): number {
  const gross = (Number(line.quantity) || 0) * (Number(line.unitPrice) || 0);
  const afterDiscount = gross * (1 - (Number(line.discount) || 0) / 100);
  return afterDiscount * (1 + (Number(line.tax) || 0) / 100);
}

type PurchaseOrderDraft = {
  header: InventoryPurchaseOrderHeaderFormInput;
  orderLines: PurchaseOrderLine[];
  internalNotes: InternalNoteEntry[];
  invoiceExtras?: ReturnType<typeof extrasFromApi>;
};

function isPurchaseOrderDraftEmpty(draft: PurchaseOrderDraft): boolean {
  const h = draft.header;
  return (
    !h.supplierId?.trim() &&
    !h.description?.trim() &&
    !h.orderNumber?.trim() &&
    !hasLineWithItem(draft.orderLines) &&
    !(draft.internalNotes?.length ?? 0) &&
    !(draft.invoiceExtras ?? []).some(
      (row) => Boolean(row.accountId?.trim()) || Number(row.additionValue) > 0 || Number(row.discountValue) > 0
    )
  );
}

function emptyPurchaseOrderHeader(today: string): InventoryPurchaseOrderHeaderFormInput {
  return {
    orderNumber: '',
    description: '',
    date: today,
    hijriDate: '',
    supplierId: '',
    warehouseId: '',
    costCenterId: '',
    currencyId: '',
    isPosted: false,
    isApproved: false,
    useBarcode: false,
    hideExistingQty: false,
  };
}

export default function PurchaseOrderPage() {
  const invalidateQuery = useInvalidateQuery();
  const todayStr = new Date().toISOString().split('T')[0];

  const {
    register,
    handleSubmit,
    reset,
    watch,
    control,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<InventoryPurchaseOrderHeaderFormInput>({
    resolver: zodResolver(inventoryPurchaseOrderHeaderFormSchema) as Resolver<InventoryPurchaseOrderHeaderFormInput>,
    defaultValues: emptyPurchaseOrderHeader(todayStr),
    mode: 'onTouched',
  });

  const isPosted = watch('isPosted');
  const warehouseId = watch('warehouseId');

  const [orderLines, setOrderLines] = useState<PurchaseOrderLine[]>([emptyOrderLine()]);
  const {
    invoiceExtras,
    setInvoiceExtras,
    extrasOpen,
    setExtrasOpen,
    loadAdjustments,
    resetExtras,
    getExtrasPayload,
  } = useInvoiceExtras();
  const [loadedSourceId, setLoadedSourceId] = useState('');
  const [sourceBarKey, setSourceBarKey] = useState(0);
  const [showList, setShowList] = useState(false);
  const router = useRouter();
  const ownPathname = useOwnTabPathname();
  const searchParams = useOwnTabSearchParams();
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(
    () => searchParams.get('orderId')?.trim() || null
  );
  const fromOrderLimit = searchParams.get('from') === 'order-limit';
  const reorderApplied = useRef(false);
  const postAfterSaveRef = useRef(false);
  const {
    settings: purchaseOrderTxSettings,
    autoPostOnSave,
    autoPrintOnSave,
    saveLabel: legacySaveLabel,
    serialAutomatic,
    defaultWarehouseId: txDefaultWarehouseId,
  } = useTransactionDocumentSettings('PURCHASE_ORDER');
  const orderSaveLabel = autoPostOnSave ? STORE_SAVE_AND_POST_LABEL : legacySaveLabel;
  const lockLoadedSource = shouldLockLoadedSource(purchaseOrderTxSettings, loadedSourceId);

  useApplyDefaultWarehouseFromTransactionSettings({
    selectedId: selectedOrderId,
    warehouseId,
    defaultWarehouseId: txDefaultWarehouseId,
    setWarehouseId: (id) => setValue('warehouseId', id, { shouldDirty: false }),
  });

  const financialSummary = useMemo(() => {
    const lines = orderLines.map((line) => ({
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      discount: line.discount,
      taxRate: line.tax,
    }));
    const { gross, commercialDiscount } = computeInvoiceGrossDiscount(lines);
    const extrasNet = sumPartyInvoiceExtras(invoiceExtras, gross - commercialDiscount, 1);
    return computeInvoiceFinancialSummary(lines, {
      applyTax: true,
      additionsAndDiscounts: extrasNet,
    });
  }, [invoiceExtras, orderLines]);

  const convertMutation = useDocumentConvertMutation();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [internalNotes, setInternalNotes] = useState<InternalNoteEntry[]>([]);
  const watchedHeader = useWatch({ control }) as InventoryPurchaseOrderHeaderFormInput;

  const draftSnapshot = useMemo(
    (): PurchaseOrderDraft => ({
      header: watchedHeader ?? emptyPurchaseOrderHeader(todayStr),
      orderLines,
      internalNotes,
      invoiceExtras,
    }),
    [internalNotes, invoiceExtras, orderLines, todayStr, watchedHeader]
  );

  const applyPurchaseOrderDraft = useCallback(
    (payload: PurchaseOrderDraft) => {
      reset({ ...emptyPurchaseOrderHeader(todayStr), ...payload.header });
      setOrderLines(
        Array.isArray(payload.orderLines) && payload.orderLines.length
          ? payload.orderLines
          : [emptyOrderLine()]
      );
      setInternalNotes(Array.isArray(payload.internalNotes) ? payload.internalNotes : []);
      setInvoiceExtras(Array.isArray(payload.invoiceExtras) ? payload.invoiceExtras : []);
      setExtrasOpen(false);
    },
    [reset, setExtrasOpen, setInvoiceExtras, todayStr]
  );

  const { restoreOffer, acceptRestore, dismissRestore, clearDraft } = useDraftAutosave({
    documentType: 'purchase-order',
    mode: selectedOrderId ? 'edit' : 'new',
    documentId: selectedOrderId,
    value: draftSnapshot,
    enabled: !isPosted,
    applyRestore: applyPurchaseOrderDraft,
    isEmpty: isPurchaseOrderDraftEmpty,
    restoreMessage: 'يوجد مسودة أمر شراء غير محفوظة',
  });

  // Fetch currencies
  const { data: currenciesResponse, isLoading: currenciesLoading } = useApiQuery<Currency[]>(
    ['currencies'],
    '/accounting/currencies',
    { limit: 100, isActive: true }
  );
  const currencies = useMemo(() => currenciesResponse?.data ?? [], [currenciesResponse?.data]);

  const { data: reorderItemsResponse } = useApiQuery<ReorderCandidate[]>(
    ['purchase-order-reorder-items'],
    '/inventory/items',
    { limit: 200, isActive: true },
    { enabled: fromOrderLimit && !selectedOrderId, staleTime: 15_000 }
  );

  const { data: selectedOrderResponse } = useApiQuery<{
    orderNumber?: string | null;
    description?: string | null;
    date?: string;
    hijriDate?: string | null;
    supplierId?: string | null;
    warehouseId?: string | null;
    costCenterId?: string | null;
    currencyId?: string | null;
    currency?: { id?: string } | null;
    isPosted?: boolean;
    isApproved?: boolean;
    invoiceId?: string | null;
    isCancelled?: boolean;
    internalNotes?: InternalNoteEntry[] | null;
    adjustments?: InvoiceAdjustmentApiRow[] | null;
    lines?: Array<{
      itemId: string;
      quantity?: number | string;
      unitPrice?: number | string;
      discountPercentage?: number | string;
      discountValue?: number | string;
      taxPercentage?: number | string;
      item?: { arabicName?: string };
    }>;
  }>(
    ['purchase-order', selectedOrderId ?? ''],
    selectedOrderId ? `/inventory/purchase-orders/${selectedOrderId}` : '/inventory/purchase-orders',
    undefined,
    { enabled: Boolean(selectedOrderId) }
  );

  useEffect(() => {
    const o = selectedOrderResponse?.data;
    if (!o || !selectedOrderId) return;
    reset({
      ...emptyPurchaseOrderHeader(o.date?.slice(0, 10) || todayStr),
      orderNumber: o.orderNumber ?? '',
      description: o.description ?? '',
      date: o.date?.slice(0, 10) || todayStr,
      hijriDate: o.hijriDate ?? '',
      supplierId: o.supplierId ?? '',
      warehouseId: o.warehouseId ?? '',
      costCenterId: o.costCenterId ?? '',
      currencyId: o.currencyId ?? o.currency?.id ?? '',
      isPosted: Boolean(o.isPosted),
      isApproved: Boolean(o.isApproved),
    });
    setOrderLines(
      (o.lines ?? []).map((line) => ({
        itemId: line.itemId,
        quantity: Number(line.quantity ?? 0),
        unitPrice: Number(line.unitPrice ?? 0),
        discount: Number(line.discountPercentage ?? line.discountValue ?? 0),
        tax: Number(line.taxPercentage ?? 0),
      }))
    );
    setInternalNotes(Array.isArray(o.internalNotes) ? o.internalNotes : []);
    loadAdjustments(o.adjustments);
  }, [loadAdjustments, selectedOrderResponse, selectedOrderId, reset, todayStr]);

  useEffect(() => {
    if (!fromOrderLimit || selectedOrderId || reorderApplied.current) return;
    if (!reorderItemsResponse) return;
    const rows = (reorderItemsResponse.data ?? []).filter(isAtOrderLimit);
    reorderApplied.current = true;
    setOrderLines(
      rows.length
        ? rows.map((item) => ({
            itemId: item.id,
            itemLabel: item.arabicName?.trim() || undefined,
            quantity: reorderPurchaseQuantity(item),
            unitPrice: toFiniteNumber(item.lastPurchasePrice),
            discount: 0,
            tax: 0,
          }))
        : [emptyOrderLine()]
    );
    const params = new URLSearchParams(searchParams.toString());
    params.delete('from');
    const qs = params.toString();
    router.replace(qs ? `${ownPathname}?${qs}` : ownPathname, { scroll: false });
  }, [fromOrderLimit, ownPathname, reorderItemsResponse, router, searchParams, selectedOrderId]);

  // Purchase order mutation
  const stayOnOrder = (id: string) => {
    setSelectedOrderId(id);
    const params = new URLSearchParams(searchParams.toString());
    params.set('orderId', id);
    const qs = params.toString();
    router.replace(qs ? `${ownPathname}?${qs}` : ownPathname, { scroll: false });
    invalidateQuery(['purchase-order', id]);
  };

  const clearOrderForNext = () => {
    clearDraft();
    setSelectedOrderId(null);
    setOrderLines([emptyOrderLine()]);
    setLoadedSourceId('');
    setInternalNotes([]);
    resetExtras();
    setSourceBarKey((k) => k + 1);
    reset(emptyPurchaseOrderHeader(new Date().toISOString().split('T')[0]));
    const params = new URLSearchParams(searchParams.toString());
    params.delete('orderId');
    const qs = params.toString();
    router.replace(qs ? `${ownPathname}?${qs}` : ownPathname, { scroll: false });
  };

  const printPurchaseOrder = () => {
    void printOperationalDocument({
      title: 'أمر الشراء',
      documentNo: watch('orderNumber') || 'جديد',
      documentDate: watch('date'),
      lines: orderLines
        .filter((line) => line.itemId && Number(line.quantity) > 0)
        .map((line) => ({
          description: line.itemLabel || line.itemId,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          taxPercent: line.tax,
          total: orderLineNet(line),
        })),
    });
  };

  const purchaseOrderMutation = useApiMutation<
    { id?: string; orderNumber?: string; serial?: string; serialNumber?: string },
    Record<string, unknown>
  >('/inventory/purchase-orders', 'POST', {
    showSuccessToast: false,
    onSuccess: (res) => {
      invalidateStockViews(invalidateQuery);
      clearDraft();
      const id = res.data?.id;
      const number = res.data?.orderNumber || res.data?.serialNumber || res.data?.serial;
      const shouldPost = postAfterSaveRef.current;
      postAfterSaveRef.current = false;
      const finish = (posted: boolean) => {
        maybeAutoPrintAfterSave(autoPrintOnSave, printPurchaseOrder);
        finishDocumentSave({
          label: 'أمر شراء',
          number,
          posted,
          savedId: id,
          onOpen: stayOnOrder,
          onSavedOpen: (saved) => invalidateQuery(['purchase-order', saved]),
          reset: clearOrderForNext,
        });
      };
      if (shouldPost && id) {
        void postStoreDocumentAfterSave({
          postPath: `/inventory/purchase-orders/${id}/post`,
          onPosted: () => {
            setValue('isPosted', true);
            invalidateQuery(['purchase-orders']);
            finish(true);
          },
          onPostFailed: (message) => {
            setError(message);
            stayOnOrder(id);
          },
        });
        return;
      }
      finish(false);
    },
    onError: (error: ApiError) => {
      postAfterSaveRef.current = false;
      setError(error.message || 'حدث خطأ أثناء الحفظ');
    },
  });

  const purchaseOrderUpdateMutation = useApiMutation<unknown, Record<string, unknown>>(
    selectedOrderId ? `/inventory/purchase-orders/${selectedOrderId}` : '/inventory/purchase-orders',
    'PUT',
    {
      showSuccessToast: false,
      onSuccess: () => {
        invalidateStockViews(invalidateQuery);
        clearDraft();
        const id = selectedOrderId;
        const number = watch('orderNumber');
        const shouldPost = postAfterSaveRef.current;
        postAfterSaveRef.current = false;
        const finish = (posted: boolean) => {
          maybeAutoPrintAfterSave(autoPrintOnSave, printPurchaseOrder);
          finishDocumentSave({
            label: 'أمر شراء',
            number,
            posted,
            savedId: id,
            onOpen: stayOnOrder,
            onSavedOpen: (saved) => invalidateQuery(['purchase-order', saved]),
            reset: clearOrderForNext,
          });
        };
        if (shouldPost && id) {
          void postStoreDocumentAfterSave({
            postPath: `/inventory/purchase-orders/${id}/post`,
            onPosted: () => {
              setValue('isPosted', true);
              invalidateQuery(['purchase-orders']);
              finish(true);
            },
            onPostFailed: (message) => {
              setError(message);
              if (id) invalidateQuery(['purchase-order', id]);
            },
          });
          return;
        }
        finish(false);
      },
      onError: (error: ApiError) => {
        postAfterSaveRef.current = false;
        setError(error.message || 'حدث خطأ أثناء الحفظ');
      },
    }
  );

  const [postFlowPending, setPostFlowPending] = useState(false);

  const loading =
    purchaseOrderMutation.isPending ||
    purchaseOrderUpdateMutation.isPending ||
    postFlowPending;

  useEffect(() => {
    reset((prev) => ({ ...prev, date: prev.date || todayStr }));
  }, [todayStr, reset]);

  useEffect(() => {
    if (currencies.length > 0 && !getValues('currencyId')) {
      const defaultCurrency = currencies.find((c) => c.code === 'EGP') || currencies[0];
      setValue('currencyId', defaultCurrency.id);
    }
  }, [currencies, getValues, setValue]);

  const inputCls = compactControlClass;
  const advancedFilledCount = [watch('hijriDate'), watch('costCenterId')].filter(Boolean).length;

  const handleNew = () => {
    setError('');
    setSuccess('');
    clearOrderForNext();
  };

  const handleSourceHydrate = (payload: SourceHydratePayload) => {
    const header = stockHeaderFieldsFromSource(payload, getValues('description'));
    if (header.supplierId) setValue('supplierId', header.supplierId);
    if (header.warehouseId) setValue('warehouseId', header.warehouseId);
    if (header.description) setValue('description', header.description);
    setLoadedSourceId(payload.sourceId);
    setOrderLines(
      payload.lines.length
        ? payload.lines.map((line) => ({
            itemId: line.itemId,
            quantity: line.quantity || 1,
            unitPrice: line.unitPrice || 0,
            discount: line.discount || 0,
            tax: line.taxRate || 0,
          }))
        : [emptyOrderLine()]
    );
    loadAdjustments(payload.adjustments);
    toast.success(`تم تحميل الأمر من ${payload.sourceNumber}`);
  };

  const submitOrderSave = (header: InventoryPurchaseOrderHeaderFormInput) => {
    setError('');
    setSuccess('');
    const parsed = inventoryPurchaseOrderFormSchema.safeParse({
      ...header,
      costCenterId: header.costCenterId?.trim() || undefined,
      currencyId: header.currencyId?.trim() || undefined,
      lines: orderLines.filter((line) => line.itemId && Number(line.quantity) > 0),
    });
    if (!parsed.success) {
      postAfterSaveRef.current = false;
      setError(parsed.error.issues[0]?.message ?? 'خطأ في البيانات');
      return;
    }
    const extrasError = validateInvoiceExtrasForSave(invoiceExtras);
    if (extrasError) {
      postAfterSaveRef.current = false;
      setError(extrasError);
      setExtrasOpen(true);
      return;
    }
    const d = parsed.data;
    if (!selectedOrderId && !serialAutomatic && !String(d.orderNumber ?? '').trim()) {
      postAfterSaveRef.current = false;
      setError('أدخل رقم أمر الشراء — الترقيم يدوي في إعدادات المستند');
      return;
    }
    (selectedOrderId ? purchaseOrderUpdateMutation : purchaseOrderMutation).mutate({
      orderNumber: serialAutomatic && !selectedOrderId ? undefined : d.orderNumber,
      description: d.description,
      date: d.date?.length === 10 ? `${d.date}T00:00:00.000Z` : d.date || new Date().toISOString(),
      hijriDate: d.hijriDate,
      supplierId: d.supplierId,
      warehouseId: d.warehouseId,
      costCenterId: d.costCenterId?.trim() || null,
      currencyId: d.currencyId?.trim() || null,
      isPosted: d.isPosted,
      isApproved: d.isApproved,
      adjustments: getExtrasPayload(),
      lines: d.lines.map((line) => ({
        itemId: line.itemId,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        discountPercentage: line.discount || 0,
        taxPercentage: line.tax || 0,
      })),
      internalNotes,
    });
  };

  const requestPostAfterSave = () => {
    if (isPosted) return;
    postAfterSaveRef.current = autoPostOnSave;
    void handleSubmit(submitOrderSave, onFieldErrors(setError))();
  };

  const requestExplicitPostAfterSave = () => {
    if (isPosted) return;
    postAfterSaveRef.current = true;
    void handleSubmit(submitOrderSave, onFieldErrors(setError))();
  };

  const orderCancelled = Boolean(
    (selectedOrderResponse?.data as { isCancelled?: boolean } | undefined)?.isCancelled
  );

  const refreshOrder = () => {
    invalidateQuery(['purchase-orders']);
    invalidateQuery(['purchase-orders-browse']);
    if (selectedOrderId) invalidateQuery(['purchase-order', selectedOrderId]);
  };

  const handleCancelOrder = async () => {
    if (!selectedOrderId) return;
    try {
      await apiClient.post(`/inventory/purchase-orders/${selectedOrderId}/cancel`, {});
      setSuccess('تم إلغاء أمر الشراء');
      refreshOrder();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'تعذر إلغاء أمر الشراء');
    }
  };

  const handleRestoreOrder = async () => {
    if (!selectedOrderId) return;
    try {
      await restoreCancelledDocument({
        restorePath: `/inventory/purchase-orders/${selectedOrderId}/restore`,
        postPath: `/inventory/purchase-orders/${selectedOrderId}/post`,
        kind: 'named',
        autoPostOnSave,
      });
      setSuccess(
        autoPostOnSave ? 'تمت الاستعادة والترحيل' : 'تمت الاستعادة — المستند غير مرحّل'
      );
      refreshOrder();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'تعذر الاستعادة');
    }
  };

  const postExistingOrder = () => {
    if (!selectedOrderId) {
      requestExplicitPostAfterSave();
      return;
    }
    setPostFlowPending(true);
    void apiClient
      .post(`/inventory/purchase-orders/${selectedOrderId}/post`)
      .then(() => {
        setValue('isPosted', true);
        setSuccess('تم ترحيل أمر الشراء');
        invalidateQuery(['purchase-orders']);
        invalidateQuery(['purchase-order', selectedOrderId]);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'تعذر الترحيل');
      })
      .finally(() => setPostFlowPending(false));
  };

  const linkedPurchaseInvoiceId =
    (selectedOrderResponse?.data as { invoiceId?: string | null } | undefined)?.invoiceId ?? null;

  const openPurchaseInvoiceFromOrder = async () => {
    if (!selectedOrderId) {
      setError('احفظ أمر الشراء أولاً ثم أنشئ فاتورة المشتريات');
      return;
    }
    if (linkedPurchaseInvoiceId) {
      router.push(buildPurchaseInvoiceHref(linkedPurchaseInvoiceId));
      return;
    }
    try {
      const res = await convertMutation.mutateAsync({
        type: 'PURCHASE_ORDER_TO_PURCHASE_INVOICE',
        sourceId: selectedOrderId,
      });
      const targetId = res.data?.target?.id;
      if (!targetId) {
        setError('تعذر إنشاء فاتورة المشتريات');
        return;
      }
      router.push(buildPurchaseInvoiceHref(targetId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر إنشاء فاتورة المشتريات');
    }
  };

  return (
    <ErpDocumentLayout>
      {error && <ErrorToast message={error} onClose={() => setError('')} />}
      {success && <SuccessToast message={success} onClose={() => setSuccess('')} />}

      <PageDraftRestoreGate<PurchaseOrderDraft>
        restoreOffer={restoreOffer}
        hide={Boolean(selectedOrderId)}
        message="يوجد مسودة أمر شراء غير محفوظة."
        acceptRestore={acceptRestore}
        dismissRestore={dismissRestore}
        onRestored={(payload) => {
          applyPurchaseOrderDraft(payload);
          setSuccess('تم استعادة مسودة أمر الشراء');
        }}
      />

      <ErpDocumentPageHeader
        compact
        breadcrumbs={[
          { href: '/inventory', label: 'المخزون' },
          { label: 'العمليات' },
          { label: 'أمر الشراء' },
        ]}
        title="أمر الشراء"
        docNumber={watch('orderNumber') || ''}
        lifecycle={{
          documentId: selectedOrderId,
          isPosted,
          isCancelled: Boolean(
            (selectedOrderResponse?.data as { isCancelled?: boolean } | undefined)?.isCancelled
          ),
        }}
        saveLabel={orderSaveLabel}
        onSaveDraft={requestPostAfterSave}
        savePending={loading}
        canSave={!isPosted && !loading}
        canPost={Boolean(selectedOrderId) && !isPosted && !loading}
        onPost={() => postExistingOrder()}
        postPending={loading}
        hideStandalonePost
        onBrowseList={() => setShowList(true)}
        browseListLabel="السابق"
        currentId={selectedOrderId}
        favoriteHref="/inventory/operations/purchase-order"
        standardActions={{
          hasDocument: Boolean(selectedOrderId),
          isPosted: Boolean(isPosted),
          isCancelled: orderCancelled,
          onVoid: () => void handleCancelOrder(),
          onRestore: () => void handleRestoreOrder(),
          onEdit: () => {
            if (isPosted) setError('يجب فك الترحيل أولاً للتعديل');
          },
          postPending: postFlowPending,
          unpostPending: postFlowPending,
          onPost: () => postExistingOrder(),
          onUnpost: () => {
            if (!selectedOrderId) {
              setError('احفظ أمر الشراء أولاً');
              return;
            }
            setPostFlowPending(true);
            void apiClient
              .post(`/inventory/purchase-orders/${selectedOrderId}/unpost`)
              .then(() => {
                setValue('isPosted', false);
                setSuccess('تم فك ترحيل أمر الشراء');
                invalidateQuery(['purchase-orders']);
                invalidateQuery(['purchase-order', selectedOrderId]);
              })
              .catch((err: unknown) => {
                setError(err instanceof Error ? err.message : 'تعذر فك الترحيل');
              })
              .finally(() => setPostFlowPending(false));
          },
          onNew: handleNew,
          newLabel: 'جديد',
          transactionSettingsDocumentType: 'PURCHASE_ORDER',
          onTransactionSettingsSaved: () => {
            invalidateAfterTransactionSettingsSave(invalidateQuery, 'PURCHASE_ORDER');
          },
          onPrint: printPurchaseOrder,
          printLabel: 'طباعة',
        }}
        extraActions={
          <DocumentFollowUpButton
            label="إنشاء فاتورة مشتريات"
            disabled={!selectedOrderId || orderCancelled}
            pending={convertMutation.isPending}
            onClick={() => void openPurchaseInvoiceFromOrder()}
          />
        }
      />

      <DocumentBrowseDrawer open={showList} onClose={() => setShowList(false)} title="أوامر الشراء السابقة">
        <GenericRecordsList
          apiPath="/inventory/purchase-orders"
          listKey="purchase-orders-browse"
          paging="skip"
          selectedId={selectedOrderId}
          columns={[
            {
              id: 'num',
              header: 'الرقم',
              getValue: (r) => String(r.orderNumber ?? r.id.slice(0, 8)),
            },
            {
              id: 'date',
              header: 'التاريخ',
              getValue: (r) => (r.date ? new Date(String(r.date)).toLocaleDateString('ar-EG') : '—'),
            },
            {
              id: 'party',
              header: 'المورد',
              getValue: (r) => {
                const s = r.supplier as { arabicName?: string } | undefined;
                return s?.arabicName || '—';
              },
            },
          ]}
          onSelect={(id) => {
            stayOnOrder(id);
            setShowList(false);
          }}
        />
      </DocumentBrowseDrawer>

      <FormSectionCard
        title="بيانات أمر الشراء"
        subtitle="المورد والتاريخ والعملة والمخزن"
        sourceActions={
          <DocumentSourceLoadBar
            key={sourceBarKey}
            hasExistingLines={orderLines.some((l) => Boolean(l.itemId))}
            disabled={Boolean(isPosted)}
            currentAffectsStock={false}
            onHydrate={handleSourceHydrate}
          />
        }
        headerActions={
          <InternalNotesScratchpad
            notes={internalNotes}
            onChange={setInternalNotes}
            disabled={Boolean(isPosted)}
            className="inline-flex"
          />
        }
      >
        <CompactFormField
          label="رقم أمر الشراء"
          placeholder={serialAutomatic ? 'يُولَّد تلقائياً' : 'أدخل الرقم يدوياً'}
          readOnly={serialAutomatic || Boolean(isPosted)}
          {...register('orderNumber')}
        />
        <CompactFormField
          label="التاريخ"
          type="date"
          error={errors.date?.message}
          {...register('date')}
        />
        <CompactFormField label="الشرح" placeholder="ادخل الشرح" {...register('description')} />
        <CompactFormField label="المورد" error={errors.supplierId?.message}>
          <Controller
            name="supplierId"
            control={control}
            render={({ field }) => (
              <SupplierSelect
                value={field.value || ''}
                onChange={field.onChange}
                className={`${inputCls} ${errors.supplierId ? 'border-red-400' : ''}`}
                emptyLabel="اختر المورد"
                includeAllAccounts={shouldShowAllAccountsInPartyField(purchaseOrderTxSettings)}
              />
            )}
          />
        </CompactFormField>
        <CompactFormField label="المخزن" error={errors.warehouseId?.message}>
          <Controller
            name="warehouseId"
            control={control}
            render={({ field }) => (
              <WarehouseSelect
                value={field.value || ''}
                onChange={field.onChange}
                className={`${inputCls} ${errors.warehouseId ? 'border-red-400' : ''}`}
                emptyLabel="اختر المخزن"
              />
            )}
          />
        </CompactFormField>
        <CompactFormField label="العملة">
          <select className={inputCls} {...register('currencyId')} disabled={currenciesLoading}>
            <option value="">اختر العملة</option>
            {currencies.map((currency) => (
              <option key={currency.id} value={currency.id}>
                {currency.arabicName} ({currency.code})
              </option>
            ))}
          </select>
        </CompactFormField>
      </FormSectionCard>

      <AdvancedFieldsSection title="الحقول والإعدادات المتقدمة" badgeCount={advancedFilledCount}>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          <CompactFormField label="مركز التكلفة">
            <Controller
              name="costCenterId"
              control={control}
              render={({ field }) => (
                <CostCenterSelect
                  value={field.value || ''}
                  onChange={field.onChange}
                  className={inputCls}
                  emptyLabel="اختر مركز التكلفة"
                />
              )}
            />
          </CompactFormField>
        </div>
      </AdvancedFieldsSection>

      <fieldset disabled={lockLoadedSource} className="m-0 min-w-0 border-0 p-0">
      <FormSectionCard title="أصناف أمر الشراء" subtitle="الصنف والكمية والسعر" bodyClassName="grid-cols-1 sm:grid-cols-1 lg:grid-cols-1">
        <div className="mb-2 flex justify-end">
          <button
            type="button"
            className="rounded-lg bg-[#0E78AA] px-3 py-1.5 text-sm font-bold text-white"
            onClick={() => setOrderLines((prev) => [...prev, emptyOrderLine()])}
            disabled={Boolean(isPosted)}
          >
            إضافة صنف
          </button>
        </div>
        <div className={`${denseTableWrapClass} [&_input]:h-8 [&_select]:h-8`}>
          <table className={denseTableClass}>
            <thead className={denseTheadClass}>
              <tr>
                <th className={denseThClass}>م</th>
                <th className={denseThClass}>الصنف</th>
                <th className={denseThClass}>المتاح</th>
                <th className={denseThClass}>الكمية</th>
                <th className={denseThClass}>السعر</th>
                <th className={denseThClass}>خصم %</th>
                <th className={denseThClass}>ضريبة %</th>
                <th className={denseThClass}>الإجمالي</th>
                <th className={denseThClass}>حذف</th>
              </tr>
            </thead>
            <tbody>
              {orderLines.map((line, i) => {
                const patch = (partial: Partial<PurchaseOrderLine>) =>
                  setOrderLines((prev) => prev.map((row, idx) => (idx === i ? { ...row, ...partial } : row)));
                const locked = Boolean(isPosted);
                return (
                  <tr key={`${line.itemId}-${i}`} className={i % 2 === 0 ? 'bg-[#F6FBFD]' : 'bg-white'}>
                    <td className="h-9 px-2 py-1 text-sm">{i + 1}</td>
                    <td className="h-9 min-w-[180px] px-2 py-1 text-sm">
                      <ItemSelect
                        value={line.itemId}
                        fallbackLabel={line.itemLabel}
                        disabled={locked}
                        onChange={(itemId) => patch({ itemId })}
                      />
                    </td>
                    <td className="h-9 px-2 py-1 text-center text-sm">
                      <InvoiceLineStockBalanceCell itemId={line.itemId} warehouseId={warehouseId} />
                    </td>
                    <td className="h-9 px-2 py-1 text-sm">
                      <input type="number" min={0} step="any" className="w-20" disabled={locked} value={line.quantity} onChange={(e) => patch({ quantity: Number(e.target.value) || 0 })} />
                    </td>
                    <td className="h-9 px-2 py-1 text-sm">
                      <input type="number" min={0} step="any" className="w-24" disabled={locked} value={line.unitPrice} onChange={(e) => patch({ unitPrice: Number(e.target.value) || 0 })} />
                    </td>
                    <td className="h-9 px-2 py-1 text-sm">
                      <input type="number" min={0} max={100} step="any" className="w-16" disabled={locked} value={line.discount ?? 0} onChange={(e) => patch({ discount: Number(e.target.value) || 0 })} />
                    </td>
                    <td className="h-9 px-2 py-1 text-sm">
                      <input type="number" min={0} step="any" className="w-16" disabled={locked} value={line.tax ?? 0} onChange={(e) => patch({ tax: Number(e.target.value) || 0 })} />
                    </td>
                    <td className="h-9 px-2 py-1 text-sm font-mono">{orderLineNet(line).toLocaleString('en-US', { maximumFractionDigits: 4 })}</td>
                    <td className="h-9 px-2 py-1 text-sm">
                      <button
                        type="button"
                        className="text-red-600 disabled:opacity-40"
                        disabled={locked}
                        onClick={() =>
                          setOrderLines((prev) => {
                            const next = prev.filter((_, idx) => idx !== i);
                            return next.length > 0 ? next : [emptyOrderLine()];
                          })
                        }
                      >
                        حذف
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </FormSectionCard>
      </fieldset>

      <InvoiceExtrasPanel
        open={extrasOpen}
        onToggle={() => setExtrasOpen((v) => !v)}
        rows={invoiceExtras}
        onChange={setInvoiceExtras}
        currencies={currencies}
        defaultCurrency={currencies.find((c) => c.id === watch('currencyId'))?.code ?? 'EGP'}
        defaultExchangeRate={1}
        defaultCostCenterId={watch('costCenterId') || ''}
        disabled={Boolean(isPosted)}
        count={getExtrasPayload().length}
        headerDescription={watch('description')}
      />

      <PurchaseInvoiceBottomSplit
        totalsOnly
        summary={financialSummary}
        applyTax
        currencyCode={currencies.find((c) => c.id === watch('currencyId'))?.code ?? 'EGP'}
        lines={orderLines.map((line) => ({
          itemId: line.itemId,
          itemName: line.itemLabel,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          discount: line.discount,
          taxRate: line.tax,
        }))}
        savedLines={(selectedOrderResponse?.data?.lines ?? []).map((line) => ({
          itemId: line.itemId,
          itemName: line.item?.arabicName,
          quantity: Number(line.quantity ?? 0),
          unitPrice: Number(line.unitPrice ?? 0),
          discount: Number(line.discountPercentage ?? 0),
          taxRate: Number(line.taxPercentage ?? 0),
        }))}
        warehouseId={warehouseId}
        selectedInvoiceId={selectedOrderId}
        isPosted={Boolean(isPosted)}
        stockSign={1}
        settlementDirection="PAYMENT"
        journalEmptyTitle="القيد يظهر بعد تحويل أمر الشراء إلى فاتورة مشتريات وترحيلها."
      />

    </ErpDocumentLayout>
  );
}
