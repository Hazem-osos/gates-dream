import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import prisma from '../../shared/database/prisma';
import { logger } from '../../shared/logger';
import { Decimal } from '@prisma/client/runtime/library';
import { tenantProvisioningService } from '../accounting/services/tenant-provisioning.service';
import { demoCatalogService } from '../inventory/services/demo-catalog.service';
import { SYSTEM_GL_CODES } from '../accounting/data/system-account-map';
import { invoicePostingContextFromIds } from '../invoices/services/invoice-posting-context';
import { seedHazemDemoTransactions } from './hazem-demo-transactions';
import {
  HAZEM_EMAIL,
  HAZEM_DEMO_MARKER,
  HAZEM_COMPANY_AR,
  HAZEM_COMPANY_EN,
  DEMO_UNITS,
  DEMO_BRANCHES,
  DEMO_WAREHOUSES,
  DEMO_SAFES,
  DEMO_BANKS,
  DEMO_CUSTOMERS,
  DEMO_SUPPLIERS,
  DEMO_COST_CENTERS,
  DEMO_ITEMS,
} from './data/hazem-demo.constants';

export type HazemDemoSeedResult = {
  userId: string;
  companyId: string;
  branchId: string;
  fiscalYearId: string;
  masters: Record<string, number>;
  transactions?: Awaited<ReturnType<typeof seedHazemDemoTransactions>>;
  skippedTransactions: boolean;
};

export type HazemSeedMaps = {
  units: Map<string, string>;
  branches: Map<string, string>;
  warehouses: Map<string, string>;
  safes: Map<string, string>;
  bankAccounts: Map<string, string>;
  customers: Map<string, string>;
  suppliers: Map<string, string>;
  items: Map<string, string>;
  costCenters: Map<string, string>;
};

async function ensureGlPostingSettings(companyId: string) {
  const entries: Record<string, string> = {
    GLPost: 'T',
    GLUnPost: 'T',
    SaveUnbalanced: 'F',
    SerialGL: 'Y',
    CreditWarningOnly: 'F',
  };
  for (const [name, value] of Object.entries(entries)) {
    const existing = await prisma.companySettingEntry.findFirst({
      where: { companyId, branchId: null, name },
      select: { id: true },
    });
    if (existing) {
      await prisma.companySettingEntry.update({ where: { id: existing.id }, data: { value } });
    } else {
      await prisma.companySettingEntry.create({ data: { companyId, name, value } });
    }
  }
}

async function grantAllPermissions(userId: string, companyId: string) {
  for (const action of ['view', 'edit', 'delete', 'approve', 'post'] as const) {
    const existing = await prisma.userPermission.findFirst({
      where: { userId, companyId, resource: '*', action },
    });
    if (existing) {
      await prisma.userPermission.update({ where: { id: existing.id }, data: { allow: true } });
    } else {
      await prisma.userPermission.create({
        data: { userId, companyId, resource: '*', action, allow: true },
      });
    }
  }
}

export class HazemDemoSeedService {
  async resolveHazemUser() {
    let user = await prisma.user.findUnique({ where: { email: HAZEM_EMAIL } });
    if (!user) {
      // L5 fix (Item 41): was a hardcoded '12345' — a committed credential
      // for an account that gets `resource: '*'` (every action). Route is
      // already production-blocked (see `demo.routes.ts`), but even in dev a
      // fresh checkout shouldn't bake the same known password into every
      // database it's run against. `DEMO_HAZEM_PASSWORD` lets a developer
      // pin one; otherwise a random password is generated and logged once so
      // it can still be used to log in locally.
      const password = process.env.DEMO_HAZEM_PASSWORD || crypto.randomBytes(9).toString('base64url');
      if (!process.env.DEMO_HAZEM_PASSWORD) {
        logger.warn(
          { email: HAZEM_EMAIL, password },
          'Generated random password for new demo user (set DEMO_HAZEM_PASSWORD to pin one)'
        );
      }
      const passwordHash = await bcrypt.hash(password, 10);
      const company = await prisma.company.create({
        data: {
          arabicName: HAZEM_COMPANY_AR,
          englishName: HAZEM_COMPANY_EN,
          contactEmail: HAZEM_EMAIL,
          isActive: true,
        },
      });
      user = await prisma.user.create({
        data: {
          email: HAZEM_EMAIL,
          username: 'hazem',
          passwordHash,
          firstName: 'Hazem',
          preferredLanguage: 'ar',
          isActive: true,
          companyId: company.id,
        },
      });
    }
    return user;
  }

