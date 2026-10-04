'use client';

import { CustomerSelect, SupplierSelect } from '@/components/form/PartySelect';
import { WarehouseSelect } from '@/components/form/WarehouseSelect';
import { DatePickerWithHijri } from '@/components/ui/DatePickerWithHijri';
import { Button } from '@/components/ui';
import { SearchableCombobox } from '@/app/components/form/SearchableCombobox';
import {
  ErpFormHeaderCard,
  erpInputClass,
  erpLabelClass,
} from '@/components/erp';

export type SourceInvoiceOption = {
  id: string;
  invoiceNumber?: string | null;
  date?: string | Date | null;
  netAmount?: number | string | null;
  customerId?: string | null;
  supplierId?: string | null;
  customer?: { arabicName?: string | null } | null;
  supplier?: { arabicName?: string | null } | null;
};

type Props = {
  variant: 'sales' | 'purchase';
  partyId: string;
  onPartyId: (v: string) => void;
  warehouseId: string;
  onWarehouseId: (v: string) => void;
  date: string;
  onDate: (v: string) => void;
  invoiceNumber: string;
  onInvoiceNumber: (v: string) => void;
  sourceInvoiceId: string;
  onSourceInvoiceId: (v: string) => void;
  sourceInvoices: SourceInvoiceOption[];
  currencyId: string;
  onCurrencyId: (v: string) => void;
  currencies: { id: string; code: string; arabicName: string }[];
  description: string;
  onDescription: (v: string) => void;
  allowStandaloneReturns?: boolean;
  sourceRequired?: boolean;
  sourceHelper?: string;
  onLoadSourceLines?: () => void;
  restock?: boolean;
  onRestock?: (v: boolean) => void;
  returnReason?: string;
  onReturnReason?: (v: string) => void;
  debitNoteNumber?: string;
  onDebitNoteNumber?: (v: string) => void;
  settlementMethod?: string;
  onSettlementMethod?: (v: string) => void;
  treasuryId?: string;
  onTreasuryId?: (v: string) => void;
  delegateId?: string;
  onDelegateId?: (v: string) => void;
  driverId?: string;
  onDriverId?: (v: string) => void;
  distributorId?: string;
  onDistributorId?: (v: string) => void;
  delegates?: { id: string; arabicName: string }[];
  drivers?: { id: string; arabicName: string }[];
  distributors?: { id: string; arabicName: string }[];
};

function formatSourceLabel(inv: SourceInvoiceOption, variant: 'sales' | 'purchase') {
  const number = inv.invoiceNumber || inv.id.slice(0, 8);
  const party =
    variant === 'sales' ? inv.customer?.arabicName || '—' : inv.supplier?.arabicName || '—';
  const amount = inv.netAmount != null ? Number(inv.netAmount).toLocaleString('ar-EG') : '—';
  return `${number} - ${party} (${amount} ج.م)`;
}

