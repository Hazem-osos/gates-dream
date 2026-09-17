'use client';

import { SupplierSelect } from '@/components/form/PartySelect';
import { WarehouseSelect } from '@/components/form/WarehouseSelect';
import { CostCenterSelect } from '@/components/form/CostCenterSelect';
import {
  ErpFormHeaderCard,
  ErpFieldError,
  erpInputClass,
  erpInputErrorClass,
  erpLabelClass,
  erpFormGridClass,
} from '@/components/erp';
import { useClientMounted } from '@/lib/hooks/useClientMounted';
import {
  PRICING_CALCULATION_BASIS_LABELS,
  type PricingCalculationBasis,
} from '@/lib/invoices/unit-conversion';
import { InvoiceSourceDocumentControl } from '@/components/invoices/InvoiceSourceDocumentControl';
import type { SelectableSourceType, SourceHydratePayload } from '@/lib/invoices/sourceDocument';
import { DatePickerWithHijri } from '@/components/ui/DatePickerWithHijri';
import { toHijriDate } from '@/lib/hijri-date';

type Currency = { id: string; code: string; arabicName: string };
type Delegate = { id: string; code: string; arabicName: string };

type Props = {
  supplierId: string;
  onSupplierId: (v: string) => void;
  onPaymentType: (v: 'cash' | 'credit' | 'split') => void;
  onConfigureSplit?: () => void;
  onConfigureInstallments?: () => void;
  installmentCount?: number;
  paymentType: 'cash' | 'credit' | 'split';
  warehouseId: string;
  onWarehouseId: (v: string) => void;
  date: string;
  onDate: (v: string) => void;
  invoiceNumber: string;
  onInvoiceNumber: (v: string) => void;
  costCenterId: string;
  onCostCenterId: (v: string) => void;
  delegateId: string;
  onDelegateId: (v: string) => void;
  description: string;
  onDescription: (v: string) => void;
  hijriDate: string;
  onHijriDate: (v: string) => void;
  currencyId: string;
  onCurrencyId: (v: string) => void;
  isPurchaseTaxInvoice: boolean;
  onPurchaseTaxChange: (v: boolean) => void;
  supplierRef?: string;
  onSupplierRef?: (v: string) => void;
  currencies: Currency[];
  delegates: Delegate[];
  currenciesLoading?: boolean;
  delegatesLoading?: boolean;
  pricingCalculationBasis?: PricingCalculationBasis;
  onPricingCalculationBasis?: (v: PricingCalculationBasis) => void;
  errors?: { supplierId?: string; warehouseId?: string; date?: string };
  showValidationErrors?: boolean;
  sourceType?: string;
  sourceId?: string;
  sourceNumber?: string;
  onSourceTypeChange?: (type: SelectableSourceType | '') => void;
  onSourceHydrate?: (payload: SourceHydratePayload) => void;
  hasExistingLines?: boolean;
  sourceDisabled?: boolean;
  fieldsDisabled?: boolean;
};

