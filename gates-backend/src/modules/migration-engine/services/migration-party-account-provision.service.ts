/**
 * Party leaf accounts that exist only on the Customer / Supplier row.
 *
 * Some legacy Gates databases register a party's GL leaf (e.g. 1020101007) on the
 * Customer/Supplier row without a matching row in the `Account` master. The COA stage
 * classifies those codes as DEPENDENT_ON_FUTURE_PARTY_MIGRATION and leaves them to the
 * party stage; this service is that hand-off. It creates the POSTING leaf under the
 * longest mapped master prefix (which must be a HEADER in the target), named after the
 * party, and records the Account id-map so the accounting stage resolves it.
 *
 * It never guesses: no mapped parent, a POSTING parent, or a code already used in the
 * target leaves the code unresolved (the party stays DEPENDENT_ON_COA_MAPPING and
 * reconciliation blocks the run).
 */
import type { MigrationContext } from '../migration-context';
import { longestMasterPrefix } from '../coa/legacy-account-code';
import { loadLegacyCoaSnapshot, type LegacyAccountMasterRow } from './legacy-coa-data.service';
import type { LegacyPartySnapshot } from './legacy-party-data.service';
import type { PartyAccountResolution } from './migration-party-account.service';
import { transformDerivedGlAccount } from '../transforms/coa-transform';
import { DRY_RUN_PLANNED_TARGET_ID } from './migration-id-map.service';

export interface PartyLeafPlan {
  code: string;
  parentLegacyCode: string;
  parentTargetId: string;
  parentMaster: LegacyAccountMasterRow;
  arabicName: string;
}

/** Codes from the party rows that the target COA cannot resolve yet. */
function namesByCode(snapshot: LegacyPartySnapshot): Map<string, string> {
  const out = new Map<string, string>();
  for (const c of snapshot.customers) {
    if (c.accountCode && !out.has(c.accountCode)) out.set(c.accountCode, c.arabicName || c.customerCode);
  }
  for (const s of snapshot.suppliers) {
    if (s.accountCode && !out.has(s.accountCode)) out.set(s.accountCode, s.arabicName || s.supplierCode);
  }
  return out;
}

export async function planPartyLeafAccounts(
  ctx: MigrationContext,
  snapshot: LegacyPartySnapshot,
  missingCodes: string[]
): Promise<{ plans: PartyLeafPlan[]; unresolved: Array<{ code: string; reason: string }> }> {
  const plans: PartyLeafPlan[] = [];
  const unresolved: Array<{ code: string; reason: string }> = [];
  if (missingCodes.length === 0) return { plans, unresolved };

  const coa = await loadLegacyCoaSnapshot(ctx.source, ctx.legacyCompanyCode);
  const masters = new Map(coa.masters.map((m) => [m.accountCode, m]));
  const names = namesByCode(snapshot);

  for (const code of [...missingCodes].sort()) {
    const prefix = longestMasterPrefix(code, coa.masterCodes);
    if (!prefix || prefix === code) {
      unresolved.push({ code, reason: `No legacy master account is a prefix of ${code}` });
      continue;
    }
    const parentMaster = masters.get(prefix)!;
    const parentMap = await ctx.idMap.findMapping(ctx.migrationJobId, 'Account', {
      companyCode: ctx.legacyCompanyCode,
      accountCode: prefix,
    });
    const parent =
      parentMap?.targetId === DRY_RUN_PLANNED_TARGET_ID
        ? { id: DRY_RUN_PLANNED_TARGET_ID, accountKind: parentMaster.hasChild ? 'HEADER' : 'POSTING' }
        : parentMap?.targetId
          ? await ctx.prisma.account.findFirst({
              where: { id: parentMap.targetId, companyId: ctx.targetCompanyId, deletedAt: null },
              select: { id: true, accountKind: true },
            })
          : null;
    if (!parent) {
      unresolved.push({ code, reason: `Parent ${prefix} is not mapped to a target account` });
      continue;
    }
    if (parent.accountKind !== 'HEADER') {
      unresolved.push({ code, reason: `Parent ${prefix} is a POSTING account in the target` });
      continue;
    }
    plans.push({
      code,
      parentLegacyCode: prefix,
      parentTargetId: parent.id,
      parentMaster,
      arabicName: names.get(code) ?? `[GL] ${code}`,
    });
  }
  return { plans, unresolved };
}

/** Creates the planned leaves (execute only). Idempotent through the id-map and the code. */
export async function createPartyLeafAccount(
  ctx: MigrationContext,
  plan: PartyLeafPlan
): Promise<string> {
  const key = { companyCode: ctx.legacyCompanyCode, accountCode: plan.code };
  const mapped = await ctx.idMap.findMapping(ctx.migrationJobId, 'Account', key);
  if (mapped?.targetId) return mapped.targetId;

  const data = transformDerivedGlAccount(
    {
      code: plan.code,
      classification: 'DEPENDENT_ON_FUTURE_PARTY_MIGRATION',
      evidence: `Party leaf under ${plan.parentLegacyCode}`,
      masterAccountCode: plan.parentLegacyCode,
      suggestedArabicName: plan.arabicName,
      migratableInCoaStage: false,
    },
    ctx.targetCompanyId,
    plan.parentMaster
  );
  const created = await ctx.prisma.account.create({
    data: {
      companyId: ctx.targetCompanyId,
      parentId: plan.parentTargetId,
      code: data.code,
      arabicName: data.arabicName,
      englishName: null,
      accountType: data.accountType ?? null,
      accountSide: data.accountSide ?? null,
      accountNature: data.accountNature,
      accountKind: 'POSTING',
      statementType: data.statementType,
      requiresCostCenter: false,
      costCenterRequired: data.costCenterRequired ?? null,
      currencyCode: data.currencyCode ?? null,
      isActive: true,
      deletedAt: null,
    },
  });
  await ctx.idMap.recordMapping({
    jobId: ctx.migrationJobId,
    sourceEntity: 'Account',
    sourceKeyParts: key,
    targetModel: 'Account',
    targetId: created.id,
    outcome: 'CREATED_BY_MIGRATION',
  });
  return created.id;
}

export function derivedResolution(plan: PartyLeafPlan, targetAccountId?: string): PartyAccountResolution {
  return {
    legacyAccountCode: plan.code,
    classification: 'DERIVED_SAFE_ACCOUNT',
    targetAccountId,
    evidence: `Party leaf ${plan.code} created under legacy header ${plan.parentLegacyCode}`,
  };
}
