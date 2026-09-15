'use client';

import { useState } from 'react';
import { FileText, Trash2 } from 'lucide-react';
import { CostCenterSelect } from '@/app/components/form/CostCenterSelect';
import { UniversalDataGrid } from '@/components/ui/data-entry-grid';
import { dataEntryGridInputClass } from '@/components/ui/data-entry-grid/tokens';
import { handleLineGridKeyDown, JOURNAL_LINE_FIELD_ORDER, lineGridDataAttrs } from '@/lib/keyboard/gridLineFocus';
import { useApiQuery } from '@/lib/hooks/useApi';
import { formatBaseAmount, lineFxRate, sameCurrencyCode, toBaseAmount } from '@/lib/accounting/fx-base';
import { useCompanyBaseCurrency } from '@/lib/hooks/useCompanyBaseCurrency';
import type { JournalLineFormValues } from '@/lib/validation/accounting.schema';
import { VoucherAccountCombobox } from '@/components/accounting/vouchers/VoucherAccountCombobox';

export type JournalLineCurrency = {
  id: string;
  code: string;
  arabicName?: string;
  exchangeRate?: number | string | null;
};

type InvoiceRow = {
  id: string;
  invoiceNumber?: string | null;
  remainingAmount?: number | string | null;
};

type Props = {
  gridId?: string;
  lines: JournalLineFormValues[];
  onChange: (lines: JournalLineFormValues[]) => void;
  onAddLine: () => void;
  disabled?: boolean;
  currencies: JournalLineCurrency[];
  defaultCurrencyId?: string;
  accountLabelFor?: (accountId: string) => string | undefined;
};

function emptyLine(currencyId?: string): JournalLineFormValues {
  return {
    accountId: '',
    description: '',
    debit: 0,
    credit: 0,
    currencyId,
    exchangeRate: 1,
    costCenterId: '',
    isTiedToInvoice: false,
    invoiceId: null,
    invoiceNumber: null,
  };
}

