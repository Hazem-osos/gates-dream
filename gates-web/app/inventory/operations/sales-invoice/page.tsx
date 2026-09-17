'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { destinationAppTabHref } from '@/lib/navigation/tab-memory';
import { useOwnTabPathname, useOwnTabSearchParams } from '@/lib/navigation/tab-route-lock';
import { useForm, useFieldArray, useWatch, type FieldErrors, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui';
import { DynamicModalSkeleton, LineGridSkeleton } from '@/components/ui/DynamicChunkSkeleton';
import { useApiQuery, useApiMutation, useInvalidateQuery } from '@/lib/hooks/useApi';
import { apiClient } from '@/lib/api/client';
import type { TransactionSettings } from '@/lib/transaction-settings/types';
import { TransactionSettingsDrawer } from '@/components/settings/transaction-settings/TransactionSettingsDrawer';
import { dispatchAutoPrintAfterSave } from '@/lib/printer/print-prefs';
import { useAccountingSettingsQuery } from '@/lib/hooks/useAccountingSettings';
import type { ApiError } from '@/lib/api/types';
import {
  computeInvoiceFinancialSummary,
  computeInvoiceGrossDiscount,
  developmentFeeFormFromInvoice,
} from '@/lib/invoices/computeInvoiceFinancialSummary';
import type { SalesInvoiceDetail } from '@/lib/inventory/transaction-types';
import { resolveUnitPrice, type PriceTier } from '@/lib/inventory/pricing-engine';
import { toast, toastInvoiceSaveError, toastVersionConflict } from '@/lib/feedback/toast';
import { confirmAction } from '@/lib/feedback/confirm';
import { dispatchAcademyTrigger } from '@/lib/onboarding/tourCheckpoints';
import { AutoSaveStatusIndicator } from '@/components/feedback/AutoSaveStatusIndicator';
import {
  salesInvoiceSchema,
  type SalesInvoiceFormValues,
} from '@/lib/validation/inventory.schema';
import {
  mapSalesFormToM5CreateBody,
  mapSalesFormToM5UpdateBody,
} from '@/lib/invoices/mapFormToM5Invoice';
import { readSalesInvoiceVatDefault, persistSalesInvoiceVatDefault } from '@/lib/inventory/sales-invoice-tax-prefs';
import { toHijri } from '@/lib/dates/hijri';
import { defaultUnitIdForItem } from '@/lib/inventory/item-units';
import { parsePricingCalculationBasis, syncLineUnitFields } from '@/lib/invoices/unit-conversion';
import { inferDiscountTypeFromApi, inferDiscountValueFromApi } from '@/lib/invoices/discount-type';
import { useFirstCompany } from '@/lib/hooks/useFirstCompany';
import {
  mergeVisibleColumnIds,
} from '@/lib/invoices/invoiceLineColumns';
import { useVisibleColumnIds } from '@/lib/invoices/useVisibleColumnIds';
import { useDocumentProfileBySlug } from '@/lib/hooks/useDocumentProfiles';
import { columnsFromDocumentProfile } from '@/lib/document-profiles/columns';
import { previewProfileNumber } from '@/lib/document-profiles/types';
import { SalesInvoicePageHeader } from '@/components/inventory/sales-invoice/SalesInvoicePageHeader';
import { ErpDocumentLayout } from '@/components/erp/ErpDocumentLayout';
import { PageDraftRestoreBanner } from '@/components/erp/PageDraftRestoreBanner';
import { ERP_INVOICE_DOCUMENT_LAYOUT_CLASS } from '@/components/erp/erpUiTokens';
import { SalesInvoiceFormHeader } from '@/components/inventory/sales-invoice/SalesInvoiceFormHeader';
import { SalesInvoiceBottomSplit } from '@/components/inventory/sales-invoice/SalesInvoiceBottomSplit';
import { InvoiceExtrasPanel } from '@/components/inventory/invoices/InvoiceExtrasPanel';
import {
  extrasFromApi,
  extrasToApi,
  sumPartyInvoiceExtras,
  type InvoiceExtraRow,
} from '@/lib/invoices/invoice-adjustments';
import { DocumentApprovalBar } from '@/app/components/accounting/DocumentApprovalBar';
import { useCompanyPrintProfile } from '@/lib/hooks/useCompanyPrintProfile';
import { pickDefaultSafeId, useCustomersQuery } from '@/lib/hooks/useMasterDataQueries';
import { firstPartyPhone, type WhatsAppInvoicePayload } from '@/lib/whatsapp-share';
import { consumeAiTransactionDraft } from '@/lib/ai/ai-draft-storage';
import { invoiceDateFromDraft, salesLinesFromAiDraft } from '@/lib/ai/hydrate-ai-draft';
import { useDraftAutosave } from '@/lib/hooks/useDraftAutosave';
import { useDocumentConvertMutation } from '@/lib/hooks/useDocumentConvert';
import {
  DocumentFormLock,
  DocumentModeProvider,
  DocumentReadOnlyBanner,
  useDocumentMode,
} from '@/components/common/document-shell';
import {
  mergeSourceNote,
  sourceLineToSalesRow,
  type SourceHydratePayload,
} from '@/lib/invoices/sourceDocument';
import { useCustomerFrequentItems } from '@/lib/hooks/useCustomerFrequentItems';
import { CustomerFrequentItemsBar } from '@/components/inventory/CustomerFrequentItemsBar';
import { InternalNotesScratchpad } from '@/components/documents/InternalNotesScratchpad';
import { ElectronicInvoiceDetailsButton } from '@/components/inventory/sales-invoice/ElectronicInvoiceDetailsButton';
import type { InternalNoteEntry, PaymentSplitLine } from '@/lib/invoices/payment-split.types';
import {
  creditAdvanceToSplits,
  resolveInvoicePaymentUi,
  splitsMatchTotal,
  withOnAccountRemainder,
} from '@/lib/invoices/payment-split.types';
import {
  extractEInvoiceDetails,
  stripEInvoiceDetailsNote,
  withEInvoiceDetailsNote,
} from '@/lib/invoices/e-invoice-order-details';
import {
  extractPaymentTermsMethod,
  stripPaymentTermsMethodNote,
  withPaymentTermsMethodNote,
} from '@/lib/invoices/payment-terms-method';
import {
  extractPaymentInstallments,
  installmentRowsFromApi,
  stripPaymentInstallmentsNote,
  type PaymentInstallmentRow,
} from '@/lib/invoices/payment-installments';
import { toHijriMedium } from '@/lib/dates/hijri';
import { getTenantContext } from '@/lib/tenant/tenant-context-storage';

const SalesInvoiceLinesGrid = dynamic(
  () =>
    import('@/components/inventory/sales-invoice/SalesInvoiceLinesGrid').then((m) => ({
      default: m.SalesInvoiceLinesGrid,
    })),
  { ssr: false, loading: () => <LineGridSkeleton label="جاري تحميل بنود فاتورة المبيعات…" /> }
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

const BarcodePrintModal = dynamic(
  () =>
    import('@/app/components/print/BarcodePrintModal').then((m) => ({
      default: m.BarcodePrintModal,
    })),
  { ssr: false, loading: () => <DynamicModalSkeleton label="جاري تحميل طباعة الباركود…" /> }
);

const InvoiceCollectModal = dynamic(
  () =>
    import('@/components/inventory/sales-invoice/InvoiceCollectModal').then((m) => ({
      default: m.InvoiceCollectModal,
    })),
  { ssr: false, loading: () => <DynamicModalSkeleton label="جاري تحميل التحصيل…" /> }
);

const ConditionEditor = dynamic(
  () =>
    import('@/components/inventory/sales-invoice/ConditionEditor').then((m) => ({
      default: m.ConditionEditor,
    })),
  { ssr: false, loading: () => <DynamicModalSkeleton label="جاري تحميل الشروط…" /> }
);

interface Item {
  id: string;
  code?: string;
  serial?: string;
  barcode?: string;
  arabicName: string;
  englishName?: string;
  units?: {
    unitId?: string;
    isBaseUnit?: boolean;
    isFactorFixed?: boolean | null;
    conversionFactor?: number | string | null;
    unit?: { id: string; code?: string; arabicName: string };
  }[];
  defaultTaxPercent?: number | string | null;
  taxExemptionReason?: string | null;
  defaultWarehouseId?: string | null;
}

interface Currency {
  id: string;
  code: string;
  arabicName: string;
  englishName?: string;
  exchangeRate?: number | string | null;
}

interface Branch {
  id: string;
  arabicName?: string;
  defaultWarehouseId?: string | null;
}

interface Delegate {
  id: string;
  code: string;
  arabicName: string;
  englishName?: string;
}

const SALES_INVOICE_LINE_GRID = 'sales-invoice-lines';

function defaultSalePriceForItem(
  item: Item & {
    salesPrice?: number;
    priceRetail?: number;
    priceSemiWholesale?: number;
    priceWholesale?: number;
    priceProjects?: number;
    itemPrices?: { price?: number; priceList?: { isDefault?: boolean } }[];
  },
  priceTier?: PriceTier | string | null
): number {
  const tierPrice = resolveUnitPrice(priceTier, item);
  if (tierPrice > 0) return tierPrice;
  if (typeof item.salesPrice === 'number' && item.salesPrice > 0) return item.salesPrice;
  const prices = item.itemPrices;
  if (prices?.length) {
    const def = prices.find((p) => p.priceList?.isDefault) ?? prices[0];
    if (def?.price != null) return Number(def.price);
  }
  return 0;
}

function invoiceRemainingForCollect(inv: Record<string, unknown> | undefined): number | null {
  if (!inv) return null;
  const net = Number(inv.netAmount ?? inv.totalAmount ?? 0);
  const paid = Number(inv.paidAmount ?? 0);
  const r = net - paid;
  return r > 0 ? r : null;
}

function firstErrorMessage(errors: FieldErrors | undefined): string | undefined {
  if (!errors) return undefined;
  for (const value of Object.values(errors)) {
    if (!value || typeof value !== 'object') continue;
    if ('message' in value && typeof value.message === 'string' && value.message.trim()) {
      return value.message;
    }
    const nested = firstErrorMessage(value as FieldErrors);
    if (nested) return nested;
  }
  return undefined;
}

function blankSalesInvoiceLine(
  overrides: Partial<SalesInvoiceFormValues['lines'][number]> = {}
): SalesInvoiceFormValues['lines'][number] {
  return {
    itemId: '',
    unitId: '',
    quantity: 1,
    baseQuantity: 1,
    conversionFactor: 1,
    baseUnitId: '',
    unitPrice: 0,
    discount: 0,
    discountValue: 0,
    discountType: 'PERCENTAGE',
    taxRate: 0,
    warehouseId: '',
    withholdingTaxRate: 0,
    withholdingTaxAmount: 0,
    costCenterId: '',
    color: '',
    size: '',
    customRevenueAccountId: '',
    batchAllocations: [],
    ...overrides,
  };
}

function isSalesInvoiceDraftEmpty(draft: SalesInvoiceFormValues) {
  const hasLine = (draft.lines ?? []).some((line) => Boolean(line.itemId?.trim()));
  return !draft.customerId?.trim() && !draft.description?.trim() && !hasLine;
}

function emptySalesInvoiceDefaults(): SalesInvoiceFormValues {
  const today = new Date().toISOString().split('T')[0];
  return {
    customerId: '',
    date: today,
    dueDate: '',
    paymentMethod: 'cash',
    paymentTermsMethod: '',
    pricingCalculationBasis: 'SELECTED_UNIT_QTY',
    advancePaidAmount: 0,
    advanceSafeId: '',
    warehouseId: '',
    invoiceNumber: '',
    description: '',
    hijriDate: toHijri(today),
    currencyId: '',
    exchangeRate: undefined,
    costCenterId: '',
    delegateId: '',
    sellerId: '',
    taxTreatmentType: undefined,
    allowReturn: false,
    returnDays: undefined,
    isDelivered: false,
    handoverDate: '',
    printTermsOnInvoice: false,
    treasuryId: '',
    salesOrderNumber: '',
    salesOrderDescription: '',
    purchaseOrderNumber: '',
    purchaseOrderDescription: '',
    sourceType: 'NONE',
    sourceId: '',
    sourceNumber: '',
    developmentFeeEnabled: false,
    developmentFeeMode: 'percent',
    developmentFeeRate: 1,
    developmentFeeFixedAmount: undefined,
    lines: [blankSalesInvoiceLine()],
  };
}

export default function SalesInvoicePage() {
  return (
    <DocumentModeProvider>
      <SalesInvoicePageInner />
    </DocumentModeProvider>
  );
}

function SalesInvoicePageInner() {
  const router = useRouter();
  const { lockToView, setMode, unlockForEdit, isReadOnly, isEditing } = useDocumentMode();
  const { companyId } = useFirstCompany();
  const searchParams = useOwnTabSearchParams();
  const ownPathname = useOwnTabPathname();
  const showOnboardingGuide = searchParams.get('onboarding') === '1';
  const invoiceIdFromUrl = searchParams.get('invoiceId');
  const fromAiDraft = searchParams.get('fromAiDraft') === '1';
  const profileSlug = searchParams.get('profile');
  const { data: profileRes } = useDocumentProfileBySlug(profileSlug);
  const documentProfile = profileRes?.data ?? null;
  const { data: txSettingsRes } = useApiQuery<TransactionSettings>(
    ['transaction-settings', 'SALES_INVOICE'],
    '/transaction-settings/SALES_INVOICE'
  );
  const txSettings = txSettingsRes?.data;
  const { data: accountingSettingsRes } = useAccountingSettingsQuery();
  const defaultWhtRate =
    txSettings?.autoApplyWht === true
      ? Number(accountingSettingsRes?.data?.tax?.whtRate ?? 1) || 1
      : 0;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const invalidateQuery = useInvalidateQuery();
  
  const [isPosted, setIsPosted] = useState(false);
  const [isApproved, setIsApproved] = useState(false);
  const [printEnglishInvoice, setPrintEnglishInvoice] = useState(false);
  const [dontPrintEmptyLines, setDontPrintEmptyLines] = useState(false);
  const [showPrint, setShowPrint] = useState(false);
  const [collectModalOpen, setCollectModalOpen] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [conditions, setConditions] = useState<string[]>(['']);
  const [isSalesTaxInvoice, setIsSalesTaxInvoice] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    watch,
    reset,
    setValue,
    getValues,
    trigger,
    formState: { errors, submitCount },
  } = useForm<SalesInvoiceFormValues>({
    resolver: zodResolver(salesInvoiceSchema) as Resolver<SalesInvoiceFormValues>,
    defaultValues: emptySalesInvoiceDefaults(),
    mode: 'onTouched',
  });

  const { fields, append, remove, replace } = useFieldArray({
    control,
    name: 'lines',
  });

  const currencyIdW = watch('currencyId');
  const customerIdW = watch('customerId');
  const invoiceNumberW = watch('invoiceNumber');
  const dateW = watch('date');
  const paymentMethodW = watch('paymentMethod');
  const warehouseIdW = watch('warehouseId');
  const prevHeaderWarehouseRef = useRef(warehouseIdW);
  const allowReturnW = watch('allowReturn');
  const printTermsOnInvoiceW = watch('printTermsOnInvoice');
  const developmentFeeEnabledW = watch('developmentFeeEnabled');
  const pricingCalculationBasisW = watch('pricingCalculationBasis');
  const { data: companySettingsRes } = useApiQuery<{ pricingCalculationBasis?: string }>(
    ['company-settings', companyId ?? 'none', 'pricing-basis'],
    `/companies/${companyId}/settings`,
    undefined,
    { enabled: Boolean(companyId) }
  );
  const developmentFeeModeW = watch('developmentFeeMode');
  const developmentFeeRateW = watch('developmentFeeRate');
  const developmentFeeFixedAmountW = watch('developmentFeeFixedAmount');
  const exchangeRateW = watch('exchangeRate');
  const descriptionW = watch('description');

  useEffect(() => {
    if (allowReturnW) {
      setValue('returnDays', 365);
    } else {
      setValue('returnDays', undefined);
    }
  }, [allowReturnW, setValue]);

  useEffect(() => {
    const prev = prevHeaderWarehouseRef.current;
    prevHeaderWarehouseRef.current = warehouseIdW;
    if (!warehouseIdW || prev === warehouseIdW) return;
    const lines = getValues('lines') ?? [];
    lines.forEach((line, index) => {
      const current = line.warehouseId?.trim() ?? '';
      if (!current || current === prev) {
        setValue(`lines.${index}.warehouseId`, warehouseIdW, { shouldDirty: Boolean(current) });
      }
    });
  }, [getValues, setValue, warehouseIdW]);
  const watchedLines = useWatch({ control, name: 'lines', defaultValue: [] });
  const formSnapshot = useWatch({ control }) as SalesInvoiceFormValues;
  const barcodePrintItemIds = useMemo(
    () => [...new Set((watchedLines ?? []).map((l) => l.itemId).filter((id): id is string => Boolean(id?.trim())))],
    [watchedLines]
  );

  const documentConvertMutation = useDocumentConvertMutation();

  const [showInvoiceList, setShowInvoiceList] = useState(false);

  const [userVisibleColumnIds, setUserVisibleColumnIds] = useVisibleColumnIds(
    'gates:columns:sales-invoice',
    companyId
  );
  const visibleColumnIds = documentProfile
    ? columnsFromDocumentProfile(documentProfile.visibleColumns)
    : userVisibleColumnIds;
  const setVisibleColumnIds = documentProfile ? () => undefined : setUserVisibleColumnIds;

  const appendBlankInvoiceLine = useCallback(() => {
    append(
      blankSalesInvoiceLine({
        taxRate: isSalesTaxInvoice ? 14 : 0,
        warehouseId: getValues('warehouseId') || '',
        withholdingTaxRate: defaultWhtRate,
        costCenterId: getValues('costCenterId') || txSettings?.defaultCostCenterId || '',
        customRevenueAccountId: txSettings?.defaultSalesAccountId || '',
        lineNotes: getValues('description') || '',
      })
    );
  }, [append, defaultWhtRate, getValues, isSalesTaxInvoice, txSettings]);

  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(() =>
    invoiceIdFromUrl?.trim() ? invoiceIdFromUrl.trim() : null
  );

  useEffect(() => {
    if (selectedInvoiceId) return;
    const fromCompany = parsePricingCalculationBasis(companySettingsRes?.data?.pricingCalculationBasis);
    if (getValues('pricingCalculationBasis') !== fromCompany) {
      setValue('pricingCalculationBasis', fromCompany, { shouldDirty: false });
    }
  }, [companySettingsRes?.data?.pricingCalculationBasis, getValues, selectedInvoiceId, setValue]);

  const skipUrlHydrateRef = useRef(false);

  useEffect(() => {
    const id = invoiceIdFromUrl?.trim();
    if (skipUrlHydrateRef.current) {
      if (!id) skipUrlHydrateRef.current = false;
      return;
    }
    if (id && id !== selectedInvoiceId) {
      setSelectedInvoiceId(id);
    }
  }, [invoiceIdFromUrl, selectedInvoiceId]);

  useEffect(() => {
    if (!selectedInvoiceId) {
      setMode('create');
      return;
    }
    if (isPosted) lockToView();
    else setMode('edit');
  }, [isPosted, lockToView, selectedInvoiceId, setMode]);

  const aiDraftAppliedRef = useRef(false);
  useEffect(() => {
    if (aiDraftAppliedRef.current || !fromAiDraft || selectedInvoiceId) return;
    const draft = consumeAiTransactionDraft(['DRAFT_SALES_INVOICE', 'CREATE_INVOICE']);
    if (!draft) return;
    aiDraftAppliedRef.current = true;
    const payload = draft.draftPayload;
    const date = invoiceDateFromDraft(payload);
    reset({
      ...emptySalesInvoiceDefaults(),
      customerId: String(payload.customerId ?? ''),
      warehouseId: String(payload.warehouseId ?? ''),
      description: typeof payload.description === 'string' ? payload.description : '',
      paymentMethod: payload.paymentMethod === 'cash' ? 'cash' : 'credit',
      date,
      hijriDate: toHijri(date),
      lines: salesLinesFromAiDraft(payload, isSalesTaxInvoice),
    });
    const params = new URLSearchParams(searchParams.toString());
    params.delete('fromAiDraft');
    const qs = params.toString();
    router.replace(qs ? `${ownPathname}?${qs}` : ownPathname, { scroll: false });
  }, [fromAiDraft, isSalesTaxInvoice, ownPathname, reset, router, searchParams, selectedInvoiceId]);

  const openInvoice = useCallback(
    (id: string | null) => {
      setSelectedInvoiceId(id);
      const params = new URLSearchParams(searchParams.toString());
      if (id) params.set('invoiceId', id);
      else params.delete('invoiceId');
      const qs = params.toString();
      router.replace(qs ? `${ownPathname}?${qs}` : ownPathname, { scroll: false });
    },
    [ownPathname, router, searchParams]
  );
  const [bottomSplitTab, setBottomSplitTab] = useState('gl');
  const [paymentSplits, setPaymentSplits] = useState<PaymentSplitLine[]>([]);
  const [invoiceExtras, setInvoiceExtras] = useState<InvoiceExtraRow[]>([]);
  const [extrasOpen, setExtrasOpen] = useState(false);
  const [splitModalOpen, setSplitModalOpen] = useState(false);
  const [paymentInstallments, setPaymentInstallments] = useState<PaymentInstallmentRow[]>([]);
  const [installmentsModalOpen, setInstallmentsModalOpen] = useState(false);
  const [internalNotes, setInternalNotes] = useState<InternalNoteEntry[]>([]);
  const [customerSeed, setCustomerSeed] = useState<{
    id: string;
    arabicName: string;
    code?: string | null;
  } | null>(null);

  const draftEnabled = !selectedInvoiceId && !isPosted;
  const {
    autosaveStatus,
    restoreOffer,
    acceptRestore,
    dismissRestore,
    clearDraft,
  } = useDraftAutosave('gates:draft:sales-invoice', formSnapshot, draftEnabled, {
    applyRestore: (payload) => reset(payload),
    isEmpty: isSalesInvoiceDraftEmpty,
    restoreMessage: 'تم استعادة المسودة المحفوظة',
  });

  useEffect(() => {
    if (!restoreOffer || selectedInvoiceId) return;
    if (aiDraftAppliedRef.current || isSalesInvoiceDraftEmpty(restoreOffer)) {
      dismissRestore();
    }
  }, [restoreOffer, selectedInvoiceId, dismissRestore]);

  // Fetch single invoice for editing
  const { data: invoiceResponse } = useApiQuery<SalesInvoiceDetail>(
    ['invoice', selectedInvoiceId],
    `/invoices/${selectedInvoiceId}`,
    undefined,
    { enabled: !!selectedInvoiceId }
  );
  const selectedInvoice = selectedInvoiceId ? invoiceResponse?.data : undefined;

  const handleSalesTaxChange = useCallback(
    (enabled: boolean) => {
      setIsSalesTaxInvoice(enabled);
      persistSalesInvoiceVatDefault(enabled);
      const lines = getValues('lines') ?? [];
      lines.forEach((_, index) => {
        setValue(`lines.${index}.taxRate`, enabled ? 14 : 0, { shouldDirty: true });
      });
    },
    [getValues, setValue]
  );

  const financialSummary = useMemo(() => {
    const lines = watchedLines ?? [];
    const { gross, commercialDiscount } = computeInvoiceGrossDiscount(lines, pricingCalculationBasisW);
    const extrasNet = sumPartyInvoiceExtras(
      invoiceExtras,
      gross - commercialDiscount,
      Number(exchangeRateW) > 0 ? Number(exchangeRateW) : 1
    );
    return computeInvoiceFinancialSummary(lines, {
      applyTax: isSalesTaxInvoice,
      withholdingTaxAmount: Number(selectedInvoice?.withholdingTaxAmount ?? 0),
      developmentFeeEnabled: developmentFeeEnabledW,
      developmentFeeMode: developmentFeeModeW,
      developmentFeeRate: developmentFeeRateW,
      developmentFeeFixedAmount: developmentFeeFixedAmountW,
      pricingCalculationBasis: pricingCalculationBasisW,
      additionsAndDiscounts: extrasNet,
    });
  }, [
    watchedLines,
    isSalesTaxInvoice,
    selectedInvoice?.withholdingTaxAmount,
    developmentFeeEnabledW,
    developmentFeeModeW,
    developmentFeeRateW,
    developmentFeeFixedAmountW,
    pricingCalculationBasisW,
    invoiceExtras,
    exchangeRateW,
  ]);

  const { profile: companyProfile } = useCompanyPrintProfile();
  const { data: customersResponse } = useCustomersQuery();
  const customers = useMemo(() => customersResponse?.data ?? [], [customersResponse?.data]);
  const whatsAppSharePayload = useMemo<WhatsAppInvoicePayload | null>(() => {
    if (!selectedInvoiceId) return null;
    const listed = customers.find((c) => c.id === customerIdW);
    const loaded = (selectedInvoice as { customer?: { arabicName?: string; mobile?: string | null; phone1?: string | null; phone2?: string | null } } | undefined)
      ?.customer;
    const amounts = selectedInvoice as
      | { netAmount?: number | string; paidAmount?: number | string; remainingAmount?: number | string; date?: string }
      | undefined;
    return {
      customerName: listed?.arabicName || loaded?.arabicName || 'عميل',
      customerPhone: firstPartyPhone(listed) || firstPartyPhone(loaded),
      companyName: companyProfile?.nameAr || 'Gates',
      invoiceNumber: invoiceNumberW || String(selectedInvoice?.invoiceNumber || ''),
      invoiceDate: dateW || (amounts?.date ? String(amounts.date).slice(0, 10) : ''),
      netAmount: Number(amounts?.netAmount ?? 0),
      paidAmount: Number(amounts?.paidAmount ?? 0),
      remainingAmount: Number(amounts?.remainingAmount ?? 0),
    };
  }, [
    selectedInvoiceId,
    selectedInvoice,
    customers,
    customerIdW,
    companyProfile?.nameAr,
    invoiceNumberW,
    dateW,
  ]);
  const selectedCustomerTier = useMemo(() => {
    const c = customers.find((x) => x.id === customerIdW) as { priceTier?: PriceTier } | undefined;
    return c?.priceTier ?? 'RETAIL';
  }, [customers, customerIdW]);

  const applyPickedItemToLine = useCallback(
    (index: number, picked: Item | undefined) => {
      if (!picked) return;
      setValue(`lines.${index}.unitId`, defaultUnitIdForItem(picked), { shouldDirty: true });
      setValue(
        `lines.${index}.unitPrice`,
        defaultSalePriceForItem(
          picked as Item & {
            salesPrice?: number;
            priceRetail?: number;
            priceSemiWholesale?: number;
            priceWholesale?: number;
            priceProjects?: number;
            itemPrices?: { price?: number; priceList?: { isDefault?: boolean } }[];
          },
          selectedCustomerTier
        ),
        { shouldDirty: true }
      );
      const customerId = getValues('customerId');
      void apiClient
        .get<{ unitPrice: number }>(`/inventory/items/${picked.id}/pricing-policy`, {
          customerId: customerId || undefined,
          policy: txSettings?.pricingPolicy,
        })
        .then((res) => {
          const price = Number(res.data?.unitPrice ?? 0);
          if (price > 0) {
            setValue(`lines.${index}.unitPrice`, price, { shouldDirty: true });
          }
        })
        .catch(() => undefined);
      // Sales Invoice Enterprise Redesign: an item-level tax-profile override
      // (`defaultTaxPercent`/`taxExemptionReason`, set via the item quick-add
      // modal or item master) takes precedence over the blanket 14%/0% rate
      // this invoice-level toggle would otherwise apply — still fully
      // editable per line afterwards.
      if (picked.defaultTaxPercent != null) {
        setValue(`lines.${index}.taxRate`, Number(picked.defaultTaxPercent), { shouldDirty: true });
      } else if (isSalesTaxInvoice) {
        setValue(`lines.${index}.taxRate`, 14, { shouldDirty: true });
      } else {
        setValue(`lines.${index}.taxRate`, 0, { shouldDirty: true });
      }
      if (picked.taxExemptionReason) {
        setValue(`lines.${index}.taxExemptionReason`, picked.taxExemptionReason, { shouldDirty: true });
      }
      if (picked.barcode || picked.serial || picked.code) {
        setValue(`lines.${index}.barcode`, picked.barcode || picked.serial || picked.code, {
          shouldDirty: true,
        });
      }
      if (!getValues(`lines.${index}.warehouseId`)) {
        const itemWarehouse = picked.defaultWarehouseId || getValues('warehouseId');
        if (itemWarehouse) {
          setValue(`lines.${index}.warehouseId`, itemWarehouse, { shouldDirty: false });
        }
      }
      if (defaultWhtRate > 0 && !Number(getValues(`lines.${index}.withholdingTaxRate`))) {
        setValue(`lines.${index}.withholdingTaxRate`, defaultWhtRate, { shouldDirty: true });
      }
      if (txSettings?.defaultSalesAccountId && !getValues(`lines.${index}.customRevenueAccountId`)) {
        setValue(`lines.${index}.customRevenueAccountId`, txSettings.defaultSalesAccountId, {
          shouldDirty: false,
        });
      }
      if (txSettings?.defaultCostCenterId && !getValues(`lines.${index}.costCenterId`)) {
        setValue(`lines.${index}.costCenterId`, txSettings.defaultCostCenterId, { shouldDirty: false });
      }
      const synced = syncLineUnitFields(
        {
          quantity: Number(getValues(`lines.${index}.quantity`)) || 1,
          unitId: defaultUnitIdForItem(picked),
        },
        picked.units
      );
      setValue(`lines.${index}.baseQuantity`, synced.baseQuantity, { shouldDirty: true });
      setValue(`lines.${index}.conversionFactor`, synced.conversionFactor, { shouldDirty: true });
      setValue(`lines.${index}.baseUnitId`, synced.baseUnitId, { shouldDirty: true });
    },
    [
      defaultWhtRate,
      getValues,
      isSalesTaxInvoice,
      selectedCustomerTier,
      setValue,
      txSettings?.defaultCostCenterId,
      txSettings?.defaultSalesAccountId,
      txSettings?.pricingPolicy,
    ]
  );

  // Load invoice data when selected
  useEffect(() => {
    if (selectedInvoice) {
      const rawSplits = (selectedInvoice as { paymentSplits?: PaymentSplitLine[] }).paymentSplits;
      const invoiceNet = Number(
        (selectedInvoice as { netAmount?: number }).netAmount ??
          (selectedInvoice as { totalAmount?: number }).totalAmount ??
          0
      );
      const { method: pt, splits: loadedSplits } = resolveInvoicePaymentUi(
        (selectedInvoice as { paymentMethod?: string }).paymentMethod ??
          selectedInvoice.paymentType,
        Array.isArray(rawSplits) ? rawSplits : [],
        invoiceNet
      );
      setPaymentSplits(loadedSplits);
      const loadedExtras = extrasFromApi(selectedInvoice.adjustments);
      setInvoiceExtras(loadedExtras);
      setExtrasOpen(loadedExtras.length > 0);
      const creditCashSplit =
        Array.isArray(rawSplits)
          ? rawSplits.find((s): s is Extract<PaymentSplitLine, { type: 'CASH' }> => s.type === 'CASH')
          : undefined;
      const cashTreasurySplit =
        pt === 'cash' && Array.isArray(rawSplits)
          ? rawSplits.find((s): s is Extract<PaymentSplitLine, { type: 'CASH' }> => s.type === 'CASH')
          : undefined;
      const rawNotes = (selectedInvoice as { internalNotes?: InternalNoteEntry[] }).internalNotes;
      const notesList = Array.isArray(rawNotes) ? rawNotes : [];
      const eInvoiceDetails = extractEInvoiceDetails(notesList);
      const apiInstallments = installmentRowsFromApi(
        (selectedInvoice as { installments?: unknown }).installments
      );
      setPaymentInstallments(
        apiInstallments.length ? apiInstallments : extractPaymentInstallments(notesList)
      );
      setInternalNotes(
        stripPaymentTermsMethodNote(stripPaymentInstallmentsNote(stripEInvoiceDetailsNote(notesList)))
      );

      const cust = (selectedInvoice as { customer?: { id: string; arabicName: string; code?: string | null; serial?: string | null } })
        .customer;
      if (cust?.id) {
        setCustomerSeed({
          id: cust.id,
          arabicName: cust.arabicName,
          code: cust.code ?? cust.serial ?? null,
        });
      } else {
        setCustomerSeed(null);
      }

      const repId =
        (selectedInvoice as { representativeId?: string | null }).representativeId ??
        (selectedInvoice as { delegateId?: string | null }).delegateId ??
        '';

      reset({
        customerId: selectedInvoice.customerId || '',
        date: selectedInvoice.date
          ? new Date(selectedInvoice.date).toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0],
        dueDate: selectedInvoice.dueDate
          ? new Date(selectedInvoice.dueDate).toISOString().split('T')[0]
          : '',
        paymentMethod: pt,
        paymentTermsMethod: extractPaymentTermsMethod(notesList),
        advancePaidAmount: creditCashSplit?.amount ?? 0,
        advanceSafeId: creditCashSplit?.safeId ?? '',
        warehouseId: selectedInvoice.warehouseId || '',
        invoiceNumber: selectedInvoice.invoiceNumber || '',
        description: selectedInvoice.description || '',
        hijriDate:
          selectedInvoice.hijriDate ||
          toHijri(
            selectedInvoice.date
              ? new Date(selectedInvoice.date).toISOString().split('T')[0]
              : new Date().toISOString().split('T')[0]
          ),
        currencyId: selectedInvoice.currencyId || '',
        exchangeRate:
          selectedInvoice.exchangeRate != null ? Number(selectedInvoice.exchangeRate) : undefined,
        costCenterId: selectedInvoice.costCenterId || '',
        delegateId: repId,
        sellerId: selectedInvoice.sellerId || '',
        taxTreatmentType:
          (selectedInvoice.taxTreatmentType as 'taxable' | 'exempt' | 'export' | undefined) ||
          undefined,
        allowReturn: Boolean(selectedInvoice.allowReturn),
        returnDays: selectedInvoice.returnDays != null ? Number(selectedInvoice.returnDays) : undefined,
        isDelivered: Boolean(selectedInvoice.isDelivered),
        handoverDate: selectedInvoice.handoverDate
          ? new Date(selectedInvoice.handoverDate).toISOString().split('T')[0]
          : '',
        printTermsOnInvoice: false,
        treasuryId: cashTreasurySplit?.safeId ?? '',
        salesOrderNumber: eInvoiceDetails.salesOrderNumber ?? '',
        salesOrderDescription: eInvoiceDetails.salesOrderDescription ?? '',
        purchaseOrderNumber: eInvoiceDetails.purchaseOrderNumber ?? '',
        purchaseOrderDescription: eInvoiceDetails.purchaseOrderDescription ?? '',
        sourceType:
          (selectedInvoice as { sourceType?: SalesInvoiceFormValues['sourceType'] }).sourceType ??
          'NONE',
        sourceId: String((selectedInvoice as { sourceId?: string | null }).sourceId ?? ''),
        sourceNumber: String((selectedInvoice as { sourceNumber?: string | null }).sourceNumber ?? ''),
        pricingCalculationBasis: parsePricingCalculationBasis(
          (selectedInvoice as { pricingCalculationBasis?: string }).pricingCalculationBasis
        ),
        ...developmentFeeFormFromInvoice(selectedInvoice as Record<string, unknown>),
        lines:
          selectedInvoice.lines?.map((line: Record<string, unknown>) => ({
            itemId: String(line.itemId ?? ''),
            unitId: line.unitId ? String(line.unitId) : '',
            quantity: Number(line.quantity) || 1,
            baseQuantity: Number(line.baseQuantity ?? line.quantity) || 1,
            conversionFactor: Number(line.conversionFactor ?? 1) || 1,
            baseUnitId: line.baseUnitId ? String(line.baseUnitId) : '',
            unitPrice: Number(line.price ?? line.unitPrice) || 0,
            discountType: inferDiscountTypeFromApi(line),
            discountValue: inferDiscountValueFromApi(line),
            discount: inferDiscountValueFromApi(line),
            taxRate: Number(line.taxPercent ?? line.tax ?? line.taxRate ?? 0) || 0,
            barcode: line.barcode ? String(line.barcode) : undefined,
            lineNotes: line.lineNotes ? String(line.lineNotes) : undefined,
            batchNumber: line.batchNumber ? String(line.batchNumber) : undefined,
            expiryDate: line.expiryDate
              ? new Date(line.expiryDate as string).toISOString().split('T')[0]
              : undefined,
            productionDate: line.productionDate
              ? new Date(line.productionDate as string).toISOString().split('T')[0]
              : undefined,
            serialNumbers: line.serialNumbers ? String(line.serialNumbers) : undefined,
            taxExemptionReason: line.taxExemptionReason ? String(line.taxExemptionReason) : undefined,
            warehouseId: String(line.warehouseId ?? selectedInvoice.warehouseId ?? ''),
            costCenterId: line.costCenterId ? String(line.costCenterId) : undefined,
            withholdingTaxRate: Number(line.withholdingTaxRate ?? 0) || 0,
            withholdingTaxAmount: Number(line.withholdingTaxAmount ?? 0) || 0,
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
                  expiryDate: alloc.expiryDate
                    ? String(alloc.expiryDate).slice(0, 10)
                    : undefined,
                }))
              : undefined,
          })) ?? [],
      });
      setIsPosted(selectedInvoice.isPosted || false);
      setIsApproved(selectedInvoice.isApproved || false);
      setIsSalesTaxInvoice(selectedInvoice.isSalesTaxInvoice === true);
      const rawCond = (selectedInvoice as { conditions?: { condition?: string }[] }).conditions;
      if (Array.isArray(rawCond) && rawCond.length) {
        setConditions(rawCond.map((c) => c.condition ?? '').filter((c) => c.length > 0));
      } else {
        setConditions(['']);
      }
    }
  }, [selectedInvoice, reset]);

  // Fetch items
  const { data: itemsResponse, isLoading: itemsLoading } = useApiQuery<Item[]>(
    ['items'],
    '/inventory/items',
    { limit: 1000, isActive: true }
  );
  const items = useMemo(() => itemsResponse?.data ?? [], [itemsResponse?.data]);

  const { data: frequentRes, isLoading: frequentLoading } = useCustomerFrequentItems(
    customerIdW?.trim() ? customerIdW : undefined
  );
  const frequentItems = frequentRes?.data ?? [];

  const clipboardItems = useMemo(
    () =>
      items.map((i) => ({
        id: i.id,
        arabicName: i.arabicName,
        englishName: i.englishName,
        code: i.code,
        serial: i.serial,
      })),
    [items]
  );

  const handleClipboardLines = useCallback(
    (lines: Array<{ itemId: string; quantity: number; unitPrice: number; discount: number }>) => {
      for (const line of lines) {
        const picked = items.find((x) => x.id === line.itemId);
        const unitId = picked ? defaultUnitIdForItem(picked) : '';
        let price = line.unitPrice;
        if (price <= 0 && picked) {
          price = defaultSalePriceForItem(
            picked as Item & {
              salesPrice?: number;
              priceRetail?: number;
              priceSemiWholesale?: number;
              priceWholesale?: number;
              priceProjects?: number;
              itemPrices?: { price?: number; priceList?: { isDefault?: boolean } }[];
            },
            selectedCustomerTier
          );
        }
        append({
          itemId: line.itemId,
          unitId,
          quantity: line.quantity,
          unitPrice: price,
          discount: line.discount,
          discountValue: line.discount,
          discountType: 'PERCENTAGE',
          taxRate: isSalesTaxInvoice ? 14 : 0,
          warehouseId: getValues('warehouseId') || '',
        });
      }
      toast.success(`تم لصق ${lines.length} سطر من Excel`);
    },
    [append, getValues, items, isSalesTaxInvoice, selectedCustomerTier]
  );

  const handleFrequentItemInsert = useCallback(
    (row: { itemId: string; lastUnitPrice: number }) => {
      const picked = items.find((x) => x.id === row.itemId);
      append({
        itemId: row.itemId,
        unitId: picked ? defaultUnitIdForItem(picked) : '',
        quantity: 1,
        unitPrice: row.lastUnitPrice,
        discount: 0,
        discountValue: 0,
        discountType: 'PERCENTAGE',
        taxRate: isSalesTaxInvoice ? 14 : 0,
        warehouseId: getValues('warehouseId') || '',
      });
    },
    [append, getValues, items, isSalesTaxInvoice]
  );

  const printInvoiceDocument = useMemo((): Record<string, unknown> | null => {
    const trimmedConditions = conditions.map((c) => c.trim()).filter(Boolean);
    if (selectedInvoice) {
      return {
        ...(selectedInvoice as Record<string, unknown>),
        printTermsOnInvoice: printTermsOnInvoiceW,
        invoiceConditions: trimmedConditions.length ? trimmedConditions : undefined,
      };
    }
    const lines = (watchedLines ?? []).filter(
      (l) => l?.itemId && (Number(l.quantity) || 0) > 0
    );
    if (lines.length === 0) return null;
    const customer = customers.find((c) => c.id === customerIdW);
    return {
      invoiceKind: 'SALE',
      invoiceNumber: invoiceNumberW || 'مسودة',
      date: dateW || new Date().toISOString(),
      paymentType: paymentMethodW,
      isSalesTaxInvoice,
      allowReturn: allowReturnW,
      returnDays: allowReturnW ? 365 : undefined,
      printTermsOnInvoice: printTermsOnInvoiceW,
      invoiceConditions: trimmedConditions.length ? trimmedConditions : undefined,
      customer: customer ? { arabicName: customer.arabicName } : undefined,
      lines: lines.map((l) => {
        const it = items.find((i) => i.id === l.itemId);
        return {
          itemId: l.itemId,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          discount: l.discountValue ?? l.discount,
          discountValue: l.discountValue ?? l.discount,
          discountType: l.discountType,
          taxRate: l.taxRate,
          item: it
            ? { code: it.code, serial: it.serial, arabicName: it.arabicName }
            : undefined,
        };
      }),
    };
  }, [
    selectedInvoice,
    watchedLines,
    customers,
    items,
    isSalesTaxInvoice,
    allowReturnW,
    printTermsOnInvoiceW,
    conditions,
    customerIdW,
    invoiceNumberW,
    dateW,
    paymentMethodW,
  ]);

  // Fetch currencies
  const { data: currenciesResponse, isLoading: currenciesLoading } = useApiQuery<Currency[]>(
    ['currencies'],
    '/accounting/currencies',
    { limit: 100, isActive: true }
  );
  const currencies = useMemo(() => currenciesResponse?.data ?? [], [currenciesResponse?.data]);

  // Fetch delegates
  const { data: delegatesResponse, isLoading: delegatesLoading } = useApiQuery<Delegate[]>(
    ['delegates'],
    '/accounting/delegates',
    { limit: 1000, isActive: true }
  );
  const delegates = delegatesResponse?.data || [];

  // Branch-default warehouse prefill (fresh drafts only) — Sales Invoice
  // Enterprise Redesign.
  const { data: branchesResponse } = useApiQuery<Branch[]>(
    ['company-branches'],
    '/company/branches',
    { page: 1, limit: 50 }
  );
  const branches = useMemo(() => branchesResponse?.data ?? [], [branchesResponse?.data]);
  useEffect(() => {
    if (selectedInvoiceId || !documentProfile) return;
    if (documentProfile.defaultWarehouseId) {
      setValue('warehouseId', documentProfile.defaultWarehouseId, { shouldDirty: false });
    }
    if (documentProfile.defaultTreasuryId) {
      setValue('treasuryId', documentProfile.defaultTreasuryId, { shouldDirty: false });
    }
    if (documentProfile.defaultCostCenterId) {
      setValue('costCenterId', documentProfile.defaultCostCenterId, { shouldDirty: false });
    }
  }, [documentProfile, selectedInvoiceId, setValue]);

  useEffect(() => {
    if (selectedInvoiceId || !txSettings) return;
    setIsSalesTaxInvoice(txSettings.autoApplyVat);
    persistSalesInvoiceVatDefault(txSettings.autoApplyVat);
    if (txSettings.defaultWarehouseId && !getValues('warehouseId')) {
      setValue('warehouseId', txSettings.defaultWarehouseId, { shouldDirty: false });
    }
    if (txSettings.defaultCostCenterId && !getValues('costCenterId')) {
      setValue('costCenterId', txSettings.defaultCostCenterId, { shouldDirty: false });
    }
    if (txSettings.autoApplyDevelopmentTax) {
      setValue('developmentFeeEnabled', true, { shouldDirty: false });
    }
  }, [getValues, selectedInvoiceId, setValue, txSettings]);

  useEffect(() => {
    if (selectedInvoiceId || warehouseIdW || branches.length === 0 || documentProfile?.defaultWarehouseId) return;
    const activeBranchId = getTenantContext().branchId;
    const activeBranch = activeBranchId ? branches.find((b) => b.id === activeBranchId) : undefined;
    const defaultWarehouseId = activeBranch?.defaultWarehouseId;
    if (defaultWarehouseId) {
      setValue('warehouseId', defaultWarehouseId, { shouldDirty: false });
    }
  }, [branches, selectedInvoiceId, warehouseIdW, setValue, documentProfile?.defaultWarehouseId]);

  // Invoice create mutation
  const afterSaveReset = useCallback(() => {
    const cur = getValues('currencyId');
    skipUrlHydrateRef.current = true;
    openInvoice(null);
    reset({
      ...emptySalesInvoiceDefaults(),
      currencyId: cur || '',
    });
    setIsPosted(false);
    setIsApproved(false);
    setPaymentSplits([]);
    setPaymentInstallments([]);
    setInvoiceExtras([]);
    setExtrasOpen(false);
    setInternalNotes([]);
  }, [getValues, openInvoice, reset]);

  const resolveInvoiceNumber = useCallback(() => {
    return (
      String(getValues('invoiceNumber') ?? '').trim() ||
      String(selectedInvoice?.invoiceNumber ?? '').trim() ||
      'مسودة جديدة'
    );
  }, [getValues, selectedInvoice]);

  const invoiceMutation = useApiMutation<{ id?: string; invoiceNumber?: string }, Record<string, unknown>>(
    '/invoices',
    'POST',
    {
      showSuccessToast: false,
      onSuccess: (res) => {
        const num =
          String(res?.data?.invoiceNumber ?? '').trim() ||
          String(getValues('invoiceNumber') ?? '').trim() ||
          'مسودة جديدة';
        toast.success('تم حفظ المسودة', {
          description: `تم حفظ فاتورة رقم ${num}. الصفحة جاهزة لفاتورة جديدة.`,
        });
        clearDraft();
        invalidateQuery(['invoices']);
        if (txSettings?.autoPrintOnSave) {
          dispatchAutoPrintAfterSave();
        }
        afterSaveReset();
      },
      onError: (error: ApiError) => {
        toastInvoiceSaveError(error.message || 'حدث خطأ أثناء الحفظ');
      },
    }
  );

  // Invoice update mutation — wait for HTTP success before cache/toast.
  const invoiceUpdateMutation = useApiMutation<unknown, Record<string, unknown>>(
    selectedInvoiceId ? `/invoices/${selectedInvoiceId}` : '/invoices',
    'PUT',
    {
      showSuccessToast: false,
      onSuccess: () => {
        const num = resolveInvoiceNumber();
        toast.success('تم حفظ المسودة', {
          description: `تم حفظ فاتورة رقم ${num}. الصفحة جاهزة لفاتورة جديدة.`,
        });
        invalidateQuery(['invoices']);
        if (txSettings?.autoPrintOnSave) {
          dispatchAutoPrintAfterSave();
        }
        afterSaveReset();
      },
      onError: (error: ApiError) => {
        if (error.code === '409') {
          toastVersionConflict(error.message, () => {
            invalidateQuery(['invoice', selectedInvoiceId]);
          });
          return;
        }
        toastInvoiceSaveError(error.message || 'حدث خطأ أثناء التحديث');
      },
    }
  );

  // Invoice delete mutation
  const invoiceDeleteMutation = useApiMutation<unknown, Record<string, unknown>>(
    selectedInvoiceId ? `/invoices/${selectedInvoiceId}` : '/invoices',
    'DELETE',
    {
      showSuccessToast: false,
      onSuccess: () => {
        toast.success('تم حذف الفاتورة بنجاح');
        invalidateQuery(['invoices']);
        afterSaveReset();
      },
      onError: (error: ApiError) => {
        toast.error('تعذر حذف الفاتورة', {
          description: error.message || 'حدث خطأ أثناء الحذف',
        });
      },
    }
  );

  // Post invoice mutation — never flip isPosted until the backend confirms.
  const postInvoiceMutation = useApiMutation<unknown, Record<string, unknown>>(
    selectedInvoiceId ? `/invoices/${selectedInvoiceId}/post` : '/invoices',
    'POST',
    {
      showSuccessToast: false,
      onSuccess: () => {
        setIsPosted(true);
        const num = resolveInvoiceNumber();
        toast.success('تم ترحيل الفاتورة بنجاح', {
          description: `تم تحديث الأرصدة المخزنية وتوليد القيد المحاسبي للفاتورة ${num}.`,
          action: {
            label: 'معاينة القيد',
            onClick: () => setBottomSplitTab('gl'),
          },
        });
        invalidateQuery(['invoices']);
        invalidateQuery(['invoice', selectedInvoiceId]);
        dispatchAcademyTrigger('API_SUCCESS', 'sales-invoice.post-success');
      },
      onError: (error: ApiError) => {
        setIsPosted(false);
        toast.error('تعذر ترحيل الفاتورة', {
          description: error.message || 'حدث خطأ أثناء الترحيل',
        });
      },
    }
  );

  // Unpost invoice mutation
  const unpostInvoiceMutation = useApiMutation<unknown, Record<string, unknown>>(
    selectedInvoiceId ? `/invoices/${selectedInvoiceId}/unpost` : '/invoices',
    'POST',
    {
      showSuccessToast: false,
      onSuccess: () => {
        toast.success('تم فك ترحيل الفاتورة بنجاح');
        setIsPosted(false);
        invalidateQuery(['invoices']);
        invalidateQuery(['invoice', selectedInvoiceId]);
      },
      onError: (error: ApiError) => {
        toast.error('تعذر فك ترحيل الفاتورة', {
          description: error.message || 'حدث خطأ أثناء فك الترحيل',
        });
      },
    }
  );

  // M5 settlement: posts a treasury cash transaction linked to the invoice.
  const { data: safesResponse } = useApiQuery<Array<{ id: string; arabicName?: string }>>(
    ['safes', 'settlement'],
    '/accounting/safes',
    { page: 1, limit: 50 }
  );
  const defaultSafeId = pickDefaultSafeId(safesResponse?.data);

  useEffect(() => {
    if (paymentMethodW !== 'split') return;
    setPaymentSplits((prev) => withOnAccountRemainder(prev, financialSummary.netAmount));
  }, [paymentMethodW, financialSummary.netAmount]);

  useEffect(() => {
    if (paymentMethodW !== 'cash') return;
    if (!getValues('treasuryId')) {
      const fallback = getValues('advanceSafeId') || defaultSafeId;
      if (fallback) {
        setValue('treasuryId', fallback, { shouldDirty: false, shouldValidate: true });
      }
    }
    void trigger('treasuryId');
  }, [paymentMethodW, defaultSafeId, getValues, setValue, trigger]);

  useEffect(() => {
    if (paymentMethodW !== 'credit') return;
    if (!getValues('advanceSafeId')) {
      const fallback = getValues('treasuryId') || defaultSafeId;
      if (fallback) {
        setValue('advanceSafeId', fallback, { shouldDirty: false, shouldValidate: true });
      }
    }
    const amt = getValues('advancePaidAmount');
    if (amt === undefined || amt === null || Number.isNaN(Number(amt))) {
      setValue('advancePaidAmount', 0, { shouldDirty: false });
    }
  }, [paymentMethodW, defaultSafeId, getValues, setValue]);

  const { data: settlementsResponse } = useApiQuery<
    Array<{
      id: string;
      transactionKind: string;
      voucherNumber?: string | null;
      date: string;
      amount: number | string;
      isPosted: boolean;
      isCancelled: boolean;
      journalEntryId?: string | null;
    }>
  >(
    ['invoice-settlements', selectedInvoiceId],
    `/invoices/${selectedInvoiceId}/settlements`,
    undefined,
    { enabled: !!selectedInvoiceId }
  );
  const settlements = settlementsResponse?.data || [];

  const collectPaymentMutation = useApiMutation<unknown, Record<string, unknown>>(
    selectedInvoiceId ? `/invoices/${selectedInvoiceId}/settlements` : '/invoices',
    'POST',
    {
      showSuccessToast: false,
      onSuccess: () => {
        toast.success('تم تسجيل التحصيل بنجاح');
        setCollectModalOpen(false);
        invalidateQuery(['invoices']);
        invalidateQuery(['invoice', selectedInvoiceId]);
        invalidateQuery(['invoice-settlements', selectedInvoiceId]);
      },
      onError: (error: ApiError) => {
        toast.error('تعذر تسجيل التحصيل', {
          description: error.message || 'حدث خطأ أثناء تسجيل التحصيل',
        });
      },
    }
  );

  const handleToolbarCollectPayment = () => {
    if (!selectedInvoiceId) {
      toast.error('يرجى اختيار فاتورة أولاً');
      return;
    }
    const remaining = invoiceRemainingForCollect(selectedInvoice as Record<string, unknown> | undefined);
    if (remaining === null) {
      toast.error('لا يوجد مبلغ متبقي للتحصيل');
      return;
    }
    if (!selectedInvoice?.isPosted) {
      toast.error('يجب ترحيل الفاتورة قبل تسجيل التحصيل');
      return;
    }
    if (!safesResponse?.data?.length) {
      toast.error('لا توجد خزينة معرّفة — أضف خزينة قبل التحصيل');
      return;
    }
    setCollectModalOpen(true);
  };

  const handleToolbarRefreshPayments = () => {
    if (!selectedInvoiceId) {
      toast.error('يرجى اختيار فاتورة أولاً');
      return;
    }
    invalidateQuery(['invoice-settlements', selectedInvoiceId]);
    invalidateQuery(['invoice', selectedInvoiceId]);
    invalidateQuery(['invoices']);
    setBottomSplitTab('settlements');
    toast.success('تم تحديث بيانات التحصيلات');
  };

  const handleToolbarOpenJournal = () => {
    if (!selectedInvoiceId) {
      toast.error('يرجى اختيار فاتورة أولاً');
      return;
    }
    router.push(destinationAppTabHref(`/accounting/operations/journal-entry?ref=invoice&id=${selectedInvoiceId}`));
  };

  const saveInFlight =
    invoiceMutation.isPending || invoiceUpdateMutation.isPending || invoiceDeleteMutation.isPending;
  const financialBusy =
    saveInFlight || postInvoiceMutation.isPending || unpostInvoiceMutation.isPending;

  const linesRootMessage =
    errors.lines && typeof errors.lines === 'object' && 'message' in errors.lines && errors.lines.message
      ? String(errors.lines.message)
      : undefined;

  const onValidSubmit = (data: SalesInvoiceFormValues) => {
    if (financialBusy) return;
    try {
      const resolvedMethod = data.paymentMethod;
      const splitLines =
        resolvedMethod === 'split'
          ? withOnAccountRemainder(paymentSplits, financialSummary.netAmount)
          : undefined;
      if (resolvedMethod === 'split' && !splitsMatchTotal(splitLines ?? [], financialSummary.netAmount)) {
        toast.error('وزّع الدفع المتعدد ليطابق إجمالي الفاتورة');
        setSplitModalOpen(true);
        return;
      }
      const extrasPayload = extrasToApi(invoiceExtras);
      if (
        invoiceExtras.some(
          (row) =>
            !row.accountId.trim() &&
            (Number(row.additionValue) > 0 || Number(row.discountValue) > 0)
        )
      ) {
        toast.error('حدد الحساب لكل إضافة أو خصم');
        setExtrasOpen(true);
        return;
      }
      const creditPaid = Number(data.advancePaidAmount) || 0;
      const creditSafe = String(data.advanceSafeId || data.treasuryId || '').trim();
      if (resolvedMethod === 'credit' && creditPaid > 0 && !creditSafe) {
        toast.error('حدد الخزينة عند دفع مبلغ في الأول');
        return;
      }
      const trimmedConditions = conditions.map((c) => c.trim()).filter(Boolean);
      const cashTreasurySplits =
        resolvedMethod === 'cash' && data.treasuryId
          ? [{ type: 'CASH' as const, safeId: data.treasuryId, amount: Math.max(financialSummary.netAmount, 0) }]
          : undefined;
      const creditSplits =
        resolvedMethod === 'credit'
          ? creditAdvanceToSplits(creditPaid, creditSafe, financialSummary.netAmount)
          : undefined;
      const formData = {
        ...data,
        lines: data.lines ?? [],
        paymentMethod: resolvedMethod,
        paymentSplits:
          resolvedMethod === 'split'
            ? splitLines
            : resolvedMethod === 'credit'
              ? creditSplits
              : cashTreasurySplits,
        internalNotes: withPaymentTermsMethodNote(
          withEInvoiceDetailsNote(internalNotes, {
            salesOrderNumber: data.salesOrderNumber,
            salesOrderDescription: data.salesOrderDescription,
            purchaseOrderNumber: data.purchaseOrderNumber,
            purchaseOrderDescription: data.purchaseOrderDescription,
          }),
          data.paymentTermsMethod
        ),
        installments: paymentInstallments.map((row) => ({
          installmentNumber: row.number,
          dueDate: row.dueDate,
          hijriDueDate: toHijriMedium(row.dueDate),
          amount: row.amount,
        })),
        invoiceConditions: trimmedConditions.length ? trimmedConditions : [],
        returnDays: data.allowReturn ? (data.returnDays ?? 365) : undefined,
        documentProfileId: documentProfile?.id,
        adjustments: extrasPayload,
      };
      const opts = { invoiceKind: 'SALE' as const, currencies, items, applyTax: isSalesTaxInvoice };

      if (selectedInvoiceId) {
        invoiceUpdateMutation.mutate(
          mapSalesFormToM5UpdateBody(formData, {
            ...opts,
            expectedVersion: selectedInvoice?.version ?? undefined,
          })
        );
        return;
      }

      invoiceMutation.mutate(mapSalesFormToM5CreateBody(formData, opts));
    } catch (e) {
      toastInvoiceSaveError(e instanceof Error ? e.message : 'تعذر تجهيز الفاتورة');
    }
  };

  const onInvalidSubmit = (formErrors: FieldErrors<SalesInvoiceFormValues>) => {
    toastInvoiceSaveError(
      firstErrorMessage(formErrors) ?? 'يرجى إكمال العميل والمخزن وبنود الفاتورة قبل الحفظ'
    );
  };

  // Handle post/unpost
  const handlePostUnpost = async (post: boolean) => {
    if (!selectedInvoiceId) {
      toast.error('يرجى اختيار فاتورة أولاً');
      return;
    }
    if (
      invoiceMutation.isPending ||
      invoiceUpdateMutation.isPending ||
      invoiceDeleteMutation.isPending ||
      postInvoiceMutation.isPending ||
      unpostInvoiceMutation.isPending
    ) {
      return;
    }

    if (post) {
      if (
        paymentMethodW === 'split' &&
        !splitsMatchTotal(
          withOnAccountRemainder(paymentSplits, financialSummary.netAmount),
          financialSummary.netAmount
        )
      ) {
        toast.error('أكمل توزيع الدفع المتعدد قبل الترحيل');
        setSplitModalOpen(true);
        return;
      }
      if (paymentMethodW === 'cash' && !getValues('treasuryId')?.trim()) {
        toast.error('يجب تحديد الخزنة في الفاتورة النقدية');
        void trigger('treasuryId');
        return;
      }
      if (paymentMethodW === 'credit') {
        const paid = Number(getValues('advancePaidAmount')) || 0;
        const safe = String(getValues('advanceSafeId') || getValues('treasuryId') || '').trim();
        if (paid > 0 && !safe) {
          toast.error('حدد الخزينة عند دفع مبلغ في الأول');
          void trigger('advanceSafeId');
          return;
        }
      }
      postInvoiceMutation.mutate({});
    } else {
      unpostInvoiceMutation.mutate({});
    }
  };

  const handleSourceHydrate = useCallback(
    (payload: SourceHydratePayload) => {
      const warehouseId = documentProfile?.lockWarehouse
        ? getValues('warehouseId')
        : payload.warehouseId || getValues('warehouseId');
      if (payload.customerId) {
        setValue('customerId', payload.customerId, { shouldDirty: true });
        setCustomerSeed({
          id: payload.customerId,
          arabicName: payload.partyName,
        });
      }
      if (warehouseId) setValue('warehouseId', warehouseId, { shouldDirty: true });
      if (payload.costCenterId && !documentProfile?.lockCostCenter) {
        setValue('costCenterId', payload.costCenterId, { shouldDirty: true });
      }
      if (payload.currencyId) setValue('currencyId', payload.currencyId, { shouldDirty: true });
      if (payload.delegateId) setValue('delegateId', payload.delegateId, { shouldDirty: true });
      setValue('sourceType', payload.sourceType, { shouldDirty: true });
      setValue('sourceId', payload.sourceId, { shouldDirty: true });
      setValue('sourceNumber', payload.sourceNumber, { shouldDirty: true });
      setValue('description', mergeSourceNote(getValues('description'), payload.notes), {
        shouldDirty: true,
      });
      replace(
        payload.lines.map((line) => sourceLineToSalesRow(line, warehouseId || '', isSalesTaxInvoice))
      );
      toast.success(`تم تعبئة الفاتورة من ${payload.sourceNumber}`);
    },
    [documentProfile?.lockCostCenter, documentProfile?.lockWarehouse, getValues, isSalesTaxInvoice, replace, setValue]
  );

  // Handle delete
  const handleDelete = async () => {
    if (!selectedInvoiceId) {
      toast.error('يرجى اختيار فاتورة أولاً');
      return;
    }
    if (financialBusy) return;

    if (await confirmAction('هل أنت متأكد من حذف هذه الفاتورة؟')) {
      invoiceDeleteMutation.mutate({});
    }
  };

  // Handle new invoice
  const handleNew = () => {
    const cur = getValues('currencyId');
    skipUrlHydrateRef.current = true;
    openInvoice(null);
    reset({
      ...emptySalesInvoiceDefaults(),
      currencyId: cur || '',
    });
    setIsPosted(false);
    setIsApproved(false);
    setConditions(['']);
    setIsSalesTaxInvoice(readSalesInvoiceVatDefault());
    setCustomerSeed(null);
    setPaymentSplits([]);
    setPaymentInstallments([]);
    setInvoiceExtras([]);
    setExtrasOpen(false);
    setInternalNotes([]);
    clearDraft();
  };

  const handleRestoreDraft = () => {
    const payload = acceptRestore();
    if (payload) {
      reset(payload);
      toast.success('تم استعادة المسودة المحفوظة');
    }
  };

  const handleCreateReturn = () => {
    if (!selectedInvoiceId) {
      toast.error('يرجى اختيار فاتورة أولاً');
      return;
    }
    if (!isPosted) {
      toast.error('يجب ترحيل الفاتورة قبل إنشاء مرتجع');
      return;
    }
    router.push(destinationAppTabHref(`/inventory/operations/sales-returns?fromInvoice=${selectedInvoiceId}`));
  };

  const handleDuplicateDocument = () => {
    if (!selectedInvoiceId) {
      toast.error('يرجى اختيار فاتورة أولاً');
      return;
    }
    documentConvertMutation.mutate(
      { type: 'CLONE_INVOICE', sourceId: selectedInvoiceId },
      {
        onSuccess: (res) => {
          const id = res.data?.target?.id;
          toast.success('تم تكرار المستند كمسودة جديدة');
          invalidateQuery(['invoices']);
          if (id) {
            invalidateQuery(['invoice', id]);
            setSelectedInvoiceId(id);
          }
        },
        onError: (error: Error) => {
          toast.error('تعذر تكرار المستند', {
            description: error.message || 'تعذر تكرار المستند',
          });
        },
      }
    );
  };

  // Default currency when list loads
  useEffect(() => {
    if (currencies.length > 0 && !currencyIdW) {
      const defaultCurrency = currencies.find((c) => c.code === 'EGP') || currencies[0];
      setValue('currencyId', defaultCurrency.id, { shouldDirty: false });
    }
  }, [currencies, currencyIdW, setValue]);

  const statusLabel = isPosted ? 'مرحّلة' : isApproved ? 'معتمدة' : 'مسودة';
  const statusTone = isPosted ? 'success' : isApproved ? 'info' : 'warning';

  return (
    <ErpDocumentLayout className={ERP_INVOICE_DOCUMENT_LAYOUT_CLASS}>
      {restoreOffer && !selectedInvoiceId ? (
        <PageDraftRestoreBanner
          message="يوجد مسودة فاتورة غير محفوظة من جلسة سابقة."
          onRestore={handleRestoreDraft}
          onDismiss={dismissRestore}
        />
      ) : null}

      {showOnboardingGuide && !selectedInvoiceId ? (
        <div className="mb-3 rounded-lg border border-[#0E79AA]/30 bg-[#F0F9FC] px-4 py-3 text-sm text-[#094C6B]">
          <strong>الخطوة 1:</strong> اختر العميل من أعلى النموذج. <strong>الخطوة 2:</strong> أضف صنفاً
          من الشبكة. <strong>الخطوة 3:</strong> اضغط «حفظ الفاتورة» ثم «ترحيل».
        </div>
      ) : null}

      <SalesInvoicePageHeader
        invoiceNumber={invoiceNumberW || (selectedInvoice?.invoiceNumber as string) || ''}
        statusTone={statusTone}
        statusLabel={statusLabel}
        savePending={financialBusy}
        postPending={postInvoiceMutation.isPending || unpostInvoiceMutation.isPending}
        canPost={!!selectedInvoiceId && !isPosted && !financialBusy}
        canSave={!isReadOnly && !isPosted && !financialBusy}
        saveLabel={isEditing ? 'حفظ التعديلات' : 'حفظ الفاتورة'}
        onSaveDraft={() => void handleSubmit(onValidSubmit, onInvalidSubmit)()}
        onCancel={handleNew}
        cancelLabel="إلغاء"
        onPost={() => handlePostUnpost(true)}
        onNewInvoice={handleNew}
        printInvoice={printInvoiceDocument}
        company={companyProfile}
        printOptions={{
          english: printEnglishInvoice,
          onEnglishChange: setPrintEnglishInvoice,
          skipEmptyLines: dontPrintEmptyLines,
          onSkipEmptyLinesChange: setDontPrintEmptyLines,
          onBarcodeLabels: () => setShowPrint(true),
        }}
        onUnpost={() => handlePostUnpost(false)}
        isApproved={isApproved}
        onUnapprove={() => {
          if (!selectedInvoiceId) return;
          void apiClient
            .post(`/invoices/${selectedInvoiceId}/unapprove`, {})
            .then(() => {
              setIsApproved(false);
              toast.success('تم إلغاء اعتماد الفاتورة');
            })
            .catch((error: unknown) => {
              toast.error(error instanceof Error ? error.message : 'تعذر إلغاء الاعتماد');
            });
        }}
        onDelete={handleDelete}
        onOpenJournal={handleToolbarOpenJournal}
        onCollectPayment={handleToolbarCollectPayment}
        onPaymentHistory={handleToolbarRefreshPayments}
        onCreateReturn={isPosted ? handleCreateReturn : undefined}
        onDuplicate={selectedInvoiceId ? handleDuplicateDocument : undefined}
        duplicatePending={documentConvertMutation.isPending}
        unpostPending={unpostInvoiceMutation.isPending || postInvoiceMutation.isPending}
        deletePending={invoiceDeleteMutation.isPending || financialBusy}
        autoSaveIndicator={
          draftEnabled ? <AutoSaveStatusIndicator status={autosaveStatus} /> : null
        }
        onBrowseList={() => setShowInvoiceList(true)}
        currentId={selectedInvoiceId}
        onNavigate={openInvoice}
        onEdit={() => {
          if (isPosted) {
            toast.error('يجب إلغاء الترحيل أولاً للتعديل');
            return;
          }
          unlockForEdit();
        }}
        hideStandalonePost
        isCancelled={Boolean(selectedInvoice?.isCancelled)}
        whatsAppShare={whatsAppSharePayload}
      />

      <TransactionSettingsDrawer
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        documentType="SALES_INVOICE"
      />

      {showInvoiceList ? (
        <InvoiceDocumentListDrawer
          open
          onClose={() => setShowInvoiceList(false)}
          title="فواتير المبيعات"
          invoiceKind="SALE"
          partyColumnHeader="العميل"
          getPartyName={(row) => row.customer?.arabicName || '—'}
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
        onError={(msg) => toast.error(msg)}
        onSuccess={(msg) => toast.success(msg)}
        postPending={postInvoiceMutation.isPending}
        onPost={() => handlePostUnpost(true)}
      />

      <DocumentFormLock>
      <SalesInvoiceFormHeader
        control={control}
        register={register}
        setValue={setValue}
        errors={errors}
        hasExistingLines={fields.some((line) => Boolean(line.itemId))}
        sourceDisabled={isPosted || isReadOnly}
        onSourceHydrate={handleSourceHydrate}
        paymentMethod={paymentMethodW ?? 'cash'}
        onConfigureSplit={() => setSplitModalOpen(true)}
        onConfigureInstallments={() => setInstallmentsModalOpen(true)}
        installmentCount={paymentInstallments.length}
        safes={safesResponse?.data ?? []}
        isSalesTaxInvoice={isSalesTaxInvoice}
        onSalesTaxChange={handleSalesTaxChange}
        onOpenTerms={() => setShowTermsModal(true)}
        currencies={currencies}
        delegates={delegates}
        currenciesLoading={currenciesLoading}
        delegatesLoading={delegatesLoading}
        showValidationErrors={submitCount > 0}
        customerSeed={customerSeed}
        convertedFromInvoice={selectedInvoice?.convertedFromInvoice ?? null}
        lockWarehouse={Boolean(documentProfile?.lockWarehouse)}
        lockTreasury={Boolean(documentProfile?.lockTreasury)}
        lockCostCenter={Boolean(documentProfile?.lockCostCenter)}
        includeAllAccounts={txSettings?.showAllAccountsInCustomerField === true}
        headerActions={
          <div className="inline-flex flex-wrap items-center gap-2">
            <InternalNotesScratchpad
              notes={internalNotes}
              onChange={setInternalNotes}
              disabled={isPosted}
              className="inline-flex"
            />
            <ElectronicInvoiceDetailsButton
              control={control}
              register={register}
              disabled={isPosted}
              className="inline-flex"
            />
          </div>
        }
      />

      {collectModalOpen ? (
        <InvoiceCollectModal
          open
          remaining={invoiceRemainingForCollect(selectedInvoice as Record<string, unknown> | undefined) ?? 0}
          safes={safesResponse?.data ?? []}
          defaultSafeId={defaultSafeId}
          pending={collectPaymentMutation.isPending}
          onClose={() => setCollectModalOpen(false)}
          onConfirm={(payload) => collectPaymentMutation.mutate(payload)}
        />
      ) : null}

      {splitModalOpen ? (
        <MultiPaymentSplitterModal
          open
          onClose={() => setSplitModalOpen(false)}
          grandTotal={financialSummary.netAmount}
          direction="RECEIPT"
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
          startDate={dateW}
          initial={paymentInstallments}
          onConfirm={setPaymentInstallments}
          disabled={isPosted}
        />
      ) : null}

      {documentProfile ? (
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#0E79AA]/20 bg-[#E8F4FA] px-3 py-1 text-sm text-[#094C6B]">
          <span className="font-semibold">نمط: {documentProfile.nameAr}</span>
          <span className="font-mono text-xs text-[#0E79AA]">
            ({previewProfileNumber(documentProfile)})
          </span>
        </div>
      ) : null}

      <div className="mt-2">
        <CustomerFrequentItemsBar
            items={frequentItems}
            loading={frequentLoading}
            onInsert={handleFrequentItemInsert}
          />
          <SalesInvoiceLinesGrid
            gridId={SALES_INVOICE_LINE_GRID}
            storageKey="gates:columns:sales-invoice"
            control={control}
            register={register}
            setValue={setValue}
            errors={errors}
            fields={fields}
            linesW={watchedLines}
            itemsLoading={itemsLoading}
            warehouseId={warehouseIdW}
            visibleColumnIds={visibleColumnIds}
            pricingCalculationBasis={pricingCalculationBasisW}
            onVisibleColumnIdsChange={(ids) =>
              setVisibleColumnIds(mergeVisibleColumnIds('gates:columns:sales-invoice', ids))
            }
            showValidationErrors={submitCount > 0}
            onAppendLine={appendBlankInvoiceLine}
            onRemoveLine={remove}
            applyPickedItemToLine={applyPickedItemToLine}
            linesRootMessage={linesRootMessage}
            clipboardItems={clipboardItems}
            onClipboardLines={handleClipboardLines}
            customerId={customerIdW}
            readOnly={isReadOnly}
            lockUnitPrice={txSettings?.allowItemPriceOverride === false}
            enforceBelowCost={txSettings?.preventSellingBelowCost !== false}
            headerDescription={descriptionW}
        />
      </div>
      </DocumentFormLock>

      <InvoiceExtrasPanel
        open={extrasOpen}
        onToggle={() => setExtrasOpen((v) => !v)}
        rows={invoiceExtras}
        onChange={setInvoiceExtras}
        currencies={currencies}
        defaultCurrency={currencies.find((c) => c.id === currencyIdW)?.code ?? 'EGP'}
        defaultExchangeRate={Number(exchangeRateW) > 0 ? Number(exchangeRateW) : 1}
        defaultCostCenterId={getValues('costCenterId') || ''}
        disabled={isReadOnly}
        count={extrasToApi(invoiceExtras).length}
        headerDescription={descriptionW}
      />

      <SalesInvoiceBottomSplit
          summary={financialSummary}
          applyTax={isSalesTaxInvoice}
          lines={(watchedLines ?? []).map((l) => ({
            itemId: l.itemId,
            quantity: l.quantity,
            baseQuantity: l.baseQuantity,
            unitPrice: l.unitPrice,
            discount: l.discountValue ?? l.discount,
            discountValue: l.discountValue ?? l.discount,
            discountType: l.discountType,
            taxRate: l.taxRate,
          }))}
          pricingCalculationBasis={pricingCalculationBasisW}
          warehouseId={warehouseIdW}
          journalEntryId={
            (selectedInvoice as { journalEntryId?: string | null } | undefined)?.journalEntryId
          }
          selectedInvoiceId={selectedInvoiceId}
          isPosted={isPosted}
          settlements={settlements}
          activeTabId={bottomSplitTab}
          onActiveTabChange={setBottomSplitTab}
          termsAction={
            <button
              type="button"
              onClick={() => setShowTermsModal(true)}
              className="text-xs text-[#0E78AA] font-medium hover:underline"
            >
              شروط الفاتورة…
            </button>
          }
          auditExtra={
            selectedInvoice ? (
              <div className="text-[11px] text-gray-600 space-y-0.5">
                {selectedInvoice.createdAt ? (
                  <div>إنشاء: {new Date(selectedInvoice.createdAt).toLocaleString('ar-EG')}</div>
                ) : null}
                {selectedInvoice.postedAt ? (
                  <div>ترحيل: {new Date(selectedInvoice.postedAt).toLocaleString('ar-EG')}</div>
                ) : null}
              </div>
            ) : null
          }
        />
      

      {/* Barcode label print — Sales Invoice Enterprise Redesign: this used to
          be a static, non-functional mock (no printer/count/design controls
          did anything). Reuses the real BarcodePrintModal client-side print
          pipeline instead, pre-seeded with every distinct item already on
          this invoice's lines. */}
      {showPrint ? (
        <BarcodePrintModal
          open
          onClose={() => setShowPrint(false)}
          initialItemIds={barcodePrintItemIds}
        />
      ) : null}

      {showTermsModal ? (
        <ConditionEditor
          conditions={conditions}
          onConditionsChange={setConditions}
          printTermsInputProps={register('printTermsOnInvoice')}
          paymentTermsMethodInputProps={register('paymentTermsMethod')}
          onClose={() => setShowTermsModal(false)}
        />
      ) : null}
    </ErpDocumentLayout>
  );
}
