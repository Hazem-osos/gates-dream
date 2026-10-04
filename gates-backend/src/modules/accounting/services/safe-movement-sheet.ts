import { roundTo4 } from '../../../shared/utils/decimal-round';

export type SafeFund = {
  id: string;
  arabicName: string;
  code?: string | null;
  glAccountId?: string | null;
  parentAccountId?: string | null;
};

export type SafeLedgerLine = {
  accountId: string;
  date: Date;
  debit: number;
  credit: number;
  description?: string | null;
  voucherNumber?: string | null;
  journalEntryId: string;
  entryType?: string | null;
  sourceType?: string | null;
  sourceKind?: string | null;
  sourceId?: string | null;
  voucherFund?: 'bank' | 'cash' | null;
  counterpart?: string | null;
};

const EPS = 0.0001;

function signed(debit: number, credit: number): number {
  return roundTo4(debit - credit);
}

/** Leaf treasury account, plus its parent when that parent belongs to one safe only. */
export function treasuryAccountsBySafe(safes: SafeFund[]): Map<string, SafeFund> {
  const map = new Map<string, SafeFund>();
  const parentCounts = new Map<string, number>();
  for (const safe of safes) {
    if (!safe.parentAccountId) continue;
    parentCounts.set(safe.parentAccountId, (parentCounts.get(safe.parentAccountId) ?? 0) + 1);
  }
  for (const safe of safes) {
    if (safe.glAccountId) map.set(safe.glAccountId, safe);
  }
  for (const safe of safes) {
    const parentId = safe.parentAccountId;
    if (!parentId || parentCounts.get(parentId) !== 1 || map.has(parentId)) continue;
    map.set(parentId, safe);
  }
  return map;
}

function movementType(entryType: string | null | undefined, debit: number, credit: number): string {
  if (entryType === 'OPENING_BALANCE') return 'رصيد افتتاحي';
  return debit > credit ? 'قبض' : 'صرف';
}

export function buildSafeMovementRows(input: {
  safes: SafeFund[];
  lines: SafeLedgerLine[];
  fromDate?: Date | null;
  currencyCode?: string | null;
  openingLabel?: string;
  fundField?: 'safe' | 'bankAccount';
}) {
  const accountSafe = treasuryAccountsBySafe(input.safes);
  const priorBySafe = new Map<string, number>();
  const periodBySafe = new Map<string, SafeLedgerLine[]>();

  for (const line of input.lines) {
    const safe = accountSafe.get(line.accountId);
    if (!safe) continue;
    const net = signed(line.debit, line.credit);
    if (Math.abs(net) < EPS && line.debit < EPS && line.credit < EPS) continue;
    const before =
      input.fromDate != null && line.date.getTime() < input.fromDate.getTime();
    if (before) {
      priorBySafe.set(safe.id, roundTo4((priorBySafe.get(safe.id) ?? 0) + net));
      continue;
    }
    const list = periodBySafe.get(safe.id) ?? [];
    list.push(line);
    periodBySafe.set(safe.id, list);
  }

  const rows: Array<Record<string, unknown>> = [];
  const openingLabel = input.openingLabel || 'رصيد افتتاحي';
  const fundField = input.fundField || 'safe';
  let openingBalance = 0;
  let totalReceipts = 0;
  let totalPayments = 0;

  const orderedSafes = [...input.safes].sort((a, b) =>
    (a.code || a.arabicName).localeCompare(b.code || b.arabicName, 'ar')
  );

  for (const safe of orderedSafes) {
    const prior = priorBySafe.get(safe.id) ?? 0;
    const safeRef = { id: safe.id, arabicName: safe.arabicName, code: safe.code ?? null };
    if (Math.abs(prior) >= EPS) {
      openingBalance = roundTo4(openingBalance + prior);
      rows.push({
        type: openingLabel,
        rowKind: 'opening',
        side: prior >= 0 ? 'in' : 'out',
        date: input.fromDate ?? null,
        voucherNumber: '',
        journalEntryId: null,
        description: openingLabel,
        amount: prior,
        currencyCode: input.currencyCode ?? null,
        [fundField]: safeRef,
        account: null,
        priorBalance: prior,
      });
    }

    const lines = (periodBySafe.get(safe.id) ?? []).sort((a, b) => {
      const byDate = a.date.getTime() - b.date.getTime();
      if (byDate !== 0) return byDate;
      return (a.voucherNumber || '').localeCompare(b.voucherNumber || '', 'ar');
    });
    for (const line of lines) {
      const debit = roundTo4(line.debit);
      const credit = roundTo4(line.credit);
      const net = signed(debit, credit);
      if (Math.abs(net) < EPS) continue;
      const inbound = net > 0;
      const amount = roundTo4(Math.abs(net));
      if (inbound) totalReceipts = roundTo4(totalReceipts + amount);
      else totalPayments = roundTo4(totalPayments + amount);
      const description =
        (line.description || '').trim() ||
        (line.entryType === 'OPENING_BALANCE' ? 'رصيد افتتاحي' : '');
      rows.push({
        type: movementType(line.entryType, debit, credit),
        rowKind: 'movement',
        side: inbound ? 'in' : 'out',
        date: line.date,
        voucherNumber: line.voucherNumber || '',
        journalEntryId: line.journalEntryId,
        description,
        amount,
        currencyCode: input.currencyCode ?? null,
        [fundField]: safeRef,
        account: line.counterpart || null,
        priorBalance: prior,
        sourceType: line.sourceType ?? null,
        sourceKind: line.sourceKind ?? null,
        sourceId: line.sourceId ?? null,
        entryType: line.entryType ?? null,
        voucherFund: line.voucherFund ?? null,
      });
    }
  }

  return {
    rows,
    summary: {
      openingBalance,
      totalReceipts,
      totalPayments,
      netBalance: roundTo4(openingBalance + totalReceipts - totalPayments),
      closingBalance: roundTo4(openingBalance + totalReceipts - totalPayments),
      currencyCode: input.currencyCode ?? null,
    },
  };
}
