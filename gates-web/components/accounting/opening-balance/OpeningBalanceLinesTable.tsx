'use client';

import { Trash2 } from 'lucide-react';
import { AccountSelect } from '@/app/components/form/AccountSelect';
import { CostCenterSelect } from '@/app/components/form/CostCenterSelect';
import { UniversalDataGrid } from '@/components/ui/data-entry-grid';
import { dataEntryGridInputClass } from '@/components/ui/data-entry-grid/tokens';
import {
  handleLineGridKeyDown,
  OPENING_BALANCE_LINE_FIELD_ORDER,
  lineGridDataAttrs,
} from '@/lib/keyboard/gridLineFocus';
import type { EditableJournalLine } from '@/components/accounting/EditableJournalLinesTable';
import { formatBaseAmount, isFxRateLocked, lineFxRate, rateForCurrency, toBaseAmount } from '@/lib/accounting/fx-base';
import { ExchangeRateInput } from '@/components/accounting/ExchangeRateInput';
import { useCompanyBaseCurrency } from '@/lib/hooks/useCompanyBaseCurrency';

export type OpeningBalanceLineCurrency = {
  id: string;
  code: string;
  arabicName?: string;
  exchangeRate?: number | string | null;
};

type Props = {
  gridId?: string;
  lines: EditableJournalLine[];
  onChange: (lines: EditableJournalLine[]) => void;
  onAddLine: () => void;
  disabled?: boolean;
  currencies?: OpeningBalanceLineCurrency[];
  defaultCurrencyId?: string;
  accountLabelFor?: (accountId: string) => string | undefined;
  showFx?: boolean;
};

