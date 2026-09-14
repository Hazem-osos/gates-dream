'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui';
import { DynamicModalSkeleton, LineGridSkeleton } from '@/components/ui/DynamicChunkSkeleton';
import { useApiQuery, useApiMutation, useInvalidateQuery } from '@/lib/hooks/useApi';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';
import { toastVersionConflict } from '@/lib/feedback/toast';
import { firstPartyPhone } from '@/lib/whatsapp-share';
import { inventorySupplierInvoiceFormSchema } from '@/lib/validation/inventory.schema';
import { mapSalesFormToM5CreateBody, mapSalesFormToM5UpdateBody } from '@/lib/invoices/mapFormToM5Invoice';
import { computeInvoiceFinancialSummary } from '@/lib/invoices/computeInvoiceFinancialSummary';
import type { PurchaseInvoiceLine } from '@/components/inventory/ProgressivePurchaseInvoiceLineGrid';
import {
  mergeVisibleColumnIds,
} from '@/lib/invoices/invoiceLineColumns';
import { useVisibleColumnIds } from '@/lib/invoices/useVisibleColumnIds';
import { defaultUnitIdForItem } from '@/lib/inventory/item-units';
import {
  parsePricingCalculationBasis,
  type PricingCalculationBasis,
} from '@/lib/invoices/unit-conversion';
import { inferDiscountTypeFromApi, inferDiscountValueFromApi } from '@/lib/invoices/discount-type';
import { useCompanyPrintProfile } from '@/lib/hooks/useCompanyPrintProfile';
import { useFirstCompany } from '@/lib/hooks/useFirstCompany';
import { ErpDocumentLayout } from '@/components/erp/ErpDocumentLayout';
import { ERP_INVOICE_DOCUMENT_LAYOUT_CLASS } from '@/components/erp/erpUiTokens';
import { PurchaseInvoicePageHeader } from '@/components/inventory/purchase-invoice/PurchaseInvoicePageHeader';
import { PurchaseInvoiceFormHeader } from '@/components/inventory/purchase-invoice/PurchaseInvoiceFormHeader';
import { InternalNotesScratchpad } from '@/components/documents/InternalNotesScratchpad';
import type { InternalNoteEntry, PaymentSplitLine } from '@/lib/invoices/payment-split.types';
import { legacyCreditToSplit, splitsMatchTotal, withOnAccountRemainder } from '@/lib/invoices/payment-split.types';
import {
  extractPaymentInstallments,
  installmentRowsFromApi,
  stripPaymentInstallmentsNote,
  type PaymentInstallmentRow,
} from '@/lib/invoices/payment-installments';
import { toHijriMedium } from '@/lib/dates/hijri';
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
  pricingCalculationBasis: PricingCalculationBasis;
  invoiceLines: PurchaseInvoiceLine[];
  sourceType: string;
  sourceId: string;
  sourceNumber: string;
};

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
  const searchParams = useSearchParams();
  const { lockToView, setMode, unlockForEdit, isReadOnly } = useDocumentMode();
  const invalidateQuery = useInvalidateQuery();
  const { companyId } = useFirstCompany();
  
  const [isPosted, setIsPosted] = useState(false);
  const [isSalesTaxInvoice, setIsSalesTaxInvoice] = useState(true);
  const [showInvoiceList, setShowInvoiceList] = useState(false);
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
  const [pricingCalculationBasis, setPricingCalculationBasis] =
    useState<PricingCalculationBasis>('SELECTED_UNIT_QTY');
  const [paymentSplits, setPaymentSplits] = useState<PaymentSplitLine[]>([]);
  const [splitModalOpen, setSplitModalOpen] = useState(false);
  const [paymentInstallments, setPaymentInstallments] = useState<PaymentInstallmentRow[]>([]);
  const [installmentsModalOpen, setInstallmentsModalOpen] = useState(false);
  const [internalNotes, setInternalNotes] = useState<InternalNoteEntry[]>([]);
  const [invoiceLines, setInvoiceLines] = useState<PurchaseInvoiceLine[]>([]);
  const [sourceType, setSourceType] = useState('');
  const [sourceId, setSourceId] = useState('');
  const [sourceNumber, setSourceNumber] = useState('');
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
    router.replace(qs ? `?${qs}` : window.location.pathname, { scroll: false });
  }, [fromAiDraft, router, searchParams, selectedInvoiceId]);

  const openInvoice = useCallback((id: string | null) => {
    setSelectedInvoiceId(id);
    const params = new URLSearchParams(searchParams.toString());
    if (id) params.set('invoiceId', id);
    else params.delete('invoiceId');
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : window.location.pathname, { scroll: false });
  }, [router, searchParams]);

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
      pricingCalculationBasis,
      invoiceLines,
      sourceType,
      sourceId,
      sourceNumber,
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
      pricingCalculationBasis,
      invoiceLines,
      sourceType,
      sourceId,
      sourceNumber,
    ]
  );

  const draftEnabled = !selectedInvoiceId && !isPosted;
  const {
    lastSavedAt,
    restoreOffer,
    acceptRestore,
    dismissRestore,
    clearDraft,
  } = useDraftAutosave('gates:draft:purchase-invoice', draftSnapshot, draftEnabled);

  useEffect(() => {
    if (!restoreOffer || selectedInvoiceId) return;
    const d = restoreOffer as PurchaseInvoiceDraft;
    const hasContent =
      Boolean(d.supplierId?.trim()) || d.invoiceLines.length > 0 || Boolean(d.description?.trim());
    if (!hasContent) dismissRestore();
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
    if (paymentType === 'cash') return;
    if (paymentType === 'credit') {
      setPaymentType('split');
      return;
    }
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
    const loaded = legacyCreditToSplit(
      (selectedInvoice as { paymentMethod?: string }).paymentMethod ??
        String(selectedInvoice.paymentType ?? ''),
      Array.isArray(rawSplits) ? rawSplits : [],
      invoiceNet
    );
    setPaymentType(loaded.method);
    setPaymentSplits(loaded.splits);
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
        setSelectedInvoiceId(null);
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
    const today = new Date().toISOString().split('T')[0];
    setDate(today);
    setPaymentType('cash');
    setPaymentSplits([]);
    setPaymentInstallments([]);
    setInternalNotes([]);
    setPricingCalculationBasis(
      parsePricingCalculationBasis(companySettingsRes?.data?.pricingCalculationBasis)
    );
    clearDraft();
  }, [clearDraft, companySettingsRes?.data?.pricingCalculationBasis]);

  const handleRestoreDraft = () => {
    const payload = acceptRestore() as PurchaseInvoiceDraft | null;
    if (!payload) return;
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
    setPaymentType(payload.paymentType === 'cash' ? 'cash' : 'split');
    setPricingCalculationBasis(parsePricingCalculationBasis(payload.pricingCalculationBasis));
    setInvoiceLines(payload.invoiceLines ?? []);
    setSourceType(payload.sourceType ?? '');
    setSourceId(payload.sourceId ?? '');
    setSourceNumber(payload.sourceNumber ?? '');
    setSuccess('تم استعادة مسودة فاتورة المشتريات');
  };

  const invoiceMutation = useApiMutation<unknown, Record<string, unknown>>('/invoices', 'POST', {
    onSuccess: () => {
      setSuccess('تم حفظ فاتورة المشتريات بنجاح');
      clearDraft();
      invalidateQuery(['invoices']);
      handleNew();
    },
    onError: (err) => setError(err.message || 'حدث خطأ أثناء الحفظ'),
  });

  const invoiceUpdateMutation = useApiMutation<unknown, Record<string, unknown>>(
    selectedInvoiceId ? `/invoices/${selectedInvoiceId}` : '/invoices',
    'PUT',
    {
      onSuccess: () => {
        setSuccess('تم تحديث فاتورة المشتريات بنجاح');
        invalidateQuery(['invoices']);
        invalidateQuery(['invoice', selectedInvoiceId]);
      },
      onError: (err) => {
        if (err.code === '409') {
          toastVersionConflict(err.message, () => invalidateQuery(['invoice', selectedInvoiceId]));
          return;
        }
        setError(err.message || 'حدث خطأ أثناء التحديث');
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

  const { data: safesResponse } = useApiQuery<Array<{ id: string }>>(
    ['accounting', 'safes', 'settlement'],
    '/accounting/safes',
    { page: 1, limit: 50 }
  );
  const defaultSafeId = safesResponse?.data?.[0]?.id;

  const collectPaymentMutation = useApiMutation<unknown, Record<string, unknown>>(
    selectedInvoiceId ? `/invoices/${selectedInvoiceId}/settlements` : '/invoices',
    'POST',
    {
      onSuccess: () => {
        setSuccess('تم تسجيل الدفع بنجاح');
        invalidateQuery(['invoice', selectedInvoiceId]);
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

  const handleSaveDraft = () => {
    if (financialBusy || isPosted) return;
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
                  lines: invoiceLines.map((line) => ({
                    itemId: line.itemId,
                    quantity: line.quantity,
                    unitPrice: line.unitPrice,
                    discount: line.discount ?? 0,
                    tax: line.tax ?? 0,
                  })),
                });
                if (!parsed.success) {
                  setError(parsed.error.issues[0]?.message ?? 'خطأ في البيانات');
                  return;
                }
                const d = parsed.data;
                const resolvedMethod = paymentType === 'cash' ? 'cash' : 'split';
                const splitLines =
                  resolvedMethod === 'split'
                    ? withOnAccountRemainder(paymentSplits, financialSummary.netAmount)
                    : undefined;
                if (resolvedMethod === 'split' && !splitsMatchTotal(splitLines ?? [], financialSummary.netAmount)) {
                  setError('وزّع الدفع المتعدد ليطابق إجمالي الفاتورة');
                  setSplitModalOpen(true);
                  return;
                }
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
                  paymentSplits: resolvedMethod === 'split' ? splitLines : undefined,
                  internalNotes,
                  installments: paymentInstallments.map((row) => ({
                    installmentNumber: row.number,
                    dueDate: row.dueDate,
                    hijriDueDate: toHijriMedium(row.dueDate),
                    amount: row.amount,
                  })),
                  lines: d.lines.map((line, index) => ({
                    itemId: line.itemId,
                    unitId: invoiceLines[index]?.unitId,
                    quantity: line.quantity,
                    baseQuantity: invoiceLines[index]?.baseQuantity,
                    conversionFactor: invoiceLines[index]?.conversionFactor,
                    baseUnitId: invoiceLines[index]?.baseUnitId,
                    unitPrice: line.unitPrice,
                    discount: invoiceLines[index]?.discountValue ?? invoiceLines[index]?.discount ?? line.discount ?? 0,
                    discountValue: invoiceLines[index]?.discountValue ?? invoiceLines[index]?.discount ?? line.discount ?? 0,
                    discountType: invoiceLines[index]?.discountType,
                    taxRate: line.tax ?? 0,
                    warehouseId: invoiceLines[index]?.warehouseId || d.warehouseId,
                  })),
                };
                const mapOpts = { invoiceKind: 'PURCHASE' as const, currencies, items };
                try {
                  if (selectedInvoiceId) {
                    invoiceUpdateMutation.mutate(
                      mapSalesFormToM5UpdateBody(formData, {
                        ...mapOpts,
                        expectedVersion:
                          typeof selectedInvoice?.version === 'number'
                            ? selectedInvoice.version
                            : undefined,
                      })
                    );
                  } else {
                    invoiceMutation.mutate(mapSalesFormToM5CreateBody(formData, mapOpts));
                  }
                } catch (e) {
                  setError(e instanceof Error ? e.message : 'تعذر تجهيز الفاتورة');
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
      description,
      date,
      warehouseId,
      supplierId,
      lines: invoiceLines,
    });
    if (parsed.success) return {};
    const map: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const path = issue.path[0];
      if (path === 'supplierId') map.supplierId = issue.message;
      if (path === 'warehouseId') map.warehouseId = issue.message;
      if (path === 'date') map.date = issue.message;
    }
    return map;
  }, [submitAttempt, invoiceNumber, description, date, warehouseId, supplierId, invoiceLines]);

  const statusTone = isPosted ? 'success' : 'warning';
  const statusLabel = isPosted ? 'مرحّل' : 'مسودة';

  return (
    <ErpDocumentLayout className={ERP_INVOICE_DOCUMENT_LAYOUT_CLASS}>
      {error ? <ErrorToast message={error} onClose={() => setError('')} /> : null}
      {success ? <SuccessToast message={success} onClose={() => setSuccess('')} /> : null}

      {restoreOffer && !selectedInvoiceId ? (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
          <span>يوجد مسودة فاتورة مشتريات غير محفوظة.</span>
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="primary" onClick={handleRestoreDraft}>
              استعادة
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={dismissRestore}>
              تجاهل
            </Button>
                </div>
              </div>
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
        onPost={() => {
          if (financialBusy) return;
          if (!selectedInvoiceId) {
            setError('احفظ الفاتورة أولاً');
            return;
          }
          postInvoiceMutation.mutate({});
        }}
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
          if (window.confirm('حذف الفاتورة؟')) invoiceDeleteMutation.mutate({});
        }}
        onOpenJournal={() => {
          if (selectedInvoiceId) {
            router.push(`/accounting/operations/journal-entry?ref=invoice&id=${selectedInvoiceId}`);
          }
        }}
        onCollectPayment={() => {
          const remaining = invoiceRemainingForCollect(selectedInvoice);
          if (!selectedInvoiceId || !defaultSafeId || remaining === null) {
            setError('تعذر السداد — تحقق من الفاتورة والخزينة');
            return;
          }
          collectPaymentMutation.mutate({
            amount: remaining,
            safeId: defaultSafeId,
            date: new Date().toISOString(),
          });
        }}
        onPaymentHistory={() => invalidateQuery(['invoice-settlements', selectedInvoiceId])}
        onCreateReturn={() => {
          if (!selectedInvoiceId) {
            setError('يرجى اختيار فاتورة أولاً');
            return;
          }
          if (!isPosted) {
            setError('يجب ترحيل الفاتورة قبل إنشاء مرتجع');
            return;
          }
          router.push(`/inventory/operations/purchase-returns?fromInvoice=${selectedInvoiceId}`);
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
        onPost={() => postInvoiceMutation.mutate({})}
      />

      <DocumentFormLock>
      <PurchaseInvoiceFormHeader
        supplierId={supplierId}
        onSupplierId={setSupplierId}
        paymentType={paymentType}
        onPaymentType={setPaymentType}
        onConfigureSplit={() => setSplitModalOpen(true)}
        onConfigureInstallments={() => setInstallmentsModalOpen(true)}
        installmentCount={paymentInstallments.length}
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
          disabled={isPosted}
        />
      </div>

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
          readOnly={isReadOnly}
          landedCostExtras={{ freightAmount, supplierDiscountAmount }}
        />
            </div>
      </DocumentFormLock>

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
        extrasReadOnly={isReadOnly}
      />
    </ErpDocumentLayout>
  );
}