export function ReturnInvoiceFormHeader({
  variant,
  partyId,
  onPartyId,
  warehouseId,
  onWarehouseId,
  date,
  onDate,
  invoiceNumber,
  onInvoiceNumber,
  sourceInvoiceId,
  onSourceInvoiceId,
  sourceInvoices,
  currencyId,
  onCurrencyId,
  currencies,
  description,
  onDescription,
  allowStandaloneReturns = true,
  sourceRequired = false,
  sourceHelper,
  onLoadSourceLines,
  restock = true,
  onRestock,
  returnReason = '',
  onReturnReason,
  debitNoteNumber = '',
  onDebitNoteNumber,
  delegateId = '',
  onDelegateId,
  driverId = '',
  onDriverId,
  distributorId = '',
  onDistributorId,
  delegates = [],
  drivers = [],
  distributors = [],
}: Props) {
  const partyLabel = variant === 'sales' ? 'العميل' : 'المورد';
  const sourceLabel = variant === 'sales' ? 'فاتورة المبيعات الأصلية' : 'فاتورة المشتريات الأصلية';

  return (
    <ErpFormHeaderCard
      extrasLabel="خيارات إضافية"
      row1={
        <>
          <div className="space-y-1">
            <label className={erpLabelClass}>رقم المردود</label>
            <input
              className={erpInputClass}
              value={invoiceNumber}
              onChange={(e) => onInvoiceNumber(e.target.value)}
              placeholder="تلقائي عند الحفظ"
            />
          </div>
          <DatePickerWithHijri label="التاريخ" value={date} onChange={onDate} />
        </>
      }
      row2={
        <>
          <div className="space-y-1">
            <label className={erpLabelClass}>{partyLabel}</label>
            {variant === 'sales' ? (
              <CustomerSelect value={partyId} onChange={onPartyId} className={erpInputClass} />
            ) : (
              <SupplierSelect value={partyId} onChange={onPartyId} className={erpInputClass} />
            )}
          </div>
          <div className="space-y-1">
            <label className={erpLabelClass}>الشرح</label>
            <input
              className={erpInputClass}
              value={description}
              onChange={(e) => onDescription(e.target.value)}
              placeholder="بيان المردود"
            />
          </div>
          <div className="space-y-1">
            <label className={erpLabelClass}>المخزن</label>
            <WarehouseSelect value={warehouseId} onChange={onWarehouseId} className={erpInputClass} />
          </div>
          <div className="space-y-1">
            <label className={erpLabelClass}>
              {sourceLabel}
              {sourceRequired ? <span className="mr-1 text-rose-600">*</span> : null}
            </label>
            <div className="flex gap-2">
              <div className="min-w-0 flex-1">
                <SearchableCombobox
                  value={sourceInvoiceId}
                  onChange={onSourceInvoiceId}
                  placeholder="اختر الفاتورة المرتجع منها..."
                  options={sourceInvoices.map((inv) => ({
                    value: inv.id,
                    label: formatSourceLabel(inv, variant),
                  }))}
                />
              </div>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={!sourceInvoiceId}
                onClick={onLoadSourceLines}
              >
                تحميل بنود الفاتورة
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {sourceHelper ||
                (allowStandaloneReturns
                  ? 'اختر الفاتورة الأصلية لتحميل البنود والأسعار، أو اتركها فارغة لمردود حر'
                  : 'سياسة الشركة تُلزم باختيار الفاتورة الأصلية')}
            </p>
          </div>
          <div className="space-y-1">
            <label className={erpLabelClass}>العملة</label>
            <select className={erpInputClass} value={currencyId} onChange={(e) => onCurrencyId(e.target.value)}>
              {currencies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.arabicName || c.code}
                </option>
              ))}
            </select>
          </div>
        </>
      }
      extras={
        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {onDelegateId ? (
            <div className="space-y-1">
              <label className={erpLabelClass}>المندوب</label>
              <select className={erpInputClass} value={delegateId} onChange={(e) => onDelegateId(e.target.value)}>
                <option value="">—</option>
                {delegates.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.arabicName}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          {onDriverId ? (
            <div className="space-y-1">
              <label className={erpLabelClass}>السائق</label>
              <select className={erpInputClass} value={driverId} onChange={(e) => onDriverId(e.target.value)}>
                <option value="">—</option>
                {drivers.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.arabicName}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          {onDistributorId ? (
            <div className="space-y-1">
              <label className={erpLabelClass}>الموزع</label>
              <select
                className={erpInputClass}
                value={distributorId}
                onChange={(e) => onDistributorId(e.target.value)}
              >
                <option value="">—</option>
                {distributors.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.arabicName}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <div className="space-y-1">
            <label className={erpLabelClass}>سبب المرتجع</label>
            <select className={erpInputClass} value={returnReason} onChange={(e) => onReturnReason?.(e.target.value)}>
              <option value="">—</option>
              <option value="damaged">تالف / معيب</option>
              <option value="wrong-item">صنف خاطئ</option>
              <option value="excess">كمية زائدة</option>
              <option value="customer-request">طلب العميل / المورد</option>
              <option value="other">أخرى</option>
            </select>
          </div>
          {variant === 'sales' ? (
            <label className="flex items-center gap-2 pt-6 text-xs font-medium">
              <input
                type="checkbox"
                className="h-4 w-4 accent-[#0E78AA]"
                checked={restock}
                onChange={(e) => onRestock?.(e.target.checked)}
              />
              إرجاع الأصناف للمخزن آلياً
            </label>
          ) : (
            <>
              <div className="space-y-1">
                <label className={erpLabelClass}>رقم إشعار الخصم من المورد</label>
                <input
                  className={erpInputClass}
                  value={debitNoteNumber}
                  onChange={(e) => onDebitNoteNumber?.(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className={erpLabelClass}>مستودع الإخراج</label>
                <WarehouseSelect value={warehouseId} onChange={onWarehouseId} className={erpInputClass} />
              </div>
            </>
          )}
        </div>
      }
    />
  );
}