function emptyLine(currencyId?: string, exchangeRate = 1): EditableJournalLine {
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

function formatAmountInput(value: number) {
  if (!value) return '';
  return value.toLocaleString('en-US', {
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

export function OpeningBalanceLinesTable({
  gridId = 'opening-balance-lines',
  lines,
  onChange,
  onAddLine,
  disabled,
  currencies = [],
  defaultCurrencyId,
  accountLabelFor,
  showFx = true,
}: Props) {
  const fieldOrder = showFx
    ? [...OPENING_BALANCE_LINE_FIELD_ORDER]
    : OPENING_BALANCE_LINE_FIELD_ORDER.filter((field) => field !== 'currency' && field !== 'rate');
  const { code: companyBase, label: companyBaseLabel } = useCompanyBaseCurrency();
  const headerCurrency = currencies.find((c) => c.id === defaultCurrencyId);
  const headerRate = rateForCurrency(headerCurrency?.code, companyBase, headerCurrency?.exchangeRate);
  const blankLine = () => emptyLine(defaultCurrencyId, headerRate);

  const updateLine = (index: number, patch: Partial<EditableJournalLine>) => {
    const current = lines[index] ?? blankLine();
    const next = lines.length ? [...lines] : [];
    if (!lines[index]) {
      while (next.length < index) next.push(blankLine());
      next.push({ ...current, ...patch });
    } else {
      next[index] = { ...current, ...patch };
    }
    onChange(next);
  };

  const removeLine = (index: number) => {
    if (lines.length <= 1) {
      onChange([blankLine()]);
      return;
    }
    onChange(lines.filter((_, i) => i !== index));
  };

  const keyHandlers = (index: number, field: string) => ({
    ...lineGridDataAttrs(gridId, index, field),
    onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => {
      if (e.key === 'Enter' && (field === 'costCenter' || field === 'description') && !e.shiftKey) {
        e.preventDefault();
        onAddLine();
        window.setTimeout(() => {
          document
            .querySelector<HTMLElement>(
              `[data-line-grid="${gridId}"][data-line-index="${index + 1}"][data-line-field="account"]`
            )
            ?.focus();
        }, 50);
        return;
      }
      handleLineGridKeyDown(e, {
        gridId,
        lineIndex: index,
        fieldOrder,
        onAppendLine: onAddLine,
        onRemoveLine: removeLine,
      });
    },
  });

  const columns = [
    { id: '#', label: '#', className: 'w-10 text-center', align: 'center' as const },
    { id: 'account', label: 'الحساب', className: 'min-w-[220px]' },
    { id: 'description', label: 'البيان', className: 'min-w-[140px]' },
    { id: 'debit', label: 'مدين', className: 'w-28 min-w-[6.5rem]', align: 'center' as const },
    { id: 'credit', label: 'دائن', className: 'w-28 min-w-[6.5rem]', align: 'center' as const },
    ...(showFx
      ? [
          { id: 'debitBase', label: `مدين معادل (${companyBaseLabel})`, className: 'w-28 min-w-[6.5rem]', align: 'center' as const },
          { id: 'creditBase', label: `دائن معادل (${companyBaseLabel})`, className: 'w-28 min-w-[6.5rem]', align: 'center' as const },
          { id: 'currency', label: 'العملة', className: 'w-24 min-w-[6rem]' },
          { id: 'rate', label: 'سعر الصرف', className: 'w-24 min-w-[6rem]', align: 'center' as const },
        ]
      : []),
    { id: 'costCenter', label: 'مركز التكلفة', className: 'w-44 min-w-[10rem]' },
    { id: 'action', label: 'إجراء', className: 'w-12 text-center', align: 'center' as const },
  ];

  return (
    <UniversalDataGrid
      columns={columns}
      rowCount={Math.max(lines.length, 1)}
      disabled={disabled}
      onAddRow={disabled ? undefined : onAddLine}
      addLabel="إضافة طرف جديد (Enter)"
      renderCell={(index, columnId) => {
        const line = lines[index] ?? blankLine();
        if (columnId === '#') {
          return (
            <span className="block text-center font-mono text-xs text-muted-foreground">{index + 1}</span>
          );
        }
        if (columnId === 'account') {
          return (
            <AccountSelect
              value={line.accountId}
              onChange={(accountId) => updateLine(index, { accountId })}
              disabled={disabled}
              leafOnly
              emptyLabel="اختر الحساب"
              className={dataEntryGridInputClass}
              selectedAccount={
                line.accountId && accountLabelFor
                  ? { id: line.accountId, code: '', arabicName: accountLabelFor(line.accountId) || '' }
                  : undefined
              }
              nativeSelectProps={{
                ...lineGridDataAttrs(gridId, index, 'account'),
                onKeyDown: (e) => keyHandlers(index, 'account').onKeyDown(e),
              }}
            />
          );
        }
        if (columnId === 'description') {
          return (
            <input
              type="text"
              disabled={disabled}
              value={line.description || ''}
              onChange={(e) => updateLine(index, { description: e.target.value })}
              className={`${dataEntryGridInputClass} text-start`}
              placeholder="البيان"
              {...keyHandlers(index, 'description')}
            />
          );
        }
        if (columnId === 'debit') {
          return (
            <input
              type="text"
              inputMode="decimal"
              disabled={disabled}
              value={formatAmountInput(Number(line.debit) || 0)}
              onChange={(e) => {
                const raw = e.target.value.replace(/,/g, '');
                if (raw === '' || raw === '.') {
                  updateLine(index, { debit: 0 });
                  return;
                }
                const parsed = Number(raw);
                if (!Number.isNaN(parsed)) updateLine(index, { debit: parsed, credit: parsed > 0 ? 0 : line.credit });
              }}
              className={`${dataEntryGridInputClass} h-9 text-xs text-end font-mono font-medium`}
              placeholder="0.00"
              {...keyHandlers(index, 'debit')}
            />
          );
        }
        if (columnId === 'credit') {
          return (
            <input
              type="text"
              inputMode="decimal"
              disabled={disabled}
              value={formatAmountInput(Number(line.credit) || 0)}
              onChange={(e) => {
                const raw = e.target.value.replace(/,/g, '');
                if (raw === '' || raw === '.') {
                  updateLine(index, { credit: 0 });
                  return;
                }
                const parsed = Number(raw);
                if (!Number.isNaN(parsed)) updateLine(index, { credit: parsed, debit: parsed > 0 ? 0 : line.debit });
              }}
              className={`${dataEntryGridInputClass} h-9 text-xs text-end font-mono font-medium`}
              placeholder="0.00"
              {...keyHandlers(index, 'credit')}
            />
          );
        }
        if (columnId === 'debitBase') {
          return (
            <span className="block text-end font-mono text-xs text-slate-600">
              {formatBaseAmount(toBaseAmount(line.debit, line.exchangeRate))}
            </span>
          );
        }
        if (columnId === 'creditBase') {
          return (
            <span className="block text-end font-mono text-xs text-slate-600">
              {formatBaseAmount(toBaseAmount(line.credit, line.exchangeRate))}
            </span>
          );
        }
        if (columnId === 'currency') {
          return (
            <select
              className={dataEntryGridInputClass}
              disabled={disabled}
              value={line.currencyId || defaultCurrencyId || ''}
              onChange={(e) => {
                const next = currencies.find((c) => c.id === e.target.value);
                const headerCode = currencies.find((c) => c.id === defaultCurrencyId)?.code;
                updateLine(index, {
                  currencyId: e.target.value,
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
              {(currencies.length ? currencies : [{ id: 'egp', code: companyBase }]).map((c) => (
                <option key={c.id || c.code} value={c.id}>
                  {c.code}
                </option>
              ))}
            </select>
          );
        }
        if (columnId === 'rate') {
          const selected = currencies.find((c) => c.id === (line.currencyId || defaultCurrencyId));
          const rateLocked = isFxRateLocked(selected?.code, companyBase);
          return (
            <ExchangeRateInput
              disabled={disabled || rateLocked}
              currencyId={selected?.id}
              currencyCode={selected?.code}
              companyBaseCode={companyBase}
              value={rateLocked ? 1 : line.exchangeRate ?? 1}
              onChange={(rate) => updateLine(index, { exchangeRate: rate })}
              className={`${dataEntryGridInputClass} h-9 text-xs text-end font-mono`}
              {...keyHandlers(index, 'rate')}
            />
          );
        }
        if (columnId === 'costCenter') {
          return (
            <CostCenterSelect
              value={line.costCenterId || ''}
              onChange={(id) => updateLine(index, { costCenterId: id })}
              disabled={disabled}
              className={dataEntryGridInputClass}
              nativeSelectProps={keyHandlers(index, 'costCenter')}
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
