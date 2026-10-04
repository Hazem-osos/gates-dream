import type { Account } from '@prisma/client';
import { buildAccountingSourceCapabilities } from '../accounting-source-profile';
import { orderMasterAccountsForInsert } from '../coa/hierarchy-order';
import type { MigrationContext } from '../migration-context';
import {
  accountsToMigrate,
  classifyAccountUniverse,
  type AccountClassificationReport,
  type ClassifiedAccountReference,
} from '../services/account-classifier.service';
import { buildAccountUniverse, type AccountUniverseBuckets } from '../services/account-universe.service';
import { loadLegacyCoaSnapshot, type LegacyAccountMasterRow } from '../services/legacy-coa-data.service';
import {
  resolveParentLegacyCode,
  transformDerivedGlAccount,
  transformMasterAccount,
} from '../transforms/coa-transform';
import {
  buildOwnerApprovedReadinessReason,
  loadOverrideMapForJob,
  resolveOwnerApprovedOverride,
  syncOwnerApprovedPostedGlMappings,
} from '../services/legacy-account-override.service';
import { isOwnerApprovedOverrideRow } from '../policies/approved-legacy-account-overrides';
import type { GlPostedAccountResolution, MigrationStageName, StageRunReport } from '../types';

const STAGE: MigrationStageName = 'COA';

export const COA_STAGE_DEPS: MigrationStageName[] = ['FOUNDATION'];

export interface CoaAnalyzeResult {
  capabilities: Awaited<ReturnType<typeof buildAccountingSourceCapabilities>>;
  universe: AccountUniverseBuckets;
  classification: AccountClassificationReport;
  masterCount: number;
  postedGlDistinctAccounts: number;
}

export interface GlReadinessRow {
  code: string;
  status:
    | 'RESOLVED_TO_TARGET_ACCOUNT'
    | 'PARTY_DEPENDENT'
    | 'AMBIGUOUS'
    | 'INVALID'
    | 'BLOCKED';
  targetAccountId?: string;
  postingEligible?: boolean;
  resolutionClassification?: GlPostedAccountResolution;
  reason: string;
}

export interface CoaReconcileResult {
  glReadiness: GlReadinessRow[];
  distinctPostedGlAccountCodes: number;
  resolved: number;
  ownerApproved: number;
  partyDependent: number;
  ambiguous: number;
  blocked: number;
  balanceMappingPreview: {
    legacyDebit: string;
    legacyCredit: string;
    mappedDebit: string;
    mappedCredit: string;
    difference: string;
    amountsLost: string;
  };
}

export async function analyzeCoa(ctx: MigrationContext): Promise<CoaAnalyzeResult> {
  const capabilities = await buildAccountingSourceCapabilities(ctx.source, ctx.legacyCompanyCode);
  const snapshot = await loadLegacyCoaSnapshot(ctx.source, ctx.legacyCompanyCode);
  const universe = buildAccountUniverse(snapshot);
  const classification = classifyAccountUniverse(snapshot, universe);

  for (const row of classification.rows) {
    if (row.classification === 'AMBIGUOUS' || row.classification === 'BLOCKED') {
      await ctx.issues.record({
        jobId: ctx.migrationJobId,
        stage: STAGE,
        severity: row.classification === 'BLOCKED' ? 'BLOCKER' : 'WARNING',
        category: row.classification,
        sourceEntity: 'Account',
        sourceKey: row.code,
        description: row.evidence,
      });
    }
  }

  return {
    capabilities,
    universe,
    classification,
    masterCount: snapshot.masters.length,
    postedGlDistinctAccounts: snapshot.postedGlCodes.size,
  };
}

