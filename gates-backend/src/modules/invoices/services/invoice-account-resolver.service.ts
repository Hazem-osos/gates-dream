import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { VAT_ACCOUNT_UNMAPPED_MESSAGE } from '../../accounting/constants/ledger-integrity';
import {
  overlayColumnAccountIds,
  type AccountDefs,
} from '../../accounting/settings/account-definition-map';
import { companySettingService } from '../../platform/services/company-setting.service';
import { customerLedgerAccountService } from '../../accounting/services/customer-ledger-account.service';
import type { InvoiceKind, ResolvedPostingAccounts } from '../types/invoice-posting.types';

export class InvoiceAccountResolverService {
  private pick(defs: AccountDefs | null, keys: string[]): string | undefined {
    if (!defs) return undefined;
    for (const k of keys) {
      const v = defs[k];
      if (typeof v === 'string' && v.trim()) return v.trim();
    }
    return undefined;
  }

  async resolveAccountId(companyId: string, codeOrId: string): Promise<string> {
    const byId = await prisma.account.findFirst({
      where: { id: codeOrId, companyId, deletedAt: null },
      select: { id: true },
    });
    if (byId) return byId.id;

    const byCode = await prisma.account.findFirst({
      where: { code: codeOrId, companyId, deletedAt: null },
      select: { id: true },
    });
    if (!byCode) {
      throw new AppError(422, `Account not found for code/id: ${codeOrId}`);
    }
    return byCode.id;
  }

  async resolveForInvoice(params: {
    companyId: string;
    kind: InvoiceKind;
    customerId?: string | null;
    supplierId?: string | null;
    defaultInventoryAccountId?: string | null;
    /** Legacy `CustomersAccount` is branch-scoped (untbranchvariables.pas); pass the posting branch to honor per-branch AR roots. */
    branchId?: string | null;
  }): Promise<ResolvedPostingAccounts> {
    const settings = await prisma.companySettings.findUnique({
      where: { companyId: params.companyId },
      select: {
        accountDefinitions: true,
        roundingAccountId: true,
        exchangeGainLossAccountId: true,
        retainedEarningsAccountId: true,
      },
    });
    const defs = overlayColumnAccountIds(
      (settings?.accountDefinitions ?? {}) as AccountDefs,
      {
        roundingAccountId: settings?.roundingAccountId,
        exchangeGainLossAccountId: settings?.exchangeGainLossAccountId,
        retainedEarningsAccountId: settings?.retainedEarningsAccountId,
      }
    );

    let partyAccountId: string | undefined;

    if (params.kind === 'SALE' || params.kind === 'SALE_RETURN') {
      if (params.customerId) {
        partyAccountId = await customerLedgerAccountService.ensureForCustomer({
          companyId: params.companyId,
          customerId: params.customerId,
          branchId: params.branchId,
        });
      } else {
        const legacyCustomersAccount = await companySettingService.getEntry(
          params.companyId,
          'CustomersAccount',
          { branchId: params.branchId }
        );
        partyAccountId = legacyCustomersAccount?.trim() || undefined;
        partyAccountId ??= this.pick(defs, ['arAccount', 'customerAccount', 'salesDebtorAccount']);
      }
    } else {
      const supplier = params.supplierId
        ? await prisma.supplier.findFirst({
            where: { id: params.supplierId, companyId: params.companyId },
            select: { mainAccountId: true, accountId: true },
          })
        : null;
      partyAccountId =
        supplier?.mainAccountId ?? supplier?.accountId ?? undefined;
      partyAccountId ??= this.pick(defs, ['apAccount', 'supplierAccount', 'purchaseCreditorAccount']);
    }

    const inventoryAccountIdRaw =
      params.defaultInventoryAccountId ??
      this.pick(defs, ['inventoryAccount', 'stockAccount', 'storeAccount']);
    const purchaseReturnAccountIdRaw = this.pick(defs, [
      'purchaseReturnAccount',
      'purchasesReturnAccount',
      'purchaseReturnsAccount',
    ]);
    const revenueAccountIdRaw =
      params.kind === 'SALE_RETURN'
        ? this.pick(defs, [
            'salesReturnAccount',
            'defaultSalesReturnAccountId',
            'salesRevenueAccount',
            'salesAccount',
            'revenueAccount',
          ])
        : this.pick(defs, ['salesRevenueAccount', 'salesAccount', 'revenueAccount']);
    const cogsAccountIdRaw = this.pick(defs, ['cogsAccount', 'costOfSalesAccount', 'salesCostAccount']);
    const salesDiscountAccountIdRaw = this.pick(defs, [
      'salesDiscountAccount',
      'discountAccount',
      'purchaseDiscountAccount',
    ]);
    const vatOutputAccountIdRaw = this.pick(defs, ['vatOutputAccount', 'salesTaxAccount']);
    const vatInputAccountIdRaw = this.pick(defs, ['vatInputAccount', 'purchaseTaxAccount']);
    // `daribaManbaAccount` / `daribaManbaAccountDebit` are the legacy slot names
    // (`DaribaManbaAccount`, withholding tax at source) — they are what the
    // gl-account-defaults screen writes and what tenant provisioning seeds, so
    // a WHT account configured through the UI resolved to nothing until these
    // were added to the lookup.
    const withholdingAccountIdRaw = this.pick(defs, [
      'withholdingTaxAccount',
      'whtPayableAccount',
      'daribaManbaAccount',
    ]);
    const whtReceivableAccountIdRaw = this.pick(defs, [
      'whtReceivableAccount',
      'withholdingTaxReceivableAccount',
      'whtReceivableAccountId',
      'daribaManbaAccountDebit',
    ]);

    if (!partyAccountId) {
      throw new AppError(422, 'Party control account is not configured on master or company settings');
    }
    if (!inventoryAccountIdRaw) {
      throw new AppError(422, 'Inventory account is not configured (item or company settings)');
    }
    if ((params.kind === 'SALE' || params.kind === 'SALE_RETURN') && !revenueAccountIdRaw) {
      throw new AppError(422, 'Sales revenue account is not configured');
    }
    if ((params.kind === 'SALE' || params.kind === 'SALE_RETURN' || params.kind === 'PURCHASE_RETURN') && !cogsAccountIdRaw) {
      throw new AppError(422, 'COGS account is not configured');
    }

    const [partyAccountIdResolved, inventoryAccountId, revenueAccountId, cogsAccountId] =
      await Promise.all([
        this.resolveAccountId(params.companyId, partyAccountId),
        this.resolveAccountId(params.companyId, inventoryAccountIdRaw),
        revenueAccountIdRaw
          ? this.resolveAccountId(params.companyId, revenueAccountIdRaw)
          : Promise.resolve(''),
        cogsAccountIdRaw
          ? this.resolveAccountId(params.companyId, cogsAccountIdRaw)
          : Promise.resolve(''),
      ]);

    const vatOutputAccountId = vatOutputAccountIdRaw
      ? await this.resolveAccountId(params.companyId, vatOutputAccountIdRaw)
      : undefined;
    const vatInputAccountId = vatInputAccountIdRaw
      ? await this.resolveAccountId(params.companyId, vatInputAccountIdRaw)
      : undefined;
    const withholdingAccountId = withholdingAccountIdRaw
      ? await this.resolveAccountId(params.companyId, withholdingAccountIdRaw)
      : undefined;
    const whtReceivableAccountId =
      whtReceivableAccountIdRaw && (params.kind === 'SALE' || params.kind === 'SALE_RETURN')
        ? await this.resolveAccountId(params.companyId, whtReceivableAccountIdRaw)
        : undefined;
    const salesDiscountAccountId = salesDiscountAccountIdRaw
      ? await this.resolveAccountId(params.companyId, salesDiscountAccountIdRaw)
      : undefined;
    const purchaseReturnAccountId = purchaseReturnAccountIdRaw
      ? await this.resolveAccountId(params.companyId, purchaseReturnAccountIdRaw)
      : undefined;

    return {
      partyAccountId: partyAccountIdResolved,
      inventoryAccountId,
      revenueAccountId,
      cogsAccountId,
      vatOutputAccountId,
      vatInputAccountId,
      withholdingAccountId,
      whtReceivableAccountId,
      salesDiscountAccountId,
      purchaseReturnAccountId,
    };
  }

