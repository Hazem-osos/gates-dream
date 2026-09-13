import {
  installmentRowsFromApi,
  roundInstallmentMoney,
  type PaymentInstallmentRow,
} from '@/lib/invoices/payment-installments';

const MARKER = '[[SECURITIES_INSTALLMENTS:';

export function extractSecuritiesInstallments(description?: string | null): PaymentInstallmentRow[] {
  if (!description) return [];
  const start = description.indexOf(MARKER);
  if (start < 0) return [];
  const jsonStart = start + MARKER.length;
  const end = description.indexOf(']]', jsonStart);
  if (end < 0) return [];
  try {
    const parsed = JSON.parse(description.slice(jsonStart, end)) as { rows?: unknown };
    return installmentRowsFromApi(parsed.rows ?? parsed);
  } catch {
    return [];
  }
}

export function stripSecuritiesInstallments(description?: string | null): string {
  if (!description) return '';
  const start = description.indexOf(MARKER);
  if (start < 0) return description.trim();
  const end = description.indexOf(']]', start);
  if (end < 0) return description.replace(MARKER, '').trim();
  return `${description.slice(0, start)}${description.slice(end + 2)}`.trim();
}

export function withSecuritiesInstallments(
  description: string | null | undefined,
  rows: PaymentInstallmentRow[]
): string | undefined {
  const clean = stripSecuritiesInstallments(description);
  if (!rows.length) return clean || undefined;
  const payload = JSON.stringify({
    rows: rows.map((row) => ({
      id: row.id,
      number: row.number,
      dueDate: row.dueDate,
      amount: roundInstallmentMoney(row.amount),
    })),
  });
  return `${clean}${clean ? '\n' : ''}${MARKER}${payload}]]`;
}
