import type { InternalNoteEntry } from './payment-split.types';

export const PAYMENT_INSTALLMENTS_NOTE_ID = 'invoice-payment-installments';

export type InstallmentFrequency = 'monthly' | 'biweekly' | 'quarterly' | 'yearly';

export const INSTALLMENT_FREQUENCY_LABELS: Record<InstallmentFrequency, string> = {
  monthly: 'شهري',
  biweekly: 'كل أسبوعين',
  quarterly: 'ربع سنوي',
  yearly: 'سنوي',
};

export type PaymentInstallmentRow = {
  id: string;
  number: number;
  dueDate: string;
  amount: number;
};

export type InstallmentPlanInput = {
  totalAmount: number;
  installmentCount: number;
  frequency: InstallmentFrequency;
  startDate: string;
  firstAmount?: number | null;
  lastAmount?: number | null;
};

export function roundInstallmentMoney(value: number): number {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function parseLocalDate(iso: string): Date | null {
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return null;
  const date = new Date(y, m - 1, d);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addMonthsClamped(date: Date, months: number): Date {
  const day = date.getDate();
  const next = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(day, lastDay));
  return next;
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

export function addInstallmentPeriod(date: Date, frequency: InstallmentFrequency, steps = 1): Date {
  switch (frequency) {
    case 'biweekly':
      return addDays(date, 14 * steps);
    case 'quarterly':
      return addMonthsClamped(date, 3 * steps);
    case 'yearly':
      return addMonthsClamped(date, 12 * steps);
    case 'monthly':
    default:
      return addMonthsClamped(date, 1 * steps);
  }
}

function newRowId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `inst-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * عدد الدفعات = الأقساط الدورية فقط.
 * الدفعة الأولى والأخيرة تُخصمان من الإجمالي ثم يُقسّم الباقي على العدد.
 * لا تُنقصان عدد الأقساط (ذلك كان يرفع قيمة الدورية بدل خفضها).
 */
export function periodicInstallmentPreview(input: {
  totalAmount: number;
  installmentCount: number;
  firstAmount?: number | null;
  lastAmount?: number | null;
}): number {
  const total = roundInstallmentMoney(Math.max(Number(input.totalAmount) || 0, 0));
  const count = Math.floor(Number(input.installmentCount) || 0);
  const first = roundInstallmentMoney(Math.max(Number(input.firstAmount) || 0, 0));
  const last = roundInstallmentMoney(Math.max(Number(input.lastAmount) || 0, 0));
  if (count <= 0) return 0;
  return Math.max(0, roundInstallmentMoney((total - first - last) / count));
}

export function generatePaymentInstallments(input: InstallmentPlanInput): PaymentInstallmentRow[] {
  const total = roundInstallmentMoney(Math.max(Number(input.totalAmount) || 0, 0));
  const count = Math.floor(Number(input.installmentCount) || 0);
  const first = roundInstallmentMoney(Math.max(Number(input.firstAmount) || 0, 0));
  const last = roundInstallmentMoney(Math.max(Number(input.lastAmount) || 0, 0));
  const useFirst = first > 0;
  const useLast = last > 0;
  const start = parseLocalDate(input.startDate);

  if (total <= 0) throw new Error('أدخل المبلغ الإجمالي');
  if (count < 1) throw new Error('عدد الأقساط الدورية يجب أن يكون 1 على الأقل');
  if (!start) throw new Error('حدد تاريخ بداية أول دفعة');

  if (first + last - total > 0.005) {
    throw new Error('المقدم والدفعة الأخيرة أكبر من الإجمالي');
  }

  const leftover = roundInstallmentMoney(total - first - last);
  if (leftover < -0.005) {
    throw new Error('المقدم والدفعة الأخيرة أكبر من الإجمالي');
  }
  if (leftover <= 0.005) {
    throw new Error('المتبقي بعد المقدم والدفعة الأخيرة صفر — قلّل قيمتهما حتى يتبقى مبلغ للأقساط الدورية');
  }

  const unit = roundInstallmentMoney(leftover / count);
  const amounts: number[] = [];
  if (useFirst) amounts.push(first);
  const periodicStart = amounts.length;
  for (let i = 0; i < count; i += 1) amounts.push(unit);
  if (useLast) amounts.push(last);

  const lastPeriodicIndex = periodicStart + count - 1;
  const others = amounts.reduce((sum, value, index) => (index === lastPeriodicIndex ? sum : sum + value), 0);
  amounts[lastPeriodicIndex] = roundInstallmentMoney(total - others);
  if (amounts[lastPeriodicIndex] < -0.005) {
    throw new Error('تعذر توزيع المتبقي على الأقساط الدورية');
  }

  return amounts.map((amount, index) => ({
    id: newRowId(),
    number: index + 1,
    dueDate: formatLocalDate(index === 0 ? start : addInstallmentPeriod(start, input.frequency, index)),
    amount,
  }));
}

export function renumberInstallments(rows: PaymentInstallmentRow[]): PaymentInstallmentRow[] {
  return rows.map((row, index) => ({ ...row, number: index + 1 }));
}

export function emptyInstallmentRow(number: number, dueDate: string): PaymentInstallmentRow {
  return { id: newRowId(), number, dueDate, amount: 0 };
}

export function sumPaymentInstallments(rows: PaymentInstallmentRow[]): number {
  return roundInstallmentMoney(rows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0));
}

export function installmentRowsFromApi(rows: unknown): PaymentInstallmentRow[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row, index) => {
      const item = row as {
        id?: string;
        installmentNumber?: number;
        number?: number;
        dueDate?: string;
        amount?: number | string;
      };
      const dueDate = String(item.dueDate ?? '').slice(0, 10);
      return {
        id: String(item.id ?? newRowId()),
        number: Number(item.installmentNumber ?? item.number) || index + 1,
        dueDate,
        amount: roundInstallmentMoney(Number(item.amount) || 0),
      };
    })
    .filter((row) => row.dueDate);
}

export function extractPaymentInstallments(notes: unknown): PaymentInstallmentRow[] {
  if (!Array.isArray(notes)) return [];
  const entry = notes.find(
    (n) => n && typeof n === 'object' && (n as { id?: string }).id === PAYMENT_INSTALLMENTS_NOTE_ID
  ) as { body?: string } | undefined;
  if (!entry?.body) return [];
  try {
    const parsed = JSON.parse(entry.body) as { rows?: PaymentInstallmentRow[] };
    if (!Array.isArray(parsed.rows)) return [];
    return parsed.rows
      .map((row, index) => ({
        id: String(row.id ?? newRowId()),
        number: Number(row.number) || index + 1,
        dueDate: String(row.dueDate ?? '').slice(0, 10),
        amount: roundInstallmentMoney(Number(row.amount) || 0),
      }))
      .filter((row) => row.dueDate);
  } catch {
    return [];
  }
}

export function stripPaymentInstallmentsNote(notes: InternalNoteEntry[]): InternalNoteEntry[] {
  return notes.filter((n) => n.id !== PAYMENT_INSTALLMENTS_NOTE_ID);
}

export function withPaymentInstallmentsNote(
  notes: InternalNoteEntry[],
  rows: PaymentInstallmentRow[]
): InternalNoteEntry[] {
  const cleaned = stripPaymentInstallmentsNote(notes);
  if (!rows.length) return cleaned;
  return [
    {
      id: PAYMENT_INSTALLMENTS_NOTE_ID,
      body: JSON.stringify({
        rows: rows.map((row) => ({
          id: row.id,
          number: row.number,
          dueDate: row.dueDate,
          amount: roundInstallmentMoney(row.amount),
        })),
      }),
      tags: ['توزيع الدفعات'],
      createdAt: new Date().toISOString(),
    },
    ...cleaned,
  ];
}
