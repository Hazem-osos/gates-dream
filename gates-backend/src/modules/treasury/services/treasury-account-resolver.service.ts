import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { invoiceAccountResolverService } from '../../invoices/services/invoice-account-resolver.service';
import { customerLedgerAccountService } from '../../accounting/services/customer-ledger-account.service';
import {
  overlayColumnAccountIds,
  type AccountDefs,
} from '../../accounting/settings/account-definition-map';
import type { ResolvedTreasuryAccounts } from '../types/treasury.types';

export class TreasuryAccountResolverService {
  private pick(defs: AccountDefs | null, keys: string[]): string | undefined {
    if (!defs) return undefined;
    for (const k of keys) {
      const v = defs[k];
      if (typeof v === 'string' && v.trim()) return v.trim();
    }
    return undefined;
  }

  private async loadDefs(companyId: string): Promise<AccountDefs> {
    const settings = await prisma.companySettings.findUnique({
      where: { companyId },
      select: {
        accountDefinitions: true,
        roundingAccountId: true,
        exchangeGainLossAccountId: true,
        retainedEarningsAccountId: true,
      },
    });
    return overlayColumnAccountIds((settings?.accountDefinitions ?? {}) as AccountDefs, {
      roundingAccountId: settings?.roundingAccountId,
      exchangeGainLossAccountId: settings?.exchangeGainLossAccountId,
      retainedEarningsAccountId: settings?.retainedEarningsAccountId,
    });
  }

  async resolveSafeGlAccountId(companyId: string, safeId: string): Promise<string> {
    const safe = await prisma.safe.findFirst({
      where: { id: safeId, companyId },
      select: { glAccountId: true },
    });
    if (!safe) {
      throw new AppError(404, 'Cash safe not found');
    }
    if (safe.glAccountId) {
      return safe.glAccountId;
    }
    const defs = await this.loadDefs(companyId);
    const code = this.pick(defs, ['cashAccount', 'defaultCashAccount', 'cashBoxAccount']);
    if (!code) {
      throw new AppError(422, 'Cash GL account is not configured on safe or company settings');
    }
    return invoiceAccountResolverService.resolveAccountId(companyId, code);
  }

  async resolveBankGlAccountId(
    companyId: string,
    bankAccountId: string
  ): Promise<string> {
    const bank = await prisma.bankAccount.findFirst({
      where: { id: bankAccountId, companyId },
      select: { glAccountId: true },
    });
    if (!bank) {
      throw new AppError(404, 'Bank account not found');
    }
    if (bank.glAccountId) {
      return bank.glAccountId;
    }
    const defs = await this.loadDefs(companyId);
    const code = this.pick(defs, ['bankAccount', 'defaultBankAccount', 'bankGlAccount']);
    if (!code) {
      throw new AppError(422, 'Bank GL account is not configured on bank account or company settings');
    }
    return invoiceAccountResolverService.resolveAccountId(companyId, code);
  }

  async resolveChequeAccounts(companyId: string): Promise<
    Pick<
      ResolvedTreasuryAccounts,
      | 'chequesUnderHandAccountId'
      | 'chequesUnderCollectionAccountId'
      | 'notesPayableAccountId'
    >
  > {
    const defs = await this.loadDefs(companyId);

    const handRaw = this.pick(defs, [
      'chequesUnderHandAccount',
      'chequesInPortfolioAccount',
      'receivedChequesAccount',
    ]);
    const collectionRaw = this.pick(defs, [
      'chequesUnderCollectionAccount',
      'chequesInBankAccount',
      'chequesForCollectionAccount',
    ]);
    const notesRaw = this.pick(defs, ['notesPayableAccount', 'issuedChequesAccount', 'chequesPayableAccount']);

    if (!handRaw || !collectionRaw || !notesRaw) {
      throw new AppError(
        422,
        'Cheque GL accounts are not fully configured in company accountDefinitions'
      );
    }

    const [chequesUnderHandAccountId, chequesUnderCollectionAccountId, notesPayableAccountId] =
      await Promise.all([
        invoiceAccountResolverService.resolveAccountId(companyId, handRaw),
        invoiceAccountResolverService.resolveAccountId(companyId, collectionRaw),
        invoiceAccountResolverService.resolveAccountId(companyId, notesRaw),
      ]);

    return {
      chequesUnderHandAccountId,
      chequesUnderCollectionAccountId,
      notesPayableAccountId,
    };
  }

