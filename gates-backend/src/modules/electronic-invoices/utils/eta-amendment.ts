import { roundTo4 } from '../../../shared/utils/decimal-round';

const CANCEL_WINDOW_HOURS = 72;

export type EtaAmendmentMethod = 'cancel-resubmit' | 'credit' | 'debit' | 'unsupported';

type SubmittedPayload = {
  netAmount?: unknown;
  totalAmount?: unknown;
  taxTotals?: Array<{ amount?: unknown }>;
  dateTimeIssued?: unknown;
  invoiceLines?: Array<{
    quantity?: unknown;
    itemCode?: unknown;
    netTotal?: unknown;
    total?: unknown;
  }>;
};

function asPayload(value: unknown): SubmittedPayload {
  if (!value || typeof value !== 'object') return {};
  return value as SubmittedPayload;
}

function amountOf(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? roundTo4(n) : null;
}

export function invoiceDiffersFromSubmittedPayload(input: {
  netAmount: number;
  taxAmount: number;
  date: Date;
  lines: Array<{ quantity: unknown; price?: unknown; itemId?: string }>;
  payload: unknown;
}): boolean {
  const payload = asPayload(input.payload);
  const submittedNet = amountOf(payload.totalAmount) ?? amountOf(payload.netAmount);
  if (submittedNet != null && submittedNet !== roundTo4(Number(input.netAmount))) return true;

  const submittedTax = (payload.taxTotals ?? []).reduce((sum, row) => sum + (amountOf(row.amount) ?? 0), 0);
  if ((payload.taxTotals?.length ?? 0) > 0 && submittedTax !== roundTo4(Number(input.taxAmount))) return true;

  const submittedDate = String(payload.dateTimeIssued ?? '').slice(0, 10);
  const currentDate = input.date.toISOString().slice(0, 10);
  if (submittedDate && submittedDate !== currentDate) return true;

  const submittedLines = payload.invoiceLines ?? [];
  if (submittedLines.length !== input.lines.length) return true;

  for (let index = 0; index < input.lines.length; index += 1) {
    const current = input.lines[index];
    const submitted = submittedLines[index];
    if (!submitted) return true;
    const currentQty = amountOf(current.quantity);
    const submittedQty = amountOf(submitted.quantity);
    if (currentQty != null && submittedQty != null && currentQty !== submittedQty) return true;
    const submittedLineNet = amountOf(submitted.netTotal);
    const currentLineNet =
      current.price == null ? null : amountOf(Number(current.quantity) * Number(current.price));
    if (currentLineNet != null && submittedLineNet != null && currentLineNet !== submittedLineNet) {
      return true;
    }
  }

  return false;
}

export function resolveEtaAmendmentMethod(input: {
  issuedAt: Date;
  submittedNet: number;
  currentNet: number;
  structuralChange: boolean;
}): { method: EtaAmendmentMethod; hoursSinceIssue: number } {
  const hoursSinceIssue = (Date.now() - input.issuedAt.getTime()) / 3_600_000;
  if (hoursSinceIssue <= CANCEL_WINDOW_HOURS) {
    return { method: 'cancel-resubmit', hoursSinceIssue };
  }
  const submittedNet = roundTo4(Number(input.submittedNet));
  const currentNet = roundTo4(Number(input.currentNet));
  if (currentNet < submittedNet) return { method: 'credit', hoursSinceIssue };
  if (currentNet > submittedNet) return { method: 'debit', hoursSinceIssue };
  if (input.structuralChange) return { method: 'unsupported', hoursSinceIssue };
  return { method: 'unsupported', hoursSinceIssue };
}

export function amendmentInternalId(base: string, method: Exclude<EtaAmendmentMethod, 'unsupported'>): string {
  const stamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 12);
  const suffix = method === 'cancel-resubmit' ? 'R' : method === 'credit' ? 'C' : 'D';
  return `${base}-${suffix}${stamp}`.slice(0, 50);
}
