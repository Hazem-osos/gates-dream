'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useOwnTabPathname, useOwnTabSearchParams } from '@/lib/navigation/tab-route-lock';
import PaymentsDistributionModal from '@/components/LazyPaymentsDistributionModal';
import {
  AdvancedFieldsSection,
  CompactFormField,
  FormSectionCard,
} from '@/components/ui';
import { VoucherLinesGrid, type VoucherGridLine } from '@/components/accounting/vouchers/VoucherLinesGrid';
import { VoucherStickyFooter } from '@/components/accounting/vouchers/VoucherStickyFooter';
import { CashSafeHeaderSelector } from '@/components/accounting/vouchers/CashSafeHeaderSelector';
import { VoucherSourceDocumentControl } from '@/components/accounting/vouchers/VoucherSourceDocumentControl';
import { PaymentLinesTable } from '@/components/accounting/vouchers/PaymentLinesTable';
import { ReceiptLinesTable } from '@/components/accounting/vouchers/ReceiptLinesTable';
import { OtherCreditPartiesModal } from '@/components/accounting/vouchers/OtherCreditPartiesModal';
import { OtherDebitPartiesModal } from '@/components/accounting/vouchers/OtherDebitPartiesModal';
import { BankHeaderSelector } from '@/components/accounting/vouchers/BankHeaderSelector';
import { BankDebitLinesTable } from '@/components/accounting/vouchers/BankDebitLinesTable';
import { BankDebitOtherCreditPartiesModal } from '@/components/accounting/vouchers/BankDebitOtherCreditPartiesModal';
import { BankCreditLinesTable } from '@/components/accounting/vouchers/BankCreditLinesTable';
import { BankCreditOtherDebitPartiesModal } from '@/components/accounting/vouchers/BankCreditOtherDebitPartiesModal';
import { PlusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  emptyPaymentLine,
  lineBaseAmount,
  splitPaymentLineTotals,
  toCashPayloadLine,
} from '@/lib/treasury/payment-voucher-line';
import {
  DocumentBrowseDrawer,
  ErpDocumentLayout,
  ErpDocumentPageHeader,
  ErpFieldError,
  ErpFormHeaderCard,
  GenericRecordsList,
  erpFormGridClass,
  erpInputClass,
  erpInputErrorClass,
  erpLabelClass,
} from '@/components/erp';
import {
  DocumentFormLock,
  DocumentModeProvider,
  DocumentReadOnlyBanner,
  useDocumentMode,
} from '@/components/common/document-shell';
import dynamic from 'next/dynamic';
import { useCompanyPrintProfile } from '@/lib/hooks/useCompanyPrintProfile';
import { useApiQuery, useApiMutation, useInvalidateQuery } from '@/lib/hooks/useApi';
import {
  invalidateTreasuryFundBalances,
  useBankAccountsQuery,
  useLiveFundBalance,
  useSafesQuery,
} from '@/lib/hooks/useMasterDataQueries';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';
import { useForm, useWatch, type Resolver, Controller } from 'react-hook-form';
import { useDraftAutosave } from '@/lib/hooks/useDraftAutosave';
import { PageDraftRestoreBanner } from '@/components/erp/PageDraftRestoreBanner';
import { zodResolver } from '@hookform/resolvers/zod';
import { DatePickerWithHijri } from '@/components/ui/DatePickerWithHijri';
import { CostCenterSelect } from '@/app/components/form/CostCenterSelect';
import { toHijriDate } from '@/lib/hijri-date';
import {
  financialVoucherHeaderFormSchema,
  type FinancialVoucherHeaderFormInput,
} from '@/lib/validation/accounting.schema';
import { parseDecimal, roundMoney2 } from '@/lib/money/parseDecimal';
import type { ApiError } from '@/lib/api/types';
import {
  postCashVoucherAfterSave,
  useRepostAfterUnpost,
} from '@/lib/accounting/ensure-posted-after-save';
import { toastVersionConflict } from '@/lib/feedback/toast';
import { isOptimisticLockApiError } from '@/lib/concurrency/version-conflict';
import { dispatchAcademyTrigger } from '@/lib/onboarding/tourCheckpoints';
import { getTenantContext } from '@/lib/tenant/tenant-context-storage';
import {
  FINANCIAL_VOUCHER_VARIANTS,
  type FinancialVoucherVariantId,
} from '@/lib/treasury/financial-voucher.variant';
import { shouldLockLoadedSource, type TransactionSettings } from '@/lib/transaction-settings/types';
import { useShowFxColumns } from '@/lib/transaction-settings/useShowFxColumns';
import { ShowFxColumnsField } from '@/components/accounting/ShowFxColumnsField';
import { consumeAiTransactionDraft, peekAiTransactionDraft } from '@/lib/ai/ai-draft-storage';
import { useAccountingSettingsQuery } from '@/lib/hooks/useAccountingSettings';
import {
  pickCurrencyByCode,
  rateForCurrency,
  sameCurrencyCode,
  treasuryBalanceInCurrency,
  withHeaderCurrency,
} from '@/lib/accounting/fx-base';
import { costCenterRuleFromAccount, costCenterRuleMessage } from '@/lib/accounting/cost-center-rule';
import { useCompanyBaseCurrency } from '@/lib/hooks/useCompanyBaseCurrency';
import { DocumentCurrencyRateFields } from '@/components/accounting/DocumentCurrencyRateFields';
import { onFieldErrors } from '@/lib/forms/on-field-errors';
import {
  formatTreasuryBalanceLabel,
  isCashAmountOverBalance,
} from '@/lib/accounting-settings/guardrail-hints';

const VoucherPrintActions = dynamic(
  () =>
    import('@/app/components/print/VoucherPrintActions').then((m) => ({
      default: m.VoucherPrintActions,
    })),
  { ssr: false }
);

interface Account {
  id: string;
  code: string;
  arabicName: string;
  englishName?: string;
  costCenterRequired?: string | null;
  requiresCostCenter?: boolean | null;
  isActive?: boolean;
}

interface Currency {
  id: string;
  code: string;
  arabicName: string;
  englishName?: string;
  exchangeRate?: number | string | null;
}

interface FundOption {
  id: string;
  arabicName: string;
  englishName?: string;
  code?: string | null;
  accountNumber?: string | null;
  balance?: number | string;
  isDefault?: boolean;
  glAccountCode?: string | null;
  glAccount?: { id: string; code: string; arabicName: string } | null;
  bank?: { arabicName?: string; englishName?: string; code?: string | null } | null;
}

interface Party {
  id: string;
  arabicName?: string;
  accountId?: string | null;
}

type VoucherLine = VoucherGridLine;

interface CashTxRow {
  id: string;
  voucherNumber?: string | null;
  date: string;
  description?: string | null;
  amount: number | string;
  currencyCode: string;
  safeId?: string | null;
  bankAccountId?: string | null;
  customerId?: string | null;
  supplierId?: string | null;
  offsetAccountId?: string | null;
  departmentId?: string | null;
  sourceOrderId?: string | null;
  hijriDate?: string | null;
  isRecurring?: boolean;
  isPosted?: boolean;
  isCancelled?: boolean;
  journalEntryId?: string | null;
  workflowStatus?: string | null;
  bankReference?: string | null;
  valueDate?: string | null;
  lines?: Array<{
    accountId: string;
    description?: string | null;
    amount: number | string;
    currencyCode: string;
    exchangeRate?: number | string;
    costCenterId?: string | null;
    entrySide?: 'DEBIT' | 'CREDIT';
    isTiedToInvoice?: boolean;
    invoiceId?: string | null;
  }>;
  journalEntry?: { id: string; voucherNumber?: string | null } | null;
  version?: number | null;
}

interface ApprovalRow {
  userId: string;
  name: string;
  status: 'APPROVED' | 'PENDING';
  approvedAt: string | null;
}

interface CompanySettingsRow {
  autoNumbering?: boolean | null;
  dateUsage?: 'gregorian' | 'hijri' | 'both' | null;
  accountsGuideDigits?: number | null;
  enableApprovalsWorkflow?: boolean | null;
}

function defaultCurrencyId(currencies: Currency[], companyBase = 'EGP'): string {
  if (!currencies.length) return '';
  return pickCurrencyByCode(currencies, companyBase)?.id || currencies[0].id;
}

function toHijri(isoDate: string): string {
  return toHijriDate(isoDate);
}

function costCenterRule(account?: Account): 'required' | 'optional' | 'none' {
  return costCenterRuleFromAccount(account);
}

function emptyLine(
  currencyCode: string,
  entrySide: 'DEBIT' | 'CREDIT' = 'DEBIT',
  costCenterId = '',
  exchangeRate = 1
): VoucherLine {
  return emptyPaymentLine(currencyCode, entrySide, costCenterId, exchangeRate);
}

function applyDefaultCostCenter<T extends { costCenterId?: string; accountId?: string }>(
  rows: T[],
  costCenterId: string,
  accounts: Account[] = []
): T[] {
  return rows.map((line, index) => {
    const account = accounts.find((a) => a.id === line.accountId);
    if (costCenterRuleFromAccount(account) === 'none') {
      return { ...line, costCenterId: '' };
    }
    return index === 0 || !line.costCenterId ? { ...line, costCenterId } : line;
  });
}

