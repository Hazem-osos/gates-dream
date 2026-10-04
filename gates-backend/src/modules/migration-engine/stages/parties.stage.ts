import { buildPartySourceProfile } from '../party/party-source-profile';
import type { MigrationContext } from '../migration-context';
import { loadLegacyPartySnapshot } from '../services/legacy-party-data.service';
import {
  classifyPartySnapshot,
  type ClassifiedPartyRow,
  type PartyClassificationReport,
} from '../services/party-classifier.service';
import { resolvePartyLegacyAccount } from '../services/migration-party-account.service';
import { evaluateAmbiguousPostedGlWithPartyData } from '../services/post-party-gl-evidence.service';
import type { LegacySupplierRow } from '../services/legacy-party-data.service';
import { transformCustomerRow, transformSupplierRow } from '../transforms/party-transform';
import type { MigrationStageName, StageRunReport } from '../types';

const STAGE: MigrationStageName = 'PARTIES';

export const PARTIES_STAGE_DEPS: MigrationStageName[] = ['FOUNDATION', 'COA'];

export interface PartiesAnalyzeResult {
  profile: Awaited<ReturnType<typeof buildPartySourceProfile>>;
  classification: PartyClassificationReport;
}

export interface PartiesDryRunSummary {
  sourceCustomers: number;
  sourceSuppliers: number;
  safeCustomers: number;
  safeSuppliers: number;
  expectedCustomerCreates: number;
  expectedSupplierCreates: number;
  targetRowDelta: number;
}

export async function analyzeParties(ctx: MigrationContext): Promise<PartiesAnalyzeResult> {
  const profile = await buildPartySourceProfile(ctx.source, ctx.legacyCompanyCode);
  const snapshot = await loadLegacyPartySnapshot(ctx.source, ctx.legacyCompanyCode);
  const classification = await buildClassification(ctx, snapshot);

  for (const row of [...classification.customers, ...classification.suppliers]) {
    if (row.classification === 'AMBIGUOUS' || row.classification === 'INVALID_ACCOUNT_REFERENCE') {
      await ctx.issues.record({
        jobId: ctx.migrationJobId,
        stage: STAGE,
        severity: 'WARNING',
        category: row.classification,
        sourceEntity: 'Customer',
        sourceKey: (row.row as { customerCode?: string; supplierCode?: string }).customerCode ??
          (row.row as { supplierCode?: string }).supplierCode,
        description: row.evidence,
      });
    }
  }

  return { profile, classification };
}

async function buildClassification(ctx: MigrationContext, snapshot: Awaited<ReturnType<typeof loadLegacyPartySnapshot>>) {
  const customerAccounts = new Map<string, Awaited<ReturnType<typeof resolvePartyLegacyAccount>>>();
  for (const code of snapshot.customerAccountCodes) {
    customerAccounts.set(code, await resolvePartyLegacyAccount(ctx, code));
  }
  const supplierAccounts = new Map<string, Awaited<ReturnType<typeof resolvePartyLegacyAccount>>>();
  for (const code of snapshot.supplierAccountCodes) {
    supplierAccounts.set(code, await resolvePartyLegacyAccount(ctx, code));
  }
  return classifyPartySnapshot(snapshot, customerAccounts, supplierAccounts);
}

export async function runPartiesStage(ctx: MigrationContext): Promise<StageRunReport> {
  const snapshot = await loadLegacyPartySnapshot(ctx.source, ctx.legacyCompanyCode);
  const classification = await buildClassification(ctx, snapshot);

  let written = 0;
  let simulated = 0;
  let errors = 0;

  for (const entry of classification.customers) {
    if (entry.classification !== 'SAFE') continue;
    const result = await upsertCustomer(ctx, entry);
    if (result === 'simulated') simulated += 1;
    else if (result === 'written') written += 1;
    else errors += 1;
  }

  for (const entry of classification.suppliers) {
    if (entry.classification !== 'SAFE') continue;
    const result = await upsertSupplier(ctx, entry);
    if (result === 'simulated') simulated += 1;
    else if (result === 'written') written += 1;
    else errors += 1;
  }

  const blockers = await ctx.jobs.countOpenBlockers(ctx.migrationJobId);

  return {
    stage: STAGE,
    sourceCounts: {
      Customer: snapshot.customers.length,
      Supplier: snapshot.suppliers.length,
      safeCustomers: classification.customers.filter((c) => c.classification === 'SAFE').length,
      safeSuppliers: classification.suppliers.filter((s) => s.classification === 'SAFE').length,
    },
    transformed: classification.customers.length + classification.suppliers.length,
    written: ctx.dryRun ? 0 : written,
    simulated,
    warnings: 0,
    errors,
    blockers,
  };
}

