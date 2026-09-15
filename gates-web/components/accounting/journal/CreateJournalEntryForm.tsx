'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
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
import { useRouter, useSearchParams } from 'next/navigation';
import { useApiQuery, useApiMutation, useInvalidateQuery } from '@/lib/hooks/useApi';
import type { ApiError } from '@/lib/api/types';
import { dispatchAcademyTrigger } from '@/lib/onboarding/tourCheckpoints';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';
import { toastVersionConflict } from '@/lib/feedback/toast';
import {
  journalEntrySchema,
  type JournalEntryFormValues,
} from '@/lib/validation/accounting.schema';
import { useAccountsQuery, useCurrenciesQuery } from '@/lib/hooks/useMasterDataQueries';
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
import { onFieldErrors } from '@/lib/forms/on-field-errors';
import { resolveJournalSourceKind, type JournalSourceType } from '@/lib/accounting/journal-source';

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
  isCyclic?: boolean;
  isRecurring?: boolean;
  isPosted?: boolean;
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
  const searchParams = useSearchParams();
  const journalEntryIdFromUrl = searchParams.get('id');

  const [showList, setShowList] = useState(false);
  const [isCyclic, setIsCyclic] = useState(true);
  const [isPosted, setIsPosted] = useState(false);
  const [isCancelled, setIsCancelled] = useState(false);
  const [isApproved, setIsApproved] = useState(false);
  const [voucherStatus, setVoucherStatus] = useState('غير مرحل');
  const [showRecurringPicker, setShowRecurringPicker] = useState(false);
  const [sourceKind, setSourceKind] = useState<JournalSourceType>('MANUAL');
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [sourceNumber, setSourceNumber] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [savedJournalEntryId, setSavedJournalEntryId] = useState<string | null>(
    () => journalEntryIdFromUrl?.trim() || null
  );
  const [loadedVersion, setLoadedVersion] = useState<number | undefined>(undefined);

  useEffect(() => {
    const id = journalEntryIdFromUrl?.trim();
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

  const { data: journalEntryResponse } = useApiQuery<JournalEntryDetail>(
    ['journal-entry', savedJournalEntryId],
    `/accounting/journal-entries/${savedJournalEntryId}`,
    undefined,
    { enabled: !!savedJournalEntryId }
  );
  const loadedJournalEntry = journalEntryResponse?.data;

  useEffect(() => {
    if (!loadedJournalEntry || currencies.length === 0) return;
    const currency =
      currencies.find((c) => c.code === loadedJournalEntry.currencyCode) ?? currencies[0];
    reset({
      date: loadedJournalEntry.date
        ? new Date(loadedJournalEntry.date).toISOString().split('T')[0]
        : '',
      referenceNumber: loadedJournalEntry.voucherNumber || '',
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
    setIsCyclic(loadedJournalEntry.isCyclic ?? true);
    setIsPosted(loadedJournalEntry.isPosted ?? false);
    setIsCancelled(loadedJournalEntry.isCancelled ?? false);
    setIsApproved(loadedJournalEntry.isApproved ?? false);
    setVoucherStatus(
      loadedJournalEntry.isCancelled ? 'ملغي' : loadedJournalEntry.isPosted ? 'مرحل' : 'غير مرحل'
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
      onSuccess: (res) => {
        const id = (res as { data?: { id?: string } })?.data?.id;
        if (id) {
          setSavedJournalEntryId(id);
          setIsPosted(false);
          setVoucherStatus('غير مرحل');
          router.replace(`/accounting/operations/journal-entry?id=${id}`, { scroll: false });
        }
        setSuccess('تم حفظ القيد بنجاح');
        invalidateQuery(['journal-entries']);
        if (id) invalidateQuery(['journal-entry', id]);
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
        setSuccess('تم حفظ التعديلات بنجاح');
        invalidateQuery(['journal-entries']);
        invalidateQuery(['journal-entry', savedJournalEntryId]);
      },
      onError: (error: ApiError) => {
        if (error.code === '409') {
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
        setSuccess('تم فك ترحيل القيد');
        unlockForEdit();
        invalidateQuery(['journal-entries']);
        invalidateQuery(['journal-entry', savedJournalEntryId]);
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
      const defaultCurrency = currencies.find((c) => c.code === 'EGP') || currencies[0];
      setValue('currencyId', defaultCurrency.id, { shouldDirty: false });
    }
  }, [currencies, headerCurrencyId, setValue]);

  const debitTotal =
    watchedLines?.reduce((sum, line) => sum + (Number(line?.debit) || 0), 0) ?? 0;
  const creditTotal =
    watchedLines?.reduce((sum, line) => sum + (Number(line?.credit) || 0), 0) ?? 0;

  const { data: accountsResponse } = useAccountsQuery();
  const accounts = useMemo(() => accountsResponse?.data ?? [], [accountsResponse?.data]);
  const { profile: companyProfile } = useCompanyPrintProfile();
  const referenceNumberW = watch('referenceNumber');
  const dateW = watch('date');
  const descriptionW = watch('description');
  const headerCurrencyCode = currencies.find((c) => c.id === headerCurrencyId)?.code ?? 'EGP';

  useEffect(() => {
    if (!dateW) return;
    const hijri = toHijriDate(dateW);
    if (hijri && hijri !== getValues('hijriDate')) {
      setValue('hijriDate', hijri, { shouldDirty: false });
    }
  }, [dateW, getValues, setValue]);

  const journalPrintModel: JournalPrintModel = useMemo(() => {
    const cur = currencies.find((c) => c.id === headerCurrencyId);
    return {
      voucherNumber: referenceNumberW || undefined,
      date: dateW ? new Date(dateW).toLocaleDateString('ar-EG') : '—',
      description: descriptionW || undefined,
      currencyCode: cur?.code ?? 'EGP',
      lines: (watchedLines ?? []).map((l) => {
        const acc = accounts.find((a) => a.id === l.accountId);
        return {
          accountLabel: acc ? `[${acc.code}] ${acc.arabicName}` : l.accountId || '—',
          description: l.description,
          debit: Number(l.debit) || 0,
          credit: Number(l.credit) || 0,
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
    headerCurrencyId,
    currencies,
    debitTotal,
    creditTotal,
  ]);

  const linesRootMessage =
    errors.lines && typeof errors.lines === 'object' && 'message' in errors.lines && errors.lines.message
      ? String(errors.lines.message)
      : undefined;

  const onValidSubmit = (data: JournalEntryFormValues) => {
    if (financialBusy) return;
    setError('');
    setSuccess('');
    const headerCurrency = currencies.find((c) => c.id === data.currencyId);
    const currencyCode = headerCurrency?.code ?? 'EGP';
    const requestBody: JournalEntryApiBody = {
      date: new Date(data.date).toISOString(),
      hijriDate: data.hijriDate || toHijriDate(data.date) || undefined,
      description: data.description.trim(),
      voucherNumber: data.referenceNumber || undefined,
      isCyclic,
      isRecurring: sourceKind === 'RECURRING_TEMPLATE',
      sourceType: sourceKind,
      sourceId: sourceId || undefined,
      sourceNumber: sourceNumber || undefined,
      currencyCode,
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
      debitSum += Number(line?.debit) || 0;
      creditSum += Number(line?.credit) || 0;
    }
    const diff = debitSum - creditSum;
    append({
      accountId: '',
      description: '',
      debit: diff < -0.005 ? Math.round(Math.abs(diff) * 100) / 100 : 0,
      credit: diff > 0.005 ? Math.round(diff * 100) / 100 : 0,
      currencyId: cur || undefined,
      exchangeRate: 1,
      costCenterId: '',
      isTiedToInvoice: false,
      invoiceId: null,
      invoiceNumber: null,
    });
  }, [append, getValues]);

  const applyRecurringTemplate = (template: RecurringTemplate) => {
    const cur = getValues('currencyId');
    replace(
      (template.lines ?? []).map((line) => ({
        accountId: line.accountId,
        description: line.description || '',
        debit: Number(line.debit) || 0,
        credit: Number(line.credit) || 0,
        currencyId: cur || undefined,
        exchangeRate: 1,
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
    setSavedJournalEntryId(null);
    setLoadedVersion(undefined);
    setIsPosted(false);
    setIsCancelled(false);
    setIsApproved(false);
    setVoucherStatus('غير مرحل');
    setError('');
    setSuccess('');
    setMode('create');
    if (journalEntryIdFromUrl) {
      router.replace('/accounting/operations/journal-entry');
    }
  };

  const handleDuplicate = () => {
    setSavedJournalEntryId(null);
    setLoadedVersion(undefined);
    setIsPosted(false);
    setIsCancelled(false);
    setIsApproved(false);
    setVoucherStatus('غير مرحل');
    setSourceKind('MANUAL');
    setSourceId(null);
    setSourceNumber(null);
    setValue('referenceNumber', '', { shouldDirty: true });
    router.replace('/accounting/operations/journal-entry', { scroll: false });
    setMode('create');
    setSuccess('تم تكرار القيد — راجع البيانات ثم احفظ');
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
        onSaveDraft={() => void handleSubmit(onValidSubmit, onFieldErrors(setError))()}
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
          onUnapprove: () => unapproveJournalMutation.mutate({}),
          onUnpost: () => unpostJournalMutation.mutate({}),
          unpostPending: unpostJournalMutation.isPending,
          onPrint: triggerPrint,
          printLabel: 'طباعة قيد اليومية',
          onDuplicate: handleDuplicate,
          duplicateLabel: 'تكرار القيد',
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
          onSelectEntry={() => {
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
                className={`${erpInputClass} ${errors.referenceNumber ? inputErrorClass : ''}`}
                placeholder="إدخل رقم السند"
                {...register('referenceNumber')}
              />
              <FieldError message={errors.referenceNumber?.message} />
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
            <div className="lg:col-span-3">
              <label className={erpLabelClass}>الشرح</label>
              <input
                type="text"
                className={`${erpInputClass} ${errors.description ? inputErrorClass : ''}`}
                placeholder="إدخل الشرح"
                {...register('description')}
              />
              <FieldError message={errors.description?.message} />
            </div>
            <div>
              <label className={erpLabelClass}>العملة</label>
              <select
                className={`${erpInputClass} ${errors.currencyId ? inputErrorClass : ''}`}
                disabled={currenciesLoading}
                {...register('currencyId')}
              >
                <option value="">اختر العملة</option>
                {currencies.map((currency) => (
                  <option key={currency.id} value={currency.id}>
                    {currency.arabicName || currency.englishName || currency.code}
                  </option>
                ))}
              </select>
              <FieldError message={errors.currencyId?.message} />
            </div>
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
      />

      <JournalEntryStickyFooter
        debitTotal={debitTotal}
        creditTotal={creditTotal}
        currencyCode={headerCurrencyCode}
        sourceType={sourceKind}
        sourceId={sourceId}
        sourceNumber={sourceNumber}
        onSaveDraft={() => void handleSubmit(onValidSubmit, onFieldErrors(setError))()}
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
