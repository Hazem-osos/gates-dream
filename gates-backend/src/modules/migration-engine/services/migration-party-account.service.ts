import type { MigrationContext } from '../migration-context';

export type PartyAccountLinkClass =
  | 'EXACT_COA_ACCOUNT'
  | 'DERIVED_SAFE_ACCOUNT'
  | 'SHARED_CONTROL_ACCOUNT'
  | 'MISSING_ACCOUNT'
  | 'AMBIGUOUS_ACCOUNT';

export interface PartyAccountResolution {
  legacyAccountCode: string;
  classification: PartyAccountLinkClass;
  targetAccountId?: string;
  evidence: string;
}

export async function resolvePartyLegacyAccount(
  ctx: MigrationContext,
  legacyAccountCode: string
): Promise<PartyAccountResolution> {
  const code = legacyAccountCode.trim();
  if (!code) {
    return {
      legacyAccountCode: code,
      classification: 'MISSING_ACCOUNT',
      evidence: 'Blank legacy AccountCode',
    };
  }

  const map = await ctx.idMap.findMapping(ctx.migrationJobId, 'Account', {
    companyCode: ctx.legacyCompanyCode,
    accountCode: code,
  });
  if (map?.targetId) {
    const acc = await ctx.prisma.account.findFirst({
      where: { id: map.targetId, companyId: ctx.targetCompanyId, deletedAt: null },
    });
    if (acc) {
      return classifyTargetAccount(code, acc);
    }
  }

  const byCode = await ctx.prisma.account.findFirst({
    where: { companyId: ctx.targetCompanyId, code, deletedAt: null },
  });
  if (byCode) {
    return classifyTargetAccount(code, byCode);
  }

  return {
    legacyAccountCode: code,
    classification: 'MISSING_ACCOUNT',
    evidence: `No target Account for legacy code ${code} (COA stage must map master first)`,
  };
}

function classifyTargetAccount(
  code: string,
  acc: { id: string; accountKind: string; code: string }
): PartyAccountResolution {
  if (acc.accountKind === 'HEADER') {
    return {
      legacyAccountCode: code,
      classification: 'SHARED_CONTROL_ACCOUNT',
      targetAccountId: acc.id,
      evidence: `Target account ${acc.code} is HEADER — party leaf requires POSTING account`,
    };
  }
  return {
    legacyAccountCode: code,
    classification: 'EXACT_COA_ACCOUNT',
    targetAccountId: acc.id,
    evidence: `Resolved to POSTING account ${acc.code}`,
  };
}
