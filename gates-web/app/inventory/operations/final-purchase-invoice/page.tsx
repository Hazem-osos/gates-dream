'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { destinationAppTabHref } from '@/lib/navigation/tab-memory';
import { useOwnTabPathname, useOwnTabSearchParams } from '@/lib/navigation/tab-route-lock';
import { Button } from '@/components/ui';
import { DynamicModalSkeleton, LineGridSkeleton } from '@/components/ui/DynamicChunkSkeleton';
import { useApiQuery, useApiMutation, useInvalidateQuery } from '@/lib/hooks/useApi';
import {
  isTransactionSerialAutomatic,
  isTransactionSerialManual,
} from '@/lib/transaction-settings/serial-mode';
import {
  shouldLockItemPriceOverride,
  shouldLockLoadedSource,
  shouldShowAllAccountsInPartyField,
  type TransactionSettings,
} from '@/lib/transaction-settings/types';
import { dispatchAutoPrintAfterSave } from '@/lib/printer/print-prefs';
import { pickDefaultSafeId, useSuppliersQuery } from '@/lib/hooks/useMasterDataQueries';
import {
  combinedPriceListDiscountPercent,
  resolvePriceListPurchasePrice,
  resolvePriceListRow,
} from '@/lib/inventory/pricing-engine';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';
import { toast, toastInvoiceSaveError, toastVersionConflict } from '@/lib/feedback/toast';
import { finishDocumentSave } from '@/lib/documents/finish-save';
import { invalidateStockViews } from '@/lib/invoices/invalidate-stock-views';
import { invalidateAfterTransactionSettingsSave } from '@/lib/inventory/transaction-settings-invalidate';
import { isOptimisticLockApiError } from '@/lib/concurrency/version-conflict';
import {
  postInvoiceAfterSave,
  useRepostAfterUnpost,
} from '@/lib/accounting/ensure-posted-after-save';
import { resolvePostedFlag } from '@/lib/documents/posting-trust';
import {
  DOCUMENT_NEW_LABEL,
  resolveDocumentLifecycleStatus,
} from '@/lib/documents/document-status-labels';
import type { ApiError } from '@/lib/api/types';
import { apiClient } from '@/lib/api/client';
import { confirmAction } from '@/lib/feedback/confirm';
import { retryIfNegativeStockConfirm } from '@/lib/invoices/purchase-unpost-negative-stock';
import { restoreCancelledDocument } from '@/lib/documents/restore-cancelled-document';
import { inventorySupplierInvoiceFormSchemaForStockPolicy } from '@/lib/validation/inventory.schema';
import { mapSalesFormToM5CreateBody, mapSalesFormToM5UpdateBody } from '@/lib/invoices/mapFormToM5Invoice';
import {
  invoiceJournalPreviewFromApi,
  useInvoiceJournalPreview,
} from '@/lib/invoices/invoice-journal-preview';
import {
  invoiceNetBelowPaymentConfirmMessage,
  invoiceHasLinkedCollections,
  invoiceNetCoversCollections,
  linkedInvoicePaidAmount,
  postedSettlementPaidTotal,
} from '@/lib/invoices/invoice-collected-guard';
import { invoicePaymentButtonDisabled } from '@/lib/invoices/invoice-payment-controls';
import {
  computeInvoiceFinancialSummary,
  computeInvoiceGrossDiscount,
  computeLineSubtotalAfterDiscount,
} from '@/lib/invoices/computeInvoiceFinancialSummary';
import { sumPartyInvoiceExtras } from '@/lib/invoices/invoice-adjustments';
import { useInvoiceExtras } from '@/lib/invoices/use-invoice-extras';
import { InvoiceExtrasPanel } from '@/components/inventory/invoices/InvoiceExtrasPanel';
import type { InvoiceAdjustmentApiRow, InvoiceExtraRow } from '@/lib/invoices/invoice-adjustments';
import { whtSettingsToLinePercent } from '@/lib/invoices/itemTracking';
import { useAccountingSettingsQuery } from '@/lib/hooks/useAccountingSettings';
import type { PurchaseInvoiceLine } from '@/components/inventory/ProgressivePurchaseInvoiceLineGrid';
import {
  ensureWithholdingColumns,
  mergeVisibleColumnIds,
} from '@/lib/invoices/invoiceLineColumns';
import { useVisibleColumnIds } from '@/lib/invoices/useVisibleColumnIds';
import { defaultUnitIdForItem, findDefaultPieceUnitId } from '@/lib/inventory/item-units';
import { invoiceLineVatRate, invoiceLineVatRateForItemId } from '@/lib/invoices/item-vat-rate';
import {
  parsePricingCalculationBasis,
  type PricingCalculationBasis,
} from '@/lib/invoices/unit-conversion';
import { inferDiscountTypeFromApi, inferDiscountValueFromApi } from '@/lib/invoices/discount-type';
import { useCompanyPrintProfile } from '@/lib/hooks/useCompanyPrintProfile';
import { useFirstCompany } from '@/lib/hooks/useFirstCompany';
import { ErpDocumentLayout } from '@/components/erp/ErpDocumentLayout';
import { PageDraftRestoreGate } from '@/components/erp/PageDraftRestoreGate';
import { ERP_INVOICE_DOCUMENT_LAYOUT_CLASS } from '@/components/erp/erpUiTokens';
import { PurchaseInvoicePageHeader } from '@/components/inventory/purchase-invoice/PurchaseInvoicePageHeader';
import { DocumentFollowUpButton } from '@/components/documents/DocumentFollowUpButton';
import { buildStockDocumentFollowUpHref } from '@/lib/documents/document-follow-up';
import { PurchaseInvoiceFormHeader } from '@/components/inventory/purchase-invoice/PurchaseInvoiceFormHeader';
import { InternalNotesScratchpad } from '@/components/documents/InternalNotesScratchpad';
import type { InternalNoteEntry, PaymentSplitLine } from '@/lib/invoices/payment-split.types';
import {
  cashTenderNeedsManualVoucherNumber,
  cashVoucherNumberRequiredMessage,
  resolveInvoicePaymentUi,
  splitsMatchTotal,
  summarizePaymentSplits,
  sumPaymentSplits,
  withCopiedCashVoucherNumbers,
  withOnAccountRemainder,
} from '@/lib/invoices/payment-split.types';
import type { AdvanceLinkAllocation } from '@/components/invoices/LinkAdvancePaymentModal';
import { postInvoiceSettlementSplits } from '@/lib/invoices/post-invoice-settlement-splits';
import { readInvoiceLineItemName } from '@/lib/invoices/stock-impact-line';
import {
  bankDraftFromSplits,
  buildCashTenderSplits,
  chequeDraftsFromSplits,
  emptyChequeDraft,
  inferCashTenderKind,
  resolveCashTenderKind,
  tenderPaidFromSplits,
  type CashTenderKind,
  type InvoiceChequeDraft,
} from '@/lib/invoices/cash-tender';
import {
  extractPaymentInstallments,
  installmentRowsFromApi,
  stripPaymentInstallmentsNote,
  type PaymentInstallmentRow,
} from '@/lib/invoices/payment-installments';
import { toHijriMedium } from '@/lib/dates/hijri';
import {
  invoiceCashPaidDisplayAmount,
  unwrapInvoiceCheques,
  type InvoiceCashSettlement,
  type InvoiceChequesPayload,
} from '@/lib/invoices/invoice-settlements';
import { PurchaseInvoiceBottomSplit } from '@/components/inventory/purchase-invoice/PurchaseInvoiceBottomSplit';
import { useDraftAutosave } from '@/lib/hooks/useDraftAutosave';
import {
  DocumentFormLock,
  DocumentModeProvider,
  DocumentReadOnlyBanner,
  useDocumentMode,
} from '@/components/common/document-shell';
import {
  mergeSourceNote,
  sourceLineToPurchaseRow,
  type SourceHydratePayload,
} from '@/lib/invoices/sourceDocument';
import {
  buildMultiSourceHydrateNote,
  combineSourceHydrateLines,
  type MultiStockPermitHydrateRequest,
} from '@/lib/invoices/multi-source-hydrate';
import {
  invoiceLineColumnsForStockPolicy,
  transactionAffectsStock,
} from '@/lib/transaction-settings/affect-stock';
import { consumeAiTransactionDraft } from '@/lib/ai/ai-draft-storage';
import { invoiceDateFromDraft, purchaseLinesFromAiDraft } from '@/lib/ai/hydrate-ai-draft';

const ProgressivePurchaseInvoiceLineGrid = dynamic(
  () =>
    import('@/components/inventory/ProgressivePurchaseInvoiceLineGrid').then((m) => ({
      default: m.ProgressivePurchaseInvoiceLineGrid,
    })),
  { ssr: false, loading: () => <LineGridSkeleton label="جاري تحميل بنود فاتورة المشتريات…" /> }
);

const InvoiceDocumentListDrawer = dynamic(
  () =>
    import('@/components/inventory/InvoiceDocumentListDrawer').then((m) => ({
      default: m.InvoiceDocumentListDrawer,
    })),
  { ssr: false, loading: () => <DynamicModalSkeleton label="جاري تحميل قائمة الفواتير…" /> }
);

const InvoiceCollectModal = dynamic(
  () =>
    import('@/components/inventory/sales-invoice/InvoiceCollectModal').then((m) => ({
      default: m.InvoiceCollectModal,
    })),
  { ssr: false, loading: () => <DynamicModalSkeleton label="جاري تحميل السداد…" /> }
);

const MultiPaymentSplitterModal = dynamic(
  () =>
    import('@/components/invoices/MultiPaymentSplitterModal').then((m) => ({
      default: m.MultiPaymentSplitterModal,
    })),
  { ssr: false, loading: () => <DynamicModalSkeleton label="جاري تحميل توزيع السداد…" /> }
);

const PaymentInstallmentsModal = dynamic(
  () =>
    import('@/components/invoices/PaymentInstallmentsModal').then((m) => ({
      default: m.PaymentInstallmentsModal,
    })),
  { ssr: false, loading: () => <DynamicModalSkeleton label="جاري تحميل توزيع الدفعات…" /> }
);

const LinkAdvancePaymentModal = dynamic(
  () =>
    import('@/components/invoices/LinkAdvancePaymentModal').then((m) => ({
      default: m.LinkAdvancePaymentModal,
    })),
  { ssr: false, loading: () => <DynamicModalSkeleton label="جاري تحميل الدفعات المقدمة…" /> }
);

interface Currency {
  id: string;
  code: string;
  arabicName: string;
}
interface Delegate {
  id: string;
  code: string;
  arabicName: string;
}
interface Item {
  id: string;
  code?: string;
  serial?: string;
  arabicName?: string;
  units?: {
    unitId?: string;
    isBaseUnit?: boolean;
    isFactorFixed?: boolean | null;
    conversionFactor?: number | string | null;
    unit?: { id: string };
  }[];
  defaultTaxPercent?: number | string | null;
  isTaxExempt?: boolean | null;
}

function normalizeLoadedLineWarehouseId(
  lineWarehouseId: string | null | undefined,
  headerWarehouseId: string | null | undefined
): string {
  const line = String(lineWarehouseId ?? '').trim();
  const header = String(headerWarehouseId ?? '').trim();
  if (!line) return '';
  if (header && line === header) return '';
  return line;
}

type PurchaseInvoiceDraft = {
  invoiceNumber: string;
  supplierRef: string;
  description: string;
  date: string;
  hijriDate: string;
  supplierId: string;
  warehouseId: string;
  costCenterId: string;
  delegateId: string;
  currencyId: string;
  paymentType: 'cash' | 'credit' | 'split';
  treasuryId: string;
  advancePaidAmount: number;
  advanceSafeId: string;
  pricingCalculationBasis: PricingCalculationBasis;
  invoiceLines: PurchaseInvoiceLine[];
  sourceType: string;
  sourceId: string;
  sourceNumber: string;
  paymentSplits: PaymentSplitLine[];
  paymentInstallments: PaymentInstallmentRow[];
  internalNotes: InternalNoteEntry[];
  isSalesTaxInvoice: boolean;
  applyWithholding?: boolean;
  cashTenderKind?: CashTenderKind;
  cashBankAccountId?: string;
  cashBankReference?: string;
  cashChequeRows?: InvoiceChequeDraft[];
  cashIssuingBankAccountId?: string;
  invoiceExtras?: InvoiceExtraRow[];
  extrasOpen?: boolean;
};

