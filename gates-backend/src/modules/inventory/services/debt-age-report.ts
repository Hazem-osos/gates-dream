import { documentTypeLabel, wholeDays } from './overdue-payments-report';

export type DebtAgeInvoice = {
  invoiceId?: string;
  invoiceDate: Date;
  invoiceNumber: string;
  profileName?: string | null;
  invoiceKind?: string | null;
  invoiceType?: string | null;
  partyName: string;
  invoiceTotal: number;
  paidAmount: number;
  remainingAmount: number;
  lastPaymentDate: Date | null;
};

export type DebtAgeRow = {
  invoiceId?: string;
  invoiceKind?: string;
  invoiceDate: string;
  documentType: string;
  invoiceNumber: string;
  partyName: string;
  invoiceTotal: number;
  lastPaymentDate: string | null;
  paidAmount: number;
  remainingAmount: number;
  ageFromInvoice: number;
  ageFromLastPayment: number;
};

export type DebtAgeSummary = {
  totalAmount: number;
  totalSettled: number;
  totalRemaining: number;
  totalInvoices: number;
};

export type DebtAgeRangeFilter = {
  from?: number;
  to?: number;
};

export type DebtAgeFilters = {
  ageFromInvoice?: DebtAgeRangeFilter;
  ageFromLastPayment?: DebtAgeRangeFilter;
};

function money(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function parseAgeBound(value: unknown): number | undefined {
  if (value == null || value === '') return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  return parsed;
}

export function inAgeRange(age: number, range?: DebtAgeRangeFilter): boolean {
  if (!range) return true;
  if (range.from != null && age < range.from) return false;
  if (range.to != null && age > range.to) return false;
  return true;
}

function isoDay(value: Date | null): string | null {
  if (!value || Number.isNaN(value.getTime())) return null;
  const month = String(value.getUTCMonth() + 1).padStart(2, '0');
  const day = String(value.getUTCDate()).padStart(2, '0');
  return `${value.getUTCFullYear()}-${month}-${day}`;
}

export function buildDebtAgeSheet(
  invoices: DebtAgeInvoice[],
  asOf: Date,
  filters: DebtAgeFilters = {}
): { rows: DebtAgeRow[]; summary: DebtAgeSummary } {
  const rows = invoices.map((invoice) => {
    const ageFromInvoice = Math.max(0, wholeDays(invoice.invoiceDate, asOf));
    const lastPayment =
      invoice.lastPaymentDate && invoice.lastPaymentDate.getTime() <= asOf.getTime()
        ? invoice.lastPaymentDate
        : null;
    const ageFromLastPayment = lastPayment ? Math.max(0, wholeDays(lastPayment, asOf)) : ageFromInvoice;
    return {
      invoiceId: invoice.invoiceId,
      invoiceKind: invoice.invoiceKind || invoice.invoiceType || undefined,
      invoiceDate: isoDay(invoice.invoiceDate) ?? '',
      documentType: documentTypeLabel(invoice),
      invoiceNumber: invoice.invoiceNumber,
      partyName: invoice.partyName,
      invoiceTotal: money(invoice.invoiceTotal),
      lastPaymentDate: isoDay(lastPayment),
      paidAmount: money(invoice.paidAmount),
      remainingAmount: money(invoice.remainingAmount),
      ageFromInvoice,
      ageFromLastPayment,
    };
  }).filter(
    (row) =>
      inAgeRange(row.ageFromInvoice, filters.ageFromInvoice) &&
      inAgeRange(row.ageFromLastPayment, filters.ageFromLastPayment)
  );

  return {
    rows,
    summary: {
      totalAmount: money(rows.reduce((sum, row) => sum + row.invoiceTotal, 0)),
      totalSettled: money(rows.reduce((sum, row) => sum + row.paidAmount, 0)),
      totalRemaining: money(rows.reduce((sum, row) => sum + row.remainingAmount, 0)),
      totalInvoices: rows.length,
    },
  };
}
