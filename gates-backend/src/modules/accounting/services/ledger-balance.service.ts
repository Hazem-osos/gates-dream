import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { logger } from '../../../shared/logger';

export type PostedJournalLineDelta = {
  accountId: string;
  debitBase: Prisma.Decimal | number | string;
  creditBase: Prisma.Decimal | number | string;
  debit?: Prisma.Decimal | number | string;
  credit?: Prisma.Decimal | number | string;
  partnerId?: string | null;
  partnerType?: string | null;
};

export type ApplyPostedJournalBalancesInput = {
  companyId: string;
  date: Date;
  currencyCode: string;
  lines: PostedJournalLineDelta[];
  /** Rebuild partner rows without re-adding account_period_balances. */
  skipAccountPeriod?: boolean;
  /** Card-only replay. Period and partner summaries were already applied. */
  skipPartnerBalances?: boolean;
  /**
   * Rebuild replays the full historical sum. Card columns already hold a
   * running total, so they must not be incremented again during a rebuild.
   */
  skipCardColumns?: boolean;
  /**
   * Unpost / reverse: apply -1 × the original line amounts so summaries
   * shrink instead of booking swapped debit/credit (which inflates totals).
   */
  invert?: boolean;
};

export type LinkedCardKind = 'CUSTOMER' | 'SUPPLIER' | 'SAFE' | 'BANK';

export type LinkedCardAccount = {
  kind: LinkedCardKind;
  entityId: string;
  accountId: string;
};

/**
 * Customer, safe and bank cards are debit-nature: a debit on the linked
 * account increases the stored column. Supplier cards are credit-nature:
 * a credit increases what we owe.
 */
export function linkedCardColumnDelta(
  kind: LinkedCardKind,
  debitBase: Prisma.Decimal | number | string,
  creditBase: Prisma.Decimal | number | string
): Prisma.Decimal {
  const netDebit = new Prisma.Decimal(toAmountString(debitBase)).sub(
    new Prisma.Decimal(toAmountString(creditBase))
  );
  return kind === 'SUPPLIER' ? netDebit.negated() : netDebit;
}

/**
 * One posted line moves a card once. An account shared by two cards of the
 * same kind is skipped so the amount is not copied onto every card.
 */
export function allocateLinkedCardDeltas(
  accounts: Array<{ accountId: string; debitBase: Prisma.Decimal; creditBase: Prisma.Decimal }>,
  links: LinkedCardAccount[]
): Map<string, { kind: LinkedCardKind; entityId: string; delta: Prisma.Decimal }> {
  const owners = new Map<string, Map<LinkedCardKind, Set<string>>>();
  for (const link of links) {
    if (!link.accountId || !link.entityId) continue;
    const byKind = owners.get(link.accountId) ?? new Map<LinkedCardKind, Set<string>>();
    const ids = byKind.get(link.kind) ?? new Set<string>();
    ids.add(link.entityId);
    byKind.set(link.kind, ids);
    owners.set(link.accountId, byKind);
  }

  const deltas = new Map<string, { kind: LinkedCardKind; entityId: string; delta: Prisma.Decimal }>();
  const seenEntityAccounts = new Set<string>();
  for (const account of accounts) {
    const byKind = owners.get(account.accountId);
    if (!byKind) continue;
    for (const [kind, ids] of byKind) {
      if (ids.size !== 1) continue;
      const entityId = [...ids][0]!;
      const onceKey = `${kind}\0${entityId}\0${account.accountId}`;
      if (seenEntityAccounts.has(onceKey)) continue;
      seenEntityAccounts.add(onceKey);
      const delta = linkedCardColumnDelta(kind, account.debitBase, account.creditBase);
      if (delta.isZero()) continue;
      const bucketKey = `${kind}\0${entityId}`;
      const prev = deltas.get(bucketKey);
      if (prev) prev.delta = prev.delta.add(delta);
      else deltas.set(bucketKey, { kind, entityId, delta });
    }
  }
  return deltas;
}

