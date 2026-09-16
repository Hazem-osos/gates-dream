import type { Prisma } from '@prisma/client';
import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { invoiceAccountResolverService } from '../../invoices/services/invoice-account-resolver.service';
import { treasuryAccountResolverService } from '../../treasury/services/treasury-account-resolver.service';
import { subcontractAccountResolverService } from '../../subcontracts/services/subcontract-account-resolver.service';
import {
  overlayColumnAccountIds,
  pickAccountDef,
  type AccountDefs,
} from '../settings/account-definition-map';
import type { JournalEntryLineData } from '../types/journal-entry.types';
import type { ResolvedCompanyGlAccounts } from '../types/auto-gl-posting.types';

type Db = Prisma.TransactionClient | typeof prisma;

export class GlAccountResolver {
  private pick(defs: AccountDefs | null, keys: string[]): string | undefined {
    return pickAccountDef(defs ?? {}, keys) ?? undefined;
  }

  async loadDefinitions(companyId: string): Promise<AccountDefs> {
    const settings = await prisma.companySettings.findUnique({
      where: { companyId },
      select: {
        accountDefinitions: true,
        roundingAccountId: true,
        exchangeGainLossAccountId: true,
        retainedEarningsAccountId: true,
      },
    });
    return overlayColumnAccountIds(
      (settings?.accountDefinitions ?? {}) as AccountDefs,
      {
        roundingAccountId: settings?.roundingAccountId,
        exchangeGainLossAccountId: settings?.exchangeGainLossAccountId,
        retainedEarningsAccountId: settings?.retainedEarningsAccountId,
      }
    );
  }

  async resolveCompanyDefaults(companyId: string): Promise<ResolvedCompanyGlAccounts> {
    const defs = await this.loadDefinitions(companyId);
    const resolve = async (keys: string[]) => {
      const raw = this.pick(defs, keys);
      return raw ? invoiceAccountResolverService.resolveAccountId(companyId, raw) : undefined;
    };

    const [
      arAccountId,
      apAccountId,
      cashAccountId,
      bankAccountId,
      inventoryAccountId,
      salesAccountId,
      cogsAccountId,
      vatOutputAccountId,
      vatInputAccountId,
      withholdingAccountId,
      purchaseAccountId,
      salesReturnAccountId,
      salesDiscountAccountId,
      roundingAccountId,
      returnedChequesAccountId,
      chequesUnderCollectionAccountId,
      fxGainAccountId,
      fxLossAccountId,
    ] = await Promise.all([
      resolve(['arAccount', 'customerAccount', 'salesDebtorAccount']),
      resolve(['apAccount', 'supplierAccount', 'purchaseCreditorAccount']),
      resolve(['cashAccount', 'defaultCashAccount', 'cashBoxAccount']),
      resolve(['bankAccount', 'defaultBankAccount', 'bankGlAccount']),
      resolve(['inventoryAccount', 'stockAccount', 'storeAccount']),
      resolve(['salesRevenueAccount', 'salesAccount', 'revenueAccount']),
      resolve(['cogsAccount', 'costOfSalesAccount', 'salesCostAccount']),
      resolve(['vatOutputAccount', 'salesTaxAccount']),
      resolve(['vatInputAccount', 'purchaseTaxAccount']),
      resolve(['withholdingTaxAccount', 'whtPayableAccount', 'daribaManbaAccount']),
      resolve(['purchaseAccount', 'purchasesAccount']),
      resolve(['salesReturnAccount', 'defaultSalesReturnAccountId']),
      resolve(['salesDiscountAccount', 'discountAccount']),
      resolve(['roundingDifferenceAccount', 'roundingAccount']),
      resolve(['returnedChequesAccount', 'bouncedChequesAccount']),
      resolve([
        'chequesUnderCollectionAccount',
        'chequesInBankAccount',
        'defaultUnderCollectionChequeAccountId',
      ]),
      resolve(['fxGainAccount', 'foreignExchangeGainAccount', 'exchangeGainLossAccount']),
      resolve(['fxLossAccount', 'foreignExchangeLossAccount', 'exchangeGainLossAccount']),
    ]);

    let contractorAccountId = this.pick(defs, [
      'contractorAccountId',
      'contractorAccount',
      'subcontractorAccount',
      'subcontractorApAccount',
    ]);
    let retentionAccountId = this.pick(defs, [
      'retentionPayableAccount',
      'businessGuaranteeAccount',
      'retentionAccount',
    ]);
    let advanceAccountId = this.pick(defs, [
      'subcontractorAdvanceAccount',
      'advancePaymentAccount',
      'contractorAdvanceAccount',
    ]);

    if (!contractorAccountId || !retentionAccountId || !advanceAccountId) {
      try {
        const sub = await subcontractAccountResolverService.resolveAccounts(companyId);
        contractorAccountId ??= sub.apAccountId;
        retentionAccountId ??= sub.retentionAccountId;
        advanceAccountId ??= sub.advanceAccountId;
      } catch {
        contractorAccountId ??= apAccountId;
      }
    }

    return {
      arAccountId,
      apAccountId,
      cashAccountId,
      bankAccountId,
      inventoryAccountId,
      salesAccountId,
      cogsAccountId,
      vatOutputAccountId,
      vatInputAccountId,
      withholdingAccountId,
      purchaseAccountId,
      salesReturnAccountId,
      salesDiscountAccountId,
      roundingAccountId,
      returnedChequesAccountId,
      chequesUnderCollectionAccountId,
      fxGainAccountId,
      fxLossAccountId,
      contractorAccountId: contractorAccountId
        ? await invoiceAccountResolverService.resolveAccountId(companyId, contractorAccountId)
        : undefined,
      retentionAccountId: retentionAccountId
        ? await invoiceAccountResolverService.resolveAccountId(companyId, retentionAccountId)
        : undefined,
      advanceAccountId: advanceAccountId
        ? await invoiceAccountResolverService.resolveAccountId(companyId, advanceAccountId)
        : undefined,
    };
  }