export async function runCoaStage(ctx: MigrationContext): Promise<StageRunReport> {
  const snapshot = await loadLegacyCoaSnapshot(ctx.source, ctx.legacyCompanyCode);
  const universe = buildAccountUniverse(snapshot);
  const classification = classifyAccountUniverse(snapshot, universe);
  const toMigrate = accountsToMigrate(classification);

  const masterByCode = new Map(snapshot.masters.map((m) => [m.accountCode, m]));
  const derivedCodes = toMigrate
    .filter((r) => r.classification === 'DERIVED_FROM_LEGACY_STRUCTURE')
    .map((r) => r.code);
  const insertOrder = orderMasterAccountsForInsert(snapshot.masters, derivedCodes);

  let written = 0;
  let simulated = 0;
  let warnings = 0;
  let errors = 0;

  const legacyToTarget = new Map<string, string>();

  for (const code of insertOrder) {
    const master = masterByCode.get(code);
    const derivedRef = toMigrate.find(
      (r) => r.code === code && r.classification === 'DERIVED_FROM_LEGACY_STRUCTURE'
    );

    if (!master && !derivedRef) continue;

    const key = { companyCode: ctx.legacyCompanyCode, accountCode: code };
    const existingMap = await ctx.idMap.findMapping(ctx.migrationJobId, 'Account', key);
    if (existingMap) {
      legacyToTarget.set(code, existingMap.targetId);
      continue;
    }

    if (ctx.dryRun) {
      simulated += 1;
      continue;
    }

    const parentLegacy = master
      ? resolveParentLegacyCode(master, masterByCode)
      : derivedRef?.masterAccountCode ?? null;
    let parentId: string | undefined;
    if (parentLegacy) {
      parentId = legacyToTarget.get(parentLegacy);
      if (!parentId) {
        const parentMap = await ctx.idMap.findMapping(ctx.migrationJobId, 'Account', {
          companyCode: ctx.legacyCompanyCode,
          accountCode: parentLegacy,
        });
        parentId = parentMap?.targetId;
      }
      if (!parentId) {
        errors += 1;
        await ctx.issues.record({
          jobId: ctx.migrationJobId,
          stage: STAGE,
          severity: 'ERROR',
          category: 'MISSING_PARENT',
          sourceEntity: 'Account',
          sourceKey: code,
          description: `Parent ${parentLegacy} not mapped before child ${code}`,
        });
        continue;
      }
    }

    const existingTarget = await ctx.prisma.account.findFirst({
      where: { companyId: ctx.targetCompanyId, code, deletedAt: null },
    });

    if (existingTarget) {
      const equivalent = await isSemanticallyEquivalent(existingTarget, master, derivedRef, parentId);
      if (!equivalent.ok) {
        errors += 1;
        await ctx.issues.record({
          jobId: ctx.migrationJobId,
          stage: STAGE,
          severity: 'BLOCKER',
          category: 'TARGET_CONFLICT',
          sourceEntity: 'Account',
          sourceKey: code,
          description: equivalent.reason,
        });
        continue;
      }
      legacyToTarget.set(code, existingTarget.id);
      await ctx.idMap.recordMapping({
        jobId: ctx.migrationJobId,
        sourceEntity: 'Account',
        sourceKeyParts: key,
        targetModel: 'Account',
        targetId: existingTarget.id,
        outcome: 'ALREADY_MAPPED',
        readOnly: true,
      });
      continue;
    }

    const data = master
      ? transformMasterAccount(master, ctx.targetCompanyId)
      : transformDerivedGlAccount(
          derivedRef!,
          ctx.targetCompanyId,
          derivedRef?.masterAccountCode
            ? masterByCode.get(derivedRef.masterAccountCode)
            : undefined
        );

    const base = stripConnect(data);
    const created = await ctx.prisma.account.create({
      data: {
        companyId: ctx.targetCompanyId,
        parentId: parentId ?? null,
        code: base.code,
        arabicName: base.arabicName,
        englishName: base.englishName ?? null,
        accountType: base.accountType ?? null,
        accountSide: base.accountSide ?? null,
        accountNature: base.accountNature,
        accountKind: base.accountKind,
        statementType: base.statementType,
        requiresCostCenter: base.requiresCostCenter,
        costCenterRequired: base.costCenterRequired ?? null,
        currencyCode: base.currencyCode ?? null,
        isActive: base.isActive,
        deletedAt: base.deletedAt ?? null,
      },
    });
    written += 1;
    legacyToTarget.set(code, created.id);
    await ctx.idMap.recordMapping({
      jobId: ctx.migrationJobId,
      sourceEntity: 'Account',
      sourceKeyParts: key,
      targetModel: 'Account',
      targetId: created.id,
      outcome: 'CREATED_BY_MIGRATION',
    });
  }

  if (!ctx.dryRun) {
    await syncOwnerApprovedPostedGlMappings(ctx);
  }

  const blockers = await ctx.jobs.countOpenBlockers(ctx.migrationJobId);

  return {
    stage: STAGE,
    sourceCounts: {
      Account: snapshot.masters.length,
      PostedGlAccounts: snapshot.postedGlCodes.size,
      GlOnlyPosted: universe.glOnlyPosted.length,
    },
    transformed: toMigrate.length,
    written: ctx.dryRun ? 0 : written,
    simulated,
    warnings,
    errors,
    blockers,
  };
}

