import { Prisma } from '@prisma/client';
import prisma from '../../../shared/database/prisma';
import { UnbalancedJournalEntryError } from '../../../shared/errors/unbalanced-journal-entry.error';
import { AppError } from '../../../shared/middleware/error-handler';
import type { JournalPostingContext } from '../../accounting/services/journal-posting.service';
import { journalPostingService } from '../../accounting/services/journal-posting.service';
import { documentSequenceService } from '../../platform/services/document-sequence.service';
import { fiscalYearService } from '../../platform/services/fiscal-year.service';
import { journalLines } from '../../trade/utils/journal-lines.util';
import { money, moneyMax, moneyMin, moneyZero } from '../utils/money-decimal';
import { realEstateAccountResolverService } from './real-estate-account-resolver.service';

type Db = Prisma.TransactionClient | typeof prisma;

function toLineAmount(value: Prisma.Decimal | string | number): number {
  return Number(money(value).toFixed(4));
}

function assertBalanced(lines: Array<{ debit: number; credit: number }>) {
  const totalDebits = lines.reduce((acc, line) => acc.plus(money(line.debit)), moneyZero());
  const totalCredits = lines.reduce((acc, line) => acc.plus(money(line.credit)), moneyZero());
  if (!totalDebits.eq(totalCredits)) {
    throw new UnbalancedJournalEntryError(totalDebits.toFixed(4), totalCredits.toFixed(4));
  }
}

export class RealEstateAccountingService {
  async postPdcClearance(companyId: string, chequeId: string, ctx: JournalPostingContext) {
    return prisma.$transaction((tx) => this.postPdcClearanceInTx(tx, companyId, chequeId, ctx));
  }

  async postPdcClearanceInTx(db: Db, companyId: string, chequeId: string, ctx: JournalPostingContext) {
    const cheque = await db.postDatedCheque.findFirst({
      where: { id: chequeId, companyId },
      include: { contract: { select: { customerId: true, contractNumber: true } } },
    });
    if (!cheque) throw new AppError(404, 'Post-dated cheque not found');
    if (cheque.journalEntryId) throw new AppError(409, 'Cheque already posted to GL');

    const accounts = await realEstateAccountResolverService.resolveAccounts(companyId);
    const bankAccountId = await this.resolveBankGlAccountId(companyId, accounts.bankAccountId);
    const amount = money(cheque.amount);
    const lines = journalLines([
      { accountId: bankAccountId, debit: toLineAmount(amount), credit: 0, description: 'البنك - الحساب الجاري' },
      {
        accountId: accounts.pdcUnderCollectionAccountId,
        debit: 0,
        credit: toLineAmount(amount),
        description: 'أوراق قبض برسم التحصيل',
      },
    ]);
    assertBalanced(lines);

    const je = await this.post(db, ctx, {
      date: cheque.collectionDate ?? new Date(),
      description: `تحصيل شيك ${cheque.chequeNumber}`,
      sourceType: 'PDC_CLEARED',
      sourceNumber: cheque.chequeNumber,
      entryType: 'PdcClearance',
      lines,
    });

    await db.postDatedCheque.update({
      where: { id: cheque.id },
      data: { journalEntryId: je.id },
    });

    return je;
  }

  async postResaleAssignmentFee(companyId: string, resaleTransferId: string, ctx: JournalPostingContext) {
    const transfer = await prisma.unitResaleTransfer.findFirst({
      where: { id: resaleTransferId, contract: { companyId } },
    });
    if (!transfer) throw new AppError(404, 'Resale transfer not found');

    const accounts = await realEstateAccountResolverService.resolveAccounts(companyId);
    const amount = money(transfer.assignmentFeeAmount);
    const lines = journalLines([
      {
        accountId: accounts.cashAccountId,
        debit: toLineAmount(amount),
        credit: 0,
        description: 'الصندوق / البنك',
      },
      {
        accountId: accounts.assignmentFeeRevenueAccountId,
        debit: 0,
        credit: toLineAmount(amount),
        description: 'إيرادات متنوعة - رسوم تنازل وتعديل عقود',
      },
    ]);
    assertBalanced(lines);

    return this.post(prisma, ctx, {
      date: transfer.updatedAt,
      description: `رسوم تنازل ${transfer.id}`,
      sourceType: 'RESALE_ASSIGNMENT_FEE',
      sourceNumber: transfer.id,
      entryType: 'ResaleAssignmentFee',
      lines,
    });
  }

