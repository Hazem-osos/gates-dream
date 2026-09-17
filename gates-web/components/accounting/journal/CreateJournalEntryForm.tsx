'use client';

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { ClipboardList } from 'lucide-react';
import { useForm, useFieldArray, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import dynamic from 'next/dynamic';
import { DynamicChunkSkeleton } from '@/components/ui/DynamicChunkSkeleton';
import { ErpDocumentLayout } from '@/components/erp/ErpDocumentLayout';
import { ErpDocumentPageHeader } from '@/components/erp/ErpDocumentPageHeader';
import { DocumentBrowseDrawer } from '@/components/erp/DocumentBrowseDrawer';
import { ErpFormHeaderCard } from '@/components/erp/ErpFormHeaderCard';
import { erpInputClass, erpLabelClass } from '@/components/erp/erpUiTokens';
import { JournalEntryBottomSplit } from '@/components/accounting/journal/JournalEntryBottomSplit';
import { JournalEntryStickyFooter } from '@/components/accounting/journal/JournalEntryStickyFooter';
import { JournalLinesTable } from '@/components/accounting/journal/JournalLinesTable';
import { Button } from '@/components/ui';
import { useRouter } from 'next/navigation';
import { useOwnTabSearchParams } from '@/lib/navigation/tab-route-lock';
import { PageDraftRestoreBanner } from '@/components/erp/PageDraftRestoreBanner';
import { useApiQuery, useApiMutation, useInvalidateQuery } from '@/lib/hooks/useApi';
import type { ApiError } from '@/lib/api/types';
import { dispatchAcademyTrigger } from '@/lib/onboarding/tourCheckpoints';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';
import { toast, toastVersionConflict } from '@/lib/feedback/toast';
import { isOptimisticLockApiError } from '@/lib/concurrency/version-conflict';
import {
  journalEntrySchema,
  type JournalEntryFormValues,
} from '@/lib/validation/accounting.schema';
import {
  ACCOUNT_PICKER_PAGE_SIZE,
  invalidateTreasuryFundBalances,
  useAccountsQuery,
  useCurrenciesQuery,
} from '@/lib/hooks/useMasterDataQueries';
import { useCompanyPrintProfile } from '@/lib/hooks/useCompanyPrintProfile';
import { PrintDocumentButton } from '@/app/components/print/PrintDocumentButton';
import { printOperationalDocument } from '@/lib/print/printOperationalDocument';
import {
  DocumentFormLock,
  DocumentModeProvider,
  DocumentReadOnlyBanner,
  useDocumentMode,
} from '@/components/common/document-shell';

import type { JournalPrintModel } from '@/lib/print/types';
import { DocumentApprovalBar } from '@/app/components/accounting/DocumentApprovalBar';
import { DatePickerWithHijri } from '@/components/ui/DatePickerWithHijri';
import { RecurringEntryPickerModal, type RecurringTemplate } from '@/components/accounting/RecurringEntryPickerModal';
import { toHijriDate } from '@/lib/hijri-date';
import { useDraftAutosave } from '@/lib/hooks/useDraftAutosave';
import { onFieldErrors } from '@/lib/forms/on-field-errors';
import { resolveJournalSourceKind, type JournalSourceType } from '@/lib/accounting/journal-source';
import { pickCurrencyByCode, rateForCurrency, toBaseAmount } from '@/lib/accounting/fx-base';
import { costCenterRuleFromAccount } from '@/lib/accounting/cost-center-rule';
import { useCompanyBaseCurrency } from '@/lib/hooks/useCompanyBaseCurrency';
import {
  postJournalAfterSave,
  useRepostAfterUnpost,
} from '@/lib/accounting/ensure-posted-after-save';
import { DocumentCurrencyRateFields } from '@/components/accounting/DocumentCurrencyRateFields';
import { ShowFxColumnsField } from '@/components/accounting/ShowFxColumnsField';
import { useShowFxColumns } from '@/lib/transaction-settings/useShowFxColumns';

const JournalEntriesListSection = dynamic(
  () =>
    import('@/app/components/accounting/JournalEntriesListSection').then((m) => ({
      default: m.JournalEntriesListSection,
    })),
  { ssr: false, loading: () => <DynamicChunkSkeleton label="جاري تحميل قائمة القيود…" /> }
);

type JournalEntryApiBody = {
  date: string;
  hijriDate?: string;
  description?: string;
  voucherNumber?: string;
  isCyclic?: boolean;
  isRecurring?: boolean;
  sourceType?: string;
  sourceId?: string;
  sourceNumber?: string;
  currencyCode: string;
  exchangeRate?: number;
  expectedVersion?: number;
  lines: {
    accountId: string;
    description?: string;
    debit: number;
    credit: number;
    lineOrder: number;
    exchangeRate?: number;
    costCenterId?: string;
    partnerId?: string;
    partnerType?: 'CUSTOMER' | 'SUPPLIER';
    isTiedToInvoice?: boolean;
    invoiceId?: string | null;
    invoiceNumber?: string | null;
    currencyId?: string;
    debitBase?: number;
    creditBase?: number;
  }[];
};

/** GET /accounting/journal-entries/:id response shape (subset actually read here). */
type JournalEntryDetail = {
  id: string;
  date?: string;
  hijriDate?: string | null;
  description?: string | null;
  voucherNumber?: string | null;
  legacyGlNum?: string | null;
  isCyclic?: boolean;
  isRecurring?: boolean;
  isPosted?: boolean;
  postingStatus?: string | null;
  isCancelled?: boolean;
  isApproved?: boolean;
  currencyCode?: string;
  version?: number;
  sourceType?: string | null;
  sourceKind?: string | null;
  sourceId?: string | null;
  sourceNumber?: string | null;
  lines?: Array<{
    accountId: string;
    description?: string | null;
    debit: number | string;
    credit: number | string;
    exchangeRate?: number | string | null;
    costCenterId?: string | null;
    partnerId?: string | null;
    partnerType?: string | null;
    isTiedToInvoice?: boolean;
    invoiceId?: string | null;
    invoiceNumber?: string | null;
  }>;
};

const inputErrorClass = 'border-red-400 focus:ring-red-200';
const fieldErrorClass = 'text-red-600 text-xs mt-1 block text-right';

type JournalDraftSnapshot = JournalEntryFormValues & {
  isCyclic: boolean;
  headerRateOverride: number | null;
  sourceKind: JournalSourceType;
  sourceId: string | null;
  sourceNumber: string | null;
};

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <span className={fieldErrorClass}>{message}</span>;
}

