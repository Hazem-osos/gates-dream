import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import type { LegacyAccountOverrideRecord } from '../policies/approved-legacy-account-overrides';
import { normalizeLegacyAccountCode } from '../coa/legacy-account-code';
import type { MigrationContext } from '../migration-context';
import {
  OWNER_APPROVED_LEGACY_ACCOUNT_OVERRIDES,
  type ApprovedLegacyAccountOverrideSeed,
} from '../policies/approved-legacy-account-overrides';
import type { GlPostedAccountResolution } from '../types';

export class LegacyAccountOverrideError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LegacyAccountOverrideError';
  }
}

export interface ResolvedOverrideTarget {
  targetAccountId: string;
  targetLegacyAccountCode: string;
  accountKind: string;
  resolutionClassification: GlPostedAccountResolution;
  override: LegacyAccountOverrideRecord;
}

export async function ensureOwnerApprovedOverrideCatalog(
  prisma: PrismaClient,
  targetCompanyId: string
): Promise<LegacyAccountOverrideRecord[]> {
  const out: LegacyAccountOverrideRecord[] = [];
  for (const seed of OWNER_APPROVED_LEGACY_ACCOUNT_OVERRIDES) {
    const legacyAccountCode = normalizeLegacyAccountCode(seed.legacyAccountCode);
    const sourceCompanyCode = seed.sourceCompanyCode.trim();
    const existing = await prisma.legacyAccountOverride.findUnique({
      where: {
        targetCompanyId_sourceCompanyCode_legacyAccountCode: {
          targetCompanyId,
          sourceCompanyCode,
          legacyAccountCode,
        },
      },
    });
    if (existing) {
      out.push(existing);
      continue;
    }
    const created = await prisma.legacyAccountOverride.create({
      data: {
        id: randomUUID(),
        targetCompanyId,
        sourceCompanyCode,
        legacyAccountCode,
        targetLegacyAccountCode: normalizeLegacyAccountCode(seed.targetLegacyAccountCode),
        decisionType: seed.decisionType,
        mappingClassification: seed.mappingClassification,
        reason: seed.reason,
        approvedBy: seed.approvedBy,
        approvedAt: seed.approvedAt,
        evidenceReference: seed.evidenceReference,
      },
    });
    out.push(created);
  }
  return out;
}

export async function loadOverrideMapForJob(
  prisma: PrismaClient,
  targetCompanyId: string,
  sourceCompanyCode: string
): Promise<Map<string, LegacyAccountOverrideRecord>> {
  const rows = await prisma.legacyAccountOverride.findMany({
    where: { targetCompanyId, sourceCompanyCode: sourceCompanyCode.trim() },
  });
  return new Map(
    (rows as LegacyAccountOverrideRecord[]).map((r) => [
      normalizeLegacyAccountCode(r.legacyAccountCode),
      r,
    ])
  );
}

export async function resolveTargetAccountViaCoaMapping(
  ctx: MigrationContext,
  targetLegacyAccountCode: string
): Promise<{ id: string; code: string; accountKind: string } | null> {
  const code = normalizeLegacyAccountCode(targetLegacyAccountCode);
  const map = await ctx.idMap.findMapping(ctx.migrationJobId, 'Account', {
    companyCode: ctx.legacyCompanyCode,
    accountCode: code,
  });
  if (map) {
    const acc = await ctx.prisma.account.findFirst({
      where: { id: map.targetId, companyId: ctx.targetCompanyId, deletedAt: null },
    });
    if (acc) return { id: acc.id, code: acc.code, accountKind: acc.accountKind };
  }
  const byCode = await ctx.prisma.account.findFirst({
    where: { companyId: ctx.targetCompanyId, code, deletedAt: null },
  });
  if (byCode) return { id: byCode.id, code: byCode.code, accountKind: byCode.accountKind };
  return null;
}

export function assertOverrideTargetPostingAccount(
  account: { id: string; code: string; accountKind: string },
  override: Pick<LegacyAccountOverrideRecord, 'legacyAccountCode' | 'targetLegacyAccountCode'>
): void {
  if (account.accountKind !== 'POSTING') {
    throw new LegacyAccountOverrideError(
      `Override ${override.legacyAccountCode} → ${override.targetLegacyAccountCode}: target ${account.code} is ${account.accountKind}, not POSTING`
    );
  }
}