function settingsDocumentTypeForVariant(
  variantId: FinancialVoucherVariantId
): 'PAYMENT_VOUCHER' | 'RECEIPT_VOUCHER' | 'BANK_DEBIT_ADVICE' | 'BANK_CREDIT_ADVICE' {
  switch (variantId) {
    case 'CASH_DISBURSEMENT':
      return 'PAYMENT_VOUCHER';
    case 'CASH_RECEIPT':
      return 'RECEIPT_VOUCHER';
    case 'BANK_DEBIT_ADVICE':
      return 'BANK_DEBIT_ADVICE';
    case 'BANK_CREDIT_ADVICE':
      return 'BANK_CREDIT_ADVICE';
  }
}

function fundIdForGlAccount(funds: FundOption[], accountId?: string | null): string {
  if (accountId) {
    const byGl = funds.find((fund) => fund.glAccount?.id === accountId)?.id;
    if (byGl) return byGl;
  }
  return funds.find((fund) => fund.isDefault)?.id ?? funds[0]?.id ?? '';
}

const advancedActionClass =
  'inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-1.5 text-sm font-bold text-gray-700 transition-colors hover:border-[#0E78AA] hover:text-[#0E78AA] disabled:opacity-40';

export function FinancialVoucherEngine({ variantId }: { variantId: FinancialVoucherVariantId }) {
  return (
    <DocumentModeProvider>
      <FinancialVoucherEngineInner variantId={variantId} />
    </DocumentModeProvider>
  );
}

