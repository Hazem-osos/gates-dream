import { Prisma, type SubcontractInvoice } from '@prisma/client';
import prisma from '../../../shared/database/prisma';
import { UnbalancedJournalEntryError } from '../../../shared/errors/unbalanced-journal-entry.error';
import type { JournalPostingContext } from '../../accounting/services/journal-posting.service';
import { journalPostingService } from '../../accounting/services/journal-posting.service';
import { documentSequenceService } from '../../platform/services/document-sequence.service';
import { fiscalYearService } from '../../platform/services/fiscal-year.service';
import { journalLines } from '../../trade/utils/journal-lines.util';
import { InvoiceAlreadyPostedError, SubcontractInvoiceNotFoundError } from '../errors/subcontract-domain.errors';
import { money, moneyZero, sumMoney } from '../utils/money-decimal';
import { subcontractAccountResolverService } from './subcontract-account-resolver.service';

type Db = Prisma.TransactionClient | typeof prisma;

function toLineAmount(value: Prisma.Decimal | string | number): number {
  return Number(money(value).toFixed(4));
}

export class SubcontractAccountingService {
  async postInvoiceToGeneralLedger(
    companyId: string,
    invoiceId: string,
    userId: string,
    ctx: JournalPostingContext
  ) {
    return prisma.$transaction((tx) => this.postInvoiceToGeneralLedgerInTx(tx, companyId, invoiceId, userId, ctx));
  }

  async postInvoiceToGeneralLedgerInTx(
    db: Db,
    companyId: string,
    invoiceId: string,
    _userId: string,
    ctx: JournalPostingContext
  ) {
    const invoice = await db.subcontractInvoice.findFirst({
      where: { id: invoiceId, companyId },
    });
    if (!invoice) throw new SubcontractInvoiceNotFoundError(companyId, invoiceId);
    if (invoice.journalEntryId) throw new InvoiceAlreadyPostedError(invoice.id);

    const accounts = await subcontractAccountResolverService.resolveAccounts(companyId);
    const linesSpec = this.buildInvoiceLines(invoice, accounts);
    this.assertBalanced(linesSpec);

    const date = invoice.periodEndDate;
    const fiscalYearId = ctx.fiscalYearId ?? (await fiscalYearService.assertOpenForDate(companyId, date));
    const legacyGlNum = await documentSequenceService.nextGlNumber({ ...ctx, fiscalYearId });

    const je = await journalPostingService.createAndPostInTx(db as Prisma.TransactionClient, { ...ctx, fiscalYearId }, {
      fiscalYearId,
      legacyGlNum,
      date,
      description: `مستخلص مقاول باطن ${invoice.invoiceNumber}`,
      currencyCode: 'EGP',
      exchangeRate: 1,
      entryType: 'SubcontractInvoice',
      sourceType: 'SUBCONTRACT_INVOICE',
      sourceNumber: invoice.invoiceNumber,
      lines: journalLines(linesSpec),
    });

    await db.subcontractInvoice.update({
      where: { id: invoice.id },
      data: { journalEntryId: je.id },
    });

    return je;
  }

  private buildInvoiceLines(
    invoice: SubcontractInvoice,
    accounts: Awaited<ReturnType<typeof subcontractAccountResolverService.resolveAccounts>>
  ) {
    const gross = money(invoice.grossCurrentAmount);
    const credits = [
      { accountId: accounts.advanceAccountId, amount: money(invoice.advancePaymentDeduction), description: 'أرصدة مدينة - دفعات مقدمة مقاولين' },
      { accountId: accounts.retentionAccountId, amount: money(invoice.retentionDeduction), description: 'أمانات محتجزة - تأمين حسن تنفيذ أعمال' },
      { accountId: accounts.whtAccountId, amount: money(invoice.taxWithholdingDeduction), description: 'مصلحة الضرائب - خصم وتحصيل أرباح تجارية 1%' },
      { accountId: accounts.socialAccountId, amount: money(invoice.socialInsuranceDeduction), description: 'الهيئة القومية للتأمين الاجتماعي - مقاولات' },
      { accountId: accounts.materialAccountId, amount: money(invoice.materialOveruseDeduction), description: 'مخزن خامات ومواد الموقع / تسوية هوالك' },
      { accountId: accounts.penaltyAccountId, amount: money(invoice.sitePenaltiesDeduction), description: 'إيرادات تشغيلية أخرى - غرامات ومخالفات مقاولين' },
      { accountId: accounts.directExecAccountId, amount: money(invoice.directExecutionDeduction), description: 'أعمال منفذة لحساب المقاول' },
      { accountId: accounts.earlyPayAccountId, amount: money(invoice.earlyPaymentDiscountDeduction), description: 'إيرادات مكتسبة - خصم تعجيل دفع' },
      { accountId: accounts.apAccountId, amount: money(invoice.netPayableAmount), description: 'أرصدة دائنة - حساب مقاول الباطن' },
    ];

    const creditTotal = sumMoney(credits.map((row) => row.amount));
    if (!creditTotal.eq(gross)) {
      throw new UnbalancedJournalEntryError(gross.toFixed(4), creditTotal.toFixed(4));
    }

    return [
      {
        accountId: accounts.wipAccountId,
        debit: toLineAmount(gross),
        credit: 0,
        description: 'مشروعات تحت التنفيذ - مقاولي باطن',
      },
      ...credits
        .filter((row) => row.amount.gt(0))
        .map((row) => ({
          accountId: row.accountId,
          debit: 0,
          credit: toLineAmount(row.amount),
          description: row.description,
        })),
    ];
  }

  private assertBalanced(lines: Array<{ debit: number; credit: number }>) {
    const totalDebits = lines.reduce((acc, line) => acc.plus(money(line.debit)), moneyZero());
    const totalCredits = lines.reduce((acc, line) => acc.plus(money(line.credit)), moneyZero());
    if (!totalDebits.eq(totalCredits)) {
      throw new UnbalancedJournalEntryError(totalDebits.toFixed(4), totalCredits.toFixed(4));
    }
  }
}

export const subcontractAccountingService = new SubcontractAccountingService();
