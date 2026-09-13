import { formatInvoiceMoney } from '@/lib/invoices/computeInvoiceFinancialSummary';

export function toMoney(value: string | number | null | undefined): number {
  if (value == null || value === '') return 0;
  const n = typeof value === 'number' ? value : Number(String(value).replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

export function formatEgp(value: string | number | null | undefined): string {
  return `${formatInvoiceMoney(toMoney(value))} ج.م`;
}

export function formatDateAr(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('ar-EG');
}

export function toDateInput(value: string | Date | null | undefined): string {
  if (!value) return '';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  return d.toISOString().slice(0, 10);
}

export function percentToRate(value: string | number): number {
  return toMoney(value) / 100;
}

export function rateToPercent(value: string | number): number {
  return Math.round(toMoney(value) * 10000) / 100;
}
