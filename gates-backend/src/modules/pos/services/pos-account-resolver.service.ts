import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { invoiceAccountResolverService } from '../../invoices/services/invoice-account-resolver.service';
import { treasuryAccountResolverService } from '../../treasury/services/treasury-account-resolver.service';

type AccountDefs = Record<string, string | undefined>;

export class PosAccountResolverService {
  private pick(defs: AccountDefs | null, keys: string[]): string | undefined {
    if (!defs) return undefined;
    for (const k of keys) {
      const v = defs[k];
      if (typeof v === 'string' && v.trim()) return v.trim();
    }
    return undefined;
  }

  /**
   * C10/H12 fix: this used to be called only at shift close (hence the name);
   * it now resolves the same account set for EVERY order post, since revenue/
   * VAT/COGS/inventory/AR are posted per order. Shift close only reconciles
   * cash, so it reuses this for the cash/shortage/surplus accounts alone.
   */
  async resolveForShiftClose(params: {
    companyId: string;
    safeId: string;
    bankAccountId?: string | null;
  }) {
    const settings = await prisma.companySettings.findUnique({
      where: { companyId: params.companyId },
      select: { accountDefinitions: true },
    });
    const defs = (settings?.accountDefinitions ?? {}) as AccountDefs;

    const cashGl = await treasuryAccountResolverService.resolveSafeGlAccountId(
      params.companyId,
      params.safeId
    );
    const bankGl = params.bankAccountId
      ? await treasuryAccountResolverService.resolveBankGlAccountId(
          params.companyId,
          params.bankAccountId
        )
      : undefined;

    const revenueRaw = this.pick(defs, ['salesRevenueAccount', 'salesAccount', 'revenueAccount']);
    const vatOutputRaw = this.pick(defs, ['vatOutputAccount', 'salesTaxAccount']);
    const cogsRaw = this.pick(defs, ['cogsAccount', 'costOfSalesAccount']);
    const inventoryRaw = this.pick(defs, ['inventoryAccount', 'stockAccount']);
    const arRaw = this.pick(defs, ['arAccount', 'customerAccount']);
    const shortageRaw = this.pick(defs, ['cashShortageAccount', 'cashOverShortExpenseAccount']);
    const surplusRaw = this.pick(defs, ['cashSurplusAccount', 'miscellaneousIncomeAccount']);

    if (!revenueRaw || !vatOutputRaw || !cogsRaw || !inventoryRaw || !arRaw) {
      throw new AppError(422, 'POS shift close accounts are not fully configured');
    }

    const [revenueAccountId, vatOutputAccountId, cogsAccountId, inventoryAccountId, arAccountId] =
      await Promise.all([
        invoiceAccountResolverService.resolveAccountId(params.companyId, revenueRaw),
        invoiceAccountResolverService.resolveAccountId(params.companyId, vatOutputRaw),
        invoiceAccountResolverService.resolveAccountId(params.companyId, cogsRaw),
        invoiceAccountResolverService.resolveAccountId(params.companyId, inventoryRaw),
        invoiceAccountResolverService.resolveAccountId(params.companyId, arRaw),
      ]);

    const cashShortageAccountId = shortageRaw
      ? await invoiceAccountResolverService.resolveAccountId(params.companyId, shortageRaw)
      : undefined;
    const cashSurplusAccountId = surplusRaw
      ? await invoiceAccountResolverService.resolveAccountId(params.companyId, surplusRaw)
      : undefined;

    return {
      cashGlAccountId: cashGl,
      bankGlAccountId: bankGl,
      revenueAccountId,
      vatOutputAccountId,
      cogsAccountId,
      inventoryAccountId,
      arAccountId,
      cashShortageAccountId,
      cashSurplusAccountId,
    };
  }
}

export const posAccountResolverService = new PosAccountResolverService();