function toAmountString(value: Prisma.Decimal | number | string | null | undefined): string {
  if (value == null || value === '') return '0.0000';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value.toFixed(4) : '0.0000';
  if (typeof value.toFixed === 'function') return value.toFixed(4);
  return '0.0000';
}

function signedAmount(value: Prisma.Decimal, invert: boolean): Prisma.Decimal {
  return invert ? value.negated() : value;
}

export function calendarPeriodFromDate(date: Date): { fiscalYear: number; periodMonth: number } {
  return {
    fiscalYear: date.getUTCFullYear(),
    periodMonth: date.getUTCMonth() + 1,
  };
}

type PeriodAgg = { accountId: string; debit: Prisma.Decimal; credit: Prisma.Decimal };

/**
 * Stable ASC compare so concurrent multi-line posts lock InnoDB rows in one
 * order. Numeric ids use subtraction (legacy integer PKs). UUID account ids
 * are not finite numbers — those fall through to localeCompare so
 * `Number(uuid) - Number(uuid)` cannot collapse the sort to NaN.
 */
export function compareLedgerKey(a: string | number, b: string | number): number {
  const left = Number(a);
  const right = Number(b);
  if (Number.isFinite(left) && Number.isFinite(right)) return left - right;
  return String(a).localeCompare(String(b));
}

export function sortAccountIds<T extends string | number>(ids: T[]): T[] {
  return [...ids].sort(compareLedgerKey);
}

function aggregateAccountDeltas(lines: PostedJournalLineDelta[]): PeriodAgg[] {
  const byAccount = new Map<string, PeriodAgg>();
  for (const line of lines) {
    const debit = new Prisma.Decimal(toAmountString(line.debitBase));
    const credit = new Prisma.Decimal(toAmountString(line.creditBase));
    const prev = byAccount.get(line.accountId);
    if (prev) {
      prev.debit = prev.debit.add(debit);
      prev.credit = prev.credit.add(credit);
    } else {
      byAccount.set(line.accountId, { accountId: line.accountId, debit, credit });
    }
  }
  return [...byAccount.values()];
}

async function upsertAccountPeriodBalance(
  tx: Prisma.TransactionClient,
  companyId: string,
  period: { fiscalYear: number; periodMonth: number },
  row: PeriodAgg
): Promise<void> {
  const net = row.debit.sub(row.credit);
  const id = randomUUID();
  await tx.$executeRaw`
    INSERT INTO account_period_balances
      (id, companyId, accountId, fiscalYear, periodMonth, debitTotal, creditTotal, netBalance, updatedAt)
    VALUES
      (${id}, ${companyId}, ${row.accountId}, ${period.fiscalYear}, ${period.periodMonth},
       ${row.debit}, ${row.credit}, ${net}, NOW(3))
    ON DUPLICATE KEY UPDATE
      debitTotal = debitTotal + VALUES(debitTotal),
      creditTotal = creditTotal + VALUES(creditTotal),
      netBalance = netBalance + VALUES(netBalance),
      updatedAt = NOW(3)
  `;
}

type PartnerAgg = {
  partnerId: string;
  partnerType: string;
  debitOriginal: Prisma.Decimal;
  creditOriginal: Prisma.Decimal;
  debitBase: Prisma.Decimal;
  creditBase: Prisma.Decimal;
};

function partnerBucketKey(partnerId: string, currencyCode: string): string {
  return `${partnerId}\0${currencyCode}`;
}

