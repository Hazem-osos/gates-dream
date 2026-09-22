'use client';

import { Controller, useWatch, type Control, type FieldErrors, type UseFormRegister, type UseFormSetValue } from 'react-hook-form';
import dynamic from 'next/dynamic';
import { useEffect, type ReactNode } from 'react';
import { Button } from '@/components/ui';
import { CustomerSelect } from '@/components/form/PartySelect';
import { DynamicModalSkeleton } from '@/components/ui/DynamicChunkSkeleton';
import { WarehouseSelect } from '@/components/form/WarehouseSelect';
import { CostCenterSelect } from '@/components/form/CostCenterSelect';
import type { SalesInvoiceFormValues } from '@/lib/validation/inventory.schema';
import { PRICING_CALCULATION_BASIS_LABELS } from '@/lib/invoices/unit-conversion';
import { toHijriDate } from '@/lib/hijri-date';
import { DatePickerWithHijri } from '@/components/ui/DatePickerWithHijri';
import {
  ErpFormHeaderCard,
  ErpFieldError,
  RequiredDot,
  erpInputClass,
  erpInputErrorClass,
  erpLabelClass,
  erpFormGridClass,
} from '@/components/erp';
import { useClientMounted } from '@/lib/hooks/useClientMounted';
import { isCompanyBaseCurrency, isFxRateLocked, rateForCurrency } from '@/lib/accounting/fx-base';
import { useFollowCurrencyCardRate } from '@/lib/hooks/useFollowCurrencyCardRate';
import { ExchangeRateInput } from '@/components/accounting/ExchangeRateInput';
import { useCompanyBaseCurrency } from '@/lib/hooks/useCompanyBaseCurrency';
import { InvoiceSourceDocumentControl } from '@/components/invoices/InvoiceSourceDocumentControl';
import { InvoiceCashTenderPanel } from '@/components/invoices/InvoiceCashTenderPanel';
import type { SourceHydratePayload } from '@/lib/invoices/sourceDocument';
import { formatUserDisplayName } from '@/lib/user/profile';
import type { CashTenderKind, InvoiceChequeDraft } from '@/lib/invoices/cash-tender';
import { summarizePaymentSplits, type PaymentSplitLine } from '@/lib/invoices/payment-split.types';

const CustomerQuickAddModal = dynamic(
  () =>
    import('@/app/components/form/CustomerQuickAddModal').then((m) => ({
      default: m.CustomerQuickAddModal,
    })),
  { ssr: false, loading: () => <DynamicModalSkeleton label="جاري تحميل إضافة عميل…" /> }
);

type Currency = { id: string; code: string; arabicName: string; exchangeRate?: number | string | null };
type Delegate = { id: string; code: string; arabicName: string };
type SellerUser = {
  id: string;
  username: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
};
type ConvertedFromInvoice = {
  id: string;
  invoiceNumber?: string | null;
  invoiceKind?: string | null;
  date?: string | Date | null;
};

const TAX_TREATMENT_LABELS: Record<string, string> = {
  taxable: 'خاضعة للضريبة',
  exempt: 'معفاة من الضريبة',
  export: 'تصدير (نسبة صفرية)',
};

