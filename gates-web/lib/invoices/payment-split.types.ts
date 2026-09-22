export type PaymentSplitLine =
  | { type: 'CASH'; safeId: string; amount: number }
  | {
      type: 'BANK';
      bankAccountId: string;
      referenceNumber?: string;
      amount: number;
    }
  | {
      type: 'CHEQUE';
      chequeNumber: string;
      bankName: string;
      dueDate: string;
      bankAccountId?: string;
      amount: number;
    }
  | { type: 'ON_ACCOUNT'; amount: number };

export type InternalNoteEntry = {
  id: string;
  body: string;
  tags?: string[];
  authorUserId?: string;
  authorName?: string;
  createdAt: string;
  updatedAt?: string;
};

export function sumPaymentSplits(lines: PaymentSplitLine[]): number {
  return lines.reduce((s, l) => s + (Number(l.amount) || 0), 0);
}

export function buildSplitWithOnAccount(
  lines: Exclude<PaymentSplitLine, { type: 'ON_ACCOUNT' }>[],
  grandTotal: number
): PaymentSplitLine[] {
  const allocated = sumPaymentSplits(lines);
  const remaining = Math.max(0, round4(grandTotal - allocated));
  return [...lines, { type: 'ON_ACCOUNT', amount: round4(remaining) }];
}

function round4(n: number) {
  return Math.round(n * 10000) / 10000;
}

export function splitsMatchTotal(lines: PaymentSplitLine[], grandTotal: number): boolean {
  return Math.abs(sumPaymentSplits(lines) - grandTotal) < 0.0001;
}

function money(n: number): string {
  return n.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Compact Arabic mix: نقدي + بنك + N شيك. */
export function summarizePaymentSplits(lines: PaymentSplitLine[] | undefined): string {
  const rows = Array.isArray(lines) ? lines : [];
  const cash = sumPaymentSplits(rows.filter((line) => line.type === 'CASH'));
  const bank = sumPaymentSplits(rows.filter((line) => line.type === 'BANK'));
  const cheques = rows.filter((line) => line.type === 'CHEQUE');
  const chequeSum = sumPaymentSplits(cheques);
  const onAccount = sumPaymentSplits(rows.filter((line) => line.type === 'ON_ACCOUNT'));
  const parts: string[] = [];
  if (cash > 0.009) parts.push(`نقدي ${money(cash)}`);
  if (bank > 0.009) parts.push(`بنك ${money(bank)}`);
  if (cheques.length) parts.push(`${cheques.length > 1 ? `${cheques.length} شيكات` : 'شيك'} ${money(chequeSum)}`);
  if (onAccount > 0.009) parts.push(`آجل ${money(onAccount)}`);
  return parts.join(' · ');
}

/** Keep cash/bank/cheque lines and refill the deferred remainder so the split always covers the invoice. */
export function withOnAccountRemainder(lines: PaymentSplitLine[], grandTotal: number): PaymentSplitLine[] {
  const allocated = lines.filter(
    (line): line is Exclude<PaymentSplitLine, { type: 'ON_ACCOUNT' }> => line.type !== 'ON_ACCOUNT'
  );
  return buildSplitWithOnAccount(allocated, grandTotal);
}

/** Legacy «آجل» invoices become split: existing tenders stay, remainder is on-account. */
export function legacyCreditToSplit(
  paymentMethod: string | undefined,
  existingSplits: PaymentSplitLine[] | undefined,
  grandTotal: number
): { method: 'cash' | 'split'; splits: PaymentSplitLine[] } {
  const pm = String(paymentMethod ?? '').toLowerCase();
  if (pm === 'cash') {
    return { method: 'cash', splits: Array.isArray(existingSplits) ? existingSplits : [] };
  }
  const splits = withOnAccountRemainder(Array.isArray(existingSplits) ? existingSplits : [], grandTotal);
  return { method: 'split', splits };
}

function isComplexPaymentSplit(lines: PaymentSplitLine[]): boolean {
  const tenders = lines.filter((line) => line.type !== 'ON_ACCOUNT');
  if (tenders.some((line) => line.type === 'BANK' || line.type === 'CHEQUE')) return true;
  return tenders.filter((line) => line.type === 'CASH').length > 1 || tenders.length > 1;
}

/** Sales invoice UI: cash / credit-with-advance / multi-tender. */
export function resolveInvoicePaymentUi(
  paymentMethod: string | undefined,
  existingSplits: PaymentSplitLine[] | undefined,
  grandTotal: number
): { method: 'cash' | 'credit' | 'split'; splits: PaymentSplitLine[] } {
  const raw = Array.isArray(existingSplits) ? existingSplits : [];
  const pm = String(paymentMethod ?? '').trim().toLowerCase();
  if (pm === 'cash' || pm === 'نقدي') {
    return { method: 'cash', splits: raw };
  }
  if (pm === 'credit' || pm === 'آجل' || pm === 'دفع قبل أجل') {
    return { method: 'credit', splits: withOnAccountRemainder(raw, grandTotal) };
  }
  const splits = withOnAccountRemainder(raw, grandTotal);
  if (pm === 'split' && isComplexPaymentSplit(splits)) {
    return { method: 'split', splits };
  }
  if (isComplexPaymentSplit(splits)) {
    return { method: 'split', splits };
  }
  return { method: 'credit', splits };
}

/** Credit invoice: optional cash now (0 is allowed) + remainder on account. */
export function creditAdvanceToSplits(
  paidAmount: number,
  safeId: string | undefined,
  grandTotal: number
): PaymentSplitLine[] {
  const paid = Math.max(0, Number(paidAmount) || 0);
  const safe = String(safeId ?? '').trim();
  if (paid > 0 && safe) {
    return withOnAccountRemainder([{ type: 'CASH', safeId: safe, amount: paid }], grandTotal);
  }
  return withOnAccountRemainder([], grandTotal);
}
