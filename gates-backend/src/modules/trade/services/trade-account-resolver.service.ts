import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { invoiceAccountResolverService } from '../../invoices/services/invoice-account-resolver.service';

type AccountDefs = Record<string, string | undefined>;

const DEFAULTS = {
  openLcWipAccountCode: '1400',
  inventoryAccountCode: '1300',
  lcPayableAccountCode: '2100',
  lgCashCoverAccountCode: '1410',
  bankCommissionAccountCode: '5200',
  lgConfiscationLossAccountCode: '5210',
};

export class TradeAccountResolverService {
  private pick(defs: AccountDefs | null, keys: string[]): string | undefined {
    if (!defs) return undefined;
    for (const k of keys) {
      const v = defs[k];
      if (typeof v === 'string' && v.trim()) return v.trim();
    }
    return undefined;
  }

  async resolveTradeAccounts(companyId: string) {
    const [tradeSettings, companySettings] = await Promise.all([
      prisma.tradeSettings.findUnique({ where: { companyId } }),
      prisma.companySettings.findUnique({
        where: { companyId },
        select: { accountDefinitions: true },
      }),
    ]);
    const defs = (companySettings?.accountDefinitions ?? {}) as AccountDefs;

    const code = (tradeKey: keyof typeof DEFAULTS, defKeys: string[]) =>
      tradeSettings?.[tradeKey] ??
      this.pick(defs, defKeys) ??
      DEFAULTS[tradeKey];

    const openLcWipAccountId = await invoiceAccountResolverService.resolveAccountId(
      companyId,
      code('openLcWipAccountCode', ['openLcWipAccount', 'documentaryCreditWipAccount'])
    );
    const inventoryAccountId = await invoiceAccountResolverService.resolveAccountId(
      companyId,
      code('inventoryAccountCode', ['inventoryAccount'])
    );
    const lcPayableAccountId = await invoiceAccountResolverService.resolveAccountId(
      companyId,
      code('lcPayableAccountCode', ['lcPayableAccount', 'accountsPayableAccount', 'apAccount'])
    );
    const lgCashCoverAccountId = await invoiceAccountResolverService.resolveAccountId(
      companyId,
      code('lgCashCoverAccountCode', ['lgCashCoverAccount', 'guaranteeCashCoverAccount'])
    );
    const bankCommissionAccountId = await invoiceAccountResolverService.resolveAccountId(
      companyId,
      code('bankCommissionAccountCode', [
        'bankCommissionAccount',
        'bankExpenseAccount',
        'bankFeesAccount',
      ])
    );
    const lgConfiscationLossAccountId = await invoiceAccountResolverService.resolveAccountId(
      companyId,
      code('lgConfiscationLossAccountCode', [
        'lgConfiscationLossAccount',
        'guaranteeConfiscationLossAccount',
        'lgLossAccount',
      ])
    );

    return {
      openLcWipAccountId,
      inventoryAccountId,
      lcPayableAccountId,
      lgCashCoverAccountId,
      bankCommissionAccountId,
      lgConfiscationLossAccountId,
    };
  }

  async resolveSupplierApAccountId(companyId: string, supplierId: string): Promise<string> {
    const supplier = await prisma.supplier.findFirst({
      where: { id: supplierId, companyId },
      select: { mainAccountId: true },
    });
    if (!supplier) {
      throw new AppError(404, 'Supplier not found');
    }
    if (supplier.mainAccountId) {
      return supplier.mainAccountId;
    }
    const accounts = await this.resolveTradeAccounts(companyId);
    return accounts.lcPayableAccountId;
  }
}

export const tradeAccountResolverService = new TradeAccountResolverService();
