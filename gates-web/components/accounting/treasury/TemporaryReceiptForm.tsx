'use client';

import { useEffect, useMemo, useState } from 'react';
import { useForm, type Resolver, type SubmitHandler, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, CompactFormField, compactControlClass } from '@/components/ui';
import { toast } from '@/lib/feedback/toast';
import { confirmAction } from '@/lib/feedback/confirm';
import { deleteDraftDocument, isDraftDocumentRow } from '@/lib/documents/deleteDraftDocument';
import { printOperationalDocument } from '@/lib/print/printOperationalDocument';
import { ErpDocumentLayout } from '@/components/erp/ErpDocumentLayout';
import { ErpFormHeaderCard } from '@/components/erp/ErpFormHeaderCard';
import { DocumentBrowseDrawer } from '@/components/erp/DocumentBrowseDrawer';
import { DocumentModeProvider, useDocumentMode } from '@/components/common/document-shell';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';
import { useApiMutation, useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';
import { pickDefaultSafeId, useSafesQuery } from '@/lib/hooks/useMasterDataQueries';
import { SafeSelect } from '@/app/components/form/SafeSelect';
import { apiClient } from '@/lib/api/client';
import { toHijriDate } from '@/lib/hijri-date';
import type { ApiError } from '@/lib/api/types';
import { onFieldErrors } from '@/lib/forms/on-field-errors';
import {
  treasuryTempReceiptFormSchema,
  type TreasuryTempReceiptFormInput,
} from '@/lib/validation/accounting.schema';
import { TemporaryReceiptHeader } from './TemporaryReceiptHeader';
import { TemporaryReceiptStickyFooter } from './TemporaryReceiptStickyFooter';
import { pickCurrencyByCode, rateForCurrency } from '@/lib/accounting/fx-base';
import { useCompanyBaseCurrency } from '@/lib/hooks/useCompanyBaseCurrency';
import { DocumentCurrencyRateFields } from '@/components/accounting/DocumentCurrencyRateFields';

type Safe = { id: string; arabicName: string; englishName?: string };
type Currency = {
  id: string;
  code: string;
  arabicName: string;
  englishName?: string;
  exchangeRate?: number | string | null;
};
type TempReceiptRecord = {
  id: string;
  serial?: string | null;
  voucherNumber?: string | null;
  date?: string;
  hijriDate?: string | null;
  description?: string | null;
  amount?: number | string;
  currencyCode?: string;
  exchangeRate?: number | string | null;
  safeId?: string | null;
  isPosted?: boolean;
  isApproved?: boolean;
  isCancelled?: boolean;
};

function todayIso() {
  return new Date().toISOString().split('T')[0];
}

function defaultCurrencyId(currencies: Currency[], companyBase = 'EGP') {
  if (!currencies.length) return '';
  return pickCurrencyByCode(currencies, companyBase)?.id || currencies[0].id;
}

function emptyForm(currencies: Currency[], defaultSafeId = ''): TreasuryTempReceiptFormInput {
  return {
    date: todayIso(),
    serial: '',
    description: '',
    amount: '',
    recipient: '',
    isSettled: false,
    safeId: defaultSafeId,
    currencyId: defaultCurrencyId(currencies),
    exchangeRate: 1,
  };
}

function TemporaryReceiptFormInner() {
  const invalidateQuery = useInvalidateQuery();
  const { isReadOnly, unlockForEdit, lockToView, setMode } = useDocumentMode();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<TempReceiptRecord | null>(null);
  const [browseOpen, setBrowseOpen] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const { data: safesResponse } = useSafesQuery();
  const safes = safesResponse?.data || [];
  const defaultSafeId = pickDefaultSafeId(safes);
  const { data: currenciesResponse } = useApiQuery<Currency[]>(
    ['currencies'],
    '/accounting/currencies',
    { limit: 100, isActive: true }
  );
  const currencies = useMemo(() => currenciesResponse?.data || [], [currenciesResponse?.data]);
  const { code: companyBaseCurrency } = useCompanyBaseCurrency();

  const { data: browseResponse } = useApiQuery<TempReceiptRecord[]>(
    ['treasury-receipts', 'temp-browse'],
    '/accounting/treasury-receipts',
    { limit: 200, page: 1, receiptType: 'cash' },
    { enabled: browseOpen, staleTime: 20_000 }
  );
  const previousReceipts = useMemo(() => browseResponse?.data ?? [], [browseResponse?.data]);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    control,
    formState: { errors },
  } = useForm<TreasuryTempReceiptFormInput>({
    resolver: zodResolver(treasuryTempReceiptFormSchema) as Resolver<TreasuryTempReceiptFormInput>,
    defaultValues: emptyForm([]),
    mode: 'onTouched',
  });

  const safeId = watch('safeId');
  const currencyId = watch('currencyId');
  const exchangeRateWatch = watch('exchangeRate');
  const amountWatch = watch('amount');
  const serial = watch('serial');
  const date = watch('date');
  const isSettled = watch('isSettled');
  const recipient = watch('recipient');

  useEffect(() => {
    if (selectedId || loaded || safeId || !defaultSafeId) return;
    setValue('safeId', defaultSafeId, { shouldValidate: false });
  }, [defaultSafeId, loaded, safeId, selectedId, setValue]);

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

  const selectedCurrency = currencies.find((c) => c.id === currencyId);
  const totalAmount = parseFloat(String(amountWatch || '').replace(/,/g, '')) || 0;
  const isConfirmed = Boolean(loaded?.isPosted || loaded?.isApproved || isSettled);
  const receiptNumber = serial || loaded?.voucherNumber || loaded?.serial || '';
  const hasDocument = Boolean(selectedId || loaded?.id);

  const applyRecord = (row: TempReceiptRecord) => {
    const currency = currencies.find((c) => c.code === row.currencyCode);
    reset({
      date: row.date ? String(row.date).slice(0, 10) : todayIso(),
      serial: row.serial || row.voucherNumber || '',
      description: row.description || '',
      amount: String(row.amount ?? ''),
      recipient: '',
      isSettled: Boolean(row.isPosted || row.isApproved),
      safeId: row.safeId || '',
      currencyId: currency?.id || defaultCurrencyId(currencies, companyBaseCurrency),
      exchangeRate: rateForCurrency(
        row.currencyCode,
        companyBaseCurrency,
        currency?.exchangeRate ?? row.exchangeRate
      ),
    });
    setSelectedId(row.id);
    setLoaded(row);
    lockToView();
  };

  const createMutation = useApiMutation<TempReceiptRecord, Record<string, unknown>>(
    '/accounting/treasury-receipts',
    'POST',
    {
      showSuccessToast: false,
      onSuccess: () => {
        invalidateQuery(['treasury-receipts']);
        resetNew();
        setSuccess('تم حفظ الإيصال المؤقت بنجاح');
      },
      onError: (err: ApiError) => setError(err.message || 'حدث خطأ أثناء الحفظ'),
    }
  );

  const updateMutation = useApiMutation<TempReceiptRecord, Record<string, unknown>>(
    selectedId ? `/accounting/treasury-receipts/${selectedId}` : '/accounting/treasury-receipts',
    'PUT',
    {
      showSuccessToast: false,
      onSuccess: () => {
        invalidateQuery(['treasury-receipts']);
        resetNew();
        setSuccess('تم تحديث الإيصال المؤقت بنجاح');
      },
      onError: (err: ApiError) => setError(err.message || 'حدث خطأ أثناء التحديث'),
    }
  );

  const buildPayload = (values: TreasuryTempReceiptFormInput) => ({
    receiptType: 'cash' as const,
    amount: parseFloat(String(values.amount).replace(/,/g, '')),
    date: new Date(values.date).toISOString(),
    hijriDate: toHijriDate(values.date),
    currencyCode: selectedCurrency?.code || 'EGP',
    exchangeRate:
      Number(values.exchangeRate) > 0
        ? Number(values.exchangeRate)
        : rateForCurrency(selectedCurrency?.code, companyBaseCurrency, selectedCurrency?.exchangeRate),
    voucherNumber: values.serial || undefined,
    serial: values.serial || undefined,
    description: values.description || undefined,
    safeId: values.safeId,
    recipient: values.recipient,
    isSettled: values.isSettled,
  });

  const onValid: SubmitHandler<TreasuryTempReceiptFormInput> = (values) => {
    setError('');
    setSuccess('');
    if (selectedId && !isReadOnly) {
      updateMutation.mutate(buildPayload(values));
      return;
    }
    createMutation.mutate(buildPayload(values));
  };

  const resetNew = () => {
    reset(emptyForm(currencies, defaultSafeId));
    setSelectedId(null);
    setLoaded(null);
    setError('');
    setSuccess('');
    setMode('create');
  };

  const handlePrint = () => {
    void printOperationalDocument({
      title: 'إيصال استلام مؤقت',
      documentNo: receiptNumber || 'مسودة',
      documentDate: date || new Date().toISOString().slice(0, 10),
      buyerName: recipient || undefined,
      currency: selectedCurrency?.code,
      lines: [
        {
          description: watch('description') || 'إيصال استلام مؤقت',
          quantity: 1,
          unitPrice: totalAmount,
          total: totalAmount,
        },
      ],
    });
  };

  const handleDuplicate = () => {
    setSelectedId(null);
    setLoaded(null);
    setValue('serial', '');
    setMode('create');
    setSuccess('تم تجهيز نسخة جديدة من الإيصال');
  };

  const handleCancelReceipt = async () => {
    if (!selectedId) return;
    if (!(await confirmAction('هل تريد إلغاء هذا الإيصال المؤقت؟'))) return;
    try {
      await apiClient.post(`/accounting/treasury-receipts/${selectedId}/cancel`);
      invalidateQuery(['treasury-receipts']);
      setSuccess('تم إلغاء الإيصال');
      resetNew();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر إلغاء الإيصال');
    }
  };

  const saving = createMutation.isPending || updateMutation.isPending;
  const browseRows = useMemo(() => previousReceipts, [previousReceipts]);

  return (
    <ErpDocumentLayout>
      <div className="flex min-h-[calc(100dvh-3rem)] flex-col pb-20">
      <TemporaryReceiptHeader
        receiptNumber={receiptNumber}
        isConfirmed={isConfirmed}
        hasDocument={hasDocument}
        isReadOnly={isReadOnly}
        isCancelled={loaded?.isCancelled}
        receiptDate={date}
        onReceiptDateChange={(v) => setValue('date', v, { shouldValidate: true })}
        dateError={Boolean(errors.date)}
        savePending={saving}
        canSave={!isReadOnly}
        onSave={() => void handleSubmit(onValid, onFieldErrors(setError))()}
        onBrowseList={() => setBrowseOpen(true)}
        onEdit={unlockForEdit}
        onPrint={handlePrint}
        onDuplicate={handleDuplicate}
        onCancelReceipt={handleCancelReceipt}
        extraFields={
          <ErpFormHeaderCard
            row1={
              <>
                <CompactFormField
                  label="المسلسل"
                  placeholder="رقم الإيصال"
                  disabled={isReadOnly}
                  {...register('serial')}
                />
                <CompactFormField
                  label="المبلغ"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  disabled={isReadOnly}
                  error={errors.amount?.message}
                  {...register('amount')}
                />
                <CompactFormField
                  label="المستلم"
                  placeholder="اسم المستلم"
                  disabled={isReadOnly}
                  error={errors.recipient?.message}
                  {...register('recipient')}
                />
                <DocumentCurrencyRateFields
                  currencies={currencies}
                  currencyId={currencyId}
                  exchangeRate={Number(exchangeRateWatch) > 0 ? Number(exchangeRateWatch) : 1}
                  companyBaseCode={companyBaseCurrency}
                  disabled={isReadOnly}
                  amount={totalAmount}
                  showEquivalent
                  selectClassName={compactControlClass}
                  onCurrencyIdChange={(id, nextRate) => {
                    setValue('currencyId', id, { shouldDirty: true, shouldValidate: true });
                    setValue('exchangeRate', nextRate, { shouldDirty: true });
                  }}
                  onExchangeRateChange={(rate) => setValue('exchangeRate', rate, { shouldDirty: true })}
                />
              </>
            }
            row2={
              <>
                <CompactFormField label="الصندوق" error={errors.safeId?.message}>
                  <Controller
                    name="safeId"
                    control={control}
                    render={({ field }) => (
                      <SafeSelect
                        value={field.value || ''}
                        onChange={field.onChange}
                        disabled={isReadOnly}
                        safes={safes}
                        placeholder="اختر الصندوق"
                        emptyLabel="اختر الصندوق"
                        className={`${compactControlClass} ${errors.safeId ? 'border-red-400' : ''}`}
                      />
                    )}
                  />
                </CompactFormField>
                <CompactFormField label="تم تصفيته / تأكيده">
                  <div className="flex h-9 items-center">
                    <Controller
                      name="isSettled"
                      control={control}
                      render={({ field: { value, onChange } }) => (
                        <input
                          type="checkbox"
                          className="h-5 w-5 accent-[#0E78AA]"
                          checked={value}
                          disabled={isReadOnly}
                          onChange={(e) => onChange(e.target.checked)}
                        />
                      )}
                    />
                  </div>
                </CompactFormField>
                <CompactFormField label="الشرح">
                  <textarea
                    className={`${compactControlClass} min-h-[72px] resize-y`}
                    disabled={isReadOnly}
                    placeholder="بيان الإيصال"
                    {...register('description')}
                  />
                </CompactFormField>
              </>
            }
          />
        }
      />

      {error ? <ErrorToast message={error} onClose={() => setError('')} /> : null}
      {success ? <SuccessToast message={success} onClose={() => setSuccess('')} /> : null}

      <TemporaryReceiptStickyFooter
        isConfirmed={isConfirmed}
        totalAmount={totalAmount}
        currencyCode={selectedCurrency?.code}
        isSubmitting={saving}
        canSave={!isReadOnly}
        onSave={() => void handleSubmit(onValid, onFieldErrors(setError))()}
        onCancel={resetNew}
      />

      <DocumentBrowseDrawer
        open={browseOpen}
        onClose={() => setBrowseOpen(false)}
        title="الإيصالات المؤقتة السابقة"
      >
        {browseRows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">لا توجد إيصالات سابقة</p>
        ) : (
          <ul className="divide-y divide-border/70">
            {browseRows.map((row) => (
              <li key={row.id} className="flex items-center gap-2 px-2">
                <button
                  type="button"
                  className={`flex min-w-0 flex-1 items-center justify-between px-3 py-2.5 text-right text-sm hover:bg-muted/40 ${
                    selectedId === row.id ? 'bg-primary/5' : ''
                  }`}
                  onClick={() => {
                    applyRecord(row);
                    setBrowseOpen(false);
                  }}
                >
                  <span className="font-mono font-semibold text-primary">
                    {row.voucherNumber || row.serial || row.id.slice(0, 8)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {row.date ? new Date(row.date).toLocaleDateString('ar-EG') : '—'} —{' '}
                    {Number(row.amount || 0).toLocaleString('ar-EG', { minimumFractionDigits: 2 })}
                  </span>
                </button>
                {isDraftDocumentRow(row) ? (
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={async () => {
                      if (!(await confirmAction('حذف هذه المسودة؟'))) return;
                      try {
                        await deleteDraftDocument('/accounting/treasury-receipts', row.id);
                        toast.success('تم حذف المسودة');
                        invalidateQuery(['treasury-receipts']);
                        if (selectedId === row.id) resetNew();
                      } catch (error) {
                        toast.error(error instanceof Error ? error.message : 'تعذر حذف المسودة');
                      }
                    }}
                  >
                    حذف المسودة
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </DocumentBrowseDrawer>
      </div>
    </ErpDocumentLayout>
  );
}

export function TemporaryReceiptForm() {
  return (
    <DocumentModeProvider initialMode="create">
      <TemporaryReceiptFormInner />
    </DocumentModeProvider>
  );
}
