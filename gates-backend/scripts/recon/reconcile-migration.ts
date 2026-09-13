#!/usr/bin/env tsx
/**
 * Migration parity harness: compares a legacy dump against what the ETL loaded, so a cutover
 * can be signed off on numbers instead of row counts.
 *
 * Sections
 *   trial-balance — legacy posted GL (per account code) vs migrated journal lines, plus a
 *                   cross-check that the M16 trial balance report agrees with the raw ledger.
 *   stock         — legacy ItemStore quantities and ItemCost valuation vs ItemQuantity /
 *                   ItemCostHistory.
 *
 * Run: npm run recon:migration -- --company=MIG1 [--data-path=…] [--from=YYYY-MM-DD]
 *      [--to=YYYY-MM-DD] [--section=trial-balance|stock|all] [--tolerance=0.01] [--out=file.json]
 *
 * Legacy source resolution matches the ETL: LEGACY_MSSQL_URL when set, otherwise JSON dumps
 * from --data-path / LEGACY_DATA_PATH.
 */
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import { LegacyDataExtractor } from '../migration/LegacyDataExtractor';
import { financialReportService } from '../../src/modules/accounting/services/financial-report.service';
import {
  aggregateLegacyStock,
  aggregateLegacyTrialBalance,
  latestLegacyCosts,
} from './legacy-aggregates';

const prisma = new PrismaClient();

const DEFAULT_DATA_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'migration',
  'fixtures',
  'sample'
);

type Section = 'trial-balance' | 'stock' | 'all';

interface ReconOptions {
  companyCode: string;
  dataPath: string;
  mssqlUrl?: string;
  section: Section;
  tolerance: number;
  from?: Date;
  to?: Date;
  outFile?: string;
}

interface Difference {
  key: string;
  metric: string;
  legacy: number;
  migrated: number;
  delta: number;
}

interface SectionResult {
  name: string;
  comparedKeys: number;
  legacyTotals: Record<string, number>;
  migratedTotals: Record<string, number>;
  differences: Difference[];
  notes: string[];
}

function parseArgs(argv: string[]): ReconOptions {
  let companyCode = '';
  let dataPath = process.env.LEGACY_DATA_PATH ?? DEFAULT_DATA_PATH;
  let section: Section = 'all';
  let tolerance = 0.01;
  let from: Date | undefined;
  let to: Date | undefined;
  let outFile: string | undefined;

  for (const arg of argv) {
    if (arg.startsWith('--company=')) companyCode = arg.split('=')[1]?.trim() ?? '';
    else if (arg.startsWith('--data-path=')) dataPath = arg.split('=')[1] ?? dataPath;
    else if (arg.startsWith('--section=')) {
      const v = arg.split('=')[1]?.trim() as Section;
      if (v === 'trial-balance' || v === 'stock' || v === 'all') section = v;
    } else if (arg.startsWith('--tolerance=')) {
      tolerance = Number(arg.split('=')[1]) || tolerance;
    } else if (arg.startsWith('--from=')) from = new Date(arg.split('=')[1] ?? '');
    else if (arg.startsWith('--to=')) to = new Date(arg.split('=')[1] ?? '');
    else if (arg.startsWith('--out=')) outFile = arg.split('=')[1];
  }

  if (!companyCode) {
    throw new Error('Missing --company=<legacy CompanyCode>');
  }
  if (from && Number.isNaN(from.getTime())) throw new Error('Invalid --from date');
  if (to && Number.isNaN(to.getTime())) throw new Error('Invalid --to date');

  return {
    companyCode,
    dataPath,
    mssqlUrl: process.env.LEGACY_MSSQL_URL ?? process.env.LEGACY_MSSQL_CONNECTION_STRING,
    section,
    tolerance,
    from,
    to,
    outFile,
  };
}

