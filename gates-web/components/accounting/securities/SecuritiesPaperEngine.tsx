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
import { CustomerSelect } from '@/app/components/form/PartySelect';
import { useApiMutation, useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';
import { useCurrenciesQuery } from '@/lib/hooks/useMasterDataQueries';
import { apiClient } from '@/lib/api/client';
import type { ApiError } from '@/lib/api/types';
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
  securitiesPaperStatus,
  securitiesPaperTitle,
  type SecuritiesPaperKind,
  type SecuritiesPaperRecord,
} from './securities-paper-status';

const formSchema = z
  .object({
    date: z.string().min(1, 'يرجى إدخال تاريخ التحرير'),
    hijriDate: z.string().optional(),
    dueDate: z.string().optional(),
    dueHijriDate: z.string().optional(),
    currencyId: z.string().min(1, 'اختر العملة'),
    partyType: z.enum(['customer', 'account']),
    partyId: z.string().optional(),
    accountId: z.string().optional(),
    costCenterId: z.string().optional(),
    securityType: z.enum(['check', 'promissory-note', 'bond', 'other']),
    serial: z.string().optional(),
    documentNumber: z.string().optional(),
    securityNumber: z.string().optional(),
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
    if (d.partyType === 'customer' && !d.partyId?.trim()) {
      ctx.addIssue({ code: 'custom', message: 'يرجى اختيار العميل', path: ['partyId'] });
    }
    if (d.partyType === 'account' && !d.partyId?.trim()) {
      ctx.addIssue({ code: 'custom', message: 'يرجى اختيار الحساب الآخر', path: ['partyId'] });
    }
  });

type FormValues = z.infer<typeof formSchema>;

type Named = { id: string; code?: string; arabicName: string; englishName?: string };
type Currency = Named & { code: string };
type BankAccount = {
  id: string;
  accountNumber?: string;
  arabicName?: string;
  bank?: { arabicName?: string | null };
};

function todayIso(): string {
  return new Date().toISOString().split('T')[0];
}

function defaultCurrencyId(currencies: Currency[]): string {
  if (!currencies.length) return '';
  return (currencies.find((c) => c.code === 'EGP') || currencies[0]).id;
}

