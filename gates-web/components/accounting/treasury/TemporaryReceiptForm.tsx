'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm, useWatch, type Resolver, type SubmitHandler, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, CompactFormField, compactControlClass } from '@/components/ui';
import { toast } from '@/lib/feedback/toast';
import { confirmAction } from '@/lib/feedback/confirm';
import { printOperationalDocument } from '@/lib/print/printOperationalDocument';
import { ErpDocumentLayout } from '@/components/erp/ErpDocumentLayout';
import { ErpFormHeaderCard } from '@/components/erp/ErpFormHeaderCard';
import { DocumentBrowseDrawer } from '@/components/erp/DocumentBrowseDrawer';
import { DocumentModeProvider, useDocumentMode } from '@/components/common/document-shell';
import ErrorToast from '@/components/ErrorToast';
import SuccessToast from '@/components/SuccessToast';
import { useApiMutation, useApiQuery, useInvalidateQuery } from '@/lib/hooks/useApi';
import { pickDefaultSafeId, useLiveFundBalance, useSafesQuery } from '@/lib/hooks/useMasterDataQueries';
import { CashSafeHeaderSelector } from '@/components/accounting/vouchers/CashSafeHeaderSelector';
import { parseDecimal } from '@/lib/money/parseDecimal';
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
import { useDraftAutosave } from '@/lib/hooks/useDraftAutosave';
import { PageDraftRestoreGate } from '@/components/erp/PageDraftRestoreGate';
import { maybeAutoPrintAfterSave } from '@/lib/printer/print-prefs';
import { STORE_SAVE_AND_POST_LABEL } from '@/lib/inventory/store-document-save-post';
import {
  documentSerialPlaceholder,
  isTransactionSerialAutomatic,
} from '@/lib/transaction-settings/serial-mode';
import type { TransactionSettings } from '@/lib/transaction-settings/types';

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

type TemporaryReceiptDraft = TreasuryTempReceiptFormInput;