  async resolveCashOrBank(
    companyId: string,
    opts: { safeId?: string | null; bankAccountId?: string | null }
  ): Promise<string> {
    if (opts.safeId) {
      return treasuryAccountResolverService.resolveSafeGlAccountId(companyId, opts.safeId);
    }
    if (opts.bankAccountId) {
      return treasuryAccountResolverService.resolveBankGlAccountId(companyId, opts.bankAccountId);
    }
    const defaults = await this.resolveCompanyDefaults(companyId);
    const fallback = defaults.cashAccountId ?? defaults.bankAccountId;
    if (!fallback) {
      throw new AppError(422, 'Treasury/bank GL account is not configured');
    }
    return fallback;
  }

  async resolvePartyAccount(params: {
    companyId: string;
    customerId?: string | null;
    supplierId?: string | null;
    accountId?: string | null;
  }): Promise<string> {
    if (params.accountId) {
      return invoiceAccountResolverService.resolveAccountId(params.companyId, params.accountId);
    }
    return treasuryAccountResolverService.resolvePartyAccountId({
      companyId: params.companyId,
      customerId: params.customerId,
      supplierId: params.supplierId,
    });
  }

  /**
   * Accounts flagged `requiresCostCenter` must carry a cost center from the
   * document header or the line itself.
   */
  async enforceCostCenters(
    db: Db,
    companyId: string,
    lines: JournalEntryLineData[],
    fallbackCostCenterId?: string | null
  ): Promise<JournalEntryLineData[]> {
    const ids = [...new Set(lines.map((l) => l.accountId))];
    if (ids.length === 0) return lines;

    const [accounts, settings] = await Promise.all([
      db.account.findMany({
        where: { id: { in: ids }, companyId, deletedAt: null },
        select: {
          id: true,
          code: true,
          arabicName: true,
          requiresCostCenter: true,
          costCenterRequired: true,
          statementType: true,
          accountKind: true,
          _count: { select: { children: { where: { deletedAt: null } } } },
        },
      }),
      prisma.companySettings.findUnique({
        where: { companyId },
        select: { enforceCostCenterForPnl: true },
      }),
    ]);
    const byId = new Map(accounts.map((a) => [a.id, a]));
    const enforcePnl = settings?.enforceCostCenterForPnl === true;

    return lines.map((line) => {
      const account = byId.get(line.accountId);
      if (!account) {
        throw new AppError(422, 'أحد حسابات القيد غير موجود في دليل الحسابات');
      }
      if (account.accountKind === 'HEADER' || (account._count?.children ?? 0) > 0) {
        throw new AppError(
          422,
          `الحساب ${account.code} (${account.arabicName}) حساب رئيسي/رئيسي فرعي ولا يُرحَّل عليه. اختر حساب حركة.`
        );
      }
      const caption = (account.costCenterRequired ?? '').trim();
      const forbidCostCenter = caption === 'بدون' || caption.toUpperCase() === 'NONE';
      const needsCostCenter =
        !forbidCostCenter &&
        (account.requiresCostCenter === true ||
          caption === 'إجباري' ||
          (enforcePnl && account.statementType === 'INCOME_STATEMENT'));

      if (forbidCostCenter) {
        if (line.costCenterId) {
          throw new AppError(
            422,
            `الحساب ${account.code} (${account.arabicName}) مربوط بدون مركز تكلفة. امسح مركز التكلفة من السطر.`
          );
        }
        return { ...line, costCenterId: undefined };
      }

      if (!needsCostCenter) {
        return {
          ...line,
          costCenterId: line.costCenterId ?? fallbackCostCenterId ?? undefined,
        };
      }
      const costCenterId = line.costCenterId ?? fallbackCostCenterId ?? undefined;
      if (!costCenterId) {
        throw new AppError(
          422,
          `مركز التكلفة إجباري للحساب ${account.code} (${account.arabicName}).`
        );
      }
      return { ...line, costCenterId };
    });
  }
}

export const glAccountResolver = new GlAccountResolver();
