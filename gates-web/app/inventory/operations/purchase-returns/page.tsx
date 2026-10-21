'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useOwnTabPathname, useOwnTabSearchParams } from '@/lib/navigation/tab-route-lock';
import { SalesInvoicePageHeader } from '@/components/inventory/sales-invoice/SalesInvoicePageHeader';
import { destinationAppTabHref } from '@/lib/navigation/tab-memory';
import { InventoryInvoicesListSection } from '@/components/inventory/InventoryInvoicesListSection';
import { useApiQuery, useApiMutation, useInvalidateQuery } from '@/lib/hooks/useApi';
import { resolvePostedFlag } from '@/lib/documents/posting-trust';
import type { ApiError } from '@/lib/api/types';
import {
  postInvoiceAfterSave,
  useRepostAfterUnpost,
} from '@/lib/accounting/ensure-posted-after-save';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';
import { toastVersionConflict } from '@/lib/feedback/toast';
import { isOptimisticLockApiError } from '@/lib/concurrency/version-conflict';
import { mapSalesFormToM5CreateBody, mapSalesFormToM5UpdateBody } from '@/lib/invoices/mapFormToM5Invoice';
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
import { apiClient } from '@/lib/api/client';
import { confirmAction } from '@/lib/feedback/confirm';
import { retryIfNegativeStockConfirm } from '@/lib/invoices/purchase-unpost-negative-stock';
import { restoreCancelledDocument } from '@/lib/documents/restore-cancelled-document';
import { toast } from '@/lib/feedback/toast';
import { invalidateInvoiceReturnCaches } from '@/lib/invoices/invalidate-after-return';
import { savedInvoiceHydrateKey } from '@/lib/invoices/invoice-form-hydrate';
import { finishDocumentSave } from '@/lib/documents/finish-save';
import { invalidateStockViews } from '@/lib/invoices/invalidate-stock-views';
import { InternalNotesScratchpad } from '@/components/documents/InternalNotesScratchpad';
import type { InternalNoteEntry } from '@/lib/invoices/payment-split.types';
import {
  buildCashTenderSplits,
  isCashPaymentMethod,
  tenderPaidFromSplits,
  treasuryIdFromSplits,
} from '@/lib/invoices/cash-tender';
import { paymentMethodForCashPaid } from '@/components/invoices/InvoiceCashPaidControls';
import { sumPaymentSplits, type PaymentSplitLine } from '@/lib/invoices/payment-split.types';
import { DocumentSourceLoadBar } from '@/components/invoices/DocumentSourceLoadBar';
import type { SourceHydratePayload } from '@/lib/invoices/sourceDocument';
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

