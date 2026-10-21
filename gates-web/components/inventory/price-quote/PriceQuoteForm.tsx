'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDraftAutosave } from '@/lib/hooks/useDraftAutosave';
import { PageDraftRestoreGate } from '@/components/erp/PageDraftRestoreGate';
import { useRouter } from 'next/navigation';
import { useOwnTabSearchParams } from '@/lib/navigation/tab-route-lock';
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
import { finishDocumentSave } from '@/lib/documents/finish-save';
import { invalidateStockViews } from '@/lib/invoices/invalidate-stock-views';
import { toHijriDate } from '@/lib/hijri-date';
import type { ApiError } from '@/lib/api/types';
import { CommercialLinesTable } from '@/components/inventory/commercial/CommercialLinesTable';
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
import { toast } from '@/lib/feedback/toast';
import { apiClient } from '@/lib/api/client';
import { postStoreDocumentAfterSave } from '@/lib/inventory/post-store-document-after-save';
import { STORE_SAVE_AND_POST_LABEL } from '@/lib/inventory/store-document-save-post';
import { maybeAutoPrintAfterSave } from '@/lib/printer/print-prefs';
import { invalidateAfterTransactionSettingsSave } from '@/lib/inventory/transaction-settings-invalidate';
import {
  useApplyDefaultWarehouseFromTransactionSettings,
  useTransactionDocumentSettings,
} from '@/lib/transaction-settings/use-transaction-document-settings';
import { shouldShowAllAccountsInPartyField } from '@/lib/transaction-settings/types';
import { useItemsQuery } from '@/lib/hooks/useMasterDataQueries';
import { findBelowCostLine, SELL_BELOW_COST_MESSAGE } from '@/lib/accounting-settings/guardrail-hints';
import { resolveDocumentLifecycleStatus, savedDocumentRowStatus } from '@/lib/documents/document-status-labels';
import { confirmAction } from '@/lib/feedback/confirm';
import { InternalNotesScratchpad } from '@/components/documents/InternalNotesScratchpad';
import type { InternalNoteEntry } from '@/lib/invoices/payment-split.types';
import { InvoiceExtrasPanel } from '@/components/inventory/invoices/InvoiceExtrasPanel';
import { useInvoiceExtras } from '@/lib/invoices/use-invoice-extras';
import {
  sumPartyInvoiceExtras,
  validateInvoiceExtrasForSave,
  type InvoiceAdjustmentApiRow,
} from '@/lib/invoices/invoice-adjustments';
import {
  computeInvoiceFinancialSummary,
  computeInvoiceGrossDiscount,
} from '@/lib/invoices/computeInvoiceFinancialSummary';
import { SalesInvoiceBottomSplit } from '@/components/inventory/sales-invoice/SalesInvoiceBottomSplit';
import { DocumentFollowUpButton } from '@/components/documents/DocumentFollowUpButton';
import { buildSalesInvoiceHref } from '@/lib/documents/document-follow-up';

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
  isCancelled?: boolean;
  isApproved?: boolean;
  isConverted?: boolean;
  invoiceId?: string | null;
  internalNotes?: InternalNoteEntry[] | null;
  adjustments?: InvoiceAdjustmentApiRow[] | null;
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

