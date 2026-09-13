#!/usr/bin/env tsx
/**
 * Audit (and optionally repair) account_period_balances vs posted journal lines.
 *
 *   npm run reconcile:balances -- --companyId=<id> [--dry-run] [--fix]
 *
 * Default is --dry-run. --fix deletes the company's summary rows and
 * bulk-inserts the UTC recomputation inside one transaction, under
 * GET_LOCK('reconcile_balances_<companyId>', 10).
 */
import { randomUUID } from 'node:crypto';
import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const EPS = 0.00005;

type LiveRow = {
  accountId: string;
  fiscalYear: number;
  periodMonth: number;
  debitTotal: Prisma.Decimal | number | string;
  creditTotal: Prisma.Decimal | number | string;
  netBalance: Prisma.Decimal | number | string;
};

type CachedRow = {
  accountId: string;
  fiscalYear: number;
  periodMonth: number;
  debitTotal: Prisma.Decimal | number | string;
  creditTotal: Prisma.Decimal | number | string;
  netBalance: Prisma.Decimal | number | string;
};

type DriftRow = {
  accountId: string;
  year: number;
  month: number;
  expectedNet: number;
  currentNet: number;
  drift: number;
};

function parseArgs(argv: string[]): { companyId: string; dryRun: boolean; fix: boolean } {
  let companyId = '';
  let dryRun = true;
  let fix = false;
  for (const arg of argv) {
    if (arg.startsWith('--companyId=')) companyId = arg.slice('--companyId='.length);
    else if (arg === '--companyId') continue;
    else if (arg === '--fix') {
      fix = true;
      dryRun = false;
    } else if (arg === '--dry-run') {
      dryRun = true;
      fix = false;
    }
  }
  const eqIdx = argv.findIndex((a) => a === '--companyId');
  if (!companyId && eqIdx >= 0 && argv[eqIdx + 1] && !argv[eqIdx + 1].startsWith('--')) {
    companyId = argv[eqIdx + 1];
  }
  if (!companyId) {
    console.error('Usage: npm run reconcile:balances -- --companyId=<id> [--dry-run] [--fix]');
    process.exit(1);
  }
  return { companyId, dryRun, fix };
}

function toNum(value: Prisma.Decimal | number | string): number {
  return Number(value);
}

function periodKey(accountId: string, year: number, month: number): string {
  return `${accountId}:${year}-${String(month).padStart(2, '0')}`;
}

function printTable(rows: DriftRow[]): void {
  if (rows.length === 0) {
    console.log('No drift. account_period_balances matches posted journal lines.');
    return;
  }
  const headers = ['accountId', 'year', 'month', 'expectedNet', 'currentNet', 'drift'];
  const widths = headers.map((h) => h.length);
  const cells = rows.map((r) => [
    r.accountId,
    String(r.year),
    String(r.month),
    r.expectedNet.toFixed(4),
    r.currentNet.toFixed(4),
    r.drift.toFixed(4),
  ]);
  for (const row of cells) {
    row.forEach((cell, i) => {
      widths[i] = Math.max(widths[i], cell.length);
    });
  }
  const line = (cols: string[]) =>
    cols.map((c, i) => c.padEnd(widths[i])).join('  ');
  console.log(line(headers));
  console.log(widths.map((w) => '-'.repeat(w)).join('  '));
  for (const row of cells) console.log(line(row));
  console.log(`\n${rows.length} drifted period(s).`);
}

async function acquireLock(
  tx: Prisma.TransactionClient,
  companyId: string
): Promise<string> {
  const lockName = `reconcile_balances_${companyId}`;
  const rows = await tx.$queryRaw<Array<{ acquired: number | bigint | null }>>`
    SELECT GET_LOCK(CONCAT('reconcile_balances_', ${companyId}), 10) AS acquired
  `;
  const acquired = Number(rows[0]?.acquired);
  if (acquired !== 1) {
    throw new Error(`Could not acquire GET_LOCK(CONCAT('reconcile_balances_', '${companyId}'), 10)`);
  }
  return lockName;
}

async function releaseLock(tx: Prisma.TransactionClient, lockName: string): Promise<void> {
  await tx.$queryRaw`SELECT RELEASE_LOCK(${lockName})`;
}

async function loadLive(tx: Prisma.TransactionClient, companyId: string): Promise<LiveRow[]> {
  // Match applyPostedJournalBalancesInTx: period keys and totals are UTC base amounts.
  await tx.$executeRaw`SET time_zone = '+00:00'`;
  return tx.$queryRaw<LiveRow[]>(Prisma.sql`
    SELECT
      jel.accountId AS accountId,
      YEAR(je.date) AS fiscalYear,
      MONTH(je.date) AS periodMonth,
      COALESCE(SUM(jel.debitBase), 0) AS debitTotal,
      COALESCE(SUM(jel.creditBase), 0) AS creditTotal,
      COALESCE(SUM(jel.debitBase), 0) - COALESCE(SUM(jel.creditBase), 0) AS netBalance
    FROM journal_entry_lines jel
    INNER JOIN journal_entries je ON je.id = jel.journalEntryId
    WHERE je.companyId = ${companyId}
      AND je.isPosted = true
      AND je.isCancelled = false
      AND je.deletedAt IS NULL
    GROUP BY jel.accountId, YEAR(je.date), MONTH(je.date)
  `);
}

