import type { MigrationContext } from '../migration-context';
import { companySettingService, isLegacyTrue } from '../../platform/services/company-setting.service';
import { legacyTrim } from '../transforms/legacy-values';


const ACCOUNT_CODE_KEYS = new Set([
  'CustomersAccount',
  'SuppliersAccount',
  'SellAccount',
  'ReturnSellAccount',
  'PayAccount',
  'ReturnPayAccount',
  'BanksAccount',
  'BoxesAccount',
  'SalesTaxAccount',
  'CostAccount',
  'ProfitAccount',
]);

/** Proven legacy → CompanySettings / accountDefinitions mappings only. */
async function applyTypedMappings(ctx: MigrationContext): Promise<{
  applied: string[];
  unmappedReported: number;
}> {
  const companyId = ctx.targetCompanyId;
  const applied: string[] = [];

  const flag = async (legacyKey: string, update: (v: boolean) => Record<string, unknown>) => {
    const v = await companySettingService.getEntry(companyId, legacyKey);
    if (v == null) return;
    if (ctx.dryRun) {
      applied.push(legacyKey);
      return;
    }
    await ctx.prisma.companySettings.update({
      where: { companyId },
      data: update(isLegacyTrue(v)),
    });
    applied.push(legacyKey);
  };

  await flag('GLPost', (on) => ({ autoPostGl: on }));
  await flag('SaveUnbalanced', (on) => ({ allowNegativeBalance: on }));
  await flag('AllowMinusQty', (on) => ({ preventNegativeStock: !on }));
  await flag('SerialAutomaticGL', (on) => ({ autoNumbering: on }));

  const digits = await companySettingService.getEntry(companyId, 'DetailsAccountDigits');
  if (digits && !ctx.dryRun) {
    const n = parseInt(legacyTrim(digits), 10);
    if (Number.isFinite(n)) {
      await ctx.prisma.companySettings.update({
        where: { companyId },
        data: { accountsGuideDigits: n, journalEntryDigits: n },
      });
      applied.push('DetailsAccountDigits');
    }
  } else if (digits) applied.push('DetailsAccountDigits');

  const dateType = await companySettingService.getEntry(companyId, 'DateType');
  if (dateType) {
    const map: Record<string, string> = { G: 'gregorian', H: 'hijri', B: 'both' };
    const dt = map[legacyTrim(dateType).toUpperCase()] ?? 'gregorian';
    if (!ctx.dryRun) {
      await ctx.prisma.companySettings.update({ where: { companyId }, data: { dateUsage: dt } });
    }
    applied.push('DateType');
  }

  const currency = await companySettingService.getEntry(companyId, 'CurrencyCode');
  if (currency && legacyTrim(currency)) {
    if (!ctx.dryRun) {
      await ctx.prisma.companySettings.update({
        where: { companyId },
        data: { defaultCurrency: legacyTrim(currency) },
      });
    }
    applied.push('CurrencyCode');
  }

  const costMethod = await companySettingService.getEntry(companyId, 'CostType');
  if (costMethod) {
    const cm = legacyTrim(costMethod).toLowerCase();
    const mapped = cm.includes('fifo') ? 'fifo' : cm.includes('lifo') ? 'lifo' : 'average';
    if (!ctx.dryRun) {
      await ctx.prisma.companySettings.update({ where: { companyId }, data: { costMethod: mapped } });
    }
    applied.push('CostType');
  }

  const defs: Record<string, string> = {};
  for (const key of ACCOUNT_CODE_KEYS) {
    const v = await companySettingService.getEntry(companyId, key);
    const code = legacyTrim(v);
    if (!code || code.toLowerCase() === 'nothing') continue;
    defs[key] = code;
  }
  if (Object.keys(defs).length && !ctx.dryRun) {
    const existing = await ctx.prisma.companySettings.findUnique({
      where: { companyId },
      select: { accountDefinitions: true },
    });
    const prev =
      existing?.accountDefinitions && typeof existing.accountDefinitions === 'object'
        ? (existing.accountDefinitions as Record<string, string>)
        : {};
    await ctx.prisma.companySettings.update({
      where: { companyId },
      data: { accountDefinitions: { ...prev, ...defs } as object },
    });
    applied.push('accountDefinitions(*Account keys)');
  }

  const allEntries = await ctx.prisma.companySettingEntry.findMany({
    where: { companyId },
    select: { name: true },
  });
  let unmappedReported = 0;
  for (const row of allEntries) {
    if (applied.some((a) => row.name.startsWith(a) || a.includes(row.name))) continue;
    if (row.name.startsWith('legacyBalanceAccountsH.')) continue;
    if (row.name.startsWith('Serial')) continue;
    unmappedReported += 1;
    await ctx.issues.recordOnce({
      jobId: ctx.migrationJobId,
      stage: 'FOUNDATION',
      severity: 'INFO',
      category: 'COMPANY_SETTING_EAV_ONLY',
      sourceEntity: 'CompanySetting',
      sourceKey: row.name,
      description: `Legacy setting ${row.name} preserved in CompanySettingEntry only (no typed CompanySettings field mapped yet).`,
    });
  }

  return { applied, unmappedReported };
}

export async function bridgeLegacySettingsToTypedTargets(ctx: MigrationContext) {
  return applyTypedMappings(ctx);
}