export function PurchaseInvoiceFormHeader(props: Props) {
  const {
    supplierId,
    onSupplierId,
    paymentType,
    onPaymentType,
    onConfigureSplit,
    onConfigureInstallments,
    installmentCount = 0,
    warehouseId,
    onWarehouseId,
    date,
    onDate,
    invoiceNumber,
    onInvoiceNumber,
    costCenterId,
    onCostCenterId,
    delegateId,
    onDelegateId,
    description,
    onDescription,
    hijriDate,
    onHijriDate,
    currencyId,
    onCurrencyId,
    isPurchaseTaxInvoice,
    onPurchaseTaxChange,
    supplierRef,
    onSupplierRef,
    currencies,
    delegates,
    currenciesLoading,
    delegatesLoading,
    pricingCalculationBasis = 'SELECTED_UNIT_QTY',
    onPricingCalculationBasis,
    errors,
    showValidationErrors = false,
    sourceType = '',
    sourceId = '',
    sourceNumber = '',
    onSourceTypeChange,
    onSourceHydrate,
    hasExistingLines = false,
    sourceDisabled = false,
    fieldsDisabled = false,
  } = props;

  const mounted = useClientMounted();
  const delegatesBusy = mounted && Boolean(delegatesLoading);
  const currenciesBusy = mounted && Boolean(currenciesLoading);
  const err = (has?: boolean) => (showValidationErrors && has ? erpInputErrorClass : '');

  const row1 = (
    <>
      <div>
        <label className={erpLabelClass}>رقم الفاتورة الدفتري</label>
        <input className={erpInputClass} value={invoiceNumber} onChange={(e) => onInvoiceNumber(e.target.value)} />
      </div>
      <div>
        <DatePickerWithHijri
          label="التاريخ"
          value={date}
          error={!!errors?.date}
          onChange={(next) => {
            onDate(next);
            onHijriDate(toHijriDate(next));
          }}
        />
        <ErpFieldError message={errors?.date} show={showValidationErrors} />
      </div>
    </>
  );

  const row2 = (
    <>
      <div>
        <label className={erpLabelClass}>المورد</label>
        <SupplierSelect
          value={supplierId}
          onChange={onSupplierId}
          className={`${erpInputClass} ${err(!!errors?.supplierId)}`}
        />
        <ErpFieldError message={errors?.supplierId} show={showValidationErrors} />
      </div>
      <div>
        <label className={erpLabelClass}>البيان</label>
        <input className={erpInputClass} value={description} onChange={(e) => onDescription(e.target.value)} />
      </div>
      <div>
        <label className={erpLabelClass}>المخزن الافتراضي</label>
        <WarehouseSelect
          value={warehouseId}
          onChange={onWarehouseId}
          className={`${erpInputClass} ${err(!!errors?.warehouseId)}`}
        />
        <ErpFieldError message={errors?.warehouseId} show={showValidationErrors} />
      </div>
      <div className="min-w-[16rem]">
        <label className={erpLabelClass}>طريقة الدفع</label>
        <div className="flex h-10 rounded-lg border border-slate-200 overflow-hidden bg-slate-50 p-0.5 gap-0.5">
          <button
            type="button"
            onClick={() => onPaymentType('cash')}
            className={`flex-1 text-sm font-medium rounded-md ${
              paymentType === 'cash' ? 'bg-[#0E78AA] text-white' : 'text-slate-600'
            }`}
          >
            نقدي
          </button>
          <button
            type="button"
            onClick={() => onPaymentType('split')}
            className={`flex-1 text-sm font-medium rounded-md ${
              paymentType !== 'cash' ? 'bg-[#0E78AA] text-white' : 'text-slate-600'
            }`}
          >
            دفع متعدد
          </button>
        </div>
        {paymentType !== 'cash' ? (
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
            <button
              type="button"
              className="text-xs font-semibold text-[#0E78AA] hover:underline"
              onClick={onConfigureSplit}
            >
              توزيع المبالغ…
            </button>
            <button
              type="button"
              className="text-xs font-semibold text-[#0E78AA] hover:underline"
              onClick={onConfigureInstallments}
            >
              توزيع الدفعات
              {installmentCount > 0 ? (
                <span className="mr-1 inline-flex min-w-[1.15rem] items-center justify-center rounded-full bg-[#0E78AA]/15 px-1 text-[10px] text-[#094C6B]">
                  {installmentCount}
                </span>
              ) : null}
            </button>
          </div>
        ) : null}
      </div>
    </>
  );

  const extras = (
    <div className="space-y-3">
      {onSourceHydrate && onSourceTypeChange ? (
        <InvoiceSourceDocumentControl
          sourceType={sourceType}
          sourceId={sourceId}
          sourceNumber={sourceNumber}
          hasExistingLines={hasExistingLines}
          disabled={sourceDisabled}
          onTypeChange={onSourceTypeChange}
          onHydrate={onSourceHydrate}
        />
      ) : null}
    <fieldset disabled={fieldsDisabled} className="m-0 min-w-0 border-0 p-0">
    <div className={erpFormGridClass}>
      <div>
        <label className={erpLabelClass}>رقم فاتورة المورد</label>
        <input
          className={erpInputClass}
          value={supplierRef ?? ''}
          onChange={(e) => onSupplierRef?.(e.target.value)}
          placeholder="مرجع المورد"
        />
      </div>
      <div>
        <label className={erpLabelClass}>مركز التكلفة</label>
        <CostCenterSelect value={costCenterId} onChange={onCostCenterId} className={erpInputClass} />
      </div>
      <div>
        <label className={erpLabelClass}>المندوب</label>
        <select
          className={erpInputClass}
          disabled={delegatesBusy}
          value={delegateId}
          onChange={(e) => onDelegateId(e.target.value)}
        >
          <option value="">—</option>
          {delegates.map((d) => (
            <option key={d.id} value={d.id}>
              {d.arabicName}
            </option>
          ))}
        </select>
      </div>
      <input type="hidden" value={hijriDate} readOnly />
      <div>
        <label className={erpLabelClass}>العملة</label>
        <select
          className={erpInputClass}
          disabled={currenciesBusy}
          value={currencyId}
          onChange={(e) => onCurrencyId(e.target.value)}
        >
          <option value="">افتراضي</option>
          {currencies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.arabicName} ({c.code})
            </option>
          ))}
        </select>
      </div>
      <label className="flex items-end gap-2 pb-2 text-sm cursor-pointer">
        <input
          type="checkbox"
          checked={isPurchaseTaxInvoice}
          onChange={(e) => onPurchaseTaxChange(e.target.checked)}
        />
        فاتورة خاضعة لضريبة القيمة المضافة (ض.ق.م)
      </label>
      <div className="sm:col-span-2 lg:col-span-3 xl:col-span-4 rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] p-3 space-y-2">
        <label className={erpLabelClass}>أساس احتساب سعر البند</label>
        <div className="flex flex-wrap gap-4">
          {(Object.keys(PRICING_CALCULATION_BASIS_LABELS) as PricingCalculationBasis[]).map((value) => (
            <label key={value} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input
                type="radio"
                name="purchase-pricing-basis"
                checked={pricingCalculationBasis === value}
                onChange={() => onPricingCalculationBasis?.(value)}
                className="text-[#0E78AA] focus:ring-[#0E78AA]"
              />
              {PRICING_CALCULATION_BASIS_LABELS[value]}
            </label>
          ))}
        </div>
      </div>
    </div>
    </fieldset>
    </div>
  );

  return <ErpFormHeaderCard row1={row1} row2={row2} extras={extras} fieldsDisabled={fieldsDisabled} />;
}
