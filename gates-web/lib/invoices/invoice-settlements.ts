import {
  CHEQUE_STATUS_LABEL,
  isChequeStatus,
  type ChequeStatus,
} from '@/components/accounting/cheques/cheque-status';

export type InvoiceCashSettlement = {
  id: string;
  transactionKind?: string | null;
  voucherNumber?: string | null;
  date?: string | Date | null;
  amount?: number | string | null;
  currencyCode?: string | null;
  description?: string | null;
  isPosted?: boolean;
  isCancelled?: boolean;
  journalEntryId?: string | null;
  safe?: { arabicName?: string | null; code?: string | null } | null;
  bankAccount?: {
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
