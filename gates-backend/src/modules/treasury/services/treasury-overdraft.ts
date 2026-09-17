import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { overlayFundBalanceFromLedger } from './fund-ledger-balance';

/**
 * Same number the voucher picker shows: posted GL net on the safe/bank account
 * (includes opening and daily journals, plus سند قبض/صرف).
 */
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

  const needed = Number(params.amount);
  if (!(needed > 0)) return;

  let balance = 0;
  let label = 'الخزينة';

  if (params.safeId) {
    const safe = await prisma.safe.findFirst({
      where: { id: params.safeId, companyId: params.companyId },
      select: { balance: true, arabicName: true, glAccountId: true },
    });
    if (!safe) {
      throw new AppError(404, 'الخزينة غير موجودة');
    }
    const live = await overlayFundBalanceFromLedger(params.companyId, safe);
    balance = live.balance;
    label = safe.arabicName?.trim() || 'الخزينة';
  } else if (params.bankAccountId) {
    const bank = await prisma.bankAccount.findFirst({
      where: { id: params.bankAccountId, companyId: params.companyId },
      select: { balance: true, arabicName: true, glAccountId: true },
    });
    if (!bank) {
      throw new AppError(404, 'الحساب البنكي غير موجود');
    }
    const live = await overlayFundBalanceFromLedger(params.companyId, bank);
    balance = live.balance;
    label = bank.arabicName?.trim() || 'البنك';
  } else {
    return;
  }

  if (balance + 1e-6 < needed) {
    throw new AppError(
      422,
      `رصيد ${label} غير كافٍ لإتمام سند الصرف. الرصيد الحالي ${balance.toFixed(2)} والمطلوب ${needed.toFixed(2)}.`
    );
  }
}
