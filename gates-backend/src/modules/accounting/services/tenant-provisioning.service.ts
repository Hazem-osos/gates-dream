import prisma from '../../../shared/database/prisma';
import { refuseProductionSeed } from '../../../shared/config/prod-seed';
import { logger } from '../../../shared/logger';
import {
  invalidateTenantCache,
  tenantCacheKeys,
} from '../../../shared/cache/tenant-metadata-cache';
import { getCoaTemplateRows, sortCoaRows, type CoaIndustryKey } from '../data/coa-template.data';
import {
  buildAccountDefinitions,
  glDefaultsForForms,
  CORE_SYSTEM_GL_CODES,
  SYSTEM_GL_CODES,
} from '../data/system-account-map';
import { overlayColumnAccountIds } from '../settings/account-definition-map';
import { demoCatalogService } from '../../inventory/services/demo-catalog.service';
import type { Prisma } from '@prisma/client';

export type TenantProvisionResult = {
  success: true;
  count: number;
  accountsCreated: number;
  skipped: boolean;
  unitId?: string;
  warehouseId?: string;
  safeId?: string;
  fiscalYearId?: string;
  branchId?: string;
  glDefaults?: ReturnType<typeof glDefaultsForForms>;
};

const MIN_COA_FOR_SKIP = 15;

export class TenantProvisioningService {
  async provisionStandardTenant(
    companyId: string,
    options?: { force?: boolean; currencyCode?: string; industry?: CoaIndustryKey | string }
  ): Promise<TenantProvisionResult> {
    if (refuseProductionSeed()) {
      const count = await prisma.account.count({ where: { companyId, deletedAt: null } });
      logger.warn({ companyId, count }, 'Skipping tenant provisioning in production');
      return {
        success: true,
        count,
        accountsCreated: 0,
        skipped: true,
      };
    }

    const result = await prisma.$transaction(
      async (tx) => {
        return this.provisionWithinTransaction(companyId, tx, options);
      },
      { maxWait: 15_000, timeout: 60_000 }
    );

    await invalidateTenantCache(tenantCacheKeys.coaTree(companyId));
    await invalidateTenantCache(tenantCacheKeys.settings(companyId));
    await invalidateTenantCache(tenantCacheKeys.branches(companyId));

    try {
      await demoCatalogService.ensureDemoCatalog(companyId);
    } catch (demoErr) {
      logger.warn({ demoErr, companyId }, 'Demo catalog ensure failed after provision');
    }

    logger.info({ companyId, ...result }, 'Tenant standard provisioning completed');
    return result;
  }

  async provisionWithinTransaction(
    companyId: string,
    tx: Prisma.TransactionClient,
    options?: { force?: boolean; currencyCode?: string; industry?: CoaIndustryKey | string }
  ): Promise<TenantProvisionResult> {
    const industry = options?.industry ?? 'general';
    const templateRows = sortCoaRows(getCoaTemplateRows(industry));

    const existing = await tx.account.count({
      where: { companyId, deletedAt: null },
    });

    let accountsCreated = 0;
    const codeToId = new Map<string, string>();

    for (const row of templateRows) {
      let acc = await tx.account.findFirst({
        where: { companyId, code: row.code, deletedAt: null },
      });
      const expectedParentId = row.parentCode ? codeToId.get(row.parentCode) ?? null : null;

      if (!acc) {
        acc = await tx.account.create({
          data: {
            companyId,
            code: row.code,
            arabicName: row.arabicName,
            englishName: row.englishName,
            accountType: row.accountType,
            accountSide: row.accountSide ?? null,
            parentId: expectedParentId,
            isActive: true,
          },
        });
        accountsCreated += 1;
      } else {
        const needsParentFix = acc.parentId !== expectedParentId;
        const needsMetaFix =
          acc.arabicName !== row.arabicName ||
          acc.accountType !== row.accountType ||
          (row.accountSide != null && acc.accountSide !== row.accountSide);
        if (needsParentFix || needsMetaFix) {
          acc = await tx.account.update({
            where: { id: acc.id },
            data: {
              parentId: expectedParentId,
              ...(needsMetaFix
                ? {
                    arabicName: row.arabicName,
                    englishName: row.englishName,
                    accountType: row.accountType,
                    accountSide: row.accountSide ?? acc.accountSide,
                  }
                : {}),
            },
          });
        }
      }
      codeToId.set(row.code, acc.id);
    }

    for (const code of Object.values(CORE_SYSTEM_GL_CODES)) {
      if (!codeToId.has(code)) {
        throw new Error(`Provisioning incomplete: missing account code ${code}`);
      }
    }

    const industryKey = String(industry).toLowerCase();
    if (industryKey === 'contracting' || industryKey === 'construction') {
      for (const code of [
        SYSTEM_GL_CODES.contractRevenue,
        SYSTEM_GL_CODES.retentionReceivable,
        SYSTEM_GL_CODES.retentionPayable,
      ]) {
        if (!codeToId.has(code)) {
          throw new Error(`Provisioning incomplete: missing contracting account code ${code}`);
        }
      }
    }

    const currencyCode =
      options?.currencyCode ??
      (await tx.companySettings.findUnique({ where: { companyId }, select: { defaultCurrency: true } }))
        ?.defaultCurrency ??
      'EGP';

    await tx.companySettings.upsert({
      where: { companyId },
      create: {
        companyId,
        defaultCurrency: currencyCode,
        accountDefinitions: buildAccountDefinitions(codeToId),
        retainedEarningsAccountId: codeToId.get(SYSTEM_GL_CODES.retainedEarnings)!,
      },
      update: {
        accountDefinitions: buildAccountDefinitions(codeToId),
        retainedEarningsAccountId: codeToId.get(SYSTEM_GL_CODES.retainedEarnings)!,
        defaultCurrency: currencyCode,
      },
    });

    const master = await this.ensureDefaultMasterRecords(companyId, tx, codeToId, currencyCode);

    const total = await tx.account.count({
      where: { companyId, deletedAt: null },
    });

    return {
      success: true,
      count: total,
      accountsCreated,
      skipped: accountsCreated === 0 && existing >= MIN_COA_FOR_SKIP,
      ...master,
      glDefaults: glDefaultsForForms(codeToId),
    };
  }

