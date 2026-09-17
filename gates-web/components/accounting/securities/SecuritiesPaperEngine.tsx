'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, type FieldErrors, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Files } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formActionButtonClass } from '@/components/ui/forms/formTokens';
import { SimpleDropdownMenu } from '@/components/inventory/SimpleDropdownMenu';
import { ErpDocumentLayout } from '@/components/erp/ErpDocumentLayout';
import { ErpDocumentPageHeader } from '@/components/erp/ErpDocumentPageHeader';
import { ErpDocumentBottomSplit } from '@/components/erp/ErpDocumentBottomSplit';
import { ErpFormHeaderCard, ErpFieldError } from '@/components/erp/ErpFormHeaderCard';
import { DocumentBrowseDrawer } from '@/components/erp/DocumentBrowseDrawer';
import { GenericRecordsList } from '@/components/erp/GenericRecordsList';
import { erpInputClass, erpInputErrorClass, erpLabelClass } from '@/components/erp/erpUiTokens';
import {
  DocumentSectionNumberPair,
  sectionNumberInputClass,
  sectionNumberLabelClass,
} from '@/components/erp/DocumentSectionNumberPair';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';
import { AccountSelect } from '@/app/components/form/AccountSelect';
import { CostCenterSelect } from '@/app/components/form/CostCenterSelect';
import { CustomerSelect, SupplierSelect } from '@/app/components/form/PartySelect';
import { RequiredDot } from '@/components/erp/RequiredDot';
import { useApiMutation, useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';
import { useCurrenciesQuery } from '@/lib/hooks/useMasterDataQueries';
import { pickCurrencyByCode, rateForCurrency } from '@/lib/accounting/fx-base';
import { useCompanyBaseCurrency } from '@/lib/hooks/useCompanyBaseCurrency';
import { DocumentCurrencyRateFields } from '@/components/accounting/DocumentCurrencyRateFields';
import { apiClient } from '@/lib/api/client';
import type { ApiError } from '@/lib/api/types';
import {
  postNamedDocumentAfterSave,
  useRepostAfterUnpost,
} from '@/lib/accounting/ensure-posted-after-save';
import { toHijri } from '@/lib/dates/hijri';
import { MultiCollectionModal, type MultiCollectionPayload } from './MultiCollectionModal';
import { SecuritiesDateHijriField } from './SecuritiesDateHijriField';
import {
  SecuritiesBounceModal,
  SecuritiesCollectModal,
  SecuritiesEndorseModal,
} from './SecuritiesLifecycleModals';
import {
  isoDateOnly,
  resolveSecuritiesPaperCase,
  securitiesPaperStatus,
  securitiesPaperTitle,
  type SecuritiesPaperKind,
  type SecuritiesPaperRecord,
} from './securities-paper-status';
import type { TransactionSettings } from '@/lib/transaction-settings/types';

function formatPaperDate(iso?: string) {
  const raw = (iso || '').trim();
  if (!raw) return '';
  const [year, month, day] = raw.split('-');
  return day && month && year ? `${day}/${month}/${year}` : raw;
}

export function buildSecuritiesPaperDescription(
  kind: SecuritiesPaperKind,
  chequeNumber: string,
  partyName: string,
  dueDate: string
) {
  const number = chequeNumber.trim();
  const name = partyName.trim();
  const due = formatPaperDate(dueDate);
  if (!number || !name || !due) return '';
  return kind === 'payment'
    ? `شيك رقم ${number} إلى المورد ${name} يستحق بتاريخ ${due}`
    : `شيك رقم ${number} من العميل ${name} يستحق بتاريخ ${due}`;
}

function makeFormSchema(kind: SecuritiesPaperKind) {
  return z
    .object({
      date: z.string().min(1, 'يرجى إدخال تاريخ التحرير'),
      hijriDate: z.string().optional(),
      dueDate: z.string().min(1, 'يرجى إدخال تاريخ الاستحقاق'),
      dueHijriDate: z.string().optional(),
      currencyId: z.string().min(1, 'اختر العملة'),
      exchangeRate: z.coerce.number().positive().optional(),
      partyType: z.enum(['customer', 'supplier']),
      partyId: z.string().min(1, kind === 'payment' ? 'يرجى اختيار المورد' : 'يرجى اختيار العميل'),
      accountId: z.string().optional(),
      costCenterId: z.string().optional(),
      securityType: z.enum(['check', 'promissory-note', 'bond', 'other']),
      serial: z.string().optional(),
      documentNumber: z.string().optional(),
      securityNumber: z.string().min(1, 'يرجى إدخال رقم الشيك'),
      description: z.string().optional(),
      partyName: z.string().optional(),
      entityName: z.string().optional(),
      bankName: z.string().optional(),
      amount: z.string(),
      paidTo: z.string().optional(),
      depositInBank: z.boolean(),
      bankPortfolioId: z.string().optional(),
      bankIssueDate: z.string().optional(),
      bankHijriDate: z.string().optional(),
      department: z.string().optional(),
      refNumber: z.string().optional(),
    })
    .superRefine((d, ctx) => {
      const amt = parseFloat(String(d.amount).replace(/,/g, ''));
      if (!Number.isFinite(amt) || amt <= 0) {
        ctx.addIssue({ code: 'custom', message: 'يرجى إدخال مبلغ صحيح', path: ['amount'] });
      }
    });
}

type FormValues = z.infer<ReturnType<typeof makeFormSchema>>;

type Named = { id: string; code?: string; arabicName: string; englishName?: string };
type Currency = Named & { code: string; exchangeRate?: number | string | null };
type BankAccount = {
  id: string;
  accountNumber?: string;
  arabicName?: string;
  bank?: { arabicName?: string | null };
};

function todayIso(): string {
  return new Date().toISOString().split('T')[0];
}

function defaultCurrencyId(currencies: Currency[], companyBase = 'EGP'): string {
  if (!currencies.length) return '';
  return pickCurrencyByCode(currencies, companyBase)?.id || currencies[0].id;
}

function emptyForm(currencies: Currency[], kind: SecuritiesPaperKind = 'receipt'): FormValues {
  const date = todayIso();
  return {
    date,
    hijriDate: toHijri(date),
    dueDate: '',
    dueHijriDate: '',
    currencyId: defaultCurrencyId(currencies),
    exchangeRate: 1,
    partyType: kind === 'payment' ? 'supplier' : 'customer',
    partyId: '',
    accountId: '',
    costCenterId: '',
    securityType: 'check',
    serial: '',
    documentNumber: '',
    securityNumber: '',
    description: '',
    partyName: '',
    entityName: '',
    bankName: '',
    amount: '',
    paidTo: '',
    depositInBank: false,
    bankPortfolioId: '',
    bankIssueDate: '',
    bankHijriDate: '',
    department: '',
    refNumber: '',
  };
}

type Props = { kind: SecuritiesPaperKind };

export function SecuritiesPaperEngine({ kind }: Props) {
  const router = useRouter();
  const invalidateQuery = useInvalidateQuery();
  const { markUnpostedForEdit, consumeShouldRepost, resetKeepPosted } = useRepostAfterUnpost();
  const title = securitiesPaperTitle(kind);
  const apiPath = kind === 'payment' ? '/accounting/securities-payments' : '/accounting/securities-receipts';
  const listKey = kind === 'payment' ? 'securities-payments' : 'securities-receipts';
  const settingsDocumentType = kind === 'payment' ? 'SECURITIES_PAYMENT' : 'SECURITIES_RECEIPT';
  const { data: txSettingsRes } = useApiQuery<TransactionSettings>(
    ['transaction-settings', settingsDocumentType],
    `/transaction-settings/${settingsDocumentType}`
  );
  const autoNumbering = txSettingsRes?.data?.numberingMode !== 'MANUAL';
  const bulkHref = '/treasury/papers/batch-receipt/new';
  const favoriteHref =
    kind === 'payment'
      ? '/accounting/operations/securities/payment'
      : '/accounting/operations/securities/reciept';
  const paidToLabel = kind === 'payment' ? 'مدفوع إلى مورد' : 'مقبوض من عميل';
  const partyPlaceholder = kind === 'payment' ? 'اختر المورد...' : 'اختر العميل...';
  const formSchema = useMemo(() => makeFormSchema(kind), [kind]);

  const [showList, setShowList] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<SecuritiesPaperRecord | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showCollect, setShowCollect] = useState(false);
  const [showReturn, setShowReturn] = useState(false);
  const [showEndorse, setShowEndorse] = useState(false);
  const [showMultiCollection, setShowMultiCollection] = useState(false);
  const [multiCollecting, setMultiCollecting] = useState(false);
  const [actionPaperId, setActionPaperId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedJournalId, setSelectedJournalId] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema) as Resolver<FormValues>,
    defaultValues: emptyForm([], kind),
    mode: 'onTouched',
  });

  const date = watch('date');
  const dueDate = watch('dueDate');
  const bankIssueDate = watch('bankIssueDate');
  const { code: companyBaseCurrency } = useCompanyBaseCurrency();
  const currencyId = watch('currencyId');
  const exchangeRateWatch = watch('exchangeRate');
  const partyType = watch('partyType');
  const partyId = watch('partyId');
  const depositInBank = watch('depositInBank');
  const amountWatch = watch('amount');
  const securityNumber = watch('securityNumber');
  const documentNumber = watch('documentNumber');
  const partyName = watch('partyName');

  const { data: partyCardRes } = useApiQuery<{ arabicName?: string; englishName?: string }>(
    [kind === 'payment' ? 'supplier-card' : 'customer-card', partyId],
    partyId
      ? kind === 'payment'
        ? `/accounting/suppliers/${partyId}`
        : `/accounting/customers/${partyId}`
      : '/accounting/customers',
    undefined,
    { enabled: Boolean(partyId) }
  );

  useEffect(() => {
    const name = partyCardRes?.data?.arabicName || partyCardRes?.data?.englishName || '';
    if (!name) return;
    setValue('partyName', name, { shouldValidate: false });
    setValue('paidTo', name, { shouldValidate: false });
  }, [partyCardRes?.data, setValue]);

  useEffect(() => {
    setValue('hijriDate', toHijri(date || ''), { shouldValidate: false });
  }, [date, setValue]);
  useEffect(() => {
    setValue('dueHijriDate', toHijri(dueDate || ''), { shouldValidate: false });
  }, [dueDate, setValue]);
  useEffect(() => {
    setValue('bankHijriDate', toHijri(bankIssueDate || ''), { shouldValidate: false });
  }, [bankIssueDate, setValue]);

  const { data: currenciesResponse } = useCurrenciesQuery();
  const currencies = useMemo(() => (currenciesResponse?.data ?? []) as Currency[], [currenciesResponse?.data]);
  const { data: departmentsResponse } = useApiQuery<Named[]>(['hr-departments'], '/hr/departments', {
    limit: 200,
  });
  const departments = useMemo(() => departmentsResponse?.data ?? [], [departmentsResponse?.data]);
  const { data: banksResponse } = useApiQuery<BankAccount[]>(
    ['bank-accounts'],
    '/accounting/bank-accounts',
    { isActive: true }
  );
  const bankAccounts = useMemo(() => banksResponse?.data ?? [], [banksResponse?.data]);

  const { data: recordResponse } = useApiQuery<SecuritiesPaperRecord>(
    [listKey, 'one', selectedId],
    selectedId ? `${apiPath}/${selectedId}` : apiPath,
    undefined,
    { enabled: Boolean(selectedId) }
  );

  useEffect(() => {
    if (currencies.length > 0 && !currencyId) {
      const id = defaultCurrencyId(currencies, companyBaseCurrency);
      const cur = currencies.find((c) => c.id === id);
      setValue('currencyId', id, { shouldValidate: false });
      setValue(
        'exchangeRate',
        rateForCurrency(cur?.code, companyBaseCurrency, cur?.exchangeRate),
        { shouldValidate: false }
      );
    }
  }, [companyBaseCurrency, currencies, currencyId, setValue]);

  useEffect(() => {
    const record = recordResponse?.data;
    if (!record || !selectedId || record.id !== selectedId) return;
    setLoaded(record);
    const partyIsSupplier = Boolean(record.supplierId);
    const partyIsCustomer = Boolean(record.customerId);
    const name =
      kind === 'payment'
        ? record.payeeName || record.supplier?.arabicName || record.customer?.arabicName || ''
        : record.issuerName || record.customer?.arabicName || record.supplier?.arabicName || '';
    const issue = isoDateOnly(record.date) || todayIso();
    const due = isoDateOnly(record.dueDate);
    reset({
      ...emptyForm(currencies, kind),
      date: issue,
      hijriDate: record.hijriDate || toHijri(issue),
      dueDate: due,
      dueHijriDate: toHijri(due),
      currencyId:
        currencies.find((c) => c.code === record.currencyCode)?.id ||
        defaultCurrencyId(currencies, companyBaseCurrency),
      exchangeRate: rateForCurrency(
        record.currencyCode,
        companyBaseCurrency,
        currencies.find((c) => c.code === record.currencyCode)?.exchangeRate
      ),
      partyType: partyIsSupplier ? 'supplier' : partyIsCustomer ? 'customer' : kind === 'payment' ? 'supplier' : 'customer',
      partyId: record.supplierId || record.customerId || '',
      accountId: record.destinationAccountId || '',
      securityType: (record.securityType as FormValues['securityType']) || 'check',
      serial: record.serial || '',
      documentNumber: record.paymentNumber || record.receiptNumber || '',
      securityNumber: record.securityNumber || '',
      description: record.description || '',
      partyName: name,
      entityName: record.entityName || '',
      bankName: (kind === 'payment' ? record.payeeBank : record.issuerBank) || '',
      amount: record.amount != null ? String(record.amount) : '',
    });
  }, [recordResponse?.data, selectedId, currencies, companyBaseCurrency, kind, reset]);

  const applyParty = (id: string, name?: string) => {
    setValue('partyType', kind === 'payment' ? 'supplier' : 'customer', { shouldValidate: false });
    setValue('partyId', id, { shouldValidate: true });
    if (name) {
      setValue('partyName', name, { shouldValidate: false });
      setValue('paidTo', name, { shouldValidate: false });
    }
  };

  const createMutation = useApiMutation<SecuritiesPaperRecord, Record<string, unknown>>(apiPath, 'POST', {
    showSuccessToast: false,
    onSuccess: () => {
      const message =
        kind === 'payment'
          ? 'تم حفظ ورقة المدفوعات وإنشاء قيد التحرير'
          : 'تم حفظ ورقة المقبوضات وإنشاء قيد التحرير';
      invalidateQuery([listKey]);
      invalidateQuery([`${listKey}-browse`]);
      invalidateQuery(['journal-entry']);
      resetNew();
      setSuccess(message);
    },
    onError: (err: ApiError) => setError(err.message || 'حدث خطأ أثناء الحفظ'),
  });

  const status = securitiesPaperStatus(loaded);
  const docNumber = securityNumber || documentNumber || loaded?.securityNumber || '';
  const amountNum = parseFloat(String(amountWatch || '').replace(/,/g, '')) || 0;
  const paperCase = loaded?.id ? resolveSecuritiesPaperCase(loaded) : 'ISSUED';
  const locked = Boolean(loaded?.id && paperCase !== 'ISSUED');
  const journals = loaded?.journals ?? [];
  const activeJournalId =
    selectedJournalId && journals.some((row) => row.id === selectedJournalId)
      ? selectedJournalId
      : journals[journals.length - 1]?.id || loaded?.journalEntryId || null;

  useEffect(() => {
    if (locked) return;
    const next = buildSecuritiesPaperDescription(
      kind,
      securityNumber || '',
      partyName || '',
      dueDate || ''
    );
    if (next) setValue('description', next, { shouldValidate: false });
  }, [kind, securityNumber, partyName, dueDate, locked, setValue]);

  const advancedFilled = [watch('department'), watch('refNumber'), watch('costCenterId')].filter(
    (v) => String(v ?? '').trim()
  ).length;
  const actionId = actionPaperId || selectedId;

  const resetNew = () => {
    resetKeepPosted();
    setSelectedId(null);
    setLoaded(null);
    setSelectedJournalId(null);
    reset(emptyForm(currencies, kind));
    setError('');
    setSuccess('');
  };

  const buildPayload = (values: FormValues): Record<string, unknown> => {
    const selectedCurrency = currencies.find((c) => c.id === values.currencyId);
    return {
      date: new Date(values.date).toISOString(),
      securityType: values.securityType,
      amount: parseFloat(String(values.amount).replace(/,/g, '')),
      currencyCode: selectedCurrency?.code || 'EGP',
      serial: values.serial || undefined,
      description: values.description || undefined,
      entityName: values.entityName || undefined,
      hijriDate: values.hijriDate || toHijri(values.date) || undefined,
      customerId: values.partyType === 'customer' ? values.partyId || null : null,
      supplierId: values.partyType === 'supplier' ? values.partyId || null : null,
      destinationAccountId: values.accountId || null,
      securityNumber: values.securityNumber || undefined,
      dueDate: values.dueDate ? new Date(values.dueDate).toISOString() : undefined,
      ...(kind === 'payment'
        ? {
            paymentNumber: values.documentNumber || undefined,
            payeeName: values.partyName || undefined,
            payeeBank: values.bankName || values.bankPortfolioId || undefined,
          }
        : {
            receiptNumber: values.documentNumber || undefined,
            issuerName: values.partyName || undefined,
            issuerBank: values.bankName || values.bankPortfolioId || undefined,
          }),
    };
  };

  const firstFormError = (errs: FieldErrors<FormValues>): string => {
    for (const value of Object.values(errs)) {
      if (value && typeof value === 'object' && 'message' in value && value.message) {
        return String(value.message);
      }
    }
    return 'أكمل الحقول المطلوبة قبل الحفظ';
  };

  const onSave = () => {
    if (saving || createMutation.isPending) return;
    void handleSubmit(
      async (values) => {
        setError('');
        setSuccess('');
        if (!selectedId && !autoNumbering && !values.serial?.trim()) {
          setError('أدخل المسلسل يدوياً — الترقيم مضبوط على يدوي في إعدادات الورقة');
          return;
        }
        const body = buildPayload(values);
        if (selectedId) {
          setSaving(true);
          try {
            await apiClient.put<SecuritiesPaperRecord>(`${apiPath}/${selectedId}`, body);
            invalidateQuery([listKey]);
            invalidateQuery([listKey, 'one', selectedId]);
            invalidateQuery(['journal-entry']);
            if (consumeShouldRepost() && selectedId) {
              try {
                await postNamedDocumentAfterSave(`${apiPath}/${selectedId}/post`);
                resetNew();
                setSuccess('تم حفظ التعديلات وترحيل الورقة');
              } catch (repostErr) {
                resetNew();
                setError(
                  repostErr instanceof Error
                    ? repostErr.message
                    : 'تم الحفظ لكن تعذر ترحيل الورقة'
                );
              }
            } else {
              resetNew();
              setSuccess('تم تحديث الورقة وقيد التحرير');
            }
          } catch (err) {
            setError(err instanceof Error ? err.message : 'حدث خطأ أثناء التحديث');
          } finally {
            setSaving(false);
          }
          return;
        }
        createMutation.mutate(body);
      },
      (errs) => setError(firstFormError(errs))
    )();
  };

  const onPostDoc = async () => {
    const id = selectedId || loaded?.id;
    if (!id) return;
    setPosting(true);
    try {
      const res = await apiClient.post<SecuritiesPaperRecord>(`${apiPath}/${id}/post`, {});
      applyLoaded(res.data ?? { ...loaded, id, isPosted: true }, id);
      setSuccess('تم ترحيل الورقة');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر ترحيل الورقة');
    } finally {
      setPosting(false);
    }
  };

  const onUnpostDoc = async () => {
    const id = selectedId || loaded?.id;
    if (!id) return;
    try {
      const res = await apiClient.post<SecuritiesPaperRecord>(`${apiPath}/${id}/unpost`, {});
      applyLoaded(res.data ?? { ...loaded, id, isPosted: false }, id);
      markUnpostedForEdit();
      setSuccess('تم فك ترحيل الورقة — يمكن التعديل الآن');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر فك ترحيل الورقة');
    }
  };

  const applyLoaded = (record: SecuritiesPaperRecord, fallbackId: string) => {
    setSelectedId(record.id || fallbackId);
    setLoaded(record);
    const latestJournal =
      record.journals?.[record.journals.length - 1]?.id || record.journalEntryId || null;
    if (latestJournal) setSelectedJournalId(latestJournal);
    invalidateQuery([listKey]);
    invalidateQuery([`${listKey}-browse`]);
    invalidateQuery([listKey, 'one', record.id || fallbackId]);
    invalidateQuery(['journal-entry']);
    if (latestJournal) invalidateQuery(['journal-entry', latestJournal]);
  };

  const undoPaperCase = async () => {
    const id = selectedId || loaded?.id;
    if (!id) return;
    try {
      if (paperCase === 'COLLECTED' || paperCase === 'MULTI_COLLECTED') {
        const res = await apiClient.post<SecuritiesPaperRecord>(`${apiPath}/${id}/unpost`, {});
        applyLoaded(res.data ?? { ...loaded, id, paperCase: 'ISSUED', isPosted: false }, id);
        markUnpostedForEdit();
        setSuccess(paperCase === 'MULTI_COLLECTED' ? 'تم فك التحصيل المتعدد وعادت الورقة محررة' : 'تم فك التحصيل وعادت الورقة محررة');
        return;
      }
      if (paperCase === 'ENDORSED') {
        const res = await apiClient.post<SecuritiesPaperRecord>(`${apiPath}/${id}/unendorse`, {});
        applyLoaded(res.data ?? { ...loaded, id, paperCase: 'ISSUED', isPosted: false }, id);
        setSuccess('تم فك التظهير وعادت الورقة محررة');
        return;
      }
      if (paperCase === 'BOUNCED') {
        const res = await apiClient.post<SecuritiesPaperRecord>(`${apiPath}/${id}/restore`, {});
        applyLoaded(res.data ?? { ...loaded, id, paperCase: 'ISSUED', isCancelled: false }, id);
        setSuccess('تم فك الارتداد وعادت الورقة محررة');
        return;
      }
      setError('لا توجد حالة لفكها');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر فك حالة الورقة');
    }
  };

  const onCancelDoc = async () => {
    if (!selectedId) {
      resetNew();
      return;
    }
    if (paperCase !== 'ISSUED') {
      setError('فك حالة الورقة أولاً قبل الإلغاء');
      return;
    }
    if (loaded?.isCancelled) return;
    try {
      const res = await apiClient.post<SecuritiesPaperRecord>(`${apiPath}/${selectedId}/cancel`, {});
      setLoaded(res.data ?? { ...loaded, id: selectedId, isCancelled: true });
      setSuccess('تم إلغاء الورقة');
      invalidateQuery([listKey]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر إلغاء الورقة');
    }
  };

  const executeMultiCollection = async (payload: MultiCollectionPayload) => {
    const id = actionPaperId || selectedId;
    if (!id) {
      setError('احفظ الورقة أولاً قبل التحصيل المتعدد');
      return;
    }
    setMultiCollecting(true);
    setError('');
    try {
      const res = await apiClient.post<SecuritiesPaperRecord>(`${apiPath}/${id}/multi-collect`, payload);
      applyLoaded(res.data ?? { ...loaded, id, paperCase: 'MULTI_COLLECTED', isPosted: true }, id);
      setShowMultiCollection(false);
      setSuccess('تم التحصيل المتعدد — حالتها تحصيل متعدد');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تنفيذ التحصيل المتعدد');
    } finally {
      setMultiCollecting(false);
    }
  };

  const openLifecycle = (action: 'collect' | 'multi' | 'bounce' | 'endorse') => {
    const id = selectedId || loaded?.id || null;
    if (!id) {
      setError('احفظ الورقة أولاً');
      return;
    }
    setActionPaperId(id);
    if (action === 'collect') setShowCollect(true);
    if (action === 'multi') setShowMultiCollection(true);
    if (action === 'bounce') setShowReturn(true);
    if (action === 'endorse') setShowEndorse(true);
  };

  const savePending = saving || createMutation.isPending;
  const hasDocument = Boolean(selectedId || loaded?.id);

  return (
    <ErpDocumentLayout>
      {error ? <ErrorToast message={error} onClose={() => setError('')} /> : null}
      {success ? <SuccessToast message={success} onClose={() => setSuccess('')} /> : null}

      <ErpDocumentPageHeader
        breadcrumbs={[
          { href: '/accounting', label: 'المحاسبة' },
          { label: 'الأوراق المالية' },
          { label: title },
        ]}
        title={title}
        currentId={selectedId || loaded?.id || null}
        docNumber={docNumber}
        statusTone={status.tone}
        statusLabel={`حالة الورقة: ${status.label}`}
        saveLabel="حفظ"
        onSaveDraft={onSave}
        onCancel={() => void onCancelDoc()}
        cancelLabel="إلغاء"
        savePending={savePending}
        canSave={!savePending && !locked}
        hideStandalonePost
        saveDisabledHint={
          locked ? `الورقة حالتها «${status.label}» — فك الحالة أولاً حتى يمكن التعديل` : undefined
        }
        favoriteHref={favoriteHref}
        favoriteLabel={title}
        onBrowseList={() => setShowList(true)}
        browseListLabel="السابق"
        extraActions={
          <SimpleDropdownMenu
            align="right"
            trigger={
              <Button type="button" variant="secondary" size="sm" className={`${formActionButtonClass} gap-1.5`}>
                <Files className="h-3.5 w-3.5" />
                إنشاء عدة أوراق
              </Button>
            }
            items={[{ id: 'bulk', label: 'إنشاء عدة أوراق', onClick: () => router.push(bulkHref) }]}
          />
        }
        standardActions={{
          hasDocument: Boolean(selectedId || loaded?.id),
          isPosted: Boolean(loaded?.isPosted),
          isCancelled: Boolean(loaded?.isCancelled),
          postPending: posting,
          onNew: resetNew,
          newLabel: 'جديد',
          onEdit: () => {
            if (loaded?.isPosted) {
              setError('فك الترحيل أولاً حتى يُفتح التعديل');
              return;
            }
          },
          onPost: () => void onPostDoc(),
          onUnpost: () => void onUnpostDoc(),
          extraItems: [
            {
              id: 'collect',
              label: paperCase === 'COLLECTED' ? 'فك التحصيل' : 'تحصيل',
              disabled: !hasDocument || (paperCase !== 'ISSUED' && paperCase !== 'COLLECTED'),
              hint: paperCase !== 'ISSUED' && paperCase !== 'COLLECTED' ? `الورقة حالتها «${status.label}»` : undefined,
              onClick: () => (paperCase === 'COLLECTED' ? void undoPaperCase() : openLifecycle('collect')),
            },
            {
              id: 'multi-collect',
              label: paperCase === 'MULTI_COLLECTED' ? 'فك التحصيل المتعدد' : 'تحصيل متعدد',
              disabled: !hasDocument || (paperCase !== 'ISSUED' && paperCase !== 'MULTI_COLLECTED'),
              hint: paperCase !== 'ISSUED' && paperCase !== 'MULTI_COLLECTED' ? `الورقة حالتها «${status.label}»` : undefined,
              onClick: () =>
                paperCase === 'MULTI_COLLECTED' ? void undoPaperCase() : openLifecycle('multi'),
            },
            {
              id: 'bounce',
              label: paperCase === 'BOUNCED' ? 'فك الارتداد' : 'ارتداد',
              disabled: !hasDocument || (paperCase !== 'ISSUED' && paperCase !== 'BOUNCED'),
              hint: paperCase !== 'ISSUED' && paperCase !== 'BOUNCED' ? `الورقة حالتها «${status.label}»` : undefined,
              onClick: () => (paperCase === 'BOUNCED' ? void undoPaperCase() : openLifecycle('bounce')),
            },
            ...(kind === 'receipt'
              ? [
                  {
                    id: 'endorse',
                    label: paperCase === 'ENDORSED' ? 'فك التظهير' : 'تظهير',
                    disabled: !hasDocument || (paperCase !== 'ISSUED' && paperCase !== 'ENDORSED'),
                    hint:
                      paperCase !== 'ISSUED' && paperCase !== 'ENDORSED'
                        ? `الورقة حالتها «${status.label}»`
                        : undefined,
                    onClick: () => (paperCase === 'ENDORSED' ? void undoPaperCase() : openLifecycle('endorse')),
                  },
                ]
              : []),
          ],
        }}
      />

      <div data-tour={kind === 'receipt' ? 'incoming-cheques-table' : undefined}>
      <ErpFormHeaderCard
        extrasLabel="الإعدادات المتقدمة"
        extras={
          <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            <DocumentCurrencyRateFields
              currencies={currencies}
              currencyId={currencyId}
              exchangeRate={Number(exchangeRateWatch) > 0 ? Number(exchangeRateWatch) : 1}
              companyBaseCode={companyBaseCurrency}
              disabled={locked}
              amount={amountNum}
              showEquivalent
              onCurrencyIdChange={(id, nextRate) => {
                setValue('currencyId', id, { shouldDirty: true, shouldValidate: true });
                setValue('exchangeRate', nextRate, { shouldDirty: true });
              }}
              onExchangeRateChange={(rate) => setValue('exchangeRate', rate, { shouldDirty: true })}
            />
            <div className="flex justify-end sm:col-span-2">
              <DocumentSectionNumberPair>
                <div className="w-[8.5rem] shrink-0">
                  <label className={sectionNumberLabelClass}>القسم</label>
                  <select className={sectionNumberInputClass} disabled={locked} {...register('department')}>
                    <option value="">اختر القسم</option>
                    {departments.map((row) => (
                      <option key={row.id} value={row.id}>
                        {row.code ? `${row.code} - ` : ''}
                        {row.arabicName || row.englishName || ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="w-[9.5rem] min-w-0">
                  <label className={sectionNumberLabelClass}>الرقم</label>
                  <input
                    className={sectionNumberInputClass}
                    placeholder="الرقم المرجعي"
                    disabled={locked}
                    {...register('refNumber')}
                  />
                </div>
              </DocumentSectionNumberPair>
            </div>
            <div>
              <label className={erpLabelClass}>مركز التكلفة</label>
              <CostCenterSelect
                value={watch('costCenterId') || ''}
                onChange={(id) => setValue('costCenterId', id, { shouldValidate: false })}
                className={erpInputClass}
                disabled={locked}
              />
            </div>
            {advancedFilled ? (
              <p className="self-end text-xs text-slate-500 lg:col-span-4">{advancedFilled} حقول متقدمة مُعبأة</p>
            ) : null}
          </div>
        }
        row1={
          <>
            <div>
              <label className={erpLabelClass}>المسلسل</label>
              <input
                className={erpInputClass}
                placeholder={autoNumbering ? 'تلقائي' : 'أدخل المسلسل'}
                disabled={locked || autoNumbering}
                {...register('serial')}
              />
            </div>
            <div>
              <label className={erpLabelClass}>
                رقم الشيك
                <RequiredDot hint="رقم الشيك مطلوب" />
              </label>
              <input
                className={`${erpInputClass} ${errors.securityNumber ? erpInputErrorClass : ''}`}
                placeholder="رقم الشيك"
                disabled={locked}
                {...register('securityNumber')}
              />
              <ErpFieldError message={errors.securityNumber?.message} show={Boolean(errors.securityNumber)} />
            </div>
            <div>
              <label className={erpLabelClass}>نوع الورقة</label>
              <select className={erpInputClass} disabled={locked} {...register('securityType')}>
                <option value="check">شيك</option>
                <option value="promissory-note">سند إذني</option>
                <option value="bond">سند</option>
                <option value="other">أخرى</option>
              </select>
            </div>
            <div className="lg:col-span-2">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">
                    {paidToLabel}
                    <RequiredDot hint={kind === 'payment' ? 'المورد مطلوب' : 'العميل مطلوب'} />
                  </label>
                  {kind === 'payment' ? (
                    <SupplierSelect
                      value={partyId}
                      onChange={(id) => applyParty(id)}
                      className={erpInputClass}
                      disabled={locked}
                      emptyLabel={partyPlaceholder}
                      seedParty={
                        loaded?.supplierId && loaded.supplier
                          ? {
                              id: loaded.supplierId,
                              arabicName: loaded.supplier.arabicName || '',
                              code: loaded.supplier.code,
                              englishName: loaded.supplier.englishName,
                            }
                          : null
                      }
                    />
                  ) : (
                    <CustomerSelect
                      value={partyId}
                      onChange={(id) => applyParty(id)}
                      className={erpInputClass}
                      disabled={locked}
                      emptyLabel={partyPlaceholder}
                      seedParty={
                        loaded?.customerId && loaded.customer
                          ? {
                              id: loaded.customerId,
                              arabicName: loaded.customer.arabicName || '',
                              code: loaded.customer.code,
                              englishName: loaded.customer.englishName,
                            }
                          : null
                      }
                    />
                  )}
                  <ErpFieldError message={errors.partyId?.message} show={Boolean(errors.partyId)} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">الجهة</label>
                  <input
                    type="text"
                    disabled={locked}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-xs focus-visible:ring-1 focus-visible:ring-primary"
                    placeholder="اسم المؤسسة / الشركة / الجهة التابع لها"
                    {...register('entityName')}
                  />
                </div>
              </div>
            </div>
          </>
        }
        row2={
          <>
            <SecuritiesDateHijriField
              label="تاريخ التحرير"
              gregorian={date}
              hijri={watch('hijriDate') || ''}
              onGregorianChange={(v) => setValue('date', v, { shouldValidate: true })}
              error={errors.date?.message}
              required
            />
            <SecuritiesDateHijriField
              label="تاريخ الاستحقاق"
              gregorian={dueDate || ''}
              hijri={watch('dueHijriDate') || ''}
              onGregorianChange={(v) => setValue('dueDate', v, { shouldValidate: true })}
              error={errors.dueDate?.message}
              required
            />
            <div>
              <label className={erpLabelClass}>
                القيمة
                <RequiredDot hint="القيمة مطلوبة" />
              </label>
              <input
                inputMode="decimal"
                className={`${erpInputClass} ${errors.amount ? erpInputErrorClass : ''}`}
                placeholder="0.00"
                disabled={locked}
                {...register('amount')}
              />
              <ErpFieldError message={errors.amount?.message} show={Boolean(errors.amount)} />
              {paperCase === 'ISSUED' ? (
                <button
                  type="button"
                  className="mt-1.5 text-xs font-semibold text-[#0E78AA] hover:underline disabled:opacity-40"
                  disabled={!hasDocument}
                  onClick={() => {
                    if (!hasDocument) {
                      setError('احفظ الورقة أولاً قبل التحصيل المتعدد');
                      return;
                    }
                    openLifecycle('multi');
                  }}
                >
                  تحصيل متعدد
                </button>
              ) : null}
            </div>
            <div>
              <label className={erpLabelClass}>الشرح / البيان</label>
              <input
                className={erpInputClass}
                placeholder={
                  kind === 'payment'
                    ? 'شيك رقم … إلى المورد … يستحق بتاريخ …'
                    : 'شيك رقم … من العميل … يستحق بتاريخ …'
                }
                disabled={locked}
                {...register('description')}
              />
            </div>
            <div>
              <label className={erpLabelClass}>الحساب</label>
              <AccountSelect
                value={watch('accountId') || ''}
                onChange={(id) => setValue('accountId', id, { shouldValidate: false })}
                className={erpInputClass}
                leafOnly
                disabled={locked}
                placeholder="اختر حساب الحركة"
                emptyLabel="اختر حساب الحركة"
              />
            </div>
          </>
        }
      />
      </div>

      <div className="mt-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className="inline-flex items-center gap-2 text-sm font-semibold text-[#094C6B]">
          <input
            type="checkbox"
            className="h-4 w-4 accent-[#0E78AA]"
            checked={depositInBank}
            onChange={(e) => {
              const on = e.target.checked;
              setValue('depositInBank', on, { shouldValidate: false });
              if (!on) {
                setValue('bankPortfolioId', '');
                setValue('bankIssueDate', '');
                setValue('bankHijriDate', '');
              } else if (!watch('bankIssueDate')) {
                const d = todayIso();
                setValue('bankIssueDate', d);
                setValue('bankHijriDate', toHijri(d));
              }
            }}
          />
          إيداع في البنك
        </label>
        {depositInBank ? (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={erpLabelClass}>محفظة البنك</label>
              <select className={erpInputClass} {...register('bankPortfolioId')}>
                <option value="">اختر محفظة البنك</option>
                {bankAccounts.map((bank) => (
                  <option key={bank.id} value={bank.id}>
                    {bank.accountNumber || bank.arabicName || bank.id}{' '}
                    {bank.bank?.arabicName ? `— ${bank.bank.arabicName}` : ''}
                  </option>
                ))}
              </select>
            </div>
            <SecuritiesDateHijriField
              label="تاريخ التحرير"
              gregorian={bankIssueDate || ''}
              hijri={watch('bankHijriDate') || ''}
              onGregorianChange={(v) => setValue('bankIssueDate', v, { shouldValidate: false })}
            />
          </div>
        ) : null}
      </div>

      <ErpDocumentBottomSplit
        financialRows={[{ label: 'مبلغ الورقة', value: amountNum }]}
        netAmount={amountNum}
        netLabel="إجمالي الورقة"
        journalEntryId={activeJournalId}
        journalOptions={journals.map((row) => ({ id: row.id, label: row.label }))}
        onJournalIdChange={setSelectedJournalId}
        showJournalTab
        journalEmptyTitle="لا يوجد قيد بعد. احفظ الورقة فيظهر قيد التحرير هنا، وبعد التحصيل أو الارتداد تقدر تختار القيد من القائمة."
        tabs={[]}
      />

      <DocumentBrowseDrawer open={showList} onClose={() => setShowList(false)} title={`${title} — السجلات السابقة`}>
        <div data-tour={kind === 'receipt' ? 'incoming-cheques-table' : undefined}>
        <GenericRecordsList
          apiPath={apiPath}
          listKey={`${listKey}-browse`}
          selectedId={selectedId}
          resolveStatus={(row) => {
            const s = securitiesPaperStatus(row as SecuritiesPaperRecord);
            return { variant: s.tone, label: s.label };
          }}
          columns={[
            {
              id: 'num',
              header: 'رقم الورقة',
              getValue: (r) =>
                String(r.securityNumber ?? r.paymentNumber ?? r.receiptNumber ?? r.id.slice(0, 8)),
            },
            {
              id: 'amount',
              header: 'المبلغ',
              getValue: (r) =>
                Number(r.amount ?? 0).toLocaleString('ar-EG', { minimumFractionDigits: 2 }),
            },
            {
              id: 'name',
              header: paidToLabel,
              getValue: (r) =>
                String(
                  r.payeeName ??
                    r.issuerName ??
                    (r.customer as { arabicName?: string } | undefined)?.arabicName ??
                    (r.supplier as { arabicName?: string } | undefined)?.arabicName ??
                    '—'
                ),
            },
            {
              id: 'due',
              header: 'الاستحقاق',
              getValue: (r) =>
                r.dueDate ? new Date(String(r.dueDate)).toLocaleDateString('ar-EG') : '—',
            },
          ]}
          onSelect={(id) => {
            setSelectedId(id);
            setShowList(false);
          }}
        />
        </div>
      </DocumentBrowseDrawer>

      <SecuritiesCollectModal
        open={showCollect}
        kind={kind}
        apiPath={apiPath}
        paperId={actionId}
        amount={amountNum}
        defaultAccountId={watch('accountId') || loaded?.destinationAccountId || ''}
        onClose={() => setShowCollect(false)}
        onDone={(record) => {
          applyLoaded(record, record.id);
          setSuccess('تم تحصيل الورقة — حالتها محصلة');
        }}
      />
      <SecuritiesBounceModal
        open={showReturn}
        apiPath={apiPath}
        paperId={actionId}
        onClose={() => setShowReturn(false)}
        onDone={(record) => {
          applyLoaded(record, record.id);
          setSuccess('تم ارتداد الورقة — حالتها مرتدة');
        }}
      />
      {kind === 'receipt' ? (
        <SecuritiesEndorseModal
          open={showEndorse}
          apiPath={apiPath}
          paperId={actionId}
          onClose={() => setShowEndorse(false)}
          onDone={(record) => {
            applyLoaded(record, record.id);
            setSuccess('تم تظهير الورقة — حالتها مظهرة');
          }}
        />
      ) : null}
      <MultiCollectionModal
        open={showMultiCollection}
        kind={kind}
        paperNumber={docNumber}
        remainingAmount={amountNum}
        currencyCode={currencies.find((c) => c.id === currencyId)?.code || 'EGP'}
        disabled={locked}
        confirmPending={multiCollecting}
        onClose={() => setShowMultiCollection(false)}
        onConfirm={(payload) => void executeMultiCollection(payload)}
      />
    </ErpDocumentLayout>
  );
}
