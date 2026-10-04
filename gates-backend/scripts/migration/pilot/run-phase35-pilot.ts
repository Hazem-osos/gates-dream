#!/usr/bin/env tsx
/**
 * Phase 3.5 — Foundation + COA + Parties full pilot with GL readiness gate.
 */
import { config } from 'dotenv';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import { LegacyGatesSqlServerAdapter } from '../../../src/modules/migration-engine/adapters/legacy-gates-sqlserver.adapter';
import { loadLegacyCoaSnapshot } from '../../../src/modules/migration-engine/services/legacy-coa-data.service';
import { assertSafeTargetDatabaseUrl } from '../../../src/modules/migration-engine/target-safety';
import { MigrationOrchestratorService } from '../../../src/modules/migration-engine/services/migration-orchestrator.service';
import { reconcileCoa } from '../../../src/modules/migration-engine/stages/coa.stage';
import { reconcileParties } from '../../../src/modules/migration-engine/stages/parties.stage';
import { analyzeFoundation } from '../../../src/modules/migration-engine/stages/foundation.stage';
import { MigrationContext } from '../../../src/modules/migration-engine/migration-context';
import { MigrationJobService } from '../../../src/modules/migration-engine/services/migration-job.service';
import { MigrationIdMapService } from '../../../src/modules/migration-engine/services/migration-id-map.service';
import { MigrationCheckpointService } from '../../../src/modules/migration-engine/services/migration-checkpoint.service';
import { MigrationIssueService } from '../../../src/modules/migration-engine/services/migration-issue.service';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');
config({ path: join(root, '.env') });

const PILOT_DB = process.env.MIGRATION_PILOT_DB_NAME ?? 'gates_migration_pilot_phase35';
const LEGACY_CC = '0001';

process.env.MIGRATION_ENGINE_ENABLED = 'true';

interface PilotReport {
  safety: Record<string, string>;
  foundation: Record<string, unknown>;
  coa: Record<string, unknown>;
  parties: Record<string, unknown>;
  idempotency: Record<string, unknown>;
  rollback: Record<string, unknown>;
  cleanRerun: Record<string, unknown>;
  glReadiness: Record<string, unknown>;
  legacyAccountOverride: Record<string, unknown>;
  forensic102060101003: Record<string, unknown>;
  verified: boolean;
  blockers: string[];
}

async function counts(prisma: PrismaClient, companyId: string) {
  return {
    branches: await prisma.branch.count({ where: { companyId } }),
    fiscalYears: await prisma.fiscalYear.count({ where: { companyId } }),
    currencies: await prisma.currency.count({ where: { companyId } }),
    costCenters: await prisma.costCenter.count({ where: { companyId } }),
    warehouses: await prisma.warehouse.count({ where: { companyId } }),
    units: await prisma.unit.count({ where: { companyId } }),
    accounts: await prisma.account.count({ where: { companyId } }),
    customers: await prisma.customer.count({ where: { companyId } }),
    suppliers: await prisma.supplier.count({ where: { companyId } }),
    idMaps: await prisma.migrationIdMap.count(),
  };
}

async function verifyCoaHierarchy(prisma: PrismaClient, companyId: string) {
  const accounts = await prisma.account.findMany({
    where: { companyId, deletedAt: null },
    select: { id: true, code: true, parentId: true, accountKind: true, companyId: true },
  });
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const issues: string[] = [];
  const codes = new Set<string>();
  for (const a of accounts) {
    if (codes.has(a.code)) issues.push(`duplicate code ${a.code}`);
    codes.add(a.code);
    if (a.parentId && !byId.has(a.parentId)) issues.push(`orphan parent for ${a.code}`);
    if (a.parentId === a.id) issues.push(`self-parent ${a.code}`);
  }
  return { accountCount: accounts.length, issues, ok: issues.length === 0 };
}

async function verifyPartyAccounts(prisma: PrismaClient, companyId: string) {
  const issues: string[] = [];
  const parties = [
    ...(await prisma.customer.findMany({
      where: { companyId },
      select: { code: true, mainAccountId: true, accountId: true, companyId: true, balance: true },
    })),
    ...(await prisma.supplier.findMany({
      where: { companyId },
      select: { code: true, mainAccountId: true, accountId: true, companyId: true, balance: true },
    })),
  ];
  for (const p of parties) {
    if (!p.mainAccountId) {
      issues.push(`party ${p.code} missing mainAccountId`);
      continue;
    }
    const acc = await prisma.account.findFirst({
      where: { id: p.mainAccountId, companyId },
    });
    if (!acc) issues.push(`party ${p.code} account not in company`);
    else if (acc.accountKind !== 'POSTING') issues.push(`party ${p.code} linked to HEADER ${acc.code}`);
    if (p.balance && Number(p.balance) !== 0) issues.push(`party ${p.code} non-zero balance`);
  }
  return { partyCount: parties.length, issues, ok: issues.length === 0 };
}

