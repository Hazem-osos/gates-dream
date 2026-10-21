'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useOwnTabPathname, useOwnTabSearchParams } from '@/lib/navigation/tab-route-lock';
import { SalesInvoicePageHeader } from '@/components/inventory/sales-invoice/SalesInvoicePageHeader';
import { destinationAppTabHref } from '@/lib/navigation/tab-memory';
import { InventoryInvoicesListSection } from '@/components/inventory/InventoryInvoicesListSection';
import { useApiQuery, useApiMutation, useInvalidateQuery } from '@/lib/hooks/useApi';
import { resolvePostedFlag } from '@/lib/documents/posting-trust';
import { apiClient } from '@/lib/api/client';
import type { ApiError } from '@/lib/api/types';
import {
  postInvoiceAfterSave,
  useRepostAfterUnpost,
} from '@/lib/accounting/ensure-posted-after-save';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';
import { mapSalesFormToM5CreateBody, mapSalesFormToM5UpdateBody } from '@/lib/invoices/mapFormToM5Invoice';
import { toastVersionConflict } from '@/lib/feedback/toast';
import { isOptimisticLockApiError } from '@/lib/concurrency/version-conflict';
import {
  computeInvoiceFinancialSummary,
  computeInvoiceGrossDiscount,
} from '@/lib/invoices/computeInvoiceFinancialSummary';
import { sumPartyInvoiceExtras, type InvoiceAdjustmentApiRow } from '@/lib/invoices/invoice-adjustments';
import { useInvoiceExtras } from '@/lib/invoices/use-invoice-extras';
import { InvoiceExtrasPanel } from '@/components/inventory/invoices/InvoiceExtrasPanel';
import { readInvoiceLineItemName } from '@/lib/invoices/stock-impact-line';
import { ErpDocumentLayout } from '@/components/erp/ErpDocumentLayout';
import { ERP_INVOICE_DOCUMENT_LAYOUT_CLASS } from '@/components/erp/erpUiTokens';
import { DocumentBrowseDrawer } from '@/components/erp/DocumentBrowseDrawer';
import { ReturnInvoiceFormHeader, type SourceInvoiceOption } from '@/components/inventory/returns/ReturnInvoiceFormHeader';
import type { ReturnLineForm } from '@/components/inventory/returns/ReturnInvoiceLinesGrid';
import { isTransactionSerialAutomatic } from '@/lib/transaction-settings/serial-mode';
import {
  shouldLockLoadedSource,
  shouldShowAllAccountsInPartyField,
  type TransactionSettings,
} from '@/lib/transaction-settings/types';
import { dispatchAutoPrintAfterSave } from '@/lib/printer/print-prefs';
import { invalidateAfterTransactionSettingsSave } from '@/lib/inventory/transaction-settings-invalidate';
import { PurchaseInvoiceBottomSplit } from '@/components/inventory/purchase-invoice/PurchaseInvoiceBottomSplit';
import dynamic from 'next/dynamic';
import { LineGridSkeleton } from '@/components/ui/DynamicChunkSkeleton';
import { confirmAction } from '@/lib/feedback/confirm';
import { retryIfNegativeStockConfirm } from '@/lib/invoices/purchase-unpost-negative-stock';
import { restoreCancelledDocument } from '@/lib/documents/restore-cancelled-document';
import { toast } from '@/lib/feedback/toast';
import { invoiceReturnBlockReason } from '@/lib/invoices/return-policy';
import { savedInvoiceHydrateKey } from '@/lib/invoices/invoice-form-hydrate';
import { invalidateInvoiceReturnCaches } from '@/lib/invoices/invalidate-after-return';
import { finishDocumentSave } from '@/lib/documents/finish-save';
import { invalidateStockViews } from '@/lib/invoices/invalidate-stock-views';
import {
  buildCashTenderSplits,
  isCashPaymentMethod,
  tenderPaidFromSplits,
  treasuryIdFromSplits,
} from '@/lib/invoices/cash-tender';
import { paymentMethodForCashPaid } from '@/components/invoices/InvoiceCashPaidControls';
import { sumPaymentSplits, type PaymentSplitLine } from '@/lib/invoices/payment-split.types';
import { MultiPaymentSplitterModal } from '@/components/invoices/MultiPaymentSplitterModal';
import { pickDefaultSafeId, useSafesQuery } from '@/lib/hooks/useMasterDataQueries';
import { postInvoiceSettlementSplits } from '@/lib/invoices/post-invoice-settlement-splits';
import {
  type InvoiceCashSettlement,
  type InvoiceChequesPayload,
  invoiceCashPaidDisplayAmount,
  invoiceRemainingForCollect,
  unwrapInvoiceCheques,
} from '@/lib/invoices/invoice-settlements';
import {
  invoiceNetBelowCollectionsMessage,
  invoiceNetCoversCollections,
} from '@/lib/invoices/invoice-collected-guard';
import { invoicePaymentButtonDisabled } from '@/lib/invoices/invoice-payment-controls';
import { useDraftAutosave } from '@/lib/hooks/useDraftAutosave';
import { PageDraftRestoreGate } from '@/components/erp/PageDraftRestoreGate';
import { DocumentSourceLoadBar } from '@/components/invoices/DocumentSourceLoadBar';
import type { SourceHydratePayload } from '@/lib/invoices/sourceDocument';
import { InternalNotesScratchpad } from '@/components/documents/InternalNotesScratchpad';
import type { InternalNoteEntry } from '@/lib/invoices/payment-split.types';

const ReturnInvoiceLinesGrid = dynamic(
  () =>
    import('@/components/inventory/returns/ReturnInvoiceLinesGrid').then((m) => ({
      default: m.ReturnInvoiceLinesGrid,
    })),
  { ssr: false, loading: () => <LineGridSkeleton label="جاري تحميل بنود مرتجع المبيعات…" /> }
);

interface Currency {
  id: string;
  code: string;
  arabicName: string;
}
interface Item {
  id: string;
  code?: string;
  serial?: string;
  arabicName?: string;
  units?: { unit?: { id: string } }[];
}

