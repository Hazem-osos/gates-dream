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

export function nextLineField(fieldOrder: readonly string[], current: string): string | undefined {
  const idx = fieldOrder.indexOf(current);
  if (idx === -1 || idx >= fieldOrder.length - 1) return undefined;
  return fieldOrder[idx + 1];
}

export function focusNextLineField(
  gridId: string,
  lineIndex: number,
  fieldOrder: readonly string[],
  current: string,
  delayMs = 0
) {
  const next = nextLineField(fieldOrder, current);
  if (!next) return false;
  if (delayMs > 0) {
    window.setTimeout(() => {
      focusLineField(gridId, lineIndex, next);
    }, delayMs);
    return true;
  }
  return focusLineField(gridId, lineIndex, next);
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

export type LineArrowKey = 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown';

const SKIP_ARROW_INPUT_TYPES = new Set([
  'date',
  'time',
  'datetime-local',
  'month',
  'week',
  'checkbox',
  'radio',
  'file',
  'color',
  'range',
]);

/** Where an arrow leaves the current line cell. `null` stays put (no previous row). */
export function lineArrowDestination(
  fieldOrder: readonly string[],
  field: string,
  lineIndex: number,
  key: LineArrowKey,
  rtl: boolean
): { lineIndex: number; field: string } | null {
  const col = fieldOrder.indexOf(field);
  if (col < 0 || fieldOrder.length === 0) return null;
  if (key === 'ArrowDown') return { lineIndex: lineIndex + 1, field };
  if (key === 'ArrowUp') {
    if (lineIndex <= 0) return null;
    return { lineIndex: lineIndex - 1, field };
  }
  const forward = rtl ? key === 'ArrowLeft' : key === 'ArrowRight';
  const backward = rtl ? key === 'ArrowRight' : key === 'ArrowLeft';
  if (forward) {
    if (col < fieldOrder.length - 1) return { lineIndex, field: fieldOrder[col + 1] };
    return { lineIndex: lineIndex + 1, field: fieldOrder[0] };
  }
  if (backward) {
    if (col > 0) return { lineIndex, field: fieldOrder[col - 1] };
    if (lineIndex <= 0) return null;
    return { lineIndex: lineIndex - 1, field: fieldOrder[fieldOrder.length - 1] };
  }
  return null;
}

/**
 * Arrow leaves the cell only at the visual edge, or when the whole value is selected.
 * A collapsed caret in the middle of the text keeps moving inside the input.
 */
export function caretArrowLeaves(args: {
  kind: 'text' | 'textarea' | 'select' | 'skip';
  listOpen: boolean;
  start: number | null;
  end: number | null;
  length: number;
  rtl: boolean;
  key: LineArrowKey;
}): boolean {
  const { kind, listOpen, start, end, length, rtl, key } = args;
  if (kind === 'skip') return false;
  if (listOpen && (key === 'ArrowUp' || key === 'ArrowDown')) return false;
  if (kind === 'select') return key === 'ArrowLeft' || key === 'ArrowRight';
  if (start == null || end == null) return false;

  const collapsed = start === end;
  const fullySelected = length === 0 || (start === 0 && end === length);
  const vertical = key === 'ArrowUp' || key === 'ArrowDown';

  if (vertical) {
    if (kind === 'textarea' && !fullySelected) {
      if (!collapsed) return false;
      return key === 'ArrowUp' ? start === 0 : end === length;
    }
    return true;
  }

  if (length === 0) return true;
  if (fullySelected && !collapsed) return true;
  if (!collapsed) return false;

  const atVisualLeft = rtl ? start === length : start === 0;
  const atVisualRight = rtl ? start === 0 : start === length;
  return key === 'ArrowLeft' ? atVisualLeft : atVisualRight;
}

function arrowLeavesCell(el: HTMLElement, key: LineArrowKey): boolean {
  const listOpen = el.getAttribute('aria-expanded') === 'true';
  const rtl = getComputedStyle(el).direction === 'rtl';
  if (el instanceof HTMLSelectElement) {
    return caretArrowLeaves({
      kind: 'select',
      listOpen,
      start: null,
      end: null,
      length: 0,
      rtl,
      key,
    });
  }
  if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) return false;
  if (el instanceof HTMLInputElement && SKIP_ARROW_INPUT_TYPES.has(el.type)) {
    return caretArrowLeaves({
      kind: 'skip',
      listOpen,
      start: null,
      end: null,
      length: 0,
      rtl,
      key,
    });
  }
  let start: number | null = null;
  let end: number | null = null;
  try {
    start = el.selectionStart;
    end = el.selectionEnd;
  } catch {
    start = null;
    end = null;
  }
  return caretArrowLeaves({
    kind: el instanceof HTMLTextAreaElement ? 'textarea' : 'text',
    listOpen,
    start,
    end,
    length: el.value.length,
    rtl,
    key,
  });
}

function isLineArrowKey(key: string): key is LineArrowKey {
  return key === 'ArrowLeft' || key === 'ArrowRight' || key === 'ArrowUp' || key === 'ArrowDown';
}

function canFocusLineControl(el: Element | null): el is HTMLElement {
  if (!(el instanceof HTMLElement)) return false;
  if (
    el instanceof HTMLInputElement ||
    el instanceof HTMLTextAreaElement ||
    el instanceof HTMLSelectElement ||
    el instanceof HTMLButtonElement
  ) {
    if (el.disabled) return false;
  }
  if (el.getAttribute('aria-disabled') === 'true') return false;
  return true;
}

function focusArrowDestination(
  gridId: string,
  fieldOrder: readonly string[],
  field: string,
  lineIndex: number,
  key: LineArrowKey,
  rtl: boolean
): boolean {
  let cursor = lineArrowDestination(fieldOrder, field, lineIndex, key, rtl);
  for (let step = 0; step < 24 && cursor; step += 1) {
    const el = document.querySelector(lineFieldSelector(gridId, cursor.lineIndex, cursor.field));
    if (!el) return false;
    if (canFocusLineControl(el)) {
      focusLineField(gridId, cursor.lineIndex, cursor.field);
      return true;
    }
    cursor = lineArrowDestination(fieldOrder, cursor.field, cursor.lineIndex, key, rtl);
  }
  return false;
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

  if (
    isLineArrowKey(e.key) &&
    !e.shiftKey &&
    !e.altKey &&
    !e.ctrlKey &&
    !e.metaKey &&
    arrowLeavesCell(target, e.key)
  ) {
    const rtl = getComputedStyle(target).direction === 'rtl';
    const moved = focusArrowDestination(
      opts.gridId,
      opts.fieldOrder,
      field,
      opts.lineIndex,
      e.key,
      rtl
    );
    if (moved) e.preventDefault();
    return;
  }

  if (e.key !== 'Enter' && e.key !== 'Tab') return;
  if (e.key === 'Tab' && e.shiftKey) return;
  if (e.key === 'Enter' && target.getAttribute('role') === 'combobox') return;

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