async function upsertCustomer(
  ctx: MigrationContext,
  entry: ClassifiedPartyRow<{ customerCode: string }>
): Promise<'written' | 'simulated' | 'error'> {
  const row = entry.row as import('../services/legacy-party-data.service').LegacyCustomerRow;
  const accountId = entry.accountResolution?.targetAccountId;
  if (!accountId) return 'error';

  const key = { companyCode: ctx.legacyCompanyCode, customerCode: row.customerCode };
  if (await ctx.idMap.findMapping(ctx.migrationJobId, 'Customer', key)) return 'written';

  if (ctx.dryRun) return 'simulated';

  const existing = await ctx.prisma.customer.findFirst({
    where: { companyId: ctx.targetCompanyId, code: row.customerCode },
    select: { id: true },
  });
  if (existing) {
    await ctx.idMap.recordMapping({
      jobId: ctx.migrationJobId,
      sourceEntity: 'Customer',
      sourceKeyParts: key,
      targetModel: 'Customer',
      targetId: existing.id,
      outcome: 'ALREADY_MAPPED',
      readOnly: true,
    });
    return 'written';
  }

  const data = transformCustomerRow(row, ctx.targetCompanyId, accountId);
  const created = await ctx.prisma.customer.create({ data });
  await ctx.idMap.recordMapping({
    jobId: ctx.migrationJobId,
    sourceEntity: 'Customer',
    sourceKeyParts: key,
    targetModel: 'Customer',
    targetId: created.id,
    outcome: 'CREATED_BY_MIGRATION',
  });
  return 'written';
}

async function upsertSupplier(
  ctx: MigrationContext,
  entry: ClassifiedPartyRow<LegacySupplierRow>
): Promise<'written' | 'simulated' | 'error'> {
  const row = entry.row;
  const accountId = entry.accountResolution?.targetAccountId;
  if (!accountId) return 'error';

  const key = { companyCode: ctx.legacyCompanyCode, supplierCode: row.supplierCode };
  if (await ctx.idMap.findMapping(ctx.migrationJobId, 'Supplier', key)) return 'written';

  if (ctx.dryRun) return 'simulated';

  const existing = await ctx.prisma.supplier.findFirst({
    where: { companyId: ctx.targetCompanyId, code: row.supplierCode },
    select: { id: true },
  });
  if (existing) {
    await ctx.idMap.recordMapping({
      jobId: ctx.migrationJobId,
      sourceEntity: 'Supplier',
      sourceKeyParts: key,
      targetModel: 'Supplier',
      targetId: existing.id,
      outcome: 'ALREADY_MAPPED',
      readOnly: true,
    });
    return 'written';
  }

  const data = transformSupplierRow(row, ctx.targetCompanyId, accountId);
  const created = await ctx.prisma.supplier.create({ data });
  await ctx.idMap.recordMapping({
    jobId: ctx.migrationJobId,
    sourceEntity: 'Supplier',
    sourceKeyParts: key,
    targetModel: 'Supplier',
    targetId: created.id,
    outcome: 'CREATED_BY_MIGRATION',
  });
  return 'written';
}

export async function reconcileParties(ctx: MigrationContext) {
  const snapshot = await loadLegacyPartySnapshot(ctx.source, ctx.legacyCompanyCode);
  const classification = await buildClassification(ctx, snapshot);
  const glEvidence = await evaluateAmbiguousPostedGlWithPartyData(ctx);

  const safeCust = classification.customers.filter((c) => c.classification === 'SAFE');
  const safeSup = classification.suppliers.filter((s) => s.classification === 'SAFE');

  const migratedCustomers = await ctx.prisma.migrationIdMap.count({
    where: { migrationJobId: ctx.migrationJobId, sourceEntity: 'Customer' },
  });
  const migratedSuppliers = await ctx.prisma.migrationIdMap.count({
    where: { migrationJobId: ctx.migrationJobId, sourceEntity: 'Supplier' },
  });

  return {
    sourceSafeCustomers: safeCust.length,
    sourceSafeSuppliers: safeSup.length,
    targetMigratedCustomers: migratedCustomers,
    targetMigratedSuppliers: migratedSuppliers,
    customerMatch: migratedCustomers === safeCust.length ? 'MATCH' : 'MISMATCH',
    supplierMatch: migratedSuppliers === safeSup.length ? 'MATCH' : 'MISMATCH',
    classification,
    postPartyGlReadiness: {
      distinctPostedGl: glEvidence.coaReconcile.distinctPostedGlAccountCodes,
      resolvedByCoa: glEvidence.coaReconcile.resolved,
      ambiguous: glEvidence.coaReconcile.ambiguous,
      partyEvidence: glEvidence.rows,
    },
  };
}

export function summarizePartiesDryRun(
  classification: PartyClassificationReport,
  sourceCustomers: number,
  sourceSuppliers: number,
  targetRowDelta: number
): PartiesDryRunSummary {
  const safeCustomers = classification.customers.filter((c) => c.classification === 'SAFE').length;
  const safeSuppliers = classification.suppliers.filter((s) => s.classification === 'SAFE').length;
  return {
    sourceCustomers,
    sourceSuppliers,
    safeCustomers,
    safeSuppliers,
    expectedCustomerCreates: safeCustomers,
    expectedSupplierCreates: safeSuppliers,
    targetRowDelta,
  };
}
