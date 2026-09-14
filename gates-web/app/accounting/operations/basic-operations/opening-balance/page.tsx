'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
import { OpeningBalanceFooter } from '@/components/accounting/opening-balance/OpeningBalanceFooter';
import { useApiMutation, useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';
import { useAccountsQuery, useCurrenciesQuery } from '@/lib/hooks/useMasterDataQueries';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';
import type { ApiError } from '@/lib/api/types';
import { apiClient } from '@/lib/api/client';
import { toHijriDate } from '@/lib/hijri-date';
import { ErpDocumentLayout } from '@/components/erp/ErpDocumentLayout';
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

type OpeningBalanceMeta = {
  openingDate: string;
  hijriDate?: string | null;
  fiscalYearName?: string | null;
  journalEntryId?: string | null;
};

type OpeningStockValuation = {
  totalValuation: number;
  currency: string;
  itemsCount: number;
  warehousesCount: number;
  defaultStockAccountId: string | null;
};

type JournalEntryDetail = {
  id: string;
  date?: string;
  hijriDate?: string | null;
  description?: string | null;
  voucherNumber?: string | null;
  isPosted?: boolean;
  currencyCode?: string;
  version?: number;
  entryType?: string | null;
  lines?: Array<{
    accountId: string;
    description?: string | null;
    debit: number | string;
    credit: number | string;
    exchangeRate?: number | string | null;
    costCenterId?: string | null;
  }>;
};

function todayIso() {
  return new Date().toISOString().split('T')[0];
}

function defaultEntryNumber() {
  return `OB-${new Date().getFullYear()}`;
}

function isInventoryOpeningAccount(
  accountId: string,
  defaultStockAccountId: string | null,
  accounts: Array<{ id: string; code: string; arabicName: string }>
) {
  if (defaultStockAccountId && accountId === defaultStockAccountId) return true;
  const account = accounts.find((a) => a.id === accountId);
  if (!account) return false;
  const code = (account.code || '').replace(/\s/g, '');
  const name = account.arabicName || '';
  return code.startsWith('123') || name.includes('بضاعة أول المدة') || name.includes('مخزون');
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
  const searchParams = useSearchParams();
  const journalEntryIdFromUrl = searchParams.get('id');
  const invalidateQuery = useInvalidateQuery();
  const { lockToView, setMode, unlockForEdit, isReadOnly } = useDocumentMode();
  const { profile: companyProfile } = useCompanyPrintProfile();

  const [lines, setLines] = useState<EditableJournalLine[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showList, setShowList] = useState(false);
  const [isSyncingInventory, setIsSyncingInventory] = useState(false);
  const [savedJournalEntryId, setSavedJournalEntryId] = useState<string | null>(
    () => journalEntryIdFromUrl?.trim() || null
  );
  const [isPosted, setIsPosted] = useState(false);
  const [loadedVersion, setLoadedVersion] = useState<number | undefined>(undefined);
  const postAfterSaveRef = useRef(false);

  const {
    handleSubmit,
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

  const { data: currenciesResponse } = useCurrenciesQuery();
  const currencies = currenciesResponse?.data ?? [];
  const defaultCurrency = currencies.find((c) => c.code === 'EGP') ?? currencies[0];
  const { data: accountsResponse } = useAccountsQuery(undefined, 400, { leafOnly: true });
  const accounts = accountsResponse?.data ?? [];

  const { data: openingMetaResponse, error: openingMetaError } = useApiQuery<OpeningBalanceMeta>(
    ['opening-balance-meta'],
    '/accounting/opening-balance'
  );
  const openingMeta = openingMetaResponse?.data;
  const lockedDate = openingMeta?.openingDate || dateW;
  const lockedHijri = openingMeta?.hijriDate || toHijriDate(lockedDate);

  useEffect(() => {
    const id = journalEntryIdFromUrl?.trim();
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
    if (!loadedJournalEntry) return;
    const locked = openingMeta?.openingDate;
    reset({
      isPosted: loadedJournalEntry.isPosted ?? false,
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
        currencyId: defaultCurrency?.id,
        exchangeRate: Number(line.exchangeRate) || 1,
        costCenterId: line.costCenterId || '',
      }))
    );
    setIsPosted(loadedJournalEntry.isPosted ?? false);
    setLoadedVersion(loadedJournalEntry.version);
  }, [loadedJournalEntry, reset, defaultCurrency?.id, openingMeta?.openingDate, openingMeta?.hijriDate]);

  const totals = useMemo(() => {
    const debit = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
    const credit = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
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

  const journalPrintModel: JournalPrintModel = useMemo(
    () => ({
      voucherNumber: entryNumberW || undefined,
      date: lockedDate ? new Date(lockedDate).toLocaleDateString('ar-EG') : '—',
      description: descriptionW || undefined,
      currencyCode: defaultCurrency?.code ?? 'EGP',
      lines: lines.map((l) => {
        const acc = accounts.find((a) => a.id === l.accountId);
        return {
          accountLabel: acc ? `[${acc.code}] ${acc.arabicName}` : l.accountId || '—',
          description: l.description,
          debit: Number(l.debit) || 0,
          credit: Number(l.credit) || 0,
        };
      }),
      debitTotal: totals.debit,
      creditTotal: totals.credit,
    }),
    [accounts, lockedDate, defaultCurrency?.code, descriptionW, entryNumberW, lines, totals.credit, totals.debit]
  );

  const journalMutation = useApiMutation<JournalEntryDetail, Record<string, unknown>>(
    '/accounting/journal-entries',
    'POST',
    {
      successMessage: 'تم حفظ الرصيد الافتتاحي كمسودة',
      onSuccess: (res) => {
        const id = res?.data?.id;
        if (id) {
          setSavedJournalEntryId(id);
          openEntry(id);
        }
        setIsPosted(false);
        setSuccess('تم حفظ الرصيد الافتتاحي كمسودة');
        invalidateQuery(['journal-entries']);
        if (postAfterSaveRef.current && id) {
          postAfterSaveRef.current = false;
          apiClient
            .post(`/accounting/journal-entries/${id}/post`, {})
            .then(() => {
              setIsPosted(true);
              setSuccess('تم ترحيل قيد الرصيد الافتتاحي');
              invalidateQuery(['journal-entries']);
              lockToView();
            })
            .catch((err: ApiError) => setError(err.message || 'حدث خطأ أثناء الترحيل'));
        }
      },
      onError: (err: ApiError) => setError(err.message || 'حدث خطأ أثناء الحفظ'),
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
        setSuccess('تم حفظ تعديلات الرصيد الافتتاحي');
        invalidateQuery(['journal-entries']);
        invalidateQuery(['journal-entry', savedJournalEntryId]);
      },
      onError: (err: ApiError) => setError(err.message || 'حدث خطأ أثناء التحديث'),
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
      onSuccess: () => {
        setIsPosted(false);
        setSuccess('تم فك ترحيل القيد');
        unlockForEdit();
        invalidateQuery(['journal-entries']);
      },
      onError: (err: ApiError) => setError(err.message || 'حدث خطأ أثناء فك الترحيل'),
    }
  );

  const buildRequestBody = (values: OpeningBalanceHeaderInput) => {
    const currencyCode = defaultCurrency?.code ?? 'EGP';
    const dateIso = openingMeta?.openingDate || values.date || todayIso();
    return {
      date: new Date(`${dateIso}T00:00:00.000Z`).toISOString(),
      hijriDate: openingMeta?.hijriDate || values.hijriDate || toHijriDate(dateIso) || undefined,
      description: values.description.trim(),
      voucherNumber: values.entryNumber || undefined,
      currencyCode,
      entryType: OPENING_ENTRY_TYPE,
      lines: lines.map((line, index) => ({
        accountId: line.accountId,
        description: line.description || undefined,
        debit: line.debit || 0,
        credit: line.credit || 0,
        lineOrder: index + 1,
        exchangeRate: line.exchangeRate || 1,
        costCenterId: line.costCenterId || undefined,
      })),
    };
  };

  const validateLines = () => {
    if (lines.length < 2) {
      setError('أدخل سطرين على الأقل (مدين ودائن) ثم احفظ');
      return false;
    }
    for (let i = 0; i < lines.length; i += 1) {
      const parsed = journalLineSchema.safeParse(lines[i]);
      if (!parsed.success) {
        setError(`سطر ${i + 1}: ${parsed.error.issues[0]?.message || 'بيانات غير مكتملة'}`);
        return false;
      }
    }
    if (Math.abs(totals.diff) > 0.01) {
      setError('يجب أن يتساوى إجمالي المدين مع إجمالي الدائن قبل الحفظ');
      return false;
    }
    return true;
  };

  const onSave: SubmitHandler<OpeningBalanceHeaderInput> = (values) => {
    setError('');
    setSuccess('');
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

  const handlePost = () => {
    setError('');
    if (Math.abs(totals.diff) > 0.01) {
      setError('يجب أن يكون القيد متزناً للترحيل');
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
    postJournalMutation.mutate({});
  };

  const startNewEntry = () => {
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
    setIsPosted(false);
    setLoadedVersion(undefined);
    setError('');
    setSuccess('');
    openEntry(null);
    setMode('create');
  };

  const handleDuplicate = () => {
    const dateIso = openingMeta?.openingDate || todayIso();
    setSavedJournalEntryId(null);
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

      const nextLines = [...lines];
      const existingIndex = nextLines.findIndex((line) =>
        isInventoryOpeningAccount(line.accountId, data.defaultStockAccountId, accounts)
      );
      const patched: EditableJournalLine = {
        accountId: data.defaultStockAccountId,
        description: INVENTORY_SYNC_DESCRIPTION,
        debit: Number(data.totalValuation) || 0,
        credit: 0,
        currencyId: defaultCurrency?.id,
        exchangeRate: 1,
        costCenterId: '',
      };

      if (existingIndex >= 0) {
        nextLines[existingIndex] = {
          ...nextLines[existingIndex],
          ...patched,
          accountId: nextLines[existingIndex].accountId || patched.accountId,
        };
      } else {
        nextLines.push(patched);
      }
      setLines(nextLines);
      setSuccess(
        `تم تحديث قيمة بضاعة أول المدة بنجاح: ${Number(data.totalValuation).toLocaleString('ar-EG')} ج.م (${data.itemsCount} صنف)`
      );
    } catch (err) {
      const apiErr = err as ApiError;
      setError(apiErr.message || 'تعذر تحديث بضاعة أول المدة');
    } finally {
      setIsSyncingInventory(false);
    }
  };

  const onCancel = () => {
    startNewEntry();
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

      <OpeningBalanceHeader
        docNumber={entryNumberW || defaultEntryNumber()}
        isPosted={isPosted}
        isSyncingInventory={isSyncingInventory}
        canSync={!isReadOnly && !isPosted}
        onSyncOpeningInventory={() => void handleSyncOpeningInventory()}
        onSaveDraft={() => void handleSubmit(onSave, onFieldErrors(setError))()}
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
          onEdit: () => {
            if (isPosted) {
              setError('فك الترحيل أولاً من قائمة (...) حتى يمكن التعديل');
              return;
            }
            unlockForEdit();
          },
          onPost: handlePost,
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
          onDuplicate: handleDuplicate,
          postPending: postJournalMutation.isPending,
          onNew: startNewEntry,
          newLabel: 'جديد',
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
      />

      <DocumentBrowseDrawer open={showList} onClose={() => setShowList(false)} title="القيود الافتتاحية السابقة">
        <JournalEntriesListSection
          entryType={OPENING_ENTRY_TYPE}
          hrefBase={OPENING_HREF}
          onSelectEntry={() => {
            lockToView();
            setShowList(false);
          }}
        />
      </DocumentBrowseDrawer>

      <DocumentReadOnlyBanner />

      <DocumentFormLock>
        <div className="mt-3">
          <OpeningBalanceLinesTable
            lines={lines}
            onChange={setLines}
            onAddLine={() => setLines((prev) => [...prev, emptyJournalLine(defaultCurrency?.id)])}
            currencies={currencies}
            defaultCurrencyId={defaultCurrency?.id}
            disabled={isReadOnly || isPosted}
            accountLabelFor={(accountId) => {
              const acc = accounts.find((a) => a.id === accountId);
              return acc ? `[${acc.code}] ${acc.arabicName}` : undefined;
            }}
          />
        </div>
      </DocumentFormLock>

      <OpeningBalanceFooter
        debitTotal={totals.debit}
        creditTotal={totals.credit}
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
