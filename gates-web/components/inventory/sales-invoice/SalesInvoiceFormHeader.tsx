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
} from '@/components/erp';
import { useClientMounted } from '@/lib/hooks/useClientMounted';
import { InvoiceSourceDocumentControl } from '@/components/invoices/InvoiceSourceDocumentControl';
import type { SourceHydratePayload } from '@/lib/invoices/sourceDocument';

const CustomerQuickAddModal = dynamic(
  () =>
    import('@/app/components/form/CustomerQuickAddModal').then((m) => ({
      default: m.CustomerQuickAddModal,
    })),
  { ssr: false, loading: () => <DynamicModalSkeleton label="جاري تحميل إضافة عميل…" /> }
);

type Currency = { id: string; code: string; arabicName: string; exchangeRate?: number | string | null };
type Delegate = { id: string; code: string; arabicName: string };
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
  installmentCount?: number;
  isSalesTaxInvoice: boolean;
  onSalesTaxChange: (v: boolean) => void;
  onOpenTerms?: () => void;
  currencies: Currency[];
  delegates: Delegate[];
  currenciesLoading?: boolean;
  delegatesLoading?: boolean;
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
  onSourceHydrate?: (payload: SourceHydratePayload) => void;
  includeAllAccounts?: boolean;
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
  installmentCount = 0,
  currencies,
  delegates,
  currenciesLoading,
  delegatesLoading,
  showValidationErrors = false,
  headerActions,
  customerSeed,
  convertedFromInvoice,
  lockWarehouse = false,
  lockTreasury = false,
  lockCostCenter = false,
  hasExistingLines = false,
  sourceDisabled = false,
  onSourceHydrate,
  includeAllAccounts = false,
}: Props) {
  const mounted = useClientMounted();
  const delegatesBusy = mounted && Boolean(delegatesLoading);
  const currenciesBusy = mounted && Boolean(currenciesLoading);
  const err = (has?: boolean) => (showValidationErrors && has ? erpInputErrorClass : '');

  const handleCurrencyChange = (currencyId: string) => {
    const picked = currencies.find((c) => c.id === currencyId);
    const rate = picked?.exchangeRate != null ? Number(picked.exchangeRate) : null;
    if (rate && rate > 0) {
      setValue('exchangeRate', rate, { shouldDirty: true });
    }
  };

  const sourceType = useWatch({ control, name: 'sourceType' });
  const sourceId = useWatch({ control, name: 'sourceId' });
  const sourceNumber = useWatch({ control, name: 'sourceNumber' });
  const invoiceDate = useWatch({ control, name: 'date' });
  const developmentFeeEnabled = useWatch({ control, name: 'developmentFeeEnabled' });
  const developmentFeeMode = useWatch({ control, name: 'developmentFeeMode' });
  const advancePaidAmount = useWatch({ control, name: 'advancePaidAmount' });
  const creditNeedsSafe = paymentMethod === 'credit' && (Number(advancePaidAmount) || 0) > 0;
  const paymentMethodOptions = {
    onChange: (event: { target: { value: string } }) => {
      if (event.target.value === 'split') onConfigureSplit?.();
    },
  } as const;
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
      <div>
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
            دفع قبل أجل
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
          </div>
        ) : null}
        {paymentMethod === 'credit' ? (
          <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className={erpLabelClass}>
                الخزينة
                {creditNeedsSafe ? <RequiredDot hint="الخزينة مطلوبة عند دفع مبلغ في الأول" /> : null}
              </label>
              <select
                className={`${erpInputClass} ${errors.advanceSafeId ? erpInputErrorClass : ''}`}
                disabled={lockTreasury}
                {...register('advanceSafeId')}
              >
                <option value="">اختر الخزينة</option>
                {safes.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.arabicName ?? s.code ?? s.id}
                  </option>
                ))}
              </select>
              <ErpFieldError message={errors.advanceSafeId?.message} show={!!errors.advanceSafeId?.message} />
            </div>
            <div>
              <label className={erpLabelClass}>المبلغ المدفوع في الأول</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className={`${erpInputClass} ${errors.advancePaidAmount ? erpInputErrorClass : ''}`}
                placeholder="0"
                {...register('advancePaidAmount', { valueAsNumber: true })}
              />
              <ErpFieldError message={errors.advancePaidAmount?.message} show={!!errors.advancePaidAmount?.message} />
            </div>
            {onConfigureInstallments ? (
              <div className="sm:col-span-2">
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
          <div className="mt-2">
            <label className={erpLabelClass}>
              الخزنة
              <RequiredDot hint="الخزنة مطلوبة في الفاتورة النقدية" />
            </label>
            <select
              className={`${erpInputClass} ${errors.treasuryId ? erpInputErrorClass : ''}`}
              disabled={lockTreasury}
              {...register('treasuryId')}
            >
              <option value="">اختر الخزنة</option>
              {safes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.arabicName ?? s.code ?? s.id}
                </option>
              ))}
            </select>
            <ErpFieldError message={errors.treasuryId?.message} show={!!errors.treasuryId?.message} />
          </div>
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
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
      <div>
        <label className={erpLabelClass}>المندوب</label>
        <select className={erpInputClass} disabled={delegatesBusy} {...register('delegateId')}>
          <option value="">—</option>
          {delegates.map((d) => (
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
          <option value="">افتراضي</option>
          {currencies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.arabicName} ({c.code})
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={erpLabelClass}>سعر الصرف</label>
        <input
          type="number"
          step="0.0001"
          min="0"
          className={erpInputClass}
          placeholder="1.0000"
          {...register('exchangeRate', { valueAsNumber: true })}
        />
        <p className="mt-1 text-[11px] text-slate-400">يُعبّأ تلقائياً من سعر العملة، وقابل للتعديل</p>
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
        className={`col-span-full text-xs text-slate-500 -mt-2 ${isSalesTaxInvoice ? 'hidden' : ''}`}
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
        <label className={erpLabelClass}>البائع (Salesman)</label>
        <select className={erpInputClass} disabled={delegatesBusy} {...register('sellerId')}>
          <option value="">—</option>
          {delegates.map((d) => (
            <option key={d.id} value={d.id}>
              {d.arabicName}
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
        السماح بالإرجاع 365 يوم
      </label>
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
        <div className="col-span-full flex items-center gap-2 rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] px-3 py-2 text-xs text-[#0A3D5E]">
          <span className="font-semibold">مُحوّلة من:</span>
          <span>
            {convertedFromInvoice.invoiceKind ?? 'مستند'} رقم {convertedFromInvoice.invoiceNumber ?? convertedFromInvoice.id.slice(0, 8)}
            {convertedFromInvoice.date
              ? ` — ${new Date(convertedFromInvoice.date).toLocaleDateString('ar-EG')}`
              : ''}
          </span>
        </div>
      ) : null}
      <div className="col-span-full rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] p-3 space-y-2">
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
      <div className="col-span-full rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] p-3 space-y-3">
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
      <div className="col-span-full grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-end">
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
    </div>
  );

  return <ErpFormHeaderCard row1={row1} row2={row2} extras={extras} headerActions={headerActions} />;
}
