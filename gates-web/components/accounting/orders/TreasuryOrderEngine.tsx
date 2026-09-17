'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useOwnTabPathname, useOwnTabSearchParams } from '@/lib/navigation/tab-route-lock';
import dynamic from 'next/dynamic';
import { Check } from 'lucide-react';
import { useForm, useWatch, type Resolver } from 'react-hook-form';
import { useDraftAutosave } from '@/lib/hooks/useDraftAutosave';
import { PageDraftRestoreBanner } from '@/components/erp/PageDraftRestoreBanner';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, FormSectionCard } from '@/components/ui';
import { VoucherLinesGrid, type VoucherGridLine } from '@/components/accounting/vouchers/VoucherLinesGrid';
import { OrderStatusBadge, type OrderExecutionStatus } from '@/components/accounting/orders/OrderStatusBadge';
import { OrderStickyFooter } from '@/components/accounting/orders/OrderStickyFooter';
import { PaymentOrderHeader } from '@/components/accounting/orders/PaymentOrderHeader';
import { PaymentOrderLinesTable } from '@/components/accounting/orders/PaymentOrderLinesTable';
import { PaymentOrderStickyFooter } from '@/components/accounting/orders/PaymentOrderStickyFooter';
import { ReceiptOrderHeader } from '@/components/accounting/orders/ReceiptOrderHeader';
import { ReceiptOrderLinesTable } from '@/components/accounting/orders/ReceiptOrderLinesTable';
import { ReceiptOrderStickyFooter } from '@/components/accounting/orders/ReceiptOrderStickyFooter';
import {
  emptyPaymentLine,
  lineBaseAmount,
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
import { DatePickerWithHijri } from '@/components/ui/DatePickerWithHijri';
import { toHijriDate } from '@/lib/hijri-date';
import {
  treasuryOrderHeaderFormSchema,
  type TreasuryOrderHeaderFormInput,
} from '@/lib/validation/accounting.schema';
import { parseDecimal, roundMoney2 } from '@/lib/money/parseDecimal';
import type { ApiError } from '@/lib/api/types';
import { toastVersionConflict } from '@/lib/feedback/toast';
import { isOptimisticLockApiError } from '@/lib/concurrency/version-conflict';
import { getTenantContext } from '@/lib/tenant/tenant-context-storage';
import { useApiMutation, useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';
import {
  invalidateTreasuryFundBalances,
  pickDefaultSafeId,
  useLiveFundBalance,
  useSafesQuery,
} from '@/lib/hooks/useMasterDataQueries';
import { useCompanyPrintProfile } from '@/lib/hooks/useCompanyPrintProfile';
import { useAccountingSettingsQuery } from '@/lib/hooks/useAccountingSettings';
import { pickCurrencyByCode, rateForCurrency, treasuryBalanceInCurrency, withHeaderCurrency } from '@/lib/accounting/fx-base';
import { costCenterRuleFromAccount } from '@/lib/accounting/cost-center-rule';
import { useCompanyBaseCurrency } from '@/lib/hooks/useCompanyBaseCurrency';
import { DocumentCurrencyRateFields } from '@/components/accounting/DocumentCurrencyRateFields';
import {
  formatTreasuryBalanceLabel,
  isCashAmountOverBalance,
} from '@/lib/accounting-settings/guardrail-hints';
import { onFieldErrors } from '@/lib/forms/on-field-errors';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';
import {
  TREASURY_ORDER_VARIANTS,
  type TreasuryOrderVariantId,
} from '@/lib/treasury/treasury-order.variant';
import PaymentsDistributionModal from '@/components/LazyPaymentsDistributionModal';
import { ShowFxColumnsField } from '@/components/accounting/ShowFxColumnsField';
import { useShowFxColumns } from '@/lib/transaction-settings/useShowFxColumns';

const VoucherPrintActions = dynamic(
  () =>
    import('@/app/components/print/VoucherPrintActions').then((m) => ({
      default: m.VoucherPrintActions,
    })),
  { ssr: false }
);

type Account = {
  id: string;
  code: string;
  arabicName: string;
  costCenterRequired?: string | null;
  requiresCostCenter?: boolean | null;
};

type Currency = {
  id: string;
  code: string;
  arabicName: string;
  englishName?: string;
  exchangeRate?: number | string | null;
};

type FundOption = {
  id: string;
  arabicName: string;
  englishName?: string;
  code?: string | null;
  balance?: number | string;
  glAccountCode?: string | null;
  glAccount?: { id: string; code: string; arabicName: string } | null;
};

type Party = {
  id: string;
  arabicName?: string;
  accountId?: string | null;
};

type CashTxRow = {
  id: string;
  voucherNumber?: string | null;
  date: string;
  createdAt?: string;
  description?: string | null;
  amount: number | string;
  currencyCode: string;
  safeId?: string | null;
  bankAccountId?: string | null;
  customerId?: string | null;
  supplierId?: string | null;
  offsetAccountId?: string | null;
  hijriDate?: string | null;
  isCancelled?: boolean;
  executionStatus?: OrderExecutionStatus;
  executedAt?: string | null;
  executedBy?: string | null;
  createdBy?: string | null;
  createdByName?: string | null;
  executedByName?: string | null;
  version?: number | null;
  lines?: Array<{
    accountId: string;
    description?: string | null;
    amount: number | string;
    currencyCode: string;
    exchangeRate?: number | string;
    costCenterId?: string | null;
    isTiedToInvoice?: boolean;
    invoiceId?: string | null;
  }>;
};

type CompanySettingsRow = {
  autoNumbering?: boolean | null;
  dateUsage?: 'gregorian' | 'hijri' | 'both' | null;
};

function defaultCurrencyId(currencies: Currency[], companyBase = 'EGP'): string {
  if (!currencies.length) return '';
  return pickCurrencyByCode(currencies, companyBase)?.id || currencies[0].id;
}

function emptyLine(currencyCode: string, exchangeRate = 1): VoucherGridLine {
  return {
    accountId: '',
    description: '',
    amount: 0,
    currencyCode,
    exchangeRate,
    costCenterId: '',
  };
}

function costCenterRule(account?: Account): 'required' | 'optional' | 'none' {
  return costCenterRuleFromAccount(account);
}

export function TreasuryOrderEngine({ variantId }: { variantId: TreasuryOrderVariantId }) {
  return (
    <DocumentModeProvider>
      <TreasuryOrderEngineInner variantId={variantId} />
    </DocumentModeProvider>
  );
}

function TreasuryOrderEngineInner({ variantId }: { variantId: TreasuryOrderVariantId }) {
  const variant = TREASURY_ORDER_VARIANTS[variantId];
  const { lockToView, setMode, unlockForEdit, isReadOnly } = useDocumentMode();
  const router = useRouter();
  const pathname = useOwnTabPathname();
  const searchParams = useOwnTabSearchParams();
  const idFromUrl = searchParams.get('id');
  const invalidateQuery = useInvalidateQuery();
  const lastHydratedIdRef = useRef<string | null>(null);
  const todayStr = new Date().toISOString().split('T')[0];
  const companyId = getTenantContext().companyId;
  const isPayable = variant.transactionKind === 'PAYMENT';
  const isPaymentOrder = variantId === 'PAYMENT_ORDER';
  const isReceiptOrder = variantId === 'RECEIPT_ORDER';
  const isCashOrder = isPaymentOrder || isReceiptOrder;
  const orderEntrySide = isReceiptOrder ? 'CREDIT' : 'DEBIT';

  const [executionStatus, setExecutionStatus] = useState<OrderExecutionStatus>('PENDING');
  const [isCancelled, setIsCancelled] = useState(false);
  const [voucherLines, setVoucherLines] = useState<VoucherGridLine[]>([emptyLine('EGP')]);
  const [showBrowseList, setShowBrowseList] = useState(false);
  const [showPaymentsModal, setShowPaymentsModal] = useState(false);
  const [allocations, setAllocations] = useState<{ invoiceId: string; allocatedAmount: number }[]>(
    []
  );
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [savedOrderId, setSavedOrderId] = useState<string | null>(() => idFromUrl?.trim() || null);
  const [documentVersion, setDocumentVersion] = useState(0);
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [createdByName, setCreatedByName] = useState<string | null>(null);
  const [executedAt, setExecutedAt] = useState<string | null>(null);
  const [executedByName, setExecutedByName] = useState<string | null>(null);

  const openOrder = useCallback(
    (id: string | null) => {
      setSavedOrderId(id);
      if (id) {
        router.replace(`${pathname}?id=${id}`, { scroll: false });
      } else {
        router.replace(pathname, { scroll: false });
      }
    },
    [pathname, router]
  );

  const skipUrlHydrateRef = useRef(false);
  const skipHeaderFxSyncRef = useRef(false);
  const [headerRateOverride, setHeaderRateOverride] = useState<number | null>(null);
  const { showFx: showFxColumns, setShowFx: setShowFxColumns, resetFxToSetting } = useShowFxColumns(
    isReceiptOrder ? 'RECEIPT_VOUCHER' : 'PAYMENT_VOUCHER'
  );

  useEffect(() => {
    const id = idFromUrl?.trim();
    if (skipUrlHydrateRef.current) {
      if (!id) skipUrlHydrateRef.current = false;
      return;
    }
    if (id && id !== savedOrderId) {
      setSavedOrderId(id);
    }
  }, [idFromUrl, savedOrderId]);

  useEffect(() => {
    if (!savedOrderId) {
      setMode('create');
      return;
    }
    if (isCancelled || executionStatus === 'COMPLETED' || executionStatus === 'CANCELLED') {
      lockToView();
      return;
    }
    setMode('edit');
  }, [executionStatus, isCancelled, lockToView, savedOrderId, setMode]);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    control,
    formState: { errors },
  } = useForm<TreasuryOrderHeaderFormInput>({
    resolver: zodResolver(treasuryOrderHeaderFormSchema) as Resolver<TreasuryOrderHeaderFormInput>,
    defaultValues: {
      date: todayStr,
      description: '',
      fundId: '',
      currencyId: '',
      voucherNumber: '',
      hijriDate: '',
      fundKind: 'CASHBOX',
    },
    mode: 'onTouched',
  });

  const currencyId = watch('currencyId');
  const fundId = watch('fundId');
  const dateW = watch('date');
  const voucherNumberW = watch('voucherNumber');
  const descriptionW = watch('description');
  const fundKind = watch('fundKind');
  const isBank = fundKind === 'BANK_ACCOUNT';
  const headerSnapshot = useWatch({ control }) as TreasuryOrderHeaderFormInput;
  const orderDraftSnapshot = useMemo(
    () => ({ header: headerSnapshot, voucherLines, allocations }),
    [allocations, headerSnapshot, voucherLines]
  );
  const defaultFundAppliedRef = useRef(false);
  const applyOrderDraft = useCallback(
    (payload: typeof orderDraftSnapshot) => {
      defaultFundAppliedRef.current = true;
      if (payload.header) reset(payload.header);
      setVoucherLines(payload.voucherLines?.length ? payload.voucherLines : [emptyLine('EGP')]);
      setAllocations(Array.isArray(payload.allocations) ? payload.allocations : []);
    },
    [reset]
  );
  const {
    restoreOffer,
    acceptRestore,
    dismissRestore,
    clearDraft,
  } = useDraftAutosave({
    documentType: 'treasury-order',
    variantId,
    value: orderDraftSnapshot,
    enabled: !savedOrderId,
    applyRestore: applyOrderDraft,
    isEmpty: (draft) =>
      !draft.header?.description?.trim() &&
      !(draft.voucherLines ?? []).some((line) => line.accountId || Number(line.amount)) &&
      !(draft.allocations ?? []).length,
    restoreMessage: 'تم استعادة مسودة الأمر',
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

  const { data: safesResponse } = useSafesQuery({ enabled: isCashOrder || !isBank });
  const { data: banksResponse } = useApiQuery<FundOption[]>(
    ['bank-accounts'],
    '/accounting/bank-accounts',
    { isActive: true },
    { enabled: !isCashOrder && isBank, staleTime: 0, refetchOnMount: 'always' }
  );
  const funds = isCashOrder || !isBank ? safesResponse?.data || [] : banksResponse?.data || [];

  useEffect(() => {
    if (savedOrderId || isBank || defaultFundAppliedRef.current) return;
    if (restoreOffer) return;
    if (!funds.length) return;
    defaultFundAppliedRef.current = true;
    if (fundId) return;
    const next = pickDefaultSafeId(safesResponse?.data);
    if (next) setValue('fundId', next, { shouldValidate: false });
  }, [fundId, funds.length, isBank, restoreOffer, safesResponse?.data, savedOrderId, setValue]);
  const { data: liveFundResponse } = useLiveFundBalance({
    kind: isBank ? 'bank' : 'safe',
    id: fundId,
  });

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
  const autoNumbering = settings?.autoNumbering !== false;

  const { data: selectedOrderResponse } = useApiQuery<CashTxRow>(
    ['cash-order-detail', savedOrderId ?? 'none'],
    savedOrderId ? `/treasury/cash-transactions/${savedOrderId}` : '/treasury/cash-transactions',
    undefined,
    { enabled: Boolean(savedOrderId) }
  );

  const saveMutation = useApiMutation<CashTxRow, Record<string, unknown>>(
    '/treasury/cash-transactions',
    'POST',
    {
      onSuccess: () => {
        const message = `تم حفظ ${variant.title} بنجاح`;
        invalidateQuery(['treasury-cash-transactions']);
        invalidateQuery(['cash-order-detail']);
        invalidateTreasuryFundBalances(invalidateQuery);
        resetForm();
        setSuccess(message);
      },
      onError: (err: ApiError) => {
        if (isOptimisticLockApiError(err)) {
          toastVersionConflict(err.message, () => {
            lastHydratedIdRef.current = null;
            invalidateQuery(['cash-order-detail', savedOrderId ?? 'none']);
          });
          return;
        }
        setError(err.message || 'حدث خطأ أثناء الحفظ');
      },
    }
  );

  const updateMutation = useApiMutation<CashTxRow, Record<string, unknown>>(
    savedOrderId ? `/treasury/cash-transactions/${savedOrderId}` : '/treasury/cash-transactions',
    'PATCH',
    {
      onSuccess: () => {
        const message = `تم حفظ تعديلات ${variant.title}`;
        invalidateQuery(['treasury-cash-transactions']);
        invalidateQuery(['cash-order-detail']);
        invalidateTreasuryFundBalances(invalidateQuery);
        resetForm();
        setSuccess(message);
      },
      onError: (err: ApiError) => {
        if (isOptimisticLockApiError(err)) {
          toastVersionConflict(err.message, () => {
            lastHydratedIdRef.current = null;
            invalidateQuery(['cash-order-detail', savedOrderId ?? 'none']);
          });
          return;
        }
        setError(err.message || 'حدث خطأ أثناء الحفظ');
      },
    }
  );

  const cancelMutation = useApiMutation<unknown, { expectedVersion?: number }>(
    savedOrderId ? `/treasury/cash-transactions/${savedOrderId}/cancel` : '/treasury/cash-transactions',
    'POST',
    {
      onSuccess: () => {
        setIsCancelled(true);
        setExecutionStatus('CANCELLED');
        setSuccess('تم إلغاء الأمر');
        lastHydratedIdRef.current = null;
        invalidateQuery(['treasury-cash-transactions']);
        invalidateQuery(['cash-order-detail']);
        invalidateTreasuryFundBalances(invalidateQuery);
        lockToView();
      },
      onError: (err: ApiError) => setError(err.message || 'تعذر إلغاء الأمر'),
    }
  );

  const executeMutation = useApiMutation<CashTxRow, Record<string, never>>(
    savedOrderId ? variant.togglePath(savedOrderId) : '/orders/payment-orders/none/toggle-execution',
    'PATCH',
    {
      onSuccess: (res: { data?: CashTxRow; message?: string }) => {
        const row = res?.data;
        if (row) applyCashRow(row);
        setSuccess(res.message || variant.confirmLabel);
        invalidateQuery(['treasury-cash-transactions']);
        invalidateQuery(['cash-order-detail']);
        invalidateTreasuryFundBalances(invalidateQuery);
        lockToView();
      },
      onError: (err: ApiError) => setError(err.message || 'تعذر تحديث حالة التنفيذ'),
    }
  );

  const busy = saveMutation.isPending || updateMutation.isPending;

  const applyCashRow = useCallback(
    (row: CashTxRow, asTemplate = false) => {
      skipHeaderFxSyncRef.current = true;
      setSavedOrderId(asTemplate ? null : row.id);
      setDocumentVersion(asTemplate ? 0 : typeof row.version === 'number' ? row.version : 0);
      setIsCancelled(asTemplate ? false : Boolean(row.isCancelled));
      setExecutionStatus(
        asTemplate
          ? 'PENDING'
          : row.isCancelled
            ? 'CANCELLED'
            : row.executionStatus ?? 'PENDING'
      );
      setCreatedAt(asTemplate ? null : row.createdAt ?? null);
      setCreatedByName(asTemplate ? null : row.createdByName ?? null);
      setExecutedAt(asTemplate ? null : row.executedAt ?? null);
      setExecutedByName(asTemplate ? null : row.executedByName ?? null);
      if (asTemplate) setMode('create');
      else if (row.isCancelled || row.executionStatus === 'COMPLETED' || row.executionStatus === 'CANCELLED') {
        lockToView();
      } else {
        setMode('edit');
      }
      setValue('voucherNumber', asTemplate ? '' : row.voucherNumber ?? '', { shouldValidate: false });
      setValue('date', row.date?.slice(0, 10) || todayStr, { shouldValidate: false });
      setValue('hijriDate', row.hijriDate || toHijriDate(row.date?.slice(0, 10) || todayStr), {
        shouldValidate: false,
      });
      setValue('description', row.description ?? '', { shouldValidate: false });
      setValue('fundKind', isCashOrder || !row.bankAccountId ? 'CASHBOX' : 'BANK_ACCOUNT', {
        shouldValidate: false,
      });
      setValue('fundId', (isCashOrder ? row.safeId : row.bankAccountId || row.safeId) ?? '', {
        shouldValidate: false,
      });
      const cur = currencies.find((c) => c.code === row.currencyCode);
      if (cur) setValue('currencyId', cur.id, { shouldValidate: false });
      const savedRate = Number(row.exchangeRate ?? row.lines?.[0]?.exchangeRate);
      setHeaderRateOverride(savedRate > 0 ? savedRate : null);
      const headerPartyId = row.supplierId || row.customerId || '';
      const headerPartyKind: VoucherGridLine['partyKind'] = row.supplierId
        ? 'SUPPLIER'
        : row.customerId
          ? 'CUSTOMER'
          : undefined;
      if (row.lines?.length) {
        setVoucherLines(
          row.lines.map((line, index) => ({
            accountId: line.accountId,
            description: line.description ?? '',
            amount: Number(line.amount),
            currencyCode: line.currencyCode,
            exchangeRate: Number(line.exchangeRate ?? 1),
            costCenterId: line.costCenterId ?? '',
            isTiedToInvoice: Boolean(line.isTiedToInvoice && line.invoiceId),
            invoiceId: line.invoiceId ?? null,
            partyId: index === 0 && headerPartyId ? headerPartyId : undefined,
            partyKind: index === 0 ? headerPartyKind : undefined,
          }))
        );
      } else {
        setVoucherLines([
          {
            accountId: row.offsetAccountId ?? '',
            description: row.description ?? '',
            amount: Number(row.amount) || 0,
            currencyCode: row.currencyCode,
            exchangeRate: rateForCurrency(row.currencyCode, companyBaseCurrency, cur?.exchangeRate),
            costCenterId: '',
            isTiedToInvoice: false,
            invoiceId: null,
            partyId: headerPartyId || undefined,
            partyKind: headerPartyKind,
          },
        ]);
      }
    },
    [companyBaseCurrency, currencies, isCashOrder, lockToView, setMode, setValue, todayStr]
  );

  useEffect(() => {
    const row = selectedOrderResponse?.data;
    if (!row?.id || row.id !== savedOrderId) return;
    if (lastHydratedIdRef.current === row.id) return;
    lastHydratedIdRef.current = row.id;
    applyCashRow(row);
  }, [applyCashRow, savedOrderId, selectedOrderResponse]);

  useEffect(() => {
    if (currencies.length > 0 && !currencyId) {
      setValue('currencyId', defaultCurrencyId(currencies, companyBaseCurrency), { shouldValidate: false });
    }
  }, [companyBaseCurrency, currencies, currencyId, setValue]);

  const applyHeaderCurrencyToRows = useCallback(
    (code: string, catalogRate?: number | string | null) => {
      if (!code) return;
      setVoucherLines((prev) =>
        prev.map((line) => withHeaderCurrency(line, code, catalogRate, companyBaseCurrency))
      );
    },
    [companyBaseCurrency]
  );

  useEffect(() => {
    const header = currencies.find((c) => c.id === currencyId);
    if (!header?.code) return;
    if (skipHeaderFxSyncRef.current) {
      skipHeaderFxSyncRef.current = false;
      return;
    }
    setHeaderRateOverride(null);
    applyHeaderCurrencyToRows(header.code, header.exchangeRate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currencyId]);

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
    ? balanceNum.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '0';
  const totalAmount = voucherLines.reduce((sum, line) => sum + lineBaseAmount(line), 0);
  const documentNet = voucherLines.reduce((sum, line) => sum + (Number(line.amount) || 0), 0);
  const overdraftWarning =
    variant.transactionKind === 'PAYMENT' &&
    preventCashOverdraft &&
    isCashAmountOverBalance(documentNet, balanceNum);
  const { profile: companyProfile } = useCompanyPrintProfile();
  const completed = executionStatus === 'COMPLETED';
  const locked = isReadOnly || completed || isCancelled || busy;

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

  const settlementSupplierId =
    voucherLines.find((line) => line.partyKind === 'SUPPLIER')?.partyId ||
    (isPayable ? settlementPartyId : '');
  const settlementCustomerId =
    voucherLines.find((line) => line.partyKind === 'CUSTOMER')?.partyId ||
    (!isPayable ? settlementPartyId : '');

  const resetForm = () => {
    reset({
      date: new Date().toISOString().split('T')[0],
      description: '',
      fundId: !isBank ? pickDefaultSafeId(safesResponse?.data) ?? '' : '',
      currencyId: defaultCurrencyId(currencies, companyBaseCurrency),
      voucherNumber: '',
      hijriDate: toHijriDate(new Date().toISOString().split('T')[0]),
      fundKind: 'CASHBOX',
    });
    setVoucherLines([emptyLine(headerCurrencyCode, headerFxRate)]);
    resetFxToSetting();
    setAllocations([]);
    setSavedOrderId(null);
    setExecutionStatus('PENDING');
    setIsCancelled(false);
    setCreatedAt(null);
    setCreatedByName(null);
    setExecutedAt(null);
    setExecutedByName(null);
    setMode('create');
    lastHydratedIdRef.current = null;
    skipUrlHydrateRef.current = true;
    openOrder(null);
    setError('');
    setSuccess('');
    clearDraft();
  };

  const validateLines = (): string | null => {
    if (voucherLines.length === 0) return 'يرجى إضافة بنود الأمر';
    for (const [index, line] of voucherLines.entries()) {
      if (!line.accountId) return `يرجى اختيار الحساب في السطر ${index + 1}`;
      if (!(Number(line.amount) > 0)) return `قيمة السطر ${index + 1} يجب أن تكون أكبر من صفر`;
      const account = accounts.find((a) => a.id === line.accountId);
      const ccRule = costCenterRule(account);
      if (ccRule === 'required' && !line.costCenterId) {
        return `مركز التكلفة إجباري في السطر ${index + 1}${account?.code ? ` (${account.code})` : ''}`;
      }
      if (ccRule === 'none' && line.costCenterId) {
        return `الحساب ${account?.code ?? index + 1} مربوط بدون مركز تكلفة — امسح المركز من السطر`;
      }
    }
    if (allocations.length > 0) {
      const allocated = allocations.reduce((s, a) => s + a.allocatedAmount, 0);
      if (Math.abs(allocated - totalAmount) > 0.009) {
        return 'إجمالي التوزيع على الفواتير يجب أن يساوي مبلغ الأمر تماماً';
      }
    }
    if (!autoNumbering && !voucherNumberW?.trim()) {
      return 'رقم الأمر مطلوب — الترقيم يدوي في إعدادات النظام';
    }
    return null;
  };

  const onSave = () => {
    if (busy) return;
    if (savedOrderId && isReadOnly) {
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
        documentRole: 'ORDER',
        amount: totalAmount,
        date: new Date(values.date).toISOString(),
        hijriDate: values.hijriDate || undefined,
        currencyCode: headerCurrencyCode,
        voucherNumber: values.voucherNumber?.trim() || undefined,
        description: values.description.trim(),
        safeId: isCashOrder || values.fundKind === 'CASHBOX' ? values.fundId : undefined,
        bankAccountId: !isCashOrder && values.fundKind === 'BANK_ACCOUNT' ? values.fundId : undefined,
        supplierId: settlementSupplierId || undefined,
        customerId: settlementCustomerId || undefined,
        offsetAccountId: voucherLines[0]?.accountId || undefined,
        allocations: allocations.length ? allocations : undefined,
        lines: isCashOrder
          ? voucherLines.map((line) => toCashPayloadLine({ ...line, entrySide: orderEntrySide }, headerCurrencyCode))
          : voucherLines.map((line) => ({
              accountId: line.accountId,
              description: line.description,
              amount: Number(line.amount),
              currencyCode: line.currencyCode || headerCurrencyCode,
              exchangeRate: Number(line.exchangeRate ?? 1),
              costCenterId: line.costCenterId || undefined,
            })),
      };
      if (savedOrderId) {
        updateMutation.mutate({ ...payload, expectedVersion: documentVersion });
        return;
      }
      saveMutation.mutate(payload);
    }, onFieldErrors(setError))();
  };

  const addLine = () =>
    setVoucherLines((prev) => [
      ...prev,
      isCashOrder
        ? emptyPaymentLine(headerCurrencyCode, orderEntrySide, '', headerFxRate)
        : emptyLine(headerCurrencyCode, headerFxRate),
    ]);
  const accountLabelFor = (accountId: string) => {
    const account = accounts.find((a) => a.id === accountId);
    return account ? `[${account.code}] ${account.arabicName}` : undefined;
  };

  const handleDuplicate = () => {
    const row = selectedOrderResponse?.data;
    if (row?.id) {
      applyCashRow(row, true);
      openOrder(null);
      setSuccess('تم تجهيز نسخة جديدة من الأمر');
      return;
    }
    resetForm();
  };

  const triggerPrint = () => {
    document.querySelector<HTMLButtonElement>('[data-print-document]')?.click();
  };

  const voucherPrintLines = voucherLines.map((line) => {
    const acc = accounts.find((a) => a.id === line.accountId);
    return {
      accountLabel: acc ? `[${acc.code}] ${acc.arabicName}` : line.accountId,
      description: line.description,
      amount: lineBaseAmount(line),
    };
  });

  return (
    <ErpDocumentLayout>
      {error && <ErrorToast message={error} onClose={() => setError('')} />}
      {success && <SuccessToast message={success} onClose={() => setSuccess('')} />}
      {restoreOffer && !savedOrderId ? (
        <PageDraftRestoreBanner
          message="يوجد مسودة أمر غير محفوظة."
          onRestore={() => {
            const payload = acceptRestore();
            if (!payload) return;
            applyOrderDraft(payload);
            setSuccess('تم استعادة مسودة الأمر');
          }}
          onDismiss={dismissRestore}
        />
      ) : null}

      <ErpDocumentPageHeader
        breadcrumbs={variant.breadcrumbs}
        title={variant.title}
        docNumber={voucherNumberW || ''}
        statusTone={isCancelled ? 'danger' : completed ? 'info' : 'warning'}
        statusLabel=""
        saveLabel="حفظ الأمر"
        onSaveDraft={onSave}
        savePending={busy}
        canSave={!isReadOnly && !completed && !isCancelled && !busy}
        hideStandalonePost
        favoriteHref={variant.favoriteHref}
        favoriteLabel={variant.favoriteLabel}
        onBrowseList={() => setShowBrowseList(true)}
        browseListLabel="السابق"
        navEntity="cash-transaction"
        currentId={savedOrderId}
        transactionKind={variant.transactionKind}
        onNavigate={openOrder}
        extraActions={
          <div className="flex flex-wrap items-center gap-2">
            {isCashOrder ? null : (
              <>
                <OrderStatusBadge orderType={variant.orderType} status={executionStatus} />
                {savedOrderId && executionStatus === 'PENDING' && !isCancelled ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="gap-1.5"
                    disabled={executeMutation.isPending}
                    onClick={() => executeMutation.mutate({})}
                  >
                    <Check className="h-3.5 w-3.5" />
                    {variant.confirmLabel}
                  </Button>
                ) : null}
              </>
            )}
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
          </div>
        }
        standardActions={{
          hasDocument: Boolean(savedOrderId),
          isPosted: completed,
          isCancelled,
          hidePostActions: true,
          onNew: resetForm,
          newLabel: 'جديد',
          printLabel: isPaymentOrder
            ? 'طباعة أمر الصرف'
            : isReceiptOrder
              ? 'طباعة أمر التوريد'
              : 'طباعة الأمر',
          voidLabel: 'إلغاء الأمر',
          duplicateLabel: 'تكرار',
          editLockedHint: 'الأمر مكتمل التنفيذ ولا يمكن تعديله',
          voidLockedHint:
            variant.orderType === 'PAYMENT_ORDER'
              ? 'تم صرف الأمر ولا يمكن إلغاؤه'
              : 'تم توريد الأمر ولا يمكن إلغاؤه',
          onEdit: () => {
            if (completed) {
              setError('الأمر مكتمل التنفيذ ولا يمكن تعديله');
              return;
            }
            unlockForEdit();
          },
          onPrint: triggerPrint,
          onDuplicate: handleDuplicate,
          onVoid: () => {
            if (completed) {
              setError(
                variant.orderType === 'PAYMENT_ORDER'
                  ? 'تم صرف الأمر ولا يمكن إلغاؤه'
                  : 'تم توريد الأمر ولا يمكن إلغاؤه'
              );
              return;
            }
            cancelMutation.mutate({ expectedVersion: documentVersion });
          },
          voidPending: cancelMutation.isPending,
        }}
      />

      <DocumentReadOnlyBanner />

      <DocumentFormLock>
        <ErpFormHeaderCard
          row1={
            <>
              <div>
                <label className={erpLabelClass}>رقم الأمر</label>
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
              {isCashOrder ? (
                <div>
                  {isReceiptOrder ? (
                    <ReceiptOrderHeader
                      safes={funds}
                      value={fundId}
                      onChange={(id) => setValue('fundId', id, { shouldDirty: true, shouldValidate: true })}
                      disabled={locked}
                      error={Boolean(errors.fundId)}
                      errorMessage={errors.fundId?.message}
                      executionStatus={executionStatus}
                      baseCurrency={headerCurrencyCode}
                      displayBalance={balanceNum}
                    />
                  ) : (
                    <PaymentOrderHeader
                      safes={funds}
                      value={fundId}
                      onChange={(id) => setValue('fundId', id, { shouldDirty: true, shouldValidate: true })}
                      disabled={locked}
                      error={Boolean(errors.fundId)}
                      errorMessage={errors.fundId?.message}
                      executionStatus={executionStatus}
                      baseCurrency={headerCurrencyCode}
                      displayBalance={balanceNum}
                    />
                  )}
                </div>
              ) : (
                <div>
                  <label className={erpLabelClass}>{variant.fundLabel}</label>
                  <div className="flex gap-2">
                    <select
                      className={`${erpInputClass} w-28 shrink-0`}
                      disabled={locked}
                      {...register('fundKind', {
                        onChange: () => setValue('fundId', '', { shouldValidate: false }),
                      })}
                    >
                      <option value="CASHBOX">صندوق</option>
                      <option value="BANK_ACCOUNT">بنك</option>
                    </select>
                    <select
                      className={`${erpInputClass} ${errors.fundId ? erpInputErrorClass : ''}`}
                      disabled={locked}
                      {...register('fundId')}
                    >
                      <option value="">اختر {isBank ? 'الحساب البنكي' : 'الصندوق'}</option>
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
              {isCashOrder ? (
                overdraftWarning ? (
                  <p className="self-end text-xs font-semibold text-amber-700">
                    مبلغ الأمر يتجاوز رصيد الخزينة الحالي
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
                      مبلغ الأمر يتجاوز رصيد الخزينة الحالي ({balance})
                    </p>
                  ) : null}
                </div>
              )}
            </>
          }
          extras={
            <div className={erpFormGridClass}>
              <ShowFxColumnsField compact checked={showFxColumns} onChange={setShowFxColumns} />
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-1.5 text-sm font-bold text-gray-700 transition-colors hover:border-[#0E78AA] hover:text-[#0E78AA]"
                onClick={() => setShowPaymentsModal(true)}
              >
                توزيع السدادات على الفواتير
                {allocations.length > 0 ? (
                  <span className="inline-flex min-w-[1.15rem] items-center justify-center rounded-full bg-[#0E78AA]/15 px-1 text-[10px] text-[#094C6B]">
                    {allocations.length}
                  </span>
                ) : null}
              </button>
            </div>
          }
        />

        <FormSectionCard title="بنود الأمر" bodyClassName="grid-cols-1 sm:grid-cols-1 lg:grid-cols-1">
          {isCashOrder ? (
            isReceiptOrder ? (
              <ReceiptOrderLinesTable
                lines={voucherLines}
                onChange={setVoucherLines}
                onAddLine={addLine}
                disabled={locked}
                accountLabelFor={accountLabelFor}
                currencies={currencies}
                baseCurrency={headerCurrencyCode}
                showFx={showFxColumns}
                headerDescription={descriptionW}
              />
            ) : (
              <PaymentOrderLinesTable
                lines={voucherLines}
                onChange={setVoucherLines}
                onAddLine={addLine}
                disabled={locked}
                accountLabelFor={accountLabelFor}
                currencies={currencies}
                baseCurrency={headerCurrencyCode}
                showFx={showFxColumns}
                headerDescription={descriptionW}
              />
            )
          ) : (
            <VoucherLinesGrid
              lines={voucherLines}
              onChange={setVoucherLines}
              onAddLine={addLine}
              disabled={locked}
              accountLabelFor={accountLabelFor}
              currencies={currencies}
              headerCurrencyCode={headerCurrencyCode}
              showFx={showFxColumns}
              headerDescription={descriptionW}
            />
          )}
        </FormSectionCard>
      </DocumentFormLock>

      {isCashOrder ? (
        isReceiptOrder ? (
          <ReceiptOrderStickyFooter
            totalAmount={totalAmount}
            currencyCode={companyBaseCurrency}
            executionStatus={executionStatus}
            executedAt={executedAt}
            executedByName={executedByName}
            canConfirm={Boolean(savedOrderId && executionStatus === 'PENDING' && !isCancelled)}
            confirmPending={executeMutation.isPending}
            onConfirm={() => executeMutation.mutate({})}
            onSave={onSave}
            onCancel={resetForm}
            savePending={busy}
            canSave={!isReadOnly && !completed && !isCancelled && !busy}
            saveLabel={savedOrderId ? 'حفظ التعديلات' : 'حفظ أمر التوريد'}
          />
        ) : (
          <PaymentOrderStickyFooter
            totalAmount={totalAmount}
            currencyCode={companyBaseCurrency}
            executionStatus={executionStatus}
            executedAt={executedAt}
            executedByName={executedByName}
            canConfirm={Boolean(savedOrderId && executionStatus === 'PENDING' && !isCancelled)}
            confirmPending={executeMutation.isPending}
            onConfirm={() => executeMutation.mutate({})}
            onSave={onSave}
            onCancel={resetForm}
            savePending={busy}
            canSave={!isReadOnly && !completed && !isCancelled && !busy}
            saveLabel={savedOrderId ? 'حفظ التعديلات' : 'حفظ أمر الصرف'}
          />
        )
      ) : (
        <OrderStickyFooter
          totalAmount={totalAmount}
          currencyCode={companyBaseCurrency}
          createdAt={createdAt}
          createdByName={createdByName}
          onSave={onSave}
          onCancel={resetForm}
          savePending={busy}
          canSave={!isReadOnly && !completed && !isCancelled && !busy}
          saveLabel={savedOrderId ? 'حفظ التعديلات' : 'حفظ الأمر'}
        />
      )}

      <PaymentsDistributionModal
        isOpen={showPaymentsModal}
        onClose={() => setShowPaymentsModal(false)}
        side={isPayable ? 'payable' : 'receivable'}
        partyId={settlementPartyId}
        accountId={settlementAccountId}
        cashTransactionId={savedOrderId}
        isPosted={executionStatus === 'COMPLETED'}
        receiptTotal={totalAmount}
        draftMode={executionStatus !== 'COMPLETED'}
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

      <DocumentBrowseDrawer
        open={showBrowseList}
        onClose={() => setShowBrowseList(false)}
        title={variant.browseTitle}
      >
        <GenericRecordsList
          apiPath="/treasury/cash-transactions"
          listKey={`order-browse-${variant.id}`}
          extraParams={{
            transactionKind: variant.transactionKind,
            documentRole: 'ORDER',
          }}
          selectedId={savedOrderId}
          resolveStatus={(r) => {
            if (r.isCancelled === true || r.executionStatus === 'CANCELLED') {
              return { variant: 'danger' as const, label: 'ملغي' };
            }
            if (r.executionStatus === 'COMPLETED') {
              return {
                variant: 'success' as const,
                label: variant.orderType === 'PAYMENT_ORDER' ? 'تم الصرف' : 'تم التوريد',
              };
            }
            return {
              variant: 'warning' as const,
              label: variant.orderType === 'PAYMENT_ORDER' ? 'لم يتم الصرف' : 'لم يتم التوريد',
            };
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
            openOrder(String((row as { id?: string }).id ?? ''));
            setShowBrowseList(false);
          }}
        />
      </DocumentBrowseDrawer>
    </ErpDocumentLayout>
  );
}