function isTemporaryReceiptDraftEmpty(draft: TemporaryReceiptDraft) {
  const amount = parseFloat(String(draft.amount || '').replace(/,/g, '')) || 0;
  return (
    !String(draft.serial ?? '').trim() &&
    !String(draft.description ?? '').trim() &&
    !String(draft.recipient ?? '').trim() &&
    amount <= 0
  );
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

const TEMP_RECEIPT_NEXT_NUMBER_KEY = ['temp-receipt-next-number'] as const;

function TemporaryReceiptFormInner() {
  const invalidateQuery = useInvalidateQuery();
  const { isReadOnly, unlockForEdit, lockToView, setMode } = useDocumentMode();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<TempReceiptRecord | null>(null);
  const [browseOpen, setBrowseOpen] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const { data: txSettingsRes } = useApiQuery<TransactionSettings>(
    ['transaction-settings', 'TEMPORARY_RECEIPT'],
    '/transaction-settings/TEMPORARY_RECEIPT'
  );
  const txSettings = txSettingsRes?.data;
  const autoNumbering = isTransactionSerialAutomatic(txSettings?.numberingMode);
  const autoPostOnSave = txSettings?.autoPostOnSave === true;
  const autoPrintOnSave = txSettings?.autoPrintOnSave === true;

  const { data: safesResponse } = useSafesQuery();
  const safes = safesResponse?.data || [];
  const settingsSafeId =
    txSettings?.defaultSafeId && safes.some((safe) => safe.id === txSettings.defaultSafeId)
      ? txSettings.defaultSafeId
      : '';
  const defaultSafeId = settingsSafeId || pickDefaultSafeId(safes);
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
    { limit: 200, page: 1, voucherFamily: 'TEMP' },
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
  const { data: liveSafeResponse } = useLiveFundBalance({ kind: 'safe', id: safeId });
  const selectedSafe = safes.find((safe) => safe.id === safeId);
  const safeBalance = parseDecimal(liveSafeResponse?.data?.balance ?? selectedSafe?.balance);
  const currencyId = watch('currencyId');
  const exchangeRateWatch = watch('exchangeRate');
  const amountWatch = watch('amount');
  const serial = watch('serial');
  const date = watch('date');
  const isSettled = watch('isSettled');
  const recipient = watch('recipient');

  const { data: nextNumberRes } = useApiQuery<{ automatic: boolean; number: string }>(
    TEMP_RECEIPT_NEXT_NUMBER_KEY,
    '/accounting/treasury-receipts/next-number',
    undefined,
    { enabled: !selectedId, staleTime: 0 }
  );

  useEffect(() => {
    if (selectedId || loaded) return;
    if (!safes.length || !defaultSafeId) return;
    if (!safeId) {
      setValue('safeId', defaultSafeId, { shouldValidate: false });
      return;
    }
    if (settingsSafeId && safeId !== settingsSafeId) {
      const companyDefault = pickDefaultSafeId(safes);
      if (safeId === companyDefault) {
        setValue('safeId', settingsSafeId, { shouldValidate: false });
      }
    }
  }, [defaultSafeId, loaded, safeId, safes, selectedId, setValue, settingsSafeId]);

  useEffect(() => {
    if (selectedId || loaded || !autoNumbering) return;
    const preview = nextNumberRes?.data?.number?.trim();
    if (preview && preview !== serial) {
      setValue('serial', preview, { shouldDirty: false, shouldValidate: false });
    }
  }, [autoNumbering, loaded, nextNumberRes?.data?.number, selectedId, serial, setValue]);

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
  const formSnapshot = useWatch({ control }) as TreasuryTempReceiptFormInput;
  const draftSnapshot = useMemo<TemporaryReceiptDraft>(
    () => ({
      ...emptyForm(currencies, defaultSafeId),
      ...formSnapshot,
    }),
    [currencies, defaultSafeId, formSnapshot]
  );
  const applyTemporaryReceiptDraft = useCallback(
    (payload: TemporaryReceiptDraft) => {
      reset({
        ...emptyForm(currencies, defaultSafeId),
        ...payload,
      });
    },
    [currencies, defaultSafeId, reset]
  );
  const { restoreOffer, acceptRestore, dismissRestore, clearDraft } = useDraftAutosave({
    documentType: 'temporary-receipt',
    mode: selectedId ? 'edit' : 'new',
    documentId: selectedId,
    value: draftSnapshot,
    enabled: !Boolean(loaded?.isPosted || loaded?.isApproved || loaded?.isCancelled),
    applyRestore: applyTemporaryReceiptDraft,
    isEmpty: isTemporaryReceiptDraftEmpty,
    restoreMessage: 'يوجد مسودة إيصال مؤقت غير محفوظة',
  });

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
    if (row.isPosted || row.isApproved || row.isCancelled) lockToView();
    else unlockForEdit();
  };

  const finishSave = (row: TempReceiptRecord | undefined, message: string) => {
    invalidateQuery(['treasury-receipts']);
    invalidateQuery(TEMP_RECEIPT_NEXT_NUMBER_KEY);
    clearDraft();
    if (row?.id) applyRecord(row);
    maybeAutoPrintAfterSave(autoPrintOnSave, () => printReceipt(row));
    setSuccess(message);
  };

  const createMutation = useApiMutation<TempReceiptRecord, Record<string, unknown>>(
    '/accounting/treasury-receipts',
    'POST',
    {
      showSuccessToast: false,
      onSuccess: (res) => {
        finishSave(res.data, autoPostOnSave ? 'تم حفظ وتأكيد الإيصال المؤقت' : 'تم حفظ الإيصال المؤقت بنجاح');
      },
      onError: (err: ApiError) => setError(err.message || 'حدث خطأ أثناء الحفظ'),
    }
  );

  const updateMutation = useApiMutation<TempReceiptRecord, Record<string, unknown>>(
    selectedId ? `/accounting/treasury-receipts/${selectedId}` : '/accounting/treasury-receipts',
    'PUT',
    {
      showSuccessToast: false,
      onSuccess: (res) => {
        finishSave(res.data ?? loaded ?? undefined, 'تم تحديث الإيصال المؤقت بنجاح');
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
    voucherNumber: autoNumbering ? undefined : values.serial?.trim() || undefined,
    serial: autoNumbering ? undefined : values.serial?.trim() || undefined,
    description: values.description || undefined,
    safeId: values.safeId,
    recipient: values.recipient,
    isSettled: values.isSettled,
  });

  const onValid: SubmitHandler<TreasuryTempReceiptFormInput> = (values) => {
    setError('');
    setSuccess('');
    if (!autoNumbering && !values.serial?.trim()) {
      setError('رقم الإيصال مطلوب — الترقيم يدوي في إعدادات المستند');
      return;
    }
    if (selectedId && !isReadOnly) {
      updateMutation.mutate(buildPayload(values));
      return;
    }
    createMutation.mutate(buildPayload(values));
  };

  const resetNew = () => {
    clearDraft();
    reset(emptyForm(currencies, defaultSafeId));
    setSelectedId(null);
    setLoaded(null);
    setError('');
    setSuccess('');
    setMode('create');
    invalidateQuery(TEMP_RECEIPT_NEXT_NUMBER_KEY);
  };

  const printReceipt = (row?: TempReceiptRecord | null) => {
    void printOperationalDocument({
      title: 'إيصال استلام مؤقت',
      documentNo: row?.voucherNumber || row?.serial || receiptNumber || 'جديد',
      documentDate: (row?.date ? String(row.date).slice(0, 10) : date) || new Date().toISOString().slice(0, 10),
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

  const handlePrint = () => printReceipt(loaded);

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
      <PageDraftRestoreGate<TemporaryReceiptDraft>
        restoreOffer={restoreOffer}
        hide={Boolean(selectedId)}
        message="يوجد مسودة إيصال مؤقت غير محفوظة."
        acceptRestore={acceptRestore}
        dismissRestore={dismissRestore}
        onRestored={(payload) => {
          applyTemporaryReceiptDraft(payload);
          setSuccess('تم استعادة مسودة الإيصال المؤقت');
        }}
      />
      <div className="flex min-h-[calc(100dvh-3rem)] flex-col pb-20">
      <TemporaryReceiptHeader
        receiptNumber={receiptNumber}
        documentId={selectedId || loaded?.id || null}
        isConfirmed={isConfirmed}
        hasDocument={hasDocument}
        isCancelled={loaded?.isCancelled}
        receiptDate={date}
        onReceiptDateChange={(v) => setValue('date', v, { shouldValidate: true })}
        dateError={Boolean(errors.date)}
        savePending={saving}
        canSave={!isReadOnly}
        saveLabel={autoPostOnSave ? STORE_SAVE_AND_POST_LABEL : 'حفظ الإيصال'}
        onSave={() => void handleSubmit(onValid, onFieldErrors(setError))()}
        onNew={resetNew}
        onBrowseList={() => setBrowseOpen(true)}
        onEdit={unlockForEdit}
        onPrint={handlePrint}
        onCancelReceipt={handleCancelReceipt}
        onTransactionSettingsSaved={() => {
          invalidateQuery(['transaction-settings', 'TEMPORARY_RECEIPT']);
          invalidateQuery(TEMP_RECEIPT_NEXT_NUMBER_KEY);
        }}
        extraFields={
          <ErpFormHeaderCard
            row1={
              <>
                <CompactFormField
                  label="المسلسل"
                  placeholder={documentSerialPlaceholder(autoNumbering)}
                  disabled={isReadOnly || autoNumbering}
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
                <div className="min-w-[16rem] flex-1">
                  <CashSafeHeaderSelector
                    safes={safes}
                    value={safeId || ''}
                    onChange={(id) => setValue('safeId', id, { shouldDirty: true, shouldValidate: true })}
                    disabled={isReadOnly}
                    error={Boolean(errors.safeId)}
                    errorMessage={errors.safeId?.message}
                    baseCurrency={companyBaseCurrency}
                    displayBalance={safeBalance}
                  />
                </div>
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
