'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { destinationAppTabHref } from '@/lib/navigation/tab-memory';
import { useOwnTabPathname, useOwnTabSearchParams } from '@/lib/navigation/tab-route-lock';
import { Button } from '@/components/ui';
import { DynamicModalSkeleton, LineGridSkeleton } from '@/components/ui/DynamicChunkSkeleton';
import { useApiQuery, useApiMutation, useInvalidateQuery } from '@/lib/hooks/useApi';
import { shouldLockLoadedSource, type TransactionSettings } from '@/lib/transaction-settings/types';
import { pickDefaultSafeId } from '@/lib/hooks/useMasterDataQueries';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';
import { toast, toastInvoiceSaveError, toastVersionConflict } from '@/lib/feedback/toast';
import { isOptimisticLockApiError } from '@/lib/concurrency/version-conflict';
import {
  postInvoiceAfterSave,
  useRepostAfterUnpost,
} from '@/lib/accounting/ensure-posted-after-save';
import type { ApiError } from '@/lib/api/types';
import { confirmAction } from '@/lib/feedback/confirm';
import { firstPartyPhone } from '@/lib/whatsapp-share';
import { inventorySupplierInvoiceFormSchema } from '@/lib/validation/inventory.schema';
import { mapSalesFormToM5CreateBody, mapSalesFormToM5UpdateBody } from '@/lib/invoices/mapFormToM5Invoice';
import { computeInvoiceFinancialSummary } from '@/lib/invoices/computeInvoiceFinancialSummary';
import type { PurchaseInvoiceLine } from '@/components/inventory/ProgressivePurchaseInvoiceLineGrid';
import {
  mergeVisibleColumnIds,
} from '@/lib/invoices/invoiceLineColumns';
import { useVisibleColumnIds } from '@/lib/invoices/useVisibleColumnIds';
import { defaultUnitIdForItem, findDefaultPieceUnitId } from '@/lib/inventory/item-units';
import {
  parsePricingCalculationBasis,
  type PricingCalculationBasis,
} from '@/lib/invoices/unit-conversion';
import { inferDiscountTypeFromApi, inferDiscountValueFromApi } from '@/lib/invoices/discount-type';
import { useCompanyPrintProfile } from '@/lib/hooks/useCompanyPrintProfile';
import { useFirstCompany } from '@/lib/hooks/useFirstCompany';
import { ErpDocumentLayout } from '@/components/erp/ErpDocumentLayout';
import { PageDraftRestoreBanner } from '@/components/erp/PageDraftRestoreBanner';
import { ERP_INVOICE_DOCUMENT_LAYOUT_CLASS } from '@/components/erp/erpUiTokens';
import { PurchaseInvoicePageHeader } from '@/components/inventory/purchase-invoice/PurchaseInvoicePageHeader';
import { PurchaseInvoiceFormHeader } from '@/components/inventory/purchase-invoice/PurchaseInvoiceFormHeader';
import { InternalNotesScratchpad } from '@/components/documents/InternalNotesScratchpad';
import type { InternalNoteEntry, PaymentSplitLine } from '@/lib/invoices/payment-split.types';
import {
  resolveInvoicePaymentUi,
  splitsMatchTotal,
  withOnAccountRemainder,
} from '@/lib/invoices/payment-split.types';
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
  unwrapInvoiceCheques,
  type InvoiceCashSettlement,
  type InvoiceChequesPayload,
} from '@/lib/invoices/invoice-settlements';
import { PurchaseInvoiceBottomSplit } from '@/components/inventory/purchase-invoice/PurchaseInvoiceBottomSplit';
import { DocumentApprovalBar } from '@/app/components/accounting/DocumentApprovalBar';
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