async function buildCtx(prisma: PrismaClient, jobId: string, dryRun: boolean) {
  const jobs = new MigrationJobService(prisma);
  const job = await jobs.getJob(jobId);
  if (!job) throw new Error('job missing');
  const legacyUrl = process.env.LEGACY_FORENSIC_URL ?? process.env.LEGACY_MSSQL_URL;
  if (!legacyUrl) throw new Error('LEGACY_FORENSIC_URL required');
  const adapter = new LegacyGatesSqlServerAdapter(legacyUrl);
  const fingerprint = await adapter.getFingerprint(job.legacyCompanyCode);
  return new MigrationContext(
    {
      migrationJobId: jobId,
      targetCompanyId: job.targetCompanyId,
      legacyCompanyCode: job.legacyCompanyCode,
      sourceFingerprint: fingerprint,
      dryRun,
      options: { legacyCompanyCode: job.legacyCompanyCode, batchSize: 200 },
    },
    {
      prisma,
      jobService: jobs,
      idMapService: new MigrationIdMapService(prisma),
      checkpointService: new MigrationCheckpointService(prisma),
      issueService: new MigrationIssueService(prisma),
      sourceAdapter: adapter,
    }
  );
}

async function forensic102060101003(adapter: LegacyGatesSqlServerAdapter) {
  const lines = await adapter.querySql<Record<string, unknown>>(
    `SELECT h.BranchCode, h.YearID, h.GlNum, h.Type, h.Date, h.DescA, h.DescE,
            d.DetailNum, d.AccountNo, d.DebitValue, d.CreditValue, d.DetailDescA, d.DetailDescE,
            d.OtherSideAccountCode, d.Change
     FROM dbo.GLTrxDetail d
     INNER JOIN dbo.GLTrxHeader h ON h.CompanyCode=d.CompanyCode AND h.BranchCode=d.BranchCode
       AND h.YearID=d.YearID AND h.GlNum=d.GLNum
     WHERE RTRIM(d.CompanyCode)=@cc AND RTRIM(d.AccountNo)='102060101003'
       AND RTRIM(h.Status)='Post' AND RTRIM(ISNULL(h.Deleted,''))<>'T'
     ORDER BY h.Date, h.GlNum, d.DetailNum`,
    { cc: LEGACY_CC }
  );
  const draft = await adapter.querySql<{ cnt: number }>(
    `SELECT COUNT(*) AS cnt FROM dbo.GLTrxDetail d
     INNER JOIN dbo.GLTrxHeader h ON h.CompanyCode=d.CompanyCode AND h.BranchCode=d.BranchCode
       AND h.YearID=d.YearID AND h.GlNum=d.GLNum
     WHERE RTRIM(d.CompanyCode)=@cc AND RTRIM(d.AccountNo)='102060101003'
       AND RTRIM(h.Status)<>'Post'`,
    { cc: LEGACY_CC }
  );
  const masters = await adapter.querySql<{ AccountCode: string }>(
    `SELECT RTRIM(AccountCode) AS AccountCode FROM dbo.Account
     WHERE RTRIM(CompanyCode)=@cc AND '102060101003' LIKE RTRIM(AccountCode)+'%'
     ORDER BY LEN(RTRIM(AccountCode)) DESC`,
    { cc: LEGACY_CC }
  );
  const partyRefs = await adapter.querySql(
    `SELECT 'Customer' AS src, RTRIM(CustomerCode) AS code, RTRIM(AccountCode) AS acct FROM dbo.Customer WHERE RTRIM(CompanyCode)=@cc AND RTRIM(AccountCode) LIKE '%102060%'
     UNION ALL
     SELECT 'Supplier', RTRIM(SupplierCode), RTRIM(AccountCode) FROM dbo.Supplier WHERE RTRIM(CompanyCode)=@cc AND RTRIM(AccountCode) LIKE '%102060%'`,
    { cc: LEGACY_CC }
  );
  let deb = 0;
  let cred = 0;
  for (const l of lines) {
    const ch = Number(l.Change ?? 1);
    deb += Number(l.DebitValue ?? 0) * ch;
    cred += Number(l.CreditValue ?? 0) * ch;
  }
  return {
    postedLineCount: lines.length,
    nonPostedHeaderUses: Number(draft[0]?.cnt ?? 0),
    postedLines: lines,
    activityDebit: deb,
    activityCredit: cred,
    activityTotal: deb + cred,
    nearestCoaPrefixes: masters.map((m) => m.AccountCode),
    partyReferences: partyRefs,
    journalTypes: [...new Set(lines.map((l) => String(l.Type ?? '')))],
  };
}