  async postCancellationForfeiture(companyId: string, cancellationId: string, ctx: JournalPostingContext) {
    const settlement = await prisma.unitCancellationSettlement.findFirst({
      where: { id: cancellationId, contract: { companyId } },
    });
    if (!settlement) throw new AppError(404, 'Cancellation settlement not found');

    const accounts = await realEstateAccountResolverService.resolveAccounts(companyId);
    const paid = money(settlement.totalAmountPaidByClient);
    const penalty = money(settlement.forfeiturePenaltyAmount);
    const refund = money(settlement.netRefundableToClient);
    const recognized = moneyMin(paid, penalty);
    const residualRefund = moneyMax(moneyZero(), money(paid.minus(recognized)));

    const lines = journalLines([
      {
        accountId: accounts.realEstateArAccountId,
        debit: toLineAmount(paid),
        credit: 0,
        description: 'تسوية متحصلات العميل عند الإلغاء',
      },
      {
        accountId: accounts.forfeitureRevenueAccountId,
        debit: 0,
        credit: toLineAmount(recognized),
        description: 'إيرادات استقطاعات وإلغاءات تعاقدية',
      },
      {
        accountId: accounts.customerRefundPayableAccountId,
        debit: 0,
        credit: toLineAmount(residualRefund.eq(refund) ? refund : residualRefund),
        description: 'أرصدة دائنة معلقة للعملاء',
      },
    ]);
    assertBalanced(lines);

    return this.post(prisma, ctx, {
      date: settlement.cancellationDate,
      description: `إلغاء تعاقد ومصادرة ${settlement.id}`,
      sourceType: 'UNIT_CANCELLATION',
      sourceNumber: settlement.id,
      entryType: 'UnitCancellation',
      lines,
    });
  }

  async postRentalDistribution(companyId: string, distributionId: string, ctx: JournalPostingContext) {
    const distribution = await prisma.rentalDistribution.findFirst({
      where: { id: distributionId, agreement: { companyId } },
    });
    if (!distribution) throw new AppError(404, 'Rental distribution not found');

    const accounts = await realEstateAccountResolverService.resolveAccounts(companyId);
    const gross = money(distribution.grossRentReceived);
    const opex = money(distribution.maintenanceOperatingExpense);
    const fee = money(distribution.developerManagementFee);
    const owner = money(distribution.netDistributedAmount);

    const lines = journalLines([
      { accountId: accounts.bankAccountId, debit: toLineAmount(gross), credit: 0, description: 'إيجار محصل' },
      {
        accountId: accounts.rentalOpexAccountId,
        debit: 0,
        credit: toLineAmount(opex),
        description: 'مصروفات التشغيل واحتياطي الصيانة',
      },
      {
        accountId: accounts.rentalManagementFeeAccountId,
        debit: 0,
        credit: toLineAmount(fee),
        description: 'إيراد أتعاب إدارة المطور',
      },
      {
        accountId: accounts.ownerPayableAccountId,
        debit: 0,
        credit: toLineAmount(owner),
        description: 'مستحقات ملاك الوحدات',
      },
    ]);
    assertBalanced(lines);

    return this.post(prisma, ctx, {
      date: distribution.distributedAt ?? new Date(),
      description: `توزيع إيجار ${distribution.id}`,
      sourceType: 'RENTAL_POOL_DISTRIBUTION',
      sourceNumber: distribution.id,
      entryType: 'RentalDistribution',
      lines,
    });
  }

  private async resolveBankGlAccountId(companyId: string, fallbackAccountId: string): Promise<string> {
    const bank = await prisma.bankAccount.findFirst({
      where: { companyId, isActive: true, glAccountId: { not: null } },
      select: { glAccountId: true },
    });
    return bank?.glAccountId ?? fallbackAccountId;
  }

  private async post(
    db: Db,
    ctx: JournalPostingContext,
    data: {
      date: Date;
      description: string;
      sourceType: string;
      sourceNumber: string;
      entryType: string;
      lines: ReturnType<typeof journalLines>;
    }
  ) {
    const fiscalYearId = ctx.fiscalYearId ?? (await fiscalYearService.assertOpenForDate(ctx.companyId, data.date));
    const legacyGlNum = await documentSequenceService.nextGlNumber({ ...ctx, fiscalYearId });
    return journalPostingService.createAndPostInTx(db as Prisma.TransactionClient, { ...ctx, fiscalYearId }, {
      fiscalYearId,
      legacyGlNum,
      date: data.date,
      description: data.description,
      currencyCode: 'EGP',
      exchangeRate: 1,
      entryType: data.entryType,
      sourceType: data.sourceType,
      sourceNumber: data.sourceNumber,
      lines: data.lines,
    });
  }
}

export const realEstateAccountingService = new RealEstateAccountingService();
