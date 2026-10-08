import { roundTo4 } from '../../../shared/utils/decimal-round';

export type FinishedReceiptAtIssueMeta = {
  quantity: number;
  unitCost: number;
  receivedAt: string;
};

export function primaryFinishedOutputQuantity(order: {
  finishedItemId: string;
  plannedQuantity: unknown;
  processMetadata?: unknown;
}): number {
  const meta = order.processMetadata as {
    outputLinesSnapshot?: Array<{ itemId?: string; quantity?: number | string }>;
  } | null;
  const snap = meta?.outputLinesSnapshot ?? [];
  if (snap.length > 0) {
    const primary =
      snap.find((line) => line.itemId === order.finishedItemId) ??
      snap.find((line) => String(line.itemId ?? '').trim());
    const q = Number(primary?.quantity);
    if (Number.isFinite(q) && q > 0) return roundTo4(q);
  }
  const planned = Number(order.plannedQuantity);
  return Number.isFinite(planned) && planned > 0 ? roundTo4(planned) : 0;
}

export function finishedReceiptAtIssueFromMetadata(
  meta: unknown
): FinishedReceiptAtIssueMeta | null {
  if (!meta || typeof meta !== 'object') return null;
  const row = (meta as { finishedReceiptAtIssue?: FinishedReceiptAtIssueMeta })
    .finishedReceiptAtIssue;
  if (!row) return null;
  const quantity = Number(row.quantity);
  const unitCost = Number(row.unitCost);
  if (!Number.isFinite(quantity) || quantity <= 0) return null;
  return {
    quantity: roundTo4(quantity),
    unitCost: Number.isFinite(unitCost) ? roundTo4(unitCost) : 0,
    receivedAt: String(row.receivedAt ?? ''),
  };
}

export function withFinishedReceiptAtIssueMetadata(
  meta: unknown,
  receipt: FinishedReceiptAtIssueMeta
): Record<string, unknown> {
  const base =
    meta && typeof meta === 'object' && !Array.isArray(meta)
      ? { ...(meta as Record<string, unknown>) }
      : {};
  return { ...base, finishedReceiptAtIssue: receipt };
}

export function withoutFinishedReceiptAtIssueMetadata(meta: unknown): Record<string, unknown> {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return {};
  const next = { ...(meta as Record<string, unknown>) };
  delete next.finishedReceiptAtIssue;
  return next;
}

/** Quantity already received into finished-goods warehouse at «بدء التنفيذ». */
export function finishedOutputBaselineAfterIssue(order: {
  processMetadata?: unknown;
  materialsIssueJournalEntryId?: string | null;
  actualQuantity?: unknown;
}): number {
  const receiptAtIssue = finishedReceiptAtIssueFromMetadata(order.processMetadata);
  if (receiptAtIssue) return receiptAtIssue.quantity;
  if (order.materialsIssueJournalEntryId) {
    const issued = Number(order.actualQuantity ?? 0);
    if (Number.isFinite(issued) && issued > 0) return roundTo4(issued);
  }
  return 0;
}

/** Client updates often rebuild processMetadata — keep issue-time receipt marker. */
export function mergeProcessMetadataPreservingIssueReceipt(
  existing: unknown,
  incoming: Record<string, unknown> | undefined
): Record<string, unknown> | undefined {
  if (!incoming) {
    if (!existing || typeof existing !== 'object' || Array.isArray(existing)) return undefined;
    return { ...(existing as Record<string, unknown>) };
  }
  const receipt = finishedReceiptAtIssueFromMetadata(existing);
  const merged: Record<string, unknown> = { ...incoming };
  if (receipt && !finishedReceiptAtIssueFromMetadata(incoming)) {
    return withFinishedReceiptAtIssueMetadata(merged, receipt);
  }
  return merged;
}
