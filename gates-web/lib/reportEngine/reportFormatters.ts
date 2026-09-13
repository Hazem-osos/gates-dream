/** Shared cell formatters for report tables. */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isEmptyCellValue(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string' && value.trim() === '') return true;
  return false;
}

export function formatReportEmpty(value: unknown): string {
  return isEmptyCellValue(value) ? '—' : String(value);
}

export function formatReportDate(value: unknown): string {
  if (isEmptyCellValue(value)) return '—';
  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('ar-EG', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatReportDateTime(value: unknown): string {
  if (isEmptyCellValue(value)) return '—';
  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('ar-EG', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatReportMoney(value: unknown, currencyCode = 'ج.م'): string {
  if (isEmptyCellValue(value)) return '—';
  const n = typeof value === 'number' ? value : Number(String(value).replace(/,/g, ''));
  if (!Number.isFinite(n)) return '—';
  return `${n.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currencyCode}`;
}

export function formatReportNumber(value: unknown): string {
  if (isEmptyCellValue(value)) return '—';
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('ar-EG');
}

export function isTechnicalUuid(value: unknown): boolean {
  return typeof value === 'string' && UUID_RE.test(value);
}

export const INVOICE_TYPE_BADGES: Record<string, { label: string; className: string }> = {
  sales: { label: 'فاتورة بيع', className: 'bg-emerald-100 text-emerald-800' },
  SALE: { label: 'فاتورة بيع', className: 'bg-emerald-100 text-emerald-800' },
  purchase: { label: 'فاتورة شراء', className: 'bg-blue-100 text-blue-800' },
  PURCHASE: { label: 'فاتورة شراء', className: 'bg-blue-100 text-blue-800' },
  return: { label: 'مرتجع', className: 'bg-amber-100 text-amber-900' },
  SALE_RETURN: { label: 'مرتجع مبيعات', className: 'bg-amber-100 text-amber-900' },
  PURCHASE_RETURN: { label: 'مرتجع مشتريات', className: 'bg-orange-100 text-orange-900' },
};

export const PAYMENT_STATUS_BADGES: Record<string, { label: string; className: string }> = {
  PAID: { label: 'مسددة', className: 'bg-green-100 text-green-800' },
  PARTIALLY_PAID: { label: 'مسددة جزئياً', className: 'bg-yellow-100 text-yellow-900' },
  UNPAID: { label: 'غير مسددة', className: 'bg-slate-100 text-slate-700' },
  POSTED: { label: 'مرحّلة', className: 'bg-sky-100 text-sky-800' },
  DRAFT: { label: 'مسودة', className: 'bg-slate-100 text-slate-600' },
  CANCELLED: { label: 'ملغاة', className: 'bg-red-100 text-red-800' },
};

export function resolveInvoiceDisplayStatus(row: Record<string, unknown>): string {
  if (row.isCancelled === true) return 'CANCELLED';
  if (row.isPosted === true) {
    const ps = row.paymentStatus;
    if (typeof ps === 'string' && ps) return ps;
    return 'POSTED';
  }
  return 'DRAFT';
}

export function flattenRelationName(value: unknown): string {
  if (isEmptyCellValue(value)) return '—';
  if (typeof value === 'object' && value !== null) {
    const o = value as Record<string, unknown>;
    if (typeof o.arabicName === 'string' && o.arabicName.trim()) return o.arabicName;
    if (typeof o.name === 'string' && o.name.trim()) return o.name;
    if (typeof o.code === 'string' && o.code.trim()) return o.code;
    return '—';
  }
  if (isTechnicalUuid(value)) return '—';
  return String(value);
}

export type ReportCellFormat = 'text' | 'date' | 'datetime' | 'money' | 'number' | 'relation' | 'badge';

export function formatReportCell(
  value: unknown,
  format: ReportCellFormat,
  options?: { currencyCode?: string; badgeMap?: Record<string, { label: string; className: string }> }
): { text: string; badge?: { label: string; className: string } } {
  if (format === 'date') return { text: formatReportDate(value) };
  if (format === 'datetime') return { text: formatReportDateTime(value) };
  if (format === 'money') {
    return { text: formatReportMoney(value, options?.currencyCode ?? 'ج.م') };
  }
  if (format === 'number') return { text: formatReportNumber(value) };
  if (format === 'relation') return { text: flattenRelationName(value) };
  if (format === 'badge') {
    const key = String(value ?? '');
    const badge = options?.badgeMap?.[key] ?? options?.badgeMap?.[key.toUpperCase()];
    if (badge) return { text: badge.label, badge };
    return { text: formatReportEmpty(value) };
  }
  if (isEmptyCellValue(value)) return { text: '—' };
  if (typeof value === 'object') return { text: flattenRelationName(value) };
  if (isTechnicalUuid(value)) return { text: '—' };
  return { text: String(value) };
}