  /**
   * Resolves the GL account for the non-cash side of a treasury receipt/payment.
   *
   * When the movement is not tied to a specific invoice (`invoiceId` absent), it is
   * "unapplied" cash — the customer/supplier hasn't told us which document it settles.
   * Posting that straight to the party's AR/AP control account overstates or understates
   * a specific receivable/payable without evidence. Instead we route it to a dedicated
   * customer-advance / supplier-advance (unapplied-cash) account when the company has one
   * configured, falling back to the party account for tenants that haven't set it up yet
   * so existing postings keep working (M23).
   */
  async resolvePartyAccountId(params: {
    companyId: string;
    customerId?: string | null;
    supplierId?: string | null;
    offsetAccountId?: string | null;
    invoiceId?: string | null;
  }): Promise<string> {
    if (params.offsetAccountId) {
      return params.offsetAccountId;
    }
    const isUnapplied = !params.invoiceId;
    if (params.customerId) {
      if (isUnapplied) {
        const advanceId = await this.tryResolveUnappliedAccount(params.companyId, 'customer');
        if (advanceId) return advanceId;
      }
      return customerLedgerAccountService.ensureForCustomer({
        companyId: params.companyId,
        customerId: params.customerId,
      });
    }
    if (params.supplierId) {
      if (isUnapplied) {
        const advanceId = await this.tryResolveUnappliedAccount(params.companyId, 'supplier');
        if (advanceId) return advanceId;
      }
      const supplier = await prisma.supplier.findFirst({
        where: { id: params.supplierId, companyId: params.companyId },
        select: { mainAccountId: true, accountId: true },
      });
      const id = supplier?.mainAccountId ?? supplier?.accountId;
      if (!id) {
        throw new AppError(422, 'Supplier control account is not configured');
      }
      return id;
    }
    throw new AppError(422, 'Party or offset account is required');
  }

  /** Wave 2 fix: realized FX gain/loss accounts for settlement-rate differences. */
  async resolveFxAccounts(
    companyId: string
  ): Promise<{ fxGainAccountId: string; fxLossAccountId: string }> {
    const defs = await this.loadDefs(companyId);

    const gainRaw = this.pick(defs, [
      'fxGainAccount',
      'foreignExchangeGainAccount',
      'exchangeGainLossAccount',
    ]);
    const lossRaw = this.pick(defs, [
      'fxLossAccount',
      'foreignExchangeLossAccount',
      'exchangeGainLossAccount',
    ]);
    if (!gainRaw || !lossRaw) {
      throw new AppError(
        422,
        'Foreign exchange gain/loss GL accounts are not configured in company accountDefinitions'
      );
    }

    const [fxGainAccountId, fxLossAccountId] = await Promise.all([
      invoiceAccountResolverService.resolveAccountId(companyId, gainRaw),
      invoiceAccountResolverService.resolveAccountId(companyId, lossRaw),
    ]);

    return { fxGainAccountId, fxLossAccountId };
  }

  private async tryResolveUnappliedAccount(
    companyId: string,
    kind: 'customer' | 'supplier'
  ): Promise<string | null> {
    const defs = await this.loadDefs(companyId);
    const keys =
      kind === 'customer'
        ? ['customerAdvanceAccount', 'advanceFromCustomersAccount', 'unappliedReceiptsAccount']
        : ['supplierAdvanceAccount', 'advanceToSuppliersAccount', 'unappliedPaymentsAccount'];
    const code = this.pick(defs, keys);
    if (!code) return null;
    try {
      return await invoiceAccountResolverService.resolveAccountId(companyId, code);
    } catch {
      return null;
    }
  }
}

export const treasuryAccountResolverService = new TreasuryAccountResolverService();
