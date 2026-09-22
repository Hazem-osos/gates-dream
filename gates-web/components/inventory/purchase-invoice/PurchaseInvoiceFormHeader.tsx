'use client';

import { SupplierSelect } from '@/components/form/PartySelect';
import { WarehouseSelect } from '@/components/form/WarehouseSelect';
import { CostCenterSelect } from '@/components/form/CostCenterSelect';
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
import {
  PRICING_CALCULATION_BASIS_LABELS,
  type PricingCalculationBasis,
} from '@/lib/invoices/unit-conversion';
import { InvoiceSourceDocumentControl } from '@/components/invoices/InvoiceSourceDocumentControl';
import { InvoiceCashTenderPanel } from '@/components/invoices/InvoiceCashTenderPanel';
import type { SelectableSourceType, SourceHydratePayload } from '@/lib/invoices/sourceDocument';
import { DatePickerWithHijri } from '@/components/ui/DatePickerWithHijri';
import { toHijriDate } from '@/lib/hijri-date';
import type { CashTenderKind, InvoiceChequeDraft } from '@/lib/invoices/cash-tender';
import { summarizePaymentSplits, type PaymentSplitLine } from '@/lib/invoices/payment-split.types';

type Currency = { id: string; code: string; arabicName: string };
type Delegate = { id: string; code: string; arabicName: string };

type Props = {
  supplierId: string;
  onSupplierId: (v: string) => void;
  onPaymentType: (v: 'cash' | 'credit' | 'split') => void;
  onConfigureSplit?: () => void;
  onConfigureInstallments?: () => void;
  onLinkAdvance?: () => void;
  installmentCount?: number;
  paymentSplits?: PaymentSplitLine[];
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
  treasuryId?: string;
  onTreasuryId?: (v: string) => void;
  advancePaidAmount?: number;
  onAdvancePaidAmount?: (v: number) => void;
  advanceSafeId?: string;
  onAdvanceSafeId?: (v: string) => void;
  cashTenderKind?: CashTenderKind;
  onCashTenderKind?: (kind: CashTenderKind) => void;
  cashBankAccountId?: string;
  onCashBankAccountId?: (id: string) => void;
  cashBankReference?: string;
  onCashBankReference?: (value: string) => void;
  cashChequeRows?: InvoiceChequeDraft[];
  onCashChequeRows?: (rows: InvoiceChequeDraft[]) => void;
  cashIssuingBankAccountId?: string;
  onCashIssuingBankAccountId?: (id: string) => void;
  cashNetAmount?: number;
  cashChequeError?: string;
  errors?: {
    supplierId?: string;
    warehouseId?: string;
    date?: string;
    treasuryId?: string;
    advanceSafeId?: string;
    cashBankAccountId?: string;
    cashCheques?: string;
  };
  showValidationErrors?: boolean;
  sourceType?: string;
  sourceId?: string;
  sourceNumber?: string;
  onSourceTypeChange?: (type: SelectableSourceType | '') => void;
  onSourceHydrate?: (payload: SourceHydratePayload) => void;
  hasExistingLines?: boolean;
  sourceDisabled?: boolean;
  fieldsDisabled?: boolean;
  splitLocked?: boolean;
  splitCollectMode?: boolean;
};