function formatAmountInput(value: number) {
  if (!value) return '';
  return value.toLocaleString('en-US', {
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

export function JournalLinesTable({
  gridId = 'journal-entry-lines',
  lines,
  onChange,
  onAddLine,
  disabled,
  currencies,
  defaultCurrencyId,
  accountLabelFor,
}: Props) {
  const fieldOrder = JOURNAL_LINE_FIELD_ORDER;
  const { code: companyBase, label: companyBaseLabel } = useCompanyBaseCurrency();

  const updateLine = (index: number, patch: Partial<JournalLineFormValues>) => {
    const current = lines[index] ?? emptyLine(defaultCurrencyId);
    const next = lines.length ? [...lines] : [];
    if (!lines[index]) {
      while (next.length < index) next.push(emptyLine(defaultCurrencyId));
      next.push({ ...current, ...patch });
    } else {
      next[index] = { ...current, ...patch };
    }
    onChange(next);
  };

  const removeLine = (index: number) => {
    if (lines.length <= 1) {
      onChange([{ ...emptyLine(defaultCurrencyId) }]);
      return;
    }
    onChange(lines.filter((_, i) => i !== index));
  };

  const keyHandlers = (index: number, field: string) => ({
    ...lineGridDataAttrs(gridId, index, field),
    onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => {
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
    { id: 'account', label: 'الحساب / الطرف المقابل', className: 'min-w-[220px]' },
    { id: 'description', label: 'البيان', className: 'min-w-[140px]' },
    { id: 'debit', label: 'مدين', className: 'w-28 min-w-[6.5rem]', align: 'center' as const },
    { id: 'credit', label: 'دائن', className: 'w-28 min-w-[6.5rem]', align: 'center' as const },
    { id: 'debitBase', label: `مدين معادل (${companyBaseLabel})`, className: 'w-28 min-w-[6.5rem]', align: 'center' as const },
    { id: 'creditBase', label: `دائن معادل (${companyBaseLabel})`, className: 'w-28 min-w-[6.5rem]', align: 'center' as const },
    { id: 'tied', label: 'مؤيد بفاتورة', className: 'w-40 min-w-[9rem]' },
    { id: 'currency', label: 'العملة', className: 'w-24 min-w-[6rem]' },
    { id: 'rate', label: 'سعر الصرف', className: 'w-24 min-w-[6rem]', align: 'center' as const },
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
        const line = lines[index] ?? emptyLine(defaultCurrencyId);
        if (columnId === '#') {
          return (
            <span className="block text-center font-mono text-xs text-muted-foreground">{index + 1}</span>
          );
        }
        if (columnId === 'account') {
          return (
            <VoucherAccountCombobox
              value={line.accountId}
              partyId={line.partnerId}
              partyKind={line.partnerType}
              valueLabel={accountLabelFor?.(line.accountId)}
              disabled={disabled}
              onPick={(pick) =>
                updateLine(index, {
                  accountId: pick.accountId,
                  partnerId: pick.kind === 'ACCOUNT' ? undefined : pick.partyId,
                  partnerType: pick.kind === 'ACCOUNT' ? undefined : pick.kind,
                  ...(pick.kind === 'ACCOUNT'
                    ? { isTiedToInvoice: false, invoiceId: null, invoiceNumber: null }
                    : {}),
                })
              }
              inputProps={lineGridDataAttrs(gridId, index, 'account')}
              onInputKeyDown={(e) => keyHandlers(index, 'account').onKeyDown(e)}
            />
          );
        }
        if (columnId === 'tied') {
          return (
            <JournalInvoiceTieCell
              line={line}
              disabled={disabled}
              onChange={(patch) => updateLine(index, patch)}
            />
          );
        }
        if (columnId === 'debit') {
          return (
            <input
              type="text"
              inputMode="decimal"
              autoComplete="off"
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
              className={`${dataEntryGridInputClass} text-end font-mono font-medium`}
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
              autoComplete="off"
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
              className={`${dataEntryGridInputClass} text-end font-mono font-medium`}
              placeholder="0.00"
              {...keyHandlers(index, 'credit')}
            />
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
        if (columnId === 'rate') {
          const selected = currencies.find((c) => c.id === (line.currencyId || defaultCurrencyId));
          const headerCode = currencies.find((c) => c.id === defaultCurrencyId)?.code;
          const rateLocked =
            sameCurrencyCode(selected?.code, companyBase) ||
            sameCurrencyCode(selected?.code, headerCode);
          return (
            <input
              type="number"
              step="0.0001"
              disabled={disabled || rateLocked}
              value={rateLocked ? 1 : line.exchangeRate ?? 1}
              onChange={(e) => updateLine(index, { exchangeRate: Number(e.target.value) || 1 })}
              className={`${dataEntryGridInputClass} text-end font-mono`}
              {...keyHandlers(index, 'rate')}
            />
          );
        }
        if (columnId === 'description') {
          return (
            <input
              type="text"
              autoComplete="off"
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

function JournalInvoiceTieCell({
  line,
  disabled,
  onChange,
}: {
  line: JournalLineFormValues;
  disabled?: boolean;
  onChange: (patch: Partial<JournalLineFormValues>) => void;
}) {
  const [open, setOpen] = useState(false);
  const tied = Boolean(line.isTiedToInvoice);
  const invoiceKind = line.partnerType === 'CUSTOMER' ? 'SALE' : line.partnerType === 'SUPPLIER' ? 'PURCHASE' : null;
  const isSale = invoiceKind === 'SALE';
  const { data } = useApiQuery<InvoiceRow[]>(
    ['open-invoices', invoiceKind ?? 'none', line.partnerId ?? ''],
    '/invoices',
    {
      invoiceKind: invoiceKind ?? 'SALE',
      isPosted: true,
      openOnly: true,
      limit: 50,
      ...(isSale ? { customerId: line.partnerId } : { supplierId: line.partnerId }),
    },
    { enabled: tied && open && Boolean(line.partnerId) && Boolean(invoiceKind) }
  );
  const invoices = data?.data ?? [];

  return (
    <div className="space-y-1">
      <select
        className={dataEntryGridInputClass}
        disabled={disabled}
        value={tied ? 'yes' : 'no'}
        onChange={(e) => {
          const next = e.target.value === 'yes';
          onChange({
            isTiedToInvoice: next,
            invoiceId: next ? line.invoiceId : null,
            invoiceNumber: next ? line.invoiceNumber : null,
          });
          setOpen(next);
        }}
      >
        <option value="no">غير مؤيد</option>
        <option value="yes">مؤيد</option>
      </select>
      {tied ? (
        <div className="relative">
          <button
            type="button"
            disabled={disabled}
            onClick={() => setOpen((v) => !v)}
            className="inline-flex w-full items-center gap-1 rounded-md border border-[#D6EAF3] bg-white px-2 py-1 text-[11px] text-[#0E78AA]"
          >
            <FileText className="h-3 w-3" />
            {line.invoiceNumber || (line.invoiceId ? 'فاتورة مربوطة' : 'اختر الفاتورة')}
          </button>
          {open ? (
            <div className="absolute z-40 mt-1 max-h-48 w-56 overflow-auto rounded-lg border border-[#D6EAF3] bg-white p-1 shadow-lg">
              {!line.partnerId || !invoiceKind ? (
                <p className="px-2 py-1.5 text-[11px] text-slate-500">اختر عميلاً أو مورداً من الحساب أولاً</p>
              ) : invoices.length === 0 ? (
                <p className="px-2 py-1.5 text-[11px] text-slate-500">لا توجد فواتير مفتوحة</p>
              ) : (
                invoices.map((inv) => (
                  <button
                    key={inv.id}
                    type="button"
                    className="block w-full rounded px-2 py-1 text-right text-[11px] hover:bg-sky-50"
                    onClick={() => {
                      onChange({
                        invoiceId: inv.id,
                        invoiceNumber: inv.invoiceNumber || inv.id.slice(0, 8),
                        isTiedToInvoice: true,
                      });
                      setOpen(false);
                    }}
                  >
                    {inv.invoiceNumber || inv.id.slice(0, 8)} —{' '}
                    {Number(inv.remainingAmount ?? 0).toLocaleString('ar-EG')}
                  </button>
                ))
              )}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