function emptyForm(currencies: Currency[]): FormValues {
  const date = todayIso();
  return {
    date,
    hijriDate: toHijri(date),
    dueDate: '',
    dueHijriDate: '',
    currencyId: defaultCurrencyId(currencies),
    partyType: 'customer',
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
  const title = securitiesPaperTitle(kind);
  const apiPath = kind === 'payment' ? '/accounting/securities-payments' : '/accounting/securities-receipts';
  const listKey = kind === 'payment' ? 'securities-payments' : 'securities-receipts';
  const bulkHref = '/treasury/papers/batch-receipt/new';
  const favoriteHref =
    kind === 'payment'
      ? '/accounting/operations/securities/payment'
      : '/accounting/operations/securities/reciept';
  const paidToLabel = kind === 'payment' ? 'مدفوع إلى' : 'مقبوض من';
  const partyPlaceholder = kind === 'payment' ? 'اختر الطرف المستحق...' : 'اختر الساحب / العميل...';

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

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema) as Resolver<FormValues>,
    defaultValues: emptyForm([]),
    mode: 'onTouched',
  });

  const date = watch('date');
  const dueDate = watch('dueDate');
  const bankIssueDate = watch('bankIssueDate');
  const currencyId = watch('currencyId');
  const partyType = watch('partyType');
  const partyId = watch('partyId');
  const depositInBank = watch('depositInBank');
  const amountWatch = watch('amount');
  const securityNumber = watch('securityNumber');
  const documentNumber = watch('documentNumber');

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
      setValue('currencyId', defaultCurrencyId(currencies), { shouldValidate: false });
    }
  }, [currencies, currencyId, setValue]);

  useEffect(() => {
    const record = recordResponse?.data;
    if (!record || !selectedId || record.id !== selectedId) return;
    setLoaded(record);
    const partyIsCustomer = Boolean(record.customerId);
    const partyIsAccount = Boolean(record.destinationAccountId) && !record.customerId;
    const name =
      kind === 'payment'
        ? record.payeeName || record.customer?.arabicName || record.supplier?.arabicName || ''
        : record.issuerName || record.customer?.arabicName || record.supplier?.arabicName || '';
    const issue = isoDateOnly(record.date) || todayIso();
    const due = isoDateOnly(record.dueDate);
    reset({
      ...emptyForm(currencies),
      date: issue,
      hijriDate: record.hijriDate || toHijri(issue),
      dueDate: due,
      dueHijriDate: toHijri(due),
      currencyId:
        currencies.find((c) => c.code === record.currencyCode)?.id || defaultCurrencyId(currencies),
      partyType: partyIsCustomer ? 'customer' : partyIsAccount ? 'account' : record.destinationAccountId ? 'account' : 'customer',
      partyId: partyIsCustomer ? record.customerId || '' : record.destinationAccountId || '',
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
  }, [recordResponse?.data, selectedId, currencies, kind, reset]);

  const applyParty = (id: string, name?: string) => {
    setValue('partyId', id, { shouldValidate: true });
    if (name) {
      setValue('partyName', name, { shouldValidate: false });
      setValue('paidTo', name, { shouldValidate: false });
    }
  };

  const createMutation = useApiMutation<SecuritiesPaperRecord, Record<string, unknown>>(apiPath, 'POST', {
    showSuccessToast: false,
    onSuccess: (res) => {
      setSuccess(kind === 'payment' ? 'تم حفظ ورقة المدفوعات بنجاح' : 'تم حفظ ورقة المقبوضات بنجاح');
      invalidateQuery([listKey]);
      const created = res.data;
      if (created?.id) {
        setSelectedId(created.id);
        setLoaded(created);
      }
    },
    onError: (err: ApiError) => setError(err.message || 'حدث خطأ أثناء الحفظ'),
  });

  const status = securitiesPaperStatus(loaded);
  const docNumber = securityNumber || documentNumber || loaded?.securityNumber || '';
  const amountNum = parseFloat(String(amountWatch || '').replace(/,/g, '')) || 0;
  const locked = Boolean(loaded?.isPosted || loaded?.isCancelled);
  const advancedFilled = [watch('department'), watch('refNumber'), watch('costCenterId')].filter(
    (v) => String(v ?? '').trim()
  ).length;
  const actionId = actionPaperId || selectedId;

  const resetNew = () => {
    setSelectedId(null);
    setLoaded(null);
    reset(emptyForm(currencies));
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
      supplierId: null,
      destinationAccountId:
        values.partyType === 'account' ? values.partyId || null : values.accountId || null,
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

  const onSave = () =>
    void handleSubmit(
      async (values) => {
        setError('');
        setSuccess('');
        const body = buildPayload(values);
        if (selectedId) {
          setSaving(true);
          try {
            const res = await apiClient.put<SecuritiesPaperRecord>(`${apiPath}/${selectedId}`, body);
            setLoaded(res.data ?? loaded);
            setSuccess('تم تحديث الورقة بنجاح');
            invalidateQuery([listKey]);
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

  const onUnpostDoc = async () => {
    if (!selectedId) return;
    try {
      const res = await apiClient.post<SecuritiesPaperRecord>(`${apiPath}/${selectedId}/unpost`, {});
      setLoaded(res.data ?? { ...loaded, id: selectedId, isPosted: false });
      setSuccess('تم فك ترحيل الورقة');
      invalidateQuery([listKey]);
      invalidateQuery([listKey, 'one', selectedId]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر فك ترحيل الورقة');
    }
  };

  const onCancelDoc = async () => {
    if (!selectedId) {
      resetNew();
      return;
    }
    if (loaded?.isPosted) {
      setError('الورقة محصّلة — استخدم الارتداد لإلغائها');
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
      setLoaded(res.data ?? loaded);
      setSelectedId(id);
      setShowMultiCollection(false);
      setSuccess('تم تأكيد التحصيل المتعدد وترحيل القيد المحاسبي');
      invalidateQuery([listKey]);
      invalidateQuery([listKey, 'one', id]);
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
  const rowActionClass =
    'rounded-md border border-[#D6EAF3] bg-white px-2 py-1 text-[11px] font-semibold text-[#094C6B] hover:border-[#0E78AA] hover:text-[#0E78AA]';

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
        docNumber={docNumber}
        statusTone={status.tone}
        statusLabel={status.label}
        saveLabel="حفظ"
        onSaveDraft={onSave}
        onCancel={() => void onCancelDoc()}
        cancelLabel="إلغاء"
        savePending={savePending}
        canSave={!savePending && !locked}
        hideStandalonePost
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
          hidePostActions: true,
          onNew: resetNew,
          newLabel: 'جديد',
          onUnpost: () => void onUnpostDoc(),
          extraItems: [
            {
              id: 'collect',
              label: 'تحصيل',
              disabled: Boolean(loaded?.isCancelled || loaded?.isPosted),
              onClick: () => openLifecycle('collect'),
            },
            {
              id: 'multi-collect',
              label: 'تحصيل متعدد',
              disabled: Boolean(loaded?.isCancelled),
              onClick: () => openLifecycle('multi'),
            },
            {
              id: 'bounce',
              label: 'ارتداد',
              disabled: Boolean(loaded?.isCancelled),
              onClick: () => openLifecycle('bounce'),
            },
            ...(kind === 'receipt'
              ? [
                  {
                    id: 'endorse',
                    label: 'تظهير',
                    disabled: Boolean(loaded?.isCancelled),
                    onClick: () => openLifecycle('endorse'),
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className={erpLabelClass}>العملة</label>
              <select className={erpInputClass} disabled={locked} {...register('currencyId')}>
                {currencies.map((currency) => (
                  <option key={currency.id} value={currency.id}>
                    {currency.arabicName || currency.englishName || currency.code}
                  </option>
                ))}
              </select>
            </div>
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
              <input className={erpInputClass} placeholder="المسلسل" disabled={locked} {...register('serial')} />
            </div>
            <div>
              <label className={erpLabelClass}>رقم الورقة</label>
              <input
                className={erpInputClass}
                placeholder="رقم الورقة"
                disabled={locked}
                {...register('securityNumber')}
              />
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
                  <label className="text-xs font-semibold text-foreground">{paidToLabel}</label>
                  <div className="mb-1.5 flex gap-2 text-xs">
                    <button
                      type="button"
                      disabled={locked}
                      className={`rounded-md px-2 py-0.5 ${partyType === 'customer' ? 'bg-[#0E78AA] text-white' : 'bg-[#EAF6FB] text-[#094C6B]'}`}
                      onClick={() => {
                        setValue('partyType', 'customer', { shouldValidate: true });
                        setValue('partyId', '', { shouldValidate: false });
                      }}
                    >
                      عميل
                    </button>
                    <button
                      type="button"
                      disabled={locked}
                      className={`rounded-md px-2 py-0.5 ${partyType === 'account' ? 'bg-[#0E78AA] text-white' : 'bg-[#EAF6FB] text-[#094C6B]'}`}
                      onClick={() => {
                        setValue('partyType', 'account', { shouldValidate: true });
                        setValue('partyId', '', { shouldValidate: false });
                      }}
                    >
                      حساب آخر
                    </button>
                  </div>
                  {partyType === 'customer' ? (
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
                  ) : (
                    <AccountSelect
                      value={partyId}
                      onChange={(id) => applyParty(id)}
                      className={erpInputClass}
                      disabled={locked}
                      leafOnly={false}
                      placeholder="اختر الحساب من الدليل كله"
                      emptyLabel="اختر الحساب من الدليل كله"
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
            />
            <SecuritiesDateHijriField
              label="تاريخ الاستحقاق"
              gregorian={dueDate || ''}
              hijri={watch('dueHijriDate') || ''}
              onGregorianChange={(v) => setValue('dueDate', v, { shouldValidate: false })}
            />
            <div>
              <label className={erpLabelClass}>المبلغ</label>
              <input
                inputMode="decimal"
                className={`${erpInputClass} ${errors.amount ? erpInputErrorClass : ''}`}
                placeholder="0.00"
                disabled={locked}
                {...register('amount')}
              />
              <ErpFieldError message={errors.amount?.message} show={Boolean(errors.amount)} />
              <button
                type="button"
                className="mt-1.5 text-xs font-semibold text-[#0E78AA] hover:underline"
                onClick={() => {
                  if (!selectedId && !loaded?.id) {
                    setError('احفظ الورقة أولاً قبل التحصيل المتعدد');
                    return;
                  }
                  setActionPaperId(selectedId || loaded?.id || null);
                  setShowMultiCollection(true);
                }}
              >
                تحصيل متعدد
              </button>
            </div>
            <div>
              <label className={erpLabelClass}>الشرح / البيان</label>
              <input className={erpInputClass} placeholder="الشرح" disabled={locked} {...register('description')} />
            </div>
            <div>
              <label className={erpLabelClass}>الحساب</label>
              <AccountSelect
                value={watch('accountId') || ''}
                onChange={(id) => setValue('accountId', id, { shouldValidate: false })}
                className={erpInputClass}
                leafOnly={false}
                disabled={locked}
                placeholder="اختر الحساب من الدليل كله"
                emptyLabel="اختر الحساب من الدليل كله"
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
        journalEntryId={loaded?.journalEntryId}
        showJournalTab
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
          rowActions={(row) => (
            <>
              <button
                type="button"
                className={rowActionClass}
                onClick={() => {
                  setSelectedId(row.id);
                  setActionPaperId(row.id);
                  setShowList(false);
                  setShowCollect(true);
                }}
              >
                تحصيل
              </button>
              <button
                type="button"
                className={rowActionClass}
                onClick={() => {
                  setSelectedId(row.id);
                  setActionPaperId(row.id);
                  setShowList(false);
                  setShowMultiCollection(true);
                }}
              >
                تحصيل متعدد
              </button>
              <button
                type="button"
                className={rowActionClass}
                onClick={() => {
                  setSelectedId(row.id);
                  setActionPaperId(row.id);
                  setShowList(false);
                  setShowReturn(true);
                }}
              >
                ارتداد
              </button>
              {kind === 'receipt' ? (
                <button
                  type="button"
                  className={rowActionClass}
                  onClick={() => {
                    setSelectedId(row.id);
                    setActionPaperId(row.id);
                    setShowList(false);
                    setShowEndorse(true);
                  }}
                >
                  تظهير
                </button>
              ) : null}
            </>
          )}
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
        onClose={() => setShowCollect(false)}
        onDone={(record) => {
          setSelectedId(record.id);
          setLoaded(record);
          setSuccess('تم تحصيل الورقة بنجاح');
          invalidateQuery([listKey]);
        }}
      />
      <SecuritiesBounceModal
        open={showReturn}
        apiPath={apiPath}
        paperId={actionId}
        onClose={() => setShowReturn(false)}
        onDone={(record) => {
          setSelectedId(record.id);
          setLoaded(record);
          setSuccess('تم ارتداد الورقة بنجاح');
          invalidateQuery([listKey]);
        }}
      />
      {kind === 'receipt' ? (
        <SecuritiesEndorseModal
          open={showEndorse}
          apiPath={apiPath}
          paperId={actionId}
          onClose={() => setShowEndorse(false)}
          onDone={(record) => {
            setSelectedId(record.id);
            setLoaded(record);
            setSuccess('تم تظهير الورقة بنجاح');
            invalidateQuery([listKey]);
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