function round(n: number, decimals = 4): number {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

function compare(
  diffs: Difference[],
  tolerance: number,
  key: string,
  metric: string,
  legacy: number,
  migrated: number
) {
  const delta = round(migrated - legacy);
  if (Math.abs(delta) > tolerance) {
    diffs.push({ key, metric, legacy: round(legacy), migrated: round(migrated), delta });
  }
}

async function reconcileTrialBalance(
  options: ReconOptions,
  companyId: string,
  extractor: LegacyDataExtractor
): Promise<SectionResult> {
  const extractOptions = { batchSize: 5000, companyCode: options.companyCode };
  const [headers, details] = await Promise.all([
    extractor.loadTable('GLTrxHeader', extractOptions),
    extractor.loadTable('GLTrxDetail', extractOptions),
  ]);

  const legacy = aggregateLegacyTrialBalance(headers, details, {
    from: options.from,
    to: options.to,
  });

  const grouped = await prisma.journalEntryLine.groupBy({
    by: ['accountId'],
    where: {
      journalEntry: {
        companyId,
        isPosted: true,
        isCancelled: false,
        deletedAt: null,
        ...(options.from || options.to
          ? {
              date: {
                ...(options.from ? { gte: options.from } : {}),
                ...(options.to ? { lte: options.to } : {}),
              },
            }
          : {}),
      },
    },
    _sum: { debitBase: true, creditBase: true },
  });

  const accounts = await prisma.account.findMany({
    where: { companyId, id: { in: grouped.map((g) => g.accountId) } },
    select: { id: true, code: true },
  });
  const codeById = new Map(accounts.map((a) => [a.id, a.code]));

  const migrated = new Map<string, { debit: number; credit: number }>();
  for (const row of grouped) {
    const code = codeById.get(row.accountId);
    if (!code) continue;
    const current = migrated.get(code) ?? { debit: 0, credit: 0 };
    current.debit = round(current.debit + Number(row._sum.debitBase ?? 0));
    current.credit = round(current.credit + Number(row._sum.creditBase ?? 0));
    migrated.set(code, current);
  }

  const diffs: Difference[] = [];
  const codes = new Set([...legacy.keys(), ...migrated.keys()]);
  for (const code of [...codes].sort()) {
    const l = legacy.get(code) ?? { debit: 0, credit: 0 };
    const m = migrated.get(code) ?? { debit: 0, credit: 0 };
    compare(diffs, options.tolerance, code, 'debit', l.debit, m.debit);
    compare(diffs, options.tolerance, code, 'credit', l.credit, m.credit);
  }

  const legacyTotals = {
    debit: round([...legacy.values()].reduce((s, r) => s + r.debit, 0)),
    credit: round([...legacy.values()].reduce((s, r) => s + r.credit, 0)),
    accounts: legacy.size,
  };
  const migratedTotals = {
    debit: round([...migrated.values()].reduce((s, r) => s + r.debit, 0)),
    credit: round([...migrated.values()].reduce((s, r) => s + r.credit, 0)),
    accounts: migrated.size,
  };

  const notes: string[] = [];
  if (Math.abs(legacyTotals.debit - legacyTotals.credit) > options.tolerance) {
    notes.push(
      `Legacy dump is itself unbalanced by ${round(legacyTotals.debit - legacyTotals.credit)} — fix the source before cutover.`
    );
  }
  if (Math.abs(migratedTotals.debit - migratedTotals.credit) > options.tolerance) {
    notes.push(
      `Migrated ledger is unbalanced by ${round(migratedTotals.debit - migratedTotals.credit)}.`
    );
  }

  // Cross-check the report the business will actually read against the raw ledger.
  const reportStart = options.from ?? new Date(Date.UTC(1900, 0, 1));
  const reportEnd = options.to ?? new Date(Date.UTC(2999, 11, 31, 23, 59, 59));
  const report = await financialReportService.getTrialBalance({
    companyId,
    startDate: reportStart,
    endDate: reportEnd,
  });
  const reportDebit = round(report.accounts.reduce((s, a) => s + a.periodDebit, 0));
  const reportCredit = round(report.accounts.reduce((s, a) => s + a.periodCredit, 0));
  compare(diffs, options.tolerance, 'M16 report', 'debit', migratedTotals.debit, reportDebit);
  compare(diffs, options.tolerance, 'M16 report', 'credit', migratedTotals.credit, reportCredit);
  if (!report.verification.balanced) {
    notes.push('M16 trial balance report reports itself unbalanced.');
  }

  return {
    name: 'trial-balance',
    comparedKeys: codes.size,
    legacyTotals,
    migratedTotals,
    differences: diffs,
    notes,
  };
}

async function reconcileStock(
  options: ReconOptions,
  companyId: string,
  extractor: LegacyDataExtractor
): Promise<SectionResult> {
  const extractOptions = { batchSize: 5000, companyCode: options.companyCode };
  const [itemStores, itemCosts] = await Promise.all([
    extractor.loadTable('ItemStore', extractOptions),
    extractor.loadTable('ItemCost', extractOptions),
  ]);

  const legacyStock = aggregateLegacyStock(itemStores);
  const legacyCosts = latestLegacyCosts(itemCosts);

  const quantities = await prisma.itemQuantity.findMany({
    where: { item: { companyId } },
    select: {
      quantity: true,
      item: { select: { id: true, serial: true } },
      warehouse: { select: { legacyStoreCode: true, code: true } },
    },
  });

  const migratedStock = new Map<string, number>();
  const itemIdBySerial = new Map<string, string>();
  for (const row of quantities) {
    const itemCode = row.item.serial ?? '';
    const storeCode = row.warehouse.legacyStoreCode ?? row.warehouse.code;
    if (!itemCode || !storeCode) continue;
    itemIdBySerial.set(itemCode, row.item.id);
    const key = `${storeCode}|${itemCode}`;
    migratedStock.set(key, round((migratedStock.get(key) ?? 0) + Number(row.quantity), 3));
  }

  // Latest cost per item: highest effectiveAt, then highest serial — same precedence as legacy.
  const costRows = await prisma.itemCostHistory.findMany({
    where: { companyId },
    orderBy: [{ itemId: 'asc' }, { effectiveAt: 'desc' }, { serial: 'desc' }],
    select: { itemId: true, cost: true, item: { select: { serial: true } } },
  });
  const migratedCosts = new Map<string, number>();
  for (const row of costRows) {
    const code = row.item.serial ?? '';
    if (!code || migratedCosts.has(code)) continue;
    migratedCosts.set(code, Number(row.cost));
  }

  const diffs: Difference[] = [];
  const stockKeys = new Set([...legacyStock.keys(), ...migratedStock.keys()]);
  for (const key of [...stockKeys].sort()) {
    const legacyQty = legacyStock.get(key)?.quantity ?? 0;
    const migratedQty = migratedStock.get(key) ?? 0;
    compare(diffs, options.tolerance, key, 'quantity', legacyQty, migratedQty);
  }

  const itemCodes = new Set([...legacyCosts.keys(), ...migratedCosts.keys()]);
  for (const code of [...itemCodes].sort()) {
    compare(
      diffs,
      options.tolerance,
      code,
      'unitCost',
      legacyCosts.get(code) ?? 0,
      migratedCosts.get(code) ?? 0
    );
  }

  const valuation = (
    stock: Map<string, number>,
    costs: Map<string, number>
  ): { quantity: number; value: number } => {
    let quantity = 0;
    let value = 0;
    for (const [key, qty] of stock) {
      const itemCode = key.split('|')[1] ?? '';
      quantity = round(quantity + qty, 3);
      value = round(value + qty * (costs.get(itemCode) ?? 0));
    }
    return { quantity, value };
  };

  const legacyStockFlat = new Map([...legacyStock].map(([k, v]) => [k, v.quantity]));
  const legacyValuation = valuation(legacyStockFlat, legacyCosts);
  const migratedValuation = valuation(migratedStock, migratedCosts);
  compare(
    diffs,
    options.tolerance,
    'TOTAL',
    'stockValue',
    legacyValuation.value,
    migratedValuation.value
  );

  const notes: string[] = [];
  const costlessItems = [...migratedStock.keys()]
    .map((k) => k.split('|')[1] ?? '')
    .filter((code) => code && !migratedCosts.has(code));
  if (costlessItems.length > 0) {
    notes.push(
      `${new Set(costlessItems).size} migrated item(s) hold stock with no cost history — valuation treats them as zero.`
    );
  }

  return {
    name: 'stock',
    comparedKeys: stockKeys.size + itemCodes.size,
    legacyTotals: {
      quantity: legacyValuation.quantity,
      value: legacyValuation.value,
      items: legacyCosts.size,
    },
    migratedTotals: {
      quantity: migratedValuation.quantity,
      value: migratedValuation.value,
      items: migratedCosts.size,
    },
    differences: diffs,
    notes,
  };
}

function printSection(result: SectionResult) {
  console.log(`\n=== ${result.name} ===`);
  console.log('  legacy  :', JSON.stringify(result.legacyTotals));
  console.log('  migrated:', JSON.stringify(result.migratedTotals));
  console.log(`  compared keys: ${result.comparedKeys}`);
  for (const note of result.notes) {
    console.log(`  NOTE  ${note}`);
  }
  if (result.differences.length === 0) {
    console.log('  MATCH — no differences beyond tolerance');
    return;
  }
  console.log(`  ${result.differences.length} difference(s):`);
  for (const d of result.differences.slice(0, 50)) {
    console.log(
      `    ${d.key.padEnd(24)} ${d.metric.padEnd(10)} legacy=${d.legacy} migrated=${d.migrated} delta=${d.delta}`
    );
  }
  if (result.differences.length > 50) {
    console.log(`    … ${result.differences.length - 50} more (see --out report)`);
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  console.log('Migration reconciliation — start');
  console.log(
    `  company=${options.companyCode} source=${options.mssqlUrl ? 'mssql' : options.dataPath} tolerance=${options.tolerance}`
  );

  const company = await prisma.company.findFirst({
    where: { legacyCompanyCode: options.companyCode },
    select: { id: true, arabicName: true },
  });
  if (!company) {
    throw new Error(
      `No migrated company with legacyCompanyCode=${options.companyCode}. Run migrate:legacy first.`
    );
  }

  const extractor = new LegacyDataExtractor(options.dataPath, options.mssqlUrl);
  const results: SectionResult[] = [];
  try {
    if (options.section === 'all' || options.section === 'trial-balance') {
      results.push(await reconcileTrialBalance(options, company.id, extractor));
    }
    if (options.section === 'all' || options.section === 'stock') {
      results.push(await reconcileStock(options, company.id, extractor));
    }
  } finally {
    await extractor.close();
  }

  for (const result of results) {
    printSection(result);
  }

  const totalDiffs = results.reduce((s, r) => s + r.differences.length, 0);
  const report = {
    generatedAt: new Date().toISOString(),
    companyCode: options.companyCode,
    companyId: company.id,
    tolerance: options.tolerance,
    window: { from: options.from?.toISOString(), to: options.to?.toISOString() },
    source: options.mssqlUrl ? 'mssql' : options.dataPath,
    sections: results,
    verdict: totalDiffs === 0 ? 'PASS' : 'FAIL',
  };

  if (options.outFile) {
    await writeFile(options.outFile, JSON.stringify(report, null, 2), 'utf8');
    console.log(`\nReport written to ${options.outFile}`);
  }

  console.log(
    `\nMigration reconciliation — ${report.verdict}${totalDiffs > 0 ? ` (${totalDiffs} difference(s))` : ''}`
  );
  if (totalDiffs > 0) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error('Migration reconciliation — ERROR');
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
