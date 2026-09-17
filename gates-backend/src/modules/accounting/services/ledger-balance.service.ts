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
  /**
   * Unpost / reverse: apply -1 × the original line amounts so summaries
   * shrink instead of booking swapped debit/credit (which inflates totals).
   */
  invert?: boolean;
};

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

export class LedgerBalanceService {
  applyPostedJournalBalancesInTx = applyPostedJournalBalancesInTx;
  rebuildCompanyBalances = rebuildCompanyBalances;
}

export const ledgerBalanceService = new LedgerBalanceService();
