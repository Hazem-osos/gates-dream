/**
 * ERP Paranoia-Grade Health & Accounting Stress Diagnostics
 *
 * A single standalone diagnostic that runs four suites:
 *   1. GL / subledger reconciliation invariants — read-only, against real tenants.
 *   2. High-contention concurrency stress tests.
 *   3. Query & performance sanity (EXPLAIN, index-declaration diff, paginated timings).
 *   4. Lifecycle & edge-case traps (illegal transitions must be rejected).
 *
 * Suites 2-4 run inside a disposable company that is provisioned at the start
 * of the run and hard-deleted (ordered teardown, respecting `onDelete: Restrict`
 * FKs) in a `finally` block, unless `--keep` is passed.
 *
 * Flags:
 *   --company=<uuid>   Scope suite 1 to a single company instead of every active tenant.
 *   --skip-stress      Run suite 1 and the read-only parts of suite 3 (EXPLAIN + index
 *                       diff) only — skips bootstrap, suite 2, paginated timings, suite 4.
 *   --keep             Skip teardown of the disposable company (debugging aid).
 *   --rows=10000       Row count seeded for suite 3's paginated-timing benchmark.
 *   --json             Dump the full findings array as JSON instead of (in addition to)
 *                       the human-readable console report.
 *
 * Run: npx tsx scripts/erp-paranoia-audit.ts
 *      npm run audit:paranoia
 *
 * Exit code: 1 if any P0/P1 finding was recorded, else 0.
 */

import { config as loadDotenv } from 'dotenv';
loadDotenv();

// ── Connection-pool override — MUST happen before prisma.ts is ever imported ──
//
// `env.DATABASE_URL` is parsed once (via zod) the first time
// `src/shared/config/env.ts` loads, and `src/shared/database/prisma.ts` reads
// `env.DATABASE_URL` at module-evaluation time to build the PrismaClient
// datasource URL. Suite 2 opens up to ~10 concurrent interactive transactions
// on top of whatever else the pool is already serving, so the default
// development limit (10) would starve immediately. Every Prisma-touching
// module is therefore imported dynamically inside `main()` (see below) so
// this mutation is guaranteed to land first — only pure, prisma-free modules
// (`cheque-transition.util`, `decimal-round`, `system-account-map`,
// `error-handler`, `tenant-context`) may be imported statically at the top
// of this file.
(function bumpConnectionPool() {
  const raw = process.env.DATABASE_URL;
  if (!raw) return;
  try {
    const url = new URL(raw);
    if (!url.searchParams.has('connection_limit')) {
      url.searchParams.set('connection_limit', '20');
    }
    if (!url.searchParams.has('pool_timeout')) {
      url.searchParams.set('pool_timeout', '30');
    }
    process.env.DATABASE_URL = url.toString();
  } catch {
    // Not a parseable URL — leave it untouched; prisma.ts will surface the
    // real validation error itself.
  }
})();

import { randomUUID } from 'node:crypto';
// `Prisma` (namespace: `.join`/`.sql`/`.raw` helpers + input/where types) has no
// side effects at import time — unlike `PrismaClient`, it never reads env vars
// or opens a connection, so it is safe to import as a real (non-type) value
// here rather than deferring it into the dynamic-import block in `main()`.
import { Prisma } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';
import { AppError } from '../src/shared/middleware/error-handler.js';
import { assertChequeTransition } from '../src/modules/treasury/services/cheque-transition.util.js';
import { SYSTEM_GL_CODES } from '../src/modules/accounting/data/system-account-map.js';
import { roundTo4, amountsEqualAt4 } from '../src/shared/utils/decimal-round.js';
import { runWithTenantContext, runWithoutTenantScoping } from '../src/shared/database/tenant-context.js';
import { INVOICE_DELETE_SETTLEMENT_LOCK_MESSAGE } from '../src/modules/invoices/services/invoice-settlement-policy.js';
import { PERIOD_LOCKED_MESSAGE } from '../src/modules/accounting/constants/ledger-integrity.js';

// ─────────────────────────────────────────────────────────────────────────────
// Types shared across suites
// ─────────────────────────────────────────────────────────────────────────────

type Severity = 'P0' | 'P1' | 'P2' | 'P3';

interface Finding {
  suite: string;
  id: string;
  severity: Severity;
  title: string;
  expected: string;
  actual: string;
  detail?: string;
}

