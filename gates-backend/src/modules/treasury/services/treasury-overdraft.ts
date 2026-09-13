import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { treasuryAccountResolverService } from './treasury-account-resolver.service';

export async function assertCashOverdraftAllowed(params: {
  companyId: string;
  amount: number;
  safeId?: string | null;
  bankAccountId?: string | null;
  accountId?: string | null;
}): Promise<void> {
  const settings = await prisma.companySettings.findUnique({
    where: { companyId: params.companyId },
    select: { preventCashOverdraft: true },
  });
  if (settings?.preventCashOverdraft !== true) return;

  let glAccountId: string | undefined;
  if (params.safeId) {
    glAccountId = await treasuryAccountResolverService.resolveSafeGlAccountId(
      params.companyId,
      params.safeId
    );
  } else if (params.bankAccountId) {
    glAccountId = await treasuryAccountResolverService.resolveBankGlAccountId(
      params.companyId,
      params.bankAccountId
    );
  } else if (params.accountId) {
    glAccountId = params.accountId;
  }
  if (!glAccountId) return;

  const agg = await prisma.accountPeriodBalance.aggregate({
    where: { companyId: params.companyId, accountId: glAccountId },
    _sum: { netBalance: true },
  });
  const balance = Number(agg._sum.netBalance ?? 0);
  if (balance + 1e-6 < params.amount) {
    throw new AppError(
      422,
      'رصيد الخزينة غير كافٍ لإتمام سند الصرف (الحماية من السحب بالسالب مفعّلة)'
    );
  }
}