async function loadCached(tx: Prisma.TransactionClient, companyId: string): Promise<CachedRow[]> {
  return tx.accountPeriodBalance.findMany({
    where: { companyId },
    select: {
      accountId: true,
      fiscalYear: true,
      periodMonth: true,
      debitTotal: true,
      creditTotal: true,
      netBalance: true,
    },
  });
}

function diff(live: LiveRow[], cached: CachedRow[]): DriftRow[] {
  const cachedByKey = new Map(
    cached.map((r) => [periodKey(r.accountId, r.fiscalYear, r.periodMonth), r])
  );
  const seen = new Set<string>();
  const out: DriftRow[] = [];

  for (const row of live) {
    const key = periodKey(row.accountId, row.fiscalYear, row.periodMonth);
    seen.add(key);
    const actual = cachedByKey.get(key);
    const expectedNet = toNum(row.netBalance);
    const currentNet = actual ? toNum(actual.netBalance) : 0;
    const debitDrift = actual ? toNum(row.debitTotal) - toNum(actual.debitTotal) : toNum(row.debitTotal);
    const creditDrift = actual ? toNum(row.creditTotal) - toNum(actual.creditTotal) : toNum(row.creditTotal);
    const drift = expectedNet - currentNet;
    if (!actual || Math.abs(drift) > EPS || Math.abs(debitDrift) > EPS || Math.abs(creditDrift) > EPS) {
      out.push({
        accountId: row.accountId,
        year: Number(row.fiscalYear),
        month: Number(row.periodMonth),
        expectedNet,
        currentNet,
        drift,
      });
    }
  }

  for (const row of cached) {
    const key = periodKey(row.accountId, row.fiscalYear, row.periodMonth);
    if (seen.has(key)) continue;
    const actualNet = toNum(row.netBalance);
    if (Math.abs(actualNet) > EPS) {
      out.push({
        accountId: row.accountId,
        year: Number(row.fiscalYear),
        month: Number(row.periodMonth),
        expectedNet: 0,
        currentNet: actualNet,
        drift: -actualNet,
      });
    }
  }

  out.sort((a, b) => {
    if (a.accountId !== b.accountId) return a.accountId.localeCompare(b.accountId);
    if (a.year !== b.year) return a.year - b.year;
    return a.month - b.month;
  });
  return out;
}

async function applyFix(
  tx: Prisma.TransactionClient,
  companyId: string,
  live: LiveRow[]
): Promise<void> {
  await tx.accountPeriodBalance.deleteMany({ where: { companyId } });
  if (live.length === 0) return;
  await tx.accountPeriodBalance.createMany({
    data: live.map((row) => ({
      id: randomUUID(),
      companyId,
      accountId: row.accountId,
      fiscalYear: Number(row.fiscalYear),
      periodMonth: Number(row.periodMonth),
      debitTotal: new Prisma.Decimal(toNum(row.debitTotal).toFixed(4)),
      creditTotal: new Prisma.Decimal(toNum(row.creditTotal).toFixed(4)),
      netBalance: new Prisma.Decimal(toNum(row.netBalance).toFixed(4)),
    })),
  });
}

async function main(): Promise<void> {
  const { companyId, dryRun, fix } = parseArgs(process.argv.slice(2));
  const company = await prisma.company.findFirst({
    where: { id: companyId },
    select: { id: true },
  });
  if (!company) {
    console.error(`Company not found: ${companyId}`);
    process.exit(1);
  }

  await prisma.$transaction(
    async (tx) => {
      const lockName = await acquireLock(tx, companyId);
      try {
        const [live, cached] = await Promise.all([loadLive(tx, companyId), loadCached(tx, companyId)]);
        const drifted = diff(live, cached);
        printTable(drifted);

        if (fix && drifted.length > 0) {
          await applyFix(tx, companyId, live);
          console.log(`Repaired ${live.length} period row(s) for company ${companyId}.`);
        } else if (fix) {
          console.log('Nothing to repair.');
        } else if (dryRun && drifted.length > 0) {
          console.log('Dry-run only. Re-run with --fix to replace account_period_balances.');
        }
      } finally {
        await releaseLock(tx, lockName);
      }
    },
    { timeout: 120_000, maxWait: 15_000 }
  );
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
