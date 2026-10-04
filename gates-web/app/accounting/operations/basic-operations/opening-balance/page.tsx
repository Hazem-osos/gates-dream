'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useOwnTabSearchParams } from '@/lib/navigation/tab-route-lock';
import dynamic from 'next/dynamic';
import { useForm, type Resolver, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  openingBalanceHeaderSchema,
  journalLineSchema,
  type OpeningBalanceHeaderInput,
} from '@/lib/validation/accounting.schema';
import {
  emptyJournalLine,
  type EditableJournalLine,
} from '@/components/accounting/EditableJournalLinesTable';
import { OpeningBalanceHeader } from '@/components/accounting/opening-balance/OpeningBalanceHeader';
import { OpeningBalanceLinesTable } from '@/components/accounting/opening-balance/OpeningBalanceLinesTable';
import { ShowFxColumnsField } from '@/components/accounting/ShowFxColumnsField';
import { useShowFxColumns } from '@/lib/transaction-settings/useShowFxColumns';
import { OpeningBalanceFooter } from '@/components/accounting/opening-balance/OpeningBalanceFooter';
import { JournalEntryBottomSplit } from '@/components/accounting/journal/JournalEntryBottomSplit';
import { useApiMutation, useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';
import {
  ACCOUNT_PICKER_PAGE_SIZE,
  invalidateTreasuryFundBalances,
  useAccountsQuery,
  useCurrenciesQuery,
} from '@/lib/hooks/useMasterDataQueries';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';
import { toast } from '@/lib/feedback/toast';
import type { ApiError } from '@/lib/api/types';
import { apiClient } from '@/lib/api/client';
import { toHijriDate } from '@/lib/hijri-date';
import { ErpDocumentLayout } from '@/components/erp/ErpDocumentLayout';
import { PageDraftRestoreBanner } from '@/components/erp/PageDraftRestoreBanner';
import { useDraftAutosave } from '@/lib/hooks/useDraftAutosave';
import { DocumentBrowseDrawer } from '@/components/erp/DocumentBrowseDrawer';
import {
  DocumentFormLock,
  DocumentModeProvider,
  DocumentReadOnlyBanner,
  useDocumentMode,
} from '@/components/common/document-shell';
import { useCompanyPrintProfile } from '@/lib/hooks/useCompanyPrintProfile';
import { PrintDocumentButton } from '@/app/components/print/PrintDocumentButton';
import { printOperationalDocument } from '@/lib/print/printOperationalDocument';
import type { JournalPrintModel } from '@/lib/print/types';
import { DynamicChunkSkeleton } from '@/components/ui/DynamicChunkSkeleton';
import { onFieldErrors } from '@/lib/forms/on-field-errors';
import { impliedJournalLineRate, pickCurrencyByCode, resolveJournalLineCurrencyId, toBaseAmount } from '@/lib/accounting/fx-base';
import {
  postJournalAfterSave,
  useRepostAfterUnpost,
} from '@/lib/accounting/ensure-posted-after-save';
import { resolvePostedFlag } from '@/lib/documents/posting-trust';
import { useCompanyBaseCurrency } from '@/lib/hooks/useCompanyBaseCurrency';

const JournalEntriesListSection = dynamic(
  () =>
    import('@/app/components/accounting/JournalEntriesListSection').then((m) => ({
      default: m.JournalEntriesListSection,
    })),
  { ssr: false, loading: () => <DynamicChunkSkeleton label="جاري تحميل القيود الافتتاحية…" /> }
);

const OPENING_ENTRY_TYPE = 'OPENING_BALANCE';
const OPENING_HREF = '/accounting/operations/basic-operations/opening-balance';
const INVENTORY_SYNC_DESCRIPTION = 'بضاعة أول المدة - محدثة آلياً من كشف المخزون';
const PAPERS_SYNC_PREFIX = 'أوراق مالية سابقة';

function openingPaperJournalLines(
  groups: Array<{ accountId: string; direction: 'RECEIPT' | 'PAYMENT'; amount: number }>,
  currencyId?: string,
  exchangeRate = 1
): EditableJournalLine[] {
  return groups.map((group) => ({
    accountId: group.accountId,
    description:
      group.direction === 'PAYMENT'
        ? `${PAPERS_SYNC_PREFIX} - أوراق دفع`
        : `${PAPERS_SYNC_PREFIX} - أوراق قبض`,
    debit: group.direction === 'PAYMENT' ? 0 : Number(group.amount) || 0,
    credit: group.direction === 'PAYMENT' ? Number(group.amount) || 0 : 0,
    currencyId,
    exchangeRate,
    costCenterId: '',
  }));
}

function withoutOpeningPaperLines(current: EditableJournalLine[]): EditableJournalLine[] {
  return current.filter(
    (line) =>
      !(line.description || '').startsWith(PAPERS_SYNC_PREFIX) &&
      (line.accountId || Number(line.debit) || Number(line.credit))
  );
}

type OpeningBalanceMeta = {
  openingDate: string;
  hijriDate?: string | null;
  fiscalYearName?: string | null;
  journalEntryId?: string | null;
  isCancelled?: boolean;
};

type OpeningPaperGroup = {
  accountId: string;
  direction: 'RECEIPT' | 'PAYMENT';
  amount: number;
  count: number;
};

type OpeningPapersTotal = {
  totalAmount: number;
  papersCount: number;
  lines: OpeningPaperGroup[];
};

type OpeningStockValuationGroup = {
  warehouseId: string;
  warehouseName: string;
  accountId: string;
  valuation: number;
};

type OpeningStockValuation = {
  totalValuation: number;
  currency: string;
  itemsCount: number;
  warehousesCount: number;
  defaultStockAccountId: string | null;
  groups?: OpeningStockValuationGroup[];
};

type JournalEntryDetail = {
  id: string;
  date?: string;
  hijriDate?: string | null;
  description?: string | null;
  voucherNumber?: string | null;
  isPosted?: boolean;
  isCancelled?: boolean;
  currencyCode?: string;
  version?: number;
  entryType?: string | null;
  lines?: Array<{
    accountId: string;
    description?: string | null;
    debit: number | string;
    credit: number | string;
    exchangeRate?: number | string | null;
    currencyCode?: string | null;
    debitBase?: number | string | null;
    creditBase?: number | string | null;
    costCenterId?: string | null;
  }>;
};

function todayIso() {
  return new Date().toISOString().split('T')[0];
}

function defaultEntryNumber() {
  return `OB-${new Date().getFullYear()}`;
}

export default function OpeningBalancePage() {
  return (
    <DocumentModeProvider>
      <OpeningBalancePageInner />
    </DocumentModeProvider>
  );
}

function OpeningBalancePageInner() {
  const router = useRouter();
  const searchParams = useOwnTabSearchParams();
  const journalEntryIdFromUrl = searchParams.get('id');
  const invalidateQuery = useInvalidateQuery();
  const { lockToView, setMode, unlockForEdit, isReadOnly } = useDocumentMode();
  const { profile: companyProfile } = useCompanyPrintProfile();

  const [lines, setLines] = useState<EditableJournalLine[]>([]);
  const linesRef = useRef(lines);
  linesRef.current = lines;
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showList, setShowList] = useState(false);
  const { showFx: showFxColumns, setShowFx: setShowFxColumns, resetFxToSetting } = useShowFxColumns(
    'OPENING_BALANCE'
  );
  const [isSyncingInventory, setIsSyncingInventory] = useState(false);
  const [isSyncingPapers, setIsSyncingPapers] = useState(false);
  const [savedJournalEntryId, setSavedJournalEntryId] = useState<string | null>(
    () => journalEntryIdFromUrl?.trim() || null
  );
  const [isPosted, setIsPosted] = useState(false);
  const [isCancelled, setIsCancelled] = useState(false);
  const [loadedVersion, setLoadedVersion] = useState<number | undefined>(undefined);
  const postAfterSaveRef = useRef(false);
  const draftSaveRef = useRef(false);
  const { markUnpostedForEdit, consumeShouldRepost, resetKeepPosted } = useRepostAfterUnpost();

  const {
    handleSubmit,
    getValues,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<OpeningBalanceHeaderInput>({
    resolver: zodResolver(openingBalanceHeaderSchema) as Resolver<OpeningBalanceHeaderInput>,
    defaultValues: {
      isPosted: false,
      entryNumber: defaultEntryNumber(),
      description: '',
      currency: 'جنية مصري',
      date: todayIso(),
      hijriDate: toHijriDate(todayIso()),
    },
    mode: 'onTouched',
  });

  const dateW = watch('date');
  const entryNumberW = watch('entryNumber');
  const descriptionW = watch('description');
  const currencyW = watch('currency');
  const hijriDateW = watch('hijriDate');

  const { data: currenciesResponse } = useCurrenciesQuery();
  const currencies = currenciesResponse?.data ?? [];
  const { code: companyBaseCurrency } = useCompanyBaseCurrency();
  const defaultCurrency = pickCurrencyByCode(currencies, companyBaseCurrency);
  const { data: accountsResponse } = useAccountsQuery(undefined, ACCOUNT_PICKER_PAGE_SIZE, { leafOnly: true });
  const accounts = accountsResponse?.data ?? [];

  const { data: openingMetaResponse, error: openingMetaError } = useApiQuery<OpeningBalanceMeta>(
    ['opening-balance-meta'],
    '/accounting/opening-balance'
  );
  const openingMeta = openingMetaResponse?.data;

  type OpeningDraftSnapshot = {
    header: OpeningBalanceHeaderInput;
    lines: EditableJournalLine[];
  };

  const draftSnapshot = useMemo<OpeningDraftSnapshot>(
    () => ({
      header: {
        isPosted: false,
        entryNumber: entryNumberW || '',
        description: descriptionW || '',
        currency: currencyW || '',
        date: dateW || '',
        hijriDate: hijriDateW || '',
      },
      lines,
    }),
    [currencyW, dateW, descriptionW, entryNumberW, hijriDateW, lines]
  );

  const isOpeningDraftEmpty = useCallback((draft: OpeningDraftSnapshot) => {
    return (
      !draft.header?.description?.trim() &&
      !(draft.lines ?? []).some(
        (line) => line.accountId || Number(line.debit) || Number(line.credit)
      )
    );
  }, []);

  const applyOpeningDraft = useCallback(
    (payload: OpeningDraftSnapshot) => {
      const dateIso = payload?.header?.date || openingMeta?.openingDate || todayIso();
      reset({
        isPosted: false,
        entryNumber: payload?.header?.entryNumber || defaultEntryNumber(),
        description: payload?.header?.description || '',
        currency: payload?.header?.currency || 'جنية مصري',
        date: dateIso,
        hijriDate: payload?.header?.hijriDate || toHijriDate(dateIso),
      });
      setLines(Array.isArray(payload?.lines) ? payload.lines : []);
    },
    [openingMeta?.openingDate, reset]
  );

  const {
    restoreOffer,
    acceptRestore,
    dismissRestore,
    clearDraft,
  } = useDraftAutosave({
    documentType: 'opening-balance',
    value: draftSnapshot,
    enabled: !savedJournalEntryId && !isPosted,
    applyRestore: applyOpeningDraft,
    isEmpty: isOpeningDraftEmpty,
    restoreMessage: 'تم استعادة مسودة القيد الافتتاحي',
  });

  const existingOpeningId = openingMeta?.journalEntryId ?? null;
  const lockedDate = openingMeta?.openingDate || dateW;
  const lockedHijri = openingMeta?.hijriDate || toHijriDate(lockedDate);

  const skipUrlHydrateRef = useRef(false);
  const lastHydratedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const id = journalEntryIdFromUrl?.trim();
    if (skipUrlHydrateRef.current) {
      if (!id) skipUrlHydrateRef.current = false;
      return;
    }
    if (id && id !== savedJournalEntryId) setSavedJournalEntryId(id);
  }, [journalEntryIdFromUrl, savedJournalEntryId]);

  useEffect(() => {
    if (!savedJournalEntryId) {
      setMode('create');
      return;
    }
    if (isPosted) lockToView();
    else if (savedJournalEntryId) setMode('edit');
  }, [isPosted, lockToView, savedJournalEntryId, setMode]);

  useEffect(() => {
    if (!openingMeta?.openingDate) return;
    setValue('date', openingMeta.openingDate, { shouldDirty: false });
    setValue('hijriDate', openingMeta.hijriDate || toHijriDate(openingMeta.openingDate), {
      shouldDirty: false,
    });
  }, [openingMeta?.openingDate, openingMeta?.hijriDate, setValue]);

  useEffect(() => {
    if (!openingMetaError) return;
    setError(openingMetaError.message || 'تعذر تحديد تاريخ الرصيد الافتتاحي');
  }, [openingMetaError]);

  const { data: journalEntryResponse } = useApiQuery<JournalEntryDetail>(
    ['journal-entry', savedJournalEntryId],
    `/accounting/journal-entries/${savedJournalEntryId}`,
    undefined,
    { enabled: !!savedJournalEntryId }
  );
  const loadedJournalEntry = journalEntryResponse?.data;

  useEffect(() => {
    if (!loadedJournalEntry || currencies.length === 0) return;
    const posted = resolvePostedFlag(loadedJournalEntry);
    const hydrateKey = `${loadedJournalEntry.id}:${loadedJournalEntry.version ?? 0}:${posted ? 1 : 0}:${loadedJournalEntry.isCancelled ? 1 : 0}`;
    if (lastHydratedKeyRef.current === hydrateKey) return;
    lastHydratedKeyRef.current = hydrateKey;
    const locked = openingMeta?.openingDate;
    reset({
      isPosted: posted,
      entryNumber: loadedJournalEntry.voucherNumber || defaultEntryNumber(),
      description: loadedJournalEntry.description || '',
      currency: 'جنية مصري',
      date: locked || todayIso(),
      hijriDate: openingMeta?.hijriDate || toHijriDate(locked || todayIso()),
    });
    setLines(
      (loadedJournalEntry.lines ?? []).map((line) => ({
        accountId: line.accountId,
        description: line.description || '',
        debit: Number(line.debit) || 0,
        credit: Number(line.credit) || 0,
        currencyId: resolveJournalLineCurrencyId(
          line,
          defaultCurrency,
          currencies,
          companyBaseCurrency
        ),
        exchangeRate: impliedJournalLineRate(line),
        costCenterId: line.costCenterId || '',
      }))
    );
    setIsPosted(posted);
    setIsCancelled(loadedJournalEntry.isCancelled ?? false);
    setLoadedVersion(loadedJournalEntry.version);
  }, [loadedJournalEntry, reset, defaultCurrency?.id, currencies, companyBaseCurrency, openingMeta?.openingDate, openingMeta?.hijriDate]);

  const totals = useMemo(() => {
    const debit = lines.reduce((s, l) => s + toBaseAmount(l.debit, l.exchangeRate), 0);
    const credit = lines.reduce((s, l) => s + toBaseAmount(l.credit, l.exchangeRate), 0);
    return { debit, credit, diff: debit - credit };
  }, [lines]);

  const openEntry = useCallback(
    (id: string | null) => {
      setSavedJournalEntryId(id);
      if (id) router.replace(`${OPENING_HREF}?id=${id}`, { scroll: false });
      else router.replace(OPENING_HREF, { scroll: false });
    },
    [router]
  );

  useEffect(() => {
    if (savedJournalEntryId || journalEntryIdFromUrl) return;
    if (skipUrlHydrateRef.current) return;
    if (existingOpeningId) openEntry(existingOpeningId);
  }, [existingOpeningId, journalEntryIdFromUrl, openEntry, savedJournalEntryId]);

  const journalPrintModel: JournalPrintModel = useMemo(
    () => ({
      voucherNumber: entryNumberW || undefined,
      date: lockedDate ? new Date(lockedDate).toLocaleDateString('ar-EG') : '—',
      description: descriptionW || undefined,
      currencyCode: companyBaseCurrency,
      lines: lines.map((l) => {
        const acc = accounts.find((a) => a.id === l.accountId);
        return {
          accountLabel: acc ? `[${acc.code}] ${acc.arabicName}` : l.accountId || '—',
          description: l.description,
          debit: toBaseAmount(l.debit, l.exchangeRate),
          credit: toBaseAmount(l.credit, l.exchangeRate),
        };
      }),
      debitTotal: totals.debit,
      creditTotal: totals.credit,
    }),
    [accounts, lockedDate, companyBaseCurrency, descriptionW, entryNumberW, lines, totals.credit, totals.debit]
  );

  const journalMutation = useApiMutation<JournalEntryDetail, Record<string, unknown>>(
    '/accounting/journal-entries',
    'POST',
    {
      successMessage: 'تم حفظ القيد الافتتاحي',
      onSuccess: (res) => {
        const id = res?.data?.id;
        invalidateQuery(['journal-entries']);
        invalidateQuery(['opening-balance-meta']);
        clearDraft();
        if (id) openEntry(id);
        if (draftSaveRef.current) {
          draftSaveRef.current = false;
          setSuccess('تم حفظ القيد الافتتاحي كمسودة. تقدر تكمل وبعدين تحفظه عادياً.');
          return;
        }
        if (postAfterSaveRef.current && id) {
          postAfterSaveRef.current = false;
          apiClient
            .post(`/accounting/journal-entries/${id}/post`, {})
            .then(() => {
              invalidateQuery(['journal-entries']);
              invalidateQuery(['opening-balance-meta']);
              invalidateTreasuryFundBalances(invalidateQuery);
              setSuccess('تم ترحيل قيد الرصيد الافتتاحي');
            })
            .catch((err: ApiError) => setError(err.message || 'حدث خطأ أثناء الترحيل'));
          return;
        }
        setSuccess('تم حفظ القيد الافتتاحي');
      },
      onError: (err: ApiError) => {
        draftSaveRef.current = false;
        postAfterSaveRef.current = false;
        setError(err.message || 'حدث خطأ أثناء الحفظ');
      },
    }
  );

  const journalUpdateMutation = useApiMutation<unknown, Record<string, unknown>>(
    savedJournalEntryId
      ? `/accounting/journal-entries/${savedJournalEntryId}`
      : '/accounting/journal-entries',
    'PUT',
    {
      successMessage: 'تم حفظ تعديلات الرصيد الافتتاحي',
      onSuccess: () => {
        invalidateQuery(['journal-entries']);
        invalidateQuery(['opening-balance-meta']);
        invalidateQuery(['journal-entry', savedJournalEntryId]);
        const id = savedJournalEntryId;
        if (draftSaveRef.current) {
          draftSaveRef.current = false;
          setSuccess('تم حفظ القيد الافتتاحي كمسودة. تقدر تكمل وبعدين تحفظه عادياً.');
          return;
        }
        if (consumeShouldRepost() && id) {
          void postJournalAfterSave(id)
            .then((result) => {
              invalidateQuery(['journal-entries']);
              invalidateQuery(['opening-balance-meta']);
              invalidateQuery(['journal-entry', id]);
              invalidateTreasuryFundBalances(invalidateQuery);
              if (result === 'posted') {
                setIsPosted(true);
                lockToView();
                setSuccess('تم حفظ التعديلات وترحيل القيد');
                return;
              }
              setIsPosted(false);
              setSuccess('تم حفظ تعديلات الرصيد الافتتاحي');
            })
            .catch((err: ApiError) =>
              setError(err.message || 'تم الحفظ لكن تعذر ترحيل القيد')
            );
          return;
        }
        setSuccess('تم حفظ تعديلات الرصيد الافتتاحي');
      },
      onError: (err: ApiError) => {
        draftSaveRef.current = false;
        setError(err.message || 'حدث خطأ أثناء التحديث');
      },
    }
  );

  const postJournalMutation = useApiMutation<unknown, Record<string, never>>(
    savedJournalEntryId
      ? `/accounting/journal-entries/${savedJournalEntryId}/post`
      : '/accounting/journal-entries',
    'POST',
    {
      successMessage: 'تم ترحيل قيد الرصيد الافتتاحي',
      onSuccess: () => {
        setIsPosted(true);
        setSuccess('تم ترحيل قيد الرصيد الافتتاحي');
        invalidateQuery(['journal-entries']);
        invalidateTreasuryFundBalances(invalidateQuery);
        lockToView();
      },
      onError: (err: ApiError) => setError(err.message || 'حدث خطأ أثناء الترحيل'),
    }
  );

  const unpostJournalMutation = useApiMutation<unknown, Record<string, never>>(
    savedJournalEntryId
      ? `/accounting/journal-entries/${savedJournalEntryId}/unpost`
      : '/accounting/journal-entries',
    'POST',
    {
      onSuccess: (res) => {
        const id = savedJournalEntryId;
        const row = (res as { data?: { version?: number } } | undefined)?.data;
        setIsPosted(false);
        if (id) {
          lastHydratedKeyRef.current = `${id}:${row?.version ?? loadedVersion ?? 0}:0:0`;
        }
        markUnpostedForEdit();
        setSuccess('تم فك ترحيل القيد');
        unlockForEdit();
        invalidateQuery(['journal-entries']);
        invalidateQuery(['journal-entry', savedJournalEntryId]);
        invalidateTreasuryFundBalances(invalidateQuery);
      },
      onError: (err: ApiError) => setError(err.message || 'حدث خطأ أثناء فك الترحيل'),
    }
  );

  const buildRequestBody = (values: OpeningBalanceHeaderInput) => {
    const currencyCode = defaultCurrency?.code ?? companyBaseCurrency;
    const dateIso = openingMeta?.openingDate || values.date || todayIso();
    return {
      date: new Date(`${dateIso}T00:00:00.000Z`).toISOString(),
      hijriDate: openingMeta?.hijriDate || values.hijriDate || toHijriDate(dateIso) || undefined,
      description: values.description.trim(),
      voucherNumber: values.entryNumber || undefined,
      currencyCode,
      entryType: OPENING_ENTRY_TYPE,
      lines: linesRef.current
        .filter((line) => line.accountId || Number(line.debit) || Number(line.credit))
        .map((line, index) => ({
        accountId: line.accountId,
        description: line.description || undefined,
        debit: line.debit || 0,
        credit: line.credit || 0,
        lineOrder: index + 1,
        exchangeRate: line.exchangeRate || 1,
        currencyCode: currencies.find((c) => c.id === line.currencyId)?.code,
        debitBase: toBaseAmount(line.debit, line.exchangeRate),
        creditBase: toBaseAmount(line.credit, line.exchangeRate),
        costCenterId: line.costCenterId || undefined,
      })),
    };
  };

  const validateLines = () => {
    const filled = lines.filter(
      (line) => line.accountId || Number(line.debit) || Number(line.credit)
    );
    if (filled.length < 2) {
      setError('أدخل سطرين على الأقل (مدين ودائن) ثم احفظ');
      return false;
    }
    const debit = filled.reduce((sum, line) => sum + toBaseAmount(line.debit, line.exchangeRate), 0);
    const credit = filled.reduce((sum, line) => sum + toBaseAmount(line.credit, line.exchangeRate), 0);
    if (Math.abs(debit - credit) > 0.01) {
      const message = `القيد غير متزن: إجمالي المدين ${debit.toLocaleString('ar-EG')} لا يساوي إجمالي الدائن ${credit.toLocaleString('ar-EG')}`;
      setError(message);
      toast.error('القيد غير متزن', {
        id: 'gates-form-error',
        description: message,
        duration: 6000,
      });
      return false;
    }
    for (let i = 0; i < filled.length; i += 1) {
      const parsed = journalLineSchema.safeParse(filled[i]);
      if (!parsed.success) {
        setError(`سطر ${i + 1}: ${parsed.error.issues[0]?.message || 'بيانات غير مكتملة'}`);
        return false;
      }
    }
    return true;
  };

  const usableLines = () =>
    lines.filter((line) => {
      const debit = Number(line.debit) || 0;
      const credit = Number(line.credit) || 0;
      return Boolean(line.accountId) && (debit > 0) !== (credit > 0);
    });

  const validateDraftLines = () => {
    const filled = usableLines();
    if (filled.length < 1) {
      setError('أدخل سطراً واحداً على الأقل بحساب ومبلغ، ثم احفظ المسودة');
      return false;
    }
    for (let i = 0; i < filled.length; i += 1) {
      const parsed = journalLineSchema.safeParse(filled[i]);
      if (!parsed.success) {
        setError(`سطر ${i + 1}: ${parsed.error.issues[0]?.message || 'بيانات غير مكتملة'}`);
        return false;
      }
    }
    return true;
  };

  const onSave: SubmitHandler<OpeningBalanceHeaderInput> = (values) => {
    setError('');
    setSuccess('');
    draftSaveRef.current = false;
    if (isPosted) {
      postAfterSaveRef.current = false;
      setError('فك الترحيل أولاً من قائمة (...) حتى يمكن التعديل');
      return;
    }
    if (!validateLines()) {
      postAfterSaveRef.current = false;
      return;
    }
    const body = buildRequestBody(values);
    if (savedJournalEntryId) {
      journalUpdateMutation.mutate({ ...body, expectedVersion: loadedVersion });
      return;
    }
    journalMutation.mutate(body);
  };

  const onSaveAsDraft: SubmitHandler<OpeningBalanceHeaderInput> = (values) => {
    setError('');
    setSuccess('');
    postAfterSaveRef.current = false;
    if (isPosted) {
      draftSaveRef.current = false;
      setError('فك الترحيل أولاً من قائمة (...) حتى يمكن التعديل');
      return;
    }
    if (!validateDraftLines()) {
      draftSaveRef.current = false;
      return;
    }
    draftSaveRef.current = true;
    const body = {
      ...buildRequestBody(values),
      lines: usableLines().map((line, index) => ({
        accountId: line.accountId,
        description: line.description || undefined,
        debit: line.debit || 0,
        credit: line.credit || 0,
        lineOrder: index + 1,
        exchangeRate: line.exchangeRate || 1,
        currencyCode: currencies.find((c) => c.id === line.currencyId)?.code,
        debitBase: toBaseAmount(line.debit, line.exchangeRate),
        creditBase: toBaseAmount(line.credit, line.exchangeRate),
        costCenterId: line.costCenterId || undefined,
      })),
      saveAsDraft: true,
    };
    if (savedJournalEntryId) {
      journalUpdateMutation.mutate({ ...body, expectedVersion: loadedVersion });
      return;
    }
    journalMutation.mutate(body);
  };

  const handlePost = async () => {
    setError('');
    if (isCancelled) {
      setError('القيد ملغي. استرجعه من قائمة (...) قبل الترحيل.');
      return;
    }
    let nextLines = linesRef.current;
    try {
      const res = await apiClient.get<OpeningPapersTotal>('/accounting/securities-receipts/opening-total');
      const groups = res.data?.lines ?? [];
      nextLines = [
        ...withoutOpeningPaperLines(linesRef.current),
        ...openingPaperJournalLines(
          groups,
          defaultCurrency?.id,
          Number(defaultCurrency?.exchangeRate) || 1
        ),
      ];
      linesRef.current = nextLines;
      setLines(nextLines);
    } catch (err) {
      const apiErr = err as ApiError;
      setError(apiErr.message || 'تعذر تحديث شيكات الأوراق السابقة قبل الترحيل');
      return;
    }
    const filled = nextLines.filter(
      (line) => line.accountId || Number(line.debit) || Number(line.credit)
    );
    const debit = filled.reduce((sum, line) => sum + toBaseAmount(line.debit, line.exchangeRate), 0);
    const credit = filled.reduce((sum, line) => sum + toBaseAmount(line.credit, line.exchangeRate), 0);
    if (Math.abs(debit - credit) > 0.01) {
      const message =
        'اتحدثت شيكات الأوراق السابقة والقيد بقى غير متزن. ظبّط الطرف المقابل ثم رحّل تاني.';
      setError(message);
      toast.error('القيد غير متزن', { id: 'gates-form-error', description: message, duration: 6000 });
      return;
    }
    if (!savedJournalEntryId) {
      postAfterSaveRef.current = true;
      void handleSubmit(onSave, (errs) => {
        postAfterSaveRef.current = false;
        onFieldErrors(setError)(errs);
      })();
      return;
    }
    try {
      const body = buildRequestBody(getValues());
      const updated = await apiClient.put<JournalEntryDetail>(
        `/accounting/journal-entries/${savedJournalEntryId}`,
        { ...body, expectedVersion: loadedVersion }
      );
      if (updated.data?.version != null) setLoadedVersion(updated.data.version);
      await apiClient.post(`/accounting/journal-entries/${savedJournalEntryId}/post`, {});
      setIsPosted(true);
      lockToView();
      setSuccess('تم ترحيل قيد الرصيد الافتتاحي بعد تحديث شيكات الأوراق السابقة');
      invalidateQuery(['journal-entries']);
      invalidateQuery(['opening-balance-meta']);
      invalidateQuery(['journal-entry', savedJournalEntryId]);
      invalidateTreasuryFundBalances(invalidateQuery);
    } catch (err) {
      const apiErr = err as ApiError;
      setError(apiErr.message || 'تعذر ترحيل قيد الرصيد الافتتاحي');
    }
  };

  const startNewEntry = () => {
    if (existingOpeningId) {
      setError('يوجد قيد افتتاحي بالفعل. عدّل نفس القيد أو استرجعه إن كان ملغياً.');
      return;
    }
    const dateIso = openingMeta?.openingDate || todayIso();
    reset({
      isPosted: false,
      entryNumber: defaultEntryNumber(),
      description: '',
      currency: 'جنية مصري',
      date: dateIso,
      hijriDate: openingMeta?.hijriDate || toHijriDate(dateIso),
    });
    setLines([]);
    resetFxToSetting();
    setIsPosted(false);
    setIsCancelled(false);
    resetKeepPosted();
    setLoadedVersion(undefined);
    setError('');
    setSuccess('');
    skipUrlHydrateRef.current = true;
    lastHydratedKeyRef.current = null;
    openEntry(null);
    setMode('create');
    clearDraft();
  };

  const handleDuplicate = () => {
    const dateIso = openingMeta?.openingDate || todayIso();
    lastHydratedKeyRef.current = null;
    setSavedJournalEntryId(null);
    resetKeepPosted();
    setIsPosted(false);
    setLoadedVersion(undefined);
    setValue('entryNumber', defaultEntryNumber());
    setValue('date', dateIso);
    setValue('hijriDate', openingMeta?.hijriDate || toHijriDate(dateIso));
    setValue('isPosted', false);
    router.replace(OPENING_HREF, { scroll: false });
    setMode('create');
    setSuccess('تم تكرار القيد — راجع البيانات ثم احفظ');
  };

  const handleSyncOpeningInventory = async () => {
    if (isPosted || isReadOnly) return;
    setIsSyncingInventory(true);
    setError('');
    try {
      const res = await apiClient.get<OpeningStockValuation>(
        '/inventory/opening-stock/total-valuation'
      );
      const data = res.data;
      if (!data) {
        setError('تعذر قراءة قيمة بضاعة أول المدة');
        return;
      }
      if (!data.defaultStockAccountId) {
        setError('لم يتم تحديد حساب مخزون بضاعة أول المدة. اضبط حساب المخزون من إعدادات الشركة.');
        return;
      }

      const groups =
        data.groups?.filter((row) => row.accountId && Number(row.valuation) > 0) ?? [];
      if (!groups.length) {
        setError('لا توجد بضاعة أول المدة مرحّلة لأي مخزن.');
        return;
      }

      const withoutInventorySync = lines.filter(
        (line) => !(line.description || '').startsWith(INVENTORY_SYNC_DESCRIPTION)
      );
      const imported: EditableJournalLine[] = groups.map((group) => ({
        accountId: group.accountId,
        description: `${INVENTORY_SYNC_DESCRIPTION} — ${group.warehouseName}`,
        debit: Number(group.valuation) || 0,
        credit: 0,
        currencyId: defaultCurrency?.id,
        exchangeRate: Number(defaultCurrency?.exchangeRate) || 1,
        costCenterId: '',
      }));
      setLines([...withoutInventorySync, ...imported]);
      setSuccess(
        `تم تحميل بضاعة أول المدة على ${groups.length} طرف (مخزن): ${Number(data.totalValuation).toLocaleString('ar-EG')} ${companyBaseCurrency} (${data.itemsCount} صنف)`
      );
    } catch (err) {
      const apiErr = err as ApiError;
      setError(apiErr.message || 'تعذر تحديث بضاعة أول المدة');
    } finally {
      setIsSyncingInventory(false);
    }
  };

  const handleSyncOpeningPapers = async () => {
    if (isPosted || isReadOnly) return;
    setIsSyncingPapers(true);
    setError('');
    try {
      const res = await apiClient.get<OpeningPapersTotal>('/accounting/securities-receipts/opening-total');
      const data = res.data;
      if (!data) {
        setError('تعذر قراءة قيمة الأوراق المالية السابقة');
        return;
      }
      if (!data.papersCount || !data.lines?.length) {
        setError('لا توجد شيكات في شاشة الأوراق المالية السابقة.');
        return;
      }

      const imported = openingPaperJournalLines(
        data.lines,
        defaultCurrency?.id,
        Number(defaultCurrency?.exchangeRate) || 1
      );
      const nextLines = [...withoutOpeningPaperLines(linesRef.current), ...imported];
      linesRef.current = nextLines;
      setLines(nextLines);
      setSuccess(
        `تم استيراد الأوراق المالية السابقة على ${imported.length} حساب: ${Number(data.totalAmount).toLocaleString('ar-EG')} ${companyBaseCurrency} (${data.papersCount} شيك)`
      );
    } catch (err) {
      const apiErr = err as ApiError;
      setError(apiErr.message || 'تعذر تحميل الأوراق المالية السابقة');
    } finally {
      setIsSyncingPapers(false);
    }
  };

  const handleVoid = async () => {
    if (!savedJournalEntryId) return;
    if (isPosted) {
      setError('فك الترحيل أولاً من قائمة (...) ثم ألغِ القيد.');
      return;
    }
    try {
      await apiClient.post(`/accounting/journal-entries/${savedJournalEntryId}/cancel`, {});
      setIsCancelled(true);
      unlockForEdit();
      invalidateQuery(['journal-entries']);
      invalidateQuery(['opening-balance-meta']);
      invalidateQuery(['journal-entry', savedJournalEntryId]);
      setSuccess('تم إلغاء نفس القيد. الأطراف موجودة وتقدر تعدّلها — «جديد» مقفول.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر إلغاء القيد');
    }
  };

  const handleRestore = async () => {
    if (!savedJournalEntryId) return;
    try {
      await apiClient.post(`/accounting/journal-entries/${savedJournalEntryId}/restore`, {});
      setIsCancelled(false);
      invalidateQuery(['journal-entries']);
      invalidateQuery(['opening-balance-meta']);
      invalidateQuery(['journal-entry', savedJournalEntryId]);
      setSuccess('تم استعادة نفس القيد الافتتاحي');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر استعادة القيد');
    }
  };

  const onCancel = () => {
    void handleVoid();
  };

  const financialBusy =
    journalMutation.isPending ||
    journalUpdateMutation.isPending ||
    postJournalMutation.isPending ||
    unpostJournalMutation.isPending;

  return (
    <ErpDocumentLayout>
      {error ? <ErrorToast message={error} onClose={() => setError('')} /> : null}
      {success ? <SuccessToast message={success} onClose={() => setSuccess('')} /> : null}
      {restoreOffer && !savedJournalEntryId ? (
        <PageDraftRestoreBanner
          message="يوجد مسودة قيد افتتاحي غير محفوظة. اضغط استعادة لإرجاعها."
          onRestore={() => {
            const payload = acceptRestore();
            if (!payload) return;
            applyOpeningDraft(payload);
            setSuccess('تم استعادة مسودة القيد الافتتاحي');
          }}
          onDismiss={dismissRestore}
        />
      ) : null}

      <OpeningBalanceHeader
        docNumber={entryNumberW || defaultEntryNumber()}
        isPosted={isPosted}
        isSyncingInventory={isSyncingInventory}
        isSyncingPapers={isSyncingPapers}
        canSync={!isReadOnly && !isPosted}
        onSyncOpeningInventory={() => void handleSyncOpeningInventory()}
        onSyncOpeningPapers={() => void handleSyncOpeningPapers()}
        onSaveDraft={() => void handleSubmit(onSave, onFieldErrors(setError))()}
        onSaveAsDraft={() => void handleSubmit(onSaveAsDraft, onFieldErrors(setError))()}
        savePending={financialBusy}
        canSave={!isReadOnly && !isPosted && !financialBusy}
        onBrowseList={() => setShowList(true)}
        currentId={savedJournalEntryId}
        onNavigate={openEntry}
        printTrigger={
          <PrintDocumentButton
            label="طباعة قيد اليومية"
            disabled={!lines.length}
            onPrintLayout={() =>
              printOperationalDocument({
                title: 'قيد افتتاحي',
                documentNo: journalPrintModel.voucherNumber || 'مسودة',
                documentDate: lockedDate || new Date().toISOString().slice(0, 10),
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
        standardActions={{
          hasDocument: Boolean(savedJournalEntryId),
          isPosted,
          isCancelled,
          allowEditWhenCancelled: true,
          onEdit: () => {
            if (isPosted) {
              setError('فك الترحيل أولاً من قائمة (...) حتى يمكن التعديل');
              return;
            }
            unlockForEdit();
          },
          onPost: handlePost,
          onVoid: () => void handleVoid(),
          onRestore: () => void handleRestore(),
          voidLabel: 'إلغاء القيد',
          restoreLabel: 'استعادة القيد',
          restoreConfirmMessage:
            'سيتم استعادة نفس القيد الافتتاحي. لو فيه قيد افتتاحي تاني شغال لازم تلغيه الأول.',
          onUnapprove: () => {
            if (!savedJournalEntryId) return;
            void apiClient
              .post(`/accounting/journal-entries/${savedJournalEntryId}/unapprove`, {})
              .then(() => setSuccess('تم إلغاء اعتماد القيد'))
              .catch((err: unknown) =>
                setError(err instanceof Error ? err.message : 'تعذر إلغاء الاعتماد')
              );
          },
          onUnpost: () => unpostJournalMutation.mutate({}),
          onPrint: () => {
            if (!lines.length) return;
            void printOperationalDocument({
              title: 'قيد افتتاحي',
              documentNo: journalPrintModel.voucherNumber || 'مسودة',
              documentDate: lockedDate || new Date().toISOString().slice(0, 10),
              sellerName: companyProfile?.nameAr,
              buyerName: journalPrintModel.description,
              currency: journalPrintModel.currencyCode,
              lines: journalPrintModel.lines.map((line) => ({
                description: `${line.accountLabel}${line.description ? ` — ${line.description}` : ''}`,
                quantity: 1,
                unitPrice: line.debit || line.credit || 0,
                total: line.debit || line.credit || 0,
              })),
            });
          },
          onDuplicate: existingOpeningId ? undefined : handleDuplicate,
          postPending: postJournalMutation.isPending,
          onNew: startNewEntry,
          newLabel: 'جديد',
          newDisabled: Boolean(existingOpeningId || savedJournalEntryId),
          newHint: 'يوجد قيد افتتاحي بالفعل. عدّل نفس القيد أو استرجعه إن كان ملغياً.',
        }}
        openingDate={lockedDate}
        hijriDate={lockedHijri}
        fiscalYearName={openingMeta?.fiscalYearName || undefined}
        entryNumber={entryNumberW || ''}
        onEntryNumberChange={(v) => setValue('entryNumber', v, { shouldDirty: true })}
        description={descriptionW || ''}
        onDescriptionChange={(v) => setValue('description', v, { shouldDirty: true })}
        descriptionError={errors.description?.message}
        currency={currencyW || 'جنية مصري'}
        onCurrencyChange={(v) => setValue('currency', v, { shouldDirty: true })}
        readOnly={isReadOnly || isPosted}
        isCancelled={isCancelled}
      />

      <DocumentBrowseDrawer open={showList} onClose={() => setShowList(false)} title="القيود الافتتاحية السابقة">
        <JournalEntriesListSection
          entryType={OPENING_ENTRY_TYPE}
          hrefBase={OPENING_HREF}
          onSelectEntry={(id) => {
            openEntry(id);
            lockToView();
            setShowList(false);
          }}
        />
      </DocumentBrowseDrawer>

      <DocumentReadOnlyBanner />
      {isCancelled ? (
        <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-800">
          القيد ملغي على نفس الرقم. الأطراف موجودة وتقدر تعدّلها. «جديد» مقفول — استرجع هذا القيد من قائمة (...). لو فيه قيد افتتاحي تاني شغال، ألغِه الأول.
        </div>
      ) : null}

      <DocumentFormLock>
        <div className="mt-3">
          <div className="mb-2">
            <ShowFxColumnsField checked={showFxColumns} onChange={setShowFxColumns} />
          </div>
          <OpeningBalanceLinesTable
            lines={lines}
            onChange={setLines}
            onAddLine={() =>
              setLines((prev) => [
                ...prev,
                { ...emptyJournalLine(defaultCurrency?.id), description: descriptionW || '' },
              ])
            }
            currencies={currencies}
            defaultCurrencyId={defaultCurrency?.id}
            showFx={showFxColumns}
            disabled={isReadOnly || isPosted}
            headerDescription={descriptionW}
            accountLabelFor={(accountId) => {
              const acc = accounts.find((a) => a.id === accountId);
              return acc ? `[${acc.code}] ${acc.arabicName}` : undefined;
            }}
          />
        </div>
      </DocumentFormLock>

      <JournalEntryBottomSplit
        debitTotal={totals.debit}
        creditTotal={totals.credit}
        journalEntryId={savedJournalEntryId}
        currencyCode={companyBaseCurrency}
      />

      <OpeningBalanceFooter
        debitTotal={totals.debit}
        creditTotal={totals.credit}
        currencyCode={companyBaseCurrency}
        journalEntryId={savedJournalEntryId}
        journalNumber={loadedJournalEntry?.voucherNumber}
        onSaveDraft={() => void handleSubmit(onSave, onFieldErrors(setError))()}
        onPost={handlePost}
        onCancel={onCancel}
        savePending={financialBusy}
        postPending={postJournalMutation.isPending}
        canSave={!isReadOnly && !isPosted && !financialBusy}
        canPost={!isPosted && !financialBusy}
      />
    </ErpDocumentLayout>
  );
}