function isPurchaseInvoiceDraftEmpty(draft: PurchaseInvoiceDraft) {
  const hasLine = (draft.invoiceLines ?? []).some((line) => Boolean(line.itemId?.trim()));
  const hasNotes = (draft.internalNotes ?? []).some((note) => String(note.body ?? '').trim());
  return !draft.supplierId?.trim() && !draft.description?.trim() && !hasLine && !hasNotes;
}

function invoiceRemainingForCollect(inv: Record<string, unknown> | undefined): number | null {
  if (!inv) return null;
  const net = Number(inv.netAmount ?? inv.totalAmount ?? 0);
  const paid = Number(inv.paidAmount ?? 0);
  const r = net - paid;
  return r > 0 ? r : null;
}

export default function FinalPurchaseInvoicePage() {
  return (
    <DocumentModeProvider>
      <FinalPurchaseInvoicePageInner />
    </DocumentModeProvider>
  );
}

function FinalPurchaseInvoicePageInner() {
  const router = useRouter();
  const searchParams = useOwnTabSearchParams();
  const ownPathname = useOwnTabPathname();
  const { lockToView, setMode, unlockForEdit, isReadOnly } = useDocumentMode();
  const invalidateQuery = useInvalidateQuery();
  const { companyId } = useFirstCompany();
  const { data: txSettingsRes } = useApiQuery<TransactionSettings>(
    ['transaction-settings', 'PURCHASE_INVOICE'],
    '/transaction-settings/PURCHASE_INVOICE'
  );
  const { data: paymentVoucherSettingsRes } = useApiQuery<TransactionSettings>(
    ['transaction-settings', 'PAYMENT_VOUCHER'],
    '/transaction-settings/PAYMENT_VOUCHER'
  );
  const { data: accountingSettingsRes, isLoading: accountingSettingsLoading } =
    useAccountingSettingsQuery();
  const configuredWhtRate = whtSettingsToLinePercent(accountingSettingsRes?.data?.tax?.whtRate ?? 0.01);
  const [applyWithholding, setApplyWithholding] = useState(false);
  const defaultWhtRate = applyWithholding ? (configuredWhtRate > 0 ? configuredWhtRate : 1) : 0;
  
  const [isPosted, setIsPosted] = useState(false);
  const [isSalesTaxInvoice, setIsSalesTaxInvoice] = useState(true);
  const [showInvoiceList, setShowInvoiceList] = useState(false);
  const [bottomSplitTab, setBottomSplitTab] = useState('gl');
  const [linkAdvanceOpen, setLinkAdvanceOpen] = useState(false);
  const pendingAdvancesRef = useRef<AdvanceLinkAllocation[]>([]);
  const [pendingAdvanceTotal, setPendingAdvanceTotal] = useState(0);
  const [submitAttempt, setSubmitAttempt] = useState(0);
  
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [supplierRef, setSupplierRef] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [hijriDate, setHijriDate] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const { data: suppliersResponse } = useSuppliersQuery(500);
  const suppliers = useMemo(() => suppliersResponse?.data ?? [], [suppliersResponse?.data]);
  const selectedSupplier = useMemo(
    () => suppliers.find((row) => row.id === supplierId),
    [suppliers, supplierId]
  );
  const selectedSupplierPriceListId = selectedSupplier?.priceListId ?? null;
  const selectedSupplierPartyDiscount =
    (selectedSupplier as { discountType?: string | null })?.discountType ?? null;
  const [warehouseId, setWarehouseId] = useState('');
  const [costCenterId, setCostCenterId] = useState('');
  const [delegateId, setDelegateId] = useState('');
  const [currencyId, setCurrencyId] = useState('');
  const [exchangeRate, setExchangeRate] = useState(1);
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
  const [paymentType, setPaymentType] = useState<'cash' | 'credit' | 'split'>('credit');
  const [treasuryId, setTreasuryId] = useState('');
  const [advancePaidAmount, setAdvancePaidAmount] = useState(0);
  const [advanceSafeId, setAdvanceSafeId] = useState('');
  const [pricingCalculationBasis, setPricingCalculationBasis] =
    useState<PricingCalculationBasis>('SELECTED_UNIT_QTY');
  const [paymentSplits, setPaymentSplits] = useState<PaymentSplitLine[]>([]);
  const [cashTenderKind, setCashTenderKind] = useState<CashTenderKind>('treasury');
  const [cashBankAccountId, setCashBankAccountId] = useState('');
  const [cashBankReference, setCashBankReference] = useState('');
  const [cashChequeRows, setCashChequeRows] = useState<InvoiceChequeDraft[]>([emptyChequeDraft()]);
  const [cashIssuingBankAccountId, setCashIssuingBankAccountId] = useState('');
  const [cashChequeError, setCashChequeError] = useState('');
  const persistIntentRef = useRef<'save' | 'post'>('save');
  const [splitModalOpen, setSplitModalOpen] = useState(false);
  const [collectModalOpen, setCollectModalOpen] = useState(false);
  const [collectInstallment, setCollectInstallment] = useState<{ id: string; remaining: number } | null>(
    null
  );
  const [paymentInstallments, setPaymentInstallments] = useState<PaymentInstallmentRow[]>([]);
  const [installmentsModalOpen, setInstallmentsModalOpen] = useState(false);
  const [internalNotes, setInternalNotes] = useState<InternalNoteEntry[]>([]);
  const [invoiceLines, setInvoiceLines] = useState<PurchaseInvoiceLine[]>([]);
  const [sourceType, setSourceType] = useState('');
  const [sourceId, setSourceId] = useState('');
  const [sourceNumber, setSourceNumber] = useState('');
  const txSettings = txSettingsRes?.data;
  const cashPaymentNumberingManual = isTransactionSerialManual(
    paymentVoucherSettingsRes?.data?.numberingMode
  );
  const { markUnpostedForEdit, consumeShouldRepost, resetKeepPosted } = useRepostAfterUnpost(
    txSettings?.autoPostOnSave
  );
  const affectsStock = transactionAffectsStock(txSettings);
  const supplierInvoiceFormSchema = useMemo(
    () => inventorySupplierInvoiceFormSchemaForStockPolicy(affectsStock),
    [affectsStock]
  );
  const lockLoadedSource = shouldLockLoadedSource(txSettings, sourceId);
  const [storedColumnIds, setStoredColumnIds] = useVisibleColumnIds(
    'gates:columns:purchase-invoice',
    companyId
  );
  const visibleColumnIds = invoiceLineColumnsForStockPolicy(
    defaultWhtRate > 0 ? ensureWithholdingColumns(storedColumnIds) : storedColumnIds,
    affectsStock
  );
  const [error, setError] = useState('');
  const [restorePending, setRestorePending] = useState(false);
  const [success, setSuccess] = useState('');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(
    () => searchParams.get('invoiceId')?.trim() || null
  );
  const installmentFromUrl = searchParams.get('installment');
  const fromAiDraft = searchParams.get('fromAiDraft') === '1';
  const aiDraftAppliedRef = useRef(false);
  const installmentReminderOpenedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!selectedInvoiceId) {
      setMode('create');
      return;
    }
    if (isPosted) lockToView();
    else setMode('edit');
  }, [isPosted, lockToView, selectedInvoiceId, setMode]);

  useEffect(() => {
    const installmentParam = installmentFromUrl?.trim();
    if (!selectedInvoiceId || !installmentParam || !isPosted) return;
    const openKey = `${selectedInvoiceId}:${installmentParam}`;
    if (installmentReminderOpenedRef.current === openKey) return;

    void apiClient
      .get<{
        data?: Array<{
          id?: string;
          installmentNumber?: number;
          amount?: number;
          paidAmount?: number;
          remainingAmount?: number;
        }>;
      }>(`/invoices/${selectedInvoiceId}/installments`)
      .then((res) => {
        const rows = res.data?.data ?? [];
        const targetNum = Number(installmentParam);
        const row = rows.find(
          (r) =>
            String(r.installmentNumber) === installmentParam ||
            (Number.isFinite(targetNum) && r.installmentNumber === targetNum)
        );
        if (!row?.id) return;
        const remaining =
          Number(row.remainingAmount) ||
          Math.max(0, Number(row.amount) - Number(row.paidAmount ?? 0));
        installmentReminderOpenedRef.current = openKey;
        setBottomSplitTab('installments');
        setCollectInstallment({ id: row.id, remaining });
        setCollectModalOpen(true);
      })
      .catch(() => {});
  }, [selectedInvoiceId, installmentFromUrl, isPosted]);

  useEffect(() => {
    if (aiDraftAppliedRef.current || !fromAiDraft || selectedInvoiceId) return;
    const draft = consumeAiTransactionDraft('DRAFT_PURCHASE_INVOICE');
    if (!draft) return;
    aiDraftAppliedRef.current = true;
    const payload = draft.draftPayload;
    setSupplierId(String(payload.supplierId ?? ''));
    setWarehouseId(String(payload.warehouseId ?? ''));
    setDescription(typeof payload.description === 'string' ? payload.description : '');
    setDate(invoiceDateFromDraft(payload));
    setInvoiceLines(purchaseLinesFromAiDraft(payload));
    setPaymentType(payload.paymentMethod === 'cash' ? 'cash' : 'credit');
    const params = new URLSearchParams(searchParams.toString());
    params.delete('fromAiDraft');
    const qs = params.toString();
    router.replace(qs ? `${ownPathname}?${qs}` : ownPathname, { scroll: false });
  }, [fromAiDraft, ownPathname, router, searchParams, selectedInvoiceId]);

  const openInvoice = useCallback((id: string | null) => {
    setSelectedInvoiceId(id);
    const params = new URLSearchParams(searchParams.toString());
    if (id) params.set('invoiceId', id);
    else params.delete('invoiceId');
    const qs = params.toString();
    router.replace(qs ? `${ownPathname}?${qs}` : ownPathname, { scroll: false });
  }, [ownPathname, router, searchParams]);

  const draftSnapshot = useMemo(
    (): PurchaseInvoiceDraft => ({
      invoiceNumber,
      supplierRef,
      description,
      date,
      hijriDate,
      supplierId,
      warehouseId,
      costCenterId,
      delegateId,
      currencyId,
      paymentType,
      treasuryId,
      advancePaidAmount,
      advanceSafeId,
      pricingCalculationBasis,
      invoiceLines,
      sourceType,
      sourceId,
      sourceNumber,
      paymentSplits,
      paymentInstallments,
      internalNotes,
      isSalesTaxInvoice,
      applyWithholding,
      cashTenderKind,
      cashBankAccountId,
      cashBankReference,
      cashChequeRows,
      cashIssuingBankAccountId,
      invoiceExtras,
      extrasOpen,
    }),
    [
      invoiceNumber,
      supplierRef,
      description,
      date,
      hijriDate,
      supplierId,
      warehouseId,
      costCenterId,
      delegateId,
      currencyId,
      paymentType,
      treasuryId,
      advancePaidAmount,
      advanceSafeId,
      pricingCalculationBasis,
      invoiceLines,
      sourceType,
      sourceId,
      sourceNumber,
      paymentSplits,
      paymentInstallments,
      internalNotes,
      isSalesTaxInvoice,
      applyWithholding,
      cashTenderKind,
      cashBankAccountId,
      cashBankReference,
      cashChequeRows,
      cashIssuingBankAccountId,
      invoiceExtras,
      extrasOpen,
    ]
  );

  const applyPurchaseDraft = useCallback((payload: PurchaseInvoiceDraft) => {
    setInvoiceNumber(payload.invoiceNumber);
    setSupplierRef(payload.supplierRef);
    setDescription(payload.description);
    setDate(payload.date || new Date().toISOString().split('T')[0]);
    setHijriDate(payload.hijriDate);
    setSupplierId(payload.supplierId);
    setWarehouseId(payload.warehouseId);
    setCostCenterId(payload.costCenterId);
    setDelegateId(payload.delegateId);
    setCurrencyId(payload.currencyId);
    setPaymentType(payload.paymentType === 'credit' ? 'credit' : 'cash');
    setTreasuryId(payload.treasuryId ?? '');
    setAdvancePaidAmount(Number(payload.advancePaidAmount) || 0);
    setAdvanceSafeId(payload.advanceSafeId ?? '');
    setPricingCalculationBasis(parsePricingCalculationBasis(payload.pricingCalculationBasis));
    setInvoiceLines(payload.invoiceLines ?? []);
    setSourceType(payload.sourceType ?? '');
    setSourceId(payload.sourceId ?? '');
    setSourceNumber(payload.sourceNumber ?? '');
    setPaymentSplits(Array.isArray(payload.paymentSplits) ? payload.paymentSplits : []);
    setCashTenderKind(payload.cashTenderKind ?? inferCashTenderKind(payload.paymentSplits));
    setCashBankAccountId(payload.cashBankAccountId ?? bankDraftFromSplits(payload.paymentSplits).bankAccountId);
    setCashBankReference(payload.cashBankReference ?? bankDraftFromSplits(payload.paymentSplits).reference);
    setCashChequeRows(
      payload.cashChequeRows?.length ? payload.cashChequeRows : chequeDraftsFromSplits(payload.paymentSplits)
    );
    setCashIssuingBankAccountId(payload.cashIssuingBankAccountId ?? '');
    setCashChequeError('');
    setPaymentInstallments(Array.isArray(payload.paymentInstallments) ? payload.paymentInstallments : []);
    setInternalNotes(Array.isArray(payload.internalNotes) ? payload.internalNotes : []);
    setIsSalesTaxInvoice(payload.isSalesTaxInvoice !== false);
    setApplyWithholding(
      typeof payload.applyWithholding === 'boolean'
        ? payload.applyWithholding
        : (payload.invoiceLines ?? []).some(
            (line) => Number(line.withholdingTaxRate) > 0 || Number(line.withholdingTaxAmount) > 0
          )
    );
    setInvoiceExtras(Array.isArray(payload.invoiceExtras) ? payload.invoiceExtras : []);
    setExtrasOpen(Boolean(payload.extrasOpen) || (payload.invoiceExtras?.length ?? 0) > 0);
  }, [setExtrasOpen, setInvoiceExtras]);

  const skipServerHydrateRef = useRef(false);
  const hydratedPurchaseKeyRef = useRef('');
  const draftEnabled = !isPosted;
  const {
    lastSavedAt,
    restoreOffer,
    acceptRestore,
    dismissRestore,
    clearDraft,
  } = useDraftAutosave({
    documentType: 'purchase-invoice',
    mode: selectedInvoiceId ? 'edit' : 'new',
    documentId: selectedInvoiceId,
    value: draftSnapshot,
    enabled: draftEnabled,
    applyRestore: (payload) => {
      skipServerHydrateRef.current = true;
      applyPurchaseDraft(payload);
    },
    isEmpty: isPurchaseInvoiceDraftEmpty,
    restoreMessage: 'تم استعادة مسودة فاتورة المشتريات',
  });

  useEffect(() => {
    if (!restoreOffer || selectedInvoiceId) return;
    if (isPurchaseInvoiceDraftEmpty(restoreOffer as PurchaseInvoiceDraft)) dismissRestore();
  }, [restoreOffer, selectedInvoiceId, dismissRestore]);

  const { data: invoiceResponse } = useApiQuery<Record<string, unknown>>(
    ['invoice', selectedInvoiceId],
    `/invoices/${selectedInvoiceId}`,
    undefined,
    { enabled: !!selectedInvoiceId }
  );
  const selectedInvoice = invoiceResponse?.data;
  const invoiceJournalPreview = useMemo(
    () => invoiceJournalPreviewFromApi(selectedInvoice),
    [selectedInvoice]
  );
  const {
    journalOptions: invoiceJournalOptions,
    activeJournalId: activeInvoiceJournalId,
    activeJournalLabel: activeInvoiceJournalLabel,
    setActiveJournalId: setActiveInvoiceJournalId,
  } = useInvoiceJournalPreview(invoiceJournalPreview, 'purchase', selectedInvoiceId);
  const { profile: companyProfile } = useCompanyPrintProfile();

  const financialSummary = useMemo(() => {
    const summaryLines = invoiceLines.map((line) => ({
      quantity: line.quantity,
      baseQuantity: line.baseQuantity,
      unitPrice: line.unitPrice,
      discount: line.discountValue ?? line.discount,
      discountValue: line.discountValue ?? line.discount,
      discountType: line.discountType,
      taxRate: line.tax,
      withholdingTaxRate: line.withholdingTaxRate,
      withholdingTaxAmount: line.withholdingTaxAmount,
      withholdingAmountManual: line.withholdingAmountManual,
    }));
    const { gross, commercialDiscount } = computeInvoiceGrossDiscount(summaryLines, pricingCalculationBasis);
    const extrasNet = sumPartyInvoiceExtras(
      invoiceExtras,
      gross - commercialDiscount,
      exchangeRate > 0 ? exchangeRate : 1
    );
    return computeInvoiceFinancialSummary(summaryLines, {
      applyTax: isSalesTaxInvoice,
      withholdingTaxAmount: Number(selectedInvoice?.withholdingTaxAmount ?? 0),
      pricingCalculationBasis,
      additionsAndDiscounts: extrasNet,
    });
  }, [
    invoiceLines,
    isSalesTaxInvoice,
    pricingCalculationBasis,
    selectedInvoice?.withholdingTaxAmount,
    invoiceExtras,
    exchangeRate,
  ]);

  useEffect(() => {
    if (paymentType !== 'split') return;
    setPaymentSplits((prev) => withOnAccountRemainder(prev, financialSummary.netAmount));
  }, [paymentType, financialSummary.netAmount]);

  const { data: companySettingsRes } = useApiQuery<{ pricingCalculationBasis?: string }>(
    ['company-settings', companyId ?? 'none', 'pricing-basis'],
    `/companies/${companyId}/settings`,
    undefined,
    { enabled: Boolean(companyId) }
  );

  useEffect(() => {
    if (selectedInvoiceId) return;
    const fromCompany = parsePricingCalculationBasis(companySettingsRes?.data?.pricingCalculationBasis);
    setPricingCalculationBasis(fromCompany);
  }, [companySettingsRes?.data?.pricingCalculationBasis, selectedInvoiceId]);

  useEffect(() => {
    if (skipServerHydrateRef.current) {
      skipServerHydrateRef.current = false;
      return;
    }
    if (!selectedInvoice) {
      hydratedPurchaseKeyRef.current = '';
      return;
    }
    const savedPaidForHydrate = Number((selectedInvoice as { paidAmount?: number }).paidAmount ?? 0);
    const hydrateKey = `${String(selectedInvoice.id ?? '')}:${String(selectedInvoice.version ?? 0)}:${savedPaidForHydrate}`;
    if (hydratedPurchaseKeyRef.current === hydrateKey) return;
    hydratedPurchaseKeyRef.current = hydrateKey;
    setInvoiceNumber(String(selectedInvoice.invoiceNumber ?? ''));
    setDescription(String(selectedInvoice.description ?? ''));
    setDate(
      selectedInvoice.date
        ? new Date(String(selectedInvoice.date)).toISOString().split('T')[0]
        : ''
    );
    setHijriDate(String(selectedInvoice.hijriDate ?? ''));
    setSupplierId(String(selectedInvoice.supplierId ?? ''));
    setWarehouseId(String(selectedInvoice.warehouseId ?? ''));
    setSourceType(String((selectedInvoice as { sourceType?: string }).sourceType ?? ''));
    setSourceId(String((selectedInvoice as { sourceId?: string | null }).sourceId ?? ''));
    setSourceNumber(String((selectedInvoice as { sourceNumber?: string | null }).sourceNumber ?? ''));
    setCostCenterId(String(selectedInvoice.costCenterId ?? ''));
    setDelegateId(String(selectedInvoice.delegateId ?? ''));
    setCurrencyId(String(selectedInvoice.currencyId ?? ''));
    const loadedRate = Number((selectedInvoice as { exchangeRate?: number }).exchangeRate);
    if (loadedRate > 0) setExchangeRate(loadedRate);
    const rawSplits = (selectedInvoice as { paymentSplits?: PaymentSplitLine[] }).paymentSplits;
    const invoiceNet = Number(
      (selectedInvoice as { netAmount?: number }).netAmount ??
        (selectedInvoice as { totalAmount?: number }).totalAmount ??
        0
    );
    const loaded = resolveInvoicePaymentUi(
      (selectedInvoice as { paymentMethod?: string }).paymentMethod ??
        String(selectedInvoice.paymentType ?? ''),
      Array.isArray(rawSplits) ? rawSplits : [],
      invoiceNet
    );
    setPaymentType(loaded.method);
    setPaymentSplits(loaded.splits);
    const cashSplit = loaded.splits.find(
      (row): row is Extract<PaymentSplitLine, { type: 'CASH' }> => row.type === 'CASH'
    );
    const bankDraft = bankDraftFromSplits(loaded.splits);
    if (loaded.method === 'cash') {
      setCashTenderKind(inferCashTenderKind(loaded.splits));
      setTreasuryId(cashSplit?.safeId ?? '');
      setCashBankAccountId(bankDraft.bankAccountId);
      setCashBankReference(bankDraft.reference);
      setCashChequeRows(chequeDraftsFromSplits(loaded.splits));
      const firstCheque = loaded.splits.find(
        (row): row is Extract<PaymentSplitLine, { type: 'CHEQUE' }> => row.type === 'CHEQUE'
      );
      setCashIssuingBankAccountId(firstCheque?.bankAccountId ?? bankDraft.bankAccountId);
      setCashChequeError('');
      setAdvancePaidAmount(0);
      setAdvanceSafeId('');
    } else if (loaded.method === 'credit') {
      setCashTenderKind(inferCashTenderKind(loaded.splits));
      setAdvancePaidAmount(Math.max(savedPaidForHydrate, tenderPaidFromSplits(loaded.splits)));
      setAdvanceSafeId(cashSplit?.safeId ?? '');
      setTreasuryId(cashSplit?.safeId ?? '');
      setCashBankAccountId(bankDraft.bankAccountId);
      setCashBankReference(bankDraft.reference);
      setCashChequeRows(chequeDraftsFromSplits(loaded.splits));
      const firstCheque = loaded.splits.find(
        (row): row is Extract<PaymentSplitLine, { type: 'CHEQUE' }> => row.type === 'CHEQUE'
      );
      setCashIssuingBankAccountId(firstCheque?.bankAccountId ?? bankDraft.bankAccountId);
      setCashChequeError('');
    }
    const rawNotes = (selectedInvoice as { internalNotes?: InternalNoteEntry[] }).internalNotes;
    const notesList = Array.isArray(rawNotes) ? rawNotes : [];
    const apiInstallments = installmentRowsFromApi(
      (selectedInvoice as { installments?: unknown }).installments
    );
    setPaymentInstallments(
      apiInstallments.length ? apiInstallments : extractPaymentInstallments(notesList)
    );
    setInternalNotes(stripPaymentInstallmentsNote(notesList));
    loadAdjustments((selectedInvoice as { adjustments?: InvoiceAdjustmentApiRow[] }).adjustments);
    setIsPosted(resolvePostedFlag(selectedInvoice));
    setIsSalesTaxInvoice(selectedInvoice.isSalesTaxInvoice !== false);
    const loadedLines = selectedInvoice.lines as Record<string, unknown>[] | undefined;
    setApplyWithholding(
      Number(selectedInvoice.withholdingTaxAmount ?? 0) > 0 ||
        (loadedLines ?? []).some(
          (line) => Number(line.withholdingTaxRate ?? 0) > 0 || Number(line.withholdingTaxAmount ?? 0) > 0
        )
    );
    const loadedBasis = parsePricingCalculationBasis(
      (selectedInvoice as { pricingCalculationBasis?: string }).pricingCalculationBasis
    );
    setPricingCalculationBasis(loadedBasis);
    const lines = selectedInvoice.lines as Record<string, unknown>[] | undefined;
    if (lines) {
      setInvoiceLines(
        lines.map((line) => {
          const withholdingTaxRate = Number(line.withholdingTaxRate ?? 0) || 0;
          const withholdingTaxAmount = Number(line.withholdingTaxAmount ?? 0) || 0;
          const lineAfterDiscount = computeLineSubtotalAfterDiscount(
            {
              quantity: Number(line.quantity),
              baseQuantity: Number(line.baseQuantity ?? line.quantity),
              unitPrice: Number(line.price ?? line.unitPrice),
              discount: inferDiscountValueFromApi(line),
              discountValue: inferDiscountValueFromApi(line),
              discountType: inferDiscountTypeFromApi(line),
            },
            loadedBasis
          );
          const fromRate = withholdingTaxRate > 0 ? (lineAfterDiscount * withholdingTaxRate) / 100 : 0;
          const lineSources = Array.isArray(line.lineSources)
            ? (line.lineSources as Array<{ sourceKind?: string; sourceLineId?: string }>)
            : [];
          const goodsReceiptSource = lineSources.find((s) => s.sourceKind === 'GOODS_RECEIPT') ?? lineSources[0];
          return {
          itemId: String(line.itemId ?? ''),
          unitId: line.unitId ? String(line.unitId) : '',
          quantity: Number(line.quantity),
          baseQuantity: Number(line.baseQuantity ?? line.quantity),
          conversionFactor: Number(line.conversionFactor ?? 1) || 1,
          baseUnitId: line.baseUnitId ? String(line.baseUnitId) : '',
          unitPrice: Number(line.price ?? line.unitPrice),
          discount: inferDiscountValueFromApi(line),
          discountValue: inferDiscountValueFromApi(line),
          discountType: inferDiscountTypeFromApi(line),
          tax: Number(line.taxPercent ?? line.tax ?? 0),
          costCenterId: line.costCenterId ? String(line.costCenterId) : undefined,
          withholdingTaxRate,
          withholdingTaxAmount,
          withholdingAmountManual: withholdingTaxAmount > 0 && Math.abs(fromRate - withholdingTaxAmount) > 0.05,
          batchNumber: line.batchNumber ? String(line.batchNumber) : undefined,
          expiryDate: line.expiryDate ? String(line.expiryDate).slice(0, 10) : undefined,
          productionDate: line.productionDate ? String(line.productionDate).slice(0, 10) : undefined,
          serialNumbers: line.serialNumbers ? String(line.serialNumbers) : undefined,
          color: line.color ? String(line.color) : undefined,
          size: line.size ? String(line.size) : undefined,
          customRevenueAccountId: line.customRevenueAccountId
            ? String(line.customRevenueAccountId)
            : undefined,
          batchAllocations: Array.isArray(line.batchAllocations)
            ? (line.batchAllocations as Array<Record<string, unknown>>).map((alloc) => ({
                batchId: alloc.batchId ? String(alloc.batchId) : undefined,
                batchNumber: String(alloc.batchNumber ?? ''),
                qty: Number(alloc.qty) || 0,
                expiryDate: alloc.expiryDate ? String(alloc.expiryDate).slice(0, 10) : undefined,
              }))
            : undefined,
          lineNotes: line.notes ? String(line.notes) : line.lineNotes ? String(line.lineNotes) : undefined,
          warehouseId: normalizeLoadedLineWarehouseId(
            line.warehouseId != null ? String(line.warehouseId) : undefined,
            selectedInvoice.warehouseId != null ? String(selectedInvoice.warehouseId) : undefined
          ),
          ...(goodsReceiptSource?.sourceKind && goodsReceiptSource?.sourceLineId
            ? {
                sourceKind: goodsReceiptSource.sourceKind as PurchaseInvoiceLine['sourceKind'],
                sourceLineId: String(goodsReceiptSource.sourceLineId),
              }
            : {}),
          };
        })
      );
    }
  }, [selectedInvoice]);

  const whtSeededRef = useRef(false);
  useEffect(() => {
    if (whtSeededRef.current || !(defaultWhtRate > 0) || selectedInvoiceId) return;
    whtSeededRef.current = true;
    setInvoiceLines((lines) =>
      lines.map((line) => {
        if (!line.itemId || line.withholdingAmountManual) return line;
        if (Number(line.withholdingTaxRate) > 0 || Number(line.withholdingTaxAmount) > 0) return line;
        return { ...line, withholdingTaxRate: defaultWhtRate };
      })
    );
  }, [defaultWhtRate, selectedInvoiceId]);

  const { data: currenciesResponse, isLoading: currenciesLoading } = useApiQuery<Currency[]>(
    ['currencies'],
    '/accounting/currencies',
    { limit: 100, isActive: true }
  );
  const currencies = useMemo(() => currenciesResponse?.data ?? [], [currenciesResponse?.data]);

  const { data: delegatesResponse, isLoading: delegatesLoading } = useApiQuery<Delegate[]>(
    ['delegates'],
    '/accounting/delegates',
    { limit: 1000, isActive: true }
  );
  const delegates = delegatesResponse?.data || [];

  const { data: itemsResponse } = useApiQuery<Item[]>(
    ['items'],
    '/inventory/items',
    { limit: 1000, isActive: true }
  );
  const items = useMemo(() => itemsResponse?.data ?? [], [itemsResponse?.data]);
  const printInvoiceDocument = useMemo((): Record<string, unknown> | null => {
    const apiLines = Array.isArray((selectedInvoice as { lines?: unknown[] } | undefined)?.lines)
      ? ((selectedInvoice as { lines: unknown[] }).lines)
      : [];
    if (selectedInvoice && apiLines.length > 0) {
      return { ...selectedInvoice, invoiceKind: 'PURCHASE' } as Record<string, unknown>;
    }
    const lines = invoiceLines.filter((line) => line.itemId && Number(line.quantity) > 0);
    if (lines.length === 0) return null;
    return {
      invoiceKind: 'PURCHASE',
      invoiceNumber: invoiceNumber || DOCUMENT_NEW_LABEL,
      date: date || new Date().toISOString(),
      paymentType,
      isSalesTaxInvoice,
      supplier: selectedSupplier ? { arabicName: selectedSupplier.arabicName } : undefined,
      lines: lines.map((line) => {
        const it = items.find((item) => item.id === line.itemId);
        return {
          itemId: line.itemId,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          discount: line.discountValue ?? line.discount,
          discountValue: line.discountValue ?? line.discount,
          discountType: line.discountType,
          taxRate: line.tax,
          item: it
            ? { code: it.code, serial: it.serial, arabicName: it.arabicName }
            : undefined,
        };
      }),
    };
  }, [
    selectedInvoice,
    invoiceLines,
    invoiceNumber,
    date,
    paymentType,
    isSalesTaxInvoice,
    selectedSupplier,
    items,
  ]);
  const { data: unitsResponse } = useApiQuery<{ id: string; code?: string | null; arabicName?: string }[]>(
    ['units', 'invoice-fallback'],
    '/inventory/units',
    { limit: 200, isActive: true }
  );
  const fallbackUnitId = findDefaultPieceUnitId(unitsResponse?.data ?? []);

  const clipboardItems = useMemo(
    () =>
      items.map((i) => ({
        id: i.id,
        arabicName: (i as { arabicName?: string }).arabicName ?? '',
        serial: (i as { serial?: string }).serial,
      })),
    [items]
  );

  const applyPickedItemToLine = useCallback(
    (index: number, picked: { id: string; units?: { unitId?: string; isBaseUnit?: boolean; unit?: { id: string } }[]; itemPrices?: unknown[]; lastPurchasePrice?: number | string | null; averageCost?: number | string | null; defaultTaxPercent?: number | string | null; isTaxExempt?: boolean | null; barcode?: string; serial?: string; code?: string } | undefined) => {
      if (!picked) return;
      const unitId = defaultUnitIdForItem(picked);
      const priced = picked as {
        itemPrices?: import('@/lib/inventory/pricing-engine').PriceListPriceRow[];
        averageCost?: number | string | null;
        lastPurchasePrice?: number | string | null;
      };
      const listRow = resolvePriceListRow(priced, selectedSupplierPriceListId, unitId);
      let unitPrice = resolvePriceListPurchasePrice(priced, selectedSupplierPriceListId, unitId);
      if (unitPrice <= 0) {
        unitPrice =
          Number(priced.lastPurchasePrice ?? 0) > 0
            ? Number(priced.lastPurchasePrice)
            : Number(priced.averageCost ?? 0);
      }
      const discountPercent = combinedPriceListDiscountPercent(listRow, selectedSupplierPartyDiscount);
      setInvoiceLines((prev) => {
        const existing = prev[index];
        if (!existing) return prev;
        const next = [...prev];
        next[index] = {
          ...existing,
          itemId: picked.id,
          unitId,
          unitPrice: unitPrice > 0 ? unitPrice : existing.unitPrice,
          ...(discountPercent > 0
            ? {
                discountType: 'PERCENTAGE' as const,
                discountValue: discountPercent,
                discount: discountPercent,
              }
            : {}),
          tax: invoiceLineVatRate(picked, isSalesTaxInvoice),
        };
        return next;
      });
      void apiClient
        .get<{ unitPrice: number; discountPercent?: number }>(
          `/inventory/items/${picked.id}/pricing-policy`,
          {
            supplierId: supplierId || undefined,
            priceListId: selectedSupplierPriceListId || undefined,
            unitId,
            kind: 'purchase',
            policy: txSettingsRes?.data?.pricingPolicy,
          }
        )
        .then((res) => {
          const price = Number(res.data?.unitPrice ?? 0);
          const disc = Number(res.data?.discountPercent ?? 0);
          if (price <= 0 && disc <= 0) return;
          setInvoiceLines((prev) => {
            const existing = prev[index];
            if (!existing) return prev;
            const next = [...prev];
            next[index] = {
              ...existing,
              ...(price > 0 ? { unitPrice: price } : {}),
              ...(disc > 0
                ? { discountType: 'PERCENTAGE' as const, discountValue: disc, discount: disc }
                : {}),
            };
            return next;
          });
        })
        .catch(() => undefined);
    },
    [
      isSalesTaxInvoice,
      selectedSupplierPriceListId,
      selectedSupplierPartyDiscount,
      supplierId,
      txSettingsRes?.data?.pricingPolicy,
    ]
  );

  const handlePurchaseClipboardLines = useCallback(
    (lines: Array<{ itemId: string; quantity: number; unitPrice: number; discount: number }>) => {
      setInvoiceLines((prev) => [
        ...prev,
        ...lines.map((line) => ({
          itemId: line.itemId,
          unitId: defaultUnitIdForItem(items.find((x) => x.id === line.itemId) ?? { id: line.itemId, units: [] }),
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          discount: line.discount,
          discountValue: line.discount,
          discountType: 'PERCENTAGE',
          tax: invoiceLineVatRate(
            items.find((x) => x.id === line.itemId),
            isSalesTaxInvoice
          ),
          warehouseId: '',
        })),
      ]);
      setSuccess(`تم لصق ${lines.length} سطر`);
    },
    [items, isSalesTaxInvoice]
  );

  const handleSourceHydrate = useCallback((payload: SourceHydratePayload) => {
    if (payload.supplierId) setSupplierId(payload.supplierId);
    if (payload.warehouseId) setWarehouseId(payload.warehouseId);
    if (payload.costCenterId) setCostCenterId(payload.costCenterId);
    if (payload.currencyId) setCurrencyId(payload.currencyId);
    if (payload.delegateId) setDelegateId(payload.delegateId);
    setSourceType(payload.sourceType);
    setSourceId(payload.sourceId);
    setSourceNumber(payload.sourceNumber);
    setDescription((prev) => mergeSourceNote(prev, payload.notes));
    setInvoiceLines(
      payload.lines.map((line) => {
        const row = sourceLineToPurchaseRow(line, payload.warehouseId || warehouseId);
        return Number(row.tax) > 0
          ? row
          : { ...row, tax: invoiceLineVatRateForItemId(items, row.itemId, isSalesTaxInvoice) };
      })
    );
    loadAdjustments(payload.adjustments);
    setSuccess(`تم تعبئة الفاتورة من ${payload.sourceNumber}`);
  }, [isSalesTaxInvoice, items, loadAdjustments, warehouseId]);

  const handleMultiStockPermitHydrate = useCallback(
    ({ payloads, lineMode, replaceExisting }: MultiStockPermitHydrateRequest) => {
      const first = payloads[0];
      if (first.supplierId) setSupplierId(first.supplierId);
      if (first.warehouseId) setWarehouseId(first.warehouseId);
      if (first.costCenterId) setCostCenterId(first.costCenterId);
      if (first.currencyId) setCurrencyId(first.currencyId);
      if (first.delegateId) setDelegateId(first.delegateId);
      setSourceType(first.sourceType);
      setSourceId(first.sourceId);
      setSourceNumber(first.sourceNumber);
      setDescription((prev) => mergeSourceNote(prev, buildMultiSourceHydrateNote(payloads)));

      const wh = first.warehouseId || warehouseId;
      const combined = combineSourceHydrateLines(
        payloads.map((p) => p.lines),
        lineMode
      );
      const newRows = combined.map((line) => {
        const row = sourceLineToPurchaseRow(line, wh);
        return Number(row.tax) > 0
          ? row
          : { ...row, tax: invoiceLineVatRateForItemId(items, row.itemId, isSalesTaxInvoice) };
      });
      const current = invoiceLines.filter((line) => Boolean(line.itemId));
      setInvoiceLines(replaceExisting ? newRows : [...current, ...newRows]);
      setSuccess(`تم تحميل ${payloads.length} مستند على الفاتورة`);
    },
    [invoiceLines, isSalesTaxInvoice, items, warehouseId]
  );

  const handleNew = useCallback(() => {
    openInvoice(null);
    setInvoiceNumber('');
    setSupplierRef('');
    setDescription('');
    setInvoiceLines([]);
    setSourceType('');
    setSourceId('');
    setSourceNumber('');
    setSupplierId('');
    setWarehouseId('');
    setCostCenterId('');
    setDelegateId('');
    setError('');
    setSuccess('');
    setIsPosted(false);
    resetKeepPosted();
    const today = new Date().toISOString().split('T')[0];
    setDate(today);
    setPaymentType('credit');
    pendingAdvancesRef.current = [];
    setPendingAdvanceTotal(0);
    setTreasuryId('');
    setCashTenderKind('treasury');
    setCashBankAccountId('');
    setCashBankReference('');
    setCashChequeRows([emptyChequeDraft()]);
    setCashIssuingBankAccountId('');
    setCashChequeError('');
    setAdvancePaidAmount(0);
    setAdvanceSafeId('');
    setPaymentSplits([]);
    setPaymentInstallments([]);
    setInternalNotes([]);
    setIsSalesTaxInvoice(txSettingsRes?.data?.autoApplyVat !== false);
    setApplyWithholding(
      txSettingsRes?.data?.autoApplyWht === true ||
        accountingSettingsRes?.data?.tax?.applyWithholding === true
    );
    setPricingCalculationBasis(
      parsePricingCalculationBasis(companySettingsRes?.data?.pricingCalculationBasis)
    );
    resetExtras();
    clearDraft();
  }, [clearDraft, companySettingsRes?.data?.pricingCalculationBasis, openInvoice, resetExtras, resetKeepPosted, txSettingsRes?.data?.autoApplyVat]);

  const invoiceMutation = useApiMutation<{ id?: string; invoiceNumber?: string }, Record<string, unknown>>(
    '/invoices',
    'POST',
    {
      showSuccessToast: false,
      onSuccess: (res) => {
        persistIntentRef.current = 'save';
        clearDraft();
        invalidateStockViews(invalidateQuery);
        const savedId = res.data?.id;
        const alreadyPosted = Boolean((res.data as { isPosted?: boolean } | undefined)?.isPosted);
        if (res.message && !alreadyPosted) setError(res.message);
        const held = pendingAdvancesRef.current;
        pendingAdvancesRef.current = [];
        setPendingAdvanceTotal(0);
        if (savedId && held.length) {
          void apiClient.post(`/invoices/${savedId}/link-advances`, { allocations: held }).catch((error: unknown) => {
            setError(error instanceof Error ? error.message : 'تعذر ربط الدفعة المقدمة بعد الحفظ');
          });
        }
        const autoPrintIfEnabled = () => {
          if (txSettings?.autoPrintOnSave) dispatchAutoPrintAfterSave();
        };
        const finishCreate = (posted: boolean) => {
          autoPrintIfEnabled();
          finishDocumentSave({
            label: 'فاتورة مشتريات',
            number: res.data?.invoiceNumber || invoiceNumber,
            posted,
            savedId: res.data?.id,
            onOpen: (saved) => openInvoice(saved),
            reset: handleNew,
          });
        };
        if (savedId && !alreadyPosted && txSettings?.autoPostOnSave) {
          void postInvoiceAfterSave(savedId)
            .then(() => finishCreate(true))
            .catch((error: ApiError) => {
              setError(error.message || 'تم الحفظ وتعذر الترحيل');
              finishCreate(false);
            });
          return;
        }
        finishCreate(alreadyPosted);
      },
      onError: (err) => {
        setError(err.message || 'حدث خطأ أثناء الحفظ');
        toastInvoiceSaveError(err.message || 'حدث خطأ أثناء الحفظ');
      },
    }
  );

  const invoiceUpdateMutation = useApiMutation<unknown, Record<string, unknown>>(
    selectedInvoiceId ? `/invoices/${selectedInvoiceId}` : '/invoices',
    'PUT',
    {
      showSuccessToast: false,
      onSuccess: () => {
        invalidateStockViews(invalidateQuery);
        const id = selectedInvoiceId;
        const shouldPostNow = persistIntentRef.current === 'post';
        persistIntentRef.current = 'save';
        const autoPrintIfEnabled = () => {
          if (txSettings?.autoPrintOnSave) dispatchAutoPrintAfterSave();
        };
        if (shouldPostNow && id) {
          consumeShouldRepost();
          postInvoiceMutation.mutate({});
          invalidateQuery(['invoice', id]);
          autoPrintIfEnabled();
          return;
        }
        if (consumeShouldRepost() && id) {
          void postInvoiceAfterSave(id)
            .then(() => {
              autoPrintIfEnabled();
              finishDocumentSave({
                label: 'فاتورة مشتريات',
                number: invoiceNumber,
                posted: true,
                cleared: false,
                savedId: id,
                clearDraft,
                onOpen: (saved) => openInvoice(saved),
                reset: handleNew,
              });
            })
            .catch((err: ApiError) => {
              setError(err.message || 'تم الحفظ لكن تعذر ترحيل الفاتورة');
              autoPrintIfEnabled();
              finishDocumentSave({
                label: 'فاتورة مشتريات',
                number: invoiceNumber,
                posted: false,
                savedId: id,
                clearDraft,
                onOpen: (saved) => openInvoice(saved),
                onSavedOpen: (saved) => invalidateQuery(['invoice', saved]),
                reset: handleNew,
              });
            });
          return;
        }
        autoPrintIfEnabled();
        finishDocumentSave({
          label: 'فاتورة مشتريات',
          number: invoiceNumber,
          posted: false,
          savedId: id,
          clearDraft,
          onOpen: (saved) => openInvoice(saved),
          onSavedOpen: (saved) => invalidateQuery(['invoice', saved]),
          reset: handleNew,
        });
      },
      onError: (err) => {
        persistIntentRef.current = 'save';
        if (isOptimisticLockApiError(err)) {
          toastVersionConflict(err.message, () => invalidateQuery(['invoice', selectedInvoiceId]));
          return;
        }
        setError(err.message || 'حدث خطأ أثناء التحديث');
        toastInvoiceSaveError(err.message || 'حدث خطأ أثناء التحديث');
      },
    }
  );

  const invoiceCancelMutation = useApiMutation<unknown, Record<string, unknown>>(
    selectedInvoiceId ? `/invoices/${selectedInvoiceId}/cancel` : '/invoices',
    'POST',
    {
      showSuccessToast: false,
      onSuccess: () => {
        toast.success('تم إلغاء الفاتورة');
        invalidateQuery(['invoice', selectedInvoiceId]);
        invalidateStockViews(invalidateQuery);
        setIsPosted(false);
      },
      onError: (err: ApiError) => {
        toast.error('تعذر إلغاء الفاتورة', { description: err.message });
      },
    }
  );

  const postInvoiceMutation = useApiMutation<unknown, Record<string, unknown>>(
    `/invoices/${selectedInvoiceId || '_'}/post`,
    'POST',
    {
      onSuccess: () => {
        setSuccess('تم ترحيل فاتورة المشتريات بنجاح');
        setIsPosted(true);
        invalidateStockViews(invalidateQuery);
        invalidateQuery(['journal-entry']);
        if (activeInvoiceJournalId) invalidateQuery(['journal-entry', activeInvoiceJournalId]);
      },
      onError: (err, variables) => {
        if (
          retryIfNegativeStockConfirm(
            err,
            variables,
            (body) => postInvoiceMutation.mutate(body),
            'confirmNegativeStockPost'
          )
        ) {
          return;
        }
        setIsPosted(false);
        setError(err.message || 'حدث خطأ أثناء الترحيل');
      },
    }
  );

  const unpostInvoiceMutation = useApiMutation<unknown, Record<string, unknown>>(
    `/invoices/${selectedInvoiceId || '_'}/unpost`,
    'POST',
    {
      onSuccess: () => {
        setSuccess('تم فك ترحيل فاتورة المشتريات بنجاح');
        setIsPosted(false);
        markUnpostedForEdit();
        invalidateStockViews(invalidateQuery);
        invalidateQuery(['journal-entry']);
        if (activeInvoiceJournalId) invalidateQuery(['journal-entry', activeInvoiceJournalId]);
      },
      onError: (err, variables) => {
        if (
          retryIfNegativeStockConfirm(err, variables, (body) =>
            unpostInvoiceMutation.mutate(body)
          )
        ) {
          return;
        }
        setError(err.message || 'حدث خطأ');
      },
    }
  );

  const unapproveInvoiceMutation = useApiMutation<unknown, Record<string, unknown>>(
    selectedInvoiceId ? `/invoices/${selectedInvoiceId}/unapprove` : '/invoices',
    'POST',
    {
      onSuccess: () => {
        setSuccess('تم إلغاء اعتماد الفاتورة');
        invalidateQuery(['invoices']);
        invalidateQuery(['invoice', selectedInvoiceId]);
      },
      onError: (err) => setError(err.message || 'تعذر إلغاء الاعتماد'),
    }
  );

  const { data: safesResponse } = useApiQuery<
    Array<{ id: string; arabicName?: string; code?: string | null; isDefault?: boolean }>
  >(['safes', 'settlement'], '/accounting/safes', { page: 1, limit: 50 });
  const defaultSafeId = pickDefaultSafeId(safesResponse?.data);

  const { data: settlementsResponse } = useApiQuery<InvoiceCashSettlement[]>(
    ['invoice-settlements', selectedInvoiceId],
    `/invoices/${selectedInvoiceId}/settlements`,
    undefined,
    { enabled: !!selectedInvoiceId }
  );
  const { data: settlementHistoryResponse } = useApiQuery<InvoiceCashSettlement[]>(
    ['invoice-settlements-history', selectedInvoiceId],
    `/invoices/${selectedInvoiceId}/settlements/history`,
    undefined,
    { enabled: !!selectedInvoiceId }
  );
  const { data: chequesResponse } = useApiQuery<InvoiceChequesPayload>(
    ['invoice-settlements-cheques', selectedInvoiceId],
    `/invoices/${selectedInvoiceId}/settlements/cheques`,
    undefined,
    { enabled: !!selectedInvoiceId }
  );
  const settlements = settlementsResponse?.data || [];
  const settlementHistory = settlementHistoryResponse?.data || [];
  const { cheques: settlementCheques } = unwrapInvoiceCheques(chequesResponse?.data);

  const purchaseVatDefaultApplied = useRef(false);
  useEffect(() => {
    if (selectedInvoiceId) return;
    const settings = txSettingsRes?.data;
    if (
      transactionAffectsStock(settings) &&
      settings?.defaultWarehouseId &&
      !warehouseId
    ) {
      setWarehouseId(settings.defaultWarehouseId);
    }
    if (settings?.defaultCostCenterId && !costCenterId) {
      setCostCenterId(settings.defaultCostCenterId);
    }
  }, [selectedInvoiceId, txSettingsRes?.data, warehouseId, costCenterId]);

  useEffect(() => {
    if (purchaseVatDefaultApplied.current || selectedInvoiceId) return;
    const settings = txSettingsRes?.data;
    if (!settings) return;
    purchaseVatDefaultApplied.current = true;
    const enabled = settings.autoApplyVat !== false;
    setIsSalesTaxInvoice(enabled);
    setInvoiceLines((lines) =>
      lines.map((line) => ({
        ...line,
        tax: invoiceLineVatRateForItemId(items, line.itemId, enabled),
      }))
    );
  }, [selectedInvoiceId, txSettingsRes?.data]);

  const purchaseWhtDefaultApplied = useRef(false);
  useEffect(() => {
    if (purchaseWhtDefaultApplied.current || selectedInvoiceId) return;
    if (!txSettingsRes?.data || accountingSettingsLoading) return;
    purchaseWhtDefaultApplied.current = true;
    setApplyWithholding(
      txSettingsRes.data.autoApplyWht === true ||
        accountingSettingsRes?.data?.tax?.applyWithholding === true
    );
  }, [accountingSettingsLoading, accountingSettingsRes?.data, selectedInvoiceId, txSettingsRes?.data]);

  const handlePurchaseTaxChange = useCallback((enabled: boolean) => {
    setIsSalesTaxInvoice(enabled);
    setInvoiceLines((lines) =>
      lines.map((line) => ({
        ...line,
        tax: invoiceLineVatRateForItemId(items, line.itemId, enabled),
      }))
    );
  }, [items]);

  const handlePurchaseWithholdingChange = useCallback(
    (enabled: boolean) => {
      setApplyWithholding(enabled);
      const rate = enabled ? (configuredWhtRate > 0 ? configuredWhtRate : 1) : 0;
      setInvoiceLines((lines) =>
        lines.map((line) => {
          if (!enabled) {
            return {
              ...line,
              withholdingTaxRate: 0,
              withholdingTaxAmount: 0,
              withholdingAmountManual: false,
            };
          }
          if (line.withholdingAmountManual || Number(line.withholdingTaxRate) > 0) return line;
          return { ...line, withholdingTaxRate: rate };
        })
      );
    },
    [configuredWhtRate]
  );

  useEffect(() => {
    if (paymentType !== 'cash') return;
    const resolved = resolveCashTenderKind(cashTenderKind, cashBankAccountId, cashChequeRows);
    if (resolved !== cashTenderKind) setCashTenderKind(resolved);
    if (resolved !== 'treasury') return;
    if (!treasuryId && defaultSafeId) setTreasuryId(defaultSafeId);
  }, [paymentType, cashTenderKind, cashBankAccountId, cashChequeRows, treasuryId, defaultSafeId]);

  useEffect(() => {
    if (paymentType !== 'credit') return;
    if (!advanceSafeId && (treasuryId || defaultSafeId)) {
      setAdvanceSafeId(treasuryId || defaultSafeId);
    }
  }, [paymentType, advanceSafeId, treasuryId, defaultSafeId]);

  const collectPaymentMutation = useApiMutation<unknown, Record<string, unknown>>(
    selectedInvoiceId ? `/invoices/${selectedInvoiceId}/settlements` : '/invoices',
    'POST',
    {
      onSuccess: () => {
        setSuccess('تم تسجيل الدفع بنجاح');
        setCollectModalOpen(false);
        setCollectInstallment(null);
        invalidateQuery(['invoice', selectedInvoiceId]);
        invalidateQuery(['invoice-settlements', selectedInvoiceId]);
        invalidateQuery(['invoice-settlements-history', selectedInvoiceId]);
        invalidateQuery(['invoice-settlements-cheques', selectedInvoiceId]);
        invalidateQuery(['invoice-installments', selectedInvoiceId]);
      },
      onError: (err) => setError(err.message || 'حدث خطأ أثناء الدفع'),
    }
  );

  const loading =
    invoiceMutation.isPending ||
    invoiceUpdateMutation.isPending ||
    invoiceCancelMutation.isPending;
  const financialBusy =
    loading || postInvoiceMutation.isPending || unpostInvoiceMutation.isPending;

  const filledInvoiceLines = invoiceLines.filter((line) => Boolean(line.itemId?.trim()));

  const validatePurchasePayment = (): boolean => {
    const cashKind = resolveCashTenderKind(cashTenderKind, cashBankAccountId, cashChequeRows);
    if (paymentType === 'split') {
      const splitLines = withOnAccountRemainder(paymentSplits, financialSummary.netAmount);
      if (!splitsMatchTotal(splitLines, financialSummary.netAmount)) {
        setError('وزّع الدفع المتعدد ليطابق إجمالي الفاتورة');
        toast.error('وزّع الدفع المتعدد ليطابق إجمالي الفاتورة');
        setSplitModalOpen(true);
        return false;
      }
      return true;
    }
    if (paymentType === 'cash' || paymentType === 'credit') {
      const cashTreasury = String(treasuryId || defaultSafeId || '').trim();
      const creditSafe = String(advanceSafeId || cashTreasury || '').trim();
      const paidNow = Number(advancePaidAmount) || 0;
      const invoiceNet = financialSummary.netAmount;
      const partialCash = paymentType === 'cash' && paidNow > 0.009 && paidNow + 0.009 < invoiceNet;
      const cashBuilt = buildCashTenderSplits({
        kind: cashKind,
        netAmount: invoiceNet,
        treasuryId: paymentType === 'credit' ? creditSafe : cashTreasury,
        bankAccountId: cashBankAccountId,
        bankReference: cashBankReference,
        cheques: cashChequeRows,
        issuingBankAccountId: cashIssuingBankAccountId,
        direction: 'PAYMENT',
        mode: paymentType === 'credit' || partialCash ? 'advance' : 'full',
        paidAmount: paidNow,
      });
      if (cashBuilt.error) {
        setCashChequeError(cashBuilt.error);
        setError(cashBuilt.error);
        toast.error(cashBuilt.error);
        return false;
      }
      setCashChequeError('');
    }
    return true;
  };

  const handlePostInvoice = () => {
    if (financialBusy) return;
    if (!selectedInvoiceId) {
      setError('احفظ الفاتورة أولاً');
      return;
    }
    if (!validatePurchasePayment()) return;
    persistIntentRef.current = 'post';
    handleSaveDraft();
  };

  const handleSaveDraft = () => {
    if (financialBusy || isPosted) {
      persistIntentRef.current = 'save';
      return;
    }
    setSubmitAttempt((n) => n + 1);
    setError('');
    setSuccess('');
    const parsed = supplierInvoiceFormSchema.safeParse({
      serialNumber: invoiceNumber,
      description: supplierRef ? `${supplierRef} — ${description}` : description,
      date: date || new Date().toISOString(),
      hijriDate,
      warehouseId,
      supplierId,
      isPosted: false,
      isApproved: false,
      useBarcode: false,
      hideExistingQty: false,
      lines: filledInvoiceLines.map((line) => ({
        itemId: line.itemId,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        discount: line.discount ?? 0,
        tax: line.tax ?? 0,
      })),
    });
    if (!parsed.success) {
      persistIntentRef.current = 'save';
      const message = parsed.error.issues[0]?.message ?? 'خطأ في البيانات';
      setError(message);
      toastInvoiceSaveError(message);
      return;
    }
    const d = parsed.data;
    const resolvedMethod = paymentType;
    const savedPaidEarly = linkedInvoicePaidAmount(
      Number((selectedInvoice as { paidAmount?: number } | undefined)?.paidAmount ?? 0),
      postedSettlementPaidTotal(settlements)
    );
    const lockPaymentTenders = invoiceHasLinkedCollections(savedPaidEarly);
    if (!lockPaymentTenders && !validatePurchasePayment()) {
      persistIntentRef.current = 'save';
      return;
    }
    const extrasValidation = validateExtras();
    if (extrasValidation) {
      persistIntentRef.current = 'save';
      setError(extrasValidation);
      toastInvoiceSaveError(extrasValidation);
      setExtrasOpen(true);
      return;
    }
    const cashTreasury = String(treasuryId || defaultSafeId || '').trim();
    const creditSafe = String(advanceSafeId || cashTreasury || '').trim();
    const creditPaid = Number(advancePaidAmount) || 0;
    const cashKind = resolveCashTenderKind(cashTenderKind, cashBankAccountId, cashChequeRows);
    const invoiceNet = financialSummary.netAmount;
    const partialCash =
      resolvedMethod === 'cash' && creditPaid > 0.009 && creditPaid + 0.009 < invoiceNet;
    const cashBuilt =
      !lockPaymentTenders && (resolvedMethod === 'cash' || resolvedMethod === 'credit')
        ? buildCashTenderSplits({
            kind: cashKind,
            netAmount: invoiceNet,
            treasuryId: resolvedMethod === 'credit' ? creditSafe : cashTreasury,
            bankAccountId: cashBankAccountId,
            bankReference: cashBankReference,
            cheques: cashChequeRows,
            issuingBankAccountId: cashIssuingBankAccountId,
            direction: 'PAYMENT',
            mode: resolvedMethod === 'credit' || partialCash ? 'advance' : 'full',
            paidAmount: creditPaid,
          })
        : {};
    const splitLines =
      resolvedMethod === 'split'
        ? withOnAccountRemainder(paymentSplits, financialSummary.netAmount)
        : undefined;
    const cashTreasurySplits =
      resolvedMethod === 'cash'
        ? withCopiedCashVoucherNumbers(cashBuilt.splits, paymentSplits)
        : undefined;
    const creditSplits =
      resolvedMethod === 'credit'
        ? withCopiedCashVoucherNumbers(cashBuilt.splits, paymentSplits)
        : undefined;
    const outgoingSplits =
      resolvedMethod === 'split'
        ? splitLines
        : resolvedMethod === 'credit'
          ? creditSplits
          : cashTreasurySplits;
    if (
      !lockPaymentTenders &&
      cashTenderNeedsManualVoucherNumber(outgoingSplits, cashPaymentNumberingManual)
    ) {
      persistIntentRef.current = 'save';
      const message = cashVoucherNumberRequiredMessage('PAYMENT');
      setError(message);
      toast.error(message);
      setSplitModalOpen(true);
      return;
    }
    const formData = {
      invoiceNumber: d.serialNumber,
      description: d.description,
      date: d.date || new Date().toISOString(),
      hijriDate: d.hijriDate,
      supplierId: d.supplierId,
      warehouseId: affectsStock ? d.warehouseId : d.warehouseId || undefined,
      costCenterId: costCenterId || undefined,
      delegateId: delegateId || undefined,
      currencyId: currencyId || undefined,
      exchangeRate: exchangeRate > 0 ? exchangeRate : 1,
      sourceType: sourceType && sourceType !== 'NONE' ? sourceType : 'NONE',
      sourceId: sourceId || undefined,
      sourceNumber: sourceNumber || undefined,
      paymentMethod: resolvedMethod,
      pricingCalculationBasis,
      paymentSplits: outgoingSplits,
      internalNotes,
      installments: paymentInstallments.map((row) => ({
        installmentNumber: row.number,
        dueDate: row.dueDate,
        hijriDueDate: toHijriMedium(row.dueDate),
        amount: row.amount,
      })),
      lines: filledInvoiceLines.map((line) => ({
        itemId: line.itemId,
        unitId: line.unitId,
        quantity: line.quantity,
        baseQuantity: line.baseQuantity,
        conversionFactor: line.conversionFactor,
        baseUnitId: line.baseUnitId,
        unitPrice: line.unitPrice,
        discount: line.discountValue ?? line.discount ?? 0,
        discountValue: line.discountValue ?? line.discount ?? 0,
        discountType: line.discountType,
        taxRate: line.tax ?? 0,
        warehouseId: affectsStock ? line.warehouseId || d.warehouseId : undefined,
        costCenterId: line.costCenterId,
        withholdingTaxRate: line.withholdingTaxRate,
        withholdingTaxAmount: line.withholdingTaxAmount,
        withholdingAmountManual: line.withholdingAmountManual,
        batchNumber: line.batchNumber,
        expiryDate: line.expiryDate,
        productionDate: line.productionDate,
        serialNumbers: line.serialNumbers,
        lineNotes: line.lineNotes,
        batchAllocations: line.batchAllocations,
        color: line.color,
        size: line.size,
        customRevenueAccountId: line.customRevenueAccountId,
        ...(line.sourceKind && line.sourceLineId
          ? { sourceKind: line.sourceKind, sourceLineId: line.sourceLineId }
          : {}),
      })),
      adjustments: getExtrasPayload(),
    };
    const mapOpts = {
      invoiceKind: 'PURCHASE' as const,
      currencies,
      items,
      applyTax: isSalesTaxInvoice,
      fallbackUnitId,
    };
    try {
      const persistUpdate = (confirmNetBelowCollections?: boolean) => {
        if (selectedInvoiceId) {
          invoiceUpdateMutation.mutate(
            mapSalesFormToM5UpdateBody(formData, {
              ...mapOpts,
              expectedVersion:
                typeof selectedInvoice?.version === 'number' ? selectedInvoice.version : undefined,
              lockPaymentTenders,
              confirmNetBelowCollections,
            })
          );
          return;
        }
        invoiceMutation.mutate(mapSalesFormToM5CreateBody(formData, mapOpts));
      };
      const needsNetConfirm =
        selectedInvoiceId &&
        lockPaymentTenders &&
        !invoiceNetCoversCollections(invoiceNet, savedPaidEarly);
      persistUpdate(needsNetConfirm ? true : undefined);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'تعذر تجهيز الفاتورة';
      setError(message);
      toastInvoiceSaveError(message);
    }
  };

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    setDate(today);
  }, []);

  useEffect(() => {
    if (currencies.length > 0 && !currencyId) {
      const defaultCurrency = currencies.find((c) => c.code === 'EGP') || currencies[0];
      setCurrencyId(defaultCurrency.id);
    }
  }, [currencies, currencyId]);

  const formErrors = useMemo(() => {
    if (submitAttempt === 0) return {};
    const parsed = supplierInvoiceFormSchema.safeParse({
      serialNumber: invoiceNumber,
      description: supplierRef ? `${supplierRef} — ${description}` : description,
      date,
      warehouseId,
      supplierId,
      lines: filledInvoiceLines,
    });
    const map: Record<string, string> = {};
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const path = issue.path[0];
        if (path === 'supplierId') map.supplierId = issue.message;
        if (path === 'warehouseId') map.warehouseId = issue.message;
        if (path === 'date') map.date = issue.message;
      }
    }
    const resolvedCashKind = resolveCashTenderKind(cashTenderKind, cashBankAccountId, cashChequeRows);
    if (paymentType === 'cash') {
      if (resolvedCashKind === 'treasury' && !String(treasuryId || defaultSafeId || '').trim()) {
        map.treasuryId = 'يجب تحديد الخزينة في الفاتورة النقدية';
      }
      if (resolvedCashKind === 'bank' && !String(cashBankAccountId || '').trim()) {
        map.cashBankAccountId = 'يجب تحديد الحساب البنكي في الفاتورة النقدية';
      }
      if (resolvedCashKind === 'cheques') {
        const chequeSum = cashChequeRows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
        if (!cashChequeRows.some((row) => row.chequeNumber.trim())) {
          map.cashCheques = 'أضف شيكاً واحداً على الأقل برقم ومبلغ';
        } else if (chequeSum + 0.009 < Number(financialSummary.netAmount || 0)) {
          map.cashCheques = `مجموع الشيكات (${chequeSum.toLocaleString()}) أقل من قيمة الفاتورة`;
        }
      }
    }
    if (paymentType === 'credit' && (Number(advancePaidAmount) || 0) > 0) {
      if (resolvedCashKind === 'treasury' && !String(advanceSafeId || treasuryId || defaultSafeId || '').trim()) {
        map.advanceSafeId = 'حدد الخزينة عند دفع مبلغ في الأول';
      }
      if (resolvedCashKind === 'bank' && !String(cashBankAccountId || '').trim()) {
        map.cashBankAccountId = 'حدد الحساب البنكي عند دفع مبلغ في الأول';
      }
    }
    return map;
  }, [
    submitAttempt,
    supplierInvoiceFormSchema,
    invoiceNumber,
    description,
    supplierRef,
    date,
    warehouseId,
    supplierId,
    invoiceLines,
    paymentType,
    treasuryId,
    defaultSafeId,
    cashTenderKind,
    cashBankAccountId,
    cashChequeRows,
    advancePaidAmount,
    advanceSafeId,
    financialSummary.netAmount,
  ]);

  const purchaseLifecycle = {
    documentId: selectedInvoiceId,
    isPosted,
    isCancelled: Boolean((selectedInvoice as { isCancelled?: boolean } | undefined)?.isCancelled),
  };
  const purchaseLifecycleStatus = resolveDocumentLifecycleStatus(purchaseLifecycle);

  const handleVoidPurchaseInvoice = async () => {
    if (!selectedInvoiceId) {
      setError('يرجى اختيار فاتورة أولاً');
      return;
    }
    if (financialBusy) return;
    if (await confirmAction('إلغاء المستند؟ سيبقى في السجل ويمكن استعادته من قائمة (...).')) {
      invoiceCancelMutation.mutate({});
    }
  };

  const handleRestoreCancelledPurchase = async () => {
    if (!selectedInvoiceId || restorePending) return;
    setRestorePending(true);
    try {
      await restoreCancelledDocument({
        restorePath: `/invoices/${selectedInvoiceId}/restore`,
        postPath: `/invoices/${selectedInvoiceId}/post`,
        kind: 'invoice',
        autoPostOnSave: txSettings?.autoPostOnSave,
      });
      invalidateQuery(['invoice', selectedInvoiceId]);
      invalidateStockViews(invalidateQuery);
      setSuccess(
        txSettings?.autoPostOnSave ? 'تمت الاستعادة والترحيل' : 'تمت الاستعادة — المستند غير مرحّل'
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر الاستعادة');
    } finally {
      setRestorePending(false);
    }
  };

  const paymentUiEnabled = !invoicePaymentButtonDisabled('sales-invoice', {
    lockLoadedSource,
    isReadOnly,
    isPosted,
  });

  const openPurchasePaymentOrCollect = () => {
    if (!isPosted) {
      setSplitModalOpen(true);
      return;
    }
    if (!selectedInvoiceId) {
      setError('يرجى اختيار فاتورة أولاً');
      return;
    }
    const remaining = invoiceRemainingForCollect(selectedInvoice);
    if (remaining === null) {
      setError('لا يوجد مبلغ متبقٍ للسداد');
      return;
    }
    if (!safesResponse?.data?.length) {
      setError('لا توجد خزينة معرّفة — أضف خزينة قبل السداد');
      return;
    }
    setCollectInstallment(null);
    setCollectModalOpen(true);
  };

  const handleCreateWarehouseReceipt = () => {
    if (!selectedInvoiceId) {
      setError('احفظ الفاتورة أولاً');
      return;
    }
    if (affectsStock) {
      setError('الفاتورة مربوطة بالمخزن — لا حاجة لإذن إضافة منفصل');
      return;
    }
    const hasLines = invoiceLines.some((line) => Boolean(line.itemId));
    if (!hasLines) {
      setError('أضف أصنافاً في الفاتورة أولاً');
      return;
    }
    router.push(
      buildStockDocumentFollowUpHref('receipt', 'PURCHASE_INVOICE', selectedInvoiceId)
    );
  };

  return (
    <ErpDocumentLayout className={ERP_INVOICE_DOCUMENT_LAYOUT_CLASS}>
      {error ? <ErrorToast message={error} onClose={() => setError('')} /> : null}
      {success ? <SuccessToast message={success} onClose={() => setSuccess('')} /> : null}

      <PageDraftRestoreGate<PurchaseInvoiceDraft>
        restoreOffer={restoreOffer}
        hide={Boolean(selectedInvoiceId)}
        message="يوجد مسودة فاتورة مشتريات غير محفوظة."
        acceptRestore={acceptRestore}
        dismissRestore={dismissRestore}
        onRestored={(payload) => {
          applyPurchaseDraft(payload);
          setSuccess('تم استعادة مسودة فاتورة المشتريات');
        }}
      />

      {draftEnabled && lastSavedAt ? (
        <p className="mb-2 text-xs text-slate-500 text-left" dir="ltr">
          نسخة احتياطية على هذا الجهاز · {lastSavedAt.toLocaleTimeString('ar-EG')}
        </p>
      ) : null}

      <PurchaseInvoicePageHeader
        invoiceNumber={invoiceNumber}
        statusTone={purchaseLifecycleStatus.tone}
        statusLabel={purchaseLifecycleStatus.label}
        lifecycle={purchaseLifecycle}
        savePending={financialBusy}
        postPending={postInvoiceMutation.isPending || unpostInvoiceMutation.isPending}
        canPost={!!selectedInvoiceId && !isPosted && !financialBusy}
        canSave={!isReadOnly && !isPosted && !financialBusy}
        onSaveDraft={handleSaveDraft}
        onPost={handlePostInvoice}
        onNew={handleNew}
        printInvoice={printInvoiceDocument}
        company={companyProfile}
        onUnpost={() => {
          if (financialBusy || !selectedInvoiceId) return;
          unpostInvoiceMutation.mutate({});
        }}
        onUnapprove={() => {
          if (!selectedInvoiceId) return;
          unapproveInvoiceMutation.mutate({});
        }}
        onDelete={() => void handleVoidPurchaseInvoice()}
        isPosted={isPosted}
        isCancelled={purchaseLifecycle.isCancelled}
        onRestore={() => void handleRestoreCancelledPurchase()}
        restorePending={restorePending}
        onOpenJournal={() => {
          if (selectedInvoiceId) {
            router.push(destinationAppTabHref(`/accounting/operations/journal-entry?ref=invoice&id=${selectedInvoiceId}`));
          }
        }}
        onPreviewJournal={() => setBottomSplitTab('gl')}
        journalEntryId={activeInvoiceJournalId}
        journalNumber={activeInvoiceJournalLabel}
        journalOptions={invoiceJournalOptions.length > 1 ? invoiceJournalOptions : undefined}
        onJournalIdChange={setActiveInvoiceJournalId}
        onCollectPayment={openPurchasePaymentOrCollect}
        onLinkAdvance={() => {
          if (!supplierId.trim()) {
            setError('اختر المورد أولاً');
            return;
          }
          setLinkAdvanceOpen(true);
        }}
        onPaymentHistory={() => {
          if (!selectedInvoiceId) {
            setError('يرجى اختيار فاتورة أولاً');
            return;
          }
          invalidateQuery(['invoice-settlements', selectedInvoiceId]);
          invalidateQuery(['invoice-settlements-history', selectedInvoiceId]);
          invalidateQuery(['invoice-settlements-cheques', selectedInvoiceId]);
          invalidateQuery(['invoice-installments', selectedInvoiceId]);
          setBottomSplitTab('settlements');
        }}
        onCreateReturn={() => {
          if (!selectedInvoiceId) {
            setError('يرجى اختيار فاتورة أولاً');
            return;
          }
          if (!isPosted) {
            setError('يجب ترحيل الفاتورة قبل إنشاء مرتجع');
            return;
          }
          router.push(destinationAppTabHref(`/inventory/operations/purchase-returns?fromInvoice=${selectedInvoiceId}`));
        }}
        unpostPending={unpostInvoiceMutation.isPending || financialBusy}
        deletePending={invoiceCancelMutation.isPending || financialBusy}
        onBrowseList={() => setShowInvoiceList(true)}
        currentId={selectedInvoiceId}
        onNavigate={openInvoice}
        onEdit={() => {
          if (isPosted) {
            setError('يجب إلغاء الترحيل أولاً للتعديل');
            return;
          }
          unlockForEdit();
        }}
        transactionSettingsDocumentType="PURCHASE_INVOICE"
        onTransactionSettingsSaved={() =>
          invalidateAfterTransactionSettingsSave(invalidateQuery, 'PURCHASE_INVOICE')
        }
        followUpActions={
          !affectsStock && selectedInvoiceId && !purchaseLifecycle.isCancelled ? (
            <DocumentFollowUpButton
              label="إنشاء إذن إضافة مخزن"
              onClick={handleCreateWarehouseReceipt}
            />
          ) : null
        }
      />

      {showInvoiceList ? (
        <InvoiceDocumentListDrawer
          open
          onClose={() => setShowInvoiceList(false)}
          title="فواتير المشتريات"
          invoiceKind="PURCHASE"
          partyColumnHeader="المورد"
          getPartyName={(row) => row.supplier?.arabicName || '—'}
          selectedInvoiceId={selectedInvoiceId}
          onOpenForEdit={(id) => {
            openInvoice(id);
            setShowInvoiceList(false);
          }}
        />
      ) : null}

      <DocumentReadOnlyBanner />

      <PurchaseInvoiceFormHeader
        supplierId={supplierId}
        onSupplierId={setSupplierId}
        paymentType={paymentType}
        onPaymentType={setPaymentType}
        treasuryId={treasuryId}
        onTreasuryId={setTreasuryId}
        cashTenderKind={cashTenderKind}
        onCashTenderKind={setCashTenderKind}
        cashBankAccountId={cashBankAccountId}
        onCashBankAccountId={setCashBankAccountId}
        cashBankReference={cashBankReference}
        onCashBankReference={setCashBankReference}
        cashChequeRows={cashChequeRows}
        onCashChequeRows={setCashChequeRows}
        cashIssuingBankAccountId={cashIssuingBankAccountId}
        onCashIssuingBankAccountId={setCashIssuingBankAccountId}
        cashNetAmount={financialSummary.netAmount}
        cashChequeError={cashChequeError}
        advancePaidAmount={advancePaidAmount}
        onAdvancePaidAmount={setAdvancePaidAmount}
        advanceSafeId={advanceSafeId}
        onAdvanceSafeId={setAdvanceSafeId}
        onCollectPayment={openPurchasePaymentOrCollect}
        onConfigureSplit={() => {
          if (isPosted) {
            const remaining = invoiceRemainingForCollect(selectedInvoice);
            if (remaining === null) {
              setError('لا يوجد مبلغ متبقي للسداد');
              return;
            }
          }
          setSplitModalOpen(true);
        }}
        onLinkAdvance={() => {
          if (!supplierId.trim()) {
            setError('اختر المورد أولاً');
            return;
          }
          setLinkAdvanceOpen(true);
        }}
        onConfigureInstallments={() => setInstallmentsModalOpen(true)}
        installmentCount={paymentInstallments.length}
        paymentSplits={paymentSplits}
        splitLocked={false}
        splitCollectMode={Boolean(selectedInvoiceId)}
        warehouseId={warehouseId}
        onWarehouseId={setWarehouseId}
        date={date}
        onDate={setDate}
        invoiceNumber={invoiceNumber}
        onInvoiceNumber={setInvoiceNumber}
        serialAutomatic={isTransactionSerialAutomatic(txSettings?.numberingMode)}
        hasSavedDocument={Boolean(selectedInvoiceId)}
        costCenterId={costCenterId}
        onCostCenterId={setCostCenterId}
        delegateId={delegateId}
        onDelegateId={setDelegateId}
        description={description}
        onDescription={setDescription}
        hijriDate={hijriDate}
        onHijriDate={setHijriDate}
        currencyId={currencyId}
        onCurrencyId={(id) => {
          setCurrencyId(id);
          const picked = currencies.find((c) => c.id === id);
          const rate = Number((picked as { exchangeRate?: number } | undefined)?.exchangeRate);
          if (rate > 0) setExchangeRate(rate);
        }}
        exchangeRate={exchangeRate}
        onExchangeRate={setExchangeRate}
        isPurchaseTaxInvoice={isSalesTaxInvoice}
        onPurchaseTaxChange={handlePurchaseTaxChange}
        applyWithholding={applyWithholding}
        onApplyWithholdingChange={handlePurchaseWithholdingChange}
        supplierRef={supplierRef}
        onSupplierRef={setSupplierRef}
        currencies={currencies}
        delegates={delegates}
        currenciesLoading={currenciesLoading}
        delegatesLoading={delegatesLoading}
        errors={formErrors}
        showValidationErrors={submitAttempt > 0}
        pricingCalculationBasis={pricingCalculationBasis}
        onPricingCalculationBasis={setPricingCalculationBasis}
        sourceType={sourceType}
        sourceId={sourceId}
        sourceNumber={sourceNumber}
        hasExistingLines={invoiceLines.some((line) => Boolean(line.itemId))}
        sourceDisabled={isPosted || isReadOnly}
        onMultiStockPermitHydrate={handleMultiStockPermitHydrate}
        fieldsDisabled={lockLoadedSource}
        includeAllAccounts={shouldShowAllAccountsInPartyField(txSettings)}
        onSourceTypeChange={(type) => {
          setSourceType(type);
          setSourceId('');
          setSourceNumber('');
        }}
        onSourceHydrate={handleSourceHydrate}
        affectsStock={affectsStock}
        headerActions={
          <InternalNotesScratchpad
            notes={internalNotes}
            onChange={setInternalNotes}
            disabled={isPosted || lockLoadedSource}
            className="inline-flex"
          />
        }
      />

      <DocumentFormLock>
      <div className="mt-2">
        <ProgressivePurchaseInvoiceLineGrid
          storageKey="gates:columns:purchase-invoice"
          lines={invoiceLines}
          onChange={setInvoiceLines}
          warehouseId={warehouseId}
          visibleColumnIds={visibleColumnIds}
          onVisibleColumnIdsChange={(ids) =>
            setStoredColumnIds(mergeVisibleColumnIds('gates:columns:purchase-invoice', ids))
          }
          modernUi
          clipboardItems={clipboardItems}
          onClipboardLines={handlePurchaseClipboardLines}
          pricingCalculationBasis={pricingCalculationBasis}
          readOnly={isReadOnly || lockLoadedSource}
          lockUnitPrice={shouldLockItemPriceOverride(txSettings)}
          headerDescription={description}
          defaultTaxPercent={invoiceLineVatRate(undefined, isSalesTaxInvoice)}
          defaultWithholdingRate={defaultWhtRate}
          applyPickedItemToLine={applyPickedItemToLine}
          invoiceAffectsStock={affectsStock}
        />
            </div>
      </DocumentFormLock>

      {collectModalOpen ? (
        <InvoiceCollectModal
          open
          mode="pay"
          remaining={collectInstallment?.remaining ?? invoiceRemainingForCollect(selectedInvoice) ?? 0}
          safes={safesResponse?.data ?? []}
          defaultSafeId={defaultSafeId}
          pending={collectPaymentMutation.isPending}
          onClose={() => {
            setCollectModalOpen(false);
            setCollectInstallment(null);
          }}
          onConfirm={(payload) => {
            if (collectInstallment && selectedInvoiceId) {
              void apiClient
                .post(`/invoices/${selectedInvoiceId}/installments/${collectInstallment.id}/collect`, payload)
                .then(() => {
                  setSuccess('تم تسجيل سداد القسط');
                  setCollectModalOpen(false);
                  setCollectInstallment(null);
                  invalidateQuery(['invoice', selectedInvoiceId]);
                  invalidateQuery(['invoice-settlements', selectedInvoiceId]);
                  invalidateQuery(['invoice-settlements-history', selectedInvoiceId]);
                  invalidateQuery(['invoice-settlements-cheques', selectedInvoiceId]);
                  invalidateQuery(['invoice-installments', selectedInvoiceId]);
                })
                .catch((error: unknown) => {
                  setError(error instanceof Error ? error.message : 'تعذر سداد القسط');
                });
              return;
            }
            collectPaymentMutation.mutate(payload);
          }}
        />
      ) : null}

      {linkAdvanceOpen ? (
        <LinkAdvancePaymentModal
          open
          invoiceId={selectedInvoiceId}
          supplierId={supplierId}
          remaining={invoiceRemainingForCollect(selectedInvoice) ?? financialSummary.netAmount}
          kind="PAYMENT"
          onClose={() => setLinkAdvanceOpen(false)}
          onHold={(allocations) => {
            pendingAdvancesRef.current = allocations;
            setPendingAdvanceTotal(allocations.reduce((sum, row) => sum + row.amount, 0));
            setSuccess('هيتم ربط الدفعة مع حفظ الفاتورة');
          }}
        />
      ) : null}

      {splitModalOpen ? (
        <MultiPaymentSplitterModal
          open
          onClose={() => setSplitModalOpen(false)}
          grandTotal={
            isPosted
              ? invoiceRemainingForCollect(selectedInvoice) ?? financialSummary.netAmount
              : financialSummary.netAmount
          }
          direction="PAYMENT"
          initial={isPosted ? [] : paymentSplits}
          onOpenInstallments={() => setInstallmentsModalOpen(true)}
          installmentCount={paymentInstallments.length}
          onLinkAdvance={() => {
            if (!supplierId.trim()) {
              setError('اختر المورد أولاً');
              return;
            }
            setLinkAdvanceOpen(true);
          }}
          onConfirm={(splits) => {
            if (!isPosted) {
              const paid = sumPaymentSplits(splits.filter((line) => line.type !== 'ON_ACCOUNT'));
              if (paid <= 0.009) {
                setPaymentType('credit');
                setAdvancePaidAmount(0);
                setPaymentSplits([]);
              } else {
                setPaymentType('split');
                setAdvancePaidAmount(paid);
                setPaymentSplits(splits);
              }
              setSplitModalOpen(false);
              return;
            }
            if (!selectedInvoiceId) {
              setSplitModalOpen(false);
              return;
            }
            void postInvoiceSettlementSplits(selectedInvoiceId, splits)
              .then(() => {
                setSuccess('تم تسجيل الدفع المتعدد');
                setSplitModalOpen(false);
                invalidateQuery(['invoice', selectedInvoiceId]);
                invalidateQuery(['invoice-settlements', selectedInvoiceId]);
                invalidateQuery(['invoice-settlements-history', selectedInvoiceId]);
                invalidateQuery(['invoice-settlements-cheques', selectedInvoiceId]);
                invalidateQuery(['invoice-installments', selectedInvoiceId]);
              })
              .catch((err: unknown) => {
                setError(err instanceof Error ? err.message : 'تعذر تسجيل الدفع المتعدد');
              });
          }}
        />
      ) : null}

      {installmentsModalOpen ? (
        <PaymentInstallmentsModal
          open
          onClose={() => setInstallmentsModalOpen(false)}
          remainingAmount={
            invoiceRemainingForCollect(selectedInvoice as Record<string, unknown> | undefined) ??
            financialSummary.netAmount
          }
          startDate={date}
          initial={paymentInstallments}
          onConfirm={(rows) => {
            setPaymentInstallments(rows);
            if (!selectedInvoiceId) return;
            void apiClient
              .put(`/invoices/${selectedInvoiceId}/installments`, {
                installments: rows.map((row) => ({
                  installmentNumber: row.number,
                  dueDate: row.dueDate,
                  amount: row.amount,
                })),
              })
              .then(() => {
                setSuccess('تم حفظ توزيع الدفعات');
                invalidateQuery(['invoice-installments', selectedInvoiceId]);
                invalidateQuery(['invoice', selectedInvoiceId]);
              })
              .catch((error: unknown) => {
                setError(error instanceof Error ? error.message : 'تعذر حفظ توزيع الدفعات');
              });
          }}
        />
      ) : null}

      <InvoiceExtrasPanel
        open={extrasOpen}
        onToggle={() => setExtrasOpen((v) => !v)}
        rows={invoiceExtras}
        onChange={setInvoiceExtras}
        currencies={currencies}
        defaultCurrency={currencies.find((c) => c.id === currencyId)?.code ?? 'EGP'}
        defaultExchangeRate={exchangeRate > 0 ? exchangeRate : 1}
        defaultCostCenterId={costCenterId || ''}
        disabled={isReadOnly || isPosted || lockLoadedSource}
        count={getExtrasPayload().length}
        headerDescription={description}
      />

      <PurchaseInvoiceBottomSplit
        summary={financialSummary}
        applyTax={isSalesTaxInvoice}
        lines={invoiceLines.map((l) => ({
          itemId: l.itemId,
          quantity: l.quantity,
          baseQuantity: l.baseQuantity,
          unitPrice: l.unitPrice,
          discount: l.discountValue ?? l.discount,
          discountValue: l.discountValue ?? l.discount,
          discountType: l.discountType,
          taxRate: l.tax,
        }))}
        savedLines={((selectedInvoice?.lines ?? []) as Record<string, unknown>[]).map((line) => ({
          itemId: String(line.itemId ?? ''),
          itemName: readInvoiceLineItemName(line),
          quantity: Number(line.quantity) || 0,
          baseQuantity: Number(line.baseQuantity ?? line.quantity) || 0,
          unitPrice: Number(line.price ?? line.unitPrice) || 0,
          discount: inferDiscountValueFromApi(line),
          discountValue: inferDiscountValueFromApi(line),
          discountType: inferDiscountTypeFromApi(line),
          taxRate: Number(line.taxPercent ?? line.tax ?? line.taxRate ?? 0) || 0,
        }))}
        pricingCalculationBasis={pricingCalculationBasis}
        warehouseId={warehouseId}
        journalEntryId={activeInvoiceJournalId}
        journalOptions={invoiceJournalOptions.length > 1 ? invoiceJournalOptions : undefined}
        onJournalIdChange={setActiveInvoiceJournalId}
        selectedInvoiceId={selectedInvoiceId}
        isPosted={isPosted}
        settlements={settlements}
        settlementHistory={settlementHistory}
        cheques={settlementCheques}
        installments={paymentInstallments}
        paidAmount={Number((selectedInvoice as { paidAmount?: number } | undefined)?.paidAmount) || 0}
        remainingAmount={invoiceRemainingForCollect(selectedInvoice) ?? 0}
        onCollectInstallment={(row) => {
          if (!row.id) return;
          if (!isPosted) {
            setError('يجب ترحيل الفاتورة قبل تسجيل السداد');
            return;
          }
          setCollectInstallment({ id: row.id, remaining: row.remainingAmount });
          setCollectModalOpen(true);
        }}
        activeTabId={bottomSplitTab}
        onActiveTabChange={setBottomSplitTab}
        cashPayment={{
          paidAmount: invoiceCashPaidDisplayAmount({
            isPosted,
            savedPaidAmount:
              Number((selectedInvoice as { paidAmount?: number } | undefined)?.paidAmount) || 0,
            paymentMethod: paymentType,
            advancePaidAmount,
            splitTenderPaid: sumPaymentSplits(paymentSplits.filter((line) => line.type !== 'ON_ACCOUNT')),
            netAmount: financialSummary.netAmount,
            pendingAdvanceTotal,
          }),
          method: paymentType,
          disabled: !paymentUiEnabled,
          onPaidChange: () => {},
          onOpenSplit: () => setSplitModalOpen(true),
          splitSummary: summarizePaymentSplits(paymentSplits) || undefined,
          cashVoucherHint: cashPaymentNumberingManual
            ? 'الترقيم يدوي لسند الصرف — أدخل الرقم من الدفع'
            : undefined,
        }}
      />

    </ErpDocumentLayout>
  );
}