function aggregatePartnerDeltas(
  lines: PostedJournalLineDelta[],
  currencyCode: string
): PartnerAgg[] {
  const byPartner = new Map<string, PartnerAgg>();
  for (const line of lines) {
    if (!line.partnerId) continue;
    const key = partnerBucketKey(line.partnerId, currencyCode);
    const debitOriginal = new Prisma.Decimal(toAmountString(line.debit ?? 0));
    const creditOriginal = new Prisma.Decimal(toAmountString(line.credit ?? 0));
    const debitBase = new Prisma.Decimal(toAmountString(line.debitBase));
    const creditBase = new Prisma.Decimal(toAmountString(line.creditBase));
    const prev = byPartner.get(key);
    if (prev) {
      prev.debitOriginal = prev.debitOriginal.add(debitOriginal);
      prev.creditOriginal = prev.creditOriginal.add(creditOriginal);
      prev.debitBase = prev.debitBase.add(debitBase);
      prev.creditBase = prev.creditBase.add(creditBase);
    } else {
      byPartner.set(key, {
        partnerId: line.partnerId,
        partnerType: line.partnerType || 'CUSTOMER',
        debitOriginal,
        creditOriginal,
        debitBase,
        creditBase,
      });
    }
  }
  return [...byPartner.values()].sort((left, right) => {
    const byPartnerId = compareLedgerKey(left.partnerId, right.partnerId);
    if (byPartnerId !== 0) return byPartnerId;
    return compareLedgerKey(left.partnerType, right.partnerType);
  });
}

async function upsertPartnerRunningBalance(
  tx: Prisma.TransactionClient,
  input: {
    companyId: string;
    partnerId: string;
    partnerType: string;
    currencyCode: string;
    debitOriginal: Prisma.Decimal;
    creditOriginal: Prisma.Decimal;
    debitBase: Prisma.Decimal;
    creditBase: Prisma.Decimal;
    lastEntryDate: Date;
  }
): Promise<void> {
  const netOriginal = input.debitOriginal.sub(input.creditOriginal);
  const netBase = input.debitBase.sub(input.creditBase);
  const id = randomUUID();
  await tx.$executeRaw`
    INSERT INTO partner_running_balances
      (id, companyId, partnerId, partnerType, currencyCode,
       debitOriginal, creditOriginal, netOriginal,
       debitBase, creditBase, netBase,
       lastEntryDate, updatedAt)
    VALUES
      (${id}, ${input.companyId}, ${input.partnerId}, ${input.partnerType}, ${input.currencyCode},
       ${input.debitOriginal}, ${input.creditOriginal}, ${netOriginal},
       ${input.debitBase}, ${input.creditBase}, ${netBase},
       ${input.lastEntryDate}, NOW(3))
    ON DUPLICATE KEY UPDATE
      partnerType = VALUES(partnerType),
      debitOriginal = debitOriginal + VALUES(debitOriginal),
      creditOriginal = creditOriginal + VALUES(creditOriginal),
      netOriginal = netOriginal + VALUES(netOriginal),
      debitBase = debitBase + VALUES(debitBase),
      creditBase = creditBase + VALUES(creditBase),
      netBase = netBase + VALUES(netBase),
      lastEntryDate = IF(
        VALUES(lastEntryDate) IS NULL,
        lastEntryDate,
        GREATEST(COALESCE(lastEntryDate, VALUES(lastEntryDate)), VALUES(lastEntryDate))
      ),
      updatedAt = NOW(3)
  `;
}

const CARD_LOCK_ORDER: LinkedCardKind[] = ['SAFE', 'BANK', 'CUSTOMER', 'SUPPLIER'];

/**
 * Saved card columns follow the linked GL account inside the posting
 * transaction. Safes and banks are locked before customers and suppliers.
 */