  async seed(options?: { forceTransactions?: boolean }): Promise<HazemDemoSeedResult> {
    const user = await this.resolveHazemUser();
    let companyId = user.companyId;
    if (!companyId) {
      const company = await prisma.company.create({
        data: {
          arabicName: HAZEM_COMPANY_AR,
          englishName: HAZEM_COMPANY_EN,
          contactEmail: HAZEM_EMAIL,
          isActive: true,
        },
      });
      companyId = company.id;
      await prisma.user.update({ where: { id: user.id }, data: { companyId } });
    }

    await prisma.company.update({
      where: { id: companyId },
      data: {
        arabicName: HAZEM_COMPANY_AR,
        englishName: HAZEM_COMPANY_EN,
        contactEmail: HAZEM_EMAIL,
        isActive: true,
      },
    });

    await tenantProvisioningService.provisionStandardTenant(companyId, { force: false });
    await demoCatalogService.ensureDemoCatalog(companyId);
    await ensureGlPostingSettings(companyId);
    await grantAllPermissions(user.id, companyId);

    const maps: HazemSeedMaps = {
      units: new Map(),
      branches: new Map(),
      warehouses: new Map(),
      safes: new Map(),
      bankAccounts: new Map(),
      customers: new Map(),
      suppliers: new Map(),
      items: new Map(),
      costCenters: new Map(),
    };

    for (const u of DEMO_UNITS) {
      let row = await prisma.unit.findFirst({ where: { companyId, code: u.code } });
      if (!row) {
        row = await prisma.unit.create({
          data: {
            companyId,
            code: u.code,
            arabicName: u.arabicName,
            englishName: u.englishName,
            isActive: true,
          },
        });
      }
      maps.units.set(u.code, row.id);
    }

    for (const b of DEMO_BRANCHES) {
      let row = await prisma.branch.findFirst({
        where: { companyId, branchNumber: b.branchNumber, deletedAt: null },
      });
      if (!row) {
        row = await prisma.branch.create({
          data: { companyId, arabicName: b.arabicName, branchNumber: b.branchNumber },
        });
      } else if (row.arabicName !== b.arabicName) {
        row = await prisma.branch.update({
          where: { id: row.id },
          data: { arabicName: b.arabicName },
        });
      }
      maps.branches.set(b.code, row.id);
    }

    const mainBranchId = maps.branches.get('BR-CAI')!;
    for (const w of DEMO_WAREHOUSES) {
      const branchId = maps.branches.get(w.branchCode) ?? mainBranchId;
      let row = await prisma.warehouse.findFirst({ where: { companyId, code: w.code } });
      if (!row) {
        row = await prisma.warehouse.create({
          data: {
            companyId,
            branchId,
            code: w.code,
            arabicName: w.arabicName,
            englishName: w.englishName,
            isActive: true,
          },
        });
      }
      maps.warehouses.set(w.code, row.id);
    }

    const cashGl = await prisma.account.findFirst({
      where: { companyId, code: SYSTEM_GL_CODES.cashMain, deletedAt: null },
    });
    const bankGl = await prisma.account.findFirst({
      where: { companyId, code: SYSTEM_GL_CODES.bankDefault, deletedAt: null },
    });

    for (const s of DEMO_SAFES) {
      let row = await prisma.safe.findFirst({ where: { companyId, code: s.code } });
      if (!row) {
        row = await prisma.safe.create({
          data: {
            companyId,
            code: s.code,
            arabicName: s.arabicName,
            englishName: s.englishName,
            currencyCode: 'EGP',
            glAccountId: cashGl?.id ?? null,
            isActive: true,
          },
        });
      }
      maps.safes.set(s.code, row.id);
    }

    for (const b of DEMO_BANKS) {
      let bank = await prisma.bank.findFirst({ where: { companyId, code: b.bankCode } });
      if (!bank) {
        bank = await prisma.bank.create({
          data: {
            companyId,
            code: b.bankCode,
            arabicName: b.bankName,
            englishName: b.bankName,
            isActive: true,
          },
        });
      }
      let acct = await prisma.bankAccount.findFirst({ where: { companyId, code: b.accountCode } });
      if (!acct) {
        acct = await prisma.bankAccount.create({
          data: {
            companyId,
            bankId: bank.id,
            code: b.accountCode,
            arabicName: b.bankName,
            englishName: b.bankName,
            currencyCode: 'EGP',
            glAccountId: bankGl?.id ?? null,
            isActive: true,
          },
        });
      }
      maps.bankAccounts.set(b.accountCode, acct.id);
    }

    const year = 2026;
    let fiscalYear = await prisma.fiscalYear.findFirst({
      where: { companyId, legacyYearId: String(year) },
    });
    if (!fiscalYear) {
      fiscalYear = await prisma.fiscalYear.create({
        data: {
          companyId,
          legacyYearId: String(year),
          arabicName: `السنة المالية ${year}`,
          englishName: `Fiscal Year ${year}`,
          startDate: new Date(Date.UTC(year, 0, 1)),
          endDate: new Date(Date.UTC(year, 11, 31, 23, 59, 59)),
          status: 'Open',
          isActive: true,
        },
      });
    } else {
      fiscalYear = await prisma.fiscalYear.update({
        where: { id: fiscalYear.id },
        data: { status: 'Open', isActive: true },
      });
    }

    for (const bp of DEMO_BRANCHES) {
      const branchId = maps.branches.get(bp.code)!;
      await prisma.userBranchPermission.upsert({
        where: { userId_branchId: { userId: user.id, branchId } },
        create: { userId: user.id, branchId, companyId },
        update: {},
      });
    }

    const ar = await prisma.account.findFirst({
      where: { companyId, code: SYSTEM_GL_CODES.ar, deletedAt: null },
    });
    const ap = await prisma.account.findFirst({
      where: { companyId, code: SYSTEM_GL_CODES.ap, deletedAt: null },
    });
    const inv = await prisma.account.findFirst({
      where: { companyId, code: SYSTEM_GL_CODES.inventory, deletedAt: null },
    });

    for (const c of DEMO_CUSTOMERS) {
      let row = await prisma.customer.findFirst({ where: { companyId, code: c.code } });
      if (!row) {
        row = await prisma.customer.create({
          data: {
            companyId,
            code: c.code,
            arabicName: c.arabicName,
            phone1: c.phone,
            taxData: true,
            taxAuthority: c.taxId,
            city: c.city,
            street: c.street,
            balance: new Decimal(c.balance),
            mainAccountId: ar?.id ?? null,
            accountId: ar?.id ?? null,
            isActive: true,
          },
        });
      }
      maps.customers.set(c.code, row.id);
    }

    for (const s of DEMO_SUPPLIERS) {
      let row = await prisma.supplier.findFirst({ where: { companyId, code: s.code } });
      if (!row) {
        row = await prisma.supplier.create({
          data: {
            companyId,
            code: s.code,
            arabicName: s.arabicName,
            phone1: s.phone,
            taxData: true,
            taxAuthority: s.taxId,
            city: s.city,
            balance: new Decimal(s.balance),
            mainAccountId: ap?.id ?? null,
            accountId: ap?.id ?? null,
            isActive: true,
          },
        });
      }
      maps.suppliers.set(s.code, row.id);
    }

    for (const cc of DEMO_COST_CENTERS) {
      let row = await prisma.costCenter.findFirst({ where: { companyId, code: cc.code } });
      if (!row) {
        row = await prisma.costCenter.create({
          data: { companyId, code: cc.code, arabicName: cc.arabicName, isActive: true },
        });
      }
      maps.costCenters.set(cc.code, row.id);
    }

    let priceList = await prisma.priceList.findFirst({
      where: { companyId, code: 'PL-DEFAULT' },
    });
    if (!priceList) {
      priceList = await prisma.priceList.create({
        data: {
          companyId,
          code: 'PL-DEFAULT',
          arabicName: 'قائمة أسعار افتراضية',
          englishName: 'Default Price List',
          isActive: true,
        },
      });
    }

    for (const item of DEMO_ITEMS) {
      const unitId = maps.units.get(item.unit);
      const whId = maps.warehouses.get(item.wh);
      if (!unitId || !whId) continue;

      let row = await prisma.item.findFirst({ where: { companyId, serial: item.serial } });
      if (!row) {
        row = await prisma.item.create({
          data: {
            companyId,
            serial: item.serial,
            arabicName: item.arabicName,
            mainAccountId: inv?.id ?? null,
            itemType: 'normal',
            property1: item.group,
            isActive: true,
          },
        });
      } else {
        await prisma.item.update({
          where: { id: row.id },
          data: { property1: item.group, mainAccountId: inv?.id ?? row.mainAccountId },
        });
      }
      maps.items.set(item.serial, row.id);

      await prisma.itemUnit.upsert({
        where: { itemId_unitId: { itemId: row.id, unitId } },
        create: { itemId: row.id, unitId, conversionFactor: 1, isBaseUnit: true },
        update: { isBaseUnit: true, conversionFactor: 1 },
      });

      if (item.qty > 0) {
        const qtyRow = await prisma.itemQuantity.findFirst({
          where: { itemId: row.id, warehouseId: whId, locationId: null },
        });
        if (!qtyRow) {
          await prisma.itemQuantity.create({
            data: {
              itemId: row.id,
              warehouseId: whId,
              locationId: null,
              quantity: new Decimal(item.qty),
            },
          });
        }
      }

      if (item.price > 0) {
        await prisma.itemPrice.upsert({
          where: {
            itemId_priceListId_unitId: {
              itemId: row.id,
              priceListId: priceList.id,
              unitId,
            },
          },
          create: {
            itemId: row.id,
            priceListId: priceList.id,
            unitId,
            price: new Decimal(item.price),
          },
          update: { price: new Decimal(item.price) },
        });
      }
    }

    await prisma.branch.update({
      where: { id: mainBranchId },
      data: {
        defaultSafeId: maps.safes.get('SAFE-MAIN') ?? undefined,
        defaultWarehouseId: maps.warehouses.get('WH-GEN') ?? undefined,
      },
    });

    const marker = await prisma.companySettingEntry.findFirst({
      where: { companyId, branchId: null, name: HAZEM_DEMO_MARKER },
    });
    const skipTx = marker?.value === 'done' && !options?.forceTransactions;

    let transactions: Awaited<ReturnType<typeof seedHazemDemoTransactions>> | undefined;
    if (!skipTx) {
      const ctx = invoicePostingContextFromIds({
        companyId,
        branchId: mainBranchId,
        fiscalYearId: fiscalYear.id,
        userId: user.id,
      });
      try {
        transactions = await seedHazemDemoTransactions({
          companyId,
          ctx,
          maps,
          fiscalYearLegacyId: fiscalYear.legacyYearId ?? String(year),
        });
        const existingMarker = await prisma.companySettingEntry.findFirst({
          where: { companyId, branchId: null, name: HAZEM_DEMO_MARKER },
          select: { id: true },
        });
        if (existingMarker) {
          await prisma.companySettingEntry.update({
            where: { id: existingMarker.id },
            data: { value: 'done' },
          });
        } else {
          await prisma.companySettingEntry.create({
            data: { companyId, name: HAZEM_DEMO_MARKER, value: 'done' },
          });
        }
      } catch (txErr) {
        logger.error({ txErr, companyId }, 'Hazem demo transactions partially failed');
        transactions = { error: txErr instanceof Error ? txErr.message : 'partial' } as never;
      }
    }

    logger.info({ companyId, userId: user.id, skipTx }, 'Hazem demo seed completed');

    return {
      userId: user.id,
      companyId,
      branchId: mainBranchId,
      fiscalYearId: fiscalYear.id,
      masters: {
        customers: maps.customers.size,
        suppliers: maps.suppliers.size,
        items: maps.items.size,
        warehouses: maps.warehouses.size,
        costCenters: maps.costCenters.size,
      },
      transactions,
      skippedTransactions: skipTx,
    };
  }
}

export const hazemDemoSeedService = new HazemDemoSeedService();
