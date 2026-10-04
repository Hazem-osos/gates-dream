import { Prisma } from '@prisma/client';
import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { VAT_ACCOUNT_UNMAPPED_MESSAGE } from '../../accounting/constants/ledger-integrity';
import {
  overlayColumnAccountIds,
  type AccountDefs,
} from '../../accounting/settings/account-definition-map';
import { companySettingService } from '../../platform/services/company-setting.service';
import { customerLedgerAccountService } from '../../accounting/services/customer-ledger-account.service';
import { supplierLedgerAccountService } from '../../accounting/services/party-ledger-account.service';
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

  async resolveAccountId(
    companyId: string,
    codeOrId: string,
    db: Prisma.TransactionClient | typeof prisma = prisma
  ): Promise<string> {
    const byId = await db.account.findFirst({
      where: { id: codeOrId, companyId, deletedAt: null },
      select: { id: true },
    });
    if (byId) return byId.id;

    const byCode = await db.account.findFirst({
      where: { code: codeOrId, companyId, deletedAt: null },
      select: { id: true },
    });
    if (!byCode) {
      throw new AppError(422, `Account not found for code/id: ${codeOrId}`);
    }
    return byCode.id;
  }

  /**
   * Company mappings sometimes point at a header (the English fixture
   * 4100/5100). Journals can only hit a posting account, so a header falls
   * through to the chart's movement account for that role.
   */
  private async movementAccountId(
    companyId: string,
    accountId: string,
    fallbackCodes: string[]
  ): Promise<string> {
    const account = await prisma.account.findFirst({
      where: { id: accountId, companyId, deletedAt: null },
      select: {
        id: true,
        code: true,
        arabicName: true,
        accountKind: true,
        _count: { select: { children: { where: { deletedAt: null } } } },
      },
    });
    if (!account) return accountId;
    const header = account.accountKind === 'HEADER' || (account._count.children ?? 0) > 0;
    if (!header) return account.id;

    for (const code of fallbackCodes) {
      const leaf = await prisma.account.findFirst({
        where: { companyId, code, deletedAt: null, accountKind: 'POSTING' },
        select: {
          id: true,
          _count: { select: { children: { where: { deletedAt: null } } } },
        },
      });
      if (leaf && (leaf._count.children ?? 0) === 0) return leaf.id;
    }

    throw new AppError(
      422,
      `الحساب ${account.code} (${account.arabicName}) حساب رئيسي ولا يُرحَّل عليه. حدّد حساب حركة في إعدادات الحسابات.`
    );
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
      if (params.supplierId) {
        partyAccountId = await supplierLedgerAccountService.ensureForSupplier({
          companyId: params.companyId,
          supplierId: params.supplierId,
          branchId: params.branchId,
        });
      } else {
        partyAccountId = this.pick(defs, ['apAccount', 'supplierAccount', 'purchaseCreditorAccount']);
      }
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
    const vatOutputAccountIdRaw = this.pick(defs, [
      'vatOutputAccount',
      'salesTaxAccount',
      'defaultVatAccountId',
    ]);
    const vatInputAccountIdRaw = this.pick(defs, [
      'vatInputAccount',
      'purchaseTaxAccount',
      'vatOutputAccount',
      'salesTaxAccount',
      'defaultVatAccountId',
    ]);
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
      throw new AppError(
        422,
        'حساب العميل/المورد غير مضبوط في تعريف الحسابات أو على بطاقة الجهة — راجع الدليل ثم أعد الترحيل.'
      );
    }
    if (!inventoryAccountIdRaw) {
      throw new AppError(
        422,
        'حساب المخزون غير مضبوط في تعريف الحسابات أو على الصنف — راجع الإعدادات ثم أعد الترحيل.'
      );
    }
    if ((params.kind === 'SALE' || params.kind === 'SALE_RETURN') && !revenueAccountIdRaw) {
      throw new AppError(422, 'حساب إيراد المبيعات غير مضبوط في تعريف الحسابات.');
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

    const revenueFallback =
      params.kind === 'SALE_RETURN' ? ['413', '4120', '4110', '411'] : ['4110', '411'];
    const [postingRevenue, postingCogs, postingInventory] = await Promise.all([
      revenueAccountId
        ? this.movementAccountId(params.companyId, revenueAccountId, revenueFallback)
        : Promise.resolve(revenueAccountId),
      cogsAccountId
        ? this.movementAccountId(params.companyId, cogsAccountId, ['5110', '511'])
        : Promise.resolve(cogsAccountId),
      this.movementAccountId(params.companyId, inventoryAccountId, ['1310', '131', '1300']),
    ]);

    return {
      partyAccountId: partyAccountIdResolved,
      inventoryAccountId: postingInventory,
      revenueAccountId: postingRevenue,
      cogsAccountId: postingCogs,
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
      const vatId = isPurchase
        ? accounts.vatInputAccountId ?? accounts.vatOutputAccountId
        : accounts.vatOutputAccountId ?? accounts.vatInputAccountId;
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
        'خصم المبيعات يحتاج حساب خصم مبيعات في تعريف الحسابات قبل الترحيل.'
      );
    }
    if (opts?.hasWht) {
      if (isPurchase && !accounts.withholdingAccountId) {
        throw new AppError(
          422,
          'خصم المنبع محتاج حساب ضريبة خصم المنبع في تعريف الحسابات قبل الترحيل'
        );
      }
      if (
        (transactionType === 'SALE' || transactionType === 'SALE_RETURN') &&
        !accounts.whtReceivableAccountId
      ) {
        throw new AppError(
          422,
          'خصم المنبع على المبيعات يحتاج حساب ضريبة خصم المنبع (مدين) في تعريف الحسابات قبل الترحيل.'
        );
      }
    }

    return accounts;
  }
}

export const invoiceAccountResolverService = new InvoiceAccountResolverService();