async function applyLinkedCardColumns(
  tx: Prisma.TransactionClient,
  companyId: string,
  accountRows: PeriodAgg[]
): Promise<void> {
  const accountIds = accountRows.map((row) => row.accountId).filter(Boolean);
  if (accountIds.length === 0) return;

  const [customers, suppliers, safes, banks] = await Promise.all([
    tx.customer.findMany({
      where: {
        companyId,
        OR: [{ accountId: { in: accountIds } }, { mainAccountId: { in: accountIds } }],
      },
      select: { id: true, accountId: true, mainAccountId: true },
    }),
    tx.supplier.findMany({
      where: {
        companyId,
        OR: [{ accountId: { in: accountIds } }, { mainAccountId: { in: accountIds } }],
      },
      select: { id: true, accountId: true, mainAccountId: true },
    }),
    tx.safe.findMany({
      where: { companyId, glAccountId: { in: accountIds } },
      select: { id: true, glAccountId: true },
    }),
    tx.bankAccount.findMany({
      where: { companyId, glAccountId: { in: accountIds } },
      select: { id: true, glAccountId: true },
    }),
  ]);

  const links: LinkedCardAccount[] = [];
  for (const customer of customers) {
    for (const accountId of new Set([customer.accountId, customer.mainAccountId].filter(Boolean))) {
      links.push({ kind: 'CUSTOMER', entityId: customer.id, accountId: accountId! });
    }
  }
  for (const supplier of suppliers) {
    for (const accountId of new Set([supplier.accountId, supplier.mainAccountId].filter(Boolean))) {
      links.push({ kind: 'SUPPLIER', entityId: supplier.id, accountId: accountId! });
    }
  }
  for (const safe of safes) {
    if (safe.glAccountId) links.push({ kind: 'SAFE', entityId: safe.id, accountId: safe.glAccountId });
  }
  for (const bank of banks) {
    if (bank.glAccountId) links.push({ kind: 'BANK', entityId: bank.id, accountId: bank.glAccountId });
  }
  if (links.length === 0) return;

  const allocated = allocateLinkedCardDeltas(
    accountRows.map((row) => ({
      accountId: row.accountId,
      debitBase: row.debit,
      creditBase: row.credit,
    })),
    links
  );
  const grouped = new Map<LinkedCardKind, Array<{ entityId: string; delta: Prisma.Decimal }>>();
  for (const row of allocated.values()) {
    const list = grouped.get(row.kind) ?? [];
    list.push({ entityId: row.entityId, delta: row.delta });
    grouped.set(row.kind, list);
  }

  for (const kind of CARD_LOCK_ORDER) {
    const rows = grouped.get(kind);
    if (!rows?.length) continue;
    rows.sort((left, right) => compareLedgerKey(left.entityId, right.entityId));
    for (const row of rows) {
      const data = { balance: { increment: row.delta } };
      const where = { id: row.entityId, companyId };
      if (kind === 'SAFE') await tx.safe.updateMany({ where, data });
      else if (kind === 'BANK') await tx.bankAccount.updateMany({ where, data });
      else if (kind === 'CUSTOMER') await tx.customer.updateMany({ where, data });
      else await tx.supplier.updateMany({ where, data });
    }
  }
}

/**
 * Apply posted (or reversing) journal lines to summary tables.
 * Must run inside the same Prisma transaction as the journal write so a
 * failed UPSERT rolls back the entire post.
 */
export async function applyPostedJournalBalancesInTx(
  tx: Prisma.TransactionClient,
  input: ApplyPostedJournalBalancesInput
): Promise<void> {
  if (input.lines.length === 0) return;

  const invert = Boolean(input.invert);
  const period = calendarPeriodFromDate(input.date);
  const accountRows = aggregateAccountDeltas(input.lines).map((row) => ({
    ...row,
    debit: signedAmount(row.debit, invert),
    credit: signedAmount(row.credit, invert),
  }));
  const byAccountId = new Map(accountRows.map((row) => [row.accountId, row]));
  const accountIds = sortAccountIds([...byAccountId.keys()]);

  if (!input.skipAccountPeriod) {
    for (const accountId of accountIds) {
      await upsertAccountPeriodBalance(tx, input.companyId, period, byAccountId.get(accountId)!);
    }
  }

  const currencyCode = input.currencyCode || 'EGP';
  if (!input.skipPartnerBalances) {
    const partnerRows = aggregatePartnerDeltas(input.lines, currencyCode);
    for (const partner of partnerRows) {
      await upsertPartnerRunningBalance(tx, {
        companyId: input.companyId,
        partnerId: partner.partnerId,
        partnerType: partner.partnerType,
        currencyCode,
        debitOriginal: signedAmount(partner.debitOriginal, invert),
        creditOriginal: signedAmount(partner.creditOriginal, invert),
        debitBase: signedAmount(partner.debitBase, invert),
        creditBase: signedAmount(partner.creditBase, invert),
        lastEntryDate: input.date,
      });
    }
  }

  if (!input.skipCardColumns) {
    await applyLinkedCardColumns(tx, input.companyId, accountRows);
  }

  logger.debug(
    { companyId: input.companyId, accounts: accountRows.length, year: period.fiscalYear, month: period.periodMonth },
    'Applied posted journal balance deltas'
  );
}

