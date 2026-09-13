'use client';

import { Trash2 } from 'lucide-react';
import { CostCenterSelect } from '@/app/components/form/CostCenterSelect';
import { UniversalDataGrid } from '@/components/ui/data-entry-grid';
import { dataEntryGridInputClass } from '@/components/ui/data-entry-grid/tokens';
import {
  handleLineGridKeyDown,
  lineGridDataAttrs,
} from '@/lib/keyboard/gridLineFocus';
import { VoucherAccountCombobox } from './VoucherAccountCombobox';

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
const FIELD_ORDER = ['account', 'description', 'amount', 'costCenter'] as const;

type Props = {
  lines: VoucherGridLine[];
  onChange: (lines: VoucherGridLine[]) => void;
  onAddLine: () => void;
  disabled?: boolean;
  accountLabelFor?: (accountId: string) => string | undefined;
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
}: Props) {
  const updateLine = (index: number, patch: Partial<VoucherGridLine>) => {
    onChange(lines.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  };

  const removeLine = (index: number) => {
    if (lines.length <= 1) {
      onChange([{ accountId: '', description: '', amount: 0, costCenterId: '' }]);
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
        fieldOrder: FIELD_ORDER,
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
        { id: 'costCenter', label: 'مركز التكلفة', className: 'w-44 min-w-[10rem]' },
        { id: 'action', label: 'إجراء', className: 'w-12 text-center', align: 'center' },
      ]}
      rowCount={Math.max(lines.length, 1)}
      disabled={disabled}
      onAddRow={disabled ? undefined : onAddLine}
      renderCell={(index, columnId) => {
        const line = lines[index] ?? { accountId: '', amount: 0, description: '', costCenterId: '' };
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
                })
              }
              inputProps={lineGridDataAttrs(GRID_ID, index, 'account')}
              onInputKeyDown={(e) => keyHandlers(index, 'account').onKeyDown(e)}
            />
          );
        }
        if (columnId === 'costCenter') {
          return (
            <CostCenterSelect
              value={line.costCenterId || ''}
              onChange={(id) => updateLine(index, { costCenterId: id })}
              disabled={disabled}
              emptyLabel="اختياري"
              className={dataEntryGridInputClass}
              nativeSelectProps={keyHandlers(index, 'costCenter')}
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
