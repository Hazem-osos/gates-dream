import { randomBytes } from 'node:crypto';
import { Prisma, type ProjectLetterOfGuarantee } from '@prisma/client';
import { UnbalancedJournalEntryError } from '../../../../shared/errors/unbalanced-journal-entry.error';
import type { JournalPostingContext } from '../../../accounting/services/journal-posting.service';
import { journalPostingService } from '../../../accounting/services/journal-posting.service';
import { documentSequenceService } from '../../../platform/services/document-sequence.service';
import { fiscalYearService } from '../../../platform/services/fiscal-year.service';
import { journalLines } from '../../../trade/utils/journal-lines.util';
import { tradeAccountResolverService } from '../../../trade/services/trade-account-resolver.service';
import { treasuryAccountResolverService } from '../../../treasury/services/treasury-account-resolver.service';
import { money, moneyZero, sumMoney } from '../../utils/money-decimal';
import { LgInsufficientMarginError } from '../errors/lg-domain.errors';

type Db = Prisma.TransactionClient;

type JournalLineSpec = {
  accountId: string;
  debit: number;
  credit: number;
  description: string;
};

export class LgAccountingService {
  async postLgIssuance(
    companyId: string,
    lg: ProjectLetterOfGuarantee,
    branchId: string,
    tx: Db,
    userId: string
  ) {
    const accounts = await this.resolveAccounts(companyId, lg.bankAccountId);
    const margin = money(lg.cashMarginAmount);
    const commission = money(lg.issuanceCommissionAmount);
    const bankCredit = money(margin.plus(commission));
    if (bankCredit.lte(0)) {
      throw new LgInsufficientMarginError({
        cashMarginAmount: margin.toFixed(4),
        issuanceCommissionAmount: commission.toFixed(4),
      });
    }

    const lines: JournalLineSpec[] = [
      ...(margin.gt(0)
        ? [
            {
              accountId: accounts.cashMarginAccountId,
              debit: toLineAmount(margin),
              credit: 0,
              description: 'غطاء نقدي لخطابات الضمان لدى البنك',
            },
          ]
        : []),
      ...(commission.gt(0)
        ? [
            {
              accountId: accounts.commissionAccountId,
              debit: toLineAmount(commission),
              credit: 0,
              description: 'مصروفات وعمولات إصدار خطابات الضمان',
            },
          ]
        : []),
      {
        accountId: accounts.bankAccountId,
        debit: 0,
        credit: toLineAmount(bankCredit),
        description: 'البنك - الحساب الجاري',
      },
    ];

    return this.postBalanced(tx, await this.ctx(companyId, userId, branchId), {
      date: lg.issuanceDate,
      description: `إصدار خطاب ضمان ${lg.lgNumber}`,
      sourceType: 'PROJECT_LG_ISSUANCE',
      sourceTag: 'LGI',
      lines,
    });
  }

  async postLgExtensionCommission(
    companyId: string,
    lg: ProjectLetterOfGuarantee,
    branchId: string,
    tx: Db,
    userId: string,
    commissionAmount: ReturnType<typeof money>,
    date: Date
  ) {
    if (!commissionAmount.gt(0)) return null;
    const accounts = await this.resolveAccounts(companyId, lg.bankAccountId);
    return this.postBalanced(tx, await this.ctx(companyId, userId, branchId), {
      date,
      description: `عمولة مد خطاب ضمان ${lg.lgNumber}`,
      sourceType: 'PROJECT_LG_EXTENSION',
      sourceTag: 'LGX',
      lines: [
        {
          accountId: accounts.commissionAccountId,
          debit: toLineAmount(commissionAmount),
          credit: 0,
          description: 'مصروفات وعمولات مد خطابات الضمان',
        },
        {
          accountId: accounts.bankAccountId,
          debit: 0,
          credit: toLineAmount(commissionAmount),
          description: 'البنك - الحساب الجاري',
        },
      ],
    });
  }

  async postLgMarginAdjustment(
    companyId: string,
    lg: ProjectLetterOfGuarantee,
    branchId: string,
    tx: Db,
    userId: string,
    marginDiff: ReturnType<typeof money>,
    date: Date
  ) {
    if (marginDiff.eq(0)) return null;
    const accounts = await this.resolveAccounts(companyId, lg.bankAccountId);
    const abs = money(marginDiff.abs());
    const increase = marginDiff.gt(0);

    return this.postBalanced(tx, await this.ctx(companyId, userId, branchId), {
      date,
      description: `تعديل غطاء خطاب ضمان ${lg.lgNumber}`,
      sourceType: 'PROJECT_LG_AMENDMENT',
      sourceTag: 'LGA',
      lines: increase
        ? [
            {
              accountId: accounts.cashMarginAccountId,
              debit: toLineAmount(abs),
              credit: 0,
              description: 'غطاء نقدي لخطابات الضمان لدى البنك',
            },
            {
              accountId: accounts.bankAccountId,
              debit: 0,
              credit: toLineAmount(abs),
              description: 'البنك - الحساب الجاري',
            },
          ]
        : [
            {
              accountId: accounts.bankAccountId,
              debit: toLineAmount(abs),
              credit: 0,
              description: 'البنك - الحساب الجاري',
            },
            {
              accountId: accounts.cashMarginAccountId,
              debit: 0,
              credit: toLineAmount(abs),
              description: 'غطاء نقدي لخطابات الضمان لدى البنك',
            },
          ],
    });
  }