type PeriodRebuildRow = {
  accountId: string;
  fiscalYear: number;
  periodMonth: number;
  debitTotal: Prisma.Decimal | number | string;
  creditTotal: Prisma.Decimal | number | string;
  currencyCode: string | null;
  lastEntryDate: Date;
};

/**
 * Rebuild summaries from posted journals. Used once after deploy when
 * `account_period_balances` is empty but the ledger already has posted lines.
 */
export async function rebuildCompanyBalances(
  tx: Prisma.TransactionClient,
  companyId: string
): Promise<void> {
  await tx.accountPeriodBalance.deleteMany({ where: { companyId } });
  await tx.partnerRunningBalance.deleteMany({ where: { companyId } });

  const rows = await tx.$queryRaw<PeriodRebuildRow[]>(Prisma.sql`
    SELECT
      jel.accountId AS accountId,
      YEAR(je.date) AS fiscalYear,
      MONTH(je.date) AS periodMonth,
      COALESCE(SUM(jel.debitBase), 0) AS debitTotal,
      COALESCE(SUM(jel.creditBase), 0) AS creditTotal,
      je.currencyCode AS currencyCode,
      MAX(je.date) AS lastEntryDate
    FROM journal_entry_lines jel
    INNER JOIN journal_entries je ON je.id = jel.journalEntryId
    WHERE je.companyId = ${companyId}
      AND je.isPosted = true
      AND je.isCancelled = false
      AND je.deletedAt IS NULL
      AND je.reversalOfJournalEntryId IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM journal_entries rev
        WHERE rev.reversalOfJournalEntryId = je.id
      )
    GROUP BY jel.accountId, YEAR(je.date), MONTH(je.date), je.currencyCode
  `);

  rows.sort((left, right) => {
    const byAccount = compareLedgerKey(left.accountId, right.accountId);
    if (byAccount !== 0) return byAccount;
    if (left.fiscalYear !== right.fiscalYear) return left.fiscalYear - right.fiscalYear;
    if (left.periodMonth !== right.periodMonth) return left.periodMonth - right.periodMonth;
    return compareLedgerKey(left.currencyCode || 'EGP', right.currencyCode || 'EGP');
  });

  for (const row of rows) {
    await applyPostedJournalBalancesInTx(tx, {
      companyId,
      date: row.lastEntryDate,
      currencyCode: row.currencyCode || 'EGP',
      skipCardColumns: true,
      lines: [
        {
          accountId: row.accountId,
          debitBase: row.debitTotal,
          creditBase: row.creditTotal,
        },
      ],
    });
  }

  type PartnerRebuildRow = {
    accountId: string;
    partnerId: string;
    partnerType: string | null;
    currencyCode: string | null;
    debitOriginal: Prisma.Decimal | number | string;
    creditOriginal: Prisma.Decimal | number | string;
    debitBase: Prisma.Decimal | number | string;
    creditBase: Prisma.Decimal | number | string;
    lastEntryDate: Date;
  };

  const partnerSrc = await tx.$queryRaw<PartnerRebuildRow[]>(Prisma.sql`
    SELECT
      jel.accountId AS accountId,
      jel.partnerId AS partnerId,
      jel.partnerType AS partnerType,
      je.currencyCode AS currencyCode,
      COALESCE(SUM(jel.debit), 0) AS debitOriginal,
      COALESCE(SUM(jel.credit), 0) AS creditOriginal,
      COALESCE(SUM(jel.debitBase), 0) AS debitBase,
      COALESCE(SUM(jel.creditBase), 0) AS creditBase,
      MAX(je.date) AS lastEntryDate
    FROM journal_entry_lines jel
    INNER JOIN journal_entries je ON je.id = jel.journalEntryId
    WHERE je.companyId = ${companyId}
      AND je.isPosted = true
      AND je.isCancelled = false
      AND je.deletedAt IS NULL
      AND jel.partnerId IS NOT NULL
      AND je.reversalOfJournalEntryId IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM journal_entries rev
        WHERE rev.reversalOfJournalEntryId = je.id
      )
    GROUP BY jel.accountId, jel.partnerId, jel.partnerType, je.currencyCode
  `);

  partnerSrc.sort((left, right) => {
    const byPartner = compareLedgerKey(left.partnerId, right.partnerId);
    if (byPartner !== 0) return byPartner;
    return compareLedgerKey(left.currencyCode || 'EGP', right.currencyCode || 'EGP');
  });

  for (const row of partnerSrc) {
    await applyPostedJournalBalancesInTx(tx, {
      companyId,
      date: row.lastEntryDate,
      currencyCode: row.currencyCode || 'EGP',
      skipAccountPeriod: true,
      skipCardColumns: true,
      lines: [
        {
          accountId: row.accountId,
          partnerId: row.partnerId,
          partnerType: row.partnerType,
          debit: row.debitOriginal,
          credit: row.creditOriginal,
          debitBase: row.debitBase,
          creditBase: row.creditBase,
        },
      ],
    });
  }
}