function FinancialVoucherEngineInner({ variantId }: { variantId: FinancialVoucherVariantId }) {
  const variant = FINANCIAL_VOUCHER_VARIANTS[variantId];
  const { lockToView, setMode, unlockForEdit, isReadOnly } = useDocumentMode();
  const router = useRouter();
  const pathname = useOwnTabPathname();
  const searchParams = useOwnTabSearchParams();
  const idFromUrl = searchParams.get('id');
  const fromAiDraft = searchParams.get('fromAiDraft') === '1';
  const invalidateQuery = useInvalidateQuery();
  const lastHydratedIdRef = useRef<string | null>(null);
  const aiDraftAppliedRef = useRef(false);
  const { markUnpostedForEdit, consumeShouldRepost, resetKeepPosted } = useRepostAfterUnpost();
  const todayStr = new Date().toISOString().split('T')[0];
  const companyId = getTenantContext().companyId;
  const isBank = variant.fundType === 'BANK_ACCOUNT';
  const isPayable = variant.allocationSide === 'payable';
  const isCashPayment = variantId === 'CASH_DISBURSEMENT';
  const isCashReceipt = variantId === 'CASH_RECEIPT';
  const isBankDebit = variantId === 'BANK_DEBIT_ADVICE';
  const isBankCredit = variantId === 'BANK_CREDIT_ADVICE';
  const isCashVoucher = isCashPayment || isCashReceipt;
  const isBankVoucher = isBankDebit || isBankCredit;
  const isReceiptPolarity = isCashReceipt || isBankCredit;
  const isModernVoucher = isCashVoucher || isBankVoucher;
  const mainEntrySide = isReceiptPolarity ? 'CREDIT' : 'DEBIT';
  const otherEntrySide = isReceiptPolarity ? 'DEBIT' : 'CREDIT';

  const [isPosted, setIsPosted] = useState(false);
  const [isCancelled, setIsCancelled] = useState(false);
  const [isEditing, setIsEditing] = useState(true); // kept in sync with DocumentMode
  const [voucherLines, setVoucherLines] = useState<VoucherLine[]>([emptyLine('EGP')]);
  const [creditLines, setCreditLines] = useState<VoucherLine[]>([]);
  const [showCreditModal, setShowCreditModal] = useState(false);
  const { showFx: showFxColumns, setShowFx: setShowFxColumns, resetFxToSetting } = useShowFxColumns(
    settingsDocumentTypeForVariant(variantId)
  );
  const [defaultCostCenterId, setDefaultCostCenterId] = useState('');
  const [orderRefResetKey, setOrderRefResetKey] = useState(0);
  const [showPaymentsModal, setShowPaymentsModal] = useState(false);
  const [showRecurringModal, setShowRecurringModal] = useState(false);
  const [showBrowseList, setShowBrowseList] = useState(false);
  const [showApprovalsModal, setShowApprovalsModal] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [savedVoucherId, setSavedVoucherId] = useState<string | null>(
    () => idFromUrl?.trim() || null
  );
  const [documentVersion, setDocumentVersion] = useState(0);
  const [journalEntryId, setJournalEntryId] = useState<string | null>(null);
  const [journalNumber, setJournalNumber] = useState<string | null>(null);
  const [allocations, setAllocations] = useState<{ invoiceId: string; allocatedAmount: number }[]>(
    []
  );

  const openVoucher = useCallback(
    (id: string | null) => {
      setSavedVoucherId(id);
      if (id) {
        router.replace(`${pathname}?id=${id}`, { scroll: false });
      } else {
        router.replace(pathname, { scroll: false });
      }
    },
    [pathname, router]
  );

  const skipUrlHydrateRef = useRef(false);

  useEffect(() => {
    const id = idFromUrl?.trim();
    if (skipUrlHydrateRef.current) {
      if (!id) skipUrlHydrateRef.current = false;
      return;
    }
    if (id && id !== savedVoucherId) {
      setSavedVoucherId(id);
      return;
    }
    if (!id && savedVoucherId) {
      setSavedVoucherId(null);
    }
  }, [idFromUrl, savedVoucherId]);

  useEffect(() => {
    if (!savedVoucherId) setMode('create');
  }, [savedVoucherId, setMode]);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    control,
    formState: { errors },
  } = useForm<FinancialVoucherHeaderFormInput>({
    resolver: zodResolver(financialVoucherHeaderFormSchema) as Resolver<FinancialVoucherHeaderFormInput>,
    defaultValues: {
      date: todayStr,
      description: '',
      fundId: '',
      currencyId: '',
      voucherNumber: '',
      hijriDate: '',
      isCyclic: false,
      isApproved: false,
      departmentId: '',
      sourceOrderId: '',
      bankReference: '',
      valueDate: '',
    },
    mode: 'onTouched',
  });

  const currencyId = watch('currencyId');
  const fundId = watch('fundId');
  const dateW = watch('date');
  const departmentId = watch('departmentId');
  const sourceOrderId = watch('sourceOrderId');
  const voucherNumberW = watch('voucherNumber');
  const descriptionW = watch('description');
  const isCyclicW = watch('isCyclic');
  const bankReferenceW = watch('bankReference');
  const valueDateW = watch('valueDate');
  const headerSnapshot = useWatch({ control }) as FinancialVoucherHeaderFormInput;
  const voucherDraftSnapshot = useMemo(
    () => ({
      header: headerSnapshot,
      voucherLines,
      creditLines,
      defaultCostCenterId,
      allocations,
    }),
    [allocations, creditLines, defaultCostCenterId, headerSnapshot, voucherLines]
  );
  const applyVoucherDraft = useCallback(
    (payload: typeof voucherDraftSnapshot) => {
      if (payload?.header && typeof payload.header === 'object') reset(payload.header);
      setVoucherLines(
        Array.isArray(payload?.voucherLines) && payload.voucherLines.length
          ? payload.voucherLines
          : [emptyLine('EGP')]
      );
      setCreditLines(Array.isArray(payload?.creditLines) ? payload.creditLines : []);
      setDefaultCostCenterId(payload?.defaultCostCenterId ?? '');
      setAllocations(Array.isArray(payload?.allocations) ? payload.allocations : []);
    },
    [reset]
  );
  const {
    restoreOffer,
    acceptRestore,
    dismissRestore,
    clearDraft,
  } = useDraftAutosave({
    documentType: 'voucher',
    variantId,
    value: voucherDraftSnapshot,
    enabled: !savedVoucherId && !isPosted,
    applyRestore: applyVoucherDraft,
    isEmpty: (draft) =>
      !draft.header?.description?.trim() &&
      !(draft.voucherLines ?? []).some((line) => line.accountId) &&
      !(draft.creditLines ?? []).some((line) => line.accountId) &&
      !(draft.allocations ?? []).length,
    restoreMessage: 'تم استعادة مسودة السند',
  });

  const { data: accountsResponse } = useApiQuery<Account[]>(
    ['accounts', 'leaf'],
    '/accounting/accounts',
    { limit: 20000, isActive: true, leafOnly: true }
  );
  const accounts = accountsResponse?.data || [];

  const { data: currenciesResponse } = useApiQuery<Currency[]>(
    ['currencies'],
    '/accounting/currencies',
    { limit: 100, isActive: true }
  );
  const currencies = useMemo(() => currenciesResponse?.data || [], [currenciesResponse?.data]);

  const { data: safesResponse } = useSafesQuery({ enabled: !isBank });
  const { data: banksResponse } = useBankAccountsQuery({ enabled: isBank });
  const funds = isBank ? banksResponse?.data || [] : safesResponse?.data || [];
  const { data: liveFundResponse } = useLiveFundBalance({
    kind: isBank ? 'bank' : 'safe',
    id: fundId,
  });
  const settingsDocumentType = settingsDocumentTypeForVariant(variantId);
  const { data: txSettingsRes } = useApiQuery<TransactionSettings>(
    ['transaction-settings', settingsDocumentType],
    `/transaction-settings/${settingsDocumentType}`
  );
  const txSettings = txSettingsRes?.data;
  const defaultsAppliedRef = useRef(false);

  const { data: suppliersResponse } = useApiQuery<Party[]>(
    ['suppliers'],
    '/accounting/suppliers',
    { limit: 500, isActive: true }
  );
  const { data: customersResponse } = useApiQuery<Party[]>(
    ['customers'],
    '/accounting/customers',
    { limit: 500, isActive: true }
  );
  const parties = useMemo(
    () => [...(suppliersResponse?.data || []), ...(customersResponse?.data || [])],
    [suppliersResponse?.data, customersResponse?.data]
  );

  const { data: settingsResponse } = useApiQuery<CompanySettingsRow>(
    ['company-settings', companyId ?? 'none'],
    companyId ? `/companies/${companyId}/settings` : '/companies/none/settings',
    undefined,
    { enabled: Boolean(companyId), staleTime: 60_000 }
  );
  const settings = settingsResponse?.data;
  const { data: accountingSettingsRes } = useAccountingSettingsQuery();
  const { code: companyBaseCurrency } = useCompanyBaseCurrency();
  const preventCashOverdraft =
    accountingSettingsRes?.data?.controls?.preventCashOverdraft === true;
  const autoNumbering = settings?.autoNumbering !== false && txSettings?.numberingMode !== 'MANUAL';
  const dateUsage = settings?.dateUsage ?? 'both';
  const showHijri = dateUsage === 'hijri' || dateUsage === 'both';

  const { data: postingModeResponse } = useApiQuery<{ mode: 'AUTO' | 'MANUAL' | 'MULTI' }>(
    ['cash-posting-mode', variant.family],
    '/treasury/cash-transactions/posting-mode',
    { family: variant.family },
    { staleTime: 60_000 }
  );
  const postingMode = postingModeResponse?.data?.mode ?? 'MANUAL';

  const listQuery = {
    transactionKind: variant.transactionKind,
    documentRole: 'VOUCHER' as const,
    fundType: variant.fundType,
  };

  const { data: ordersResponse } = useApiQuery<CashTxRow[]>(
    ['cash-orders', variant.transactionKind],
    '/treasury/cash-transactions',
    {
      transactionKind: variant.transactionKind,
      documentRole: 'ORDER',
      isCancelled: false,
      limit: 200,
    }
  );
  const orders = useMemo(() => ordersResponse?.data || [], [ordersResponse?.data]);

  const { data: selectedOrderResponse } = useApiQuery<CashTxRow>(
    ['cash-order-detail', sourceOrderId ?? 'none'],
    sourceOrderId ? `/treasury/cash-transactions/${sourceOrderId}` : '/treasury/cash-transactions',
    undefined,
    { enabled: Boolean(sourceOrderId) }
  );

  const { data: selectedVoucherResponse } = useApiQuery<CashTxRow>(
    ['cash-voucher-detail', savedVoucherId ?? 'none'],
    savedVoucherId ? `/treasury/cash-transactions/${savedVoucherId}` : '/treasury/cash-transactions',
    undefined,
    { enabled: Boolean(savedVoucherId) }
  );

  const { data: recurringResponse } = useApiQuery<CashTxRow[]>(
    ['treasury-recurring-vouchers', variant.id],
    '/treasury/cash-transactions',
    { ...listQuery, isRecurring: true, limit: 50 },
    { enabled: showRecurringModal }
  );
  const recurringItems = recurringResponse?.data || [];

  const { data: approvalsResponse, refetch: refetchApprovals } = useApiQuery<{
    mode: string;
    workflowStatus: string;
    approvers: ApprovalRow[];
    voucherNumber?: string | null;
  }>(
    ['cash-voucher-approvals', savedVoucherId ?? 'none'],
    savedVoucherId
      ? `/treasury/cash-transactions/${savedVoucherId}/approvals`
      : '/treasury/cash-transactions/posting-mode',
    savedVoucherId ? undefined : { family: variant.family },
    { enabled: Boolean(savedVoucherId) && showApprovalsModal }
  );

  const saveMutation = useApiMutation<CashTxRow, Record<string, unknown>>(
    '/treasury/cash-transactions',
    'POST',
    {
      onSuccess: (res: { data?: CashTxRow }) => {
        const row = res?.data;
        const message = row?.isPosted
          ? `تم حفظ وترحيل ${variant.title} تلقائياً`
          : `تم حفظ ${variant.title} بنجاح`;
        invalidateQuery(['treasury-cash-transactions']);
        invalidateQuery(['cash-voucher-detail']);
        invalidateQuery(['cash-order-detail']);
        invalidateQuery(['voucher-source-orders']);
        invalidateQuery(['journal-entry']);
        invalidateQuery(['journal-entries']);
        invalidateTreasuryFundBalances(invalidateQuery);
        dispatchAcademyTrigger('API_SUCCESS', variant.academyTrigger);
        if (row?.id) {
          lastHydratedIdRef.current = null;
          setSavedVoucherId(row.id);
          if (typeof row.version === 'number') setDocumentVersion(row.version);
        }
        setSuccess(message);
      },
      onError: (err: ApiError) => {
        if (isOptimisticLockApiError(err)) {
          toastVersionConflict(err.message, () => {
            lastHydratedIdRef.current = null;
            invalidateQuery(['cash-voucher-detail', savedVoucherId ?? 'none']);
          });
          return;
        }
        setError(err.message || 'حدث خطأ أثناء الحفظ');
      },
    }
  );

  const updateMutation = useApiMutation<CashTxRow, Record<string, unknown>>(
    savedVoucherId ? `/treasury/cash-transactions/${savedVoucherId}` : '/treasury/cash-transactions',
    'PATCH',
    {
      onSuccess: (res: { data?: CashTxRow }) => {
        const row = res?.data;
        invalidateQuery(['treasury-cash-transactions']);
        invalidateQuery(['cash-voucher-detail']);
        invalidateQuery(['cash-order-detail']);
        invalidateQuery(['voucher-source-orders']);
        invalidateQuery(['journal-entry']);
        invalidateQuery(['journal-entries']);
        invalidateTreasuryFundBalances(invalidateQuery);
        dispatchAcademyTrigger('API_SUCCESS', variant.academyTrigger);
        if (row?.id && !row.isPosted && consumeShouldRepost()) {
          void postCashVoucherAfterSave(row.id)
            .then(() => {
              invalidateQuery(['treasury-cash-transactions']);
              invalidateQuery(['cash-voucher-detail']);
              invalidateQuery(['journal-entry']);
              invalidateQuery(['journal-entries']);
              invalidateTreasuryFundBalances(invalidateQuery);
              lastHydratedIdRef.current = null;
              setSuccess(`تم حفظ تعديلات ${variant.title} وترحيل القيد`);
            })
            .catch((err: ApiError) => {
              lastHydratedIdRef.current = null;
              setError(err.message || 'تم الحفظ لكن تعذر ترحيل القيد');
            });
          return;
        }
        lastHydratedIdRef.current = null;
        setSuccess(
          row?.isPosted
            ? `تم حفظ تعديلات ${variant.title} وتحديث القيد`
            : `تم حفظ تعديلات ${variant.title} بنجاح`
        );
      },
      onError: (err: ApiError) => {
        if (isOptimisticLockApiError(err)) {
          toastVersionConflict(err.message, () => {
            lastHydratedIdRef.current = null;
            invalidateQuery(['cash-voucher-detail', savedVoucherId ?? 'none']);
          });
          return;
        }
        setError(err.message || 'حدث خطأ أثناء الحفظ');
      },
    }
  );

  const cancelMutation = useApiMutation<unknown, { expectedVersion?: number }>(
    savedVoucherId ? `/treasury/cash-transactions/${savedVoucherId}/cancel` : '/treasury/cash-transactions',
    'POST',
    {
      onSuccess: () => {
        setIsCancelled(true);
        setSuccess('تم إلغاء السند');
        lastHydratedIdRef.current = null;
        invalidateQuery(['treasury-cash-transactions']);
        invalidateQuery(['cash-voucher-detail']);
        invalidateQuery(['cash-order-detail']);
        invalidateQuery(['voucher-source-orders']);
        invalidateTreasuryFundBalances(invalidateQuery);
        lockToView();
      },
      onError: (err: ApiError) => {
        if (isOptimisticLockApiError(err)) {
          toastVersionConflict(err.message, () => {
            lastHydratedIdRef.current = null;
            invalidateQuery(['cash-voucher-detail', savedVoucherId ?? 'none']);
          });
          return;
        }
        setError(err.message || 'تعذر إلغاء السند');
      },
    }
  );

  const approveMutation = useApiMutation<unknown, Record<string, never>>(
    savedVoucherId ? `/treasury/cash-transactions/${savedVoucherId}/approve` : '/treasury/cash-transactions',
    'POST',
    {
      onSuccess: () => {
        setSuccess('تم تسجيل الاعتماد');
        void refetchApprovals();
      },
      onError: (err: ApiError) => setError(err.message || 'تعذر الاعتماد'),
    }
  );

  const postMutation = useApiMutation<CashTxRow, Record<string, never>>(
    savedVoucherId ? `/treasury/cash-transactions/${savedVoucherId}/post` : '/treasury/cash-transactions',
    'POST',
    {
      onSuccess: (res: { data?: CashTxRow }) => {
        const row = res?.data;
        setIsPosted(true);
        setIsCancelled(Boolean(row?.isCancelled));
        if (typeof row?.version === 'number') setDocumentVersion(row.version);
        setJournalEntryId(row?.journalEntryId ?? row?.journalEntry?.id ?? journalEntryId);
        setJournalNumber(row?.journalEntry?.voucherNumber ?? journalNumber);
        setIsEditing(false);
        lockToView();
        invalidateQuery(['treasury-cash-transactions']);
        invalidateQuery(['cash-voucher-detail']);
        invalidateQuery(['journal-entry']);
        invalidateQuery(['journal-entries']);
        invalidateTreasuryFundBalances(invalidateQuery);
        setSuccess(`تم ترحيل ${variant.title}`);
      },
      onError: (err: ApiError) => setError(err.message || 'تعذر ترحيل السند'),
    }
  );

  const unpostMutation = useApiMutation<CashTxRow, Record<string, never>>(
    savedVoucherId ? `/treasury/cash-transactions/${savedVoucherId}/unpost` : '/treasury/cash-transactions',
    'POST',
    {
      onSuccess: (res: { data?: CashTxRow }) => {
        const row = res?.data;
        setIsPosted(false);
        markUnpostedForEdit();
        setIsCancelled(Boolean(row?.isCancelled));
        if (typeof row?.version === 'number') setDocumentVersion(row.version);
        setJournalEntryId(row?.journalEntryId ?? row?.journalEntry?.id ?? null);
        setJournalNumber(row?.journalEntry?.voucherNumber ?? null);
        lastHydratedIdRef.current = null;
        invalidateQuery(['treasury-cash-transactions']);
        invalidateQuery(['cash-voucher-detail']);
        invalidateQuery(['journal-entry']);
        invalidateQuery(['journal-entries']);
        invalidateTreasuryFundBalances(invalidateQuery);
        unlockForEdit();
        setIsEditing(true);
        setSuccess(`تم فك ترحيل ${variant.title}`);
      },
      onError: (err: ApiError) => setError(err.message || 'تعذر فك ترحيل السند'),
    }
  );

  const loading = saveMutation.isPending || updateMutation.isPending;
  const financialBusy = loading || postMutation.isPending || unpostMutation.isPending;

  useEffect(() => {
    if (currencies.length > 0 && !currencyId) {
      const def = pickCurrencyByCode(currencies, companyBaseCurrency);
      if (def) setValue('currencyId', def.id, { shouldValidate: false });
    }
  }, [companyBaseCurrency, currencies, currencyId, setValue]);

  useEffect(() => {
    if (!showHijri || !dateW) return;
    setValue('hijriDate', toHijri(dateW), { shouldValidate: false });
  }, [dateW, showHijri, setValue]);

  const skipHeaderFxSyncRef = useRef(false);
  const prevHeaderCurrencyCodeRef = useRef('');
  const [headerRateOverride, setHeaderRateOverride] = useState<number | null>(null);
  const applyHeaderCurrencyToRows = useCallback(
    (code: string, catalogRate?: number | string | null) => {
      if (!code) return;
      const prevCode = prevHeaderCurrencyCodeRef.current;
      const follow = (line: { currencyCode?: string }) =>
        !line.currencyCode || sameCurrencyCode(line.currencyCode, prevCode) || sameCurrencyCode(line.currencyCode, code);
      setVoucherLines((prev) =>
        prev.map((line) =>
          follow(line) ? withHeaderCurrency(line, code, catalogRate, companyBaseCurrency) : line
        )
      );
      setCreditLines((prev) =>
        prev.map((line) =>
          follow(line) ? withHeaderCurrency(line, code, catalogRate, companyBaseCurrency) : line
        )
      );
      prevHeaderCurrencyCodeRef.current = code;
    },
    [companyBaseCurrency]
  );

  useEffect(() => {
    const header = currencies.find((c) => c.id === currencyId);
    if (!header?.code) return;
    if (skipHeaderFxSyncRef.current) {
      skipHeaderFxSyncRef.current = false;
      prevHeaderCurrencyCodeRef.current = header.code;
      return;
    }
    setHeaderRateOverride(null);
    applyHeaderCurrencyToRows(header.code, header.exchangeRate);
    // Header pick only — don't re-run when the currencies catalog refetches.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currencyId]);

  const applyCashRow = (row: CashTxRow, asTemplate = false) => {
    skipHeaderFxSyncRef.current = true;
    setSavedVoucherId(asTemplate ? null : row.id);
    setDocumentVersion(asTemplate ? 0 : typeof row.version === 'number' ? row.version : 0);
    setIsPosted(asTemplate ? false : Boolean(row.isPosted));
    setIsCancelled(asTemplate ? false : Boolean(row.isCancelled));
    setIsEditing(asTemplate);
    if (asTemplate) setMode('create');
    else if (row.isPosted || row.isCancelled) lockToView();
    else setMode('edit');
    setJournalEntryId(asTemplate ? null : row.journalEntryId ?? row.journalEntry?.id ?? null);
    setJournalNumber(asTemplate ? null : row.journalEntry?.voucherNumber ?? null);
    setValue('voucherNumber', row.voucherNumber ?? '', { shouldValidate: false });
    setValue('date', row.date?.slice(0, 10) || todayStr, { shouldValidate: false });
    setValue('hijriDate', row.hijriDate || toHijri(row.date?.slice(0, 10) || todayStr), {
      shouldValidate: false,
    });
    setValue('description', row.description ?? '', { shouldValidate: false });
    setValue('fundId', (isBank ? row.bankAccountId : row.safeId) ?? '', { shouldValidate: false });
    setValue('departmentId', row.departmentId ?? '', { shouldValidate: false });
    setValue('sourceOrderId', row.sourceOrderId ?? '', { shouldValidate: false });
    setValue('isCyclic', Boolean(row.isRecurring), { shouldValidate: false });
    setValue('bankReference', row.bankReference ?? '', { shouldValidate: false });
    setValue('valueDate', row.valueDate?.slice(0, 10) ?? '', { shouldValidate: false });
    const cur = currencies.find((c) => c.code === row.currencyCode);
    if (cur) setValue('currencyId', cur.id, { shouldValidate: false });
    const savedRate = Number(row.exchangeRate ?? row.lines?.[0]?.exchangeRate);
    setHeaderRateOverride(savedRate > 0 ? savedRate : null);
    const headerPartyId = row.supplierId || row.customerId || '';
    const headerPartyKind: VoucherLine['partyKind'] = row.supplierId
      ? 'SUPPLIER'
      : row.customerId
        ? 'CUSTOMER'
        : undefined;
    if (row.lines?.length) {
      const compound =
        row.lines.some((line) => line.entrySide === 'CREDIT') &&
        row.lines.some((line) => line.entrySide === 'DEBIT');
      const mapped = row.lines.map((line, index) => ({
        accountId: line.accountId,
        description: line.description ?? '',
        amount: Number(line.amount),
        currencyCode: line.currencyCode,
        exchangeRate: Number(line.exchangeRate ?? 1),
        costCenterId: line.costCenterId ?? '',
        entrySide: compound
          ? line.entrySide === 'DEBIT'
            ? ('DEBIT' as const)
            : ('CREDIT' as const)
          : mainEntrySide,
        isTiedToInvoice: Boolean(line.isTiedToInvoice && line.invoiceId),
        invoiceId: line.invoiceId ?? null,
        partyId: index === 0 && headerPartyId ? headerPartyId : undefined,
        partyKind: index === 0 ? headerPartyKind : undefined,
      }));
      const mains = mapped.filter((l) => l.entrySide === mainEntrySide);
      setVoucherLines(mains.length ? mains : [emptyLine(row.currencyCode || 'EGP', mainEntrySide)]);
      setCreditLines(mapped.filter((l) => l.entrySide === otherEntrySide));
    } else {
      setVoucherLines([
        {
          accountId: row.offsetAccountId ?? '',
          description: row.description ?? '',
          amount: Number(row.amount) || 0,
          currencyCode: row.currencyCode,
          exchangeRate: rateForCurrency(
            row.currencyCode,
            companyBaseCurrency,
            currencies.find((c) => c.code === row.currencyCode)?.exchangeRate
          ),
          costCenterId: '',
          partyId: headerPartyId || undefined,
          partyKind: headerPartyKind,
          entrySide: mainEntrySide,
        },
      ]);
      setCreditLines([]);
    }
  };

  useEffect(() => {
    if (!sourceOrderId) return;
    const order = selectedOrderResponse?.data ?? orders.find((o) => o.id === sourceOrderId);
    if (!order) return;
    const headerPartyId = order.supplierId || order.customerId || '';
    const headerPartyKind: VoucherLine['partyKind'] = order.supplierId
      ? 'SUPPLIER'
      : order.customerId
        ? 'CUSTOMER'
        : undefined;
    if (order.lines?.length) {
      const compound =
        order.lines.some((line) => line.entrySide === 'CREDIT') &&
        order.lines.some((line) => line.entrySide === 'DEBIT');
      const mapped = order.lines.map((line, index) => ({
        accountId: line.accountId,
        description: line.description ?? order.description ?? '',
        amount: Number(line.amount),
        currencyCode: line.currencyCode || order.currencyCode,
        exchangeRate: Number(line.exchangeRate ?? 1),
        costCenterId: line.costCenterId ?? '',
        entrySide: compound
          ? line.entrySide === 'DEBIT'
            ? ('DEBIT' as const)
            : ('CREDIT' as const)
          : mainEntrySide,
        partyId: index === 0 && headerPartyId ? headerPartyId : undefined,
        partyKind: index === 0 ? headerPartyKind : undefined,
      }));
      const mains = mapped.filter((l) => l.entrySide === mainEntrySide);
      setVoucherLines(mains.length ? mains : [emptyLine(order.currencyCode || 'EGP', mainEntrySide)]);
      setCreditLines(mapped.filter((l) => l.entrySide === otherEntrySide));
    } else if (order.offsetAccountId || Number(order.amount) > 0) {
      setVoucherLines([
        {
          accountId: order.offsetAccountId ?? '',
          description: order.description ?? '',
          amount: Number(order.amount),
          currencyCode: order.currencyCode,
          exchangeRate: rateForCurrency(
            order.currencyCode,
            companyBaseCurrency,
            currencies.find((c) => c.code === order.currencyCode)?.exchangeRate
          ),
          partyId: headerPartyId || undefined,
          partyKind: headerPartyKind,
          entrySide: mainEntrySide,
        },
      ]);
    }
    if (order.description) setValue('description', order.description, { shouldValidate: false });
    const orderFund = isBank ? order.bankAccountId : order.safeId;
    if (orderFund) setValue('fundId', orderFund, { shouldValidate: false });
    const orderCurrency = currencies.find((c) => c.code === order.currencyCode);
    if (orderCurrency) setValue('currencyId', orderCurrency.id, { shouldValidate: false });
    if (order.date) {
      const iso = order.date.slice(0, 10);
      setValue('date', iso, { shouldValidate: false });
      setValue('hijriDate', order.hijriDate || toHijriDate(iso), { shouldValidate: false });
    }
  }, [sourceOrderId, orders, selectedOrderResponse, setValue, isBank, currencies, mainEntrySide, otherEntrySide]);

  useEffect(() => {
    const row = selectedVoucherResponse?.data;
    if (!row?.id || row.id !== savedVoucherId) return;
    if (lastHydratedIdRef.current === row.id) return;
    lastHydratedIdRef.current = row.id;
    applyCashRow(row);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedVoucherId, selectedVoucherResponse]);

  const selectedFund = fundId && funds.length > 0 ? funds.find((s) => s.id === fundId) : undefined;
  const currency = currencies.find((c) => c.id === currencyId);
  const headerCurrencyCode = currency?.code ?? companyBaseCurrency;
  const headerFxRate =
    headerRateOverride ??
    rateForCurrency(headerCurrencyCode, companyBaseCurrency, currency?.exchangeRate);
  const storedBaseBalance = parseDecimal(
    liveFundResponse?.data?.balance ?? selectedFund?.balance
  );
  const balanceNum = selectedFund
    ? roundMoney2(treasuryBalanceInCurrency(storedBaseBalance, headerFxRate))
    : 0;
  const balance = selectedFund
    ? balanceNum.toLocaleString('ar-EG', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : '0';
  const mainTotal = isReceiptPolarity
    ? splitPaymentLineTotals(voucherLines.map((l) => ({ ...l, entrySide: 'CREDIT' }))).creditTotal
    : splitPaymentLineTotals(voucherLines.map((l) => ({ ...l, entrySide: 'DEBIT' }))).debitTotal;
  const otherTotal = isReceiptPolarity
    ? splitPaymentLineTotals(creditLines.map((l) => ({ ...l, entrySide: 'DEBIT' }))).debitTotal
    : splitPaymentLineTotals(creditLines.map((l) => ({ ...l, entrySide: 'CREDIT' }))).creditTotal;
  const debitTotal = isReceiptPolarity ? otherTotal : mainTotal;
  const creditTotal = isReceiptPolarity ? mainTotal : otherTotal;
  const totalAmount = isModernVoucher
    ? mainTotal - otherTotal
    : voucherLines.reduce((sum, line) => sum + (Number(line.amount) || 0), 0);
  const documentNet = isModernVoucher
    ? voucherLines.reduce((sum, line) => sum + (Number(line.amount) || 0), 0) -
      creditLines.reduce((sum, line) => sum + (Number(line.amount) || 0), 0)
    : voucherLines.reduce((sum, line) => sum + (Number(line.amount) || 0), 0);
  const overdraftWarning =
    variant.transactionKind === 'PAYMENT' &&
    preventCashOverdraft &&
    isCashAmountOverBalance(documentNet, balanceNum);
  const { profile: companyProfile } = useCompanyPrintProfile();

  useEffect(() => {
    if (savedVoucherId || fromAiDraft) return;
    if (!txSettings) return;
    const fundAccountId = isBank ? txSettings.defaultBankGlAccountId : txSettings.defaultCashAccountId;
    if (funds.length === 0) return;
    if (defaultsAppliedRef.current) return;
    defaultsAppliedRef.current = true;
    const costCenter = txSettings.defaultCostCenterId ?? '';
    const offsetAccountId = txSettings.defaultOffsetAccountId ?? '';
    const nextFundId = fundIdForGlAccount(funds, fundAccountId);
    setDefaultCostCenterId(costCenter);
    if (nextFundId) setValue('fundId', nextFundId, { shouldValidate: false });
    setVoucherLines((prev) => {
      const first = prev[0];
      if (prev.length !== 1 || !first) {
        return [
          {
            ...emptyLine(headerCurrencyCode, mainEntrySide, costCenter, headerFxRate),
            accountId: offsetAccountId,
          },
        ];
      }
      if (first.accountId || Number(first.amount) > 0 || first.description) {
        return applyDefaultCostCenter(prev, costCenter, accounts);
      }
      return [
        {
          ...emptyLine(headerCurrencyCode, mainEntrySide, costCenter, headerFxRate),
          accountId: offsetAccountId,
        },
      ];
    });
  }, [
    fromAiDraft,
    funds,
    headerCurrencyCode,
    headerFxRate,
    isBank,
    mainEntrySide,
    savedVoucherId,
    setValue,
    txSettings,
  ]);

  useEffect(() => {
    if (aiDraftAppliedRef.current || !fromAiDraft || savedVoucherId) return;
    const pending = peekAiTransactionDraft();
    if (!pending || pending.actionType !== 'DRAFT_PAYMENT_VOUCHER') return;
    const pendingPartyId = String(pending.draftPayload.supplierId ?? pending.draftPayload.customerId ?? '');
    if (pendingPartyId && parties.length === 0) return;
    const draft = consumeAiTransactionDraft('DRAFT_PAYMENT_VOUCHER');
    if (!draft) return;
    aiDraftAppliedRef.current = true;
    const payload = draft.draftPayload;
    const amount = Number(payload.amount) || 0;
    const partyId = String(payload.supplierId ?? payload.customerId ?? '');
    const party = parties.find((row) => row.id === partyId);
    setValue('description', typeof payload.description === 'string' ? payload.description : '', {
      shouldValidate: false,
    });
    setVoucherLines([
      {
        ...emptyLine(headerCurrencyCode),
        amount,
        accountId: party?.accountId ?? '',
        partyId: partyId || undefined,
        partyKind: partyId ? (isPayable ? 'SUPPLIER' : 'CUSTOMER') : undefined,
        description: typeof payload.description === 'string' ? payload.description : '',
      },
    ]);
    const params = new URLSearchParams(searchParams.toString());
    params.delete('fromAiDraft');
    const qs = params.toString();
    router.replace(qs ? `${pathname}${qs ? `?${qs}` : ''}` : pathname, { scroll: false });
  }, [fromAiDraft, headerCurrencyCode, isPayable, parties, pathname, router, savedVoucherId, searchParams, setValue]);

  const settlementPartyId = useMemo(() => {
    for (const line of voucherLines) {
      if (line.partyId) return line.partyId;
      if (!line.accountId) continue;
      const match = parties.find((s) => s.accountId === line.accountId);
      if (match) return match.id;
    }
    return '';
  }, [voucherLines, parties]);

  const settlementAccountId = useMemo(() => {
    for (const line of voucherLines) {
      if (line.accountId) return line.accountId;
    }
    return '';
  }, [voucherLines]);

  const settlementSupplierId = useMemo(() => {
    const fromKind = voucherLines.find((line) => line.partyKind === 'SUPPLIER')?.partyId;
    if (fromKind) return fromKind;
    return isPayable ? settlementPartyId : '';
  }, [isPayable, settlementPartyId, voucherLines]);

  const settlementCustomerId = useMemo(() => {
    const fromKind = voucherLines.find((line) => line.partyKind === 'CUSTOMER')?.partyId;
    if (fromKind) return fromKind;
    return !isPayable ? settlementPartyId : '';
  }, [isPayable, settlementPartyId, voucherLines]);

  const lockLoadedOrder = shouldLockLoadedSource(txSettings, sourceOrderId);
  const locked = isReadOnly || isCancelled || financialBusy || lockLoadedOrder;

  const resetForm = () => {
    resetKeepPosted();
    const fundAccountId = isBank ? txSettings?.defaultBankGlAccountId : txSettings?.defaultCashAccountId;
    const nextFundId = fundIdForGlAccount(funds, fundAccountId);
    const costCenter = txSettings?.defaultCostCenterId ?? '';
    const offsetAccountId = txSettings?.defaultOffsetAccountId ?? '';
    reset({
      date: new Date().toISOString().split('T')[0],
      description: '',
      fundId: nextFundId,
      currencyId: defaultCurrencyId(currencies, companyBaseCurrency),
      voucherNumber: '',
      hijriDate: showHijri ? toHijri(new Date().toISOString().split('T')[0]) : '',
      isCyclic: false,
      isApproved: false,
      departmentId: '',
      sourceOrderId: '',
      bankReference: '',
      valueDate: '',
    });
    setDefaultCostCenterId(costCenter);
    setVoucherLines([
      {
        ...emptyLine(headerCurrencyCode, mainEntrySide, costCenter, 1),
        accountId: offsetAccountId,
      },
    ]);
    setCreditLines([]);
    setSavedVoucherId(null);
    setIsPosted(false);
    setIsCancelled(false);
    setIsEditing(true);
    setMode('create');
    lastHydratedIdRef.current = null;
    skipUrlHydrateRef.current = true;
    defaultsAppliedRef.current = Boolean(txSettings);
    openVoucher(null);
    setJournalEntryId(null);
    setJournalNumber(null);
    setAllocations([]);
    setError('');
    setSuccess('');
    setOrderRefResetKey((n) => n + 1);
    resetFxToSetting();
    clearDraft();
  };

  const validateLines = (): string | null => {
    if (voucherLines.length === 0) return 'يرجى إضافة بنود السند';
    const allLines = [...voucherLines, ...creditLines];
    for (const [index, line] of allLines.entries()) {
      if (!line.accountId) return `يرجى اختيار الحساب في السطر ${index + 1}`;
      if (!(Number(line.amount) > 0)) return `قيمة السطر ${index + 1} يجب أن تكون أكبر من صفر`;
      const account = accounts.find((a) => a.id === line.accountId);
      if (!account) return `الحساب في السطر ${index + 1} غير موجود في الدليل`;
      if (account.isActive === false) return `الحساب ${account.code} غير نشط`;
      const ccRule = costCenterRule(account);
      if (ccRule === 'required' && !line.costCenterId) {
        return costCenterRuleMessage(ccRule, account.code) ?? `مركز التكلفة إجباري للحساب ${account.code}`;
      }
      if (ccRule === 'none' && line.costCenterId) {
        return costCenterRuleMessage(ccRule, account.code);
      }
    }
    if (isModernVoucher && totalAmount <= 0) {
      return isBankCredit
        ? 'صافي المضاف للبنك يجب أن يكون أكبر من صفر'
        : isCashReceipt
          ? 'صافي المقبوض بالخزنة يجب أن يكون أكبر من صفر'
          : isBankDebit
            ? 'صافي المخصوم من البنك يجب أن يكون أكبر من صفر'
            : 'صافي المنصرف من الخزنة يجب أن يكون أكبر من صفر';
    }
    if (allocations.length > 0) {
      const allocated = allocations.reduce((s, a) => s + a.allocatedAmount, 0);
      const target = totalAmount;
      if (Math.abs(allocated - target) > 0.009) {
        return 'إجمالي التوزيع على الفواتير يجب أن يساوي مبلغ السند تماماً';
      }
    }
    if (!autoNumbering && !voucherNumberW?.trim()) {
      return 'رقم السند مطلوب — الترقيم يدوي في إعدادات النظام';
    }
    return null;
  };

  const onSave = () => {
    if (financialBusy) return;
    if (savedVoucherId && isReadOnly) {
      setError('اضغط تعديل أولاً قبل الحفظ');
      return;
    }
    void handleSubmit((values) => {
      const message = validateLines();
      if (message) {
        setError(message);
        return;
      }
      setError('');
      const payload: Record<string, unknown> = {
        transactionKind: variant.transactionKind,
        documentRole: 'VOUCHER',
        amount: totalAmount,
        date: new Date(values.date).toISOString(),
        hijriDate: values.hijriDate || undefined,
        currencyCode: headerCurrencyCode,
        voucherNumber: values.voucherNumber?.trim() || undefined,
        description: values.description.trim(),
        safeId: isBank ? undefined : values.fundId,
        bankAccountId: isBank ? values.fundId : undefined,
        supplierId: settlementSupplierId || undefined,
        customerId: settlementCustomerId || undefined,
        offsetAccountId: voucherLines[0]?.accountId || undefined,
        exchangeRate: headerFxRate,
        isRecurring: values.isCyclic,
        departmentId: values.departmentId || undefined,
        sourceOrderId: values.sourceOrderId || undefined,
        bankReference: values.bankReference?.trim() || undefined,
        referenceNumber: values.bankReference?.trim() || undefined,
        valueDate: values.valueDate ? new Date(values.valueDate).toISOString() : undefined,
        lines: [
          ...voucherLines.map((line) => toCashPayloadLine({ ...line, entrySide: mainEntrySide }, headerCurrencyCode)),
          ...creditLines.map((line) => toCashPayloadLine({ ...line, entrySide: otherEntrySide }, headerCurrencyCode)),
        ],
        paymentOrderCode: undefined,
        paymentOrderNumber: undefined,
        receiptOrderCode: undefined,
        receiptOrderNumber: undefined,
        allocations: allocations.length ? allocations : undefined,
      };
      if (savedVoucherId) {
        updateMutation.mutate({
          ...payload,
          expectedVersion: documentVersion,
        });
        return;
      }
      saveMutation.mutate(payload);
    }, onFieldErrors(setError))();
  };

  const voucherPrintLines = voucherLines.map((line) => {
    const acc = accounts.find((a) => a.id === line.accountId);
    return {
      accountLabel: acc ? `[${acc.code}] ${acc.arabicName}` : line.accountId,
      description: line.description,
      amount: lineBaseAmount(line),
    };
  });

  const addVoucherLine = () => {
    setVoucherLines((prev) => [
      ...prev,
      {
        ...emptyLine(headerCurrencyCode, mainEntrySide, defaultCostCenterId, headerFxRate),
        description: descriptionW || '',
      },
    ]);
  };

  const accountLabelFor = (accountId: string) => {
    const account = accounts.find((a) => a.id === accountId);
    if (!account) return undefined;
    return `[${account.code}] ${account.arabicName}`;
  };

  const triggerPrint = () => {
    document.querySelector<HTMLButtonElement>('[data-print-document]')?.click();
  };

  const advancedFilledCount = [
    departmentId,
    sourceOrderId,
    isCyclicW,
    bankReferenceW,
    valueDateW,
  ].filter(Boolean).length;

  const voucherStatusLabel = isCancelled ? 'ملغي' : isPosted ? 'مرحل' : 'مسودة';

  return (
    <ErpDocumentLayout>
      {error && <ErrorToast message={error} onClose={() => setError('')} />}
      {success && <SuccessToast message={success} onClose={() => setSuccess('')} />}
      {restoreOffer && !savedVoucherId ? (
        <PageDraftRestoreBanner
          message="يوجد مسودة سند غير محفوظة."
          onRestore={() => {
            const payload = acceptRestore();
            if (!payload) return;
            applyVoucherDraft(payload);
            setSuccess('تم استعادة مسودة السند');
          }}
          onDismiss={dismissRestore}
        />
      ) : null}

      <ErpDocumentPageHeader
        breadcrumbs={variant.breadcrumbs}
        title={variant.title}
        docNumber={voucherNumberW || ''}
        statusTone={isCancelled ? 'danger' : isPosted ? 'success' : 'warning'}
        statusLabel={voucherStatusLabel}
        onSaveDraft={onSave}
        saveLabel={
          isEditing && savedVoucherId
            ? 'حفظ التعديلات'
            : isBankDebit
              ? 'حفظ إشعار الخصم'
              : isBankCredit
                ? 'حفظ إشعار الإضافة'
                : 'حفظ السند'
        }
        savePending={financialBusy}
        canSave={!isReadOnly && !isCancelled && !financialBusy}
        lockWhenPosted={isReadOnly}
        hideStandalonePost
        favoriteHref={pathname}
        favoriteLabel={variant.title}
        onBrowseList={() => setShowBrowseList(true)}
        browseListLabel="السابق"
        navEntity="cash-transaction"
        currentId={savedVoucherId}
        transactionKind={variant.transactionKind}
        fundType={variant.fundType}
        onNavigate={openVoucher}
        extraActions={
          <VoucherPrintActions
            kind={variant.printKind}
            company={companyProfile}
            voucherNumber={voucherNumberW || '—'}
            date={dateW ? new Date(dateW).toLocaleDateString('ar-EG') : '—'}
            description={descriptionW}
            safeName={selectedFund?.arabicName}
            currencyCode={companyBaseCurrency}
            lines={voucherPrintLines}
            totalAmount={totalAmount}
          />
        }
        standardActions={{
          hasDocument: Boolean(savedVoucherId),
          isPosted,
          isCancelled,
          printLabel: 'طباعة السند',
          voidLabel: 'إلغاء',
          onNew: resetForm,
          newLabel: 'جديد',
          onEdit: () => {
            setIsEditing(true);
            unlockForEdit();
          },
          onPost: () => postMutation.mutate({}),
          postPending: postMutation.isPending,
          onUnpost: () => unpostMutation.mutate({}),
          unpostPending: unpostMutation.isPending,
          onPrint: triggerPrint,
          onVoid: () => cancelMutation.mutate({ expectedVersion: documentVersion }),
          voidPending: cancelMutation.isPending,
        }}
      />

      <DocumentReadOnlyBanner />

      <DocumentFormLock>
      <ErpFormHeaderCard
        extrasLabel="خيارات إضافية"
        headerActions={
          <VoucherSourceDocumentControl
            key={orderRefResetKey}
            kind={variant.transactionKind}
            fundType={variant.fundType}
            value={sourceOrderId ?? ''}
            valueLabel={
              selectedOrderResponse?.data?.voucherNumber ||
              orders.find((o) => o.id === sourceOrderId)?.voucherNumber ||
              undefined
            }
            disabled={isReadOnly || isCancelled || financialBusy}
            onChange={(id) => {
              setValue('sourceOrderId', id, { shouldDirty: true, shouldValidate: false });
              if (id) {
                setSuccess(
                  isReceiptPolarity
                    ? 'تم تحميل أمر التوريد إلى بنود السند'
                    : 'تم تحميل أمر الصرف إلى بنود السند'
                );
              }
            }}
          />
        }
        row1={
          <>
            <div>
              <label className={erpLabelClass}>رقم السند</label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={16}
                className={`${erpInputClass} ${errors.voucherNumber ? erpInputErrorClass : ''}`}
                placeholder={autoNumbering ? 'تلقائي' : 'حتى 16 رقماً'}
                disabled={locked || autoNumbering}
                {...register('voucherNumber')}
              />
              <ErpFieldError message={errors.voucherNumber?.message} show={Boolean(errors.voucherNumber)} />
            </div>
            <div>
              <DatePickerWithHijri
                label="التاريخ"
                value={dateW}
                disabled={locked}
                error={!!errors.date}
                onChange={(next) => {
                  setValue('date', next, { shouldDirty: true, shouldValidate: true });
                  setValue('hijriDate', toHijriDate(next), { shouldValidate: false });
                }}
              />
              <ErpFieldError message={errors.date?.message} show={Boolean(errors.date)} />
            </div>
            <div>
              <label className={erpLabelClass}>الشرح</label>
              <input
                type="text"
                className={`${erpInputClass} ${errors.description ? erpInputErrorClass : ''}`}
                disabled={locked}
                {...register('description')}
              />
              <ErpFieldError message={errors.description?.message} show={Boolean(errors.description)} />
            </div>
          </>
        }
        row2={
          <>
            <DocumentCurrencyRateFields
              currencies={currencies}
              currencyId={currencyId}
              exchangeRate={headerFxRate}
              companyBaseCode={companyBaseCurrency}
              showRate={showFxColumns}
              disabled={locked}
              onCurrencyIdChange={(id, nextRate, code) => {
                setHeaderRateOverride(null);
                setValue('currencyId', id, { shouldDirty: true, shouldValidate: true });
                if (code) applyHeaderCurrencyToRows(code, nextRate);
              }}
              onExchangeRateChange={(rate) => {
                setHeaderRateOverride(rate);
                applyHeaderCurrencyToRows(headerCurrencyCode, rate);
              }}
            />
            {isCashVoucher ? (
              <div>
                <CashSafeHeaderSelector
                  safes={funds}
                  value={fundId}
                  onChange={(id) => setValue('fundId', id, { shouldDirty: true, shouldValidate: true })}
                  disabled={locked}
                  error={Boolean(errors.fundId)}
                  errorMessage={errors.fundId?.message}
                  baseCurrency={headerCurrencyCode}
                  displayBalance={balanceNum}
                  tourId={variant.tourSafe}
                />
              </div>
            ) : isBankVoucher ? (
              <div>
                <BankHeaderSelector
                  banks={funds}
                  value={fundId}
                  onChange={(id) => setValue('fundId', id, { shouldDirty: true, shouldValidate: true })}
                  disabled={locked}
                  error={Boolean(errors.fundId)}
                  errorMessage={errors.fundId?.message}
                  baseCurrency={headerCurrencyCode}
                  displayBalance={balanceNum}
                  tourId={variant.tourSafe}
                />
              </div>
            ) : (
              <div data-tour-id={variant.tourSafe}>
                <label className={erpLabelClass}>{variant.fundLabel}</label>
                <div className="flex gap-2">
                  <select
                    className={`${erpInputClass} ${errors.fundId ? erpInputErrorClass : ''}`}
                    disabled={locked}
                    {...register('fundId')}
                  >
                    <option value="">اختر {variant.fundLabel}</option>
                    {funds.map((fund) => (
                      <option key={fund.id} value={fund.id}>
                        {formatTreasuryBalanceLabel(
                          fund.arabicName || fund.englishName || fund.id,
                          fund.balance
                        )}
                      </option>
                    ))}
                  </select>
                </div>
                <ErpFieldError message={errors.fundId?.message} show={Boolean(errors.fundId)} />
              </div>
            )}
            {isModernVoucher ? (
              overdraftWarning ? (
                <p className="self-end text-xs font-semibold text-amber-700">
                  {isBankVoucher
                    ? 'مبلغ الإشعار يتجاوز رصيد البنك الحالي'
                    : 'مبلغ السند يتجاوز رصيد الخزنة الحالي'}
                </p>
              ) : (
                <div />
              )
            ) : (
              <div>
                <label className={erpLabelClass}>الرصيد</label>
                <input type="text" className={erpInputClass} value={balance} readOnly />
                {overdraftWarning ? (
                  <p className="mt-1 text-xs font-semibold text-amber-700">
                    مبلغ السند يتجاوز رصيد الخزينة الحالي ({balance})
                  </p>
                ) : null}
              </div>
            )}
          </>
        }
        extras={
          <div className={erpFormGridClass}>
            {variant.extraHeader !== 'none' ? (
              <>
                <CompactFormField
                  label={variant.bankReferenceLabel}
                  maxLength={80}
                  disabled={locked}
                  {...register('bankReference')}
                />
                <CompactFormField label="تاريخ القيمة" type="date" disabled={locked} {...register('valueDate')} />
              </>
            ) : null}
            <CompactFormField label="سند دوري">
              <label className="flex h-9 items-center gap-2 text-sm text-[#094C6B]">
                <Controller
                  name="isCyclic"
                  control={control}
                  render={({ field: { value, onChange } }) => (
                    <input
                      type="checkbox"
                      className="h-4 w-4 text-[#0E78AA]"
                      checked={value}
                      disabled={locked}
                      onChange={(e) => onChange(e.target.checked)}
                    />
                  )}
                />
                سند دوري
              </label>
            </CompactFormField>
            {isModernVoucher ? (
              <>
                <div>
                  <label className={erpLabelClass}>
                    {isBankVoucher ? 'مركز التكلفة الافتراضي للإشعار' : 'مركز التكلفة الافتراضي للسند'}
                  </label>
                  <CostCenterSelect
                    value={defaultCostCenterId}
                    onChange={(id) => {
                      setDefaultCostCenterId(id);
                      setVoucherLines((prev) => applyDefaultCostCenter(prev, id, accounts));
                      setCreditLines((prev) => applyDefaultCostCenter(prev, id, accounts));
                    }}
                    disabled={locked}
                    allowEmpty
                    emptyLabel="بدون"
                  />
                </div>
                <CompactFormField label="العملات الأجنبية">
                  <ShowFxColumnsField compact checked={showFxColumns} onChange={setShowFxColumns} />
                </CompactFormField>
                <button
                  type="button"
                  className={advancedActionClass}
                  disabled={locked}
                  onClick={() => setShowPaymentsModal(true)}
                >
                  توزيع السدادات على الفواتير
                  {allocations.length > 0 ? (
                    <span className="inline-flex min-w-[1.15rem] items-center justify-center rounded-full bg-[#0E78AA]/15 px-1 text-[10px] text-[#094C6B]">
                      {allocations.length}
                    </span>
                  ) : null}
                </button>
                <button type="button" className={advancedActionClass} disabled={locked} onClick={() => setShowRecurringModal(true)}>
                  سند دوري
                </button>
                {postingMode === 'MULTI' ? (
                  <button type="button" className={advancedActionClass} disabled={locked} onClick={() => setShowApprovalsModal(true)}>
                    حالة الاعتماد
                  </button>
                ) : null}
              </>
            ) : null}
          </div>
        }
      />

      {!isModernVoucher ? (
      <AdvancedFieldsSection title="إعدادات متقدمة" badgeCount={advancedFilledCount}>
        <ShowFxColumnsField checked={showFxColumns} onChange={setShowFxColumns} />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={advancedActionClass}
            disabled={locked}
            onClick={() => setShowPaymentsModal(true)}
          >
            توزيع السدادات على الفواتير
            {allocations.length > 0 ? (
              <span className="inline-flex min-w-[1.15rem] items-center justify-center rounded-full bg-[#0E78AA]/15 px-1 text-[10px] text-[#094C6B]">
                {allocations.length}
              </span>
            ) : null}
          </button>
          <button type="button" className={advancedActionClass} disabled={locked} onClick={() => setShowRecurringModal(true)}>
            سند دوري
          </button>
          {postingMode === 'MULTI' && (
            <button type="button" className={advancedActionClass} disabled={locked} onClick={() => setShowApprovalsModal(true)}>
              حالة الاعتماد
            </button>
          )}
        </div>
      </AdvancedFieldsSection>
      ) : null}

      <div data-tour-id={variant.tourLines}>
        <FormSectionCard title="بنود السند" bodyClassName="grid-cols-1 sm:grid-cols-1 lg:grid-cols-1">
          <div key={orderRefResetKey}>
          {isCashPayment || isBankDebit ? (
            <>
              {isBankDebit ? (
                <BankDebitLinesTable
                  gridId="bank-debit-lines"
                  lines={voucherLines}
                  onChange={setVoucherLines}
                  onAddLine={addVoucherLine}
                  disabled={locked}
                  accountLabelFor={accountLabelFor}
                  currencies={currencies}
                  baseCurrency={headerCurrencyCode}
                  showFx={showFxColumns}
                  headerDescription={descriptionW}
                />
              ) : (
                <PaymentLinesTable
                  gridId="payment-voucher-lines"
                  lines={voucherLines}
                  onChange={setVoucherLines}
                  onAddLine={addVoucherLine}
                  disabled={locked}
                  accountLabelFor={accountLabelFor}
                  currencies={currencies}
                  baseCurrency={headerCurrencyCode}
                  showFx={showFxColumns}
                  headerDescription={descriptionW}
                />
              )}
              <div className="mt-3">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={locked}
                  className="gap-2 border-primary/40 text-primary hover:bg-primary/10"
                  onClick={() => setShowCreditModal(true)}
                >
                  <PlusCircle className="h-4 w-4 text-primary" />
                  <span>أطراف دائنة أخرى ({creditLines.length})</span>
                </Button>
              </div>
            </>
          ) : isReceiptPolarity ? (
            <>
              {isBankCredit ? (
                <BankCreditLinesTable
                  gridId="bank-credit-lines"
                  lines={voucherLines}
                  onChange={setVoucherLines}
                  onAddLine={addVoucherLine}
                  disabled={locked}
                  accountLabelFor={accountLabelFor}
                  currencies={currencies}
                  baseCurrency={headerCurrencyCode}
                  showFx={showFxColumns}
                  headerDescription={descriptionW}
                />
              ) : (
                <ReceiptLinesTable
                  gridId="receipt-voucher-lines"
                  lines={voucherLines}
                  onChange={setVoucherLines}
                  onAddLine={addVoucherLine}
                  disabled={locked}
                  accountLabelFor={accountLabelFor}
                  currencies={currencies}
                  baseCurrency={headerCurrencyCode}
                  showFx={showFxColumns}
                  headerDescription={descriptionW}
                />
              )}
              <div className="mt-3">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={locked}
                  className="gap-2 border-primary/40 text-primary hover:bg-primary/10"
                  onClick={() => setShowCreditModal(true)}
                >
                  <PlusCircle className="h-4 w-4 text-primary" />
                  <span>أطراف مدينة أخرى ({creditLines.length})</span>
                </Button>
              </div>
            </>
          ) : (
            <VoucherLinesGrid
              headerCurrencyCode={headerCurrencyCode}
              lines={voucherLines}
              onChange={setVoucherLines}
              onAddLine={addVoucherLine}
              disabled={locked}
              accountLabelFor={accountLabelFor}
              currencies={currencies}
              showFx={showFxColumns}
              headerDescription={descriptionW}
            />
          )}
          </div>
        </FormSectionCard>
      </div>
      </DocumentFormLock>

      <VoucherStickyFooter
        totalAmount={totalAmount}
        debitTotal={isModernVoucher ? debitTotal : undefined}
        creditTotal={isModernVoucher ? creditTotal : undefined}
        breakdownKind={
          isBankCredit ? 'bank-credit' : isCashReceipt ? 'receipt' : isBankDebit ? 'bank-debit' : 'payment'
        }
        currencyCode={companyBaseCurrency}
        journalEntryId={journalEntryId}
        journalEntryNumber={journalNumber}
        onSave={onSave}
        onCancel={resetForm}
        savePending={financialBusy}
        canSave={!isReadOnly && !isCancelled && !financialBusy}
        saveLabel={
          isEditing && savedVoucherId
            ? 'حفظ التعديلات'
            : isBankDebit
              ? 'حفظ إشعار الخصم'
              : isBankCredit
                ? 'حفظ إشعار الإضافة'
                : 'حفظ السند'
        }
      />

      {isBankCredit ? (
        <BankCreditOtherDebitPartiesModal
          open={showCreditModal}
          lines={creditLines}
          currencies={currencies}
          baseCurrency={headerCurrencyCode}
          showFx={showFxColumns}
          disabled={locked}
          accountLabelFor={accountLabelFor}
          onClose={() => setShowCreditModal(false)}
          onApply={(next) => {
            setCreditLines(next);
            setShowCreditModal(false);
          }}
        />
      ) : isCashReceipt ? (
        <OtherDebitPartiesModal
          open={showCreditModal}
          lines={creditLines}
          currencies={currencies}
          baseCurrency={headerCurrencyCode}
          showFx={showFxColumns}
          disabled={locked}
          accountLabelFor={accountLabelFor}
          onClose={() => setShowCreditModal(false)}
          onApply={(next) => {
            setCreditLines(next);
            setShowCreditModal(false);
          }}
        />
      ) : isBankDebit ? (
        <BankDebitOtherCreditPartiesModal
          open={showCreditModal}
          lines={creditLines}
          currencies={currencies}
          baseCurrency={headerCurrencyCode}
          showFx={showFxColumns}
          disabled={locked}
          accountLabelFor={accountLabelFor}
          onClose={() => setShowCreditModal(false)}
          onApply={(next) => {
            setCreditLines(next);
            setShowCreditModal(false);
          }}
        />
      ) : (
        <OtherCreditPartiesModal
          open={showCreditModal}
          lines={creditLines}
          currencies={currencies}
          baseCurrency={headerCurrencyCode}
          showFx={showFxColumns}
          disabled={locked}
          accountLabelFor={accountLabelFor}
          onClose={() => setShowCreditModal(false)}
          onApply={(next) => {
            setCreditLines(next);
            setShowCreditModal(false);
          }}
        />
      )}

      <PaymentsDistributionModal
        isOpen={showPaymentsModal}
        onClose={() => setShowPaymentsModal(false)}
        side={variant.allocationSide}
        partyId={settlementPartyId}
        accountId={settlementAccountId}
        cashTransactionId={savedVoucherId}
        isPosted={isPosted}
        receiptTotal={isModernVoucher ? mainTotal : totalAmount}
        draftMode={!isPosted}
        onApplyDraft={setAllocations}
        onPartyChange={(partyId) => {
          const party = parties.find((row) => row.id === partyId);
          const partyKind = isPayable ? 'SUPPLIER' : 'CUSTOMER';
          setVoucherLines((rows) =>
            rows.map((line, index) =>
              index === 0
                ? {
                    ...line,
                    partyId: partyId || undefined,
                    partyKind: partyId ? partyKind : undefined,
                    accountId: party?.accountId || line.accountId,
                  }
                : line
            )
          );
        }}
        onError={setError}
        onSuccess={setSuccess}
      />

      {showRecurringModal && (
        <Overlay title="السندات الدورية" onClose={() => setShowRecurringModal(false)}>
          {recurringItems.length === 0 ? (
            <p className="text-center text-gray-600">لا توجد سندات دورية محفوظة</p>
          ) : (
            <ul className="space-y-2">
              {recurringItems.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    className="w-full text-right border rounded-lg p-3 hover:border-[#0E78AA]"
                    onClick={() => {
                      applyCashRow(row, true);
                      setShowRecurringModal(false);
                      setSuccess('تم تحميل بيانات السند الدوري');
                    }}
                  >
                    <div className="font-bold">{row.voucherNumber || row.id.slice(0, 8)}</div>
                    <div className="text-sm text-gray-600">
                      {new Date(row.date).toLocaleDateString('ar-EG')} — {Number(row.amount).toFixed(2)}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Overlay>
      )}

      <DocumentBrowseDrawer
        open={showBrowseList}
        onClose={() => setShowBrowseList(false)}
        title="السندات السابقة"
      >
        <GenericRecordsList
          apiPath="/treasury/cash-transactions"
          listKey={`voucher-browse-${variant.id}`}
          extraParams={{
            ...listQuery,
          }}
          selectedId={savedVoucherId}
          resolveStatus={(r) => {
            if (r.isCancelled === true) return { variant: 'danger' as const, label: 'ملغي' };
            if (r.isPosted) return { variant: 'success' as const, label: 'مرحل' };
            return { variant: 'warning' as const, label: 'مسودة' };
          }}
          columns={[
            {
              id: 'num',
              header: 'الرقم',
              getValue: (r) => String(r.voucherNumber ?? r.id.slice(0, 8)),
            },
            {
              id: 'date',
              header: 'التاريخ',
              getValue: (r) => (r.date ? new Date(String(r.date)).toLocaleDateString('ar-EG') : '—'),
            },
            {
              id: 'amount',
              header: 'المبلغ',
              getValue: (r) =>
                Number(r.amount ?? 0).toLocaleString('ar-EG', { minimumFractionDigits: 2 }),
            },
          ]}
          onSelect={(_id, row) => {
            lastHydratedIdRef.current = null;
            applyCashRow(row as unknown as CashTxRow);
            lastHydratedIdRef.current = (row as { id?: string }).id ?? null;
            openVoucher(String((row as { id?: string }).id ?? ''));
            setShowBrowseList(false);
          }}
        />
      </DocumentBrowseDrawer>

      {showApprovalsModal && (
        <Overlay title="حالة الاعتمادات" onClose={() => setShowApprovalsModal(false)}>
          {!savedVoucherId ? (
            <p className="text-center text-gray-600">احفظ السند أولاً لعرض الاعتمادات</p>
          ) : (
            <>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#0E78AA] text-white">
                    <th className="p-2">المستخدم</th>
                    <th className="p-2">الحالة</th>
                    <th className="p-2">تاريخ الاعتماد</th>
                  </tr>
                </thead>
                <tbody>
                  {(approvalsResponse?.data?.approvers ?? []).map((row) => (
                    <tr key={row.userId} className="border-b">
                      <td className="p-2">{row.name}</td>
                      <td className="p-2">{row.status === 'APPROVED' ? 'معتمد' : 'غير معتمد'}</td>
                      <td className="p-2">
                        {row.approvedAt ? new Date(row.approvedAt).toLocaleString('ar-EG') : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button
                type="button"
                className="mt-4 px-4 py-2 bg-[#0E78AA] text-white rounded-lg"
                onClick={() => approveMutation.mutate({})}
              >
                اعتماد
              </button>
            </>
          )}
        </Overlay>
      )}

    </ErpDocumentLayout>
  );
}

function Overlay({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[140]" style={{ direction: 'rtl' }}>
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl max-h-[90vh] overflow-y-auto">
          <div className="p-4 border-b flex items-center justify-between">
            <h2 className="font-bold text-lg">{title}</h2>
            <button type="button" onClick={onClose} className="text-gray-500">
              إغلاق
            </button>
          </div>
          <div className="p-4">{children}</div>
        </div>
      </div>
    </div>
  );
}
