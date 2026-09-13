'use client';

import { useState, type KeyboardEvent } from 'react';
import { Trash2 } from 'lucide-react';
import { UniversalDataGrid } from '@/components/ui/data-entry-grid';
import { dataEntryGridInputClass } from '@/components/ui/data-entry-grid/tokens';
import {
  BATCH_RECEIPT_LINE_FIELD_ORDER,
  handleLineGridKeyDown,
  lineGridDataAttrs,
} from '@/lib/keyboard/gridLineFocus';
import { toHijriDate } from '@/lib/hijri-date';
import { useApiQuery } from '@/lib/hooks/useApi';

export type BatchReceiptLine = {
  paperNumber: string;
  amount: number;
  dueDate: string;
  bankName: string;
  branchName: string;
  description: string;
};

type BankOption = {
  id: string;
  arabicName?: string | null;
  englishName?: string | null;
};

type Props = {
  lines: BatchReceiptLine[];
  onChange: (lines: BatchReceiptLine[]) => void;
  onAddRow: () => void;
  disabled?: boolean;
};

export function emptyBatchReceiptLine(): BatchReceiptLine {
  return {
    paperNumber: '',
    amount: 0,
    dueDate: '',
    bankName: '',
    branchName: '',
    description: '',
  };
}

export function createBlankBatchReceiptLines(count = 3): BatchReceiptLine[] {
  return Array.from({ length: count }, () => emptyBatchReceiptLine());
}