type Props = {
  control: Control<SalesInvoiceFormValues>;
  register: UseFormRegister<SalesInvoiceFormValues>;
  setValue: UseFormSetValue<SalesInvoiceFormValues>;
  errors: FieldErrors<SalesInvoiceFormValues>;
  paymentMethod: 'cash' | 'credit' | 'split';
  safes?: Array<{ id: string; arabicName?: string; code?: string | null }>;
  onConfigureSplit?: () => void;
  onConfigureInstallments?: () => void;
  onLinkAdvance?: () => void;
  installmentCount?: number;
  paymentSplits?: PaymentSplitLine[];
  isSalesTaxInvoice: boolean;
  onSalesTaxChange: (v: boolean) => void;
  onOpenTerms?: () => void;
  currencies: Currency[];
  delegates: Delegate[];
  drivers: Delegate[];
  distributors: Delegate[];
  sellers: SellerUser[];
  currenciesLoading?: boolean;
  delegatesLoading?: boolean;
  driversLoading?: boolean;
  distributorsLoading?: boolean;
  sellersLoading?: boolean;
  showValidationErrors?: boolean;
  headerActions?: ReactNode;
  customerSeed?: { id: string; arabicName: string; code?: string | null } | null;
  /** Read-only reference chip surfacing the existing document-conversion link
   * (e.g. a sales order converted into this invoice) — no new field. */
  convertedFromInvoice?: ConvertedFromInvoice | null;
  lockWarehouse?: boolean;
  lockTreasury?: boolean;
  lockCostCenter?: boolean;
  hasExistingLines?: boolean;
  sourceDisabled?: boolean;
  fieldsDisabled?: boolean;
  headerExtrasOpen?: boolean;
  onHeaderExtrasOpenChange?: (open: boolean) => void;
  onSourceHydrate?: (payload: SourceHydratePayload) => void;
  includeAllAccounts?: boolean;
  cashTenderKind?: CashTenderKind;
  onCashTenderKind?: (kind: CashTenderKind) => void;
  cashBankAccountId?: string;
  onCashBankAccountId?: (id: string) => void;
  cashBankReference?: string;
  onCashBankReference?: (value: string) => void;
  cashChequeRows?: InvoiceChequeDraft[];
  onCashChequeRows?: (rows: InvoiceChequeDraft[]) => void;
  cashNetAmount?: number;
  cashChequeError?: string;
};