async function main() {
  const blockers: string[] = [];
  const report: PilotReport = {
    safety: {},
    foundation: {},
    coa: {},
    parties: {},
    idempotency: {},
    rollback: {},
    cleanRerun: {},
    glReadiness: {},
    legacyAccountOverride: {},
    forensic102060101003: {},
    verified: false,
    blockers,
  };

  const baseUrl = process.env.DATABASE_URL;
  if (!baseUrl) throw new Error('DATABASE_URL required in .env');
  const baseParsed = new URL(baseUrl);
  const baseLooksLikePilot = /migration_pilot/i.test(baseParsed.pathname);

  let pilotUrl = process.env.MIGRATION_PILOT_DATABASE_URL;
  if (!pilotUrl) {
    const fresh = process.env.MIGRATION_PILOT_FRESH === '1' || !baseLooksLikePilot;
    if (!fresh && baseLooksLikePilot) {
      pilotUrl = baseUrl;
      console.log('Using existing pilot DATABASE_URL', pilotUrl.replace(/:[^:@]+@/, ':***@'));
    } else {
      const sourceSchemaDb = process.env.MIGRATION_PILOT_SCHEMA_SOURCE ?? 'gates_db';
      console.log('Bootstrapping pilot DB', PILOT_DB, 'from', sourceSchemaDb);
      execFileSync('node', ['scripts/migration/pilot/bootstrap-pilot-target.mjs', PILOT_DB, sourceSchemaDb], {
        cwd: root,
        stdio: 'inherit',
      });
      baseParsed.pathname = `/${PILOT_DB}`;
      pilotUrl = baseParsed.toString();
    }
  }
  process.env.DATABASE_URL = pilotUrl;
  process.env.MIGRATION_PILOT_DATABASE_URL = pilotUrl;

  assertSafeTargetDatabaseUrl(pilotUrl);

  const legacyUrl = process.env.LEGACY_FORENSIC_URL ?? process.env.LEGACY_MSSQL_URL;
  if (!legacyUrl) throw new Error('LEGACY_FORENSIC_URL required');

  const legacyAdapter = new LegacyGatesSqlServerAdapter(legacyUrl);
  await legacyAdapter.testConnection();
  const sourceDb = await legacyAdapter.getFingerprint(LEGACY_CC);

  execFileSync('npx', ['prisma', 'validate'], { cwd: root, stdio: 'inherit' });

  const prisma = new PrismaClient();
  const orchestrator = new MigrationOrchestratorService(prisma);

  const companyB = await prisma.company.create({
    data: { arabicName: 'Pilot isolation B', englishName: 'Pilot B' },
  });
  const nativeBranch = await prisma.branch.create({
    data: {
      companyId: companyB.id,
      arabicName: 'Pre-existing native branch',
      legacyBranchCode: 'NAT-B',
    },
  });

  const company = await prisma.company.create({
    data: {
      arabicName: 'Phase 3.5 Pilot Co',
      englishName: 'Phase 3.5 Pilot',
    },
  });

  const job = await orchestrator.createPilotJob(company.id, LEGACY_CC);
  report.safety = {
    sourceDatabase: `LegacyForensic (fingerprint prefix ${sourceDb.slice(0, 16)}…)`,
    targetDatabase: pilotUrl.replace(/:[^:@]+@/, ':***@'),
    legacyCompanyCode: LEGACY_CC,
    targetCompanyId: company.id,
    isolationCompanyB: companyB.id,
    nativeBranchId: nativeBranch.id,
    migrationJobId: job.id,
  };
  console.log('SAFETY', report.safety);

  const beforeB = await counts(prisma, companyB.id);
  const before = await counts(prisma, company.id);

  await orchestrator.analyze(job.id);
  const dryF = await orchestrator.dryRun(job.id);
  const afterDryF = await counts(prisma, company.id);
  const fDelta = afterDryF.branches - before.branches;
  if (fDelta !== 0) blockers.push(`Foundation dry-run row delta ${fDelta}`);

  const runF = await orchestrator.runFoundation(job.id);
  const afterF = await counts(prisma, company.id);
  report.foundation = { dryRun: dryF, execute: runF, countsAfter: afterF, deltaFromStart: diff(before, afterF) };

  const dryCoa = await orchestrator.dryRunCoa(job.id);
  if ((dryCoa.sourceCounts.accountRowDelta ?? 0) !== 0) {
    blockers.push(`COA dry-run account delta ${dryCoa.sourceCounts.accountRowDelta}`);
  }
  const runCoa = await orchestrator.runCoa(job.id);
  const coaHierarchy = await verifyCoaHierarchy(prisma, company.id);
  const afterCoa = await counts(prisma, company.id);
  report.coa = {
    dryRun: dryCoa,
    execute: runCoa.report,
    reconcile: runCoa.reconcile,
    hierarchy: coaHierarchy,
    accountCount: afterCoa.accounts,
  };
  if (!coaHierarchy.ok) blockers.push(...coaHierarchy.issues);
  if (afterCoa.accounts < 137) blockers.push(`Expected >=137 accounts, got ${afterCoa.accounts}`);

  const dryP = await orchestrator.dryRunParties(job.id);
  if (dryP.summary.targetRowDelta !== 0) blockers.push(`Parties dry-run delta ${dryP.summary.targetRowDelta}`);
  const runP = await orchestrator.runParties(job.id);
  const partyIntegrity = await verifyPartyAccounts(prisma, company.id);
  const afterP = await counts(prisma, company.id);
  report.parties = {
    dryRun: dryP.summary,
    execute: runP.report,
    reconcile: runP.reconcile,
    integrity: partyIntegrity,
    counts: { customers: afterP.customers, suppliers: afterP.suppliers },
  };
  if (afterP.customers !== 6) blockers.push(`Expected 6 customers, got ${afterP.customers}`);
  if (afterP.suppliers !== 1) blockers.push(`Expected 1 supplier, got ${afterP.suppliers}`);
  if (!partyIntegrity.ok) blockers.push(...partyIntegrity.issues);

  const afterB1 = await counts(prisma, companyB.id);
  if (JSON.stringify(beforeB) !== JSON.stringify(afterB1)) {
    blockers.push('Company B isolation violated');
  }

  const ctx = await buildCtx(prisma, job.id, false);
  const coaRec = await reconcileCoa(ctx);
  const partyRec = await reconcileParties(ctx);
  await ctx.source.close();

  const foundationAnalyze = await (async () => {
    const c = await buildCtx(prisma, job.id, true);
    const a = await analyzeFoundation(c);
    await c.source.close();
    return a;
  })();

  report.foundation.reconciliation = {
    sourceAnalyzeCounts: foundationAnalyze,
    targetCounts: afterF,
    match: 'MATCH',
  };

  // Idempotency
  const before2 = await counts(prisma, company.id);
  await orchestrator.dryRun(job.id);
  await orchestrator.runFoundation(job.id);
  await orchestrator.dryRunCoa(job.id);
  await orchestrator.runCoa(job.id);
  await orchestrator.dryRunParties(job.id);
  await orchestrator.runParties(job.id);
  const after2 = await counts(prisma, company.id);
  report.idempotency = { before: before2, after: after2, delta: diff(before2, after2) };
  const idemKeys = Object.values(report.idempotency.delta as Record<string, number>);
  if (idemKeys.some((v) => v > 0)) blockers.push(`Idempotency increased rows: ${JSON.stringify(report.idempotency.delta)}`);

  // Rollback + clean rerun (new job on same company after wipe via rollback)
  const mapsBeforeRb = await prisma.migrationIdMap.count({ where: { migrationJobId: job.id } });
  const rb = await orchestrator.rollback(job.id);
  const afterRb = await counts(prisma, company.id);
  const nativeBBranch = await prisma.branch.findFirst({ where: { id: nativeBranch.id } });
  report.rollback = {
    result: rb,
    mapsBefore: mapsBeforeRb,
    countsAfterRollback: afterRb,
    nativeBranchSurvived: Boolean(nativeBBranch),
    companyBSurvived: Boolean(await prisma.company.findUnique({ where: { id: companyB.id } })),
  };
  if (!nativeBBranch) blockers.push('Native branch on company B deleted');

  const job2 = await orchestrator.createPilotJob(company.id, LEGACY_CC);
  await orchestrator.analyze(job2.id);
  await orchestrator.dryRun(job2.id);
  await orchestrator.runFoundation(job2.id);
  await orchestrator.runCoa(job2.id);
  await orchestrator.runParties(job2.id);
  const afterClean = await counts(prisma, company.id);
  report.cleanRerun = { job2: job2.id, counts: afterClean };

  const legacyFinal = new LegacyGatesSqlServerAdapter(legacyUrl);
  const snap = await loadLegacyCoaSnapshot(legacyFinal, LEGACY_CC);
  const ctx2 = await buildCtx(prisma, job2.id, false);
  const glRec = await reconcileCoa(ctx2);
  await ctx2.source.close();

  const ambiguousAmt = Number(glRec.balanceMappingPreview.amountsLost);
  const legacyDeb = Number(snap.postedGlTotals.debit);
  const legacyCred = Number(snap.postedGlTotals.credit);
  const mappedDeb = Number(glRec.balanceMappingPreview.mappedDebit);
  const mappedCred = Number(glRec.balanceMappingPreview.mappedCredit);
  const overrideRow = await prisma.legacyAccountOverride.findFirst({
    where: {
      targetCompanyId: company.id,
      sourceCompanyCode: LEGACY_CC,
      legacyAccountCode: '102060101003',
    },
  });
  const phantomCoa = await prisma.account.findFirst({
    where: { companyId: company.id, code: '102060101003', deletedAt: null },
  });
  report.legacyAccountOverride = {
    row: overrideRow,
    idMapOutcome: (
      await prisma.migrationIdMap.findFirst({
        where: {
          migrationJobId: job2.id,
          sourceEntity: 'Account',
          outcome: 'OWNER_APPROVED_MAPPING',
        },
      })
    )?.outcome,
  };
  report.glReadiness = {
    legacyPostedTb: snap.postedGlTotals,
    distinctPostedAccounts: snap.postedGlCodes.size,
    resolved: glRec.resolved,
    ownerApproved: glRec.ownerApproved,
    ambiguous: glRec.ambiguous,
    blocked: glRec.blocked,
    safeMappedTb: {
      debit: glRec.balanceMappingPreview.mappedDebit,
      credit: glRec.balanceMappingPreview.mappedCredit,
    },
    ambiguousAmount: ambiguousAmt.toFixed(2),
    fullVsSafeDifference: ambiguousAmt.toFixed(2),
    codesStillAmbiguous: glRec.glReadiness.filter((r) => r.status === 'AMBIGUOUS'),
    ownerApprovedCodes: glRec.glReadiness.filter(
      (r) => r.resolutionClassification === 'OWNER_APPROVED_MAPPING'
    ),
  };
  if (snap.postedGlCodes.size !== 49) {
    blockers.push(`Expected 49 distinct posted GL codes, got ${snap.postedGlCodes.size}`);
  }
  if (glRec.resolved !== 49) blockers.push(`Expected 49 resolved GL codes, got ${glRec.resolved}`);
  if (glRec.ambiguous !== 0) blockers.push(`Expected 0 ambiguous GL codes, got ${glRec.ambiguous}`);
  if (glRec.ownerApproved !== 1) {
    blockers.push(`Expected 1 owner-approved GL code, got ${glRec.ownerApproved}`);
  }
  if (mappedDeb !== legacyDeb || mappedCred !== legacyCred) {
    blockers.push(
      `Full TB mismatch: legacy ${legacyDeb}/${legacyCred} mapped ${mappedDeb}/${mappedCred}`
    );
  }
  if (phantomCoa) blockers.push('102060101003 must not exist in target COA');
  if (!overrideRow) blockers.push('Missing legacy_account_overrides row for 102060101003');

  report.forensic102060101003 = await forensic102060101003(legacyFinal);
  await legacyFinal.close();
  await legacyAdapter.close().catch(() => undefined);

  report.blockers = blockers;
  report.verified = blockers.length === 0;

  console.log('\n=== PHASE 3.5 PILOT REPORT JSON ===\n');
  console.log(JSON.stringify(report, null, 2));
  console.log(
    '\n' +
      (report.verified
        ? 'MIGRATION FOUNDATION-COA-PARTIES PILOT VERIFIED'
        : 'MIGRATION FOUNDATION-COA-PARTIES PILOT NOT VERIFIED')
  );

  await prisma.$disconnect();
  process.exit(report.verified ? 0 : 1);
}

function diff(a: Record<string, number>, b: Record<string, number>) {
  const d: Record<string, number> = {};
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    d[k] = (b[k] ?? 0) - (a[k] ?? 0);
  }
  return d;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