type SalesReturnDraft = {
  invoiceNumber: string;
  description: string;
  date: string;
  customerId: string;
  warehouseId: string;
  currencyId: string;
  sourceSaleInvoiceId: string;
  returnLines: ReturnLineForm[];
  restock: boolean;
  returnReason: string;
  settlementMethod: string;
  treasuryId: string;
  cashPaid?: number;
  internalNotes: InternalNoteEntry[];
};

function isSalesReturnDraftEmpty(draft: SalesReturnDraft) {
  const hasLine = (draft.returnLines ?? []).some((line) => Boolean(line.itemId?.trim()));
  return (
    !draft.customerId?.trim() &&
    !draft.description?.trim() &&
    !draft.sourceSaleInvoiceId?.trim() &&
    !draft.returnReason?.trim() &&
    !draft.invoiceNumber?.trim() &&
    !hasLine &&
    (draft.settlementMethod || 'credit') === 'credit' &&
    !draft.treasuryId?.trim()
  );
}

export default function SalesReturnsPage() {
  const router = useRouter();
  const ownPathname = useOwnTabPathname();
  const searchParams = useOwnTabSearchParams();
  const fromInvoiceParam = searchParams.get('fromInvoice');
  const invoiceIdParam = searchParams.get('invoiceId');
  const prefillApplied = useRef(false);
  const restoredSourceRef = useRef<string | null>(null);
  const returnableHydratedRef = useRef<string | null>(null);
  const lastHydrateKeyRef = useRef<string | null>(null);
  const [sourceBarKey, setSourceBarKey] = useState(0);

  const invalidateQuery = useInvalidateQuery();
  const [selectedReturnId, setSelectedReturnId] = useState<string | null>(
    () => invoiceIdParam?.trim() || null
  );
  const appliedInvoiceIdRef = useRef(invoiceIdParam?.trim() || '');
  const [isPosted, setIsPosted] = useState(false);
  const [restorePending, setRestorePending] = useState(false);
  const [cancelPending, setCancelPending] = useState(false);
  const [showList, setShowList] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [hijriDate] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [currencyId, setCurrencyId] = useState('');
  const [sourceSaleInvoiceId, setSourceSaleInvoiceId] = useState('');
  const [returnLines, setReturnLines] = useState<ReturnLineForm[]>([]);
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
  const [restock, setRestock] = useState(true);
  const [returnReason, setReturnReason] = useState('');
  const [settlementMethod, setSettlementMethod] = useState('credit');
  const [cashPaid, setCashPaid] = useState(0);
  const [returnSplits, setReturnSplits] = useState<PaymentSplitLine[]>([]);
  const [payOpen, setPayOpen] = useState(false);
  const [bottomTab, setBottomTab] = useState('gl');
  const [treasuryId, setTreasuryId] = useState('');
  const [internalNotes, setInternalNotes] = useState<InternalNoteEntry[]>([]);

  const { data: safesResponse } = useSafesQuery();
  const defaultSafeId = pickDefaultSafeId(safesResponse?.data);

  const { data: txSettingsRes } = useApiQuery<TransactionSettings>(
    ['transaction-settings', 'SALES_RETURN'],
    '/transaction-settings/SALES_RETURN'
  );
  const txSettings = txSettingsRes?.data;
  const { markUnpostedForEdit, consumeShouldRepost, resetKeepPosted } = useRepostAfterUnpost(
    txSettings?.autoPostOnSave
  );
  const allowStandalone = txSettings?.allowStandaloneReturns !== false;
  const enforceOriginalPrice = txSettings?.enforceOriginalPrice !== false;
  const lockLoadedSource = shouldLockLoadedSource(txSettings, sourceSaleInvoiceId);

  const { data: invoiceResponse } = useApiQuery<Record<string, unknown>>(
    ['invoice', selectedReturnId],
    `/invoices/${selectedReturnId}`,
    undefined,
    { enabled: !!selectedReturnId, staleTime: 0, refetchOnMount: 'always' }
  );
  const selectedInvoice = invoiceResponse?.data;

  const { data: settlementsResponse } = useApiQuery<InvoiceCashSettlement[]>(
    ['invoice-settlements', selectedReturnId],
    `/invoices/${selectedReturnId}/settlements`,
    undefined,
    { enabled: !!selectedReturnId }
  );
  const { data: settlementHistoryResponse } = useApiQuery<InvoiceCashSettlement[]>(
    ['invoice-settlements-history', selectedReturnId],
    `/invoices/${selectedReturnId}/settlements/history`,
    undefined,
    { enabled: !!selectedReturnId }
  );
  const { data: chequesResponse } = useApiQuery<InvoiceChequesPayload>(
    ['invoice-settlements-cheques', selectedReturnId],
    `/invoices/${selectedReturnId}/settlements/cheques`,
    undefined,
    { enabled: !!selectedReturnId }
  );
  const settlements = settlementsResponse?.data || [];
  const settlementHistory = settlementHistoryResponse?.data || [];
  const { cheques: settlementCheques } = unwrapInvoiceCheques(chequesResponse?.data);

  const refreshSettlementQueries = useCallback(
    (id: string) => {
      invalidateQuery(['invoice', id]);
      invalidateQuery(['invoice-settlements', id]);
      invalidateQuery(['invoice-settlements-history', id]);
      invalidateQuery(['invoice-settlements-cheques', id]);
    },
    [invalidateQuery]
  );

  const { data: itemsResponse } = useApiQuery<Item[]>(
    ['items'],
    '/inventory/items',
    { limit: 200, isActive: true }
  );
  const items = itemsResponse?.data || [];

  const { data: currenciesResponse } = useApiQuery<Currency[]>(
    ['currencies'],
    '/accounting/currencies',
    { limit: 100, isActive: true }
  );
  const currencies = useMemo(() => currenciesResponse?.data ?? [], [currenciesResponse?.data]);

  const { data: salesInvoicesResponse } = useApiQuery<SourceInvoiceOption[]>(
    ['invoices', 'sale-picklist'],
    '/invoices',
    { invoiceKind: 'SALE', isPosted: true, limit: 200 }
  );
  const salesInvoices = salesInvoicesResponse?.data || [];

  const { data: returnableRes, isError: returnableFailed, error: returnableError } = useApiQuery<{
    originalInvoiceId: string;
    originalInvoiceNumber: string | null;
    customerId: string | null;
    warehouseId: string | null;
    lines: Array<{
      originalInvoiceLineId: string;
      itemId: string;
      itemName: string;
      unitId: string;
      soldQty: number;
      returnedQty: number;
      returnableQty: number;
      unitPrice: number;
      taxPercent: number;
      discountPercent: number;
      warehouseId: string | null;
    }>;
  }>(
    ['invoice', 'returnable-lines', sourceSaleInvoiceId],
    `/invoices/${sourceSaleInvoiceId}/returnable-lines`,
    undefined,
    { enabled: Boolean(sourceSaleInvoiceId), staleTime: 0, refetchOnMount: 'always' }
  );

  const { data: sourceSaleResponse } = useApiQuery<Record<string, unknown>>(
    ['invoice', 'return-source', fromInvoiceParam],
    `/invoices/${fromInvoiceParam}`,
    undefined,
    { enabled: !!fromInvoiceParam && !prefillApplied.current }
  );

  useEffect(() => {
    setDate(new Date().toISOString().split('T')[0]);
  }, []);

  useEffect(() => {
    const id = invoiceIdParam?.trim() || '';
    if (id === appliedInvoiceIdRef.current) return;
    appliedInvoiceIdRef.current = id;
    setSelectedReturnId(id || null);
  }, [invoiceIdParam]);

  useEffect(() => {
    if (selectedReturnId || !txSettings?.defaultWarehouseId || warehouseId) return;
    setWarehouseId(txSettings.defaultWarehouseId);
  }, [selectedReturnId, txSettings?.defaultWarehouseId, warehouseId]);

  useEffect(() => {
    if (currencies.length > 0 && !currencyId) {
      setCurrencyId((currencies.find((c) => c.code === 'EGP') || currencies[0]).id);
    }
  }, [currencies, currencyId]);

  useEffect(() => {
    if (settlementMethod !== 'cash' || treasuryId || !defaultSafeId) return;
    setTreasuryId(defaultSafeId);
  }, [settlementMethod, treasuryId, defaultSafeId]);

  useEffect(() => {
    if (!selectedReturnId || !selectedInvoice) return;
    const hydrateKey = savedInvoiceHydrateKey(selectedInvoice);
    if (hydrateKey && lastHydrateKeyRef.current === hydrateKey) return;
    lastHydrateKeyRef.current = hydrateKey;
    setInvoiceNumber(String(selectedInvoice.invoiceNumber ?? ''));
    setDescription(String(selectedInvoice.description ?? ''));
    setDate(
      selectedInvoice.date
        ? new Date(String(selectedInvoice.date)).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0]
    );
    setCustomerId(String(selectedInvoice.customerId ?? ''));
    setWarehouseId(String(selectedInvoice.warehouseId ?? ''));
    setSourceSaleInvoiceId(String(selectedInvoice.originalInvoiceId ?? ''));
    setCurrencyId(String(selectedInvoice.currencyId ?? currencyId));
    setIsPosted(resolvePostedFlag(selectedInvoice));
    const loadedCash = isCashPaymentMethod(selectedInvoice.paymentMethod);
    setSettlementMethod(loadedCash ? 'cash' : 'credit');
    setCashPaid(
      loadedCash ? 0 : tenderPaidFromSplits(selectedInvoice.paymentSplits as PaymentSplitLine[] | undefined)
    );
    setTreasuryId(treasuryIdFromSplits(selectedInvoice.paymentSplits as PaymentSplitLine[] | undefined));
    const lines = (selectedInvoice.lines as Array<Record<string, unknown>> | undefined)?.map(
      (line) => ({
        itemId: String(line.itemId ?? ''),
        unitId: String(line.unitId ?? ''),
        quantity: Number(line.quantity) || 1,
        unitPrice: Number(line.price ?? line.unitPrice) || 0,
        discount: Number(line.discount ?? 0) || 0,
        taxRate: Number(line.taxPercent ?? line.tax ?? line.taxRate ?? 0) || 0,
        originalInvoiceLineId: line.originalInvoiceLineId
          ? String(line.originalInvoiceLineId)
          : undefined,
      })
    );
    setReturnLines(lines ?? []);
    const rawNotes = (selectedInvoice as { internalNotes?: InternalNoteEntry[] }).internalNotes;
    setInternalNotes(Array.isArray(rawNotes) ? rawNotes : []);
    loadAdjustments((selectedInvoice as { adjustments?: InvoiceAdjustmentApiRow[] }).adjustments);
  }, [selectedReturnId, selectedInvoice, loadAdjustments]);

  useEffect(() => {
    const inv = sourceSaleResponse?.data;
    if (!inv || !fromInvoiceParam || prefillApplied.current || selectedReturnId) return;
    const block = invoiceReturnBlockReason({
      allowReturn: Boolean(inv.allowReturn),
      returnDays: inv.returnDays != null ? Number(inv.returnDays) : undefined,
      date: inv.date as string | Date | undefined,
      invoiceNumber: inv.invoiceNumber ? String(inv.invoiceNumber) : undefined,
    });
    if (block) {
      prefillApplied.current = true;
      setError(block);
      return;
    }
    prefillApplied.current = true;
    setSelectedReturnId(null);
    setIsPosted(false);
    setSourceSaleInvoiceId(fromInvoiceParam);
    setCustomerId(String(inv.customerId ?? ''));
    setWarehouseId(String(inv.warehouseId ?? ''));
    setCurrencyId(String(inv.currencyId ?? currencyId));
    setInvoiceNumber('');
    setDate(new Date().toISOString().split('T')[0]);
    const refNo = String(inv.invoiceNumber ?? fromInvoiceParam);
    setDescription(`مرتجع عن فاتورة ${refNo}`);
    const lines = (inv.lines as Array<Record<string, unknown>> | undefined)?.map((line) => ({
      itemId: String(line.itemId ?? ''),
      unitId: String(line.unitId ?? ''),
      quantity: Number(line.quantity) || 1,
      unitPrice: Number(line.price ?? line.unitPrice) || 0,
      discount: Number(line.discount ?? 0) || 0,
      taxRate: Number(line.taxPercent ?? line.tax ?? line.taxRate ?? 0) || 0,
      // H10 fix: `line.id` here is the ORIGINAL sold line — carry it through so
      // the server can enforce that this return never exceeds what was sold.
      originalInvoiceLineId: line.id ? String(line.id) : undefined,
    }));
    setReturnLines(lines ?? []);
    setSuccess('تم تحميل بنود الفاتورة الأصلية — عدّل الكميات المراد إرجاعها');
  }, [sourceSaleResponse, fromInvoiceParam, selectedReturnId, currencyId]);

  useEffect(() => {
    const snap = returnableRes?.data;
    if (!snap || !sourceSaleInvoiceId || selectedReturnId) return;
    if (restoredSourceRef.current === sourceSaleInvoiceId) return;
    if (returnableHydratedRef.current === sourceSaleInvoiceId) return;
    returnableHydratedRef.current = sourceSaleInvoiceId;
    setCustomerId(snap.customerId || '');
    if (snap.warehouseId) setWarehouseId(snap.warehouseId);
    const refNo = snap.originalInvoiceNumber || sourceSaleInvoiceId;
    setDescription((prev) => prev || `مرتجع عن فاتورة ${refNo}`);
    setReturnLines(
      snap.lines
        .filter((line) => line.returnableQty > 0)
        .map((line) => ({
          itemId: line.itemId,
          unitId: line.unitId,
          quantity: line.returnableQty,
          unitPrice: line.unitPrice,
          discount: line.discountPercent,
          taxRate: line.taxPercent,
          originalInvoiceLineId: line.originalInvoiceLineId,
          soldQty: line.soldQty,
          returnableQty: line.returnableQty,
        }))
    );
  }, [returnableRes?.data, sourceSaleInvoiceId, selectedReturnId]);

  useEffect(() => {
    if (!returnableFailed || !sourceSaleInvoiceId || selectedReturnId) return;
    setError(returnableError?.message || 'هذه الفاتورة غير قابلة لعمل مردود');
    setReturnLines([]);
  }, [returnableFailed, returnableError, sourceSaleInvoiceId, selectedReturnId]);

  const replaceQuery = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams.toString());
      mutate(params);
      const qs = params.toString();
      router.replace(qs ? `${ownPathname}?${qs}` : ownPathname, { scroll: false });
    },
    [ownPathname, router, searchParams]
  );

  const stayOnReturn = (id: string) => {
    appliedInvoiceIdRef.current = id;
    setSelectedReturnId(id);
    replaceQuery((params) => {
      params.set('invoiceId', id);
      params.delete('fromInvoice');
    });
  };

  const draftSnapshot = useMemo(
    (): SalesReturnDraft => ({
      invoiceNumber,
      description,
      date,
      customerId,
      warehouseId,
      currencyId,
      sourceSaleInvoiceId,
      returnLines,
      restock,
      returnReason,
      settlementMethod,
      treasuryId,
      cashPaid,
      internalNotes,
    }),
    [
      invoiceNumber,
      description,
      date,
      customerId,
      warehouseId,
      currencyId,
      sourceSaleInvoiceId,
      returnLines,
      restock,
      returnReason,
      settlementMethod,
      treasuryId,
      cashPaid,
      internalNotes,
    ]
  );

  const applySalesReturnDraft = useCallback((payload: SalesReturnDraft) => {
    restoredSourceRef.current = payload.sourceSaleInvoiceId?.trim() || null;
    setInvoiceNumber(payload.invoiceNumber ?? '');
    setDescription(payload.description ?? '');
    setDate(payload.date || new Date().toISOString().split('T')[0]);
    setCustomerId(payload.customerId ?? '');
    setWarehouseId(payload.warehouseId ?? '');
    setCurrencyId(payload.currencyId ?? '');
    setSourceSaleInvoiceId(payload.sourceSaleInvoiceId ?? '');
    setReturnLines(Array.isArray(payload.returnLines) ? payload.returnLines : []);
    setRestock(payload.restock !== false);
    setReturnReason(payload.returnReason ?? '');
    setSettlementMethod(payload.settlementMethod === 'cash' ? 'cash' : 'credit');
    setCashPaid(Number(payload.cashPaid) || 0);
    setTreasuryId(payload.treasuryId ?? '');
    setInternalNotes(Array.isArray(payload.internalNotes) ? payload.internalNotes : []);
  }, []);

  const { restoreOffer, acceptRestore, dismissRestore, clearDraft } = useDraftAutosave({
    documentType: 'sales-return',
    mode: selectedReturnId ? 'edit' : 'new',
    documentId: selectedReturnId,
    value: draftSnapshot,
    enabled: !isPosted,
    isEmpty: isSalesReturnDraftEmpty,
    restoreMessage: 'يوجد مسودة مردود مبيعات غير محفوظة',
  });

  const resetForm = useCallback(() => {
    clearDraft();
    restoredSourceRef.current = null;
    returnableHydratedRef.current = null;
    lastHydrateKeyRef.current = null;
    resetKeepPosted();
    setSelectedReturnId(null);
    replaceQuery((params) => {
      params.delete('invoiceId');
      params.delete('fromInvoice');
    });
    setIsPosted(false);
    setInvoiceNumber('');
    setDescription('');
    setCustomerId('');
    setWarehouseId('');
    setSourceSaleInvoiceId('');
    setReturnLines([]);
    setSettlementMethod('credit');
    setCashPaid(0);
    setReturnSplits([]);
    setTreasuryId('');
    setInternalNotes([]);
    setDate(new Date().toISOString().split('T')[0]);
    setSourceBarKey((k) => k + 1);
    resetExtras();
  }, [clearDraft, replaceQuery, resetExtras, resetKeepPosted]);

  const handleReturnSourceHydrate = useCallback(
    (payload: SourceHydratePayload) => {
      if (selectedReturnId || isPosted) return;
      restoredSourceRef.current = null;
      returnableHydratedRef.current = null;
      if (payload.customerId) setCustomerId(payload.customerId);
      if (payload.warehouseId) setWarehouseId(payload.warehouseId);
      if (payload.currencyId) setCurrencyId(payload.currencyId);
      setSourceSaleInvoiceId(payload.sourceId);
      setSuccess(`تم اختيار فاتورة ${payload.sourceNumber} — جاري تحميل البنود القابلة للإرجاع`);
    },
    [isPosted, selectedReturnId]
  );

  const summary = useMemo(() => {
    const base = computeInvoiceFinancialSummary(returnLines, { applyTax: true });
    const { gross, commercialDiscount } = computeInvoiceGrossDiscount(returnLines);
    const extrasNet = sumPartyInvoiceExtras(invoiceExtras, gross - commercialDiscount, 1);
    if (!extrasNet) return base;
    return computeInvoiceFinancialSummary(returnLines, {
      applyTax: true,
      additionsAndDiscounts: extrasNet,
    });
  }, [returnLines, invoiceExtras]);

  const buildPayload = () => {
    if (!warehouseId) throw new Error('يرجى اختيار المخزن');
    if (!customerId) throw new Error('يرجى اختيار العميل');
    if (returnLines.length === 0) throw new Error('يرجى إضافة سطر واحد على الأقل');
    if (!allowStandalone && !sourceSaleInvoiceId) {
      throw new Error('غير مسموح بإنشاء مردود مبيعات حر دون الارتباط بفاتورة بيع أصلية مسبقة طبقاً لسياسة الشركة');
    }
    const over = returnLines.find(
      (line) => line.returnableQty != null && line.quantity > line.returnableQty + 1e-6
    );
    if (over) {
      throw new Error(
        `لا يمكن إرجاع كمية [${over.quantity}] أكبر من المتاح للإرجاع [${over.returnableQty}]`
      );
    }
    let desc = description.trim();
    const ref = salesInvoices.find((i) => i.id === sourceSaleInvoiceId);
    const refLabel = ref?.invoiceNumber || returnableRes?.data?.originalInvoiceNumber || sourceSaleInvoiceId;
    if (sourceSaleInvoiceId) {
      desc = desc ? `${desc} — مرجع: ${refLabel}` : `مرجع: ${refLabel}`;
    }
    const netAmount = summary.netAmount;
    const entered = settlementMethod === 'cash' && cashPaid <= 0.009 ? netAmount : cashPaid;
    const collected = sumPaymentSplits(returnSplits.filter((line) => line.type !== 'ON_ACCOUNT'));
    const paymentMethod = collected > 0.009 ? 'split' : paymentMethodForCashPaid(entered, netAmount);
    let paymentSplits: unknown;
    if (collected > 0.009) {
      paymentSplits = returnSplits;
    } else if (entered > 0.009) {
      const tender = buildCashTenderSplits({
        kind: 'treasury',
        netAmount,
        treasuryId: treasuryId || defaultSafeId,
        direction: 'PAYMENT',
        mode: paymentMethod === 'cash' ? 'full' : 'advance',
        paidAmount: entered,
      });
      if (tender.error) throw new Error(tender.error);
      paymentSplits = tender.splits;
    }
    return mapSalesFormToM5CreateBody(
      {
        invoiceNumber,
        description: desc || undefined,
        date,
        hijriDate: hijriDate || undefined,
        customerId,
        warehouseId,
        currencyId,
        paymentMethod,
        paymentSplits,
        originalInvoiceId: sourceSaleInvoiceId || undefined,
        originalInvoiceNumber: sourceSaleInvoiceId ? String(refLabel || '') : undefined,
        internalNotes,
        lines: returnLines,
        adjustments: getExtrasPayload(),
      },
      { invoiceKind: 'SALE_RETURN', currencies, items }
    );
  };

  const createMutation = useApiMutation<{ id?: string; invoiceNumber?: string }, Record<string, unknown>>(
    '/invoices',
    'POST',
    {
      showSuccessToast: false,
      onSuccess: () => {
        invalidateInvoiceReturnCaches(invalidateQuery, sourceSaleInvoiceId);
        invalidateStockViews(invalidateQuery);
      },
      onError: (error: ApiError) => setError(error.message || 'فشل الحفظ'),
    }
  );

  const updateMutation = useApiMutation<unknown, Record<string, unknown>>(
    selectedReturnId ? `/invoices/${selectedReturnId}` : '/invoices',
    'PUT',
    {
      showSuccessToast: false,
      onSuccess: () => {
        invalidateInvoiceReturnCaches(invalidateQuery, sourceSaleInvoiceId, selectedReturnId);
        invalidateStockViews(invalidateQuery);
      },
      onError: (error: ApiError) => {
        if (isOptimisticLockApiError(error)) {
          toastVersionConflict(error.message, () => invalidateQuery(['invoice', selectedReturnId]));
          return;
        }
        setError(error.message || 'فشل التحديث');
      },
    }
  );

  const postMutation = useApiMutation<unknown, Record<string, unknown>>(
    `/invoices/${selectedReturnId || '_'}/post`,
    'POST',
    {
      onSuccess: () => {
        setIsPosted(true);
        setSuccess('تم ترحيل المردود');
        if (selectedReturnId) refreshSettlementQueries(selectedReturnId);
        invalidateInvoiceReturnCaches(invalidateQuery, sourceSaleInvoiceId, selectedReturnId);
        invalidateStockViews(invalidateQuery);
        invalidateQuery(['journal-entry']);
      },
      onError: (error: ApiError, variables) => {
        if (
          retryIfNegativeStockConfirm(
            error,
            variables,
            (body) => postMutation.mutate(body),
            'confirmNegativeStockPost'
          )
        ) {
          return;
        }
        setIsPosted(false);
        setError(error.message || 'فشل الترحيل');
      },
    }
  );

  const unpostMutation = useApiMutation<unknown, Record<string, unknown>>(
    `/invoices/${selectedReturnId || '_'}/unpost`,
    'POST',
    {
      onSuccess: () => {
        setIsPosted(false);
        markUnpostedForEdit();
        setSuccess('تم فك ترحيل المردود');
        invalidateInvoiceReturnCaches(invalidateQuery, sourceSaleInvoiceId, selectedReturnId);
        invalidateStockViews(invalidateQuery);
        invalidateQuery(['journal-entry']);
      },
      onError: (error: ApiError, variables) => {
        if (
          retryIfNegativeStockConfirm(error, variables, (body) => unpostMutation.mutate(body))
        ) {
          return;
        }
        setError(error.message || 'فشل فك الترحيل');
      },
    }
  );

  const cancelReturnMutation = useApiMutation<unknown, Record<string, never>>(
    selectedReturnId ? `/invoices/${selectedReturnId}/cancel` : '/invoices',
    'POST',
    {
      showSuccessToast: false,
      onSuccess: () => {
        toast.success('تم إلغاء المردود');
        invalidateInvoiceReturnCaches(invalidateQuery, sourceSaleInvoiceId, selectedReturnId);
        invalidateStockViews(invalidateQuery);
        setIsPosted(false);
        setCancelPending(false);
      },
      onError: (error: ApiError) => {
        setCancelPending(false);
        setError(error.message || 'تعذر الإلغاء');
      },
    }
  );

  const financialBusy =
    createMutation.isPending ||
    updateMutation.isPending ||
    postMutation.isPending ||
    unpostMutation.isPending ||
    cancelReturnMutation.isPending ||
    cancelPending;

  const handleVoidReturn = async () => {
    if (!selectedReturnId || financialBusy) return;
    if (!(await confirmAction('إلغاء المستند؟ يمكن استعادته من قائمة (...).'))) return;
    setCancelPending(true);
    cancelReturnMutation.mutate({});
  };

  const handleRestoreCancelledReturn = async () => {
    if (!selectedReturnId || restorePending) return;
    setRestorePending(true);
    try {
      await restoreCancelledDocument({
        restorePath: `/invoices/${selectedReturnId}/restore`,
        postPath: `/invoices/${selectedReturnId}/post`,
        kind: 'invoice',
        autoPostOnSave: txSettings?.autoPostOnSave,
      });
      invalidateInvoiceReturnCaches(invalidateQuery, sourceSaleInvoiceId, selectedReturnId);
      invalidateStockViews(invalidateQuery);
      setSuccess(
        txSettings?.autoPostOnSave ? 'تمت الاستعادة والترحيل' : 'تمت الاستعادة — المستند غير مرحّل'
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر الاستعادة');
    } finally {
      setRestorePending(false);
    }
  };

  const handleSave = async (andPost = false) => {
    if (financialBusy || isPosted) return;
    setError('');
    const extrasValidation = validateExtras();
    if (extrasValidation) {
      setError(extrasValidation);
      setExtrasOpen(true);
      return;
    }
    try {
      const body = buildPayload();
      const netAmount = summary.netAmount;
      const savedPaid = Number((selectedInvoice as { paidAmount?: number } | undefined)?.paidAmount ?? 0);
      const confirmNetBelowCollections =
        selectedReturnId &&
        savedPaid > 0.009 &&
        !invoiceNetCoversCollections(netAmount, savedPaid);
      let id = selectedReturnId;
      let number = invoiceNumber;
      if (id) {
        await updateMutation.mutateAsync(
          mapSalesFormToM5UpdateBody(
            {
              invoiceNumber,
              description: body.description as string | undefined,
              date,
              customerId,
              warehouseId,
              currencyId,
              paymentMethod: body.paymentMethod as string | undefined,
              paymentSplits: body.paymentSplits,
              originalInvoiceId: sourceSaleInvoiceId || undefined,
              originalInvoiceNumber:
                salesInvoices.find((i) => i.id === sourceSaleInvoiceId)?.invoiceNumber ||
                returnableRes?.data?.originalInvoiceNumber ||
                undefined,
              lines: returnLines,
              adjustments: getExtrasPayload(),
            },
            {
              invoiceKind: 'SALE_RETURN',
              currencies,
              items,
              expectedVersion:
                typeof selectedInvoice?.version === 'number' ? selectedInvoice.version : undefined,
              lockPaymentTenders: savedPaid > 0.009,
              confirmNetBelowCollections: confirmNetBelowCollections ? true : undefined,
            }
          )
        );
      } else {
        const res = await createMutation.mutateAsync(body);
        id = res.data?.id ?? null;
        number = res.data?.invoiceNumber || number;
      }
      if (!id) return;
      clearDraft();
      let posted = false;
      if (andPost || consumeShouldRepost()) {
        await postInvoiceAfterSave(id);
        posted = true;
      }
      refreshSettlementQueries(id);
      invalidateInvoiceReturnCaches(invalidateQuery, sourceSaleInvoiceId, id);
      invalidateStockViews(invalidateQuery);
      if (txSettings?.autoPrintOnSave) {
        dispatchAutoPrintAfterSave();
      }
      finishDocumentSave({
        label: 'مردود مبيعات',
        number,
        posted,
        savedId: id,
        onOpen: stayOnReturn,
        reset: resetForm,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تحقق من البيانات');
    }
  };

  const paymentUiEnabled = !invoicePaymentButtonDisabled('sales-invoice', {
    isPosted,
    isReadOnly: isPosted,
  });

  return (
    <ErpDocumentLayout className={ERP_INVOICE_DOCUMENT_LAYOUT_CLASS}>
      {error ? <ErrorToast message={error} onClose={() => setError('')} /> : null}
      {success ? <SuccessToast message={success} onClose={() => setSuccess('')} /> : null}

      <PageDraftRestoreGate<SalesReturnDraft>
        restoreOffer={restoreOffer}
        hide={Boolean(selectedReturnId)}
        message="يوجد مسودة مردود مبيعات غير محفوظة."
        acceptRestore={acceptRestore}
        dismissRestore={dismissRestore}
        onRestored={(payload) => {
          applySalesReturnDraft(payload);
          setSuccess('تم استعادة مسودة مردود المبيعات');
        }}
      />

      <SalesInvoicePageHeader
        title="مردود مبيعات"
        breadcrumbLabel="مردودات المبيعات"
        invoiceKind="SALE_RETURN"
        invoiceNumber={invoiceNumber}
        lifecycle={{
          documentId: selectedReturnId,
          isPosted,
          isCancelled: Boolean((selectedInvoice as { isCancelled?: boolean } | undefined)?.isCancelled),
        }}
        savePending={financialBusy}
        postPending={postMutation.isPending || unpostMutation.isPending}
        canPost={!!selectedReturnId && !isPosted && !financialBusy}
        canSave={!isPosted && !financialBusy}
        saveLabel="حفظ المردود"
        postLabel="ترحيل المردود"
        collectLabel="صرف للمردود"
        historyLabel="صرفيات سابقة"
        deleteLabel="حذف المردود"
        newDocumentLabel="مردود جديد"
        favoriteHref="/inventory/operations/sales-returns"
        favoriteLabel="مردود مبيعات"
        hideStandalonePost
        onSaveDraft={() => void handleSave(false)}
        onPost={() => void handleSave(true)}
        onCancel={resetForm}
        onNewInvoice={resetForm}
        onBrowseList={() => setShowList(true)}
        currentId={selectedReturnId}
        onNavigate={(id) => {
          setSelectedReturnId(id);
          setShowList(false);
        }}
        printInvoice={{
          invoiceNumber,
          date,
          invoiceKind: 'SALE_RETURN',
          customerId,
          warehouseId,
          lines: returnLines.map((line) => {
            const it = items.find((item) => item.id === line.itemId);
            return {
              ...line,
              taxRate: line.taxRate,
              item: it
                ? { code: it.code, serial: it.serial, arabicName: it.arabicName }
                : undefined,
            };
          }),
        }}
        onUnpost={() => {
          if (selectedReturnId) unpostMutation.mutate({});
        }}
        onDelete={() => void handleVoidReturn()}
        isPosted={isPosted}
        isCancelled={Boolean((selectedInvoice as { isCancelled?: boolean } | undefined)?.isCancelled)}
        onRestore={() => void handleRestoreCancelledReturn()}
        restorePending={restorePending}
        deletePending={cancelReturnMutation.isPending || cancelPending}
        onOpenJournal={() => {
          if (!selectedReturnId) return;
          router.push(destinationAppTabHref(`/accounting/operations/journal-entry?ref=invoice&id=${selectedReturnId}`));
        }}
        onCollectPayment={() => setPayOpen(true)}
        onPaymentHistory={() => setBottomTab('settlements')}
        onEdit={() => {
          if (isPosted) setError('فك الترحيل أولاً حتى يمكن التعديل');
        }}
        transactionSettingsDocumentType="SALES_RETURN"
        onTransactionSettingsSaved={() =>
          invalidateAfterTransactionSettingsSave(invalidateQuery, 'SALES_RETURN')
        }
        journalEntryId={(selectedInvoice as { journalEntryId?: string | null } | undefined)?.journalEntryId}
      />

      <DocumentBrowseDrawer
        open={showList}
        onClose={() => setShowList(false)}
        title="مردودات المبيعات السابقة"
      >
        <InventoryInvoicesListSection
          compact
          title="مردودات المبيعات السابقة"
          invoiceKind="SALE_RETURN"
          partyColumnHeader="العميل"
          getPartyName={(row) => row.customer?.arabicName || '—'}
          selectedInvoiceId={selectedReturnId}
          onSelectInvoice={(id) => {
            setSelectedReturnId(id);
            setShowList(false);
          }}
        />
      </DocumentBrowseDrawer>

      <div data-tour-id="sales-returns-header">
        <ReturnInvoiceFormHeader
          variant="sales"
          disabled={isPosted}
          includeAllAccounts={shouldShowAllAccountsInPartyField(txSettings)}
          sourceActions={
            <DocumentSourceLoadBar
              key={sourceBarKey}
              hasExistingLines={returnLines.some((l) => Boolean(l.itemId))}
              disabled={isPosted || Boolean(selectedReturnId) || lockLoadedSource}
              sourceRole="sales-return"
              onHydrate={handleReturnSourceHydrate}
            />
          }
          headerActions={
            <InternalNotesScratchpad
              notes={internalNotes}
              onChange={setInternalNotes}
              disabled={isPosted}
              className="inline-flex"
            />
          }
          partyId={customerId}
          onPartyId={setCustomerId}
          warehouseId={warehouseId}
          onWarehouseId={(id) => {
            setWarehouseId(id);
            setReturnLines((prev) => prev.map((line) => ({ ...line, warehouseId: id })));
          }}
          date={date}
          onDate={setDate}
          invoiceNumber={invoiceNumber}
          onInvoiceNumber={setInvoiceNumber}
          serialAutomatic={isTransactionSerialAutomatic(txSettings?.numberingMode)}
          hasSavedDocument={Boolean(selectedReturnId)}
          sourceInvoiceId={sourceSaleInvoiceId}
          onSourceInvoiceId={(id) => {
            if (id !== restoredSourceRef.current) restoredSourceRef.current = null;
            if (id !== sourceSaleInvoiceId) returnableHydratedRef.current = null;
            setSourceSaleInvoiceId(id);
            if (!id) {
              setReturnLines((prev) =>
                prev.map((l) => ({
                  ...l,
                  originalInvoiceLineId: undefined,
                  soldQty: undefined,
                  returnableQty: undefined,
                }))
              );
            }
          }}
          sourceInvoices={
            customerId
              ? salesInvoices.filter((inv) => !inv.customerId || inv.customerId === customerId)
              : salesInvoices
          }
          allowStandaloneReturns={allowStandalone}
          sourceRequired={!allowStandalone}
          currencyId={currencyId}
          onCurrencyId={setCurrencyId}
          currencies={currencies}
          description={description}
          onDescription={setDescription}
          restock={restock}
          onRestock={setRestock}
          returnReason={returnReason}
          onReturnReason={setReturnReason}
          settlementMethod={settlementMethod}
          onSettlementMethod={setSettlementMethod}
          treasuryId={treasuryId}
          onTreasuryId={setTreasuryId}
          onLoadSourceLines={() => {
            if (!sourceSaleInvoiceId) return;
            setSuccess('جاري تحميل بنود الفاتورة الأصلية...');
          }}
        />
      </div>

      <div className="mt-2" data-tour-id="sales-returns-lines">
        <ReturnInvoiceLinesGrid
          lines={returnLines}
          onChange={setReturnLines}
          warehouseId={warehouseId}
          readOnly={isPosted}
          lockUnitPrice={Boolean(sourceSaleInvoiceId)}
          allowAddLines={!isPosted && allowStandalone && !sourceSaleInvoiceId}
          addLineBlockedMessage={
            sourceSaleInvoiceId
              ? 'لا يمكن إضافة سطر بعد تحميل فاتورة من القسم — عدّل الكميات على البنود المحمّلة فقط.'
              : !allowStandalone
                ? 'يجب تحميل بنود المردود من فاتورة أصلية (القسم والرقم).'
                : undefined
          }
          headerDescription={description}
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
        defaultCostCenterId=""
        disabled={isPosted}
        count={getExtrasPayload().length}
        headerDescription={description}
      />

      <PurchaseInvoiceBottomSplit
        stockSign={1}
        settlementDirection="PAYMENT"
        activeTabId={bottomTab}
        onActiveTabChange={setBottomTab}
        summary={summary}
        applyTax
        lines={returnLines.map((l) => ({ ...l, itemId: l.itemId, taxRate: l.taxRate }))}
        savedLines={
          selectedReturnId && Array.isArray((selectedInvoice as { lines?: unknown[] } | undefined)?.lines)
            ? ((selectedInvoice as { lines: Record<string, unknown>[] }).lines).map((line) => ({
                itemId: String(line.itemId ?? ''),
                itemName: readInvoiceLineItemName(line),
                quantity: Number(line.quantity) || 0,
                baseQuantity: Number(line.baseQuantity ?? line.quantity) || 0,
                unitPrice: Number(line.price ?? line.unitPrice) || 0,
                taxRate: Number(line.taxPercent ?? line.taxRate ?? 0) || 0,
              }))
            : []
        }
        warehouseId={warehouseId}
        journalEntryId={(selectedInvoice as { journalEntryId?: string | null })?.journalEntryId}
        selectedInvoiceId={selectedReturnId}
        isPosted={isPosted}
        settlements={settlements}
        settlementHistory={settlementHistory}
        cheques={settlementCheques}
        paidAmount={Number((selectedInvoice as { paidAmount?: number } | undefined)?.paidAmount) || 0}
        remainingAmount={
          invoiceRemainingForCollect(selectedInvoice as Record<string, unknown> | undefined) ?? 0
        }
        cashPayment={{
          paidAmount: invoiceCashPaidDisplayAmount({
            isPosted,
            savedPaidAmount:
              Number((selectedInvoice as { paidAmount?: number } | undefined)?.paidAmount) || 0,
            paymentMethod: returnSplits.some((line) => line.type !== 'ON_ACCOUNT')
              ? 'split'
              : settlementMethod === 'cash'
                ? 'cash'
                : 'credit',
            advancePaidAmount: cashPaid,
            splitTenderPaid: sumPaymentSplits(returnSplits.filter((line) => line.type !== 'ON_ACCOUNT')),
            netAmount: summary.netAmount,
          }),
          method: returnSplits.some((line) => line.type !== 'ON_ACCOUNT')
            ? 'split'
            : settlementMethod === 'cash'
              ? 'cash'
              : 'credit',
          onOpenSplit: () => setPayOpen(true),
          disabled: !paymentUiEnabled,
        }}
      />
      {payOpen ? (
        <MultiPaymentSplitterModal
          open
          onClose={() => setPayOpen(false)}
          grandTotal={
            isPosted
              ? invoiceRemainingForCollect(selectedInvoice as Record<string, unknown> | undefined) ??
                summary.netAmount
              : summary.netAmount
          }
          direction="PAYMENT"
          initial={isPosted ? [] : returnSplits}
          onConfirm={(splits) => {
            if (!isPosted) {
              const paid = sumPaymentSplits(splits.filter((line) => line.type !== 'ON_ACCOUNT'));
              setCashPaid(paid);
              setSettlementMethod(paymentMethodForCashPaid(paid, summary.netAmount));
              setReturnSplits(paid > 0.009 ? splits : []);
              setPayOpen(false);
              return;
            }
            if (!selectedReturnId) {
              setPayOpen(false);
              return;
            }
            void postInvoiceSettlementSplits(selectedReturnId, splits)
              .then(() => {
                setSuccess('تم تسجيل الصرف');
                setPayOpen(false);
                refreshSettlementQueries(selectedReturnId);
              })
              .catch((err: unknown) => {
                setError(err instanceof Error ? err.message : 'تعذر تسجيل الصرف');
              });
          }}
        />
      ) : null}
    </ErpDocumentLayout>
  );
}