export function SalesInvoiceFormHeader({
  control,
  register,
  setValue,
  errors,
  paymentMethod,
  safes = [],
  isSalesTaxInvoice,
  onSalesTaxChange,
  onOpenTerms,
  onConfigureSplit,
  onConfigureInstallments,
  onLinkAdvance,
  installmentCount = 0,
  paymentSplits,
  currencies,
  delegates,
  drivers,
  distributors,
  sellers,
  currenciesLoading,
  delegatesLoading,
  driversLoading,
  distributorsLoading,
  sellersLoading,
  showValidationErrors = false,
  headerActions,
  customerSeed,
  convertedFromInvoice,
  lockWarehouse = false,
  lockTreasury = false,
  lockCostCenter = false,
  hasExistingLines = false,
  sourceDisabled = false,
  fieldsDisabled = false,
  headerExtrasOpen,
  onHeaderExtrasOpenChange,
  onSourceHydrate,
  includeAllAccounts = false,
  cashTenderKind = 'treasury',
  onCashTenderKind,
  cashBankAccountId = '',
  onCashBankAccountId,
  cashBankReference = '',
  onCashBankReference,
  cashChequeRows = [],
  onCashChequeRows,
  cashNetAmount = 0,
  cashChequeError,
}: Props) {
  const mounted = useClientMounted();
  const { code: companyBase } = useCompanyBaseCurrency();
  const delegatesBusy = mounted && Boolean(delegatesLoading);
  const driversBusy = mounted && Boolean(driversLoading);
  const distributorsBusy = mounted && Boolean(distributorsLoading);
  const sellersBusy = mounted && Boolean(sellersLoading);
  const currenciesBusy = mounted && Boolean(currenciesLoading);
  const err = (has?: boolean) => (showValidationErrors && has ? erpInputErrorClass : '');

  const handleCurrencyChange = (currencyId: string) => {
    const picked = currencies.find((c) => c.id === currencyId);
    setValue('exchangeRate', rateForCurrency(picked?.code, companyBase, picked?.exchangeRate), {
      shouldDirty: true,
    });
  };

  const currencyIdW = useWatch({ control, name: 'currencyId' });
  const exchangeRateW = useWatch({ control, name: 'exchangeRate' });
  const allowReturnW = useWatch({ control, name: 'allowReturn' });
  const selectedHeaderCurrency = currencies.find((c) => c.id === currencyIdW);
  const headerRateLocked = isFxRateLocked(selectedHeaderCurrency?.code, companyBase);
  const catalogHeaderRate = rateForCurrency(
    selectedHeaderCurrency?.code,
    companyBase,
    selectedHeaderCurrency?.exchangeRate
  );
  useFollowCurrencyCardRate(
    catalogHeaderRate,
    Number(exchangeRateW) || catalogHeaderRate,
    !headerRateLocked && !currenciesBusy,
    (rate) => setValue('exchangeRate', rate, { shouldDirty: true })
  );
  const sourceType = useWatch({ control, name: 'sourceType' });
  const sourceId = useWatch({ control, name: 'sourceId' });
  const sourceNumber = useWatch({ control, name: 'sourceNumber' });
  const invoiceDate = useWatch({ control, name: 'date' });
  const developmentFeeEnabled = useWatch({ control, name: 'developmentFeeEnabled' });
  const developmentFeeMode = useWatch({ control, name: 'developmentFeeMode' });
  const advancePaidAmount = useWatch({ control, name: 'advancePaidAmount' });
  const treasuryIdW = useWatch({ control, name: 'treasuryId' });
  const advanceSafeIdW = useWatch({ control, name: 'advanceSafeId' });
  const paymentMethodOptions = {
    onChange: (event: { target: { value: string } }) => {
      if (event.target.value === 'split') onConfigureSplit?.();
    },
  } as const;
  const splitSummary = summarizePaymentSplits(paymentSplits);
  useEffect(() => {
    setValue('hijriDate', toHijriDate(invoiceDate ?? ''), { shouldDirty: false, shouldValidate: false });
  }, [invoiceDate, setValue]);

  const row1 = (
    <>
      <div>
        <label className={erpLabelClass}>رقم الفاتورة</label>
        <input className={erpInputClass} placeholder="اختياري" {...register('invoiceNumber')} />
      </div>
      <div>
        <DatePickerWithHijri
          label="التاريخ"
          required
          value={invoiceDate ?? ''}
          error={!!errors.date}
          onChange={(next) => {
            setValue('date', next, { shouldDirty: true, shouldValidate: true });
            setValue('hijriDate', toHijriDate(next), { shouldDirty: false, shouldValidate: false });
          }}
        />
        <ErpFieldError message={errors.date?.message} show={showValidationErrors} />
      </div>
    </>
  );

  const row2 = (
    <>
      <div
        id="gates-tour-invoice-customer"
        data-tour="invoice-customer-select"
        data-tour-legacy="invoice-party-jit"
        className="gates-tour-party-jit-anchor min-h-[4.5rem]"
      >
        <label className={erpLabelClass}>
          العميل
          <RequiredDot hint="العميل مطلوب لإصدار الفاتورة" />
        </label>
        <Controller
          name="customerId"
          control={control}
          render={({ field }) => (
            <CustomerSelect
              value={field.value}
              onChange={field.onChange}
              seedParty={customerSeed?.id === field.value ? customerSeed : null}
              className={`${erpInputClass} ${err(!!errors.customerId)}`}
              quickCreateModal={CustomerQuickAddModal}
              includeAllAccounts={includeAllAccounts}
            />
          )}
        />
        <ErpFieldError message={errors.customerId?.message} show={showValidationErrors} />
      </div>
      <div>
        <label className={erpLabelClass}>البيان / الشرح</label>
        <input className={erpInputClass} placeholder="ملاحظات مختصرة" {...register('description')} />
      </div>
      <div>
        <label className={erpLabelClass}>
          المخزن الافتراضي
          <RequiredDot hint="يُستخدم كمخزن افتراضي لكل سطر — يمكن تغيير المخزن على مستوى الصنف" />
        </label>
        <Controller
          name="warehouseId"
          control={control}
          render={({ field }) => (
            <WarehouseSelect
              value={field.value}
              onChange={field.onChange}
              disabled={lockWarehouse}
              className={`${erpInputClass} ${err(!!errors.warehouseId)}`}
            />
          )}
        />
        <ErpFieldError message={errors.warehouseId?.message} show={showValidationErrors} />
      </div>
      <div className="min-w-[18rem]">
        <label className={erpLabelClass}>طريقة الدفع</label>
        <div
          className="flex min-h-10 flex-wrap rounded-lg border border-slate-200 overflow-hidden bg-slate-50 p-0.5 gap-0.5"
          data-tour="multi-tender-btn"
        >
          <label
            className={`flex-1 min-w-[4.5rem] flex items-center justify-center text-sm font-medium cursor-pointer rounded-md transition-colors ${
              paymentMethod === 'cash' ? 'bg-[#0E78AA] text-white shadow-sm' : 'text-slate-600 hover:bg-white'
            }`}
          >
            <input type="radio" value="cash" className="sr-only" {...register('paymentMethod', paymentMethodOptions)} />
            نقدي
          </label>
          <label
            className={`flex-1 min-w-[6.5rem] flex items-center justify-center text-sm font-medium cursor-pointer rounded-md transition-colors ${
              paymentMethod === 'credit' ? 'bg-[#0E78AA] text-white shadow-sm' : 'text-slate-600 hover:bg-white'
            }`}
          >
            <input type="radio" value="credit" className="sr-only" {...register('paymentMethod', paymentMethodOptions)} />
            آجل
          </label>
          <label
            className={`flex-1 min-w-[5.5rem] flex items-center justify-center text-sm font-medium cursor-pointer rounded-md transition-colors ${
              paymentMethod === 'split' ? 'bg-[#0E78AA] text-white shadow-sm' : 'text-slate-600 hover:bg-white'
            }`}
            data-academy-trigger-id="sales-invoice.tender-open-click"
            onClick={() => {
              if (paymentMethod === 'split') onConfigureSplit?.();
            }}
          >
            <input type="radio" value="split" className="sr-only" {...register('paymentMethod', paymentMethodOptions)} />
            دفع متعدد
          </label>
        </div>
        {onLinkAdvance ? (
          <div className="mt-2">
            <Button type="button" size="sm" variant="secondary" onClick={onLinkAdvance}>
              ربط دفعة مقدمة
            </Button>
          </div>
        ) : null}
        {paymentMethod === 'split' ? (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" onClick={onConfigureSplit}>
              توزيع المبالغ
            </Button>
            <Button type="button" size="sm" variant="secondary" onClick={onConfigureInstallments}>
              توزيع الدفعات
              {installmentCount > 0 ? (
                <span className="mr-1 inline-flex min-w-[1.15rem] items-center justify-center rounded-full bg-[#0E78AA]/15 px-1 text-[10px] text-[#094C6B]">
                  {installmentCount}
                </span>
              ) : null}
            </Button>
            {splitSummary ? <p className="w-full text-[11px] text-slate-500">{splitSummary}</p> : null}
          </div>
        ) : null}
        {paymentMethod === 'credit' ? (
          <div>
            <InvoiceCashTenderPanel
              kind={cashTenderKind}
              onKindChange={(kind) => {
                onCashTenderKind?.(kind);
                setValue('cashTenderKind', kind, { shouldDirty: true, shouldValidate: true });
              }}
              treasuryId={advanceSafeIdW || treasuryIdW || ''}
              onTreasuryId={(id) => {
                setValue('advanceSafeId', id, { shouldDirty: true, shouldValidate: true });
                if (!treasuryIdW) setValue('treasuryId', id, { shouldDirty: false });
              }}
              bankAccountId={cashBankAccountId}
              onBankAccountId={(id) => {
                onCashBankAccountId?.(id);
                setValue('cashBankAccountId', id, { shouldDirty: true, shouldValidate: true });
              }}
              bankReference={cashBankReference}
              onBankReference={(value) => {
                onCashBankReference?.(value);
                setValue('cashBankReference', value, { shouldDirty: true });
              }}
              chequeRows={cashChequeRows}
              onChequeRows={(rows) => onCashChequeRows?.(rows)}
              netAmount={cashNetAmount}
              direction="RECEIPT"
              variant="advance"
              paidAmount={Number(advancePaidAmount) || 0}
              onPaidAmount={(amount) =>
                setValue('advancePaidAmount', amount, { shouldDirty: true, shouldValidate: true })
              }
              paidError={errors.advancePaidAmount?.message}
              disabled={lockTreasury || fieldsDisabled}
              treasuryError={errors.advanceSafeId?.message}
              bankError={errors.cashBankAccountId?.message}
              chequeError={cashChequeError}
              showErrors={showValidationErrors}
            />
            {onConfigureInstallments ? (
              <div className="mt-2">
                <Button type="button" size="sm" variant="secondary" onClick={onConfigureInstallments}>
                  توزيع الدفعات
                  {installmentCount > 0 ? (
                    <span className="mr-1 inline-flex min-w-[1.15rem] items-center justify-center rounded-full bg-[#0E78AA]/15 px-1 text-[10px] text-[#094C6B]">
                      {installmentCount}
                    </span>
                  ) : null}
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}
        {paymentMethod === 'cash' ? (
          <InvoiceCashTenderPanel
            kind={cashTenderKind}
            onKindChange={(kind) => {
              onCashTenderKind?.(kind);
              setValue('cashTenderKind', kind, { shouldDirty: true, shouldValidate: true });
            }}
            treasuryId={treasuryIdW || ''}
            onTreasuryId={(id) => setValue('treasuryId', id, { shouldDirty: true, shouldValidate: true })}
            bankAccountId={cashBankAccountId}
            onBankAccountId={(id) => {
              onCashBankAccountId?.(id);
              setValue('cashBankAccountId', id, { shouldDirty: true, shouldValidate: true });
            }}
            bankReference={cashBankReference}
            onBankReference={(value) => {
              onCashBankReference?.(value);
              setValue('cashBankReference', value, { shouldDirty: true });
            }}
            chequeRows={cashChequeRows}
            onChequeRows={(rows) => onCashChequeRows?.(rows)}
            netAmount={cashNetAmount}
            direction="RECEIPT"
            disabled={lockTreasury || fieldsDisabled}
            treasuryError={errors.treasuryId?.message}
            bankError={errors.cashBankAccountId?.message}
            chequeError={cashChequeError}
            showErrors={showValidationErrors}
          />
        ) : null}
      </div>
    </>
  );

  const extras = (
    <div className="space-y-3">
      {onSourceHydrate ? (
        <InvoiceSourceDocumentControl
          sourceType={sourceType ?? ''}
          sourceId={sourceId ?? ''}
          sourceNumber={sourceNumber ?? ''}
          hasExistingLines={hasExistingLines}
          disabled={sourceDisabled}
          onTypeChange={(type) => {
            setValue('sourceType', type || 'NONE', { shouldDirty: true });
            setValue('sourceId', '', { shouldDirty: true });
            setValue('sourceNumber', '', { shouldDirty: true });
          }}
          onHydrate={onSourceHydrate}
        />
      ) : null}
    <fieldset disabled={fieldsDisabled} className="m-0 min-w-0 border-0 p-0">
    <div className={erpFormGridClass}>
      <div>
        <label className={erpLabelClass}>المندوب</label>
        <select className={erpInputClass} disabled={delegatesBusy} {...register('delegateId')}>
          <option value="">{delegatesBusy ? 'جاري التحميل…' : '—'}</option>
          {delegates.map((d) => (
            <option key={d.id} value={d.id}>
              {d.arabicName}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={erpLabelClass}>السائق</label>
        <select className={erpInputClass} disabled={driversBusy} {...register('driverId')}>
          <option value="">{driversBusy ? 'جاري التحميل…' : '—'}</option>
          {drivers.map((d) => (
            <option key={d.id} value={d.id}>
              {d.arabicName}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={erpLabelClass}>الموزع</label>
        <select className={erpInputClass} disabled={distributorsBusy} {...register('distributorId')}>
          <option value="">{distributorsBusy ? 'جاري التحميل…' : '—'}</option>
          {distributors.map((d) => (
            <option key={d.id} value={d.id}>
              {d.arabicName}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={erpLabelClass}>مركز التكلفة</label>
        <Controller
          name="costCenterId"
          control={control}
          render={({ field }) => (
            <CostCenterSelect
              value={field.value ?? ''}
              onChange={field.onChange}
              disabled={lockCostCenter}
              className={erpInputClass}
            />
          )}
        />
      </div>
      <div>
        <label className={erpLabelClass}>العملة</label>
        <select
          className={erpInputClass}
          disabled={currenciesBusy}
          {...register('currencyId', { onChange: (e) => handleCurrencyChange(e.target.value) })}
        >
          {currencies.length === 0 ? (
            <option value="">{currenciesBusy ? 'جاري التحميل…' : 'لا توجد عملات'}</option>
          ) : null}
          {currencies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.arabicName} ({c.code})
              {isCompanyBaseCurrency(c.code, companyBase) ? ' — أساسية' : ''}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={erpLabelClass}>سعر الصرف</label>
        <ExchangeRateInput
          className={erpInputClass}
          placeholder="1.0000"
          disabled={headerRateLocked}
          currencyId={currencyIdW}
          currencyCode={selectedHeaderCurrency?.code}
          companyBaseCode={companyBase}
          value={exchangeRateW}
          onChange={(rate) => setValue('exchangeRate', rate, { shouldDirty: true })}
        />
        <p className="mt-1 text-[11px] text-slate-400">
          {headerRateLocked
            ? 'العملة الأساسية — سعر الصرف 1'
            : 'يُعبّأ تلقائياً مقابل الجنيه، وقابل للتعديل'}
        </p>
      </div>
      <label className="flex items-end gap-2 pb-2 text-sm text-slate-700 cursor-pointer">
        <input
          type="checkbox"
          checked={isSalesTaxInvoice}
          onChange={(e) => onSalesTaxChange(e.target.checked)}
          className="rounded border-slate-300 text-[#0E78AA] focus:ring-[#0E78AA]"
        />
        فاتورة خاضعة لضريبة القيمة المضافة (ض.ق.م)
      </label>
      <p
        className={`w-full text-xs text-slate-500 -mt-2 ${isSalesTaxInvoice ? 'hidden' : ''}`}
      >
        ضريبة القيمة المضافة (ض.ق.م) معطّلة — الأسعار والإجمالي بدون ض.ق.م. فعّل الخيار أعلاه عند الحاجة.
      </p>
      <div>
        <label className={erpLabelClass}>نوع المعاملة الضريبية</label>
        <select
          className={erpInputClass}
          {...register('taxTreatmentType', {
            onChange: (e) => onSalesTaxChange(e.target.value === 'taxable'),
          })}
        >
          <option value="">—</option>
          {Object.entries(TAX_TREATMENT_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <p className="mt-1 text-[11px] text-slate-400">يحدد تلقائياً تفعيل ضريبة القيمة المضافة أعلاه</p>
      </div>
      <div>
        <label className={erpLabelClass}>البائع</label>
        <select className={erpInputClass} disabled={sellersBusy} {...register('sellerId')}>
          <option value="">{sellersBusy ? 'جاري التحميل…' : '—'}</option>
          {sellers.map((u) => (
            <option key={u.id} value={u.id}>
              {formatUserDisplayName(u)}
            </option>
          ))}
        </select>
      </div>
      <label className="flex items-end gap-2 pb-2 text-sm text-slate-700 cursor-pointer">
        <input
          type="checkbox"
          className="rounded border-slate-300 text-[#0E78AA] focus:ring-[#0E78AA]"
          {...register('allowReturn')}
        />
        السماح بالإرجاع
      </label>
      {allowReturnW ? (
        <div>
          <label className={erpLabelClass}>أيام الاسترجاع المتاحة</label>
          <input
            type="number"
            min={1}
            step={1}
            className={`${erpInputClass} ${err(!!errors.returnDays)}`}
            {...register('returnDays', { valueAsNumber: true })}
          />
          <ErpFieldError message={errors.returnDays?.message} show={showValidationErrors} />
          <p className="mt-1 text-[11px] text-slate-400">يمكن عمل مردود خلال هذه المدة من تاريخ الفاتورة</p>
        </div>
      ) : (
        <p className="self-end pb-2 text-[11px] text-slate-500">
          غير مسموح بعمل مردود أو مرتجع على هذه الفاتورة
        </p>
      )}
      <Controller
        name="isDelivered"
        control={control}
        render={({ field: deliveredField }) => (
          <>
            <label className="flex items-end gap-2 pb-2 text-sm text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={Boolean(deliveredField.value)}
                onChange={(e) => deliveredField.onChange(e.target.checked)}
                className="rounded border-slate-300 text-[#0E78AA] focus:ring-[#0E78AA]"
              />
              تم التسليم
            </label>
            <div className={deliveredField.value ? '' : 'opacity-50'}>
              <label className={erpLabelClass}>تاريخ التسليم</label>
              <input
                type="date"
                disabled={!deliveredField.value}
                className={erpInputClass}
                {...register('handoverDate')}
              />
            </div>
          </>
        )}
      />
      {convertedFromInvoice ? (
        <div className="flex w-full items-center gap-2 rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] px-3 py-2 text-xs text-[#0A3D5E]">
          <span className="font-semibold">مُحوّلة من:</span>
          <span>
            {convertedFromInvoice.invoiceKind ?? 'مستند'} رقم {convertedFromInvoice.invoiceNumber ?? convertedFromInvoice.id.slice(0, 8)}
            {convertedFromInvoice.date
              ? ` — ${new Date(convertedFromInvoice.date).toLocaleDateString('ar-EG')}`
              : ''}
          </span>
        </div>
      ) : null}
      <div className="w-full rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] p-3 space-y-2">
        <label className={erpLabelClass}>أساس احتساب سعر البند</label>
        <div className="flex flex-wrap gap-4">
          {(Object.keys(PRICING_CALCULATION_BASIS_LABELS) as Array<keyof typeof PRICING_CALCULATION_BASIS_LABELS>).map(
            (value) => (
              <label key={value} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input
                  type="radio"
                  value={value}
                  className="text-[#0E78AA] focus:ring-[#0E78AA]"
                  {...register('pricingCalculationBasis')}
                />
                {PRICING_CALCULATION_BASIS_LABELS[value]}
              </label>
            )
          )}
        </div>
        <p className="text-[11px] text-slate-400">
          كمية الوحدة المختارة = سعر × الكمية. كمية الوحدة الأساسية = سعر × الكمية الأساسية.
        </p>
      </div>
      <div className="w-full rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] p-3 space-y-3">
        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            className="rounded border-slate-300 text-[#0E78AA] focus:ring-[#0E78AA]"
            {...register('developmentFeeEnabled')}
          />
          تفعيل ضريبة رسم التنمية
        </label>
        {developmentFeeEnabled ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="flex flex-wrap items-end gap-4 pb-1">
              <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input type="radio" value="percent" className="text-[#0E78AA] focus:ring-[#0E78AA]" {...register('developmentFeeMode')} />
                نسبة مئوية
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input type="radio" value="fixed" className="text-[#0E78AA] focus:ring-[#0E78AA]" {...register('developmentFeeMode')} />
                قيمة ثابتة
              </label>
            </div>
            {developmentFeeMode === 'fixed' ? (
              <div>
                <label className={erpLabelClass}>قيمة رسم التنمية</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className={erpInputClass}
                  placeholder="0.00"
                  {...register('developmentFeeFixedAmount', { valueAsNumber: true })}
                />
              </div>
            ) : (
              <div>
                <label className={erpLabelClass}>نسبة رسم التنمية %</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  className={erpInputClass}
                  placeholder="1"
                  {...register('developmentFeeRate', { valueAsNumber: true })}
                />
                <p className="mt-1 text-[11px] text-slate-400">النسبة الافتراضية 1٪ — الشائع 1٪ إلى 5٪</p>
              </div>
            )}
          </div>
        ) : null}
      </div>
      <div className="grid w-full grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-end">
        <div>
          <label className={erpLabelClass}>شروط الدفع / طريقة الدفع</label>
          <input
            className={erpInputClass}
            placeholder="شيك بنكي 60 يوم، تحويل فوري…"
            {...register('paymentTermsMethod')}
          />
        </div>
        <button type="button" onClick={onOpenTerms} className="text-sm text-[#0E78AA] pb-2 text-right hover:underline whitespace-nowrap">
          شروط وأحكام إضافية…
        </button>
      </div>
    </div>
    </fieldset>
    </div>
  );

  return (
    <ErpFormHeaderCard
      row1={row1}
      row2={row2}
      extras={extras}
      extrasOpen={headerExtrasOpen}
      onExtrasOpenChange={onHeaderExtrasOpenChange}
      headerActions={headerActions}
      fieldsDisabled={fieldsDisabled}
    />
  );
}