  private async ensureDefaultMasterRecords(
    companyId: string,
    tx: Prisma.TransactionClient,
    codeToId: Map<string, string>,
    currencyCode: string
  ): Promise<{
    unitId?: string;
    warehouseId?: string;
    safeId?: string;
    fiscalYearId?: string;
    branchId?: string;
  }> {
    let unit = await tx.unit.findFirst({
      where: { companyId, OR: [{ code: 'PCS' }, { arabicName: 'قطعة' }] },
    });
    if (!unit) {
      unit = await tx.unit.create({
        data: {
          companyId,
          code: 'PCS',
          arabicName: 'قطعة',
          englishName: 'Piece',
          isActive: true,
        },
      });
    }

    let branch = await tx.branch.findFirst({
      where: { companyId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
    if (!branch) {
      branch = await tx.branch.create({
        data: {
          companyId,
          arabicName: 'الفرع الرئيسي',
          branchNumber: '01',
        },
      });
    }

    const cashAccountId = codeToId.get(SYSTEM_GL_CODES.cashMain);

    let safe = await tx.safe.findFirst({ where: { companyId, code: 'SAFE-01' } });
    if (!safe) {
      safe = await tx.safe.findFirst({ where: { companyId } });
    }
    if (!safe) {
      safe = await tx.safe.create({
        data: {
          companyId,
          code: 'SAFE-01',
          arabicName: 'الخزينة الرئيسية',
          englishName: 'Main Safe',
          currencyCode,
          glAccountId: cashAccountId ?? null,
          isActive: true,
        },
      });
    } else if (cashAccountId && !safe.glAccountId) {
      safe = await tx.safe.update({
        where: { id: safe.id },
        data: { glAccountId: cashAccountId },
      });
    }

    await tx.branch.update({
      where: { id: branch.id },
      data: { defaultSafeId: safe.id },
    });

    let warehouse = await tx.warehouse.findFirst({
      where: { companyId, branchId: branch.id, code: 'WH-01' },
    });
    if (!warehouse) {
      warehouse = await tx.warehouse.findFirst({
        where: { companyId, branchId: branch.id },
      });
    }
    if (!warehouse) {
      warehouse = await tx.warehouse.create({
        data: {
          companyId,
          branchId: branch.id,
          code: 'WH-01',
          arabicName: 'المخزن الرئيسي',
          englishName: 'Main Warehouse',
          isActive: true,
        },
      });
    }

    await tx.branch.update({
      where: { id: branch.id },
      data: { defaultWarehouseId: warehouse.id },
    });

    const year = new Date().getUTCFullYear();
    const legacyYearId = String(year);
    let fiscalYear = await tx.fiscalYear.findFirst({
      where: { companyId, legacyYearId },
    });
    if (!fiscalYear) {
      fiscalYear = await tx.fiscalYear.findFirst({
        where: { companyId, isActive: true },
        orderBy: { startDate: 'desc' },
      });
    }
    if (!fiscalYear) {
      fiscalYear = await tx.fiscalYear.create({
        data: {
          companyId,
          legacyYearId,
          arabicName: `السنة المالية ${year}`,
          englishName: `Fiscal Year ${year}`,
          startDate: new Date(Date.UTC(year, 0, 1)),
          endDate: new Date(Date.UTC(year, 11, 31, 23, 59, 59)),
          status: 'Open',
          isActive: true,
        },
      });
    }

    await tx.currency.upsert({
      where: { companyId_code: { companyId, code: currencyCode } },
      create: {
        companyId,
        code: currencyCode,
        arabicName: currencyCode,
        englishName: currencyCode,
        isActive: true,
      },
      update: { isActive: true },
    });

    const bankGlId = codeToId.get(SYSTEM_GL_CODES.bankDefault);
    if (bankGlId) {
      let bankEntity = await tx.bank.findFirst({
        where: { companyId, code: 'BANK-DEFAULT' },
      });
      if (!bankEntity) {
        bankEntity = await tx.bank.create({
          data: {
            companyId,
            code: 'BANK-DEFAULT',
            arabicName: 'البنك الافتراضي',
            englishName: 'Default Bank',
            isActive: true,
          },
        });
      }

      const bankAcct = await tx.bankAccount.findFirst({
        where: { companyId, code: 'BANK-01' },
      });
      if (!bankAcct) {
        await tx.bankAccount.create({
          data: {
            companyId,
            bankId: bankEntity.id,
            code: 'BANK-01',
            arabicName: 'حساب البنك الافتراضي',
            englishName: 'Default Bank Account',
            currencyCode,
            glAccountId: bankGlId,
            isActive: true,
          },
        });
      } else if (!bankAcct.glAccountId) {
        await tx.bankAccount.update({
          where: { id: bankAcct.id },
          data: { glAccountId: bankGlId },
        });
      }
    }

    return {
      unitId: unit.id,
      warehouseId: warehouse.id,
      safeId: safe.id,
      fiscalYearId: fiscalYear.id,
      branchId: branch.id,
    };
  }

  async getGlDefaults(companyId: string) {
    const settings = await prisma.companySettings.findUnique({
      where: { companyId },
      select: {
        accountDefinitions: true,
        roundingAccountId: true,
        exchangeGainLossAccountId: true,
        retainedEarningsAccountId: true,
      },
    });
    const defs = overlayColumnAccountIds(
      (settings?.accountDefinitions ?? {}) as Record<string, string | undefined>,
      {
        roundingAccountId: settings?.roundingAccountId,
        exchangeGainLossAccountId: settings?.exchangeGainLossAccountId,
        retainedEarningsAccountId: settings?.retainedEarningsAccountId,
      }
    );
    const pick = (...keys: string[]) => {
      for (const k of keys) {
        const v = defs[k];
        if (typeof v === 'string' && v.trim()) return v.trim();
      }
      return null;
    };
    return {
      inventoryAccountId: pick('defaultInventoryAccountId', 'inventoryAccount', 'stockAccount'),
      salesAccountId: pick('defaultSalesAccountId', 'salesRevenueAccount', 'salesAccount'),
      cogsAccountId: pick('defaultCogsAccountId', 'cogsAccount', 'costOfSalesAccount'),
      arAccountId: pick('defaultArAccountId', 'arAccount', 'customerAccount'),
      apAccountId: pick('defaultApAccountId', 'apAccount', 'supplierAccount'),
      cashAccountId: pick('cashAccount', 'defaultCashAccount', 'cashBoxAccount'),
      bankAccountId: pick('bankAccount', 'defaultBankAccount', 'bankGlAccount'),
      salesReturnAccountId: pick('defaultSalesReturnAccountId', 'salesReturnAccount'),
      vatAccountId: pick('defaultVatAccountId', 'vatOutputAccount', 'salesTaxAccount'),
      retainedEarningsAccountId:
        settings?.retainedEarningsAccountId ??
        pick('defaultRetainedEarningsAccountId', 'retainedEarningsAccount'),
      underCollectionChequeAccountId: pick(
        'defaultUnderCollectionChequeAccountId',
        'chequesUnderCollectionAccount'
      ),
      purchaseAccountId: pick('purchaseAccount', 'purchasesAccount'),
      salesDiscountAccountId: pick('salesDiscountAccount', 'discountAccount'),
      roundingAccountId:
        settings?.roundingAccountId ?? pick('roundingDifferenceAccount', 'roundingAccount'),
      returnedChequesAccountId: pick('returnedChequesAccount', 'bouncedChequesAccount'),
    };
  }
}

export const tenantProvisioningService = new TenantProvisioningService();