const ReturnInvoiceLinesGrid = dynamic(
  () =>
    import('@/components/inventory/returns/ReturnInvoiceLinesGrid').then((m) => ({
      default: m.ReturnInvoiceLinesGrid,
    })),
  { ssr: false, loading: () => <LineGridSkeleton label="جاري تحميل بنود مرتجع المشتريات…" /> }
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
interface PartyPerson {
  id: string;
  arabicName: string;
}

type PurchaseReturnDraft = {
  invoiceNumber: string;
  description: string;
  date: string;
  supplierId: string;
  warehouseId: string;
  currencyId: string;
  sourcePurchaseInvoiceId: string;
  returnLines: ReturnLineForm[];
  returnReason: string;
  debitNoteNumber: string;
  settlementMethod: string;
  treasuryId: string;
  cashPaid?: number;
  delegateId: string;
  driverId: string;
  distributorId: string;
  internalNotes: InternalNoteEntry[];
};

function isPurchaseReturnDraftEmpty(draft: PurchaseReturnDraft) {
  const hasLine = (draft.returnLines ?? []).some((line) => Boolean(line.itemId?.trim()));
  return (
    !draft.supplierId?.trim() &&
    !draft.description?.trim() &&
    !draft.sourcePurchaseInvoiceId?.trim() &&
    !draft.returnReason?.trim() &&
    !draft.invoiceNumber?.trim() &&
    !draft.debitNoteNumber?.trim() &&
    !hasLine &&
    (draft.settlementMethod || 'credit') === 'credit' &&
    !draft.treasuryId?.trim()
  );
}

export default function PurchaseReturnsPage() {
  const router = useRouter();
  const ownPathname = useOwnTabPathname();
  const searchParams = useOwnTabSearchParams();
  const fromInvoiceParam = searchParams.get('fromInvoice');
  const invoiceIdParam = searchParams.get('invoiceId');
  const prefillApplied = useRef(false);
  const returnableHydratedRef = useRef<string | null>(null);
  const lastHydrateKeyRef = useRef<string | null>(null);

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
  const [supplierId, setSupplierId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [currencyId, setCurrencyId] = useState('');
  const [sourcePurchaseInvoiceId, setSourcePurchaseInvoiceId] = useState('');
  const [sourceBarKey, setSourceBarKey] = useState(0);
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
  const [returnReason, setReturnReason] = useState('');
  const [debitNoteNumber, setDebitNoteNumber] = useState('');
  const [settlementMethod, setSettlementMethod] = useState('credit');
  const [cashPaid, setCashPaid] = useState(0);
  const [returnSplits, setReturnSplits] = useState<PaymentSplitLine[]>([]);
  const [payOpen, setPayOpen] = useState(false);
  const [bottomTab, setBottomTab] = useState('gl');
  const [treasuryId, setTreasuryId] = useState('');
  const [delegateId, setDelegateId] = useState('');
  const [driverId, setDriverId] = useState('');
  const [distributorId, setDistributorId] = useState('');
  const [internalNotes, setInternalNotes] = useState<InternalNoteEntry[]>([]);

  const { data: safesResponse } = useSafesQuery();
  const defaultSafeId = pickDefaultSafeId(safesResponse?.data);

  const { data: txSettingsRes } = useApiQuery<TransactionSettings>(
    ['transaction-settings', 'PURCHASE_RETURN'],
    '/transaction-settings/PURCHASE_RETURN'
  );
  const txSettings = txSettingsRes?.data;
  const { markUnpostedForEdit, consumeShouldRepost, resetKeepPosted } = useRepostAfterUnpost(
    txSettings?.autoPostOnSave
  );
  const allowStandalone = txSettings?.allowStandaloneReturns !== false;
  const enforceOriginalPrice = txSettings?.enforceOriginalPrice !== false;
  const lockLoadedSource = shouldLockLoadedSource(txSettings, sourcePurchaseInvoiceId);

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

  const { data: delegatesResponse } = useApiQuery<PartyPerson[]>(
    ['delegates', { role: 'DELEGATE' }],
    '/accounting/delegates',
    { limit: 1000, isActive: true, role: 'DELEGATE' }
  );
  const { data: driversResponse } = useApiQuery<PartyPerson[]>(
    ['delegates', { role: 'DRIVER' }],
    '/accounting/delegates',
    { limit: 1000, isActive: true, role: 'DRIVER' }
  );
  const { data: distributorsResponse } = useApiQuery<PartyPerson[]>(
    ['delegates', { role: 'DISTRIBUTOR' }],
    '/accounting/delegates',
    { limit: 1000, isActive: true, role: 'DISTRIBUTOR' }
  );

  const { data: purchaseInvoicesResponse } = useApiQuery<SourceInvoiceOption[]>(
    ['invoices', 'purchase-picklist'],
    '/invoices',
    { invoiceKind: 'PURCHASE', isPosted: true, limit: 200 }
  );
  const purchaseInvoices = purchaseInvoicesResponse?.data || [];

  const { data: returnableRes } = useApiQuery<{
    originalInvoiceId: string;
    originalInvoiceNumber: string | null;
    supplierId: string | null;
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
    ['invoice', 'returnable-lines', sourcePurchaseInvoiceId],
    `/invoices/${sourcePurchaseInvoiceId}/returnable-lines`,
    undefined,
    { enabled: Boolean(sourcePurchaseInvoiceId), staleTime: 0, refetchOnMount: 'always' }
  );

  const { data: sourcePurchaseResponse } = useApiQuery<Record<string, unknown>>(
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
    setSupplierId(String(selectedInvoice.supplierId ?? ''));
    setWarehouseId(String(selectedInvoice.warehouseId ?? ''));
    setSourcePurchaseInvoiceId(String(selectedInvoice.originalInvoiceId ?? ''));
    setCurrencyId(String(selectedInvoice.currencyId ?? currencyId));
    setIsPosted(resolvePostedFlag(selectedInvoice));
    const loadedCash = isCashPaymentMethod(selectedInvoice.paymentMethod);
    setSettlementMethod(loadedCash ? 'cash' : 'credit');
    setCashPaid(
      loadedCash ? 0 : tenderPaidFromSplits(selectedInvoice.paymentSplits as PaymentSplitLine[] | undefined)
    );
    setTreasuryId(treasuryIdFromSplits(selectedInvoice.paymentSplits as PaymentSplitLine[] | undefined));
    setDelegateId(String(selectedInvoice.representativeId ?? selectedInvoice.delegateId ?? ''));
    setDriverId(String(selectedInvoice.driverId ?? ''));
    setDistributorId(String(selectedInvoice.distributorId ?? ''));
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
    const inv = sourcePurchaseResponse?.data;
    if (!inv || !fromInvoiceParam || prefillApplied.current || selectedReturnId) return;
    prefillApplied.current = true;
    setSelectedReturnId(null);
    setIsPosted(false);
    setSourcePurchaseInvoiceId(fromInvoiceParam);
    setSupplierId(String(inv.supplierId ?? ''));
    setWarehouseId(String(inv.warehouseId ?? ''));
    setCurrencyId(String(inv.currencyId ?? currencyId));
    setInvoiceNumber('');
    setDate(new Date().toISOString().split('T')[0]);
    const refNo = String(inv.invoiceNumber ?? fromInvoiceParam);
    setDescription(`مردود عن فاتورة مشتريات ${refNo}`);
    setDelegateId(String(inv.representativeId ?? inv.delegateId ?? ''));
    setDriverId(String(inv.driverId ?? ''));
    setDistributorId(String(inv.distributorId ?? ''));
    setSuccess('تم تحميل بنود الفاتورة الأصلية — عدّل الكميات المراد إرجاعها');
  }, [sourcePurchaseResponse, fromInvoiceParam, selectedReturnId, currencyId]);

  useEffect(() => {
    const snap = returnableRes?.data;
    if (!snap || !sourcePurchaseInvoiceId || selectedReturnId) return;
    if (returnableHydratedRef.current === sourcePurchaseInvoiceId) return;
    returnableHydratedRef.current = sourcePurchaseInvoiceId;
    setSupplierId(snap.supplierId || '');
    if (snap.warehouseId) setWarehouseId(snap.warehouseId);
    const refNo = snap.originalInvoiceNumber || sourcePurchaseInvoiceId;
    setDescription((prev) => prev || `مردود عن فاتورة مشتريات ${refNo}`);
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
  }, [returnableRes?.data, sourcePurchaseInvoiceId, selectedReturnId]);

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
    (): PurchaseReturnDraft => ({
      invoiceNumber,
      description,
      date,
      supplierId,
      warehouseId,
      currencyId,
      sourcePurchaseInvoiceId,
      returnLines,
      returnReason,
      debitNoteNumber,
      settlementMethod,
      treasuryId,
      cashPaid,
      delegateId,
      driverId,
      distributorId,
      internalNotes,
    }),
    [
      invoiceNumber,
      description,
      date,
      supplierId,
      warehouseId,
      currencyId,
      sourcePurchaseInvoiceId,
      returnLines,
      returnReason,
      debitNoteNumber,
      settlementMethod,
      treasuryId,
      cashPaid,
      delegateId,
      driverId,
      distributorId,
      internalNotes,
    ]
  );

  const applyPurchaseReturnDraft = useCallback((payload: PurchaseReturnDraft) => {
    returnableHydratedRef.current = payload.sourcePurchaseInvoiceId?.trim() || null;
    setInvoiceNumber(payload.invoiceNumber ?? '');
    setDescription(payload.description ?? '');
    setDate(payload.date || new Date().toISOString().split('T')[0]);
    setSupplierId(payload.supplierId ?? '');
    setWarehouseId(payload.warehouseId ?? '');
    setCurrencyId(payload.currencyId ?? '');
    setSourcePurchaseInvoiceId(payload.sourcePurchaseInvoiceId ?? '');
    setReturnLines(Array.isArray(payload.returnLines) ? payload.returnLines : []);
    setReturnReason(payload.returnReason ?? '');
    setDebitNoteNumber(payload.debitNoteNumber ?? '');
    setSettlementMethod(payload.settlementMethod === 'cash' ? 'cash' : 'credit');
    setCashPaid(Number(payload.cashPaid) || 0);
    setTreasuryId(payload.treasuryId ?? '');
    setDelegateId(payload.delegateId ?? '');
    setDriverId(payload.driverId ?? '');
    setDistributorId(payload.distributorId ?? '');
    setInternalNotes(Array.isArray(payload.internalNotes) ? payload.internalNotes : []);
  }, []);

  const { restoreOffer, acceptRestore, dismissRestore, clearDraft } = useDraftAutosave({
    documentType: 'purchase-return',
    mode: selectedReturnId ? 'edit' : 'new',
    documentId: selectedReturnId,
    value: draftSnapshot,
    enabled: !isPosted,
    isEmpty: isPurchaseReturnDraftEmpty,
    restoreMessage: 'يوجد مسودة مردود مشتريات غير محفوظة',
  });

  const resetForm = useCallback(() => {
    clearDraft();
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
    setSupplierId('');
    setWarehouseId(txSettings?.defaultWarehouseId ?? '');
    setSourcePurchaseInvoiceId('');
    setReturnLines([]);
    setSettlementMethod('credit');
    setCashPaid(0);
    setReturnSplits([]);
    setTreasuryId('');
    setDelegateId('');
    setDriverId('');
    setDistributorId('');
    setInternalNotes([]);
    setDate(new Date().toISOString().split('T')[0]);
    setSourceBarKey((k) => k + 1);
    resetExtras();
  }, [clearDraft, replaceQuery, resetExtras, resetKeepPosted, txSettings?.defaultWarehouseId]);

  const handleReturnSourceHydrate = useCallback(
    (payload: SourceHydratePayload) => {
      if (selectedReturnId || isPosted) return;
      returnableHydratedRef.current = null;
      if (payload.supplierId) setSupplierId(payload.supplierId);
      if (payload.warehouseId) setWarehouseId(payload.warehouseId);
      if (payload.currencyId) setCurrencyId(payload.currencyId);
      setSourcePurchaseInvoiceId(payload.sourceId);
      setSuccess(`تم اختيار فاتورة ${payload.sourceNumber} — جاري تحميل البنود القابلة للإرجاع`);
    },
    [isPosted, selectedReturnId]
  );

  const sourceRefLabel = () => {
    const ref = purchaseInvoices.find((i) => i.id === sourcePurchaseInvoiceId);
    return ref?.invoiceNumber || returnableRes?.data?.originalInvoiceNumber || sourcePurchaseInvoiceId;
  };

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
    if (!supplierId) throw new Error('يرجى اختيار المورد');
    if (returnLines.length === 0) throw new Error('يرجى إضافة سطر واحد على الأقل');
    if (!allowStandalone && !sourcePurchaseInvoiceId) {
      throw new Error(
        'غير مسموح بإنشاء مردود مشتريات حر دون الارتباط بفاتورة مشتريات أصلية مسبقة طبقاً لسياسة الشركة'
      );
    }
    const over = returnLines.find(
      (line) => line.returnableQty != null && line.quantity > line.returnableQty + 1e-6
    );
    if (over) {
      throw new Error(
        `لا يمكن إرجاع كمية [${over.quantity}] من الصنف. أقصى كمية متبقية قابلة للإرجاع هي [${over.returnableQty}]`
      );
    }
    let desc = description.trim();
    const refLabel = sourceRefLabel();
    if (sourcePurchaseInvoiceId) {
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
        direction: 'RECEIPT',
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
        supplierId,
        warehouseId,
        currencyId,
        paymentMethod,
        paymentSplits,
        originalInvoiceId: sourcePurchaseInvoiceId || undefined,
        originalInvoiceNumber: sourcePurchaseInvoiceId ? String(refLabel || '') : undefined,
        delegateId: delegateId || undefined,
        driverId: driverId || undefined,
        distributorId: distributorId || undefined,
        internalNotes,
        lines: returnLines,
        adjustments: getExtrasPayload(),
      },
      { invoiceKind: 'PURCHASE_RETURN', currencies, items }
    );
  };

  const createMutation = useApiMutation<
    { id?: string; isPosted?: boolean; invoiceNumber?: string },
    Record<string, unknown>
  >('/invoices', 'POST', {
    showSuccessToast: false,
    onSuccess: () => {
      invalidateInvoiceReturnCaches(invalidateQuery, sourcePurchaseInvoiceId);
      invalidateStockViews(invalidateQuery);
    },
    onError: (error: ApiError) => setError(error.message || 'فشل الحفظ'),
  });

  const updateMutation = useApiMutation<unknown, Record<string, unknown>>(
    selectedReturnId ? `/invoices/${selectedReturnId}` : '/invoices',
    'PUT',
    {
      showSuccessToast: false,
      onSuccess: () => {
        invalidateInvoiceReturnCaches(invalidateQuery, sourcePurchaseInvoiceId, selectedReturnId);
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
        invalidateInvoiceReturnCaches(invalidateQuery, sourcePurchaseInvoiceId, selectedReturnId);
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
        invalidateInvoiceReturnCaches(invalidateQuery, sourcePurchaseInvoiceId, selectedReturnId);
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
        invalidateInvoiceReturnCaches(invalidateQuery, sourcePurchaseInvoiceId, selectedReturnId);
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
      invalidateInvoiceReturnCaches(invalidateQuery, sourcePurchaseInvoiceId, selectedReturnId);
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
      let alreadyPosted = false;
      let number = invoiceNumber;
      if (id) {
        await updateMutation.mutateAsync(
          mapSalesFormToM5UpdateBody(
            {
              invoiceNumber,
              description: body.description as string | undefined,
              date,
              supplierId,
              warehouseId,
              currencyId,
              paymentMethod: body.paymentMethod as string | undefined,
              paymentSplits: body.paymentSplits,
              originalInvoiceId: sourcePurchaseInvoiceId || undefined,
              originalInvoiceNumber: sourcePurchaseInvoiceId ? String(sourceRefLabel() || '') : undefined,
              delegateId: delegateId || undefined,
              driverId: driverId || undefined,
              distributorId: distributorId || undefined,
              lines: returnLines,
              adjustments: getExtrasPayload(),
            },
            {
              invoiceKind: 'PURCHASE_RETURN',
              currencies,
              items,
              expectedVersion:
                typeof selectedInvoice?.version === 'number' ? selectedInvoice.version : undefined,
              lockPaymentTenders: savedPaid > 0.009,
              confirmNetBelowCollections: confirmNetBelowCollections ? true : undefined,
            }
          )
        );
        alreadyPosted = Boolean(selectedInvoice?.isPosted);
      } else {
        const res = await createMutation.mutateAsync(body);
        const created = res.data as
          | { id?: string; isPosted?: boolean; invoiceNumber?: string; invoice?: { id?: string; isPosted?: boolean } }
          | undefined;
        id = created?.id ?? created?.invoice?.id ?? null;
        alreadyPosted = Boolean(created?.isPosted ?? created?.invoice?.isPosted);
        number = created?.invoiceNumber || number;
      }
      if (!id) return;
      clearDraft();
      let posted = alreadyPosted;
      if (andPost || consumeShouldRepost()) {
        await postInvoiceAfterSave(id);
        posted = true;
      }
      refreshSettlementQueries(id);
      invalidateInvoiceReturnCaches(invalidateQuery, sourcePurchaseInvoiceId, id);
      invalidateStockViews(invalidateQuery);
      if (txSettings?.autoPrintOnSave) {
        dispatchAutoPrintAfterSave();
      }
      finishDocumentSave({
        label: 'مردود مشتريات',
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

      <PageDraftRestoreGate<PurchaseReturnDraft>
        restoreOffer={restoreOffer}
        hide={Boolean(selectedReturnId)}
        message="يوجد مسودة مردود مشتريات غير محفوظة."
        acceptRestore={acceptRestore}
        dismissRestore={dismissRestore}
        onRestored={(payload) => {
          applyPurchaseReturnDraft(payload);
          setSuccess('تم استعادة مسودة مردود المشتريات');
        }}
      />

      <SalesInvoicePageHeader
        title="مردود مشتريات"
        breadcrumbLabel="مردودات المشتريات"
        invoiceKind="PURCHASE_RETURN"
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
        collectLabel="تحصيل المردود"
        historyLabel="تحصيلات سابقة"
        deleteLabel="حذف المردود"
        newDocumentLabel="مردود جديد"
        favoriteHref="/inventory/operations/purchase-returns"
        favoriteLabel="مردود مشتريات"
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
          invoiceKind: 'PURCHASE_RETURN',
          supplierId,
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
        transactionSettingsDocumentType="PURCHASE_RETURN"
        onTransactionSettingsSaved={() =>
          invalidateAfterTransactionSettingsSave(invalidateQuery, 'PURCHASE_RETURN')
        }
        journalEntryId={(selectedInvoice as { journalEntryId?: string | null } | undefined)?.journalEntryId}
      />

      <DocumentBrowseDrawer
        open={showList}
        onClose={() => setShowList(false)}
        title="مردودات المشتريات السابقة"
      >
        <InventoryInvoicesListSection
          compact
          title="مردودات المشتريات السابقة"
          invoiceKind="PURCHASE_RETURN"
          partyColumnHeader="المورد"
          getPartyName={(row) => row.supplier?.arabicName || '—'}
          selectedInvoiceId={selectedReturnId}
          onSelectInvoice={(id) => {
            setSelectedReturnId(id);
            setShowList(false);
          }}
        />
      </DocumentBrowseDrawer>

      <ReturnInvoiceFormHeader
        variant="purchase"
        disabled={isPosted}
        includeAllAccounts={shouldShowAllAccountsInPartyField(txSettings)}
        sourceActions={
          <DocumentSourceLoadBar
            key={sourceBarKey}
            hasExistingLines={returnLines.some((l) => Boolean(l.itemId))}
            disabled={isPosted || Boolean(selectedReturnId) || lockLoadedSource}
            sourceRole="purchase-return"
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
        partyId={supplierId}
        onPartyId={setSupplierId}
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
        sourceInvoiceId={sourcePurchaseInvoiceId}
        onSourceInvoiceId={(id) => {
          if (id !== sourcePurchaseInvoiceId) returnableHydratedRef.current = null;
          setSourcePurchaseInvoiceId(id);
          if (!id) {
            returnableHydratedRef.current = null;
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
          supplierId
            ? purchaseInvoices.filter((inv) => !inv.supplierId || inv.supplierId === supplierId)
            : purchaseInvoices
        }
        allowStandaloneReturns={allowStandalone}
        sourceRequired={!allowStandalone}
        currencyId={currencyId}
        onCurrencyId={setCurrencyId}
        currencies={currencies}
        description={description}
        onDescription={setDescription}
        returnReason={returnReason}
        onReturnReason={setReturnReason}
        debitNoteNumber={debitNoteNumber}
        onDebitNoteNumber={setDebitNoteNumber}
        settlementMethod={settlementMethod}
        onSettlementMethod={setSettlementMethod}
        treasuryId={treasuryId}
        onTreasuryId={setTreasuryId}
        delegateId={delegateId}
        onDelegateId={setDelegateId}
        driverId={driverId}
        onDriverId={setDriverId}
        distributorId={distributorId}
        onDistributorId={setDistributorId}
        delegates={delegatesResponse?.data ?? []}
        drivers={driversResponse?.data ?? []}
        distributors={distributorsResponse?.data ?? []}
        onLoadSourceLines={() => {
          if (!sourcePurchaseInvoiceId) return;
          setSuccess('جاري تحميل بنود الفاتورة الأصلية...');
        }}
      />

      <div className="mt-2">
        <ReturnInvoiceLinesGrid
          lines={returnLines}
          onChange={setReturnLines}
          warehouseId={warehouseId}
          readOnly={isPosted}
          lockUnitPrice={Boolean(sourcePurchaseInvoiceId)}
          allowAddLines={!isPosted && allowStandalone && !sourcePurchaseInvoiceId}
          addLineBlockedMessage={
            sourcePurchaseInvoiceId
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
        stockSign={-1}
        settlementDirection="RECEIPT"
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
          direction="RECEIPT"
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
                setSuccess('تم تسجيل التحصيل');
                setPayOpen(false);
                refreshSettlementQueries(selectedReturnId);
              })
              .catch((err: unknown) => {
                setError(err instanceof Error ? err.message : 'تعذر تسجيل التحصيل');
              });
          }}
        />
      ) : null}
    </ErpDocumentLayout>
  );
}
