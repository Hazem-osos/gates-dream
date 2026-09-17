import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { isPostingAccountKind } from './account-kind';
import { treasuryAccountResolverService } from '../../treasury/services/treasury-account-resolver.service';
import type { SecuritiesCollectKind } from './securities-collect-lines';

export type { SecuritiesCollectKind };
export { buildSecuritiesCollectJournalLines } from './securities-collect-lines';

export async function assertCompanyPostingAccount(companyId: string, accountId: string): Promise<string> {
  const account = await prisma.account.findFirst({
    where: { id: accountId, companyId, deletedAt: null },
    select: { id: true, accountKind: true, isActive: true },
  });
  if (!account) {
    throw new AppError(422, 'حساب التحصيل غير موجود');
  }
  if (!account.isActive) {
    throw new AppError(422, 'حساب التحصيل غير نشط');
  }
  if (!isPostingAccountKind(account.accountKind)) {
    throw new AppError(422, 'اختر حساباً تفصيلياً للتحصيل');
  }
  return account.id;
}

/** Notes-in-hand / notes-payable, or the paper's own destination account. */
export async function resolveSecuritiesNotesAccount(
  companyId: string,
  kind: SecuritiesCollectKind,
  fallbackAccountId?: string | null
): Promise<string> {
  try {
    const cheque = await treasuryAccountResolverService.resolveChequeAccounts(companyId);
    return kind === 'receipt' ? cheque.chequesUnderHandAccountId : cheque.notesPayableAccountId;
  } catch (error) {
    if (fallbackAccountId) {
      return assertCompanyPostingAccount(companyId, fallbackAccountId);
    }
    if (error instanceof AppError) {
      throw new AppError(
        422,
        'اختر حساب التحصيل (خزينة أو بنك). حسابات الشيكات غير مضبوطة في إعدادات الشركة.'
      );
    }
    throw error;
  }
}