export async function resolveOwnerApprovedOverride(
  ctx: MigrationContext,
  override: LegacyAccountOverrideRecord
): Promise<ResolvedOverrideTarget | null> {
  if (override.sourceCompanyCode.trim() !== ctx.legacyCompanyCode.trim()) {
    return null;
  }
  if (override.targetCompanyId !== ctx.targetCompanyId) {
    return null;
  }
  const target = await resolveTargetAccountViaCoaMapping(ctx, override.targetLegacyAccountCode);
  if (!target) return null;
  try {
    assertOverrideTargetPostingAccount(target, override);
  } catch {
    return null;
  }
  return {
    targetAccountId: target.id,
    targetLegacyAccountCode: target.code,
    accountKind: target.accountKind,
    resolutionClassification: 'OWNER_APPROVED_MAPPING',
    override,
  };
}

export async function syncOwnerApprovedPostedGlMappings(ctx: MigrationContext): Promise<{
  overridesEnsured: number;
  mappingsRecorded: number;
  skippedDryRun: boolean;
}> {
  const overrides = await ensureOwnerApprovedOverrideCatalog(ctx.prisma, ctx.targetCompanyId);
  if (ctx.dryRun) {
    return { overridesEnsured: overrides.length, mappingsRecorded: 0, skippedDryRun: true };
  }

  let mappingsRecorded = 0;
  for (const override of overrides) {
    if (override.sourceCompanyCode.trim() !== ctx.legacyCompanyCode.trim()) continue;

    const resolved = await resolveOwnerApprovedOverride(ctx, override);
    if (!resolved) {
      throw new LegacyAccountOverrideError(
        `Cannot resolve owner override ${override.legacyAccountCode}: target legacy account ${override.targetLegacyAccountCode} is not mapped to a POSTING account`
      );
    }

    await ctx.prisma.legacyAccountOverride.update({
      where: { id: override.id },
      data: { targetAccountId: resolved.targetAccountId },
    });

    const legacyCode = normalizeLegacyAccountCode(override.legacyAccountCode);
    const existingCoaAccount = await ctx.prisma.account.findFirst({
      where: { companyId: ctx.targetCompanyId, code: legacyCode, deletedAt: null },
    });
    if (existingCoaAccount) {
      throw new LegacyAccountOverrideError(
        `Override ${legacyCode} must not exist as a migrated COA account (found id ${existingCoaAccount.id})`
      );
    }

    const key = { companyCode: ctx.legacyCompanyCode, accountCode: legacyCode };
    const prior = await ctx.idMap.findMapping(ctx.migrationJobId, 'Account', key);
    if (prior && prior.targetId !== resolved.targetAccountId) {
      throw new LegacyAccountOverrideError(
        `Override mapping conflict for ${legacyCode}: existing target ${prior.targetId}`
      );
    }
    if (!prior) {
      await ctx.idMap.recordMapping({
        jobId: ctx.migrationJobId,
        sourceEntity: 'Account',
        sourceKeyParts: key,
        targetModel: 'Account',
        targetId: resolved.targetAccountId,
        outcome: 'OWNER_APPROVED_MAPPING',
        readOnly: true,
      });
      mappingsRecorded += 1;
    }
  }

  return { overridesEnsured: overrides.length, mappingsRecorded, skippedDryRun: false };
}

export function buildOwnerApprovedReadinessReason(override: LegacyAccountOverrideRecord): string {
  return [
    'OWNER_APPROVED_MAPPING',
    override.decisionType,
    `legacy=${override.legacyAccountCode}`,
    `targetLegacy=${override.targetLegacyAccountCode}`,
    `evidence=${override.evidenceReference}`,
    `approvedBy=${override.approvedBy}`,
    `approvedAt=${override.approvedAt.toISOString()}`,
  ].join('; ');
}

export function seedMatchesCompany(
  seed: ApprovedLegacyAccountOverrideSeed,
  sourceCompanyCode: string,
  legacyAccountCode: string
): boolean {
  return (
    seed.sourceCompanyCode === sourceCompanyCode &&
    normalizeLegacyAccountCode(seed.legacyAccountCode) === normalizeLegacyAccountCode(legacyAccountCode)
  );
}
