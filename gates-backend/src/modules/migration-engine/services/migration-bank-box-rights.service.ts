import type { MigrationContext } from '../migration-context';
import { legacyTableExists } from '../accounting-source-profile';
import { legacyTrim } from '../transforms/legacy-values';
import { companySettingService } from '../../platform/services/company-setting.service';

type LegacyBankBoxRow = {
  UserCode?: unknown;
  AccountCode?: unknown;
  Allow?: unknown;
  Type?: unknown;
  IsDefault?: unknown;
};

/** Preserve legacy BankBoxRights; link Safe/BankAccount when account resolves. UserCode has no User legacy key. */
export async function preserveLegacyBankBoxRights(ctx: MigrationContext): Promise<{
  preserved: number;
  linked: number;
  userBlocked: number;
}> {
  if (!(await legacyTableExists(ctx.source, 'BankBoxRights'))) {
    return { preserved: 0, linked: 0, userBlocked: 0 };
  }
  const rows = await ctx.source.querySql<LegacyBankBoxRow>(
    `SELECT RTRIM(UserCode) AS UserCode, RTRIM(AccountCode) AS AccountCode,
            RTRIM(Allow) AS Allow, RTRIM(Type) AS Type, RTRIM(IsDefault) AS IsDefault
     FROM dbo.BankBoxRights WHERE RTRIM(CompanyCode)=@cc`,
    { cc: ctx.legacyCompanyCode }
  );

  let preserved = 0;
  let linked = 0;
  let userBlocked = 0;

  for (const row of rows) {
    await ctx.throwIfPaused({ stage: 'TREASURY_HISTORICAL', entity: 'BankBoxRights' });
    const userCode = legacyTrim(row.UserCode);
    const accountCode = legacyTrim(row.AccountCode);
    if (!userCode || !accountCode) continue;

    const payload = JSON.stringify({
      userCode,
      accountCode,
      allow: legacyTrim(row.Allow),
      type: legacyTrim(row.Type),
      isDefault: legacyTrim(row.IsDefault),
    });
    const settingKey = `migration.legacyBankBoxRights.${userCode}.${accountCode}`;

    if (!ctx.dryRun) {
      await companySettingService.setEntry(ctx.targetCompanyId, settingKey, payload);
    }
    preserved += 1;
    userBlocked += 1;

    await ctx.issues.recordOnce({
      jobId: ctx.migrationJobId,
      stage: 'TREASURY_HISTORICAL',
      severity: 'INFO',
      category: 'BANK_BOX_USER_UNMAPPED',
      sourceEntity: 'BankBoxRights',
      sourceKey: `${userCode}|${accountCode}`,
      description:
        'Legacy UserCode has no GATES user mapping; row preserved in CompanySettingEntry. Account may link after owner maps users.',
    });

    const acctMap = await ctx.idMap.findMapping(ctx.migrationJobId, 'Account', {
      companyCode: ctx.legacyCompanyCode,
      accountCode,
    });
    if (acctMap && !ctx.dryRun) {
      linked += 1;
      await ctx.issues.recordOnce({
        jobId: ctx.migrationJobId,
        stage: 'TREASURY_HISTORICAL',
        severity: 'INFO',
        category: 'BANK_BOX_ACCOUNT_RESOLVED',
        sourceEntity: 'BankBoxRights',
        sourceKey: accountCode,
        description: `Account ${accountCode} mapped to target ${acctMap.targetId}; grant BankBoxRight after user mapping.`,
      });
    }
  }

  return { preserved, linked, userBlocked };
}