  /**
   * Fail loud before any stock/GL writes. Missing VAT mappings never
   * post net AR/AP while silently dropping the tax line.
   */
  async assertCompanyPostingReady(
    companyId: string,
    transactionType: InvoiceKind,
    opts?: {
      customerId?: string | null;
      supplierId?: string | null;
      defaultInventoryAccountId?: string | null;
      branchId?: string | null;
      hasTax?: boolean;
      hasWht?: boolean;
      hasDiscount?: boolean;
    }
  ): Promise<ResolvedPostingAccounts> {
    const accounts = await this.resolveForInvoice({
      companyId,
      kind: transactionType,
      customerId: opts?.customerId,
      supplierId: opts?.supplierId,
      defaultInventoryAccountId: opts?.defaultInventoryAccountId,
      branchId: opts?.branchId,
    });

    const isPurchase = transactionType === 'PURCHASE' || transactionType === 'PURCHASE_RETURN';
    if (opts?.hasTax) {
      const vatId = isPurchase ? accounts.vatInputAccountId : accounts.vatOutputAccountId;
      if (!vatId) {
        throw new AppError(422, VAT_ACCOUNT_UNMAPPED_MESSAGE);
      }
    }
    if (
      opts?.hasDiscount &&
      (transactionType === 'SALE' || transactionType === 'SALE_RETURN') &&
      !accounts.salesDiscountAccountId
    ) {
      throw new AppError(
        422,
        'Sales discount requires salesDiscountAccount in company account definitions'
      );
    }
    if (opts?.hasWht) {
      if (isPurchase && !accounts.withholdingAccountId) {
        throw new AppError(
          422,
          'Purchase withholding tax requires withholdingTaxAccount in company account definitions'
        );
      }
      if (
        (transactionType === 'SALE' || transactionType === 'SALE_RETURN') &&
        !accounts.whtReceivableAccountId
      ) {
        throw new AppError(
          422,
          'Sales withholding tax requires whtReceivableAccount in company account definitions'
        );
      }
    }

    return accounts;
  }
}

export const invoiceAccountResolverService = new InvoiceAccountResolverService();