export default function CreateJournalEntryForm() {
  return (
    <DocumentModeProvider>
      <CreateJournalEntryFormInner />
    </DocumentModeProvider>
  );
}

function CreateJournalEntryFormInner() {
  const router = useRouter();
  const { lockToView, setMode, unlockForEdit, isReadOnly, mode } = useDocumentMode();
  const invalidateQuery = useInvalidateQuery();
  const searchParams = useOwnTabSearchParams();
  const journalEntryIdFromUrl = searchParams.get('id');

  const [showList, setShowList] = useState(false);
  const [isCyclic, setIsCyclic] = useState(false);
  const [isPosted, setIsPosted] = useState(false);
  const [isCancelled, setIsCancelled] = useState(false);
  const [isApproved, setIsApproved] = useState(false);
  const [voucherStatus, setVoucherStatus] = useState('غير مرحل');
  const [showRecurringPicker, setShowRecurringPicker] = useState(false);
  const { showFx: showFxColumns, setShowFx: setShowFxColumns, resetFxToSetting } = useShowFxColumns(
    'JOURNAL_ENTRY'
  );
  const [sourceKind, setSourceKind] = useState<JournalSourceType>('MANUAL');
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [sourceNumber, setSourceNumber] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [savedJournalEntryId, setSavedJournalEntryId] = useState<string | null>(
    () => journalEntryIdFromUrl?.trim() || null
  );
  const [loadedVersion, setLoadedVersion] = useState<number | undefined>(undefined);
  const skipUrlHydrateRef = useRef(false);
  const skipHeaderFxSyncRef = useRef(false);
  const [headerRateOverride, setHeaderRateOverride] = useState<number | null>(null);
  const { markUnpostedForEdit, consumeShouldRepost, resetKeepPosted } = useRepostAfterUnpost();

  useEffect(() => {
    const id = journalEntryIdFromUrl?.trim();
    if (skipUrlHydrateRef.current) {
      if (!id) skipUrlHydrateRef.current = false;
      return;
    }
    if (id && id !== savedJournalEntryId) {
      setSavedJournalEntryId(id);
    }
  }, [journalEntryIdFromUrl, savedJournalEntryId]);

  useEffect(() => {
    if (!savedJournalEntryId) {
      setMode('create');
      return;
    }
    if (isPosted || isCancelled) lockToView();
    else if (savedJournalEntryId && mode === 'create') setMode('edit');
  }, [isCancelled, isPosted, lockToView, mode, savedJournalEntryId, setMode]);

  const openJournal = useCallback(
    (id: string | null) => {
      skipUrlHydrateRef.current = false;
      setSavedJournalEntryId(id);
      if (id) router.replace(`/accounting/operations/journal-entry?id=${id}`, { scroll: false });
      else router.replace('/accounting/operations/journal-entry', { scroll: false });
    },
    [router]
  );

  const {
    register,
    control,
    handleSubmit,
    watch,
    reset,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<JournalEntryFormValues>({
    resolver: zodResolver(journalEntrySchema) as Resolver<JournalEntryFormValues>,
    defaultValues: {
      date: '',
      referenceNumber: '',
      hijriDate: '',
      description: '',
      currencyId: '',
      lines: [],
    },
    mode: 'onTouched',
  });

  const { append, replace } = useFieldArray({
    control,
    name: 'lines',
  });

  const headerCurrencyId = watch('currencyId');
  const watchedLines = watch('lines');

  const { data: currenciesResponse, isLoading: currenciesLoading } = useCurrenciesQuery();
  const currencies = useMemo(() => currenciesResponse?.data || [], [currenciesResponse?.data]);
  const { code: companyBaseCurrency } = useCompanyBaseCurrency();

  const validSavedJournalId =
    savedJournalEntryId &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      savedJournalEntryId
    )
      ? savedJournalEntryId
      : null;

  const { data: journalEntryResponse } = useApiQuery<JournalEntryDetail>(
    ['journal-entry', validSavedJournalId],
    `/accounting/journal-entries/${validSavedJournalId}`,
    undefined,
    { enabled: Boolean(validSavedJournalId), retry: false, skipErrorNotify: true }
  );
  const loadedJournalEntry = journalEntryResponse?.data;

  const { data: nextNumberResponse } = useApiQuery<{ automatic: boolean; number: string }>(
    ['journal-entry-next-number'],
    '/accounting/journal-entries/next-number',
    undefined,
    { enabled: !savedJournalEntryId, staleTime: 0 }
  );
  const nextJournalNumber = nextNumberResponse?.data?.number ?? '';

  useEffect(() => {
    if (savedJournalEntryId || !nextJournalNumber) return;
    setValue('referenceNumber', nextJournalNumber, { shouldDirty: false, shouldValidate: false });
  }, [nextJournalNumber, savedJournalEntryId, setValue]);

  useEffect(() => {
    if (!loadedJournalEntry || currencies.length === 0) return;
    skipHeaderFxSyncRef.current = true;
    const currency =
      currencies.find((c) => c.code === loadedJournalEntry.currencyCode) ?? currencies[0];
    reset({
      date: loadedJournalEntry.date
        ? new Date(loadedJournalEntry.date).toISOString().split('T')[0]
        : '',
      referenceNumber: loadedJournalEntry.voucherNumber || loadedJournalEntry.legacyGlNum || '',
      hijriDate: loadedJournalEntry.hijriDate || '',
      description: loadedJournalEntry.description || '',
      currencyId: currency?.id || '',
      lines: (loadedJournalEntry.lines ?? []).map((line) => ({
        accountId: line.accountId,
        description: line.description || '',
        debit: Number(line.debit) || 0,
        credit: Number(line.credit) || 0,
        currencyId: currency?.id || undefined,
        exchangeRate: Number(line.exchangeRate) || 1,
        costCenterId: line.costCenterId || '',
        partnerId: line.partnerId || undefined,
        partnerType:
          line.partnerType === 'CUSTOMER' || line.partnerType === 'SUPPLIER'
            ? line.partnerType
            : undefined,
        isTiedToInvoice: Boolean(line.isTiedToInvoice && line.invoiceId),
        invoiceId: line.invoiceId ?? null,
        invoiceNumber: line.invoiceNumber ?? null,
      })),
    });
    const firstLineRate = Number(loadedJournalEntry.lines?.[0]?.exchangeRate);
    setHeaderRateOverride(firstLineRate > 0 ? firstLineRate : null);
    setIsCyclic(Boolean(loadedJournalEntry.isCyclic || loadedJournalEntry.isRecurring));
    const posted =
      Boolean(loadedJournalEntry.isPosted) || loadedJournalEntry.postingStatus === 'Post';
    setIsPosted(posted);
    setIsCancelled(loadedJournalEntry.isCancelled ?? false);
    setIsApproved(loadedJournalEntry.isApproved ?? false);
    setVoucherStatus(
      loadedJournalEntry.isCancelled ? 'ملغي' : posted ? 'مرحل' : 'غير مرحل'
    );
    setLoadedVersion(loadedJournalEntry.version);
    setSourceKind(
      resolveJournalSourceKind(loadedJournalEntry.sourceType, loadedJournalEntry.sourceKind)
    );
    setSourceId(loadedJournalEntry.sourceId ?? null);
    setSourceNumber(loadedJournalEntry.sourceNumber ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadedJournalEntry, currencies.length]);

  const journalMutation = useApiMutation<unknown, JournalEntryApiBody>(
    '/accounting/journal-entries',
    'POST',
    {
      onSuccess: () => {
        const message = isCyclic ? 'تم حفظ القيد وإضافته للقيود الدورية' : 'تم حفظ القيد بنجاح';
        clearDraft();
        invalidateQuery(['journal-entries']);
        invalidateQuery(['recurring-journal-entries']);
        invalidateQuery(['journal-entry-next-number']);
        startNewEntry();
        setSuccess(message);
      },
      onError: (error: ApiError) => {
        setError(error.message || 'حدث خطأ أثناء الحفظ');
      },
    }
  );

  const journalUpdateMutation = useApiMutation<unknown, JournalEntryApiBody>(
    savedJournalEntryId ? `/accounting/journal-entries/${savedJournalEntryId}` : '/accounting/journal-entries',
    'PUT',
    {
      onSuccess: () => {
        const id = savedJournalEntryId;
        invalidateQuery(['journal-entries']);
        invalidateQuery(['recurring-journal-entries']);
        invalidateQuery(['journal-entry-next-number']);
        invalidateQuery(['journal-entry', id]);
        if (consumeShouldRepost() && id) {
          void postJournalAfterSave(id)
            .then(() => {
              invalidateQuery(['journal-entries']);
              invalidateQuery(['journal-entry', id]);
              invalidateTreasuryFundBalances(invalidateQuery);
              startNewEntry();
              setSuccess('تم حفظ التعديلات وترحيل القيد');
            })
            .catch((error: ApiError) => {
              setError(error.message || 'تم الحفظ لكن تعذر ترحيل القيد');
            });
          return;
        }
        const message = isCyclic ? 'تم حفظ التعديلات وتحديث القيد الدوري' : 'تم حفظ التعديلات بنجاح';
        startNewEntry();
        setSuccess(message);
      },
      onError: (error: ApiError) => {
        if (isOptimisticLockApiError(error)) {
          toastVersionConflict(error.message, () =>
            invalidateQuery(['journal-entry', savedJournalEntryId])
          );
          return;
        }
        setError(error.message || 'حدث خطأ أثناء التحديث');
      },
    }
  );

  const postJournalMutation = useApiMutation<unknown, Record<string, never>>(
    savedJournalEntryId ? `/accounting/journal-entries/${savedJournalEntryId}/post` : '/accounting/journal-entries',
    'POST',
    {
      onSuccess: () => {
        setIsPosted(true);
        setVoucherStatus('مرحل');
        setSuccess('تم ترحيل القيد بنجاح');
        invalidateQuery(['journal-entries']);
        invalidateTreasuryFundBalances(invalidateQuery);
        dispatchAcademyTrigger('API_SUCCESS', 'journal-entry.post-success');
      },
      onError: (error: ApiError) => {
        setIsPosted(false);
        setError(error.message || 'حدث خطأ أثناء الترحيل');
      },
    }
  );

  const unpostJournalMutation = useApiMutation<unknown, Record<string, never>>(
    savedJournalEntryId ? `/accounting/journal-entries/${savedJournalEntryId}/unpost` : '/accounting/journal-entries',
    'POST',
    {
      onSuccess: () => {
        setIsPosted(false);
        setIsApproved(false);
        setVoucherStatus('غير مرحل');
        markUnpostedForEdit();
        setSuccess('تم فك ترحيل القيد');
        unlockForEdit();
        invalidateQuery(['journal-entries']);
        invalidateQuery(['journal-entry', savedJournalEntryId]);
        invalidateTreasuryFundBalances(invalidateQuery);
      },
      onError: (error: ApiError) => {
        setError(error.message || 'حدث خطأ أثناء فك الترحيل');
      },
    }
  );

  const unapproveJournalMutation = useApiMutation<unknown, Record<string, never>>(
    savedJournalEntryId
      ? `/accounting/journal-entries/${savedJournalEntryId}/unapprove`
      : '/accounting/journal-entries',
    'POST',
    {
      onSuccess: () => {
        setIsApproved(false);
        setSuccess('تم إلغاء اعتماد القيد');
        invalidateQuery(['journal-entries']);
        invalidateQuery(['journal-entry', savedJournalEntryId]);
      },
      onError: (error: ApiError) => {
        setError(error.message || 'تعذر إلغاء الاعتماد');
      },
    }
  );

  const cancelJournalMutation = useApiMutation<unknown, Record<string, never>>(
    savedJournalEntryId ? `/accounting/journal-entries/${savedJournalEntryId}/cancel` : '/accounting/journal-entries',
    'POST',
    {
      onSuccess: () => {
        setIsCancelled(true);
        setVoucherStatus('ملغي');
        setSuccess('تم إلغاء القيد. القيد ما زال موجوداً بحالة ملغي.');
        invalidateQuery(['journal-entries']);
        invalidateQuery(['journal-entry', savedJournalEntryId]);
        lockToView();
      },
      onError: (error: ApiError) => {
        setError(error.message || 'تعذر إلغاء القيد');
      },
    }
  );

  const restoreJournalMutation = useApiMutation<unknown, Record<string, never>>(
    savedJournalEntryId
      ? `/accounting/journal-entries/${savedJournalEntryId}/restore`
      : '/accounting/journal-entries',
    'POST',
    {
      onSuccess: () => {
        setIsCancelled(false);
        setIsPosted(true);
        setIsApproved(true);
        setVoucherStatus('مرحل');
        setSuccess('تم استعادة القيد وترحيله');
        invalidateQuery(['journal-entries']);
        invalidateQuery(['journal-entry', savedJournalEntryId]);
        lockToView();
      },
      onError: (error: ApiError) => {
        const message = error.message || 'تعذر استعادة القيد';
        if (message.includes('تم استعادة القيد كمسودة')) {
          setIsCancelled(false);
          setIsPosted(false);
          setVoucherStatus('غير مرحل');
          unlockForEdit();
          invalidateQuery(['journal-entries']);
          invalidateQuery(['journal-entry', savedJournalEntryId]);
        }
        setError(message);
      },
    }
  );

  const loading = journalMutation.isPending || journalUpdateMutation.isPending;
  const financialBusy =
    loading ||
    postJournalMutation.isPending ||
    unpostJournalMutation.isPending ||
    cancelJournalMutation.isPending ||
    restoreJournalMutation.isPending;

  useEffect(() => {
    if (savedJournalEntryId) return;
    const today = new Date().toISOString().split('T')[0];
    if (!getValues('date')) {
      setValue('date', today, { shouldDirty: false });
      setValue('hijriDate', toHijriDate(today), { shouldDirty: false });
    }
  }, [getValues, savedJournalEntryId, setValue]);

  useEffect(() => {
    if (currencies.length > 0 && !headerCurrencyId) {
      const defaultCurrency = pickCurrencyByCode(currencies, companyBaseCurrency);
      if (defaultCurrency) setValue('currencyId', defaultCurrency.id, { shouldDirty: false });
    }
  }, [companyBaseCurrency, currencies, headerCurrencyId, setValue]);

  useEffect(() => {
    if (!headerCurrencyId) return;
    if (skipHeaderFxSyncRef.current) {
      skipHeaderFxSyncRef.current = false;
      return;
    }
    const header = currencies.find((c) => c.id === headerCurrencyId);
    const catalogRate = rateForCurrency(header?.code, companyBaseCurrency, header?.exchangeRate);
    const headerRate = headerRateOverride ?? catalogRate;
    const lines = getValues('lines') ?? [];
    if (!lines.length) return;
    replace(
      lines.map((line) => ({
        ...line,
        currencyId: headerCurrencyId,
        exchangeRate: headerRate,
      }))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headerCurrencyId]);

  const debitTotal =
    watchedLines?.reduce((sum, line) => sum + toBaseAmount(line?.debit, line?.exchangeRate), 0) ?? 0;
  const creditTotal =
    watchedLines?.reduce((sum, line) => sum + toBaseAmount(line?.credit, line?.exchangeRate), 0) ?? 0;

  const { data: accountsResponse } = useAccountsQuery(undefined, ACCOUNT_PICKER_PAGE_SIZE, { leafOnly: true });
  const accounts = useMemo(() => accountsResponse?.data ?? [], [accountsResponse?.data]);
  const { profile: companyProfile } = useCompanyPrintProfile();
  const referenceNumberW = watch('referenceNumber');
  const dateW = watch('date');
  const descriptionW = watch('description');
  const hijriDateW = watch('hijriDate');
  const draftSnapshot = useMemo<JournalDraftSnapshot>(
    () => ({
      date: dateW || '',
      referenceNumber: referenceNumberW || '',
      hijriDate: hijriDateW || '',
      description: descriptionW || '',
      currencyId: headerCurrencyId || '',
      lines: watchedLines ?? [],
      isCyclic,
      headerRateOverride,
      sourceKind,
      sourceId,
      sourceNumber,
    }),
    [
      dateW,
      referenceNumberW,
      hijriDateW,
      descriptionW,
      headerCurrencyId,
      watchedLines,
      isCyclic,
      headerRateOverride,
      sourceKind,
      sourceId,
      sourceNumber,
    ]
  );
  const isJournalDraftEmpty = useCallback((draft: JournalDraftSnapshot) => {
    return (
      !draft.description?.trim() &&
      !(draft.lines ?? []).some((line) => line.accountId || Number(line.debit) || Number(line.credit))
    );
  }, []);

  const applyJournalDraft = useCallback(
    (payload: JournalDraftSnapshot) => {
      const today = new Date().toISOString().split('T')[0];
      reset({
        date: payload?.date || today,
        referenceNumber: payload?.referenceNumber ?? '',
        hijriDate: payload?.hijriDate ?? '',
        description: payload?.description ?? '',
        currencyId: payload?.currencyId ?? '',
        lines: Array.isArray(payload?.lines) ? payload.lines : [],
      });
      setIsCyclic(Boolean(payload?.isCyclic));
      setHeaderRateOverride(
        payload?.headerRateOverride == null ? null : Number(payload.headerRateOverride)
      );
      if (payload?.sourceKind) setSourceKind(payload.sourceKind as JournalSourceType);
      setSourceId(payload?.sourceId ?? null);
      setSourceNumber(payload?.sourceNumber ?? null);
    },
    [reset]
  );

  const {
    restoreOffer,
    acceptRestore,
    dismissRestore,
    clearDraft,
  } = useDraftAutosave({
    documentType: 'journal-entry',
    value: draftSnapshot,
    enabled: !savedJournalEntryId && !isPosted,
    applyRestore: applyJournalDraft,
    isEmpty: isJournalDraftEmpty,
    restoreMessage: 'تم استعادة المسودة المحفوظة',
  });

  useEffect(() => {
    if (!restoreOffer || savedJournalEntryId) return;
    if (isJournalDraftEmpty(restoreOffer)) dismissRestore();
  }, [isJournalDraftEmpty, restoreOffer, savedJournalEntryId, dismissRestore]);

  useEffect(() => {
    if (!dateW) return;
    const hijri = toHijriDate(dateW);
    if (hijri && hijri !== getValues('hijriDate')) {
      setValue('hijriDate', hijri, { shouldDirty: false });
    }
  }, [dateW, getValues, setValue]);

  const journalPrintModel: JournalPrintModel = useMemo(() => {
    return {
      voucherNumber: referenceNumberW || undefined,
      date: dateW ? new Date(dateW).toLocaleDateString('ar-EG') : '—',
      description: descriptionW || undefined,
      currencyCode: companyBaseCurrency,
      lines: (watchedLines ?? []).map((l) => {
        const acc = accounts.find((a) => a.id === l.accountId);
        return {
          accountLabel: acc ? `[${acc.code}] ${acc.arabicName}` : l.accountId || '—',
          description: l.description,
          debit: toBaseAmount(l.debit, l.exchangeRate),
          credit: toBaseAmount(l.credit, l.exchangeRate),
        };
      }),
      debitTotal,
      creditTotal,
    };
  }, [
    watchedLines,
    accounts,
    referenceNumberW,
    dateW,
    descriptionW,
    currencies,
    companyBaseCurrency,
    debitTotal,
    creditTotal,
  ]);

  const linesRootMessage =
    errors.lines && typeof errors.lines === 'object' && 'message' in errors.lines && errors.lines.message
      ? String(errors.lines.message)
      : undefined;

  const notifySaveBlock = (message: string) => {
    setError(message);
    toast.error(message, { id: 'gates-form-error', duration: 6000 });
  };

  const assertLinesReadyToSave = (lines: JournalEntryFormValues['lines']) => {
    const meaningful = lines.filter(
      (line) => line.accountId?.trim() || Number(line.debit) || Number(line.credit)
    );
    if (meaningful.length < 2) {
      notifySaveBlock('أدخل سطرين على الأقل بحساب ومبلغ ثم احفظ');
      return false;
    }
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const hasAmount = Number(line.debit) > 0 || Number(line.credit) > 0;
      if (hasAmount && !String(line.accountId ?? '').trim()) {
        notifySaveBlock(`السطر ${index + 1}: يجب اختيار الحساب قبل الحفظ`);
        return false;
      }
    }
    return true;
  };

  const submitJournal = () => {
    const lines = getValues('lines') ?? [];
    if (!assertLinesReadyToSave(lines)) return;
    void handleSubmit(onValidSubmit, onFieldErrors(setError))();
  };

  const onValidSubmit = (data: JournalEntryFormValues) => {
    if (financialBusy) return;
    if (!assertLinesReadyToSave(data.lines)) return;
    setError('');
    setSuccess('');
    for (const [index, line] of data.lines.entries()) {
      const account = accounts.find((a) => a.id === line.accountId);
      const rule = costCenterRuleFromAccount(account);
      if (rule === 'required' && !line.costCenterId) {
        notifySaveBlock(`مركز التكلفة إجباري في السطر ${index + 1}${account?.code ? ` (${account.code})` : ''}`);
        return;
      }
      if (rule === 'none' && line.costCenterId) {
        notifySaveBlock(`الحساب ${account?.code ?? index + 1} مربوط بدون مركز تكلفة — امسح المركز من السطر`);
        return;
      }
    }
    const headerCurrency = currencies.find((c) => c.id === data.currencyId);
    const currencyCode = headerCurrency?.code ?? companyBaseCurrency;
    const requestBody: JournalEntryApiBody = {
      date: new Date(data.date).toISOString(),
      hijriDate: data.hijriDate || toHijriDate(data.date) || undefined,
      description: data.description.trim(),
      isCyclic,
      isRecurring: isCyclic || sourceKind === 'RECURRING_TEMPLATE',
      sourceType: sourceKind,
      sourceId: sourceId || undefined,
      sourceNumber: sourceNumber || undefined,
      currencyCode,
      exchangeRate: data.lines[0]?.exchangeRate || 1,
      lines: data.lines.map((line, index) => {
        const rate = line.exchangeRate || 1;
        const debit = line.debit || 0;
        const credit = line.credit || 0;
        const tied = Boolean(line.isTiedToInvoice && line.invoiceId);
        return {
          accountId: line.accountId,
          description: line.description,
          debit,
          credit,
          lineOrder: index + 1,
          exchangeRate: rate,
          costCenterId: line.costCenterId || undefined,
          currencyId: line.currencyId,
          debitBase: debit * rate,
          creditBase: credit * rate,
          partnerId: line.partnerId || undefined,
          partnerType: line.partnerType,
          isTiedToInvoice: tied,
          invoiceId: tied ? line.invoiceId : null,
          invoiceNumber: tied ? line.invoiceNumber || null : null,
        };
      }),
    };

    if (savedJournalEntryId) {
      journalUpdateMutation.mutate({ ...requestBody, expectedVersion: loadedVersion });
      return;
    }
    journalMutation.mutate(requestBody);
  };

  const appendLine = useCallback(() => {
    const cur = getValues('currencyId');
    const lines = getValues('lines') ?? [];
    let debitSum = 0;
    let creditSum = 0;
    for (const line of lines) {
      debitSum += toBaseAmount(line?.debit, line?.exchangeRate);
      creditSum += toBaseAmount(line?.credit, line?.exchangeRate);
    }
    const header = currencies.find((c) => c.id === cur);
    const headerRate = rateForCurrency(header?.code, companyBaseCurrency, header?.exchangeRate);
    const diffBase = debitSum - creditSum;
    const diff = headerRate > 0 ? diffBase / headerRate : diffBase;
    append({
      accountId: '',
      description: getValues('description') || '',
      debit: diff < -0.005 ? Math.round(Math.abs(diff) * 100) / 100 : 0,
      credit: diff > 0.005 ? Math.round(diff * 100) / 100 : 0,
      currencyId: cur || undefined,
      exchangeRate: headerRate,
      costCenterId: '',
      isTiedToInvoice: false,
      invoiceId: null,
      invoiceNumber: null,
    });
  }, [append, companyBaseCurrency, currencies, getValues]);

  const applyRecurringTemplate = (template: RecurringTemplate) => {
    const cur = getValues('currencyId');
    const header = currencies.find((c) => c.id === cur);
    const headerRate = rateForCurrency(header?.code, companyBaseCurrency, header?.exchangeRate);
    replace(
      (template.lines ?? []).map((line) => ({
        accountId: line.accountId,
        description: line.description || '',
        debit: Number(line.debit) || 0,
        credit: Number(line.credit) || 0,
        currencyId: cur || undefined,
        exchangeRate: headerRate,
        costCenterId: line.costCenterId || '',
        isTiedToInvoice: false,
        invoiceId: null,
        invoiceNumber: null,
      }))
    );
    if (template.notes) {
      setValue('description', template.notes, { shouldDirty: true });
    }
    setSourceKind('RECURRING_TEMPLATE');
    setSourceId(template.id);
    setSourceNumber(template.templateNameAr);
    setIsCyclic(true);
    setSuccess(`تم استدعاء القيد الدوري: ${template.templateNameAr}`);
  };

  const startNewEntry = () => {
    const today = new Date().toISOString().split('T')[0];
    const cur = getValues('currencyId');
    reset({
      date: today,
      referenceNumber: '',
      hijriDate: toHijriDate(today),
      description: '',
      currencyId: cur,
      lines: [],
    });
    setSourceKind('MANUAL');
    setSourceId(null);
    setSourceNumber(null);
    setIsCyclic(false);
    setSavedJournalEntryId(null);
    setLoadedVersion(undefined);
    setHeaderRateOverride(null);
    resetFxToSetting();
    setIsPosted(false);
    resetKeepPosted();
    setIsCancelled(false);
    setIsApproved(false);
    setVoucherStatus('غير مرحل');
    setError('');
    setSuccess('');
    setMode('create');
    clearDraft();
    if (journalEntryIdFromUrl) {
      skipUrlHydrateRef.current = true;
      router.replace('/accounting/operations/journal-entry');
    } else {
      skipUrlHydrateRef.current = false;
    }
  };

  const triggerPrint = () => {
    document.querySelector<HTMLButtonElement>('[data-print-document]')?.click();
  };

  const handlePost = () => {
    if (financialBusy) return;
    setError('');
    setSuccess('');
    if (!savedJournalEntryId) {
      setError('احفظ القيد أولاً قبل الترحيل');
      return;
    }
    postJournalMutation.mutate({});
  };

  return (
    <ErpDocumentLayout>
      {error && <ErrorToast message={error} onClose={() => setError('')} />}
      {success && <SuccessToast message={success} onClose={() => setSuccess('')} />}
      {restoreOffer && !savedJournalEntryId ? (
        <PageDraftRestoreBanner
          message="يوجد مسودة قيد غير محفوظة من جلسة سابقة."
          onRestore={() => {
            const payload = acceptRestore();
            if (!payload) return;
            applyJournalDraft(payload);
            setSuccess('تم استعادة المسودة المحفوظة');
          }}
          onDismiss={dismissRestore}
        />
      ) : null}

      <ErpDocumentPageHeader
        breadcrumbs={[
          { href: '/accounting', label: 'المحاسبة' },
          { label: 'العمليات' },
          { label: 'قيود اليومية' },
        ]}
        title="قيد يومية"
        docNumber={referenceNumberW || voucherStatus}
        statusTone={isCancelled ? 'danger' : isPosted ? 'success' : 'warning'}
        statusLabel={
          isCancelled ? 'ملغي' : isPosted ? 'مرحّل' : savedJournalEntryId ? 'غير مرحل' : 'مسودة'
        }
        saveLabel="حفظ"
        onSaveDraft={submitJournal}
        onPost={handlePost}
        savePending={financialBusy}
        postPending={postJournalMutation.isPending}
        canSave={!isReadOnly && !isPosted && !isCancelled && !financialBusy}
        canPost={!!savedJournalEntryId && !isPosted && !isCancelled && !financialBusy}
        printTrigger={
          <PrintDocumentButton
            label="طباعة"
            disabled={!watchedLines?.length}
            onPrintLayout={() =>
              printOperationalDocument({
                title: 'قيد يومية',
                documentNo: journalPrintModel.voucherNumber || (savedJournalEntryId ? 'غير مرحل' : 'جديد'),
                documentDate: dateW || new Date().toISOString().slice(0, 10),
                sellerName: companyProfile?.nameAr,
                buyerName: journalPrintModel.description,
                currency: journalPrintModel.currencyCode,
                lines: journalPrintModel.lines.map((line) => ({
                  description: `${line.accountLabel}${line.description ? ` — ${line.description}` : ''}`,
                  quantity: 1,
                  unitPrice: line.debit || line.credit || 0,
                  total: line.debit || line.credit || 0,
                })),
              })
            }
          />
        }
        favoriteHref="/accounting/operations/journal-entry"
        favoriteLabel="قيد يومية"
        onBrowseList={() => setShowList(true)}
        browseListLabel="السابق"
        hideStandalonePost
        navEntity="journal-entry"
        currentId={savedJournalEntryId}
        onNavigate={openJournal}
        standardActions={{
          hasDocument: Boolean(savedJournalEntryId) || Boolean(watchedLines?.length),
          isPosted,
          isCancelled,
          onPost: handlePost,
          postPending: postJournalMutation.isPending,
          onNew: startNewEntry,
          newLabel: 'جديد',
          onEdit: () => {
            if (isCancelled) {
              setError('القيد ملغي ولا يمكن تعديله');
              return;
            }
            if (isPosted) {
              setError('فك الترحيل أولاً من قائمة (...) حتى يمكن التعديل');
              return;
            }
            unlockForEdit();
          },
          isApproved,
          onUnapprove: isApproved
            ? () => unapproveJournalMutation.mutate({})
            : undefined,
          onUnpost: () => unpostJournalMutation.mutate({}),
          unpostPending: unpostJournalMutation.isPending,
          onPrint: triggerPrint,
          printLabel: 'طباعة قيد اليومية',
          onVoid: () => cancelJournalMutation.mutate({}),
          voidLabel: 'إلغاء القيد',
          voidPending: cancelJournalMutation.isPending,
          onRestore: () => restoreJournalMutation.mutate({}),
          restoreLabel: 'استعادة القيد',
          restorePending: restoreJournalMutation.isPending,
        }}
      />

      <DocumentBrowseDrawer open={showList} onClose={() => setShowList(false)} title="القيود السابقة">
        <JournalEntriesListSection
          onSelectEntry={(id) => {
            skipUrlHydrateRef.current = false;
            openJournal(id);
            lockToView();
            setShowList(false);
          }}
        />
      </DocumentBrowseDrawer>

      <DocumentReadOnlyBanner />

      <DocumentApprovalBar
        entityType="JOURNAL_ENTRY"
        entityId={savedJournalEntryId}
        isPosted={isPosted}
        onError={setError}
        onSuccess={setSuccess}
        postPending={postJournalMutation.isPending}
        onPost={handlePost}
      />

      <DocumentFormLock>
      <div data-tour-id="journal-entry-header-fields">
      <ErpFormHeaderCard
        row1={
          <>
            <div>
              <label className={erpLabelClass}>رقم السند</label>
              <input
                type="text"
                autoComplete="off"
                data-1p-ignore="true"
                data-lpignore="true"
                readOnly
                disabled
                className={`${erpInputClass} cursor-not-allowed bg-[#F3F7FA] text-[#64748B]`}
                placeholder="تلقائي"
                value={referenceNumberW || nextJournalNumber}
              />
            </div>
            <div>
              <DatePickerWithHijri
                label="التاريخ"
                value={dateW}
                error={!!errors.date}
                onChange={(next) => {
                  setValue('date', next, { shouldDirty: true, shouldValidate: true });
                  setValue('hijriDate', toHijriDate(next), { shouldDirty: true });
                }}
              />
              <FieldError message={errors.date?.message} />
            </div>
          </>
        }
        row2={
          <>
            <div>
              <label className={erpLabelClass}>الشرح</label>
              <input
                type="text"
                autoComplete="off"
                data-1p-ignore="true"
                data-lpignore="true"
                className={`${erpInputClass} ${errors.description ? inputErrorClass : ''}`}
                placeholder="إدخل الشرح"
                {...register('description')}
              />
              <FieldError message={errors.description?.message} />
            </div>
            <DocumentCurrencyRateFields
              currencies={currencies}
              currencyId={headerCurrencyId}
              exchangeRate={
                headerRateOverride ??
                rateForCurrency(
                  currencies.find((c) => c.id === headerCurrencyId)?.code,
                  companyBaseCurrency,
                  currencies.find((c) => c.id === headerCurrencyId)?.exchangeRate
                )
              }
              companyBaseCode={companyBaseCurrency}
              showRate={showFxColumns}
              disabled={currenciesLoading || isReadOnly || isPosted || isCancelled}
              onCurrencyIdChange={(id, nextRate) => {
                setHeaderRateOverride(null);
                setValue('currencyId', id, { shouldDirty: true, shouldValidate: true });
                const lines = getValues('lines') ?? [];
                if (!lines.length) return;
                replace(lines.map((line) => ({ ...line, currencyId: id, exchangeRate: nextRate })));
              }}
              onExchangeRateChange={(rate) => {
                setHeaderRateOverride(rate);
                const lines = getValues('lines') ?? [];
                if (!lines.length) return;
                replace(lines.map((line) => ({ ...line, exchangeRate: rate })));
              }}
            />
            <FieldError message={errors.currencyId?.message} />
          </>
        }
        extras={
          <div className="flex flex-wrap gap-4 items-center">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={isReadOnly || isPosted || isCancelled}
              onClick={() => setShowRecurringPicker(true)}
            >
              <ClipboardList className="h-4 w-4" aria-hidden />
              استدعاء قيد دوري
            </Button>
            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={isCyclic}
                onChange={(e) => setIsCyclic(e.target.checked)}
                disabled={isReadOnly || isPosted || isCancelled}
                className="rounded border-slate-300"
              />
              سند دوري
            </label>
            <ShowFxColumnsField checked={showFxColumns} onChange={setShowFxColumns} />
          </div>
        }
      />
      </div>

      {linesRootMessage ? (
        <p className="text-red-600 text-sm text-right font-medium mt-2 px-1">{linesRootMessage}</p>
      ) : null}

      <div data-tour-id="journal-entry-lines-table" className="mt-3">
        <JournalLinesTable
          lines={watchedLines ?? []}
          onChange={(next) => replace(next)}
          onAddLine={appendLine}
          disabled={isReadOnly || isPosted || isCancelled}
          currencies={currencies}
          defaultCurrencyId={headerCurrencyId}
          showFx={showFxColumns}
          headerDescription={descriptionW}
          accountLabelFor={(accountId) => {
            const acc = accounts.find((a) => a.id === accountId);
            return acc ? `[${acc.code}] ${acc.arabicName}` : undefined;
          }}
        />
      </div>
      </DocumentFormLock>

      <JournalEntryBottomSplit
        debitTotal={debitTotal}
        creditTotal={creditTotal}
        journalEntryId={savedJournalEntryId}
        currencyCode={companyBaseCurrency}
      />

      <JournalEntryStickyFooter
        debitTotal={debitTotal}
        creditTotal={creditTotal}
        currencyCode={companyBaseCurrency}
        sourceType={sourceKind}
        sourceId={sourceId}
        sourceNumber={sourceNumber}
        onSaveDraft={submitJournal}
        onPost={handlePost}
        onCancel={startNewEntry}
        savePending={financialBusy}
        postPending={postJournalMutation.isPending}
        canSave={!isReadOnly && !isPosted && !isCancelled && !financialBusy}
        canPost={!isPosted && !isCancelled && !financialBusy}
        postRequiresSave={!savedJournalEntryId}
      />

      <RecurringEntryPickerModal
        open={showRecurringPicker}
        onClose={() => setShowRecurringPicker(false)}
        onApply={applyRecurringTemplate}
      />
    </ErpDocumentLayout>
  );
}
