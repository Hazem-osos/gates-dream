'use client';

import { Plus, Trash2 } from 'lucide-react';
import { AccountSelect } from '@/app/components/form/AccountSelect';
import { CostCenterSelect } from '@/app/components/form/CostCenterSelect';
import { Button, IconButton, compactControlClass } from '@/components/ui';
import { isFxRateLocked, rateForCurrency } from '@/lib/accounting/fx-base';
import { ExchangeRateInput } from '@/components/accounting/ExchangeRateInput';
import { TableNumberInput } from '@/components/grid/TableNumberInput';
import { useCompanyBaseCurrency } from '@/lib/hooks/useCompanyBaseCurrency';
import { costCenterRuleFromAccount } from '@/lib/accounting/cost-center-rule';
import { ACCOUNT_PICKER_PAGE_SIZE, useAccountsQuery } from '@/lib/hooks/useMasterDataQueries';
import { seedLineDescription, useFollowHeaderDescription } from '@/lib/hooks/useFollowHeaderDescription';

export type EditableJournalLine = {
  accountId: string;
  description: string;
  debit: number;
  credit: number;
  currencyId?: string;
  exchangeRate: number;
  costCenterId?: string;
};

export type CurrencyOption = {
  id: string;
  code: string;
  arabicName: string;
  exchangeRate?: number | string | null;
};

type Props = {
  lines: EditableJournalLine[];
  onChange: (lines: EditableJournalLine[]) => void;
  currencies?: CurrencyOption[];
  defaultCurrencyId?: string;
  disabled?: boolean;
  headerDescription?: string;
};

export function emptyJournalLine(currencyId?: string, exchangeRate = 1): EditableJournalLine {
  return {
    accountId: '',
    description: '',
    debit: 0,
    credit: 0,
    currencyId,
    exchangeRate,
    costCenterId: '',
  };
}