function formatAmountInput(value: number) {
  if (!value) return '';
  return value.toLocaleString('en-US', {
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

function parseAmount(raw: string): number {
  const n = Number(String(raw).replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

export function BatchReceiptLinesGrid({ lines, onChange, onAddRow, disabled }: Props) {
  const gridId = 'batch-receipt-lines';
  const [amountDrafts, setAmountDrafts] = useState<Record<number, string>>({});
  const { data: banksResponse } = useApiQuery<BankOption[]>(
    ['banks', 'batch-receipt'],
    '/accounting/banks',
    { isActive: true, limit: 200 },
    { staleTime: 60_000 }
  );
  const banks = banksResponse?.data ?? [];

  const updateLine = (index: number, patch: Partial<BatchReceiptLine>) => {
    const next = lines.map((line, i) => (i === index ? { ...line, ...patch } : line));
    onChange(next);
  };

  const removeLine = (index: number) => {
    if (lines.length <= 1) {
      onChange([emptyBatchReceiptLine()]);
      return;
    }
    onChange(lines.filter((_, i) => i !== index));
  };

  const appendAndFocusPaperNumber = () => {
    onAddRow();
    window.setTimeout(() => {
      const el = document.querySelector<HTMLElement>(
        `[data-line-grid="${gridId}"][data-line-index="${lines.length}"][data-line-field="paperNumber"]`
      );
      el?.focus();
      if (el instanceof HTMLInputElement) el.select();
    }, 50);
  };

  const onCellKeyDown = (e: KeyboardEvent<HTMLElement>, index: number, field: string) => {
    if (e.key === 'Enter' && (field === 'branch' || field === 'description')) {
      e.preventDefault();
      appendAndFocusPaperNumber();
      return;
    }
    handleLineGridKeyDown(e, {
      gridId,
      lineIndex: index,
      fieldOrder: BATCH_RECEIPT_LINE_FIELD_ORDER,
      onAppendLine: onAddRow,
      onRemoveLine: removeLine,
    });
  };

  return (
    <UniversalDataGrid
      columns={[
        { id: 'idx', label: '#', className: 'w-10 text-center', align: 'center' },
        { id: 'paperNumber', label: 'رقم الورقة / الشيك' },
        { id: 'description', label: 'البيان / ملاحظات' },
        { id: 'amount', label: 'المبلغ', align: 'left' },
        { id: 'dueDate', label: 'تاريخ الاستحقاق' },
        { id: 'bank', label: 'البنك المسحوب عليه' },
        { id: 'branch', label: 'الفرع' },
        { id: 'action', label: 'إجراء', className: 'w-14', align: 'center' },
      ]}
      rowCount={lines.length}
      onAddRow={disabled ? undefined : onAddRow}
      addLabel="إضافة ورقة جديدة (Enter)"
      disabled={disabled}
      emptyMessage="أدخل أوراق القبض الجديدة هنا — الجدول للإدخال وليس لعرض الأوراق السابقة"
      renderCell={(index, columnId) => {
        const line = lines[index] ?? emptyBatchReceiptLine();
        const attrs = (field: string) => lineGridDataAttrs(gridId, index, field);

        if (columnId === 'idx') {
          return (
            <span className="block w-10 text-center font-mono text-xs text-muted-foreground">
              {index + 1}
            </span>
          );
        }

        if (columnId === 'paperNumber') {
          return (
            <input
              type="text"
              disabled={disabled}
              className={`${dataEntryGridInputClass} font-mono`}
              placeholder="رقم الشيك"
              value={line.paperNumber}
              onChange={(e) => updateLine(index, { paperNumber: e.target.value })}
              onKeyDown={(e) => onCellKeyDown(e, index, 'paperNumber')}
              {...attrs('paperNumber')}
            />
          );
        }

        if (columnId === 'amount') {
          const draft = amountDrafts[index];
          return (
            <input
              inputMode="decimal"
              disabled={disabled}
              className={`${dataEntryGridInputClass} text-end font-mono font-medium`}
              placeholder="0.00"
              value={draft ?? formatAmountInput(line.amount)}
              onChange={(e) => {
                setAmountDrafts((prev) => ({ ...prev, [index]: e.target.value }));
                updateLine(index, { amount: parseAmount(e.target.value) });
              }}
              onBlur={() => {
                setAmountDrafts((prev) => {
                  const next = { ...prev };
                  delete next[index];
                  return next;
                });
              }}
              onKeyDown={(e) => onCellKeyDown(e, index, 'amount')}
              {...attrs('amount')}
            />
          );
        }

        if (columnId === 'dueDate') {
          return (
            <div className="space-y-0.5">
              <input
                type="date"
                disabled={disabled}
                className={dataEntryGridInputClass}
                value={line.dueDate}
                onChange={(e) => updateLine(index, { dueDate: e.target.value })}
                onKeyDown={(e) => onCellKeyDown(e, index, 'dueDate')}
                {...attrs('dueDate')}
              />
              {line.dueDate ? (
                <div className="px-2 text-[10px] font-medium text-emerald-600">
                  {toHijriDate(line.dueDate)}
                </div>
              ) : null}
            </div>
          );
        }

        if (columnId === 'bank') {
          return (
            <>
              <input
                type="text"
                disabled={disabled}
                list={`batch-receipt-banks-${index}`}
                className={dataEntryGridInputClass}
                placeholder="اسم البنك"
                value={line.bankName}
                onChange={(e) => updateLine(index, { bankName: e.target.value })}
                onKeyDown={(e) => onCellKeyDown(e, index, 'bank')}
                {...attrs('bank')}
              />
              <datalist id={`batch-receipt-banks-${index}`}>
                {banks.map((bank) => (
                  <option key={bank.id} value={bank.arabicName || bank.englishName || ''} />
                ))}
              </datalist>
            </>
          );
        }

        if (columnId === 'branch') {
          return (
            <input
              type="text"
              disabled={disabled}
              className={dataEntryGridInputClass}
              placeholder="الفرع"
              value={line.branchName}
              onChange={(e) => updateLine(index, { branchName: e.target.value })}
              onKeyDown={(e) => onCellKeyDown(e, index, 'branch')}
              {...attrs('branch')}
            />
          );
        }

        if (columnId === 'description') {
          return (
            <input
              type="text"
              disabled={disabled}
              className={dataEntryGridInputClass}
              placeholder="البيان"
              value={line.description}
              onChange={(e) => updateLine(index, { description: e.target.value })}
              onKeyDown={(e) => onCellKeyDown(e, index, 'description')}
              {...attrs('description')}
            />
          );
        }

        return (
          <button
            type="button"
            disabled={disabled}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            aria-label="حذف الورقة"
            onClick={() => removeLine(index)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        );
      }}
    />
  );
}
