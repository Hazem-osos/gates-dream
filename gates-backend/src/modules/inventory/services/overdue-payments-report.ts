/** One row per invoice installment (or the invoice itself when it has no schedule). */

export type SettlementHint = {
  channel: 'cash' | 'bank' | 'cheque';
  chequeStatus?: string | null;
};

export type OverdueInstallmentInput = {
  id?: string;
  dueDate: Date;
  amount: number;
  paidAmount: number;
  isPaid: boolean;
  status: string;
  paymentDate: Date | null;
  settlements?: SettlementHint[];
};

export type OverdueInvoiceInput = {
  invoiceId?: string;
  invoiceDate: Date;
  dueDate: Date | null;
  invoiceNumber: string;
  profileName?: string | null;
  invoiceKind?: string | null;
  invoiceType?: string | null;
  partyName: string;
  invoiceTotal: number;
  paidAmount: number;
  postedAt: Date | null;
  installments: OverdueInstallmentInput[];
  settlements?: SettlementHint[];
};

export type OverduePaymentRow = {
  invoiceId?: string;
  invoiceKind?: string;
  invoiceDate: string;
  documentType: string;
  invoiceNumber: string;
  partyName: string;
  invoiceTotal: number;
  dueDate: string;
  paymentAmount: number;
  paymentStatus: string;
  settlementDate: string | null;
  paidAmount: number;
  remainingAmount: number;
  paymentMethod: string;
  delayKind: string;
  debtAge: number;
  daysLate: number;
  penaltyRate: number;
  penaltyAmount: number;
};

export type OverduePaymentSummary = {
  totalPayments: number;
  totalSettled: number;
  totalRemaining: number;
  totalOverdue: number;
  totalInvoices: number;
};

const DAY_MS = 86_400_000;

