import { Prisma, type ClientInvoice } from '@prisma/client';
import prisma from '../../../../shared/database/prisma';
import { UnbalancedJournalEntryError } from '../../../../shared/errors/unbalanced-journal-entry.error';
import type { JournalPostingContext } from '../../../accounting/services/journal-posting.service';
import { journalPostingService } from '../../../accounting/services/journal-posting.service';
import { documentSequenceService } from '../../../platform/services/document-sequence.service';
import { fiscalYearService } from '../../../platform/services/fiscal-year.service';
import { journalLines } from '../../../trade/utils/journal-lines.util';
import { contractingAccountResolverService } from '../../services/contracting-account-resolver.service';
import { money, moneyZero, sumMoney } from '../../utils/money-decimal';
import {
  ClientInvoiceAlreadyPostedError,
  ClientInvoiceNotFoundError,
} from '../errors/client-billing-domain.errors';

type Db = Prisma.TransactionClient | typeof prisma;

type JournalLineSpec = {
  accountId: string;
  debit: number;
  credit: number;
  description: string;
};

export class ClientBillingAccountingService {
  async postClientInvoiceToGeneralLedger(
    companyId: string,
    invoiceId: string,
    userId: string,
    branchId: string
  ) {
    return prisma.$transaction((tx) =>
      this.postClientInvoiceToGeneralLedgerInTx(tx, companyId, invoiceId, userId, branchId)
    );
  }

  async postClientInvoiceToGeneralLedgerInTx(
    db: Db,
    companyId: string,
    invoiceId: string,
    userId: string,
    branchId: string
  ) {
    const invoice = await db.clientInvoice.findFirst({
      where: { id: invoiceId, companyId },
      include: { clientContract: true },
    });
    if (!invoice) throw new ClientInvoiceNotFoundError(companyId, invoiceId);
    if (invoice.journalEntryId) throw new ClientInvoiceAlreadyPostedError(invoice.id);

    const accounts = await contractingAccountResolverService.resolveAccounts(companyId);
    const lines = this.buildInvoiceLines(invoice, accounts);
    this.assertBalanced(lines);

    const date = invoice.periodEndDate;
    const fiscalYearId = await fiscalYearService.assertOpenForDate(companyId, date);
    const ctx: JournalPostingContext = { companyId, userId, branchId, fiscalYearId };
    const legacyGlNum = await documentSequenceService.nextGlNumberInTx(
      db as Prisma.TransactionClient,
      ctx
    );

    const je = await journalPostingService.createAndPostInTx(db as Prisma.TransactionClient, ctx, {
      fiscalYearId,
      legacyGlNum,
      date,
      description: `مستخلص مالك ${invoice.invoiceNumber}`,
      currencyCode: 'EGP',
      exchangeRate: 1,
      entryType: 'ClientInvoice',
      sourceType: 'CLIENT_INVOICE',
      sourceNumber: invoice.invoiceNumber.slice(0, 30),
      lines: journalLines(lines),
    });

    await db.clientInvoice.update({
      where: { id: invoice.id },
      data: { journalEntryId: je.id },
    });

    return je;
  }

  private buildInvoiceLines(
    invoice: ClientInvoice,
    accounts: Awaited<ReturnType<typeof contractingAccountResolverService.resolveAccounts>>
  ): JournalLineSpec[] {
    const netPayable = money(invoice.netPayableByClient);
    const retention = money(invoice.retentionDeduction);
    const advance = money(invoice.advancePaymentRecovery);
    const stamps = money(invoice.engineeringStampsDeduction);
    const penalties = money(invoice.otherClientPenalties);
    const works = money(invoice.grossCurrentWorks);
    const netMos = money(invoice.materialsOnSiteCurrent).minus(invoice.materialsOnSiteDeduction);

    const lines: JournalLineSpec[] = [];
    pushSigned(lines, accounts.clientReceivableAccountId, netPayable, 'debit', 'حسابات مدينة - عملاء عقود مقاولات');
    pushSigned(
      lines,
      accounts.retentionHeldByOthersAccountId,
      retention,
      'debit',
      'أرصدة مدينة - تأمين حسن تنفيذ محتجز لدى العملاء'
    );
    pushSigned(
      lines,
      accounts.customerAdvanceAccountId,
      advance,
      'debit',
      'دفعات مقدمة من العملاء'
    );
    pushSigned(
      lines,
      accounts.engineeringStampsExpenseAccountId,
      stamps,
      'debit',
      'مصروفات دمغات نقابة المهندسين والتطبيقية'
    );
    pushSigned(
      lines,
      accounts.penaltiesExpenseAccountId,
      penalties,
      'debit',
      'غرامات وخصومات الاستشاري والعميل'
    );
    pushSigned(lines, accounts.contractingRevenueAccountId, works, 'credit', 'إيرادات عقود وأعمال مقاولات منجزة');
    pushSigned(
      lines,
      accounts.materialsOnSiteAccountId,
      netMos,
      'credit',
      'تشوينات خامات معتمدة بالموقع'
    );

    return lines;
  }

  private assertBalanced(lines: JournalLineSpec[]) {
    const totalDebits = sumMoney(lines.map((line) => line.debit));
    const totalCredits = sumMoney(lines.map((line) => line.credit));
    if (!totalDebits.eq(totalCredits)) {
      throw new UnbalancedJournalEntryError(totalDebits.toFixed(4), totalCredits.toFixed(4));
    }
    if (totalDebits.eq(moneyZero()) && totalCredits.eq(moneyZero())) {
      throw new UnbalancedJournalEntryError('0.0000', '0.0000');
    }
  }
}

function toLineAmount(value: ReturnType<typeof money>): number {
  return Number(value.toFixed(4));
}

function pushSigned(
  lines: JournalLineSpec[],
  accountId: string,
  amount: ReturnType<typeof money>,
  prefer: 'debit' | 'credit',
  description: string
) {
  if (amount.eq(0)) return;
  const abs = money(amount.abs());
  const debitSide = amount.gt(0) ? prefer === 'debit' : prefer === 'credit';
  lines.push({
    accountId,
    debit: debitSide ? toLineAmount(abs) : 0,
    credit: debitSide ? 0 : toLineAmount(abs),
    description,
  });
}

export const clientBillingAccountingService = new ClientBillingAccountingService();
