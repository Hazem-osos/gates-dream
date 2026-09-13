'use client';

import { useEffect, useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { CenteredOverlay } from '@/components/erp/CenteredOverlay';
import { Button } from '@/components/ui';
import { AccountSelect } from '@/app/components/form/AccountSelect';
import { UniversalDataGrid } from '@/components/ui/data-entry-grid';
import { dataEntryGridInputClass } from '@/components/ui/data-entry-grid/tokens';
import { handleLineGridKeyDown, lineGridDataAttrs } from '@/lib/keyboard/gridLineFocus';
import { toHijri } from '@/lib/dates/hijri';
import type { SecuritiesPaperKind } from './securities-paper-status';

export type MultiCollectionLine = {
  accountId: string;
  amount: number;
  description: string;
};

export type MultiCollectionPayload = {
  collectionDate: string;
  hijriDate?: string;
  destinationAccountId: string;
  commissionAmount: number;
  commissionAccountId?: string | null;
  lines: MultiCollectionLine[];
  notes?: string;
};

type Props = {
  open: boolean;
  kind: SecuritiesPaperKind;
  paperNumber?: string;
  remainingAmount: number;
  currencyCode?: string;
  disabled?: boolean;
  confirmPending?: boolean;
  onClose: () => void;
  onConfirm: (payload: MultiCollectionPayload) => void;
};

const GRID_ID = 'multi-collection-lines';
const FIELD_ORDER = ['account', 'amount', 'description'] as const;

function todayIso() {
  return new Date().toISOString().split('T')[0];
}

function emptyLine(): MultiCollectionLine {
  return { accountId: '', amount: 0, description: '' };
}

function money(value: number, currencyCode = 'EGP') {
  return `${value.toLocaleString('ar-EG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currencyCode === 'EGP' ? 'ج.م' : currencyCode}`;
}

function formatAmountInput(value: number) {
  if (!value) return '';
  return value.toLocaleString('en-US', {
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

export function MultiCollectionModal({
  open,
  kind,
  paperNumber,
  remainingAmount,
  currencyCode = 'EGP',
  disabled,
  confirmPending,
  onClose,
  onConfirm,
}: Props) {
  const [destinationAccountId, setDestinationAccountId] = useState('');
  const [commissionAmount, setCommissionAmount] = useState(0);
  const [commissionAccountId, setCommissionAccountId] = useState('');
  const [collectionDate, setCollectionDate] = useState(todayIso());
  const [lines, setLines] = useState<MultiCollectionLine[]>([emptyLine()]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setDestinationAccountId('');
    setCommissionAmount(0);
    setCommissionAccountId('');
    setCollectionDate(todayIso());
    setLines([emptyLine()]);
    setError('');
  }, [open]);

  const gross = useMemo(
    () => Math.round(lines.reduce((sum, line) => sum + (Number(line.amount) || 0), 0) * 100) / 100,
    [lines]
  );
  const commission = Math.max(0, Number(commissionAmount) || 0);
  const net = kind === 'receipt' ? Math.round((gross - commission) * 100) / 100 : Math.round((gross + commission) * 100) / 100;

  const updateLine = (index: number, patch: Partial<MultiCollectionLine>) => {
    setLines((prev) => prev.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  };

  const addLine = () => setLines((prev) => [...prev, emptyLine()]);

  const removeLine = (index: number) => {
    setLines((prev) => (prev.length <= 1 ? [emptyLine()] : prev.filter((_, i) => i !== index)));
  };

  const keyHandlers = (index: number, field: string) => ({
    ...lineGridDataAttrs(GRID_ID, index, field),
    onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => {
      if (e.key === 'Enter' && field === 'description' && !e.shiftKey) {
        e.preventDefault();
        addLine();
        window.setTimeout(() => {
          document
            .querySelector<HTMLElement>(
              `[data-line-grid="${GRID_ID}"][data-line-index="${index + 1}"][data-line-field="account"]`
            )
            ?.focus();
        }, 50);
        return;
      }
      handleLineGridKeyDown(e, {
        gridId: GRID_ID,
        lineIndex: index,
        fieldOrder: FIELD_ORDER,
        onAppendLine: addLine,
        onRemoveLine: removeLine,
      });
    },
  });

  const submit = () => {
    const validLines = lines.filter((line) => line.accountId && Number(line.amount) > 0);
    if (!destinationAccountId) {
      setError('اختر حساب الإيداع (الخزنة / البنك)');
      return;
    }
    if (validLines.length === 0) {
      setError('أضف سطر تحصيل واحداً على الأقل مع حساب ومبلغ');
      return;
    }
    if (commission > 0 && !commissionAccountId) {
      setError('اختر حساب العمولة');
      return;
    }
    if (gross - remainingAmount > 0.009) {
      setError('إجمالي السطور يتجاوز الرصيد المتبقي');
      return;
    }
    setError('');
    onConfirm({
      collectionDate,
      hijriDate: toHijri(collectionDate),
      destinationAccountId,
      commissionAmount: commission,
      commissionAccountId: commission > 0 ? commissionAccountId : null,
      lines: validLines,
    });
  };

  return (
    <CenteredOverlay open={open} onClose={onClose} width="xl" labelledBy="multi-collection-title">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-xl" dir="rtl">
        <div className="mb-4">
          <h2 id="multi-collection-title" className="text-base font-bold text-foreground">
            إجراء تحصيل متعدد
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {paperNumber ? `ورقة ${paperNumber} — ` : ''}
            الرصيد المتبقي: {money(remainingAmount, currencyCode)}
          </p>
        </div>

        <div className="mb-4 grid grid-cols-1 gap-3 rounded-xl border border-border/70 bg-muted/40 p-3 md:grid-cols-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-foreground">حساب الإيداع (الخزنة / البنك)</label>
            <AccountSelect
              value={destinationAccountId}
              onChange={setDestinationAccountId}
              leafOnly
              disabled={disabled}
              emptyLabel="اختر حساب الخزنة أو البنك..."
              placeholder="اختر حساب الخزنة أو البنك..."
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-foreground">العمولة</label>
            <input
              type="number"
              min={0}
              step="0.01"
              disabled={disabled}
              value={commission || ''}
              onChange={(e) => setCommissionAmount(Number(e.target.value) || 0)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-end font-mono text-xs"
              placeholder="0.00"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-foreground">حساب العمولة</label>
            <AccountSelect
              value={commissionAccountId}
              onChange={setCommissionAccountId}
              leafOnly
              disabled={disabled || !commission}
              emptyLabel="اختر حساب مصاريف وعمولات..."
              placeholder="اختر حساب مصاريف وعمولات..."
            />
          </div>
        </div>

        <UniversalDataGrid
          columns={[
            { id: '#', label: '#', className: 'w-10 text-center', align: 'center' },
            { id: 'account', label: 'الحساب', className: 'min-w-[220px]' },
            { id: 'description', label: 'البيان', className: 'min-w-[160px]' },
            { id: 'amount', label: 'المبلغ', className: 'w-32 min-w-[7rem]', align: 'center' },
            { id: 'action', label: 'إجراء', className: 'w-12 text-center', align: 'center' },
          ]}
          rowCount={Math.max(lines.length, 1)}
          disabled={disabled}
          onAddRow={disabled ? undefined : addLine}
          addLabel="إضافة سطر تحصيل جديد (Enter)"
          renderCell={(index, columnId) => {
            const line = lines[index] ?? emptyLine();
            if (columnId === '#') {
              return <span className="block text-center font-mono text-xs text-muted-foreground">{index + 1}</span>;
            }
            if (columnId === 'account') {
              return (
                <AccountSelect
                  value={line.accountId}
                  onChange={(id) => updateLine(index, { accountId: id })}
                  leafOnly
                  disabled={disabled}
                  emptyLabel="اختر الحساب"
                  className={dataEntryGridInputClass}
                  nativeSelectProps={{
                    ...lineGridDataAttrs(GRID_ID, index, 'account'),
                    onKeyDown: (e) => keyHandlers(index, 'account').onKeyDown(e),
                  }}
                />
              );
            }
            if (columnId === 'amount') {
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
                  className={`${dataEntryGridInputClass} text-end font-mono`}
                  placeholder="0.00"
                  {...keyHandlers(index, 'amount')}
                />
              );
            }
            if (columnId === 'description') {
              return (
                <input
                  type="text"
                  disabled={disabled}
                  value={line.description}
                  onChange={(e) => updateLine(index, { description: e.target.value })}
                  className={`${dataEntryGridInputClass} text-start`}
                  placeholder="البيان"
                  {...keyHandlers(index, 'description')}
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
        {error ? <p className="mt-3 text-sm font-medium text-rose-600">{error}</p> : null}

        <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
          <div className="text-xs leading-6 text-muted-foreground">
            <div>
              إجمالي مبالغ السطور:{' '}
              <span className="font-mono font-semibold text-foreground">{money(gross, currencyCode)}</span>
            </div>
            <div>
              العمولة:{' '}
              <span className="font-mono font-semibold text-foreground">{money(commission, currencyCode)}</span>
            </div>
            <div className="text-sm font-bold text-emerald-700">
              = صافي المحصل في الحساب: {money(kind === 'receipt' ? Math.max(net, 0) : net, currencyCode)}
            </div>
            <div className="mt-1 italic text-[11px]">القيد المحاسبي يُولَّد آلياً عند التأكيد</div>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              إلغاء
            </Button>
            <Button type="button" variant="primary" size="sm" disabled={disabled || confirmPending} onClick={submit}>
              {confirmPending ? 'جاري التأكيد…' : '✓ تأكيد التحصيل المتعدد'}
            </Button>
          </div>
        </div>
      </div>
    </CenteredOverlay>
  );
}