function money(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function wholeDays(from: Date, to: Date): number {
  const start = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  const end = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  return Math.floor((end - start) / DAY_MS);
}

function isoDay(value: Date | null): string | null {
  if (!value || Number.isNaN(value.getTime())) return null;
  const month = String(value.getUTCMonth() + 1).padStart(2, '0');
  const day = String(value.getUTCDate()).padStart(2, '0');
  return `${value.getUTCFullYear()}-${month}-${day}`;
}

const CHEQUE_STATUS_AR: Record<string, string> = {
  UNDER_HAND: 'تحت اليد',
  SENT_TO_BANK: 'مرسل للبنك',
  COLLECTED: 'محصل',
  ENDORSED: 'مظهر',
  BOUNCED: 'مرتد',
  RETURNED_TO_DRAWER: 'مرتجع للساحب',
  CANCELLED: 'ملغى',
};

/** سند قبض/صرف → نقدي، إشعار خصم/إضافة → بنك، والشيك يظهر بحالته. */
export function paymentMethodLabel(hints: SettlementHint[]): string {
  const labels: string[] = [];
  for (const hint of hints) {
    const label =
      hint.channel === 'cash'
        ? 'نقدي'
        : hint.channel === 'bank'
          ? 'بنك'
          : CHEQUE_STATUS_AR[String(hint.chequeStatus || '').toUpperCase()] || 'شيك';
    if (!labels.includes(label)) labels.push(label);
  }
  return labels.join('، ');
}

export function documentTypeLabel(input: {
  profileName?: string | null;
  invoiceKind?: string | null;
  invoiceType?: string | null;
}): string {
  const profile = input.profileName?.trim();
  if (profile) return profile;
  if (input.invoiceKind === 'PURCHASE' || input.invoiceType === 'purchase') return 'فاتورة مشتريات';
  if (input.invoiceKind === 'PURCHASE_RETURN' || input.invoiceType === 'purchaseReturn') return 'مردود مشتريات';
  if (input.invoiceKind === 'SALE_RETURN' || input.invoiceType === 'salesReturn') return 'مردود مبيعات';
  return 'فاتورة مبيعات';
}

export function classifyPayment(input: {
  amount: number;
  paidAmount: number;
  isPaid: boolean;
  status: string;
  dueDate: Date;
  asOf: Date;
}): { paymentStatus: string; paid: number; remaining: number; daysLate: number } {
  const amount = money(Math.max(input.amount, 0));
  const paidRaw = money(Math.max(input.paidAmount, 0));
  const settled = input.isPaid || input.status === 'PAID' || paidRaw + 0.009 >= amount;
  const paid = settled ? amount : money(Math.min(paidRaw, amount));
  const remaining = settled ? 0 : money(Math.max(amount - paid, 0));
  const daysLate = Math.max(0, wholeDays(input.dueDate, input.asOf));
  let paymentStatus = 'لم تستحق';
  if (settled) paymentStatus = 'مسددة بالكامل';
  else if (paid > 0.009 || input.status === 'PARTIALLY_PAID') paymentStatus = 'مسددة جزئيا';
  else if (input.dueDate.getTime() < input.asOf.getTime()) paymentStatus = 'متأخرة';
  return { paymentStatus, paid, remaining, daysLate };
}

function scheduleOf(invoice: OverdueInvoiceInput): OverdueInstallmentInput[] {
  if (invoice.installments.length) return invoice.installments;
  const amount = money(Math.max(invoice.invoiceTotal, 0));
  const paid = money(Math.max(invoice.paidAmount, 0));
  const settled = paid + 0.009 >= amount && amount > 0;
  return [
    {
      dueDate: invoice.dueDate ?? invoice.invoiceDate,
      amount,
      paidAmount: paid,
      isPaid: settled,
      status: settled ? 'PAID' : paid > 0 ? 'PARTIALLY_PAID' : 'PENDING',
      paymentDate: settled ? invoice.postedAt : null,
    },
  ];
}

export function buildOverduePaymentSheet(
  invoices: OverdueInvoiceInput[],
  asOf: Date
): { rows: OverduePaymentRow[]; summary: OverduePaymentSummary } {
  const rows: OverduePaymentRow[] = [];
  for (const invoice of invoices) {
    const documentType = documentTypeLabel(invoice);
    const debtAge = Math.max(0, wholeDays(invoice.invoiceDate, asOf));
    const invoiceDate = isoDay(invoice.invoiceDate) ?? '';
    for (const installment of scheduleOf(invoice)) {
      const classified = classifyPayment({ ...installment, asOf });
      rows.push({
        invoiceId: invoice.invoiceId,
        invoiceKind: invoice.invoiceKind || invoice.invoiceType || undefined,
        invoiceDate,
        documentType,
        invoiceNumber: invoice.invoiceNumber,
        partyName: invoice.partyName,
        invoiceTotal: money(invoice.invoiceTotal),
        dueDate: isoDay(installment.dueDate) ?? invoiceDate,
        paymentAmount: money(Math.max(installment.amount, 0)),
        paymentStatus: classified.paymentStatus,
        settlementDate: isoDay(installment.paymentDate),
        paidAmount: classified.paid,
        remainingAmount: classified.remaining,
        paymentMethod: paymentMethodLabel(
          installment.settlements?.length ? installment.settlements : invoice.settlements ?? []
        ),
        delayKind: classified.daysLate > 0 ? 'متأخرة' : 'في الموعد',
        debtAge,
        daysLate: classified.daysLate,
        penaltyRate: 0,
        penaltyAmount: 0,
      });
    }
  }

  return { rows, summary: summarizeOverdueRows(rows) };
}

export function summarizeOverdueRows(rows: OverduePaymentRow[]): OverduePaymentSummary {
  return {
    totalPayments: money(rows.reduce((sum, row) => sum + row.paymentAmount, 0)),
    totalSettled: money(rows.reduce((sum, row) => sum + row.paidAmount, 0)),
    totalRemaining: money(rows.reduce((sum, row) => sum + row.remainingAmount, 0)),
    totalOverdue: money(
      rows.reduce((sum, row) => sum + (row.remainingAmount > 0 && row.daysLate > 0 ? row.remainingAmount : 0), 0)
    ),
    totalInvoices: new Set(rows.map((row) => row.invoiceNumber)).size,
  };
}

export type OverdueRowFilters = {
  debtOrder?: string;
  daysLateOp?: string;
  daysLateDays?: number | null;
  paymentChannel?: string;
  fromInvoice?: string;
  toInvoice?: string;
};

function invoiceSerial(value: string): number | null {
  const match = value.match(/(\d+)\s*$/);
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isSafeInteger(n) ? n : null;
}

function matchesDays(days: number, op: string, value: number): boolean {
  if (op === 'gt') return days > value;
  if (op === 'gte') return days >= value;
  if (op === 'eq') return days === value;
  if (op === 'lte') return days <= value;
  if (op === 'lt') return days < value;
  return true;
}

const CHEQUE_METHOD_LABELS = new Set(Object.values(CHEQUE_STATUS_AR).concat('شيك'));

function matchesChannel(method: string, channel: string): boolean {
  if (!channel || channel === 'all') return true;
  if (channel === 'cash') return method.split('، ').includes('نقدي');
  if (channel === 'bank') return method.split('، ').includes('بنك');
  if (channel === 'cheque') return method.split('، ').some((part) => CHEQUE_METHOD_LABELS.has(part));
  return true;
}

/** يفلتر صفوف الكشف بعد بنائها، والملخص يتحسب من الصفوف الظاهرة. */
export function filterOverduePaymentRows(
  rows: OverduePaymentRow[],
  filters: OverdueRowFilters
): { rows: OverduePaymentRow[]; summary: OverduePaymentSummary } {
  const debt = String(filters.debtOrder || '').trim();
  const op = String(filters.daysLateOp || '').trim();
  const days =
    filters.daysLateDays == null || !Number.isFinite(filters.daysLateDays) ? null : Math.trunc(filters.daysLateDays);
  const channel = String(filters.paymentChannel || '').trim();
  const from = invoiceSerial(String(filters.fromInvoice || ''));
  const to = invoiceSerial(String(filters.toInvoice || ''));
  const low = from != null && to != null ? Math.min(from, to) : from;
  const high = from != null && to != null ? Math.max(from, to) : to;

  const kept = rows.filter((row) => {
    if (debt === 'overdue' && row.paymentStatus !== 'متأخرة') return false;
    if (debt === 'notDue' && row.paymentStatus !== 'لم تستحق') return false;
    if (debt === 'paid' && row.paymentStatus !== 'مسددة بالكامل') return false;
    if (debt === 'partial' && row.paymentStatus !== 'مسددة جزئيا') return false;
    if (debt === 'unpaid' && !(row.remainingAmount > 0)) return false;
    if (days != null && op && !matchesDays(row.daysLate, op, days)) return false;
    if (!matchesChannel(row.paymentMethod, channel)) return false;
    if (low != null || high != null) {
      const serial = invoiceSerial(row.invoiceNumber);
      if (serial == null) return false;
      if (low != null && serial < low) return false;
      if (high != null && serial > high) return false;
    }
    return true;
  });
  return { rows: kept, summary: summarizeOverdueRows(kept) };
}