export function PurchaseInvoiceFormHeader(props: Props) {
  const {
    supplierId,
    onSupplierId,
    paymentType,
    onPaymentType,
    onConfigureSplit,
    onConfigureInstallments,
    onLinkAdvance,
    installmentCount = 0,
    paymentSplits,
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
    treasuryId = '',
    onTreasuryId,
    advancePaidAmount = 0,
    onAdvancePaidAmount,
    advanceSafeId = '',
    onAdvanceSafeId,
    cashTenderKind = 'treasury',
    onCashTenderKind,
    cashBankAccountId = '',
    onCashBankAccountId,
    cashBankReference = '',
    onCashBankReference,
    cashChequeRows = [],
    onCashChequeRows,
    cashIssuingBankAccountId = '',
    onCashIssuingBankAccountId,
    cashNetAmount = 0,
    cashChequeError,
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
    splitLocked = false,
    splitCollectMode = false,
  } = props;

  const mounted = useClientMounted();
  const delegatesBusy = mounted && Boolean(delegatesLoading);
  const currenciesBusy = mounted && Boolean(currenciesLoading);
  const err = (has?: boolean) => (showValidationErrors && has ? erpInputErrorClass : '');
  const creditNeedsSafe = paymentType === 'credit' && (Number(advancePaidAmount) || 0) > 0;
  const splitSummary = summarizePaymentSplits(paymentSplits);

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
      <div className="min-w-[18rem]">
        <label className={erpLabelClass}>طريقة الدفع</label>
        <div className="flex min-h-10 flex-wrap rounded-lg border border-slate-200 overflow-hidden bg-slate-50 p-0.5 gap-0.5">
          <button
            type="button"
            onClick={() => onPaymentType('cash')}
            className={`flex-1 min-w-[4.5rem] flex items-center justify-center text-sm font-medium rounded-md transition-colors ${
              paymentType === 'cash' ? 'bg-[#0E78AA] text-white shadow-sm' : 'text-slate-600 hover:bg-white'
            }`}
          >
            نقدي
          </button>
          <button
            type="button"
            onClick={() => onPaymentType('credit')}
            className={`flex-1 min-w-[6.5rem] flex items-center justify-center text-sm font-medium rounded-md transition-colors ${
              paymentType === 'credit' ? 'bg-[#0E78AA] text-white shadow-sm' : 'text-slate-600 hover:bg-white'
            }`}
          >
            آجل
          </button>
          <div
            role="button"
            tabIndex={splitLocked ? -1 : 0}
            aria-disabled={splitLocked}
            title={
              splitLocked
                ? 'الدفع المتعدد يتاح بعد حفظ وترحيل الفاتورة'
                : splitCollectMode
                  ? 'تحصيل أو تعديل الدفع على الفاتورة المرحلة'
                  : undefined
            }
            onClick={() => {
              if (splitLocked) return;
              onPaymentType('split');
            }}
            onKeyDown={(event) => {
              if (splitLocked) return;
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onPaymentType('split');
              }
            }}
            className={`flex-1 min-w-[5.5rem] flex items-center justify-center text-sm font-medium rounded-md transition-colors ${
              splitLocked
                ? 'cursor-not-allowed text-slate-400 opacity-50'
                : splitCollectMode
                  ? 'pointer-events-auto cursor-pointer text-[#0E78AA] hover:bg-white'
                  : paymentType === 'split'
                    ? 'cursor-pointer bg-[#0E78AA] text-white shadow-sm'
                    : 'cursor-pointer text-slate-600 hover:bg-white'
            }`}
          >
            دفع متعدد
          </div>
        </div>
        {splitLocked ? (
          <p className="mt-1.5 text-[11px] text-slate-500">نقدي أو آجل فقط أثناء الإضافة. الدفع المتعدد بعد الترحيل.</p>
        ) : null}
        {onLinkAdvance ? (
          <div className="mt-2 pointer-events-auto">
            <div
              role="button"
              tabIndex={0}
              className="pointer-events-auto inline-flex cursor-pointer rounded-lg border border-[#0E78AA]/30 bg-white px-3 py-1.5 text-sm font-semibold text-[#0E78AA] hover:bg-[#E8F4FA]"
              onClick={onLinkAdvance}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onLinkAdvance();
                }
              }}
            >
              ربط دفعة مقدمة
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              يفتح سندات المورد غير المرتبطة بفاتورة لربطها كسداد — نقدي أو آجل.
            </p>
          </div>
        ) : null}
        {paymentType === 'split' && !splitLocked ? (
          <div className="mt-2 flex flex-wrap items-center gap-2 pointer-events-auto">
            <div
              role="button"
              tabIndex={0}
              className="pointer-events-auto inline-flex cursor-pointer items-center rounded-lg bg-[#0E78AA] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#094C6B]"
              onClick={onConfigureSplit}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onConfigureSplit?.();
                }
              }}
            >
              تحصيل
            </div>
            <button
              type="button"
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              onClick={onConfigureInstallments}
            >
              توزيع الدفعات
              {installmentCount > 0 ? (
                <span className="mr-1 inline-flex min-w-[1.15rem] items-center justify-center rounded-full bg-[#0E78AA]/15 px-1 text-[10px] text-[#094C6B]">
                  {installmentCount}
                </span>
              ) : null}
            </button>
            {splitSummary ? <p className="w-full text-[11px] text-slate-500">{splitSummary}</p> : null}
          </div>
        ) : null}
        {paymentType === 'credit' ? (
          <div>
            <InvoiceCashTenderPanel
              kind={cashTenderKind}
              onKindChange={(kind) => onCashTenderKind?.(kind)}
              treasuryId={advanceSafeId || treasuryId}
              onTreasuryId={(id) => {
                onAdvanceSafeId?.(id);
                if (!treasuryId) onTreasuryId?.(id);
              }}
              bankAccountId={cashBankAccountId}
              onBankAccountId={(id) => onCashBankAccountId?.(id)}
              bankReference={cashBankReference}
              onBankReference={(value) => onCashBankReference?.(value)}
              chequeRows={cashChequeRows}
              onChequeRows={(rows) => onCashChequeRows?.(rows)}
              issuingBankAccountId={cashIssuingBankAccountId}
              onIssuingBankAccountId={onCashIssuingBankAccountId}
              netAmount={cashNetAmount}
              direction="PAYMENT"
              variant="advance"
              paidAmount={advancePaidAmount}
              onPaidAmount={onAdvancePaidAmount}
              disabled={fieldsDisabled}
              treasuryError={errors?.advanceSafeId}
              bankError={errors?.cashBankAccountId}
              chequeError={cashChequeError ?? errors?.cashCheques}
              showErrors={showValidationErrors}
            />
            {onConfigureInstallments ? (
              <div className="mt-2">
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
        ) : null}
        {paymentType === 'cash' ? (
          <InvoiceCashTenderPanel
            kind={cashTenderKind}
            onKindChange={(kind) => onCashTenderKind?.(kind)}
            treasuryId={treasuryId}
            onTreasuryId={(id) => onTreasuryId?.(id)}
            bankAccountId={cashBankAccountId}
            onBankAccountId={(id) => onCashBankAccountId?.(id)}
            bankReference={cashBankReference}
            onBankReference={(value) => onCashBankReference?.(value)}
            chequeRows={cashChequeRows}
            onChequeRows={(rows) => onCashChequeRows?.(rows)}
            issuingBankAccountId={cashIssuingBankAccountId}
            onIssuingBankAccountId={onCashIssuingBankAccountId}
            netAmount={cashNetAmount}
            direction="PAYMENT"
            paidAmount={Number(advancePaidAmount) > 0 ? Number(advancePaidAmount) : cashNetAmount}
            onPaidAmount={onAdvancePaidAmount}
            disabled={fieldsDisabled}
            treasuryError={errors?.treasuryId}
            bankError={errors?.cashBankAccountId}
            chequeError={cashChequeError ?? errors?.cashCheques}
            showErrors={showValidationErrors}
          />
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
