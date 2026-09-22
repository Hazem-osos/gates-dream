import {
  CHEQUE_STATUS_LABEL,
  isChequeStatus,
  type ChequeStatus,
} from '@/components/accounting/cheques/cheque-status';
import { hrefForCashTransaction, hrefForCheque } from '@/lib/accounting/journal-source';

export type InvoiceCashSettlement = {
  id: string;
  transactionKind?: string | null;
  documentRole?: string | null;
  voucherNumber?: string | null;
  date?: string | Date | null;
  amount?: number | string | null;
  currencyCode?: string | null;
  description?: string | null;
  isPosted?: boolean;
  isCancelled?: boolean;
  journalEntryId?: string | null;
  safeId?: string | null;
  bankAccountId?: string | null;
  safe?: { id?: string | null; arabicName?: string | null; code?: string | null } | null;
  bankAccount?: {
    id?: string | null;
    accountNumber?: string | null;
    bank?: { arabicName?: string | null } | null;
  } | null;
};

export type InvoiceChequeSettlement = {
  id: string;
  chequeNumber?: string | null;
  bankName?: string | null;
  direction?: string | null;
  status?: string | null;
  dueDate?: string | Date | null;
  amount?: number | string | null;
  currencyCode?: string | null;
  description?: string | null;
};

export type InvoiceSettlementHistoryRow = {
  id: string;
  source: 'CASH' | 'BANK' | 'CHEQUE';
  number: string;
  href: string | null;
  methodLabel: string;
  channel: string;
  amount: number;
  date: string;
  statusLabel: string;
  cancelled: boolean;
};

export type InvoiceChequesPayload = {
  cheques?: InvoiceChequeSettlement[];
  chequesUnderCollection?: number;
};

function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleDateString('ar-EG');
}

function cashChannel(row: InvoiceCashSettlement): { source: 'CASH' | 'BANK'; channel: string; methodLabel: string } {
  const bankName = row.bankAccount?.bank?.arabicName?.trim();
  const account = row.bankAccount?.accountNumber?.trim();
  if (row.bankAccount || account || bankName) {
    return {
      source: 'BANK',
      methodLabel: 'بنك',
      channel: [bankName, account].filter(Boolean).join(' — ') || 'حساب بنكي',
    };
  }
  const safeName = row.safe?.arabicName?.trim() || row.safe?.code?.trim();
  return {
    source: 'CASH',
    methodLabel: 'خزينة',
    channel: safeName || 'خزينة',
  };
}

function chequeStatusLabel(status: string | null | undefined): string {
  const raw = String(status ?? '').trim();
  if (isChequeStatus(raw)) return CHEQUE_STATUS_LABEL[raw as ChequeStatus];
  return raw || '—';
}

export function unwrapInvoiceCheques(payload: InvoiceChequesPayload | InvoiceChequeSettlement[] | undefined): {
  cheques: InvoiceChequeSettlement[];
  underCollection: number;
} {
  if (Array.isArray(payload)) {
    return { cheques: payload, underCollection: 0 };
  }
  return {
    cheques: Array.isArray(payload?.cheques) ? payload.cheques : [],
    underCollection: Number(payload?.chequesUnderCollection) || 0,
  };
}

export function buildInvoiceSettlementHistory(
  cashRows: InvoiceCashSettlement[] | undefined,
  chequeRows: InvoiceChequeSettlement[] | undefined
): InvoiceSettlementHistoryRow[] {
  const rows: InvoiceSettlementHistoryRow[] = [];

  for (const row of cashRows ?? []) {
    const channel = cashChannel(row);
    rows.push({
      id: `cash-${row.id}`,
      source: channel.source,
      number: String(row.voucherNumber || '').trim() || row.id.slice(0, 8),
      href: hrefForCashTransaction({
        id: row.id,
        documentRole: row.documentRole,
        transactionKind: row.transactionKind,
        safeId: row.safeId ?? row.safe?.id,
        bankAccountId: row.bankAccountId ?? row.bankAccount?.id,
      }),
      methodLabel: channel.methodLabel,
      channel: row.description?.trim() || channel.channel,
      amount: Number(row.amount) || 0,
      date: formatDate(row.date),
      statusLabel: row.isCancelled ? 'ملغى' : row.isPosted ? 'مرحّل' : 'مسودة',
      cancelled: Boolean(row.isCancelled),
    });
  }

  for (const row of chequeRows ?? []) {
    rows.push({
      id: `chq-${row.id}`,
      source: 'CHEQUE',
      number: String(row.chequeNumber || '').trim() || row.id.slice(0, 8),
      href: hrefForCheque({ id: row.id, direction: row.direction }),
      methodLabel: 'شيك',
      channel: row.bankName?.trim() || row.description?.trim() || 'شيك',
      amount: Number(row.amount) || 0,
      date: formatDate(row.dueDate),
      statusLabel: chequeStatusLabel(row.status),
      cancelled: String(row.status ?? '').toUpperCase() === 'CANCELLED',
    });
  }

  return rows;
}