export function PriceQuoteForm() {
  const router = useRouter();
  const searchParams = useOwnTabSearchParams();
  const quoteIdFromUrl = searchParams.get('quoteId') || searchParams.get('id');
  const invalidateQuery = useInvalidateQuery();
  const convertMutation = useDocumentConvertMutation();
  const [selectedId, setSelectedId] = useState<string | null>(() => quoteIdFromUrl?.trim() || null);
  const postAfterSaveRef = useRef(false);
  const {
    settings: quoteTxSettings,
    autoPostOnSave,
    autoPrintOnSave,
    saveLabel: legacySaveLabel,
    serialAutomatic,
    defaultWarehouseId: txDefaultWarehouseId,
  } = useTransactionDocumentSettings('PRICE_QUOTE');
  const quoteSaveLabel = autoPostOnSave ? STORE_SAVE_AND_POST_LABEL : legacySaveLabel;
  const { data: itemsRes } = useItemsQuery();
  const catalogItems = itemsRes?.data ?? [];
  const enforceBelowCost = quoteTxSettings?.preventSellingBelowCost !== false;

  const [browseOpen, setBrowseOpen] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [lifecyclePending, setLifecyclePending] = useState(false);
  const [postFlowPending, setPostFlowPending] = useState(false);

  const [quoteNumber, setQuoteNumber] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(todayIso());
  const [validUntil, setValidUntil] = useState(plusDays(30));
  const [customerId, setCustomerId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  useApplyDefaultWarehouseFromTransactionSettings({
    selectedId,
    warehouseId,
    defaultWarehouseId: txDefaultWarehouseId,
    setWarehouseId,
  });
  const [costCenterId, setCostCenterId] = useState('');
  const [delegateId, setDelegateId] = useState('');
  const [currencyId, setCurrencyId] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('');
  const [deliveryPeriod, setDeliveryPeriod] = useState('');
  const [lines, setLines] = useState<CommercialDocumentLine[]>([emptyCommercialLine()]);
  const [sourceBarKey, setSourceBarKey] = useState(0);
  const [internalNotes, setInternalNotes] = useState<InternalNoteEntry[]>([]);
  const {
    invoiceExtras,
    setInvoiceExtras,
    extrasOpen,
    setExtrasOpen,
    loadAdjustments,
    resetExtras,
    getExtrasPayload,
  } = useInvoiceExtras();

  const priceQuoteDraft = useMemo(
    () => ({
      quoteNumber,
      description,
      date,
      validUntil,
      customerId,
      warehouseId,
      costCenterId,
      delegateId,
      currencyId,
      paymentTerms,
      deliveryPeriod,
      lines,
      internalNotes,
      invoiceExtras,
    }),
    [
      costCenterId,
      currencyId,
      customerId,
      date,
      delegateId,
      deliveryPeriod,
      description,
      internalNotes,
      invoiceExtras,
      lines,
      paymentTerms,
      quoteNumber,
      validUntil,
      warehouseId,
    ]
  );
  const applyPriceQuoteDraft = useCallback((payload: typeof priceQuoteDraft) => {
    setQuoteNumber(payload.quoteNumber);
    setDescription(payload.description);
    setDate(payload.date);
    setValidUntil(payload.validUntil);
    setCustomerId(payload.customerId);
    setWarehouseId(payload.warehouseId);
    setCostCenterId(payload.costCenterId);
    setDelegateId(payload.delegateId);
    setCurrencyId(payload.currencyId);
    setPaymentTerms(payload.paymentTerms);
    setDeliveryPeriod(payload.deliveryPeriod);
    setLines(payload.lines?.length ? payload.lines : [emptyCommercialLine()]);
    setInternalNotes(Array.isArray(payload.internalNotes) ? payload.internalNotes : []);
    setInvoiceExtras(Array.isArray(payload.invoiceExtras) ? payload.invoiceExtras : []);
    setExtrasOpen(false);
  }, [setExtrasOpen, setInvoiceExtras]);
  const skipServerHydrateRef = useRef(false);
  const {
    restoreOffer,
    acceptRestore,
    dismissRestore,
    clearDraft,
  } = useDraftAutosave({
    documentType: 'price-quote',
    value: priceQuoteDraft,
    mode: selectedId ? 'edit' : 'new',
    documentId: selectedId,
    enabled: true,
    applyRestore: (payload) => {
      skipServerHydrateRef.current = true;
      applyPriceQuoteDraft(payload);
    },
    isEmpty: (draft) =>
      !draft.customerId?.trim() &&
      !draft.description?.trim() &&
      !(draft.lines ?? []).some((line) => isEnteredCommercialLine(line)) &&
      !(draft.invoiceExtras ?? []).some(
        (row) => Boolean(row.accountId?.trim()) || Number(row.additionValue) > 0 || Number(row.discountValue) > 0
      ),
    restoreMessage: 'تم استعادة مسودة عرض السعر',
  });

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

  const skipUrlHydrateRef = useRef(false);

  useEffect(() => {
    const id = quoteIdFromUrl?.trim();
    if (skipUrlHydrateRef.current) {
      if (!id) skipUrlHydrateRef.current = false;
      return;
    }
    if (id && id !== selectedId) setSelectedId(id);
  }, [quoteIdFromUrl, selectedId]);

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
    setQuoteNumber(loaded.quoteNumber || '');
    setDescription(loaded.description || '');
    setDate(loaded.date ? String(loaded.date).slice(0, 10) : todayIso());
    setValidUntil(loaded.validUntil ? String(loaded.validUntil).slice(0, 10) : plusDays(30));
    setCustomerId(loaded.customerId || '');
    setWarehouseId(loaded.warehouseId || '');
    setCostCenterId(loaded.costCenterId || '');
    setDelegateId(loaded.delegateId || '');
    setCurrencyId(loaded.currencyId || currencyId);
    setInternalNotes(Array.isArray(loaded.internalNotes) ? loaded.internalNotes : []);
    loadAdjustments(loaded.adjustments);
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
  }, [currencyId, loadAdjustments, loaded, selectedId]);

  const entered = useMemo(() => lines.filter(isEnteredCommercialLine), [lines]);
  const quoteSummaryLines = useMemo(
    () =>
      entered.map((line) => ({
        itemId: line.itemId,
        itemName: line.itemName,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        discount: line.discount,
        taxRate: line.taxRate,
      })),
    [entered]
  );
  const financialSummary = useMemo(() => {
    const { gross, commercialDiscount } = computeInvoiceGrossDiscount(quoteSummaryLines);
    const extrasNet = sumPartyInvoiceExtras(invoiceExtras, gross - commercialDiscount, 1);
    return computeInvoiceFinancialSummary(quoteSummaryLines, {
      applyTax: true,
      additionsAndDiscounts: extrasNet,
    });
  }, [invoiceExtras, quoteSummaryLines]);

  const isCancelled = Boolean(loaded?.isCancelled);
  const isPosted = Boolean(loaded?.isPosted);
  const converted = Boolean(loaded?.isConverted);
  const lifecycle = useMemo(
    () => ({
      documentId: selectedId,
      isPosted,
      isCancelled,
    }),
    [selectedId, isPosted, isCancelled]
  );
  const status = useMemo(() => {
    if (converted) return { tone: 'info' as const, label: 'محول لفاتورة' };
    if (validUntil && validUntil < todayIso() && !converted && selectedId && !isCancelled) {
      return { tone: 'danger' as const, label: 'منتهي الصلاحية' };
    }
    return resolveDocumentLifecycleStatus(lifecycle);
  }, [converted, validUntil, selectedId, isCancelled, lifecycle]);

  const saveMutation = useApiMutation<QuoteRecord, Record<string, unknown>>('/inventory/price-quotes', 'POST', {
    showSuccessToast: false,
    onSuccess: (res) => {
      invalidateStockViews(invalidateQuery);
      const id = res.data?.id;
      const shouldPost = postAfterSaveRef.current;
      postAfterSaveRef.current = false;
      const finish = (posted: boolean) => {
      maybeAutoPrintAfterSave(autoPrintOnSave, printQuote);
      finishDocumentSave({
        label: 'عرض سعر',
        number: res.data?.quoteNumber || quoteNumber,
        posted,
        savedId: id,
        clearDraft,
        onOpen: (saved) => {
          setSelectedId(saved);
          const params = new URLSearchParams(searchParams.toString());
          params.set('quoteId', saved);
          params.delete('id');
          const qs = params.toString();
          router.replace(qs ? `?${qs}` : window.location.pathname, { scroll: false });
        },
        reset: () => resetNew(),
      });
      };
      if (shouldPost && id) {
        void postStoreDocumentAfterSave({
          postPath: `/inventory/price-quotes/${id}/post`,
          onPosted: () => {
            invalidateQuery(['price-quote', id]);
            finish(true);
          },
          onPostFailed: (message) => {
            setError(message);
            if (id) setSelectedId(id);
          },
        });
        return;
      }
      finish(false);
    },
    onError: (err: ApiError) => {
      postAfterSaveRef.current = false;
      setError(err.message || 'تعذر حفظ عرض السعر');
    },
  });

  const updateMutation = useApiMutation<QuoteRecord, Record<string, unknown>>(
    selectedId ? `/inventory/price-quotes/${selectedId}` : '/inventory/price-quotes',
    'PUT',
    {
      showSuccessToast: false,
      onSuccess: () => {
        invalidateStockViews(invalidateQuery);
        const id = selectedId;
        const shouldPost = postAfterSaveRef.current;
        postAfterSaveRef.current = false;
        const finish = (posted: boolean) => {
        maybeAutoPrintAfterSave(autoPrintOnSave, printQuote);
        finishDocumentSave({
          label: 'عرض سعر',
          number: quoteNumber,
          posted,
          savedId: id,
          clearDraft,
          onOpen: (saved) => {
            setSelectedId(saved);
            const params = new URLSearchParams(searchParams.toString());
            params.set('quoteId', saved);
            params.delete('id');
            const qs = params.toString();
            router.replace(qs ? `?${qs}` : window.location.pathname, { scroll: false });
          },
          reset: () => resetNew(),
        });
        };
        if (shouldPost && id) {
          void postStoreDocumentAfterSave({
            postPath: `/inventory/price-quotes/${id}/post`,
            onPosted: () => {
              invalidateQuery(['price-quote', id]);
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
        setError(err.message || 'تعذر تحديث عرض السعر');
      },
    }
  );

  const postExistingQuote = () => {
    if (!selectedId) {
      requestExplicitPostAfterSave();
      return;
    }
    setPostFlowPending(true);
    void apiClient
      .post(`/inventory/price-quotes/${selectedId}/post`)
      .then(() => {
        setSuccess('تم ترحيل عرض السعر');
        invalidateQuery(['price-quote', selectedId]);
        invalidateStockViews(invalidateQuery);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'تعذر الترحيل');
      })
      .finally(() => setPostFlowPending(false));
  };

  const requestPostAfterSave = () => {
    if (loaded?.isPosted || converted) return;
    postAfterSaveRef.current = autoPostOnSave;
    handleSave();
  };

  const requestExplicitPostAfterSave = () => {
    if (loaded?.isPosted || converted) return;
    postAfterSaveRef.current = true;
    handleSave();
  };

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
    if (enforceBelowCost && findBelowCostLine(entered, catalogItems)) {
      setError(SELL_BELOW_COST_MESSAGE);
      return;
    }
    const missingUnit = entered.find((line) => !line.unitId);
    if (missingUnit) {
      setError('اختر الصنف من الدليل حتى تُحدد الوحدة تلقائياً');
      return;
    }
    if (!selectedId && !serialAutomatic && !quoteNumber.trim()) {
      setError('أدخل رقم عرض السعر — الترقيم يدوي في إعدادات المستند');
      return;
    }
    const extrasError = validateInvoiceExtrasForSave(invoiceExtras);
    if (extrasError) {
      setError(extrasError);
      setExtrasOpen(true);
      return;
    }
    const payload = {
      quoteNumber: serialAutomatic && !selectedId ? undefined : quoteNumber || undefined,
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
      internalNotes,
      adjustments: getExtrasPayload(),
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
    };
    if (selectedId) updateMutation.mutate(payload);
    else saveMutation.mutate(payload);
  };

  const printQuote = () => {
    void printOperationalDocument({
      title: 'عرض سعر',
      documentNo: quoteNumber || 'جديد',
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

  const openSalesInvoiceFromQuote = async () => {
    if (loaded?.invoiceId) {
      router.push(buildSalesInvoiceHref(loaded.invoiceId));
      return;
    }
    await handleConvert('invoice');
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
      if (!targetId) {
        setError('تعذر إنشاء فاتورة المبيعات');
        return;
      }
      router.push(buildSalesInvoiceHref(targetId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر التحويل');
    }
  };

  const resetNew = () => {
    skipUrlHydrateRef.current = true;
    setSelectedId(null);
    setQuoteNumber('');
    setDescription('');
    setDate(todayIso());
    setValidUntil(plusDays(30));
    setCustomerId('');
    setLines([emptyCommercialLine()]);
    setInternalNotes([]);
    resetExtras();
    setSourceBarKey((k) => k + 1);
    setError('');
    setSuccess('');
    const params = new URLSearchParams(searchParams.toString());
    params.delete('quoteId');
    params.delete('id');
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : window.location.pathname, { scroll: false });
    clearDraft();
  };


  const handleCancelQuote = async () => {
    if (!selectedId) return;
    if (isPosted) {
      setError('فك الترحيل أولاً من قائمة (...) ثم ألغِ العرض');
      return;
    }
    const ok = await confirmAction({ message: 'إلغاء عرض السعر؟ يظهر في السابق بحالة ملغي.', confirmLabel: 'إلغاء', tone: 'danger' });
    if (!ok) return;
    setLifecyclePending(true);
    try {
      await apiClient.post(`/inventory/price-quotes/${selectedId}/cancel`, {});
      invalidateQuery(['price-quote', selectedId]);
      invalidateQuery(['price-quotes-browse']);
      setSuccess('تم إلغاء عرض السعر');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر إلغاء العرض');
    } finally {
      setLifecyclePending(false);
    }
  };

  const handleRestoreQuote = async () => {
    if (!selectedId) return;
    setLifecyclePending(true);
    try {
      await apiClient.post(`/inventory/price-quotes/${selectedId}/restore`, {});
      invalidateQuery(['price-quote', selectedId]);
      invalidateQuery(['price-quotes-browse']);
      setSuccess('تم استعادة عرض السعر');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر استعادة العرض');
    } finally {
      setLifecyclePending(false);
    }
  };

  const handleSourceHydrate = (payload: SourceHydratePayload) => {
    const header = stockHeaderFieldsFromSource(payload, description);
    if (header.customerId) setCustomerId(header.customerId);
    if (header.warehouseId) setWarehouseId(header.warehouseId);
    if (header.description) setDescription(header.description);
    const mapped = mapSourcePayloadToCommercialLines(payload);
    setLines(mapped.length ? mapped : [emptyCommercialLine()]);
    loadAdjustments(payload.adjustments);
    toast.success(`تم تحميل العرض من ${payload.sourceNumber}`);
  };

  return (
    <ErpDocumentLayout>
      <PageDraftRestoreGate<typeof priceQuoteDraft>
        restoreOffer={restoreOffer}
        hide={Boolean(selectedId)}
        message="يوجد مسودة عرض سعر غير محفوظة."
        acceptRestore={acceptRestore}
        dismissRestore={dismissRestore}
        onRestored={(payload) => {
          applyPriceQuoteDraft(payload);
          setSuccess('تم استعادة مسودة عرض السعر');
        }}
      />
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
          onSaveDraft={requestPostAfterSave}
          saveLabel={quoteSaveLabel}
          savePending={saveMutation.isPending || updateMutation.isPending || lifecyclePending}
          canSave={!isPosted && !converted && !isCancelled}
          canPost={Boolean(selectedId) && !isPosted && !converted && !isCancelled}
          onPost={() => postExistingQuote()}
          hideStandalonePost
          lifecycle={lifecycle}
          onBrowseList={() => setBrowseOpen(true)}
          browseListLabel="السابق"
          currentId={selectedId}
          favoriteHref="/inventory/operations/price-quote"
          favoriteLabel="عرض سعر"
          standardActions={{
            hasDocument: Boolean(selectedId),
            isPosted,
            isCancelled,
            postPending: postFlowPending,
            unpostPending: postFlowPending,
            onPost: () => postExistingQuote(),
            onUnpost: () => {
              if (!selectedId) return;
              setPostFlowPending(true);
              void apiClient
                .post(`/inventory/price-quotes/${selectedId}/unpost`)
                .then(() => {
                  setSuccess('تم فك ترحيل عرض السعر');
                  invalidateQuery(['price-quote', selectedId]);
                })
                .catch((err: unknown) => {
                  setError(err instanceof Error ? err.message : 'تعذر فك الترحيل');
                })
                .finally(() => setPostFlowPending(false));
            },
            onEdit: () => {
              if (loaded?.isPosted) setError('يجب فك الترحيل أولاً للتعديل');
            },
            onNew: resetNew,
            newLabel: 'عرض جديد',
            transactionSettingsDocumentType: 'PRICE_QUOTE',
            onTransactionSettingsSaved: () => {
              invalidateAfterTransactionSettingsSave(invalidateQuery, 'PRICE_QUOTE');
            },
            onPrint: printQuote,
            onVoid: () => void handleCancelQuote(),
            voidPending: lifecyclePending,
            onRestore: () => void handleRestoreQuote(),
            restorePending: lifecyclePending,
            voidLabel: 'إلغاء العرض',
            restoreLabel: 'استعادة العرض',
          }}
          extraActions={
            <DocumentFollowUpButton
              label="إنشاء فاتورة مبيعات"
              disabled={!selectedId || Boolean(isCancelled)}
              pending={convertMutation.isPending}
              onClick={() => void openSalesInvoiceFromQuote()}
            />
          }
        />

        {error ? <ErrorToast message={error} onClose={() => setError('')} /> : null}
        {success ? <SuccessToast message={success} onClose={() => setSuccess('')} /> : null}

        <ErpFormHeaderCard
          extrasLabel="خيارات إضافية"
          headerActions={
            <InternalNotesScratchpad
              notes={internalNotes}
              onChange={setInternalNotes}
              disabled={Boolean(isPosted || converted || isCancelled)}
              className="inline-flex"
            />
          }
          sourceActions={
            <DocumentSourceLoadBar
              key={sourceBarKey}
              hasExistingLines={entered.length > 0}
              disabled={Boolean(loaded?.isConverted || loaded?.isPosted)}
              currentAffectsStock={false}
              onHydrate={handleSourceHydrate}
            />
          }
          row1={
            <>
              <div className="space-y-1">
                <label className={erpLabelClass}>رقم العرض</label>
                <input
                  className={erpInputClass}
                  value={quoteNumber}
                  onChange={(e) => setQuoteNumber(e.target.value)}
                  placeholder={serialAutomatic ? 'يُولَّد تلقائياً' : 'أدخل الرقم يدوياً'}
                  readOnly={serialAutomatic || Boolean(loaded?.isPosted)}
                />
              </div>
              <DatePickerWithHijri label="تاريخ عرض السعر" value={date} onChange={setDate} />
              <DatePickerWithHijri label="تاريخ انتهاء العرض" value={validUntil} onChange={setValidUntil} />
            </>
          }
          row2={
            <>
              <div className="space-y-1">
                <label className={erpLabelClass}>العميل</label>
                <CustomerSelect
                  value={customerId}
                  onChange={setCustomerId}
                  className={erpInputClass}
                  includeAllAccounts={shouldShowAllAccountsInPartyField(quoteTxSettings)}
                />
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
            <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
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
          <CommercialLinesTable
            lines={lines}
            onChange={setLines}
            headerDescription={description}
            warehouseId={warehouseId}
            enforceBelowCost={enforceBelowCost}
          />
        </div>

        <InvoiceExtrasPanel
          open={extrasOpen}
          onToggle={() => setExtrasOpen((v) => !v)}
          rows={invoiceExtras}
          onChange={setInvoiceExtras}
          currencies={currencies}
          defaultCurrency={currencies.find((c) => c.id === currencyId)?.code ?? 'EGP'}
          defaultExchangeRate={1}
          defaultCostCenterId={costCenterId || ''}
          disabled={Boolean(loaded?.isPosted || loaded?.isCancelled || converted)}
          count={getExtrasPayload().length}
          headerDescription={description}
        />

        <SalesInvoiceBottomSplit
          totalsOnly
          summary={financialSummary}
          applyTax
          showEta={false}
          currencyCode={currencies.find((c) => c.id === currencyId)?.code ?? 'EGP'}
          lines={quoteSummaryLines}
          savedLines={(loaded?.lines ?? []).map((line) => ({
            itemId: line.itemId,
            itemName: line.item?.arabicName,
            quantity: Number(line.quantity) || 0,
            unitPrice: Number(line.unitPrice) || 0,
            discount: Number(line.discountPercentage) || 0,
            taxRate: Number(line.taxPercentage) || 0,
          }))}
          warehouseId={warehouseId}
          selectedInvoiceId={selectedId}
          isPosted={isPosted}
          stockSign={-1}
          journalEmptyTitle="القيد يظهر بعد تحويل عرض السعر إلى فاتورة وترحيلها."
          termsAction={
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={converted || convertMutation.isPending}
                className="gap-1.5 border-primary/30 font-semibold text-primary hover:bg-primary/10"
                onClick={() => void handleConvert('invoice')}
              >
                <ArrowRightLeft className="h-3.5 w-3.5" />
                إنشاء فاتورة مبيعات
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
          }
        />

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
            resolveStatus={(r) => {
              if (r.isConverted) return { variant: 'info' as const, label: 'محول' };
              const st = savedDocumentRowStatus({
                isPosted: Boolean(r.isPosted),
                isCancelled: Boolean(r.isCancelled),
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
