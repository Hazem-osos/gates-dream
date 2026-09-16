'use client';

import { Trash2 } from 'lucide-react';
import { CostCenterSelect } from '@/app/components/form/CostCenterSelect';
import { UniversalDataGrid } from '@/components/ui/data-entry-grid';
import { dataEntryGridInputClass } from '@/components/ui/data-entry-grid/tokens';
import {
  handleLineGridKeyDown,
  lineGridDataAttrs,
} from '@/lib/keyboard/gridLineFocus';
import {
  formatBaseAmount,
  isFxRateLocked,
  lineFxRate,
  rateForCurrency,
  toBaseAmount,
} from '@/lib/accounting/fx-base';
import { useCompanyBaseCurrency } from '@/lib/hooks/useCompanyBaseCurrency';
import { ExchangeRateInput } from '@/components/accounting/ExchangeRateInput';
import { VoucherAccountCombobox } from './VoucherAccountCombobox';
import { costCenterRuleFromAccount } from '@/lib/accounting/cost-center-rule';
import { useAccountsQuery } from '@/lib/hooks/useMasterDataQueries';

export type VoucherLineCurrency = {
  id: string;
  code: string;
  arabicName?: string;
  exchangeRate?: number | string | null;
};

export type VoucherGridLine = {
  accountId: string;
  partyId?: string;
  partyKind?: 'CUSTOMER' | 'SUPPLIER';
  description?: string;
  amount: number;
  currencyCode?: string;
  exchangeRate?: number;
  costCenterId?: string;
  entrySide?: 'DEBIT' | 'CREDIT';
  isTiedToInvoice?: boolean;
  invoiceId?: string | null;
  invoiceLabel?: string;
};

const GRID_ID = 'voucher-lines';

type Props = {
  lines: VoucherGridLine[];
  onChange: (lines: VoucherGridLine[]) => void;
  onAddLine: () => void;
  disabled?: boolean;
  accountLabelFor?: (accountId: string) => string | undefined;
  currencies?: VoucherLineCurrency[];
  headerCurrencyCode?: string;
  showFx?: boolean;
};

