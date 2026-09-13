import type { KeyboardEvent as ReactKeyboardEvent } from 'react';

export function lineFieldSelector(gridId: string, lineIndex: number, field: string) {
  return `[data-line-grid="${gridId}"][data-line-index="${lineIndex}"][data-line-field="${field}"]`;
}

export function focusLineField(gridId: string, lineIndex: number, field: string) {
  const el = document.querySelector<HTMLElement>(lineFieldSelector(gridId, lineIndex, field));
  if (!el) return false;
  el.focus();
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    el.select();
  }
  return true;
}

type LineAdvanceOptions = {
  gridId: string;
  lineIndex: number;
  fieldOrder: readonly string[];
  onAppendLine: () => void;
  onRemoveLine: (index: number) => void;
  focusDelayMs?: number;
};

function scheduleFocus(gridId: string, lineIndex: number, field: string, delayMs: number) {
  window.setTimeout(() => {
    focusLineField(gridId, lineIndex, field);
  }, delayMs);
}

export function handleLineGridKeyDown(
  e: ReactKeyboardEvent<HTMLElement>,
  opts: LineAdvanceOptions
) {
  const target = e.currentTarget;
  const field = target.getAttribute('data-line-field');
  if (!field) return;

  const isMac = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform);
  const mod = isMac ? e.metaKey : e.ctrlKey;

  if (e.key === 'Backspace' && mod) {
    e.preventDefault();
    opts.onRemoveLine(opts.lineIndex);
    const prev = Math.max(0, opts.lineIndex - 1);
    const prevField = opts.fieldOrder[0];
    scheduleFocus(opts.gridId, prev, prevField, 0);
    return;
  }

  if (e.key === 'Delete' && e.shiftKey) {
    e.preventDefault();
    opts.onRemoveLine(opts.lineIndex);
    const prev = Math.max(0, opts.lineIndex - 1);
    scheduleFocus(opts.gridId, prev, opts.fieldOrder[0], 0);
    return;
  }

  if (e.key !== 'Enter' && e.key !== 'Tab') return;
  if (e.key === 'Tab' && e.shiftKey) return;

  const idx = opts.fieldOrder.indexOf(field);
  if (idx === -1) return;

  const isLast = idx === opts.fieldOrder.length - 1;
  if (!isLast) {
    if (e.key === 'Enter') {
      e.preventDefault();
      focusLineField(opts.gridId, opts.lineIndex, opts.fieldOrder[idx + 1]);
    }
    return;
  }

  e.preventDefault();
  opts.onAppendLine();
  const delay = opts.focusDelayMs ?? 50;
  scheduleFocus(opts.gridId, opts.lineIndex + 1, opts.fieldOrder[0], delay);
}

export const ASSEMBLY_LINE_FIELD_ORDER = [
  'itemCode',
  'itemName',
  'notes',
  'quantity',
  'unitCost',
] as const;

export const COMMERCIAL_LINE_FIELD_ORDER = [
  'itemCode',
  'itemName',
  'notes',
  'quantity',
  'unitPrice',
  'discount',
  'taxRate',
  'costCenter',
] as const;

export const INVOICE_LINE_FIELD_ORDER = [
  'item',
  'notes',
  'quantity',
  'unitPrice',
  'discount',
  'taxRate',
] as const;

export const JOURNAL_LINE_FIELD_ORDER = [
  'account',
  'description',
  'debit',
  'credit',
  'tied',
  'currency',
  'rate',
  'costCenter',
] as const;

export const OPENING_BALANCE_LINE_FIELD_ORDER = [
  'account',
  'description',
  'debit',
  'credit',
  'currency',
  'rate',
  'costCenter',
] as const;

export const OPENING_STOCK_LINE_FIELD_ORDER = [
  'itemCode',
  'itemName',
  'warehouseId',
  'quantity',
  'unitCost',
  'batchNumber',
  'expiryDate',
] as const;

export const BATCH_RECEIPT_LINE_FIELD_ORDER = [
  'paperNumber',
  'description',
  'amount',
  'dueDate',
  'bank',
  'branch',
] as const;

export function lineGridDataAttrs(gridId: string, lineIndex: number, field: string) {
  return {
    'data-line-grid': gridId,
    'data-line-index': String(lineIndex),
    'data-line-field': field,
  } as const;
}
