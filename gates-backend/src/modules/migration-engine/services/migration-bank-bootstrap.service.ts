import type { MigrationContext } from '../migration-context';
import { normalizeLegacyAccountCode } from '../coa/legacy-account-code';
import { loadDistinctLegacyBankAccountCodes } from './legacy-foundation-ext.service';
import { legacyTrim } from '../transforms/legacy-values';

const LEGACY_BANK_CODE = 'LEGACY';

/** Legacy has no Bank master table — bank boxes are GL accounts referenced by BankAccountNo. */
export async function bootstrapLegacyBankAccounts(ctx: MigrationContext): Promise<{ created: number; linked: number }> {
  const accountCodes = await loadDistinctLegacyBankAccountCodes(ctx.source, ctx.legacyCompanyCode);
  if (!accountCodes.length) return { created: 0, linked: 0 };

  let created = 0;
  let linked = 0;

  if (ctx.dryRun) return { created: accountCodes.length, linked: accountCodes.length };

  let bank = await ctx.prisma.bank.findFirst({
    where: { companyId: ctx.targetCompanyId, code: LEGACY_BANK_CODE },
  });
  if (!bank) {
    bank = await ctx.prisma.bank.create({
      data: {
        companyId: ctx.targetCompanyId,
        code: LEGACY_BANK_CODE,
        arabicName: 'بنوك (ترحيل)',
        englishName: 'Legacy migrated banks',
      },
    });
  }

  for (const raw of accountCodes) {
    const accountCode = normalizeLegacyAccountCode(raw);
    const key = { companyCode: ctx.legacyCompanyCode, bankAccountCode: accountCode };
    if (await ctx.idMap.findMapping(ctx.migrationJobId, 'LegacyBankAccount', key)) {
      linked += 1;
      continue;
    }

    const accountMap = await ctx.idMap.findMapping(ctx.migrationJobId, 'Account', {
      companyCode: ctx.legacyCompanyCode,
      accountCode,
    });
    const glAccountId = accountMap?.targetId ?? null;
    if (!glAccountId) {
      await ctx.issues.recordOnce({
        jobId: ctx.migrationJobId,
        stage: 'FOUNDATION',
        severity: 'WARNING',
        category: 'BANK_ACCOUNT_GL_UNMAPPED',
        sourceEntity: 'BankAccountNo',
        sourceKey: accountCode,
        description: `BankAccountNo ${accountCode} has no COA Account mapping — bank box skipped`,
      });
      continue;
    }

    const acct = await ctx.prisma.account.findUnique({
      where: { id: glAccountId },
      select: { code: true, arabicName: true, englishName: true, currencyCode: true },
    });
    if (!acct) continue;

    const ba = await ctx.prisma.bankAccount.upsert({
      where: { companyId_code: { companyId: ctx.targetCompanyId, code: accountCode } },
      update: { glAccountId, isActive: true },
      create: {
        companyId: ctx.targetCompanyId,
        bankId: bank.id,
        code: accountCode,
        arabicName: acct.arabicName || accountCode,
        englishName: acct.englishName,
        accountNumber: legacyTrim(raw) || accountCode,
        currencyCode: acct.currencyCode || 'EGP',
        glAccountId,
      },
    });
    created += 1;
    linked += 1;
    await ctx.idMap.recordMapping({
      jobId: ctx.migrationJobId,
      sourceEntity: 'LegacyBankAccount',
      sourceKeyParts: key,
      targetModel: 'BankAccount',
      targetId: ba.id,
      outcome: 'CREATED_BY_MIGRATION',
    });
  }

  return { created, linked };
}

export async function resolveBankAccountIdForLegacyCode(
  ctx: MigrationContext,
  bankAccountNo: string
): Promise<string | null> {
  const accountCode = normalizeLegacyAccountCode(bankAccountNo);
  const map = await ctx.idMap.findMapping(ctx.migrationJobId, 'LegacyBankAccount', {
    companyCode: ctx.legacyCompanyCode,
    bankAccountCode: accountCode,
  });
  return map?.targetId ?? null;
}