  async postLgRelease(
    companyId: string,
    lg: ProjectLetterOfGuarantee,
    branchId: string,
    tx: Db,
    userId: string,
    releaseDate: Date
  ) {
    const margin = money(lg.cashMarginAmount);
    if (!margin.gt(0)) {
      throw new LgInsufficientMarginError({ cashMarginAmount: margin.toFixed(4) });
    }
    const accounts = await this.resolveAccounts(companyId, lg.bankAccountId);
    return this.postBalanced(tx, await this.ctx(companyId, userId, branchId), {
      date: releaseDate,
      description: `إفراج خطاب ضمان ${lg.lgNumber}`,
      sourceType: 'PROJECT_LG_RELEASE',
      sourceTag: 'LGR',
      lines: [
        {
          accountId: accounts.bankAccountId,
          debit: toLineAmount(margin),
          credit: 0,
          description: 'البنك - الحساب الجاري',
        },
        {
          accountId: accounts.cashMarginAccountId,
          debit: 0,
          credit: toLineAmount(margin),
          description: 'غطاء نقدي لخطابات الضمان لدى البنك',
        },
      ],
    });
  }

  async postLgLiquidation(
    companyId: string,
    lg: ProjectLetterOfGuarantee,
    branchId: string,
    tx: Db,
    userId: string,
    liquidationDate: Date
  ) {
    const currentAmount = money(lg.currentAmount);
    const margin = money(lg.cashMarginAmount);
    if (!currentAmount.gt(0) && !margin.gt(0)) {
      throw new LgInsufficientMarginError({
        currentAmount: currentAmount.toFixed(4),
        cashMarginAmount: margin.toFixed(4),
      });
    }

    const accounts = await this.resolveAccounts(companyId, lg.bankAccountId);
    const uncovered = money(currentAmount.minus(margin));
    const lines: JournalLineSpec[] = [
      ...(currentAmount.gt(0)
        ? [
            {
              accountId: accounts.lossAccountId,
              debit: toLineAmount(currentAmount),
              credit: 0,
              description: 'خسائر تسييل خطابات ضمان مصادرة',
            },
          ]
        : []),
      ...(margin.gt(0)
        ? [
            {
              accountId: accounts.cashMarginAccountId,
              debit: 0,
              credit: toLineAmount(margin),
              description: 'غطاء نقدي لخطابات الضمان لدى البنك',
            },
          ]
        : []),
    ];

    if (uncovered.gt(0)) {
      lines.push({
        accountId: accounts.bankAccountId,
        debit: 0,
        credit: toLineAmount(uncovered),
        description: 'البنك - الحساب الجاري أو تسهيلات بنكية',
      });
    } else if (uncovered.lt(0)) {
      lines.push({
        accountId: accounts.bankAccountId,
        debit: toLineAmount(uncovered.abs()),
        credit: 0,
        description: 'البنك - الحساب الجاري (رد زيادة الغطاء)',
      });
    }

    return this.postBalanced(tx, await this.ctx(companyId, userId, branchId), {
      date: liquidationDate,
      description: `تسييل خطاب ضمان ${lg.lgNumber}`,
      sourceType: 'PROJECT_LG_LIQUIDATION',
      sourceTag: 'LGL',
      lines,
    });
  }

  private async resolveAccounts(companyId: string, bankAccountId: string) {
    const [trade, bankGlId] = await Promise.all([
      tradeAccountResolverService.resolveTradeAccounts(companyId),
      treasuryAccountResolverService.resolveBankGlAccountId(companyId, bankAccountId),
    ]);
    return {
      cashMarginAccountId: trade.lgCashCoverAccountId,
      commissionAccountId: trade.bankCommissionAccountId,
      lossAccountId: trade.lgConfiscationLossAccountId,
      bankAccountId: bankGlId,
    };
  }

  private async ctx(
    companyId: string,
    userId: string,
    branchId: string
  ): Promise<JournalPostingContext> {
    return { companyId, userId, branchId };
  }

  private async postBalanced(
    tx: Db,
    ctx: JournalPostingContext,
    data: {
      date: Date;
      description: string;
      sourceType: string;
      sourceTag: string;
      lines: JournalLineSpec[];
    }
  ) {
    this.assertBalanced(data.lines);
    const fiscalYearId = await fiscalYearService.assertOpenForDate(ctx.companyId, data.date);
    const postingCtx = { ...ctx, fiscalYearId };
    const legacyGlNum = await documentSequenceService.nextGlNumberInTx(tx, postingCtx);
    return journalPostingService.createAndPostInTx(tx, postingCtx, {
      fiscalYearId,
      legacyGlNum,
      date: data.date,
      description: data.description,
      currencyCode: 'EGP',
      exchangeRate: 1,
      entryType: data.sourceType,
      sourceType: data.sourceType,
      sourceNumber: `${data.sourceTag}:${randomBytes(6).toString('hex')}`.slice(0, 30),
      lines: journalLines(data.lines),
    });
  }

  private assertBalanced(lines: JournalLineSpec[]) {
    const totalDebits = sumMoney(lines.map((line) => line.debit));
    const totalCredits = sumMoney(lines.map((line) => line.credit));
    if (!totalDebits.eq(totalCredits)) {
      throw new UnbalancedJournalEntryError(totalDebits.toFixed(4), totalCredits.toFixed(4));
    }
    if (totalDebits.eq(moneyZero())) {
      throw new UnbalancedJournalEntryError('0.0000', '0.0000');
    }
  }
}

function toLineAmount(value: ReturnType<typeof money>): number {
  return Number(value.toFixed(4));
}

export const lgAccountingService = new LgAccountingService();
