'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui';
import { AccountSelect } from '@/components/form/AccountSelect';
import { CostCenterSelect } from '@/components/form/CostCenterSelect';
import {
  emptyInvoiceExtraRow,
  type InvoiceAdjustmentCalc,
  type InvoiceExtraRow,
} from '@/lib/invoices/invoice-adjustments';
import { erpInputClass, erpLabelClass } from '@/components/erp/erpUiTokens';
import { formatBaseAmount, headerLocksLineCurrency, rateForCurrency, toBaseAmount } from '@/lib/accounting/fx-base';
import { ExchangeRateInput } from '@/components/accounting/ExchangeRateInput';
import { useCompanyBaseCurrency } from '@/lib/hooks/useCompanyBaseCurrency';
import { seedLineDescription, useFollowHeaderDescription } from '@/lib/hooks/useFollowHeaderDescription';

type Currency = { id: string; code: string; arabicName: string; exchangeRate?: number | string | null };

const compactInput = `${erpInputClass} h-9 min-h-9 text-xs`;

function ExtraAmountField({
  value,
  calcType,
  disabled,
  onValue,
  onCalcType,
}: {
  value: number | '';
  calcType: InvoiceAdjustmentCalc;
  disabled?: boolean;
  onValue: (next: number | '') => void;
  onCalcType: (next: InvoiceAdjustmentCalc) => void;
}) {
  const isPercent = calcType === 'PERCENTAGE';
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? (value === '' ? '' : String(value));
  return (
    <div className="flex h-9 min-h-9 items-stretch overflow-hidden rounded-lg border border-[#D6EAF3] bg-[#F6FBFD] focus-within:border-[#0E78AA] focus-within:ring-2 focus-within:ring-[#0E78AA]/20">
      <input
        inputMode="decimal"
        className="h-full min-w-0 flex-1 border-0 bg-transparent px-2 text-center text-xs outline-none disabled:opacity-50"
        value={shown}
        disabled={disabled}
        placeholder="0"
        onChange={(e) => {
          const text = e.target.value.replace(/[^\d.]/g, '');
          if (text !== '' && !/^\d*\.?\d*$/.test(text)) return;
          setDraft(text);
          if (text === '' || text === '.') {
            onValue('');
            return;
          }
          const amount = Number(text);
          if (!Number.isFinite(amount)) return;
          onValue(amount);
        }}
        onBlur={() => setDraft(null)}
      />
      <button
        type="button"
        disabled={disabled}
        title={isPercent ? 'نسبة مئوية — اضغط للتبديل إلى قيمة' : 'قيمة — اضغط للتبديل إلى نسبة مئوية'}
        aria-label={isPercent ? 'نسبة مئوية' : 'قيمة'}
        onClick={() => onCalcType(isPercent ? 'FIXED' : 'PERCENTAGE')}
        className={`w-9 shrink-0 whitespace-nowrap border-r border-[#D6EAF3] text-[10px] font-bold leading-none ${
          isPercent
            ? 'bg-[#E8F4FB] text-[#0E78AA] hover:bg-[#d5ecf8]'
            : 'bg-[#FFF4E5] text-[#B45309] hover:bg-[#ffe8c7]'
        } disabled:cursor-not-allowed disabled:opacity-50`}
      >
        {isPercent ? '%' : 'قيمة'}
      </button>
    </div>
  );
}

type Props = {
  open: boolean;
  onToggle: () => void;
  rows: InvoiceExtraRow[];
  onChange: (rows: InvoiceExtraRow[]) => void;
  currencies: Currency[];
  defaultCurrency?: string;
  defaultExchangeRate?: number;
  defaultCostCenterId?: string;
  disabled?: boolean;
  count?: number;
  headerDescription?: string;
};