interface Flags {
  company?: string;
  skipStress: boolean;
  keep: boolean;
  rows: number;
  json: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// CLI flags
// ─────────────────────────────────────────────────────────────────────────────

function parseFlags(argv: string[]): Flags {
  const flags: Flags = { skipStress: false, keep: false, rows: 10_000, json: false };
  for (const arg of argv) {
    if (arg === '--skip-stress') flags.skipStress = true;
    else if (arg === '--keep') flags.keep = true;
    else if (arg === '--json') flags.json = true;
    else if (arg.startsWith('--company=')) flags.company = arg.slice('--company='.length).trim();
    else if (arg.startsWith('--rows=')) {
      const n = parseInt(arg.slice('--rows='.length), 10);
      if (Number.isFinite(n) && n > 0) flags.rows = n;
    }
  }
  return flags;
}

// ─────────────────────────────────────────────────────────────────────────────
// Reporting
// ─────────────────────────────────────────────────────────────────────────────

const findings: Finding[] = [];

function fmt(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

function line(label: string, value: string) {
  console.log(`    ${label.padEnd(42)} ${value}`);
}

function section(title: string) {
  console.log(`\n${'='.repeat(78)}`);
  console.log(title);
  console.log('='.repeat(78));
}

function subsection(title: string) {
  console.log(`\n${'-'.repeat(78)}`);
  console.log(title);
  console.log('-'.repeat(78));
}

/**
 * Records a check's outcome. `pass === false` pushes a Finding and prints a
 * ❌ line with expected/actual/detail; `pass === true` just prints a ✓ line.
 */
function check(params: {
  suite: string;
  id: string;
  severity: Severity;
  title: string;
  pass: boolean;
  expected: string;
  actual: string;
  detail?: string;
}) {
  const icon = params.pass ? '✓' : '❌';
  console.log(`  [${params.suite}/${params.id}] ${icon} ${params.title}`);
  if (!params.pass) {
    line('Expected', params.expected);
    line('Actual', params.actual);
    if (params.detail) line('Detail', params.detail);
    findings.push({
      suite: params.suite,
      id: params.id,
      severity: params.severity,
      title: params.title,
      expected: params.expected,
      actual: params.actual,
      detail: params.detail,
    });
  }
}

function info(suite: string, id: string, severity: Severity, title: string, detail: string) {
  console.log(`  [${suite}/${id}] ℹ ${title}`);
  line('Detail', detail);
  findings.push({ suite, id, severity, title, expected: '(informational)', actual: detail });
}

function reportAndExit(flags: Flags) {
  section('FINDINGS SUMMARY');
  if (findings.length === 0) {
    console.log('\n  No findings recorded — every check passed.');
  } else {
    const bySeverity: Record<Severity, Finding[]> = { P0: [], P1: [], P2: [], P3: [] };
    for (const f of findings) bySeverity[f.severity].push(f);
    for (const sev of ['P0', 'P1', 'P2', 'P3'] as Severity[]) {
      if (bySeverity[sev].length === 0) continue;
      console.log(`\n  ${sev} (${bySeverity[sev].length}):`);
      for (const f of bySeverity[sev]) {
        console.log(`    - [${f.suite}/${f.id}] ${f.title}`);
      }
    }
  }

  if (flags.json) {
    console.log('\n--- JSON ---');
    console.log(JSON.stringify(findings, null, 2));
  }

  const blocking = findings.filter((f) => f.severity === 'P0' || f.severity === 'P1').length;
  console.log(
    `\nTotal findings: ${findings.length} (${blocking} blocking P0/P1). Exit code: ${blocking > 0 ? 1 : 0}`
  );
  process.exitCode = blocking > 0 ? 1 : 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Small shared helpers
// ─────────────────────────────────────────────────────────────────────────────

function percentile(sortedMs: number[], p: number): number {
  if (sortedMs.length === 0) return 0;
  const idx = Math.min(sortedMs.length - 1, Math.ceil((p / 100) * sortedMs.length) - 1);
  return sortedMs[Math.max(0, idx)];
}

async function timeIt<T>(fn: () => Promise<T>): Promise<{ ms: number; result: T }> {
  const start = process.hrtime.bigint();
  const result = await fn();
  const end = process.hrtime.bigint();
  return { ms: Number(end - start) / 1_000_000, result };
}

/** Runs `fn`, converting a thrown error into a `{ ok, error }` result instead of rejecting. */
async function attempt<T>(fn: () => Promise<T>): Promise<{ ok: true; value: T } | { ok: false; error: unknown }> {
  try {
    return { ok: true, value: await fn() };
  } catch (error) {
    return { ok: false, error };
  }
}

function isPrismaKnownError(err: unknown, code?: string): boolean {
  if (!err || typeof err !== 'object') return false;
  const anyErr = err as { code?: string; name?: string };
  if (anyErr.name !== 'PrismaClientKnownRequestError' && !('clientVersion' in (err as object))) {
    // Fall through — still check code below in case name isn't populated exactly this way.
  }
  return code ? anyErr.code === code : typeof anyErr.code === 'string';
}

// ─────────────────────────────────────────────────────────────────────────────
// Disposable audit-company bootstrap & teardown
// ─────────────────────────────────────────────────────────────────────────────

export interface AuditCompanyContext {
  companyId: string;
  branchId: string;
  warehouseId: string;
  safeId: string;
  fiscalYearId: string;
  itemId: string;
  unitId: string;
  customerId: string;
  arAccountId: string;
  apAccountId: string;
  cashAccountId: string;
  inventoryAccountId: string;
  salesAccountId: string;
  cogsAccountId: string;
}

const AUDIT_COMPANY_TAG = 'ERP-PARANOIA-AUDIT';

async function bootstrapAuditCompany(
  prisma: PrismaClient,
  tenantProvisioningService: {
    provisionStandardTenant: (
      companyId: string,
      opts?: { currencyCode?: string }
    ) => Promise<{
      warehouseId?: string;
      safeId?: string;
      fiscalYearId?: string;
      branchId?: string;
    }>;
  },
  demoCatalogService: {
    ensureDemoCatalog: (companyId: string) => Promise<{ itemId: string; unitId: string; warehouseId: string; customerId: string }>;
  }
): Promise<AuditCompanyContext> {
  subsection('Bootstrap — provisioning disposable audit company');

  const runTag = `${AUDIT_COMPANY_TAG} ${new Date().toISOString()} ${randomUUID().slice(0, 8)}`;
  const company = await prisma.company.create({
    data: {
      arabicName: runTag,
      englishName: runTag,
      isActive: true,
    },
  });
  console.log(`  Created audit company ${company.id} ("${runTag}")`);

  const provision = await tenantProvisioningService.provisionStandardTenant(company.id, {
    currencyCode: 'EGP',
  });
  if (!provision.warehouseId || !provision.safeId || !provision.fiscalYearId || !provision.branchId) {
    throw new Error('provisionStandardTenant did not return warehouseId/safeId/fiscalYearId/branchId');
  }
  console.log('  Standard tenant provisioned (COA, branch, warehouse, safe, fiscal year)');

  const catalog = await demoCatalogService.ensureDemoCatalog(company.id);
  console.log('  Demo catalog ensured (items, units, demo customer)');

  // Negative-stock guard sanity: bootstrap must not proceed if this fresh
  // company somehow inherited a permissive flag — suite 2's stock-exhaustion
  // test is meaningless (and silently green) if negative stock is allowed.
  const settings = await prisma.companySettings.findUnique({
    where: { companyId: company.id },
    select: { allowNegativeBalance: true },
  });
  const legacyEntry = await prisma.companySettingEntry.findFirst({
    where: { companyId: company.id, branchId: null, name: 'AllowNegativeStore' },
    select: { value: true },
  });
  const legacyAllow =
    !!legacyEntry?.value && ['t', 'true', '1', 'yes'].includes(legacyEntry.value.trim().toLowerCase());
  if (settings?.allowNegativeBalance === true || legacyAllow) {
    throw new Error(
      'Audit company was provisioned with allowNegativeBalance/AllowNegativeStore enabled — ' +
        'suite 2 stock-exhaustion test would be meaningless. Aborting before any stress test runs.'
    );
  }
  console.log('  Verified allowNegativeBalance=false and legacy AllowNegativeStore unset');

  const accountByCode = async (code: string): Promise<string> => {
    const acc = await prisma.account.findFirst({
      where: { companyId: company.id, code, deletedAt: null },
      select: { id: true },
    });
    if (!acc) throw new Error(`Bootstrap: standard account code ${code} missing after provisioning`);
    return acc.id;
  };

  const [arAccountId, apAccountId, cashAccountId, inventoryAccountId, salesAccountId, cogsAccountId] =
    await Promise.all([
      accountByCode(SYSTEM_GL_CODES.ar),
      accountByCode(SYSTEM_GL_CODES.ap),
      accountByCode(SYSTEM_GL_CODES.cashMain),
      accountByCode(SYSTEM_GL_CODES.inventory),
      accountByCode(SYSTEM_GL_CODES.salesRevenue),
      accountByCode(SYSTEM_GL_CODES.cogs),
    ]);

  return {
    companyId: company.id,
    branchId: provision.branchId,
    warehouseId: provision.warehouseId,
    safeId: provision.safeId,
    fiscalYearId: provision.fiscalYearId,
    itemId: catalog.itemId,
    unitId: catalog.unitId,
    customerId: catalog.customerId,
    arAccountId,
    apAccountId,
    cashAccountId,
    inventoryAccountId,
    salesAccountId,
    cogsAccountId,
  };
}

async function teardownAuditCompany(prisma: PrismaClient, companyId: string, keep: boolean): Promise<void> {
  subsection('Teardown — removing disposable audit company');

  if (keep) {
    console.log(`  --keep passed: leaving audit company ${companyId} in place for inspection.`);
    return;
  }

  await runWithoutTenantScoping(async () => {
    const steps: Array<{ label: string; run: () => Promise<unknown> }> = [
      {
        label: 'paymentAllocation.deleteMany',
        run: () => prisma.paymentAllocation.deleteMany({ where: { companyId } }),
      },
      {
        label: 'landedCostAllocation.deleteMany (defensive — Restrict on Company/Invoice)',
        run: () => prisma.landedCostAllocation.deleteMany({ where: { companyId } }),
      },
      {
        label: 'inventoryMovement.deleteMany',
        run: () => prisma.inventoryMovement.deleteMany({ where: { companyId } }),
      },
      {
        label: 'itemCostHistory.deleteMany',
        run: () => prisma.itemCostHistory.deleteMany({ where: { companyId } }),
      },
      {
        label: 'cashTransaction.deleteMany (carries journalEntryId FK)',
        run: () => prisma.cashTransaction.deleteMany({ where: { companyId } }),
      },
      {
        label: 'cheque.deleteMany (carries several journal-entry FKs)',
        run: () => prisma.cheque.deleteMany({ where: { companyId } }),
      },
      {
        label: 'journalEntry.updateMany — null out reversalOfJournalEntryId (self-FK is Restrict)',
        run: () => prisma.journalEntry.updateMany({ where: { companyId }, data: { reversalOfJournalEntryId: null } }),
      },
      {
        label: 'journalEntry.deleteMany',
        run: () => prisma.journalEntry.deleteMany({ where: { companyId } }),
      },
      {
        // `Invoice.company` is declared `onDelete: Cascade`, so in theory
        // `company.delete()` alone should sweep every invoice. Empirically it
        // does not: `Invoice` has a self-referencing FK (`convertedInvoiceId`
        // -> `Invoice.id`, `onDelete: SetNull`), and MySQL/InnoDB's cascade
        // planner trips over that self-reference once there are enough rows
        // in play (confirmed against suite 3's seeded perf rows — deleting
        // `invoices` directly succeeds; deleting the company with those same
        // rows still attached throws `P2003`/1452 on `invoices_companyId_fkey`
        // even though it's declared CASCADE). Deleting invoices up front
        // sidesteps the planner entirely.
        label: 'invoice.deleteMany (works around a self-FK cascade limitation — see comment)',
        run: () => prisma.invoice.deleteMany({ where: { companyId } }),
      },
      {
        label: 'company.delete (cascades branches/accounts/items/warehouses/settings/fiscal years/sequences)',
        run: () => prisma.company.delete({ where: { id: companyId } }),
      },
    ];

    for (const step of steps) {
      const result = await attempt(step.run);
      if (result.ok) {
        console.log(`  ✓ ${step.label}`);
      } else {
        const err = result.error;
        const meta = (err as { meta?: { field_name?: string; target?: string[] } })?.meta;
        const blockingField = meta?.field_name ?? (Array.isArray(meta?.target) ? meta?.target.join(', ') : undefined);
        console.error(`  ❌ ${step.label} FAILED${blockingField ? ` — blocked by: ${blockingField}` : ''}`);
        console.error(`     ${err instanceof Error ? err.message : String(err)}`);
        throw err;
      }
    }
  });

  const stillThere = await prisma.company.findUnique({ where: { id: companyId }, select: { id: true } });
  if (stillThere) {
    throw new Error(`Teardown completed without error but company ${companyId} still exists`);
  }
  console.log(`  Audit company ${companyId} fully removed.`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Suite 1 — GL & subledger invariants (read-only, real tenants)
// ─────────────────────────────────────────────────────────────────────────────

const SUITE1 = 'suite1';

async function suite1PerJeBalance(prisma: PrismaClient, companyFilter?: string): Promise<void> {
  subsection('Suite 1.1 — Per-entry double-entry balance (4dp)');

  const where: Prisma.JournalEntryWhereInput = {
    isPosted: true,
    isCancelled: false,
    deletedAt: null,
    ...(companyFilter ? { companyId: companyFilter } : {}),
  };

  let cursor: string | undefined;
  let scanned = 0;
  const offenders: Array<{ id: string; companyId: string; debit: number; credit: number; debitBase: number; creditBase: number }> = [];
  const PAGE = 500;

  for (;;) {
    const batch = await prisma.journalEntry.findMany({
      where,
      orderBy: { id: 'asc' },
      take: PAGE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      select: {
        id: true,
        companyId: true,
        lines: { select: { debit: true, credit: true, debitBase: true, creditBase: true } },
      },
    });
    if (batch.length === 0) break;

    for (const je of batch) {
      scanned += 1;
      let debit = 0;
      let credit = 0;
      let debitBase = 0;
      let creditBase = 0;
      for (const l of je.lines) {
        debit += Number(l.debit);
        credit += Number(l.credit);
        debitBase += Number(l.debitBase);
        creditBase += Number(l.creditBase);
      }
      if (!amountsEqualAt4(debit, credit) || !amountsEqualAt4(debitBase, creditBase)) {
        offenders.push({ id: je.id, companyId: je.companyId, debit, credit, debitBase, creditBase });
      }
    }

    cursor = batch[batch.length - 1].id;
    if (batch.length < PAGE) break;
  }

  check({
    suite: SUITE1,
    id: 'je-balance',
    severity: 'P0',
    title: `Every posted journal entry balances at 4dp (scanned ${scanned})`,
    pass: offenders.length === 0,
    expected: 'Σdebit === Σcredit and ΣdebitBase === ΣcreditBase for every posted, non-cancelled, non-deleted entry',
    actual: `${offenders.length} unbalanced entr${offenders.length === 1 ? 'y' : 'ies'} out of ${scanned} scanned`,
    detail: offenders
      .slice(0, 20)
      .map(
        (o) =>
          `JE ${o.id} (company ${o.companyId}): debit=${fmt(o.debit)} credit=${fmt(o.credit)} debitBase=${fmt(o.debitBase)} creditBase=${fmt(o.creditBase)}`
      )
      .join('; '),
  });
}

async function resolveAccountDefIds(
  prisma: PrismaClient,
  companyId: string,
  keys: string[]
): Promise<string[]> {
  const settings = await prisma.companySettings.findUnique({
    where: { companyId },
    select: { accountDefinitions: true },
  });
  const defs = (settings?.accountDefinitions ?? {}) as Record<string, string | undefined>;
  const codesOrIds = keys.map((k) => defs[k]).filter((v): v is string => !!v);
  if (codesOrIds.length === 0) return [];
  const rows = await prisma.account.findMany({
    where: { companyId, deletedAt: null, OR: [{ id: { in: codesOrIds } }, { code: { in: codesOrIds } }] },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

async function accountBalance(prisma: PrismaClient, accountId: string): Promise<number> {
  const agg = await prisma.journalEntryLine.aggregate({
    where: { accountId, journalEntry: { isPosted: true, isCancelled: false, deletedAt: null } },
    _sum: { debitBase: true, creditBase: true },
  });
  return Number(agg._sum.debitBase ?? 0) - Number(agg._sum.creditBase ?? 0);
}

async function suite1PartySubledger(prisma: PrismaClient, companyFilter?: string): Promise<void> {
  subsection('Suite 1.2 — Per-party subledger vs GL sub-account vs party balance');

  const EPS = 0.01;
  const companies = await prisma.company.findMany({
    where: { isActive: true, ...(companyFilter ? { id: companyFilter } : {}) },
    select: { id: true, englishName: true, arabicName: true },
  });

  const customerDrifts: Array<{ companyId: string; partyId: string; name: string; gl: number; invoices: number; balance: number }> = [];
  const supplierDrifts: Array<{ companyId: string; partyId: string; name: string; gl: number; invoices: number; balance: number }> = [];

  for (const company of companies) {
    const customers = await prisma.customer.findMany({
      where: { companyId: company.id, deletedAt: null },
      select: { id: true, arabicName: true, englishName: true, mainAccountId: true, accountId: true, balance: true },
    });
    for (const cust of customers) {
      const acctIds = [...new Set([cust.mainAccountId, cust.accountId].filter((x): x is string => !!x))];
      if (acctIds.length === 0) continue;
      let gl = 0;
      for (const id of acctIds) gl += await accountBalance(prisma, id);

      const openInvoices = await prisma.invoice.aggregate({
        where: {
          companyId: company.id,
          customerId: cust.id,
          isPosted: true,
          isCancelled: false,
          invoiceKind: { in: ['SALE', 'PURCHASE_RETURN'] },
        },
        _sum: { remainingAmount: true },
      });
      const invoiceSum = Number(openInvoices._sum.remainingAmount ?? 0);
      const balance = Number(cust.balance);

      if (Math.abs(gl - invoiceSum) > EPS || Math.abs(gl - balance) > EPS) {
        customerDrifts.push({
          companyId: company.id,
          partyId: cust.id,
          name: cust.englishName || cust.arabicName,
          gl,
          invoices: invoiceSum,
          balance,
        });
      }
    }

    const suppliers = await prisma.supplier.findMany({
      where: { companyId: company.id },
      select: { id: true, arabicName: true, englishName: true, mainAccountId: true, accountId: true, balance: true },
    });
    for (const sup of suppliers) {
      const acctIds = [...new Set([sup.mainAccountId, sup.accountId].filter((x): x is string => !!x))];
      if (acctIds.length === 0) continue;
      let glRaw = 0;
      for (const id of acctIds) glRaw += await accountBalance(prisma, id);
      const gl = -glRaw; // liability account: natural credit balance shows as negative debit-credit

      const openInvoices = await prisma.invoice.aggregate({
        where: {
          companyId: company.id,
          supplierId: sup.id,
          isPosted: true,
          isCancelled: false,
          invoiceKind: { in: ['PURCHASE', 'SALE_RETURN'] },
        },
        _sum: { remainingAmount: true },
      });
      const invoiceSum = Number(openInvoices._sum.remainingAmount ?? 0);
      const balance = Number(sup.balance);

      if (Math.abs(gl - invoiceSum) > EPS || Math.abs(gl - balance) > EPS) {
        supplierDrifts.push({
          companyId: company.id,
          partyId: sup.id,
          name: sup.englishName || sup.arabicName,
          gl,
          invoices: invoiceSum,
          balance,
        });
      }
    }
  }

  customerDrifts.sort((a, b) => Math.abs(b.gl - b.invoices) - Math.abs(a.gl - a.invoices));
  supplierDrifts.sort((a, b) => Math.abs(b.gl - b.invoices) - Math.abs(a.gl - a.invoices));

  check({
    suite: SUITE1,
    id: 'ar-subledger',
    severity: 'P1',
    title: 'Every customer sub-account ties to open-invoice sum and Customer.balance',
    pass: customerDrifts.length === 0,
    expected: 'GL sub-account balance === Σ open SALE/PURCHASE_RETURN remainingAmount === Customer.balance (±0.01)',
    actual: `${customerDrifts.length} customer(s) with drift`,
    detail: customerDrifts
      .slice(0, 10)
      .map((d) => `${d.name} (${d.partyId}): GL=${fmt(d.gl)} invoices=${fmt(d.invoices)} balance=${fmt(d.balance)}`)
      .join('; '),
  });

  check({
    suite: SUITE1,
    id: 'ap-subledger',
    severity: 'P1',
    title: 'Every supplier sub-account ties to open-invoice sum and Supplier.balance',
    pass: supplierDrifts.length === 0,
    expected: '-(GL sub-account balance) === Σ open PURCHASE/SALE_RETURN remainingAmount === Supplier.balance (±0.01)',
    actual: `${supplierDrifts.length} supplier(s) with drift`,
    detail: supplierDrifts
      .slice(0, 10)
      .map((d) => `${d.name} (${d.partyId}): GL=${fmt(d.gl)} invoices=${fmt(d.invoices)} balance=${fmt(d.balance)}`)
      .join('; '),
  });
}

async function suite1InventoryValuation(prisma: PrismaClient, companyFilter?: string): Promise<void> {
  subsection('Suite 1.3 — Inventory valuation vs GL, rolled up per resolved inventory account');

  const EPS = 0.5; // rounding across many items is looser than a single-account check
  const companies = await prisma.company.findMany({
    where: { isActive: true, ...(companyFilter ? { id: companyFilter } : {}) },
    select: { id: true },
  });

  const drifts: Array<{ companyId: string; accountId: string; stockValue: number; glBalance: number }> = [];
  // (companyId, accountId) -> Σ qty × latest cost, accumulated across every
  // item that resolves to that account before diffing against its GL balance.
  const stockValueByCompanyAccount = new Map<string, number>();

  for (const company of companies) {
    const defaultInvAccountIds = await resolveAccountDefIds(prisma, company.id, [
      'defaultInventoryAccountId',
      'inventoryAccount',
      'stockAccount',
    ]);
    const codeAccount = await prisma.account.findFirst({
      where: { companyId: company.id, code: SYSTEM_GL_CODES.inventory, deletedAt: null },
      select: { id: true },
    });
    const fallbackInvAccountId = defaultInvAccountIds[0] ?? codeAccount?.id ?? null;

    const items = await prisma.item.findMany({
      where: { companyId: company.id },
      select: { id: true, mainAccountId: true },
    });
    const accountByItem = new Map<string, string>();
    for (const it of items) {
      const acctId = it.mainAccountId ?? fallbackInvAccountId;
      if (acctId) accountByItem.set(it.id, acctId);
    }
    if (accountByItem.size === 0) continue;

    const itemIds = [...accountByItem.keys()];
    const BATCH = 200;
    for (let i = 0; i < itemIds.length; i += BATCH) {
      const batch = itemIds.slice(i, i + BATCH);
      const quantities = await prisma.itemQuantity.findMany({
        where: { itemId: { in: batch } },
        select: { itemId: true, quantity: true },
      });
      const qtyByItem = new Map<string, number>();
      for (const q of quantities) {
        qtyByItem.set(q.itemId, (qtyByItem.get(q.itemId) ?? 0) + Number(q.quantity));
      }
      const latestCosts = await prisma.itemCostHistory.findMany({
        where: { companyId: company.id, itemId: { in: batch } },
        orderBy: { serial: 'desc' },
        distinct: ['itemId'],
        select: { itemId: true, cost: true },
      });
      const costByItem = new Map(latestCosts.map((c) => [c.itemId, Number(c.cost)]));

      for (const itemId of batch) {
        const qty = qtyByItem.get(itemId) ?? 0;
        const cost = costByItem.get(itemId) ?? 0;
        const accountId = accountByItem.get(itemId);
        if (!accountId || qty === 0) continue;
        const key = `${company.id}|${accountId}`;
        stockValueByCompanyAccount.set(key, (stockValueByCompanyAccount.get(key) ?? 0) + qty * cost);
      }
    }
  }

  for (const [key, stockValue] of stockValueByCompanyAccount) {
    const [companyId, accountId] = key.split('|');
    const glBalance = await accountBalance(prisma, accountId);
    if (Math.abs(stockValue - glBalance) > EPS) {
      drifts.push({ companyId, accountId, stockValue, glBalance });
    }
  }

  check({
    suite: SUITE1,
    id: 'inventory-valuation',
    severity: 'P1',
    title: 'Inventory GL account balance ties to Σ qty × latest moving-average cost, per resolved account',
    pass: drifts.length === 0,
    expected: 'Σ ItemQuantity.quantity × latest ItemCostHistory.cost === Σ(debitBase - creditBase) per inventory account (±0.50)',
    actual: `${drifts.length} account(s) with drift`,
    detail: drifts
      .map((d) => `company ${d.companyId} account ${d.accountId}: stock=${fmt(d.stockValue)} gl=${fmt(d.glBalance)}`)
      .join('; '),
  });
}

async function suite1DanglingReferences(prisma: PrismaClient, companyFilter?: string): Promise<void> {
  subsection('Suite 1.4 — Dangling-reference scans');

  const companyWhere = companyFilter ? { companyId: companyFilter } : {};

  // (a) Posted JE flagged cancelled/soft-deleted — per the C11 invariant, a
  // posted entry should only ever be neutralized via a reversal, never by
  // flipping isCancelled/deletedAt back onto a still-"posted" row.
  const postedButVoided = await prisma.journalEntry.findMany({
    where: { ...companyWhere, isPosted: true, OR: [{ isCancelled: true }, { deletedAt: { not: null } }] },
    select: { id: true, companyId: true },
    take: 50,
  });
  check({
    suite: SUITE1,
    id: 'je-posted-but-voided',
    severity: 'P1',
    title: 'No journal entry is simultaneously isPosted=true and isCancelled/deletedAt set',
    pass: postedButVoided.length === 0,
    expected: 'Posted entries are reversed via contra JE, never flag-flipped to cancelled/deleted while isPosted stays true',
    actual: `${postedButVoided.length} offending entr${postedButVoided.length === 1 ? 'y' : 'ies'}`,
    detail: postedButVoided.map((r) => r.id).join(', '),
  });

  // (b) InventoryMovement rows with a null/blank sourceType or sourceNumber.
  const sourcelessMovements = await prisma.inventoryMovement.findMany({
    where: {
      ...companyWhere,
      OR: [{ sourceType: null }, { sourceType: '' }, { sourceNumber: null }, { sourceNumber: '' }],
    },
    select: { id: true },
    take: 50,
  });
  check({
    suite: SUITE1,
    id: 'movement-sourceless',
    severity: 'P2',
    title: 'Every InventoryMovement carries a non-blank sourceType/sourceNumber',
    pass: sourcelessMovements.length === 0,
    expected: 'sourceType and sourceNumber are always populated for traceability',
    actual: `${sourcelessMovements.length} movement(s) with null/blank source fields`,
    detail: sourcelessMovements.map((r) => r.id).join(', '),
  });

  // (c) ItemCostHistory rows with no matching InventoryMovement on the same
  // (sourceType, sourceNumber, sourceYearId, companyId) triple.
  const costRows = await prisma.itemCostHistory.findMany({
    where: companyWhere,
    select: { id: true, companyId: true, sourceType: true, sourceNumber: true, sourceYearId: true },
    take: 5000,
  });
  const unmatchedCostRows: string[] = [];
  const BATCH = 200;
  for (let i = 0; i < costRows.length; i += BATCH) {
    const batch = costRows.slice(i, i + BATCH);
    const matches = await prisma.inventoryMovement.findMany({
      where: {
        OR: batch.map((r) => ({
          companyId: r.companyId,
          sourceType: r.sourceType,
          sourceNumber: r.sourceNumber,
          sourceYearId: r.sourceYearId,
        })),
      },
      select: { companyId: true, sourceType: true, sourceNumber: true, sourceYearId: true },
    });
    const matchKeys = new Set(matches.map((m) => `${m.companyId}|${m.sourceType}|${m.sourceNumber}|${m.sourceYearId}`));
    for (const r of batch) {
      const key = `${r.companyId}|${r.sourceType}|${r.sourceNumber}|${r.sourceYearId}`;
      if (!matchKeys.has(key)) unmatchedCostRows.push(r.id);
    }
  }
  check({
    suite: SUITE1,
    id: 'cost-history-unmatched',
    severity: 'P2',
    title: 'Every ItemCostHistory row has a matching InventoryMovement on (sourceType, sourceNumber, sourceYearId)',
    pass: unmatchedCostRows.length === 0,
    expected: 'Every moving-average cost snapshot corresponds to a real stock movement',
    actual: `${unmatchedCostRows.length} unmatched cost-history row(s) (of ${costRows.length} sampled)`,
    detail: unmatchedCostRows.slice(0, 20).join(', '),
  });

  // (d) PaymentAllocation rows pointing at cancelled invoices.
  const allocationsOnCancelled = await prisma.paymentAllocation.findMany({
    where: { ...companyWhere, invoice: { isCancelled: true } },
    select: { id: true, invoiceId: true },
    take: 50,
  });
  check({
    suite: SUITE1,
    id: 'allocation-on-cancelled-invoice',
    severity: 'P1',
    title: 'No PaymentAllocation references a cancelled invoice',
    pass: allocationsOnCancelled.length === 0,
    expected: 'Cancelling an invoice tears down or blocks on its active allocations',
    actual: `${allocationsOnCancelled.length} allocation(s) pointing at a cancelled invoice`,
    detail: allocationsOnCancelled.map((r) => `allocation ${r.id} -> invoice ${r.invoiceId}`).join('; '),
  });

  // Invoices where paidAmount + remainingAmount != netAmount at 4dp.
  let invCursor: string | undefined;
  const invoiceDrift: string[] = [];
  let invoicesScanned = 0;
  for (;;) {
    const batch = await prisma.invoice.findMany({
      where: companyWhere,
      orderBy: { id: 'asc' },
      take: 500,
      ...(invCursor ? { skip: 1, cursor: { id: invCursor } } : {}),
      select: { id: true, paidAmount: true, remainingAmount: true, netAmount: true },
    });
    if (batch.length === 0) break;
    for (const inv of batch) {
      invoicesScanned += 1;
      const paid = Number(inv.paidAmount);
      const remaining = Number(inv.remainingAmount);
      const net = Number(inv.netAmount);
      if (!amountsEqualAt4(paid + remaining, net)) {
        invoiceDrift.push(`${inv.id} (paid=${fmt(paid)} remaining=${fmt(remaining)} net=${fmt(net)})`);
      }
    }
    invCursor = batch[batch.length - 1].id;
    if (batch.length < 500) break;
  }
  check({
    suite: SUITE1,
    id: 'invoice-paid-remaining-net',
    severity: 'P1',
    title: `Every invoice satisfies paidAmount + remainingAmount === netAmount at 4dp (scanned ${invoicesScanned})`,
    pass: invoiceDrift.length === 0,
    expected: 'paidAmount + remainingAmount === netAmount for every invoice',
    actual: `${invoiceDrift.length} invoice(s) with drift`,
    detail: invoiceDrift.slice(0, 20).join('; '),
  });

  // (e) Posted JEs with zero lines, or sourceType set with null activeSourceKey,
  // or two posted JEs sharing one activeSourceKey (defensive — DB unique index
  // should already prevent this).
  const postedWithZeroLines = await prisma.journalEntry.findMany({
    where: { ...companyWhere, isPosted: true, isCancelled: false, deletedAt: null },
    select: { id: true, _count: { select: { lines: true } } },
  });
  const zeroLineIds = postedWithZeroLines.filter((je) => je._count.lines === 0).map((je) => je.id);
  check({
    suite: SUITE1,
    id: 'je-zero-lines',
    severity: 'P0',
    title: 'No posted, non-cancelled journal entry has zero lines',
    pass: zeroLineIds.length === 0,
    expected: 'Every posted entry has at least one line',
    actual: `${zeroLineIds.length} posted entr${zeroLineIds.length === 1 ? 'y' : 'ies'} with zero lines`,
    detail: zeroLineIds.slice(0, 20).join(', '),
  });

  const missingActiveKey = await prisma.journalEntry.findMany({
    where: { ...companyWhere, isPosted: true, isCancelled: false, deletedAt: null, sourceType: { not: null }, activeSourceKey: null },
    select: { id: true, sourceType: true, sourceNumber: true },
    take: 50,
  });
  check({
    suite: SUITE1,
    id: 'je-missing-active-source-key',
    severity: 'P1',
    title: 'Every active (posted, non-cancelled) source-linked JE has activeSourceKey populated',
    pass: missingActiveKey.length === 0,
    expected: 'activeSourceKey is set whenever sourceType is set on an active entry',
    actual: `${missingActiveKey.length} entr${missingActiveKey.length === 1 ? 'y' : 'ies'} missing activeSourceKey`,
    detail: missingActiveKey.map((r) => `${r.id} (${r.sourceType} ${r.sourceNumber})`).join('; '),
  });

  const dupKeys = await prisma.journalEntry.groupBy({
    by: ['activeSourceKey'],
    where: { ...companyWhere, activeSourceKey: { not: null } },
    _count: { activeSourceKey: true },
    having: { activeSourceKey: { _count: { gt: 1 } } },
  });
  check({
    suite: SUITE1,
    id: 'je-duplicate-active-source-key',
    severity: 'P0',
    title: 'No two posted JEs share one activeSourceKey (defensive check against the DB unique index)',
    pass: dupKeys.length === 0,
    expected: 'activeSourceKey is unique across all journal entries',
    actual: `${dupKeys.length} duplicate key(s)`,
    detail: dupKeys.map((d) => d.activeSourceKey).join(', '),
  });
}

async function runSuite1(prisma: PrismaClient, companyFilter?: string): Promise<void> {
  section('SUITE 1 — GL & subledger invariants (read-only, real tenants)');
  await suite1PerJeBalance(prisma, companyFilter);
  await suite1PartySubledger(prisma, companyFilter);
  await suite1InventoryValuation(prisma, companyFilter);
  await suite1DanglingReferences(prisma, companyFilter);
}

// ─────────────────────────────────────────────────────────────────────────────
// Suite 2 — High-contention concurrency (runs inside the audit company)
// ─────────────────────────────────────────────────────────────────────────────

const SUITE2 = 'suite2';

async function suite2StockExhaustion(
  prisma: PrismaClient,
  ctx: AuditCompanyContext,
  stockMovementService: {
    postMovement: (input: {
      companyId: string;
      branchId?: string;
      warehouseId: string;
      itemId: string;
      quantityDelta: number;
      movementType: string;
      sourceType?: string;
      sourceNumber?: string;
      sourceYearId?: string;
      documentDate: Date;
    }) => Promise<{ movement: { id: string }; quantityOnHand: number }>;
  }
): Promise<void> {
  subsection('Suite 2.1 — Stock exhaustion under 10-way contention');

  // Isolate a dedicated item/warehouse pair for this test by seeding a fresh
  // qty=1 row (rather than reusing the shared demo item, which other suites
  // may also touch and whose starting quantity is not guaranteed to be 1).
  const testItem = await prisma.item.create({
    data: {
      companyId: ctx.companyId,
      serial: `PARANOIA-STOCK-${randomUUID().slice(0, 8)}`,
      arabicName: 'صنف اختبار المخزون',
      englishName: 'Stock Exhaustion Test Item',
      mainAccountId: ctx.inventoryAccountId,
      itemType: 'normal',
      isActive: true,
    },
  });
  await prisma.itemQuantity.create({
    data: { itemId: testItem.id, warehouseId: ctx.warehouseId, locationId: null, quantity: 1 },
  });

  const CONCURRENCY = 10;
  const results = await Promise.allSettled(
    Array.from({ length: CONCURRENCY }, (_, i) =>
      stockMovementService.postMovement({
        companyId: ctx.companyId,
        branchId: ctx.branchId,
        warehouseId: ctx.warehouseId,
        itemId: testItem.id,
        quantityDelta: -1,
        movementType: 'PARANOIA-TEST',
        sourceType: 'PARANOIA-TEST',
        sourceNumber: `STOCK-${i}`,
        sourceYearId: '2026',
        documentDate: new Date(),
      })
    )
  );

  const fulfilled = results.filter((r) => r.status === 'fulfilled');
  const rejected = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];

  check({
    suite: SUITE2,
    id: 'stock-exhaustion-count',
    severity: 'P0',
    title: `Exactly 1 of ${CONCURRENCY} concurrent -1 movements against a 1-unit item succeeds`,
    pass: fulfilled.length === 1 && rejected.length === CONCURRENCY - 1,
    expected: `1 fulfilled, ${CONCURRENCY - 1} rejected`,
    actual: `${fulfilled.length} fulfilled, ${rejected.length} rejected`,
  });

  const finalQty = await prisma.itemQuantity.findFirst({
    where: { itemId: testItem.id, warehouseId: ctx.warehouseId, locationId: null },
    select: { quantity: true },
  });
  check({
    suite: SUITE2,
    id: 'stock-exhaustion-final-qty',
    severity: 'P0',
    title: 'Final on-hand quantity is exactly 0 — no over-issue and no double-decrement',
    pass: Number(finalQty?.quantity ?? -1) === 0,
    expected: '0',
    actual: String(finalQty?.quantity ?? '(row missing)'),
  });

  const malformedRejections = rejected.filter((r) => {
    const err = r.reason;
    return !(err instanceof Error) || !/Negative stock not allowed/i.test(err.message);
  });
  check({
    suite: SUITE2,
    id: 'stock-exhaustion-rejection-shape',
    severity: 'P3',
    title: 'Every rejection is the expected "Negative stock not allowed" Error',
    pass: malformedRejections.length === 0,
    expected: 'All 9 rejections are plain Error("Negative stock not allowed for item ...")',
    actual: `${malformedRejections.length} rejection(s) with an unexpected shape`,
  });

  const hasStatusCode = rejected.some((r) => r.reason instanceof AppError);
  info(
    SUITE2,
    'stock-exhaustion-unstructured-error',
    'P2',
    'Negative-stock rejection is a bare Error, not a structured AppError/error code',
    hasStatusCode
      ? 'Unexpectedly found a structured AppError — re-check stock-movement.service.ts, this finding may be stale.'
      : `stockMovementService.assertNegativeStockAllowed() throws \`new Error(...)\` with no statusCode. ` +
          `Every other domain-rejection path in the codebase throws AppError(4xx, message) so the HTTP layer maps it ` +
          `to a clean 4xx; this one currently falls through to the generic 500 handler in error-handler.ts. ` +
          `Recommendation: throw \`new AppError(409, ...)\` (conflict — a concurrent writer already consumed the stock) instead.`
  );

  await prisma.item.delete({ where: { id: testItem.id } }).catch(() => undefined);
}

async function suite2SequenceMonotonicity(
  prisma: PrismaClient,
  ctx: AuditCompanyContext,
  documentSequenceService: {
    nextNumber: (input: {
      companyId: string;
      branchId: string | null;
      fiscalYearId: string | null;
      docType: string;
      scope?: 'C' | 'Y';
      padding?: number;
    }) => Promise<string>;
    nextNumberInTx: (
      tx: Prisma.TransactionClient,
      input: {
        companyId: string;
        branchId: string | null;
        fiscalYearId: string | null;
        docType: string;
        scope?: 'C' | 'Y';
        padding?: number;
      }
    ) => Promise<string>;
  }
): Promise<void> {
  subsection('Suite 2.2 — Sequence-number monotonicity under contention');

  const N = 25;

  const viaNextNumber = await Promise.allSettled(
    Array.from({ length: N }, () =>
      documentSequenceService.nextNumber({
        companyId: ctx.companyId,
        branchId: ctx.branchId,
        fiscalYearId: ctx.fiscalYearId,
        docType: 'PARANOIA-SEQ-A',
        scope: 'Y',
        padding: 8,
      })
    )
  );
  const numbersA = viaNextNumber.filter((r) => r.status === 'fulfilled').map((r) => (r as PromiseFulfilledResult<string>).value);
  const expectedA = Array.from({ length: N }, (_, i) => String(i + 1).padStart(8, '0'));
  const sortedA = [...numbersA].sort();
  const hasDuplicatesA = new Set(numbersA).size !== numbersA.length;
  check({
    suite: SUITE2,
    id: 'sequence-monotonic-nextnumber',
    severity: 'P0',
    title: `${N} concurrent nextNumber() calls yield a gapless, collision-free 1..${N} sequence`,
    pass: numbersA.length === N && JSON.stringify(sortedA) === JSON.stringify(expectedA),
    expected: expectedA.join(', '),
    actual: `${numbersA.length} succeeded (${hasDuplicatesA ? 'DUPLICATES PRESENT' : 'no duplicates'}): ${sortedA.join(', ')}`,
    detail: numbersA.length < N ? summarizeRejections(viaNextNumber) : undefined,
  });

  // Models a realistic caller of `nextNumberInTx`: it *owns* the
  // transaction it hands in (exactly like an invoice-posting flow would),
  // so on a genuine InnoDB deadlock/lock-wait — the documented, expected
  // outcome when many transactions race to `INSERT` the very first row for
  // a brand-new sequence key — it retries the whole transaction from
  // scratch rather than treating the deadlock as a correctness failure.
  const viaTx = await Promise.allSettled(
    Array.from({ length: N }, () =>
      withDeadlockRetry(() =>
        prisma.$transaction((tx) =>
          documentSequenceService.nextNumberInTx(tx, {
            companyId: ctx.companyId,
            branchId: ctx.branchId,
            fiscalYearId: ctx.fiscalYearId,
            docType: 'PARANOIA-SEQ-B',
            scope: 'Y',
            padding: 8,
          })
        )
      )
    )
  );
  const numbersB = viaTx.filter((r) => r.status === 'fulfilled').map((r) => (r as PromiseFulfilledResult<string>).value);
  const sortedB = [...numbersB].sort();
  const hasDuplicatesB = new Set(numbersB).size !== numbersB.length;
  check({
    suite: SUITE2,
    id: 'sequence-monotonic-nextnumbertx',
    severity: 'P0',
    title: `${N} concurrent nextNumberInTx() calls (SELECT ... FOR UPDATE path) yield the same gapless sequence`,
    pass: numbersB.length === N && JSON.stringify(sortedB) === JSON.stringify(expectedA),
    expected: expectedA.join(', '),
    actual: `${numbersB.length} succeeded (${hasDuplicatesB ? 'DUPLICATES PRESENT' : 'no duplicates'}): ${sortedB.join(', ')}`,
    detail: numbersB.length < N ? summarizeRejections(viaTx) : undefined,
  });
}

/** Retries a transaction-owning callback on transient InnoDB deadlock/lock-wait/rollback symptoms, mirroring how a well-behaved posting flow should call `nextNumberInTx`. */
async function withDeadlockRetry<T>(fn: () => Promise<T>, maxAttempts = 8): Promise<T> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const retryable = /deadlock found|lock wait timeout|record.*not found|required but not found/i.test(msg);
      if (!retryable || attempt === maxAttempts - 1) throw err;
      await new Promise((resolve) => setTimeout(resolve, 10 + Math.random() * 40));
    }
  }
  throw new Error('unreachable');
}

/** Groups settled-promise rejection reasons by message so a batch failure shows one line per distinct cause instead of N duplicate stack traces. */
function summarizeRejections(results: PromiseSettledResult<unknown>[]): string {
  const counts = new Map<string, number>();
  for (const r of results) {
    if (r.status !== 'rejected') continue;
    const reason = r.reason;
    const msg = reason instanceof Error ? `${reason.name}: ${reason.message}` : String(reason);
    counts.set(msg, (counts.get(msg) ?? 0) + 1);
  }
  return [...counts.entries()].map(([msg, count]) => `${count}x ${msg}`).join(' | ');
}

async function runSuite2(
  prisma: PrismaClient,
  ctx: AuditCompanyContext,
  services: {
    stockMovementService: Parameters<typeof suite2StockExhaustion>[2];
    documentSequenceService: Parameters<typeof suite2SequenceMonotonicity>[2];
  }
): Promise<void> {
  section('SUITE 2 — High-contention concurrency');
  await runWithTenantContext(ctx.companyId, async () => {
    await suite2StockExhaustion(prisma, ctx, services.stockMovementService);
    await suite2SequenceMonotonicity(prisma, ctx, services.documentSequenceService);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Suite 3 — Query & performance sanity
// ─────────────────────────────────────────────────────────────────────────────

const SUITE3 = 'suite3';

interface ExplainRow {
  table_name?: string;
  access_type?: string;
  key?: string | null;
  rows_examined_per_scan?: number;
  rows_produced_per_join?: number;
  filtered?: string;
  using_filesort?: boolean;
  using_temporary_table?: boolean;
  [key: string]: unknown;
}

/** Recursively walks a MySQL EXPLAIN FORMAT=JSON tree collecting every `table` node. */
function collectExplainTables(node: unknown, out: ExplainRow[] = []): ExplainRow[] {
  if (!node || typeof node !== 'object') return out;
  const obj = node as Record<string, unknown>;
  if (obj.table && typeof obj.table === 'object') {
    out.push(obj.table as ExplainRow);
  }
  for (const value of Object.values(obj)) {
    if (value && typeof value === 'object') collectExplainTables(value, out);
  }
  return out;
}

async function explainOne(
  prisma: PrismaClient,
  label: string,
  runExplain: () => Promise<Array<Record<string, unknown>>>
): Promise<void> {
  const rows = await runExplain();
  const raw = rows[0] ? Object.values(rows[0])[0] : undefined;
  if (typeof raw !== 'string') {
    check({
      suite: SUITE3,
      id: `explain-${label}`,
      severity: 'P3',
      title: `EXPLAIN FORMAT=JSON returned a row for: ${label}`,
      pass: false,
      expected: 'A JSON string in the first column',
      actual: 'No row / unexpected shape',
    });
    return;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    check({
      suite: SUITE3,
      id: `explain-${label}`,
      severity: 'P3',
      title: `EXPLAIN FORMAT=JSON output for "${label}" parses as JSON`,
      pass: false,
      expected: 'Valid JSON',
      actual: 'JSON.parse failed',
    });
    return;
  }

  const tables = collectExplainTables(parsed);
  const problems: string[] = [];
  for (const t of tables) {
    const name = t.table_name ?? '(unknown)';
    if (t.access_type === 'ALL') problems.push(`${name}: access_type=ALL (full table scan)`);
    if (!t.key) problems.push(`${name}: key=null (no index used)`);
    if (t.using_filesort) problems.push(`${name}: Using filesort`);
    if (t.using_temporary_table) problems.push(`${name}: Using temporary`);
    const filteredPct = t.filtered ? parseFloat(t.filtered) : 100;
    const examined = Number(t.rows_examined_per_scan ?? 0);
    if (examined > 1000 && filteredPct < 10) {
      problems.push(`${name}: examines ${examined} rows but filters down to ${filteredPct}% — bad selectivity`);
    }
  }

  check({
    suite: SUITE3,
    id: `explain-${label}`,
    severity: 'P2',
    title: `Query plan for "${label}" avoids full scans / filesorts / temp tables`,
    pass: problems.length === 0,
    expected: 'Every table access uses an index; no filesort/temporary table; reasonable selectivity',
    actual: problems.length === 0 ? 'clean plan' : problems.join('; '),
  });
}

async function suite3ExplainAllowlist(prisma: PrismaClient): Promise<void> {
  subsection('Suite 3.1 — EXPLAIN FORMAT=JSON over a representative statement allowlist');

  // Bound as real query parameters (never string-interpolated) so this also
  // doubles as a SQL-injection-shape sanity check on the query builder itself.
  const dummyId = randomUUID();
  const dummyDate = new Date();

  await explainOne(prisma, 'invoices-ar-aging', () =>
    prisma.$queryRaw<Array<Record<string, unknown>>>`
      EXPLAIN FORMAT=JSON
      SELECT id FROM invoices
      WHERE companyId = ${dummyId} AND isPosted = 1 AND isCancelled = 0 AND dueDate <= ${dummyDate}
      ORDER BY dueDate LIMIT 50
    `
  );

  await explainOne(prisma, 'invoices-open-balance-listing', () =>
    prisma.$queryRaw<Array<Record<string, unknown>>>`
      EXPLAIN FORMAT=JSON
      SELECT id FROM invoices
      WHERE companyId = ${dummyId} AND invoiceKind = 'SALE' AND isPosted = 1 AND isCancelled = 0 AND remainingAmount > 0
      ORDER BY remainingAmount DESC LIMIT 50
    `
  );

  await explainOne(prisma, 'journal-entries-by-fiscal-year', () =>
    prisma.$queryRaw<Array<Record<string, unknown>>>`
      EXPLAIN FORMAT=JSON
      SELECT id FROM journal_entries
      WHERE companyId = ${dummyId} AND fiscalYearId = ${dummyId} AND isPosted = 1
      ORDER BY date DESC LIMIT 50
    `
  );

  await explainOne(prisma, 'journal-entries-by-posting-status', () =>
    prisma.$queryRaw<Array<Record<string, unknown>>>`
      EXPLAIN FORMAT=JSON
      SELECT id FROM journal_entries
      WHERE companyId = ${dummyId} AND postingStatus = 'Post' LIMIT 50
    `
  );

  await explainOne(prisma, 'payment-allocations-by-invoice', () =>
    prisma.$queryRaw<Array<Record<string, unknown>>>`
      EXPLAIN FORMAT=JSON
      SELECT id FROM payment_allocations
      WHERE companyId = ${dummyId} AND invoiceId = ${dummyId} LIMIT 50
    `
  );

  await explainOne(prisma, 'inventory-movements-by-item', () =>
    prisma.$queryRaw<Array<Record<string, unknown>>>`
      EXPLAIN FORMAT=JSON
      SELECT id FROM inventory_movements
      WHERE companyId = ${dummyId} AND warehouseId = ${dummyId} AND itemId = ${dummyId}
      ORDER BY documentDate DESC LIMIT 50
    `
  );
}

/** `@@index`/`@@unique` declarations from schema.prisma for the four tables this suite covers. */
const DECLARED_INDEXES: Record<string, string[][]> = {
  journal_entries: [
    ['companyId', 'branchId', 'fiscalYearId', 'legacyGlNum'],
    ['activeSourceKey'],
    ['companyId', 'date'],
    ['companyId', 'fiscalYearId', 'isPosted', 'date'],
    ['companyId', 'postingStatus'],
    ['voucherNumber'],
    ['companyId', 'isPosted', 'isApproved'],
  ],
  invoices: [
    ['companyId', 'branchId', 'fiscalYearId', 'invoiceType', 'invoiceNumber'],
    ['companyId', 'date'],
    ['invoiceNumber'],
    ['invoiceType'],
    ['companyId', 'branchId', 'isPosted', 'invoiceType', 'date'],
    ['companyId', 'isPosted', 'isApproved'],
    ['companyId', 'isPosted', 'isCancelled', 'dueDate'],
    ['companyId', 'invoiceKind', 'isPosted', 'isCancelled', 'remainingAmount'],
  ],
  payment_allocations: [
    ['companyId', 'invoiceId'],
    ['cashTransactionId'],
    ['counterpartyOffsetId'],
  ],
  inventory_movements: [
    ['companyId', 'itemId', 'effectiveAt'],
    ['companyId', 'warehouseId', 'itemId'],
    ['companyId', 'warehouseId', 'itemId', 'documentDate'],
  ],
};

async function suite3IndexDiff(prisma: PrismaClient): Promise<void> {
  subsection('Suite 3.2 — information_schema.STATISTICS vs @@index declarations');

  const tables = Object.keys(DECLARED_INDEXES);
  // `SEQ_IN_INDEX` comes back from MySQL as a BigInt via the raw-query driver
  // (it's declared BIGINT in information_schema) — must be coerced to Number
  // before any arithmetic, or `bigint - 1` throws "Cannot mix BigInt and
  // other types".
  const rows = await prisma.$queryRaw<Array<{ TABLE_NAME: string; INDEX_NAME: string; COLUMN_NAME: string; SEQ_IN_INDEX: bigint | number }>>`
    SELECT TABLE_NAME, INDEX_NAME, COLUMN_NAME, SEQ_IN_INDEX
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (${Prisma.join(tables)})
    ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX
  `;

  const actualByTable = new Map<string, Map<string, string[]>>();
  for (const row of rows) {
    if (row.INDEX_NAME === 'PRIMARY') continue;
    if (!actualByTable.has(row.TABLE_NAME)) actualByTable.set(row.TABLE_NAME, new Map());
    const byIndex = actualByTable.get(row.TABLE_NAME)!;
    const cols = byIndex.get(row.INDEX_NAME) ?? [];
    cols[Number(row.SEQ_IN_INDEX) - 1] = row.COLUMN_NAME;
    byIndex.set(row.INDEX_NAME, cols);
  }

  for (const table of tables) {
    const declared = DECLARED_INDEXES[table];
    const actualIndexes = actualByTable.get(table) ?? new Map<string, string[]>();
    const actualTuples = [...actualIndexes.values()].map((cols) => cols.join(','));
    const declaredTuples = declared.map((cols) => cols.join(','));

    const missing = declaredTuples.filter((t) => !actualTuples.includes(t));
    const extra = actualTuples.filter((t) => !declaredTuples.includes(t));

    check({
      suite: SUITE3,
      id: `index-diff-${table}`,
      severity: 'P2',
      title: `${table}: DB indexes match schema.prisma @@index/@@unique declarations`,
      pass: missing.length === 0 && extra.length === 0,
      expected: `${declared.length} declared index(es): ${declaredTuples.join(' | ')}`,
      actual: `missing from DB: [${missing.join(' | ') || 'none'}]; undeclared in schema: [${extra.join(' | ') || 'none'}]`,
    });
  }
}

interface PaginatedTimingShape {
  label: string;
  run: () => Promise<unknown>;
}

async function suite3PaginatedTimings(prisma: PrismaClient, ctx: AuditCompanyContext, rows: number): Promise<void> {
  subsection(`Suite 3.3 — Paginated query timings after seeding ${rows.toLocaleString()} rows`);

  await seedPerfRows(prisma, ctx, rows);

  const shapes: PaginatedTimingShape[] = [
    {
      label: 'AR aging [companyId, isPosted, isCancelled, dueDate]',
      run: () =>
        prisma.invoice.findMany({
          where: { companyId: ctx.companyId, isPosted: true, isCancelled: false, dueDate: { lte: new Date() } },
          orderBy: { dueDate: 'asc' },
          take: 50,
        }),
    },
    {
      label: 'Open-invoice listing [companyId, invoiceKind, isPosted, isCancelled, remainingAmount]',
      run: () =>
        prisma.invoice.findMany({
          where: { companyId: ctx.companyId, invoiceKind: 'SALE', isPosted: true, isCancelled: false, remainingAmount: { gt: 0 } },
          orderBy: { remainingAmount: 'desc' },
          take: 50,
        }),
    },
    {
      label: 'Journal entry listing [companyId, fiscalYearId, isPosted, date]',
      run: () =>
        prisma.journalEntry.findMany({
          where: { companyId: ctx.companyId, fiscalYearId: ctx.fiscalYearId, isPosted: true },
          orderBy: { date: 'desc' },
          take: 50,
        }),
    },
    {
      label: 'Inventory movement listing [companyId, warehouseId, itemId, documentDate]',
      run: () =>
        prisma.inventoryMovement.findMany({
          where: { companyId: ctx.companyId, warehouseId: ctx.warehouseId, itemId: ctx.itemId },
          orderBy: { documentDate: 'desc' },
          take: 50,
        }),
    },
  ];

  const RUNS = 12;
  for (const shape of shapes) {
    await shape.run(); // warm-up — excluded from the sample
    const samples: number[] = [];
    for (let i = 0; i < RUNS; i++) {
      const { ms } = await timeIt(shape.run);
      samples.push(ms);
    }
    samples.sort((a, b) => a - b);
    const p50 = percentile(samples, 50);
    const p95 = percentile(samples, 95);
    check({
      suite: SUITE3,
      id: `timing-${shape.label.split(' ')[0].toLowerCase()}`,
      severity: 'P2',
      title: `${shape.label}: p95 < 100ms over ${RUNS} runs`,
      pass: p95 < 100,
      expected: 'p95 < 100ms',
      actual: `p50=${p50.toFixed(1)}ms p95=${p95.toFixed(1)}ms (samples: ${samples.map((s) => s.toFixed(1)).join(', ')})`,
    });
  }
}

async function seedPerfRows(prisma: PrismaClient, ctx: AuditCompanyContext, rows: number): Promise<void> {
  const CHUNK = 1000;
  const now = new Date();

  const cashTx = await prisma.cashTransaction.create({
    data: {
      companyId: ctx.companyId,
      branchId: ctx.branchId,
      fiscalYearId: ctx.fiscalYearId,
      transactionKind: 'RECEIPT',
      date: now,
      amount: 1,
      currencyCode: 'EGP',
      customerId: ctx.customerId,
      safeId: ctx.safeId,
      isPosted: true,
      description: 'PARANOIA-PERF-SEED',
    },
  });

  console.log(`  Seeding ${rows.toLocaleString()} rows each into invoice/journalEntry(+line)/inventoryMovement/paymentAllocation...`);
  for (let start = 0; start < rows; start += CHUNK) {
    const count = Math.min(CHUNK, rows - start);

    const invoiceData: Prisma.InvoiceCreateManyInput[] = Array.from({ length: count }, (_, i) => {
      const n = start + i;
      const due = new Date(now.getTime() - (n % 90) * 86_400_000);
      return {
        companyId: ctx.companyId,
        branchId: ctx.branchId,
        fiscalYearId: ctx.fiscalYearId,
        invoiceNumber: `PERF-${n}`,
        invoiceKind: 'SALE',
        invoiceType: 'sales',
        date: due,
        dueDate: due,
        currencyCode: 'EGP',
        exchangeRate: 1,
        customerId: ctx.customerId,
        warehouseId: ctx.warehouseId,
        totalAmount: 100,
        discountAmount: 0,
        taxAmount: 0,
        withholdingTaxAmount: 0,
        netAmount: 100,
        remainingAmount: n % 3 === 0 ? 0 : 100,
        isPosted: true,
        workflowStatus: 'POSTED',
        createdBy: 'paranoia-audit-seed',
      };
    });
    await prisma.invoice.createMany({ data: invoiceData });

    const jeIds = Array.from({ length: count }, () => randomUUID());
    const jeData: Prisma.JournalEntryCreateManyInput[] = jeIds.map((id) => ({
      id,
      companyId: ctx.companyId,
      branchId: ctx.branchId,
      fiscalYearId: ctx.fiscalYearId,
      date: now,
      currencyCode: 'EGP',
      isPosted: true,
      isBalanced: true,
      createdBy: 'paranoia-audit-seed',
    }));
    await prisma.journalEntry.createMany({ data: jeData });

    const lineData: Prisma.JournalEntryLineCreateManyInput[] = jeIds.map((journalEntryId) => ({
      journalEntryId,
      lineNumber: 1,
      accountId: ctx.arAccountId,
      debit: 100,
      credit: 0,
      debitBase: 100,
      creditBase: 0,
      lineOrder: 1,
    }));
    await prisma.journalEntryLine.createMany({ data: lineData });

    const movementData: Prisma.InventoryMovementCreateManyInput[] = Array.from({ length: count }, (_, i) => ({
      companyId: ctx.companyId,
      branchId: ctx.branchId,
      warehouseId: ctx.warehouseId,
      itemId: ctx.itemId,
      quantityDelta: 1,
      movementType: 'PARANOIA-PERF-SEED',
      sourceType: 'PARANOIA-PERF-SEED',
      sourceNumber: `PERF-${start + i}`,
      sourceYearId: '2026',
      documentDate: now,
    }));
    await prisma.inventoryMovement.createMany({ data: movementData });

    const invoiceIds = await prisma.invoice.findMany({
      where: { companyId: ctx.companyId, invoiceNumber: { in: invoiceData.map((d) => d.invoiceNumber as string) } },
      select: { id: true },
    });
    const allocationData: Prisma.PaymentAllocationCreateManyInput[] = invoiceIds.map((inv) => ({
      companyId: ctx.companyId,
      cashTransactionId: cashTx.id,
      invoiceId: inv.id,
      allocatedAmount: 1,
    }));
    await prisma.paymentAllocation.createMany({ data: allocationData });
  }
  console.log('  Seeding complete.');
}

async function runSuite3(prisma: PrismaClient, ctx: AuditCompanyContext | undefined, flags: Flags): Promise<void> {
  section('SUITE 3 — Query & performance sanity');
  await suite3ExplainAllowlist(prisma);
  await suite3IndexDiff(prisma);
  if (ctx && !flags.skipStress) {
    await runWithTenantContext(ctx.companyId, () => suite3PaginatedTimings(prisma, ctx, flags.rows));
  } else {
    console.log('  Skipping paginated-timing benchmark (--skip-stress or no audit company).');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Suite 4 — Lifecycle & edge-case traps (each expects a specific rejection;
// an unexpected success IS the finding)
// ─────────────────────────────────────────────────────────────────────────────

const SUITE4 = 'suite4';

interface Suite4Services {
  invoiceM5Service: {
    // `data` is intentionally `any`, not `unknown`: this interface only exists
    // to describe the *slice* of `invoiceM5Service` this suite calls, and the
    // real service's `create` takes a concrete literal input type — a
    // narrower (`unknown`) parameter would fail structural assignability
    // (function parameters are checked contravariantly).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    create: (companyId: string, branchId: string | undefined, fiscalYearId: string | undefined, data: any, userId?: string) => Promise<{ id: string; netAmount: unknown } | null>;
    cancel: (companyId: string, id: string, userId?: string) => Promise<unknown>;
    remove: (companyId: string, id: string) => Promise<unknown>;
  };
  invoicePostingOrchestrator: {
    post: (ctx: { companyId: string; branchId: string; fiscalYearId: string; userId: string }, invoiceId: string) => Promise<unknown>;
    unpost: (ctx: { companyId: string; branchId: string; fiscalYearId: string; userId: string }, invoiceId: string) => Promise<unknown>;
  };
  invoiceSettlementService: {
    settle: (
      ctx: { companyId: string; branchId: string; fiscalYearId: string; userId: string },
      invoiceId: string,
      input: { amount: number; safeId?: string; bankAccountId?: string }
    ) => Promise<unknown>;
  };
  chequeLifecycleService: {
    clearInwardCheque: (
      ctx: { companyId: string; branchId: string; fiscalYearId: string; userId: string },
      chequeId: string,
      bankAccountId: string
    ) => Promise<unknown>;
  };
  fiscalYearService: {
    assertOpenForDate: (companyId: string, date: Date) => Promise<string>;
  };
  journalPostingService: {
    createAndPostInTx: (
      tx: Prisma.TransactionClient,
      ctx: { companyId: string; branchId: string; fiscalYearId?: string; userId: string },
      data: {
        date: Date;
        currencyCode: string;
        fiscalYearId: string;
        sourceType?: string;
        sourceNumber?: string;
        sourceYearId?: string;
        lines: Array<{ accountId: string; debit: number; credit: number; lineOrder: number }>;
      }
    ) => Promise<unknown>;
  };
}

function expectAppError(
  result: { ok: true; value: unknown } | { ok: false; error: unknown },
  expectedStatus: number,
  expectedMessageSubstring?: string
): { pass: boolean; actual: string } {
  if (result.ok) {
    return { pass: false, actual: 'Call unexpectedly succeeded' };
  }
  const err = result.error;
  if (!(err instanceof AppError)) {
    return { pass: false, actual: `Threw a non-AppError: ${err instanceof Error ? err.message : String(err)}` };
  }
  if (err.statusCode !== expectedStatus) {
    return { pass: false, actual: `AppError with statusCode=${err.statusCode}, message="${err.message}"` };
  }
  if (expectedMessageSubstring && !err.message.includes(expectedMessageSubstring)) {
    return { pass: false, actual: `AppError ${err.statusCode} but message="${err.message}" does not contain "${expectedMessageSubstring}"` };
  }
  return { pass: true, actual: `AppError ${err.statusCode}: ${err.message}` };
}

async function suite4InvoiceCancelDeleteTraps(
  prisma: PrismaClient,
  ctx: AuditCompanyContext,
  services: Pick<Suite4Services, 'invoiceM5Service' | 'invoicePostingOrchestrator' | 'invoiceSettlementService'>
): Promise<void> {
  subsection('Suite 4.1 — Settled-invoice cancel and delete traps');

  const postCtx = { companyId: ctx.companyId, branchId: ctx.branchId, fiscalYearId: ctx.fiscalYearId, userId: 'paranoia-audit' };

  const invoice = await services.invoiceM5Service.create(
    ctx.companyId,
    ctx.branchId,
    ctx.fiscalYearId,
    {
      invoiceKind: 'SALE',
      date: new Date(),
      currencyCode: 'EGP',
      exchangeRate: 1,
      customerId: ctx.customerId,
      warehouseId: ctx.warehouseId,
      lines: [
        {
          itemId: ctx.itemId,
          unitId: ctx.unitId,
          quantity: 1,
          baseQuantity: 1,
          price: 100,
          lineOrder: 1,
        },
      ],
    },
    'paranoia-audit'
  );
  if (!invoice) throw new Error('Suite 4.1 fixture: invoiceM5Service.create() unexpectedly returned null');
  await services.invoicePostingOrchestrator.post(postCtx, invoice.id);
  await services.invoiceSettlementService.settle(postCtx, invoice.id, { amount: 40, safeId: ctx.safeId });

  const cancelResult = await attempt(() => services.invoiceM5Service.cancel(ctx.companyId, invoice.id, 'paranoia-audit'));
  const cancelCheck = expectAppError(cancelResult, 422, 'Unpost the invoice before cancelling it');
  check({
    suite: SUITE4,
    id: 'invoice-cancel-while-posted',
    severity: 'P0',
    title: 'Cancelling a posted+settled invoice is rejected with "Unpost the invoice before cancelling it"',
    pass: cancelCheck.pass,
    expected: 'AppError 422 "Unpost the invoice before cancelling it"',
    actual: cancelCheck.actual,
  });

  const unpostResult = await attempt(() => services.invoicePostingOrchestrator.unpost(postCtx, invoice.id));
  if (!unpostResult.ok) {
    console.log(`  ⚠ unpost() failed unexpectedly (${String((unpostResult.error as Error)?.message)}) — remove() trap below cannot be exercised as designed.`);
  }

  const removeResult = await attempt(() => services.invoiceM5Service.remove(ctx.companyId, invoice.id));
  const removeCheck = expectAppError(removeResult, 422, INVOICE_DELETE_SETTLEMENT_LOCK_MESSAGE);
  check({
    suite: SUITE4,
    id: 'invoice-delete-with-settlement-history',
    severity: 'P0',
    title: 'Deleting an unposted invoice with settlement history is rejected with INVOICE_DELETE_SETTLEMENT_LOCK_MESSAGE',
    pass: removeCheck.pass,
    expected: `AppError 422 "${INVOICE_DELETE_SETTLEMENT_LOCK_MESSAGE}"`,
    actual: removeCheck.actual,
  });

  // Best-effort cleanup so this fixture invoice doesn't linger for later checks.
  await attempt(() => services.invoiceM5Service.cancel(ctx.companyId, invoice.id, 'paranoia-audit'));
}

async function suite4ChequeTransitionTraps(
  prisma: PrismaClient,
  ctx: AuditCompanyContext,
  services: Pick<Suite4Services, 'chequeLifecycleService'>
): Promise<void> {
  subsection('Suite 4.2 — Illegal cheque transition (pure util + real service)');

  const pureResult = await attempt(async () => assertChequeTransition('INWARD', 'BOUNCED', 'CLEAR'));
  const pureCheck = expectAppError(pureResult, 400);
  check({
    suite: SUITE4,
    id: 'cheque-transition-pure-util',
    severity: 'P0',
    title: 'assertChequeTransition(INWARD, BOUNCED, CLEAR) rejects with AppError 400',
    pass: pureCheck.pass,
    expected: 'AppError 400',
    actual: pureCheck.actual,
  });

  const cheque = await prisma.cheque.create({
    data: {
      companyId: ctx.companyId,
      branchId: ctx.branchId,
      direction: 'INWARD',
      status: 'BOUNCED',
      chequeNumber: `PARANOIA-${randomUUID().slice(0, 8)}`,
      amount: 100,
      currencyCode: 'EGP',
      customerId: ctx.customerId,
    },
  });
  const serviceResult = await attempt(() =>
    services.chequeLifecycleService.clearInwardCheque(
      { companyId: ctx.companyId, branchId: ctx.branchId, fiscalYearId: ctx.fiscalYearId, userId: 'paranoia-audit' },
      cheque.id,
      randomUUID()
    )
  );
  const serviceCheck = expectAppError(serviceResult, 400);
  check({
    suite: SUITE4,
    id: 'cheque-transition-real-service',
    severity: 'P0',
    title: 'chequeLifecycleService.clearInwardCheque() on a BOUNCED cheque is guarded the same as the pure util',
    pass: serviceCheck.pass,
    expected: 'AppError 400',
    actual: serviceCheck.actual,
  });

  await attempt(() => prisma.cheque.delete({ where: { id: cheque.id } }));
}

async function suite4FiscalPeriodLockTrap(
  prisma: PrismaClient,
  ctx: AuditCompanyContext,
  services: Pick<Suite4Services, 'fiscalYearService'>
): Promise<void> {
  subsection('Suite 4.3 — Fiscal-period lock rejection, then reopen');

  const year = new Date().getUTCFullYear();
  const periodStart = new Date(Date.UTC(year, 0, 10));
  const periodEnd = new Date(Date.UTC(year, 0, 20));
  const docDate = new Date(Date.UTC(year, 0, 15));

  const period = await prisma.fiscalPeriod.create({
    data: {
      companyId: ctx.companyId,
      fiscalYearId: ctx.fiscalYearId,
      periodNumber: 1,
      name: 'PARANOIA-TEST-PERIOD',
      startDate: periodStart,
      endDate: periodEnd,
      isClosed: true,
    },
  });

  const lockedResult = await attempt(() => services.fiscalYearService.assertOpenForDate(ctx.companyId, docDate));
  const lockedCheck = expectAppError(lockedResult, 422, PERIOD_LOCKED_MESSAGE);
  check({
    suite: SUITE4,
    id: 'fiscal-period-locked',
    severity: 'P0',
    title: 'Posting inside a closed fiscal period is rejected with PERIOD_LOCKED_MESSAGE',
    pass: lockedCheck.pass,
    expected: `AppError 422 "${PERIOD_LOCKED_MESSAGE}"`,
    actual: lockedCheck.actual,
  });

  await prisma.fiscalPeriod.update({ where: { id: period.id }, data: { isClosed: false } });
  const reopenedResult = await attempt(() => services.fiscalYearService.assertOpenForDate(ctx.companyId, docDate));
  check({
    suite: SUITE4,
    id: 'fiscal-period-reopened',
    severity: 'P0',
    title: 'Reopening the period allows posting on the same date again',
    pass: reopenedResult.ok,
    expected: 'assertOpenForDate resolves without throwing',
    actual: reopenedResult.ok ? 'resolved' : `threw: ${reopenedResult.error instanceof Error ? reopenedResult.error.message : String(reopenedResult.error)}`,
  });

  await prisma.fiscalPeriod.delete({ where: { id: period.id } }).catch(() => undefined);
}

async function suite4DoublePostTrap(
  prisma: PrismaClient,
  ctx: AuditCompanyContext,
  services: Pick<Suite4Services, 'journalPostingService'>
): Promise<void> {
  subsection('Suite 4.4 — Double-post rejection via the activeSourceKey unique constraint');

  const jeCtx = { companyId: ctx.companyId, branchId: ctx.branchId, fiscalYearId: ctx.fiscalYearId, userId: 'paranoia-audit' };
  const sourceNumber = `PARANOIA-DBLPOST-${randomUUID().slice(0, 8)}`;
  const jeData = {
    date: new Date(),
    currencyCode: 'EGP',
    fiscalYearId: ctx.fiscalYearId,
    sourceType: 'PARANOIA-DBLPOST',
    sourceNumber,
    sourceYearId: '2026',
    lines: [
      { accountId: ctx.arAccountId, debit: 10, credit: 0, lineOrder: 1 },
      { accountId: ctx.salesAccountId, debit: 0, credit: 10, lineOrder: 2 },
    ],
  };

  const first = await attempt(() => prisma.$transaction((tx) => services.journalPostingService.createAndPostInTx(tx, jeCtx, jeData)));
  check({
    suite: SUITE4,
    id: 'double-post-first-succeeds',
    severity: 'P0',
    title: 'First post of a fresh source document succeeds',
    pass: first.ok,
    expected: 'createAndPostInTx resolves',
    actual: first.ok ? 'resolved' : `threw: ${first.error instanceof Error ? first.error.message : String(first.error)}`,
  });

  const second = await attempt(() => prisma.$transaction((tx) => services.journalPostingService.createAndPostInTx(tx, jeCtx, jeData)));
  const rejectedAsDuplicate = !second.ok && isPrismaKnownError(second.error, 'P2002');
  check({
    suite: SUITE4,
    id: 'double-post-second-rejected',
    severity: 'P0',
    title: 'Second post of the same source document is rejected by the activeSourceKey unique constraint',
    pass: rejectedAsDuplicate,
    expected: 'Prisma P2002 unique-constraint violation on activeSourceKey',
    actual: second.ok
      ? 'Second post unexpectedly succeeded — two active JEs now share one source document'
      : `threw: ${second.error instanceof Error ? second.error.message : String(second.error)}`,
  });
}

async function runSuite4(prisma: PrismaClient, ctx: AuditCompanyContext, services: Suite4Services): Promise<void> {
  section('SUITE 4 — Lifecycle & edge-case traps');
  await runWithTenantContext(ctx.companyId, async () => {
    await suite4InvoiceCancelDeleteTraps(prisma, ctx, services);
    await suite4ChequeTransitionTraps(prisma, ctx, services);
    await suite4FiscalPeriodLockTrap(prisma, ctx, services);
    await suite4DoublePostTrap(prisma, ctx, services);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// main
// ─────────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const flags = parseFlags(process.argv.slice(2));

  console.log('ERP Paranoia-Grade Health & Accounting Stress Diagnostics');
  console.log('Run at:', new Date().toISOString());
  console.log('Flags:', JSON.stringify(flags));

  // Every Prisma-touching module is imported dynamically, here, so the
  // connection-pool override at the top of this file has already landed in
  // `process.env.DATABASE_URL` before `prisma.ts` (or anything importing it)
  // is ever evaluated. See the comment on `bumpConnectionPool` above.
  const { default: prisma } = await import('../src/shared/database/prisma.js');
  const { tenantProvisioningService } = await import(
    '../src/modules/accounting/services/tenant-provisioning.service.js'
  );
  const { demoCatalogService } = await import('../src/modules/inventory/services/demo-catalog.service.js');
  const { stockMovementService } = await import('../src/modules/inventory/services/stock-movement.service.js');
  const { documentSequenceService } = await import(
    '../src/modules/platform/services/document-sequence.service.js'
  );
  const { fiscalYearService } = await import('../src/modules/platform/services/fiscal-year.service.js');
  const { journalPostingService } = await import('../src/modules/accounting/services/journal-posting.service.js');
  const { invoiceM5Service } = await import('../src/modules/invoices/services/invoice-m5.service.js');
  const { invoicePostingOrchestrator } = await import(
    '../src/modules/invoices/services/invoice-posting-orchestrator.js'
  );
  const { invoiceSettlementService } = await import('../src/modules/invoices/services/invoice-settlement.service.js');
  const { chequeLifecycleService } = await import('../src/modules/treasury/services/cheque-lifecycle.service.js');

  try {
    await runSuite1(prisma, flags.company);

    if (flags.skipStress) {
      console.log('\n--skip-stress passed: running suite 3 read-only checks only (no bootstrap, suite 2, or suite 4).');
      await runSuite3(prisma, undefined, flags);
      reportAndExit(flags);
      return;
    }

    let ctx: AuditCompanyContext | undefined;
    try {
      ctx = await bootstrapAuditCompany(prisma, tenantProvisioningService, demoCatalogService);

      await runSuite2(prisma, ctx, { stockMovementService, documentSequenceService });
      await runSuite3(prisma, ctx, flags);
      await runSuite4(prisma, ctx, {
        invoiceM5Service,
        invoicePostingOrchestrator,
        invoiceSettlementService,
        chequeLifecycleService,
        fiscalYearService,
        journalPostingService,
      });
    } finally {
      if (ctx) {
        await teardownAuditCompany(prisma, ctx.companyId, flags.keep);
      }
    }

    reportAndExit(flags);
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((e) => {
    console.error('\nParanoia audit crashed:', e);
    process.exitCode = 1;
  })
  .finally(() => {
    // Several modules pulled in transitively (the shared logger's Redis
    // client, in particular — visible as "Redis connected" in the log even
    // with REDIS_ENABLED=false) lazily open handles that never close on
    // their own, which leaves the event loop alive indefinitely despite
    // every explicit resource this script owns (`prisma.$disconnect()`)
    // already being torn down. Force the exit so `audit:paranoia` behaves
    // like a normal CLI command instead of hanging until Ctrl+C, mirroring
    // why the Jest sweep in this repo needed `--forceExit` for the same
    // underlying reason.
    process.exit(process.exitCode ?? 0);
  });