function formatAmountInput(value: number) {
  if (!value) return '';
  return value.toLocaleString('en-US', {
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

export function VoucherLinesGrid({
  lines,
  onChange,
  onAddLine,
  disabled,
  accountLabelFor,
  currencies = [],
  headerCurrencyCode,
  showFx = true,
}: Props) {
  const { code: companyBase, label: companyBaseLabel } = useCompanyBaseCurrency();
  const { data: accountsRes } = useAccountsQuery(undefined, 500, { leafOnly: true });
  const accounts = accountsRes?.data ?? [];
  const ruleFor = (accountId?: string) =>
    costCenterRuleFromAccount(accounts.find((a) => a.id === accountId));
  const headerCode = headerCurrencyCode || companyBase;
  const fieldOrder = showFx
    ? ['account', 'description', 'amount', 'currency', 'rate', 'costCenter']
    : ['account', 'description', 'amount', 'costCenter'];
  const headerRate = rateForCurrency(
    headerCode,
    companyBase,
    currencies.find((c) => c.code === headerCode)?.exchangeRate
  );
  const updateLine = (index: number, patch: Partial<VoucherGridLine>) => {
    onChange(lines.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  };

  const removeLine = (index: number) => {
    if (lines.length <= 1) {
      onChange([
        {
          accountId: '',
          description: '',
          amount: 0,
          costCenterId: '',
          currencyCode: headerCode,
          exchangeRate: headerRate,
        },
      ]);
      return;
    }
    onChange(lines.filter((_, i) => i !== index));
  };

  const keyHandlers = (index: number, field: string) => ({
    ...lineGridDataAttrs(GRID_ID, index, field),
    onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => {
      if (
        e.key === 'Enter' &&
        (field === 'amount' || field === 'description') &&
        !e.shiftKey
      ) {
        e.preventDefault();
        onAddLine();
        window.setTimeout(() => {
          const el = document.querySelector<HTMLElement>(
            `[data-line-grid="${GRID_ID}"][data-line-index="${index + 1}"][data-line-field="account"]`
          );
          el?.focus();
        }, 50);
        return;
      }
      handleLineGridKeyDown(e, {
        gridId: GRID_ID,
        lineIndex: index,
        fieldOrder,
        onAppendLine: onAddLine,
        onRemoveLine: removeLine,
      });
    },
  });

  return (
    <UniversalDataGrid
      columns={[
        { id: '#', label: '#', className: 'w-10 text-center', align: 'center' },
        { id: 'account', label: 'الحساب / العميل / المورد', className: 'min-w-[240px]' },
        { id: 'description', label: 'البيان / ملاحظات السطر', className: 'min-w-[180px]' },
        { id: 'amount', label: 'المبلغ', className: 'w-36 min-w-[8rem]', align: 'center' },
        ...(showFx
          ? [
              { id: 'base', label: `المبلغ المعادل (${companyBaseLabel})`, className: 'w-32 min-w-[7rem]', align: 'center' as const },
              { id: 'currency', label: 'العملة', className: 'w-24 min-w-[6rem]' },
              { id: 'rate', label: 'سعر الصرف', className: 'w-24 min-w-[6rem]', align: 'center' as const },
            ]
          : []),
        { id: 'costCenter', label: 'مركز التكلفة', className: 'w-44 min-w-[10rem]' },
        { id: 'action', label: 'إجراء', className: 'w-12 text-center', align: 'center' },
      ]}
      rowCount={Math.max(lines.length, 1)}
      disabled={disabled}
      onAddRow={disabled ? undefined : onAddLine}
      renderCell={(index, columnId) => {
        const line = lines[index] ?? {
          accountId: '',
          amount: 0,
          description: '',
          costCenterId: '',
          currencyCode: headerCode,
          exchangeRate: headerRate,
        };
        if (columnId === '#') {
          return <span className="block text-center text-xs text-muted-foreground">{index + 1}</span>;
        }
        if (columnId === 'account') {
          return (
            <VoucherAccountCombobox
              value={line.accountId}
              partyId={line.partyId}
              partyKind={line.partyKind}
              valueLabel={accountLabelFor?.(line.accountId)}
              disabled={disabled}
              onPick={(pick) =>
                updateLine(index, {
                  accountId: pick.accountId,
                  partyId: pick.kind === 'ACCOUNT' ? undefined : pick.partyId,
                  partyKind: pick.kind === 'ACCOUNT' ? undefined : pick.kind,
                  costCenterId: ruleFor(pick.accountId) === 'none' ? '' : line.costCenterId,
                })
              }
              inputProps={lineGridDataAttrs(GRID_ID, index, 'account')}
              onInputKeyDown={(e) => keyHandlers(index, 'account').onKeyDown(e)}
            />
          );
        }
        if (columnId === 'costCenter') {
          const rule = ruleFor(line.accountId);
          return (
            <CostCenterSelect
              value={rule === 'none' ? '' : line.costCenterId || ''}
              onChange={(id) => updateLine(index, { costCenterId: id })}
              disabled={disabled || rule === 'none'}
              allowEmpty={rule !== 'required'}
              emptyLabel={rule === 'none' ? 'بدون — الحساب لا يقبل مركز' : rule === 'required' ? 'مطلوب' : 'اختياري'}
              className={dataEntryGridInputClass}
              nativeSelectProps={keyHandlers(index, 'costCenter')}
            />
          );
        }
        if (columnId === 'base') {
          return (
            <span className="block text-end font-mono text-xs text-slate-600">
              {formatBaseAmount(toBaseAmount(line.amount, line.exchangeRate))}
            </span>
          );
        }
        if (columnId === 'currency') {
          return (
            <select
              className={dataEntryGridInputClass}
              disabled={disabled}
              value={line.currencyCode || headerCode}
              onChange={(e) => {
                const next = currencies.find((c) => c.code === e.target.value);
                updateLine(index, {
                  currencyCode: e.target.value,
                  exchangeRate: lineFxRate({
                    lineCurrencyCode: next?.code,
                    headerCurrencyCode: headerCode,
                    companyBaseCode: companyBase,
                    catalogRate: next?.exchangeRate,
                  }),
                });
              }}
              {...keyHandlers(index, 'currency')}
            >
              {(currencies.length ? currencies : [{ id: 'base', code: companyBase }]).map((c) => (
                <option key={c.id || c.code} value={c.code}>
                  {c.code}
                </option>
              ))}
            </select>
          );
        }
        if (columnId === 'rate') {
          const lineCode = line.currencyCode || headerCode;
          const rateLocked = isFxRateLocked(lineCode, companyBase);
          return (
            <ExchangeRateInput
              disabled={disabled || rateLocked}
              currencyCode={lineCode}
              companyBaseCode={companyBase}
              value={rateLocked ? 1 : line.exchangeRate ?? 1}
              onChange={(rate) => updateLine(index, { exchangeRate: rate })}
              className={`${dataEntryGridInputClass} text-end font-mono`}
              {...keyHandlers(index, 'rate')}
            />
          );
        }
        if (columnId === 'amount') {
          const attrs = keyHandlers(index, 'amount');
          return (
            <input
              type="text"
              inputMode="decimal"
              disabled={disabled}
              value={formatAmountInput(line.amount)}
              onChange={(e) => {
                const raw = e.target.value.replace(/,/g, '');
                if (raw === '' || raw === '.') {
                  updateLine(index, { amount: 0 });
                  return;
                }
                const parsed = Number(raw);
                if (!Number.isNaN(parsed)) updateLine(index, { amount: parsed });
              }}
              className={`${dataEntryGridInputClass} text-end font-mono font-medium`}
              placeholder="0.00"
              {...attrs}
            />
          );
        }
        if (columnId === 'description') {
          const attrs = keyHandlers(index, 'description');
          return (
            <input
              type="text"
              disabled={disabled}
              value={line.description || ''}
              onChange={(e) => updateLine(index, { description: e.target.value })}
              className={dataEntryGridInputClass}
              placeholder="البيان"
              {...attrs}
            />
          );
        }
        return (
          <button
            type="button"
            disabled={disabled}
            onClick={() => removeLine(index)}
            className="mx-auto flex h-8 w-8 items-center justify-center rounded-md text-slate-400 opacity-0 transition-opacity hover:bg-rose-50 hover:text-rose-600 group-hover/row:opacity-100 disabled:opacity-20"
            aria-label="حذف السطر"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        );
      }}
    />
  );
}
