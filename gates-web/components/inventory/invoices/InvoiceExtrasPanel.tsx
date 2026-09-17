'use client';

import { Button } from '@/components/ui';
import { AccountSelect } from '@/components/form/AccountSelect';
import { CostCenterSelect } from '@/components/form/CostCenterSelect';
import {
  emptyInvoiceExtraRow,
  type InvoiceAdjustmentCalc,
  type InvoiceExtraRow,
} from '@/lib/invoices/invoice-adjustments';
import { erpInputClass, erpLabelClass } from '@/components/erp/erpUiTokens';
import { formatBaseAmount, rateForCurrency, toBaseAmount } from '@/lib/accounting/fx-base';
import { ExchangeRateInput } from '@/components/accounting/ExchangeRateInput';
import { useCompanyBaseCurrency } from '@/lib/hooks/useCompanyBaseCurrency';
import { seedLineDescription, useFollowHeaderDescription } from '@/lib/hooks/useFollowHeaderDescription';

type Currency = { id: string; code: string; arabicName: string; exchangeRate?: number | string | null };

const compactInput = `${erpInputClass} h-9 min-h-9 text-xs`;

function CalcToggle({
  value,
  onChange,
  disabled,
}: {
  value: InvoiceAdjustmentCalc;
  onChange: (next: InvoiceAdjustmentCalc) => void;
  disabled?: boolean;
}) {
  return (
    <select
      className={`${compactInput} w-[4.5rem] shrink-0 px-1`}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as InvoiceAdjustmentCalc)}
    >
      <option value="FIXED">قيمة</option>
      <option value="PERCENTAGE">%</option>
    </select>
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
          <table className="w-full min-w-[72rem] text-sm">
            <thead>
              <tr className="bg-[#F6FBFD] text-xs font-semibold text-[#094C6B]">
                <th className="px-2 py-2 text-right whitespace-nowrap">الحساب</th>
                <th className="px-2 py-2 text-right whitespace-nowrap">نسبة أو قيمة الخصم</th>
                <th className="px-2 py-2 text-right whitespace-nowrap">نسبة أو قيمة الإضافة</th>
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
                  <td className="px-2 py-2">
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className={compactInput}
                        value={row.discountValue}
                        disabled={disabled}
                        placeholder="0"
                        onChange={(e) =>
                          patch(index, {
                            discountValue: e.target.value === '' ? '' : Number(e.target.value),
                            additionValue: e.target.value ? '' : row.additionValue,
                          })
                        }
                      />
                      <CalcToggle
                        value={row.discountCalcType}
                        disabled={disabled}
                        onChange={(discountCalcType) => patch(index, { discountCalcType })}
                      />
                    </div>
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className={compactInput}
                        value={row.additionValue}
                        disabled={disabled}
                        placeholder="0"
                        onChange={(e) =>
                          patch(index, {
                            additionValue: e.target.value === '' ? '' : Number(e.target.value),
                            discountValue: e.target.value ? '' : row.discountValue,
                          })
                        }
                      />
                      <CalcToggle
                        value={row.additionCalcType}
                        disabled={disabled}
                        onChange={(additionCalcType) => patch(index, { additionCalcType })}
                      />
                    </div>
                  </td>
                  <td className="px-2 py-2 min-w-[7rem]">
                    <select
                      className={compactInput}
                      value={row.currency}
                      disabled={disabled}
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
                      toBaseAmount(
                        Number(row.additionValue || 0) || Number(row.discountValue || 0),
                        row.exchangeRate
                      )
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
                لو الحساب المقابل فاضي، الخصم أو الإضافة تتقفل على العميل أو المورد. لو حددت حساب مقابل، القيد يروح عليه.
              </p>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