const InvoiceSettlementsHistoryModal = dynamic(
  () =>
    import('@/components/invoices/InvoiceSettlementsHistoryModal').then((m) => ({
      default: m.InvoiceSettlementsHistoryModal,
    })),
  { ssr: false, loading: () => <DynamicModalSkeleton label="جاري تحميل المدفوعات…" /> }
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
  units?: {
    unitId?: string;
    isBaseUnit?: boolean;
    isFactorFixed?: boolean | null;
    conversionFactor?: number | string | null;
    unit?: { id: string };
  }[];
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
  freightAmount: number;
  supplierDiscountAmount: number;
  paymentSplits: PaymentSplitLine[];
  paymentInstallments: PaymentInstallmentRow[];
  internalNotes: InternalNoteEntry[];
  isSalesTaxInvoice: boolean;
  cashTenderKind?: CashTenderKind;
  cashBankAccountId?: string;
  cashBankReference?: string;
  cashChequeRows?: InvoiceChequeDraft[];
  cashIssuingBankAccountId?: string;
};

function isPurchaseInvoiceDraftEmpty(draft: PurchaseInvoiceDraft) {
  const hasLine = (draft.invoiceLines ?? []).some((line) => Boolean(line.itemId?.trim()));
  const hasNotes = (draft.internalNotes ?? []).some((note) => String(note.body ?? '').trim());
  const hasMoney =
    Number(draft.freightAmount) !== 0 || Number(draft.supplierDiscountAmount) !== 0;
  return !draft.supplierId?.trim() && !draft.description?.trim() && !hasLine && !hasNotes && !hasMoney;
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
  const { markUnpostedForEdit, consumeShouldRepost, resetKeepPosted } = useRepostAfterUnpost();
  const invalidateQuery = useInvalidateQuery();
  const { companyId } = useFirstCompany();
  const { data: txSettingsRes } = useApiQuery<TransactionSettings>(
    ['transaction-settings', 'PURCHASE_INVOICE'],
    '/transaction-settings/PURCHASE_INVOICE'
  );
  
  const [isPosted, setIsPosted] = useState(false);
  const [isSalesTaxInvoice, setIsSalesTaxInvoice] = useState(true);
  const [showInvoiceList, setShowInvoiceList] = useState(false);
  const [settlementsHistoryOpen, setSettlementsHistoryOpen] = useState(false);
  const [linkAdvanceOpen, setLinkAdvanceOpen] = useState(false);
  const [submitAttempt, setSubmitAttempt] = useState(0);
  
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [supplierRef, setSupplierRef] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [hijriDate, setHijriDate] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [costCenterId, setCostCenterId] = useState('');
  const [delegateId, setDelegateId] = useState('');
  const [currencyId, setCurrencyId] = useState('');
  const [paymentType, setPaymentType] = useState<'cash' | 'credit' | 'split'>('cash');
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
  const [paymentInstallments, setPaymentInstallments] = useState<PaymentInstallmentRow[]>([]);
  const [installmentsModalOpen, setInstallmentsModalOpen] = useState(false);
  const [internalNotes, setInternalNotes] = useState<InternalNoteEntry[]>([]);
  const [invoiceLines, setInvoiceLines] = useState<PurchaseInvoiceLine[]>([]);
  const [sourceType, setSourceType] = useState('');
  const [sourceId, setSourceId] = useState('');
  const [sourceNumber, setSourceNumber] = useState('');
  const lockLoadedSource = shouldLockLoadedSource(txSettingsRes?.data, sourceId);
  const [freightAmount, setFreightAmount] = useState(0);
  const [supplierDiscountAmount, setSupplierDiscountAmount] = useState(0);
  const prevPurchaseWarehouseRef = useRef(warehouseId);
  const [visibleColumnIds, setVisibleColumnIds] = useVisibleColumnIds(
    'gates:columns:purchase-invoice',
    companyId
  );
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(
    () => searchParams.get('invoiceId')?.trim() || null
  );
  const fromAiDraft = searchParams.get('fromAiDraft') === '1';
  const aiDraftAppliedRef = useRef(false);

  useEffect(() => {
    if (!selectedInvoiceId) {
      setMode('create');
      return;
    }
    if (isPosted) lockToView();
    else setMode('edit');
  }, [isPosted, lockToView, selectedInvoiceId, setMode]);

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

  useEffect(() => {
    const prev = prevPurchaseWarehouseRef.current;
    prevPurchaseWarehouseRef.current = warehouseId;
    if (!warehouseId || prev === warehouseId) return;
    setInvoiceLines((lines) =>
      lines.map((line) => {
        const current = line.warehouseId?.trim() ?? '';
        if (!current || current === prev) {
          return { ...line, warehouseId };
        }
        return line;
      })
    );
  }, [warehouseId]);

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
      freightAmount,
      supplierDiscountAmount,
      paymentSplits,
      paymentInstallments,
      internalNotes,
      isSalesTaxInvoice,
      cashTenderKind,
      cashBankAccountId,
      cashBankReference,
      cashChequeRows,
      cashIssuingBankAccountId,
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
      freightAmount,
      supplierDiscountAmount,
      paymentSplits,
      paymentInstallments,
      internalNotes,
      isSalesTaxInvoice,
      cashTenderKind,
      cashBankAccountId,
      cashBankReference,
      cashChequeRows,
      cashIssuingBankAccountId,
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
    setPaymentType(payload.paymentType === 'credit' || payload.paymentType === 'split' ? payload.paymentType : 'cash');
    setTreasuryId(payload.treasuryId ?? '');
    setAdvancePaidAmount(Number(payload.advancePaidAmount) || 0);
    setAdvanceSafeId(payload.advanceSafeId ?? '');
    setPricingCalculationBasis(parsePricingCalculationBasis(payload.pricingCalculationBasis));
    setInvoiceLines(payload.invoiceLines ?? []);
    setSourceType(payload.sourceType ?? '');
    setSourceId(payload.sourceId ?? '');
    setSourceNumber(payload.sourceNumber ?? '');
    setFreightAmount(Number(payload.freightAmount) || 0);
    setSupplierDiscountAmount(Number(payload.supplierDiscountAmount) || 0);
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
  }, []);

  const skipServerHydrateRef = useRef(false);
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
  const landedAllocationsQuery = useApiQuery<Array<{ totalAmount?: number | string; isCancelled?: boolean }>>(
    ['landed-costs', selectedInvoiceId],
    '/inventory/landed-costs',
    selectedInvoiceId ? { invoiceId: selectedInvoiceId } : undefined,
    { enabled: Boolean(selectedInvoiceId) }
  );
  const { profile: companyProfile } = useCompanyPrintProfile();
  const printInvoiceDocument = selectedInvoice
    ? ({ ...selectedInvoice, invoiceKind: 'PURCHASE' } as Record<string, unknown>)
    : null;

  const financialSummary = useMemo(
    () =>
      computeInvoiceFinancialSummary(
        invoiceLines.map((line) => ({
          quantity: line.quantity,
          baseQuantity: line.baseQuantity,
          unitPrice: line.unitPrice,
          discount: line.discountValue ?? line.discount,
          discountValue: line.discountValue ?? line.discount,
          discountType: line.discountType,
          taxRate: line.tax,
        })),
        {
          applyTax: isSalesTaxInvoice,
          withholdingTaxAmount: Number(selectedInvoice?.withholdingTaxAmount ?? 0),
          pricingCalculationBasis,
          additionsAndDiscounts: freightAmount - supplierDiscountAmount,
        }
      ),
    [invoiceLines, isSalesTaxInvoice, pricingCalculationBasis, selectedInvoice?.withholdingTaxAmount, freightAmount, supplierDiscountAmount]
  );

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
    if (!selectedInvoice) return;
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
    const cashSplit = loaded.splits.find((row) => row.type === 'CASH' && row.safeId);
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
      setAdvancePaidAmount(tenderPaidFromSplits(loaded.splits));
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
    setIsPosted(Boolean(selectedInvoice.isPosted));
    setIsSalesTaxInvoice(selectedInvoice.isSalesTaxInvoice !== false);
    setPricingCalculationBasis(
      parsePricingCalculationBasis(
        (selectedInvoice as { pricingCalculationBasis?: string }).pricingCalculationBasis
      )
    );
    const lines = selectedInvoice.lines as Record<string, unknown>[] | undefined;
    if (lines) {
      setInvoiceLines(
        lines.map((line) => ({
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
          withholdingTaxRate: Number(line.withholdingTaxRate ?? 0) || 0,
          withholdingTaxAmount: Number(line.withholdingTaxAmount ?? 0) || 0,
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
          warehouseId: String(line.warehouseId ?? selectedInvoice.warehouseId ?? ''),
        }))
      );
    }
    const headerPercent = Number((selectedInvoice as { headerDiscountPercent?: number }).headerDiscountPercent ?? 0);
    const merchandise = Number((selectedInvoice as { totalAmount?: number }).totalAmount ?? 0);
    setSupplierDiscountAmount(
      headerPercent > 0 && merchandise > 0 ? (merchandise * headerPercent) / 100 : 0
    );
  }, [selectedInvoice]);

  useEffect(() => {
    const rows = landedAllocationsQuery.data?.data ?? [];
    const freight = rows
      .filter((row) => !row.isCancelled)
      .reduce((sum, row) => sum + Number(row.totalAmount ?? 0), 0);
    if (freight > 0) setFreightAmount(freight);
  }, [landedAllocationsQuery.data?.data]);

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
          tax: isSalesTaxInvoice ? 14 : 0,
          warehouseId,
        })),
      ]);
      setSuccess(`تم لصق ${lines.length} سطر`);
    },
    [items, isSalesTaxInvoice, warehouseId]
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
      payload.lines.map((line) => sourceLineToPurchaseRow(line, payload.warehouseId || warehouseId))
    );
    setSuccess(`تم تعبئة الفاتورة من ${payload.sourceNumber}`);
  }, [warehouseId]);

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
    setPaymentType('cash');
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
    setFreightAmount(0);
    setSupplierDiscountAmount(0);
    setIsSalesTaxInvoice(true);
    setPricingCalculationBasis(
      parsePricingCalculationBasis(companySettingsRes?.data?.pricingCalculationBasis)
    );
    clearDraft();
  }, [clearDraft, companySettingsRes?.data?.pricingCalculationBasis, openInvoice, resetKeepPosted]);

  const handleRestoreDraft = () => {
    const payload = acceptRestore() as PurchaseInvoiceDraft | null;
    if (!payload) return;
    applyPurchaseDraft(payload);
    setSuccess('تم استعادة مسودة فاتورة المشتريات');
  };

  const invoiceMutation = useApiMutation<unknown, Record<string, unknown>>('/invoices', 'POST', {
    onSuccess: () => {
      persistIntentRef.current = 'save';
      clearDraft();
      invalidateQuery(['invoices']);
      handleNew();
      setSuccess('تم حفظ فاتورة المشتريات بنجاح');
    },
    onError: (err) => {
      setError(err.message || 'حدث خطأ أثناء الحفظ');
      toastInvoiceSaveError(err.message || 'حدث خطأ أثناء الحفظ');
    },
  });

  const invoiceUpdateMutation = useApiMutation<unknown, Record<string, unknown>>(
    selectedInvoiceId ? `/invoices/${selectedInvoiceId}` : '/invoices',
    'PUT',
    {
      onSuccess: () => {
        invalidateQuery(['invoices']);
        const id = selectedInvoiceId;
        const shouldPostNow = persistIntentRef.current === 'post';
        persistIntentRef.current = 'save';
        if (shouldPostNow && id) {
          consumeShouldRepost();
          postInvoiceMutation.mutate({});
          invalidateQuery(['invoice', id]);
          return;
        }
        if (consumeShouldRepost() && id) {
          void postInvoiceAfterSave(id)
            .then(() => {
              handleNew();
              setSuccess('تم حفظ التعديلات وترحيل فاتورة المشتريات');
            })
            .catch((err: ApiError) => {
              handleNew();
              setError(err.message || 'تم الحفظ لكن تعذر ترحيل الفاتورة');
            });
          return;
        }
        handleNew();
        setSuccess('تم تحديث فاتورة المشتريات بنجاح');
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

  const invoiceDeleteMutation = useApiMutation<unknown, Record<string, unknown>>(
    selectedInvoiceId ? `/invoices/${selectedInvoiceId}` : '/invoices',
    'DELETE',
    {
      onSuccess: () => {
        setSuccess('تم حذف فاتورة المشتريات بنجاح');
        invalidateQuery(['invoices']);
        handleNew();
      },
      onError: (err) => setError(err.message || 'حدث خطأ أثناء الحذف'),
    }
  );

  const postInvoiceMutation = useApiMutation<unknown, Record<string, unknown>>(
    selectedInvoiceId ? `/invoices/${selectedInvoiceId}/post` : '/invoices',
    'POST',
    {
      onSuccess: () => {
        setSuccess('تم ترحيل فاتورة المشتريات بنجاح');
        setIsPosted(true);
        invalidateQuery(['invoices']);
        invalidateQuery(['invoice', selectedInvoiceId]);
      },
      onError: (err) => {
        setIsPosted(false);
        setError(err.message || 'حدث خطأ أثناء الترحيل');
      },
    }
  );

  const unpostInvoiceMutation = useApiMutation<unknown, Record<string, unknown>>(
    selectedInvoiceId ? `/invoices/${selectedInvoiceId}/unpost` : '/invoices',
    'POST',
    {
      onSuccess: () => {
        setSuccess('تم فك ترحيل فاتورة المشتريات بنجاح');
        setIsPosted(false);
        markUnpostedForEdit();
        invalidateQuery(['invoices']);
        invalidateQuery(['invoice', selectedInvoiceId]);
      },
      onError: (err) => setError(err.message || 'حدث خطأ'),
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

  const { data: settlementsResponse, isLoading: settlementsLoading } = useApiQuery<
    InvoiceCashSettlement[]
  >(
    ['invoice-settlements', selectedInvoiceId],
    `/invoices/${selectedInvoiceId}/settlements`,
    undefined,
    { enabled: !!selectedInvoiceId }
  );
  const { data: chequesResponse, isLoading: chequesLoading } = useApiQuery<InvoiceChequesPayload>(
    ['invoice-settlements-cheques', selectedInvoiceId],
    `/invoices/${selectedInvoiceId}/settlements/cheques`,
    undefined,
    { enabled: !!selectedInvoiceId }
  );
  const settlements = settlementsResponse?.data || [];
  const { cheques: settlementCheques } = unwrapInvoiceCheques(chequesResponse?.data);

  useEffect(() => {
    if (selectedInvoiceId) return;
    const settings = txSettingsRes?.data;
    if (settings?.defaultWarehouseId && !warehouseId) {
      setWarehouseId(settings.defaultWarehouseId);
    }
    if (settings?.defaultCostCenterId && !costCenterId) {
      setCostCenterId(settings.defaultCostCenterId);
    }
  }, [selectedInvoiceId, txSettingsRes?.data, warehouseId, costCenterId]);

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
        invalidateQuery(['invoice', selectedInvoiceId]);
        invalidateQuery(['invoice-settlements', selectedInvoiceId]);
        invalidateQuery(['invoice-settlements-cheques', selectedInvoiceId]);
      },
      onError: (err) => setError(err.message || 'حدث خطأ أثناء الدفع'),
    }
  );

  const loading =
    invoiceMutation.isPending ||
    invoiceUpdateMutation.isPending ||
    invoiceDeleteMutation.isPending;
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
      const cashBuilt = buildCashTenderSplits({
        kind: cashKind,
        netAmount: financialSummary.netAmount,
        treasuryId: paymentType === 'credit' ? creditSafe : cashTreasury,
        bankAccountId: cashBankAccountId,
        bankReference: cashBankReference,
        cheques: cashChequeRows,
        issuingBankAccountId: cashIssuingBankAccountId,
        direction: 'PAYMENT',
        mode: paymentType === 'credit' ? 'advance' : 'full',
        paidAmount: Number(advancePaidAmount) || 0,
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
    const parsed = inventorySupplierInvoiceFormSchema.safeParse({
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
    if (!validatePurchasePayment()) {
      persistIntentRef.current = 'save';
      return;
    }
    const cashTreasury = String(treasuryId || defaultSafeId || '').trim();
    const creditSafe = String(advanceSafeId || cashTreasury || '').trim();
    const creditPaid = Number(advancePaidAmount) || 0;
    const cashKind = resolveCashTenderKind(cashTenderKind, cashBankAccountId, cashChequeRows);
    const cashBuilt =
      resolvedMethod === 'cash' || resolvedMethod === 'credit'
        ? buildCashTenderSplits({
            kind: cashKind,
            netAmount: financialSummary.netAmount,
            treasuryId: resolvedMethod === 'credit' ? creditSafe : cashTreasury,
            bankAccountId: cashBankAccountId,
            bankReference: cashBankReference,
            cheques: cashChequeRows,
            issuingBankAccountId: cashIssuingBankAccountId,
            direction: 'PAYMENT',
            mode: resolvedMethod === 'credit' ? 'advance' : 'full',
            paidAmount: creditPaid,
          })
        : {};
    const splitLines =
      resolvedMethod === 'split'
        ? withOnAccountRemainder(paymentSplits, financialSummary.netAmount)
        : undefined;
    const cashTreasurySplits = resolvedMethod === 'cash' ? cashBuilt.splits : undefined;
    const creditSplits = resolvedMethod === 'credit' ? cashBuilt.splits : undefined;
    const formData = {
      invoiceNumber: d.serialNumber,
      description: d.description,
      date: d.date || new Date().toISOString(),
      hijriDate: d.hijriDate,
      supplierId: d.supplierId,
      warehouseId: d.warehouseId,
      costCenterId: costCenterId || undefined,
      delegateId: delegateId || undefined,
      currencyId: currencyId || undefined,
      sourceType: sourceType && sourceType !== 'NONE' ? sourceType : 'NONE',
      sourceId: sourceId || undefined,
      sourceNumber: sourceNumber || undefined,
      paymentMethod: resolvedMethod,
      pricingCalculationBasis,
      paymentSplits:
        resolvedMethod === 'split'
          ? splitLines
          : resolvedMethod === 'credit'
            ? creditSplits
            : cashTreasurySplits,
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
        warehouseId: line.warehouseId || d.warehouseId,
      })),
    };
    const mapOpts = {
      invoiceKind: 'PURCHASE' as const,
      currencies,
      items,
      applyTax: isSalesTaxInvoice,
      fallbackUnitId,
    };
    try {
      if (selectedInvoiceId) {
        invoiceUpdateMutation.mutate(
          mapSalesFormToM5UpdateBody(formData, {
            ...mapOpts,
            expectedVersion:
              typeof selectedInvoice?.version === 'number' ? selectedInvoice.version : undefined,
          })
        );
      } else {
        invoiceMutation.mutate(mapSalesFormToM5CreateBody(formData, mapOpts));
      }
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
    const parsed = inventorySupplierInvoiceFormSchema.safeParse({
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
      if (resolvedCashKind === 'cheques' && !cashChequeRows.some((row) => row.chequeNumber.trim())) {
        map.cashCheques = 'أضف شيكاً واحداً على الأقل برقم ومبلغ';
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
  ]);

  const statusTone = isPosted ? 'success' : 'warning';
  const statusLabel = isPosted ? 'مرحّل' : 'مسودة';

  return (
    <ErpDocumentLayout className={ERP_INVOICE_DOCUMENT_LAYOUT_CLASS}>
      {error ? <ErrorToast message={error} onClose={() => setError('')} /> : null}
      {success ? <SuccessToast message={success} onClose={() => setSuccess('')} /> : null}

      {restoreOffer && !selectedInvoiceId ? (
        <PageDraftRestoreBanner
          message="يوجد مسودة فاتورة مشتريات غير محفوظة."
          onRestore={handleRestoreDraft}
          onDismiss={dismissRestore}
        />
      ) : null}

      {draftEnabled && lastSavedAt ? (
        <p className="mb-2 text-xs text-slate-500 text-left" dir="ltr">
          تم حفظ المسودة محلياً · {lastSavedAt.toLocaleTimeString('ar-EG')}
        </p>
      ) : null}

      <PurchaseInvoicePageHeader
        invoiceNumber={invoiceNumber}
        statusTone={statusTone}
        statusLabel={statusLabel}
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
        onDelete={() => {
          if (financialBusy) return;
          void confirmAction('حذف الفاتورة؟').then((ok) => {
            if (ok) invoiceDeleteMutation.mutate({});
          });
        }}
        onOpenJournal={() => {
          if (selectedInvoiceId) {
            router.push(destinationAppTabHref(`/accounting/operations/journal-entry?ref=invoice&id=${selectedInvoiceId}`));
          }
        }}
        onCollectPayment={() => {
          if (!selectedInvoiceId) {
            setError('يرجى اختيار فاتورة أولاً');
            return;
          }
          if (!isPosted) {
            setError('يجب ترحيل الفاتورة قبل تسجيل السداد');
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
          setCollectModalOpen(true);
        }}
        onLinkAdvance={() => {
          if (!selectedInvoiceId) {
            setError('احفظ الفاتورة أولاً');
            return;
          }
          if (!supplierId.trim()) {
            setError('اختر المورد أولاً');
            return;
          }
          if (!isPosted) {
            setError('رحّل الفاتورة أولاً ثم اربط الدفعة المقدمة');
            return;
          }
          const remaining = invoiceRemainingForCollect(selectedInvoice);
          if (remaining === null) {
            setError('لا يوجد مبلغ متبقٍ على الفاتورة');
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
          invalidateQuery(['invoice-settlements-cheques', selectedInvoiceId]);
          setSettlementsHistoryOpen(true);
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
        deletePending={invoiceDeleteMutation.isPending || financialBusy}
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
        whatsAppShare={
          selectedInvoiceId
            ? {
                customerName:
                  (selectedInvoice as { supplier?: { arabicName?: string } } | undefined)?.supplier
                    ?.arabicName ||
                  supplierRef ||
                  'مورد',
                customerPhone: firstPartyPhone(
                  (selectedInvoice as { supplier?: { phone1?: string | null; phone2?: string | null } })
                    ?.supplier
                ),
                companyName: companyProfile?.nameAr || 'Gates',
                invoiceNumber: invoiceNumber || String(selectedInvoice?.invoiceNumber || ''),
                invoiceDate: date || (selectedInvoice?.date ? String(selectedInvoice.date).slice(0, 10) : ''),
                netAmount: Number(financialSummary.netAmount ?? selectedInvoice?.netAmount ?? 0),
                paidAmount: Number(
                  (selectedInvoice as { paidAmount?: number | string } | undefined)?.paidAmount ?? 0
                ),
                remainingAmount: Number(
                  (selectedInvoice as { remainingAmount?: number | string } | undefined)?.remainingAmount ??
                    0
                ),
              }
            : null
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

      <DocumentApprovalBar
        entityType="INVOICE"
        entityId={selectedInvoiceId}
        isPosted={isPosted}
        onError={setError}
        onSuccess={setSuccess}
        postPending={postInvoiceMutation.isPending}
        onPost={handlePostInvoice}
      />

      <DocumentFormLock>
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
        onConfigureSplit={() => setSplitModalOpen(true)}
        onLinkAdvance={() => {
          if (!selectedInvoiceId) {
            setError('احفظ الفاتورة أولاً');
            return;
          }
          if (!supplierId.trim()) {
            setError('اختر المورد أولاً');
            return;
          }
          if (!isPosted) {
            setError('رحّل الفاتورة أولاً ثم اربط الدفعة المقدمة');
            return;
          }
          setLinkAdvanceOpen(true);
        }}
        onConfigureInstallments={() => setInstallmentsModalOpen(true)}
        installmentCount={paymentInstallments.length}
        paymentSplits={paymentSplits}
        warehouseId={warehouseId}
        onWarehouseId={setWarehouseId}
        date={date}
        onDate={setDate}
        invoiceNumber={invoiceNumber}
        onInvoiceNumber={setInvoiceNumber}
        costCenterId={costCenterId}
        onCostCenterId={setCostCenterId}
        delegateId={delegateId}
        onDelegateId={setDelegateId}
        description={description}
        onDescription={setDescription}
        hijriDate={hijriDate}
        onHijriDate={setHijriDate}
        currencyId={currencyId}
        onCurrencyId={setCurrencyId}
        isPurchaseTaxInvoice={isSalesTaxInvoice}
        onPurchaseTaxChange={setIsSalesTaxInvoice}
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
        fieldsDisabled={lockLoadedSource}
        onSourceTypeChange={(type) => {
          setSourceType(type);
          setSourceId('');
          setSourceNumber('');
        }}
        onSourceHydrate={handleSourceHydrate}
      />

      <div className="mt-3">
        <InternalNotesScratchpad
          notes={internalNotes}
          onChange={setInternalNotes}
          disabled={isPosted || lockLoadedSource}
        />
      </div>

      {collectModalOpen ? (
        <InvoiceCollectModal
          open
          mode="pay"
          remaining={invoiceRemainingForCollect(selectedInvoice) ?? 0}
          safes={safesResponse?.data ?? []}
          defaultSafeId={defaultSafeId}
          pending={collectPaymentMutation.isPending}
          onClose={() => setCollectModalOpen(false)}
          onConfirm={(payload) => collectPaymentMutation.mutate(payload)}
        />
      ) : null}

      {linkAdvanceOpen ? (
        <LinkAdvancePaymentModal
          open
          invoiceId={selectedInvoiceId}
          remaining={invoiceRemainingForCollect(selectedInvoice) ?? 0}
          kind="PAYMENT"
          onClose={() => setLinkAdvanceOpen(false)}
        />
      ) : null}

      {splitModalOpen ? (
        <MultiPaymentSplitterModal
          open
          onClose={() => setSplitModalOpen(false)}
          grandTotal={financialSummary.netAmount}
          direction="PAYMENT"
          initial={paymentSplits}
          onConfirm={setPaymentSplits}
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
          onConfirm={setPaymentInstallments}
          disabled={isPosted}
        />
      ) : null}

      <div className="mt-2">
        <ProgressivePurchaseInvoiceLineGrid
          storageKey="gates:columns:purchase-invoice"
          lines={invoiceLines}
          onChange={setInvoiceLines}
          warehouseId={warehouseId}
          visibleColumnIds={visibleColumnIds}
          onVisibleColumnIdsChange={(ids) =>
            setVisibleColumnIds(mergeVisibleColumnIds('gates:columns:purchase-invoice', ids))
          }
          modernUi
          clipboardItems={clipboardItems}
          onClipboardLines={handlePurchaseClipboardLines}
          pricingCalculationBasis={pricingCalculationBasis}
          readOnly={isReadOnly || lockLoadedSource}
          landedCostExtras={{ freightAmount, supplierDiscountAmount }}
          headerDescription={description}
        />
            </div>
      </DocumentFormLock>

      {settlementsHistoryOpen ? (
        <InvoiceSettlementsHistoryModal
          open
          onClose={() => setSettlementsHistoryOpen(false)}
          direction="PAYMENT"
          settlements={settlements}
          cheques={settlementCheques}
          paidAmount={Number((selectedInvoice as { paidAmount?: number } | undefined)?.paidAmount) || 0}
          remainingAmount={invoiceRemainingForCollect(selectedInvoice) ?? 0}
          netAmount={Number((selectedInvoice as { netAmount?: number } | undefined)?.netAmount) || financialSummary.netAmount}
          loading={settlementsLoading || chequesLoading}
        />
      ) : null}

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
        pricingCalculationBasis={pricingCalculationBasis}
        warehouseId={warehouseId}
        journalEntryId={(selectedInvoice as { journalEntryId?: string | null })?.journalEntryId}
        selectedInvoiceId={selectedInvoiceId}
        isPosted={isPosted}
        freightAmount={freightAmount}
        supplierDiscountAmount={supplierDiscountAmount}
        onFreightAmountChange={setFreightAmount}
        onSupplierDiscountAmountChange={setSupplierDiscountAmount}
        extrasReadOnly={isReadOnly || lockLoadedSource}
        settlements={settlements}
        cheques={settlementCheques}
        paidAmount={Number((selectedInvoice as { paidAmount?: number } | undefined)?.paidAmount) || 0}
        remainingAmount={invoiceRemainingForCollect(selectedInvoice) ?? 0}
      />
    </ErpDocumentLayout>
  );
}
