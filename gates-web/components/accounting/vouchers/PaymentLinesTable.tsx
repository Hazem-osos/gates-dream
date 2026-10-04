'use client';

import { Trash2 } from 'lucide-react';
import { CostCenterSelect } from '@/app/components/form/CostCenterSelect';
import { UniversalDataGrid } from '@/components/ui/data-entry-grid';
import { dataEntryGridInputClass } from '@/components/ui/data-entry-grid/tokens';
import { handleLineGridKeyDown, lineGridDataAttrs } from '@/lib/keyboard/gridLineFocus';
import { headerLocksLineCurrency, isFxRateLocked, lineFxRate, rateForCurrency } from '@/lib/accounting/fx-base';
import { ExchangeRateInput } from '@/components/accounting/ExchangeRateInput';
import { useCompanyBaseCurrency } from '@/lib/hooks/useCompanyBaseCurrency';
import { lineBaseAmount, type PaymentVoucherLine } from '@/lib/treasury/payment-voucher-line';
import { EditableAmountInput } from '@/components/grid/EditableAmountInput';
import { VoucherAccountCombobox } from './VoucherAccountCombobox';
import { costCenterRuleFromAccount } from '@/lib/accounting/cost-center-rule';
import { ACCOUNT_PICKER_PAGE_SIZE, useAccountsQuery } from '@/lib/hooks/useMasterDataQueries';
import { useFollowHeaderDescription } from '@/lib/hooks/useFollowHeaderDescription';

export type PaymentLineCurrency = { id: string; code: string; arabicName?: string; exchangeRate?: number | string | null };

type InvoiceKind = 'SALE' | 'PURCHASE';

type Props = {
  gridId: string;
  lines: PaymentVoucherLine[];
  onChange: (lines: PaymentVoucherLine[]) => void;
  onAddLine: () => void;
  disabled?: boolean;
  accountLabelFor?: (accountId: string) => string | undefined;
  currencies: PaymentLineCurrency[];
  baseCurrency?: string;
  showFx?: boolean;
  accountColumnLabel?: string;
  invoiceKind?: InvoiceKind;
  partyEmptyHint?: string;
  headerDescription?: string;
};