export function EditableJournalLinesTable({
  lines,
  onChange,
  currencies = [],
  defaultCurrencyId,
  disabled,
  headerDescription = '',
}: Props) {
  const { code: companyBase } = useCompanyBaseCurrency();
  const { data: accountsRes } = useAccountsQuery(undefined, ACCOUNT_PICKER_PAGE_SIZE, { leafOnly: true });
  const accounts = accountsRes?.data ?? [];
  const ruleFor = (accountId?: string) =>
    costCenterRuleFromAccount(accounts.find((a) => a.id === accountId));
  const headerCurrency = currencies.find((c) => c.id === defaultCurrencyId);
  const headerRate = rateForCurrency(headerCurrency?.code, companyBase, headerCurrency?.exchangeRate);

  useFollowHeaderDescription({
    headerDescription,
    lines,
    onChange,
    getDescription: (line) => line.description,
    setDescription: (line, value) => ({ ...line, description: value }),
    disabled,
  });

  const updateLine = (index: number, patch: Partial<EditableJournalLine>) => {
    const next = [...lines];
    next[index] = { ...next[index], ...patch };
    onChange(next);
  };

  const addLine = () => {
    onChange([
      ...lines,
      {
        ...emptyJournalLine(defaultCurrencyId, headerRate),
        description: seedLineDescription(headerDescription),
      },
    ]);
  };

  const removeLine = (index: number) => {
    onChange(lines.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3" dir="rtl">
      <div className="flex items-center justify-end">
        <Button type="button" variant="primary" size="sm" className="gap-2" onClick={addLine} disabled={disabled}>
          <Plus className="h-4 w-4" aria-hidden />
          إضافة سطر
        </Button>
      </div>
      <div className="overflow-x-auto rounded-xl border border-[#D6EAF3] bg-white">
        <table className="min-w-full text-center text-xs sm:text-sm">
          <thead>
            <tr>
              {['م', 'الحساب', 'الشرح', 'مدين', 'دائن', 'العملة', 'سعر الصرف', 'مركز التكلفة', ''].map((h) => (
                <th
                  key={h || 'actions'}
                  className="bg-[#0E78AA] px-2 py-2 text-xs font-bold text-white border-r border-white/20 last:border-r-0"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-6 text-sm text-slate-500">
                  لا توجد بنود — اضغط «إضافة سطر» لإدخال الحساب والمبلغ. الجدول جزء من المستند ويُرسل مع الحفظ.
                </td>
              </tr>
            ) : (
              lines.map((line, index) => (
                <tr key={`jl-${index}`} className={index % 2 === 0 ? 'bg-[#F6FBFD]' : 'bg-white'}>
                  <td className="border-x border-[#D6EAF3] px-2 py-1.5 tabular-nums">{index + 1}</td>
                  <td className="min-w-[12rem] border-x border-[#D6EAF3] px-1.5 py-1.5">
                    <AccountSelect
                      value={line.accountId}
                      onChange={(accountId) =>
                        updateLine(index, {
                          accountId,
                          costCenterId: ruleFor(accountId) === 'none' ? '' : line.costCenterId,
                        })
                      }
                      className={compactControlClass}
                      disabled={disabled}
                      emptyLabel="اختر الحساب"
                      leafOnly
                    />
                  </td>
                  <td className="min-w-[8rem] border-x border-[#D6EAF3] px-1.5 py-1.5">
                    <input
                      className={compactControlClass}
                      value={line.description}
                      disabled={disabled}
                      placeholder="الشرح"
                      onChange={(e) => updateLine(index, { description: e.target.value })}
                    />
                  </td>
                  <td className="w-24 border-x border-[#D6EAF3] px-1.5 py-1.5">
                    <TableNumberInput
                      className={`${compactControlClass} text-center`}
                      value={line.debit}
                      disabled={disabled}
                      onValueCommit={(n) => updateLine(index, { debit: n, credit: n > 0 ? 0 : line.credit })}
                    />
                  </td>
                  <td className="w-24 border-x border-[#D6EAF3] px-1.5 py-1.5">
                    <TableNumberInput
                      className={`${compactControlClass} text-center`}
                      value={line.credit}
                      disabled={disabled}
                      onValueCommit={(n) => updateLine(index, { credit: n, debit: n > 0 ? 0 : line.debit })}
                    />
                  </td>
                  <td className="w-32 border-x border-[#D6EAF3] px-1.5 py-1.5">
                    <select
                      className={compactControlClass}
                      value={line.currencyId || defaultCurrencyId || ''}
                      disabled={disabled || currencies.length === 0}
                      onChange={(e) => {
                        const next = currencies.find((c) => c.id === e.target.value);
                        updateLine(index, {
                          currencyId: e.target.value,
                          exchangeRate: rateForCurrency(next?.code, companyBase, next?.exchangeRate),
                        });
                      }}
                    >
                      {currencies.length === 0 ? <option value="">—</option> : null}
                      {currencies.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.arabicName} ({c.code})
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="w-24 border-x border-[#D6EAF3] px-1.5 py-1.5">
                    <ExchangeRateInput
                      className={`${compactControlClass} text-center`}
                      currencyId={line.currencyId || defaultCurrencyId}
                      currencyCode={
                        currencies.find((c) => c.id === (line.currencyId || defaultCurrencyId))?.code
                      }
                      companyBaseCode={companyBase}
                      value={
                        isFxRateLocked(
                          currencies.find((c) => c.id === (line.currencyId || defaultCurrencyId))?.code,
                          companyBase
                        )
                          ? 1
                          : line.exchangeRate || ''
                      }
                      disabled={
                        disabled ||
                        isFxRateLocked(
                          currencies.find((c) => c.id === (line.currencyId || defaultCurrencyId))?.code,
                          companyBase
                        )
                      }
                      onChange={(rate) => updateLine(index, { exchangeRate: rate })}
                    />
                  </td>
                  <td className="min-w-[10rem] border-x border-[#D6EAF3] px-1.5 py-1.5">
                    <CostCenterSelect
                      value={ruleFor(line.accountId) === 'none' ? '' : line.costCenterId || ''}
                      onChange={(costCenterId) => updateLine(index, { costCenterId })}
                      className={compactControlClass}
                      disabled={disabled || ruleFor(line.accountId) === 'none'}
                      allowEmpty={ruleFor(line.accountId) !== 'required'}
                      emptyLabel={
                        ruleFor(line.accountId) === 'none'
                          ? 'بدون — الحساب لا يقبل مركز'
                          : ruleFor(line.accountId) === 'required'
                            ? 'مطلوب'
                            : 'اختياري'
                      }
                    />
                  </td>
                  <td className="border-x border-[#D6EAF3] px-1.5 py-1.5">
                    <IconButton
                      icon={Trash2}
                      label="حذف السطر"
                      variant="danger"
                      onClick={() => removeLine(index)}
                      disabled={disabled}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