export function InvoiceExtrasPanel({
  open,
  onToggle,
  rows,
  onChange,
  currencies,
  defaultCurrency = 'EGP',
  defaultExchangeRate = 1,
  defaultCostCenterId = '',
  disabled = false,
  count = 0,
  headerDescription = '',
}: Props) {
  const { code: companyBase, label: companyBaseLabel } = useCompanyBaseCurrency();
  const currencyLocked = headerLocksLineCurrency(defaultCurrency);

  useEffect(() => {
    if (!currencyLocked) return;
    if (rows.every((row) => row.currency === defaultCurrency)) return;
    onChange(
      rows.map((row) =>
        row.currency === defaultCurrency
          ? row
          : { ...row, currency: defaultCurrency, exchangeRate: defaultExchangeRate }
      )
    );
  }, [currencyLocked, defaultCurrency, defaultExchangeRate, onChange, rows]);

  useFollowHeaderDescription({
    headerDescription,
    lines: rows,
    onChange,
    getDescription: (row) => row.description,
    setDescription: (row, value) => ({ ...row, description: value }),
    disabled,
  });
  const patch = (index: number, next: Partial<InvoiceExtraRow>) => {
    onChange(rows.map((row, i) => (i === index ? { ...row, ...next } : row)));
  };

  const addRow = () => {
    onChange([
      ...rows,
      {
        ...emptyInvoiceExtraRow({
          currency: defaultCurrency,
          exchangeRate: defaultExchangeRate,
          costCenterId: defaultCostCenterId,
        }),
        description: seedLineDescription(headerDescription),
      },
    ]);
  };

  const handleOpen = () => {
    if (!open && rows.length === 0) addRow();
    onToggle();
  };

  return (
    <div className="mt-3 min-w-0">
      <Button type="button" size="sm" variant={open ? 'primary' : 'secondary'} onClick={handleOpen}>
        إضافات وخصومات أخرى
        {count > 0 ? (
          <span className="mr-1 inline-flex min-w-[1.15rem] items-center justify-center rounded-full bg-[#0E78AA]/15 px-1 text-[10px] text-[#094C6B]">
            {count}
          </span>
        ) : null}
      </Button>
      {open ? (
        <div className="mt-2 overflow-x-auto rounded-xl border border-[#D6EAF3] bg-white erp-scroll-x">
          <table className="w-full min-w-[76rem] text-sm">
            <thead>
              <tr className="bg-[#F6FBFD] text-xs font-semibold text-[#094C6B]">
                <th className="px-2 py-2 text-right whitespace-nowrap">الحساب</th>
                <th className="px-2 py-2 text-right whitespace-nowrap">قيمة الإضافة</th>
                <th className="px-2 py-2 text-right whitespace-nowrap">قيمة الخصم</th>
                <th className="px-2 py-2 text-right whitespace-nowrap">العملة</th>
                <th className="px-2 py-2 text-right whitespace-nowrap">سعر الصرف</th>
                <th className="px-2 py-2 text-right whitespace-nowrap">المعادل ({companyBaseLabel})</th>
                <th className="px-2 py-2 text-right whitespace-nowrap">الشرح</th>
                <th className="px-2 py-2 text-right whitespace-nowrap">مركز التكلفة</th>
                <th className="px-2 py-2 text-right whitespace-nowrap">الحساب المقابل</th>
                <th className="px-2 py-2 w-10" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={row.key} className="border-t border-[#E8F4FA]">
                  <td className="px-2 py-2 min-w-[12rem]">
                    <AccountSelect
                      value={row.accountId}
                      onChange={(accountId) => patch(index, { accountId })}
                      disabled={disabled}
                      leafOnly
                      placeholder="الحساب"
                    />
                  </td>
                  <td className="px-2 py-2 w-36">
                    <ExtraAmountField
                      value={row.additionValue}
                      calcType={row.additionCalcType}
                      disabled={disabled}
                      onValue={(additionValue) => patch(index, { additionValue })}
                      onCalcType={(additionCalcType) => patch(index, { additionCalcType })}
                    />
                  </td>
                  <td className="px-2 py-2 w-36">
                    <ExtraAmountField
                      value={row.discountValue}
                      calcType={row.discountCalcType}
                      disabled={disabled}
                      onValue={(discountValue) => patch(index, { discountValue })}
                      onCalcType={(discountCalcType) => patch(index, { discountCalcType })}
                    />
                  </td>
                  <td className="px-2 py-2 min-w-[7rem]">
                    <select
                      className={compactInput}
                      value={currencyLocked ? defaultCurrency : row.currency}
                      disabled={disabled || currencyLocked}
                      onChange={(e) => {
                        const code = e.target.value;
                        const picked = currencies.find((c) => c.code === code);
                        patch(index, {
                          currency: code,
                          exchangeRate: rateForCurrency(code, companyBase, picked?.exchangeRate),
                        });
                      }}
                    >
                      {(currencies.length ? currencies : [{ id: 'egp', code: 'EGP', arabicName: 'جنيه' }]).map((c) => (
                        <option key={c.id} value={c.code}>
                          {c.code}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-2 w-28">
                    <ExchangeRateInput
                      className={compactInput}
                      currencyCode={row.currency}
                      companyBaseCode={companyBase}
                      value={row.exchangeRate}
                      disabled={disabled || row.currency === companyBase}
                      onChange={(rate) => patch(index, { exchangeRate: rate })}
                    />
                  </td>
                  <td className="px-2 py-2 w-28 text-end font-mono text-xs text-slate-600">
                    {formatBaseAmount(
                      (row.additionCalcType === 'PERCENTAGE' ? 0 : toBaseAmount(row.additionValue, row.exchangeRate)) -
                        (row.discountCalcType === 'PERCENTAGE' ? 0 : toBaseAmount(row.discountValue, row.exchangeRate))
                    )}
                  </td>
                  <td className="px-2 py-2 min-w-[9rem]">
                    <input
                      className={compactInput}
                      value={row.description}
                      disabled={disabled}
                      placeholder="بيان"
                      onChange={(e) => patch(index, { description: e.target.value })}
                    />
                  </td>
                  <td className="px-2 py-2 min-w-[10rem]">
                    <CostCenterSelect
                      value={row.costCenterId}
                      onChange={(costCenterId) => patch(index, { costCenterId })}
                      disabled={disabled}
                    />
                  </td>
                  <td className="px-2 py-2 min-w-[12rem]">
                    <AccountSelect
                      value={row.offsetAccountId}
                      onChange={(offsetAccountId) => patch(index, { offsetAccountId })}
                      disabled={disabled}
                      leafOnly
                      placeholder="العميل / المورد"
                      emptyLabel="العميل / المورد"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <button
                      type="button"
                      className="text-xs font-semibold text-red-600 disabled:opacity-40"
                      disabled={disabled}
                      onClick={() => onChange(rows.filter((_, i) => i !== index))}
                    >
                      حذف
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {disabled ? null : (
            <div className="border-t border-[#E8F4FA] px-3 py-2">
              <Button type="button" size="sm" variant="secondary" onClick={addRow}>
                + سطر
              </Button>
              <p className={`${erpLabelClass} mt-2 mb-0 font-normal text-[11px] text-slate-500`}>
                قيمة الإضافة وقيمة الخصم مستقلّين، وكل واحد ليه زر يبدّل بين نسبة وقيمة. لو الحساب المقابل فاضي، القيد يتقفل على العميل أو المورد.
              </p>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