/**
 * Move `customer.balance` / `supplier.balance` from journal lines that carry
 * `partnerId`, instead of inferring the party from a shared AR/AP account.
 * Used when `skipCardColumns` avoids ambiguous account-level card updates.
 */
export async function applyPartnerCardBalancesFromLinesInTx(
  tx: Prisma.TransactionClient,
  companyId: string,
  lines: PostedJournalLineDelta[],
  options?: { invert?: boolean }
): Promise<void> {
  const invert = Boolean(options?.invert);
  const buckets = new Map<string, { kind: LinkedCardKind; entityId: string; delta: Prisma.Decimal }>();
  for (const line of lines) {
    if (!line.partnerId) continue;
    const kind: LinkedCardKind = line.partnerType === 'SUPPLIER' ? 'SUPPLIER' : 'CUSTOMER';
    let delta = linkedCardColumnDelta(
      kind,
      line.debit ?? line.debitBase,
      line.credit ?? line.creditBase
    );
    if (invert) delta = delta.negated();
    if (delta.isZero()) continue;
    const key = `${kind}\0${line.partnerId}`;
    const prev = buckets.get(key);
    if (prev) prev.delta = prev.delta.add(delta);
    else buckets.set(key, { kind, entityId: line.partnerId, delta });
  }
  const sorted = [...buckets.values()].sort((left, right) => {
    const byKind = CARD_LOCK_ORDER.indexOf(left.kind) - CARD_LOCK_ORDER.indexOf(right.kind);
    if (byKind !== 0) return byKind;
    return compareLedgerKey(left.entityId, right.entityId);
  });
  for (const row of sorted) {
    const data = { balance: { increment: row.delta } };
    const where = { id: row.entityId, companyId };
    if (row.kind === 'CUSTOMER') await tx.customer.updateMany({ where, data });
    else await tx.supplier.updateMany({ where, data });
  }
}

export class LedgerBalanceService {
  applyPostedJournalBalancesInTx = applyPostedJournalBalancesInTx;
  rebuildCompanyBalances = rebuildCompanyBalances;
  applyPartnerCardBalancesFromLinesInTx = applyPartnerCardBalancesFromLinesInTx;
}

export const ledgerBalanceService = new LedgerBalanceService();