export async function reconcileCoa(ctx: MigrationContext): Promise<CoaReconcileResult> {
  const snapshot = await loadLegacyCoaSnapshot(ctx.source, ctx.legacyCompanyCode);
  const universe = buildAccountUniverse(snapshot);
  const classification = classifyAccountUniverse(snapshot, universe);

  if (!ctx.dryRun) {
    await syncOwnerApprovedPostedGlMappings(ctx);
  }
  const overrideMap = await loadOverrideMapForJob(
    ctx.prisma,
    ctx.targetCompanyId,
    ctx.legacyCompanyCode
  );

  const glReadiness: GlReadinessRow[] = [];
  let resolved = 0;
  let ownerApproved = 0;
  let partyDependent = 0;
  let ambiguous = 0;
  let blocked = 0;

  for (const code of [...snapshot.postedGlCodes].sort()) {
    const classRow = classification.rows.find((r) => r.code === code);
    const map = await ctx.idMap.findMapping(ctx.migrationJobId, 'Account', {
      companyCode: ctx.legacyCompanyCode,
      accountCode: code,
    });
    const target = map
      ? await ctx.prisma.account.findFirst({
          where: { id: map.targetId, companyId: ctx.targetCompanyId },
        })
      : null;

    const override = overrideMap.get(code);

    if (target) {
      const postingEligible = target.accountKind === 'POSTING';
      const ownerRow =
        override && isOwnerApprovedOverrideRow(override) && map?.outcome === 'OWNER_APPROVED_MAPPING';
      const resolutionClassification: GlPostedAccountResolution | undefined = ownerRow
        ? 'OWNER_APPROVED_MAPPING'
        : undefined;
      glReadiness.push({
        code,
        status: 'RESOLVED_TO_TARGET_ACCOUNT',
        targetAccountId: target.id,
        postingEligible,
        resolutionClassification,
        reason: ownerRow
          ? buildOwnerApprovedReadinessReason(override)
          : postingEligible
            ? 'Mapped posting account'
            : 'Mapped HEADER — not journal-eligible',
      });
      resolved += 1;
      if (ownerRow) ownerApproved += 1;
      continue;
    }

    if (override) {
      const resolvedOverride = await resolveOwnerApprovedOverride(ctx, override);
      if (resolvedOverride) {
        glReadiness.push({
          code,
          status: 'RESOLVED_TO_TARGET_ACCOUNT',
          targetAccountId: resolvedOverride.targetAccountId,
          postingEligible: true,
          resolutionClassification: 'OWNER_APPROVED_MAPPING',
          reason: buildOwnerApprovedReadinessReason(override),
        });
        resolved += 1;
        ownerApproved += 1;
        continue;
      }
    }

    if (classRow?.classification === 'DEPENDENT_ON_FUTURE_PARTY_MIGRATION') {
      glReadiness.push({
        code,
        status: 'PARTY_DEPENDENT',
        reason: classRow.evidence,
      });
      partyDependent += 1;
    } else if (classRow?.classification === 'AMBIGUOUS') {
      glReadiness.push({ code, status: 'AMBIGUOUS', reason: classRow.evidence });
      ambiguous += 1;
    } else if (classRow?.classification === 'INVALID_SOURCE') {
      glReadiness.push({ code, status: 'INVALID', reason: classRow.evidence });
      blocked += 1;
    } else {
      glReadiness.push({
        code,
        status: 'BLOCKED',
        reason: classRow?.evidence ?? 'No target mapping',
      });
      blocked += 1;
    }
  }

  let mappedDeb = 0;
  let mappedCred = 0;
  let amountsLost = 0;
  for (const [code, bal] of snapshot.postedGlBalances) {
    const row = glReadiness.find((r) => r.code === code);
    if (row?.status === 'RESOLVED_TO_TARGET_ACCOUNT') {
      mappedDeb += Number(bal.debit);
      mappedCred += Number(bal.credit);
    } else {
      amountsLost += Number(bal.debit) + Number(bal.credit);
    }
  }

  const legacyDeb = Number(snapshot.postedGlTotals.debit);
  const legacyCred = Number(snapshot.postedGlTotals.credit);
  const diff = mappedDeb - mappedCred;

  return {
    glReadiness,
    distinctPostedGlAccountCodes: snapshot.postedGlCodes.size,
    resolved,
    ownerApproved,
    partyDependent,
    ambiguous,
    blocked,
    balanceMappingPreview: {
      legacyDebit: legacyDeb.toFixed(2),
      legacyCredit: legacyCred.toFixed(2),
      mappedDebit: mappedDeb.toFixed(2),
      mappedCredit: mappedCred.toFixed(2),
      difference: diff.toFixed(2),
      amountsLost: amountsLost.toFixed(2),
    },
  };
}

function stripConnect(data: ReturnType<typeof transformMasterAccount>) {
  const { company: _c, ...rest } = data as typeof data & { company?: unknown };
  return rest;
}

async function isSemanticallyEquivalent(
  existing: Account,
  master: LegacyAccountMasterRow | undefined,
  derived: ClassifiedAccountReference | undefined,
  parentId: string | undefined
): Promise<{ ok: boolean; reason: string }> {
  if (master) {
    const expected = transformMasterAccount(master, existing.companyId);
    const rest = stripConnect(expected);
    if (existing.arabicName !== rest.arabicName && master.arabicName) {
      return { ok: false, reason: `Arabic name mismatch for code ${existing.code}` };
    }
    if (existing.accountKind !== rest.accountKind) {
      return { ok: false, reason: `accountKind mismatch for code ${existing.code}` };
    }
  }
  if (derived && existing.accountKind !== 'POSTING') {
    return { ok: false, reason: `Derived GL account ${existing.code} must be POSTING` };
  }
  if (parentId && existing.parentId && existing.parentId !== parentId) {
    return { ok: false, reason: `Parent mismatch for code ${existing.code}` };
  }
  return { ok: true, reason: 'Equivalent' };
}