export function PaymentLinesTable({
  gridId,
  lines,
  onChange,
  onAddLine,
  disabled,
  accountLabelFor,
  currencies,
  baseCurrency,
  showFx = true,
  accountColumnLabel = 'الحساب',
  invoiceKind = 'PURCHASE',
  partyEmptyHint,
  headerDescription = '',
}: Props) {
  const { data: accountsRes } = useAccountsQuery(undefined, ACCOUNT_PICKER_PAGE_SIZE, { leafOnly: true });
  const accounts = accountsRes?.data ?? [];
  const costCenterRuleFor = (accountId: string) =>
    costCenterRuleFromAccount(accounts.find((a) => a.id === accountId));
  const { code: companyBase, label: companyBaseLabel } = useCompanyBaseCurrency();
  const headerCurrency = baseCurrency || companyBase || 'EGP';
  const resolvedBase = headerCurrency;
  const fieldOrder = showFx
    ? ['account', 'description', 'amount', 'tied', 'currency', 'rate', 'costCenter']
    : ['account', 'description', 'amount', 'tied', 'costCenter'];

  useFollowHeaderDescription({
    headerDescription,
    lines,
    onChange,
    getDescription: (line) => line.description,
    setDescription: (line, value) => ({ ...line, description: value }),
    disabled,
  });

  const updateLine = (index: number, patch: Partial<PaymentVoucherLine>) => {
    onChange(lines.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  };

  const removeLine = (index: number) => {
    if (lines.length <= 1) {
      onChange([
        {
          ...lines[0],
          accountId: '',
          description: '',
          amount: 0,
          invoiceId: null,
          isTiedToInvoice: false,
          currencyCode: headerCurrency,
          exchangeRate: rateForCurrency(
            headerCurrency,
            companyBase,
            currencies.find((c) => c.code === headerCurrency)?.exchangeRate
          ),
        },
      ]);
      return;
    }
    onChange(lines.filter((_, i) => i !== index));
  };

  const keyHandlers = (index: number, field: string) => ({
    ...lineGridDataAttrs(gridId, index, field),
    onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => {
      if (e.key === 'Enter' && field === 'description' && !e.shiftKey) {
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
    { id: 'account', label: accountColumnLabel, className: 'min-w-[220px]' },
    { id: 'description', label: 'البيان', className: 'min-w-[140px]' },
    { id: 'amount', label: 'المبلغ', className: 'w-32 min-w-[7rem]', align: 'center' as const },
    { id: 'tied', label: 'مؤيد', className: 'w-28 min-w-[7rem]' },
    ...(showFx
      ? [
          { id: 'base', label: `المبلغ المعادل (${companyBaseLabel})`, className: 'w-32 min-w-[7rem]', align: 'center' as const },
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
      renderCell={(index, columnId) => {
        const line = lines[index] ?? {
          accountId: '',
          amount: 0,
          description: '',
          costCenterId: '',
          currencyCode: resolvedBase,
          exchangeRate: rateForCurrency(
            resolvedBase,
            companyBase,
            currencies.find((c) => c.code === resolvedBase)?.exchangeRate
          ),
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
                  costCenterId:
                    pick.accountId && costCenterRuleFor?.(pick.accountId) === 'none'
                      ? ''
                      : line.costCenterId,
                })
              }
              inputProps={lineGridDataAttrs(gridId, index, 'account')}
              onInputKeyDown={(e) => keyHandlers(index, 'account').onKeyDown(e)}
            />
          );
        }
        if (columnId === 'tied') {
          return (
            <InvoiceTieCell
              line={line}
              disabled={disabled}
              invoiceKind={invoiceKind}
              partyEmptyHint={partyEmptyHint}
              onChange={(patch) => updateLine(index, patch)}
            />
          );
        }
        if (columnId === 'currency') {
          const currencyLocked = headerLocksLineCurrency(headerCurrency);
          return (
            <select
              className={dataEntryGridInputClass}
              disabled={disabled || currencyLocked}
              value={currencyLocked ? headerCurrency : line.currencyCode || resolvedBase}
              onChange={(e) => {
                const next = currencies.find((c) => c.code === e.target.value);
                updateLine(index, {
                  currencyCode: e.target.value,
                  exchangeRate: lineFxRate({
                    lineCurrencyCode: next?.code,
                    headerCurrencyCode: headerCurrency,
                    companyBaseCode: companyBase,
                    catalogRate: next?.exchangeRate,
                  }),
                });
              }}
              {...keyHandlers(index, 'currency')}
            >
              {(currencies.length ? currencies : [{ id: 'egp', code: resolvedBase }]).map((c) => (
                <option key={c.id || c.code} value={c.code}>
                  {c.code}
                </option>
              ))}
            </select>
          );
        }
        if (columnId === 'rate') {
          const lineCode = line.currencyCode || headerCurrency;
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
          return (
            <EditableAmountInput
              disabled={disabled}
              value={line.amount}
              onValueChange={(amount) => updateLine(index, { amount })}
              className={`${dataEntryGridInputClass} text-end font-mono font-medium`}
              placeholder="0.00"
              {...keyHandlers(index, 'amount')}
            />
          );
        }
        if (columnId === 'base') {
          return (
            <span className="block text-end font-mono text-xs text-slate-600">
              {lineBaseAmount(line).toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          );
        }
        if (columnId === 'description') {
          return (
            <input
              type="text"
              disabled={disabled}
              value={line.description || ''}
              onChange={(e) => updateLine(index, { description: e.target.value })}
              className={dataEntryGridInputClass}
              placeholder="البيان"
              {...keyHandlers(index, 'description')}
            />
          );
        }
        if (columnId === 'costCenter') {
          const forbidCc = Boolean(line.accountId && costCenterRuleFor?.(line.accountId) === 'none');
          const requireCc = Boolean(line.accountId && costCenterRuleFor?.(line.accountId) === 'required');
          return (
            <CostCenterSelect
              value={forbidCc ? '' : line.costCenterId || ''}
              onChange={(id) => updateLine(index, { costCenterId: id })}
              disabled={disabled || forbidCc}
              allowEmpty={!requireCc}
              className={dataEntryGridInputClass}
              nativeSelectProps={keyHandlers(index, 'costCenter')}
              emptyLabel={forbidCc ? 'بدون — الحساب لا يقبل مركز' : requireCc ? 'مطلوب' : 'اختياري'}
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

function InvoiceTieCell({
  line,
  disabled,
  onChange,
}: {
  line: PaymentVoucherLine;
  disabled?: boolean;
  onChange: (patch: Partial<PaymentVoucherLine>) => void;
  invoiceKind: InvoiceKind;
  partyEmptyHint?: string;
}) {
  return (
    <select
      className={dataEntryGridInputClass}
      disabled={disabled}
      value={line.isTiedToInvoice ? 'yes' : 'no'}
      onChange={(e) => {
        const next = e.target.value === 'yes';
        onChange({
          isTiedToInvoice: next,
          invoiceId: next ? line.invoiceId : null,
          invoiceLabel: next ? line.invoiceLabel : undefined,
        });
      }}
    >
      <option value="no">غير مؤيد</option>
      <option value="yes">مؤيد</option>
    </select>
  );
}