export function activeSettlementTotal(rows: InvoiceSettlementHistoryRow[]): number {
  return rows.filter((row) => !row.cancelled).reduce((sum, row) => sum + row.amount, 0);
}

export type InvoicePaymentStance = 'unpaid' | 'partial' | 'settled';

export const INVOICE_PAYMENT_STANCE_LABEL: Record<InvoicePaymentStance, string> = {
  unpaid: 'غير مسددة',
  partial: 'مسددة جزئياً',
  settled: 'مسددة بالكامل',
};

export function resolveInvoicePaymentStance(netAmount: number, paidAmount: number): InvoicePaymentStance {
  const net = Number(netAmount) || 0;
  const paid = Number(paidAmount) || 0;
  if (paid <= 0.0001) return 'unpaid';
  if (net <= 0.0001 || paid >= net - 0.0001) return 'settled';
  return 'partial';
}

export function applyPaidToInstallments(
  installments: Array<{ amount: number }>,
  paidAmount: number
): Array<{ applied: number; leftover: number; stance: InvoicePaymentStance }> {
  let remainingPaid = Math.max(0, Number(paidAmount) || 0);
  return installments.map((row) => {
    const due = Math.max(0, Number(row.amount) || 0);
    const applied = Math.min(due, remainingPaid);
    remainingPaid = Math.max(0, remainingPaid - applied);
    return {
      applied,
      leftover: Math.max(0, due - applied),
      stance: resolveInvoicePaymentStance(due, applied),
    };
  });
}

export type InvoiceInstallmentSource = {
  id?: string;
  installmentNumber?: number;
  number?: number;
  dueDate?: string | Date | null;
  amount?: number | string | null;
  paidAmount?: number | string | null;
  remainingAmount?: number | string | null;
  paymentStatusLabel?: string | null;
  isPaid?: boolean;
};

export type InvoiceInstallmentView = {
  key: string;
  number: number;
  dueDate: string;
  amount: number;
  paidAmount: number;
  remainingAmount: number;
  stance: InvoicePaymentStance;
  statusLabel: string;
};

export function buildInvoiceInstallmentViews(
  rows: InvoiceInstallmentSource[] | undefined,
  paidAmount: number
): InvoiceInstallmentView[] {
  const list = rows ?? [];
  const hasExplicitPaid = list.some((row) => row.paidAmount != null || row.isPaid);
  const fifo = hasExplicitPaid
    ? null
    : applyPaidToInstallments(
        list.map((row) => ({ amount: Number(row.amount) || 0 })),
        paidAmount
      );

  return list.map((row, index) => {
    const amount = Number(row.amount) || 0;
    const applied = hasExplicitPaid ? Number(row.paidAmount) || 0 : fifo?.[index]?.applied ?? 0;
    const leftover = hasExplicitPaid
      ? row.remainingAmount != null
        ? Number(row.remainingAmount)
        : Math.max(0, amount - applied)
      : fifo?.[index]?.leftover ?? amount;
    const stance = resolveInvoicePaymentStance(amount, applied);
    return {
      key: row.id ?? `inst-${index}`,
      number: row.installmentNumber ?? row.number ?? index + 1,
      dueDate: formatDate(row.dueDate),
      amount,
      paidAmount: applied,
      remainingAmount: leftover,
      stance,
      statusLabel: row.paymentStatusLabel?.trim() || INVOICE_PAYMENT_STANCE_LABEL[stance],
    };
  });
}
