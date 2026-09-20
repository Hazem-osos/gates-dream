import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';
import type {
  CompanyBasicsInput,
  UpdateCompanyCurrentInput,
  UpsertTenantBranchInput,
  UpsertTenantFiscalYearInput,
} from '../schemas/company-current.schema';
import { upsertCompanyFiscalYear } from './fiscal-year-sync.service';
import { companyOnboardingService } from './company-onboarding.service';
import { ensureDefaultPieceUnit } from '../../inventory/services/ensure-default-unit';
import { ensureDefaultUngroupedCategory } from '../../inventory/services/ensure-default-item-category';
import { ensureDefaultWarehouseTree } from '../../inventory/services/ensure-default-warehouse';

function maskSecret(secret: string | null | undefined): string | null {
  if (!secret) return null;
  return '********';
}

export class CompanyCurrentService {
  async getCurrent(companyId: string) {
    const company = await prisma.company.findFirst({
      where: { id: companyId, deletedAt: null },
      include: {
        settings: true,
      },
    });

    if (!company) {
      throw new Error('Company not found');
    }

    const eInv = await prisma.eInvoiceSetting.findUnique({
      where: { companyId },
    });

    return {
      id: company.id,
      nameAr: company.arabicName,
      nameEn: company.englishName,
      taxRegistrationNumber: company.taxNumber1,
      commercialRegister: company.entityNumber,
      activityCode: eInv?.activityCode ?? company.entityTypeCode,
      currencyCode: company.settings?.defaultCurrency ?? null,
      logoUrl: company.settings?.logoUrl ?? null,
      phone: company.phone1,
      email: company.contactEmail ?? null,
      address: company.address,
      aiQuota: {
        used: company.aiTokensUsedThisMonth,
        limit: company.aiMonthlyTokenLimit,
        resetAt: company.aiQuotaResetDate,
      },
      eInvoiceSettings: eInv
        ? {
            clientId: eInv.clientId,
            clientSecret: maskSecret(eInv.clientSecret),
            clientSecretConfigured: Boolean(eInv.clientSecret),
            activityCode: eInv.activityCode,
            tokenPin: eInv.tokenPin ? maskSecret(eInv.tokenPin) : null,
            environment: eInv.environment,
            issuerTaxId: eInv.issuerTaxId,
          }
        : null,
    };
  }

  async updateCurrent(companyId: string, input: UpdateCompanyCurrentInput) {
    const existing = await prisma.company.findFirst({
      where: { id: companyId, deletedAt: null },
    });
    if (!existing) {
      throw new Error('Company not found');
    }

    await prisma.$transaction(async (tx) => {
      await tx.company.update({
        where: { id: companyId },
        data: {
          arabicName: input.nameAr ?? undefined,
          englishName: input.nameEn === undefined ? undefined : input.nameEn,
          taxNumber1:
            input.taxRegistrationNumber === undefined
              ? undefined
              : input.taxRegistrationNumber,
          entityNumber:
            input.commercialRegister === undefined ? undefined : input.commercialRegister,
          phone1: input.phone === undefined ? undefined : input.phone,
          contactEmail: input.email === undefined ? undefined : input.email,
          address: input.address === undefined ? undefined : input.address,
          entityTypeCode:
            input.activityCode === undefined && !input.eInvoiceSettings?.activityCode
              ? undefined
              : input.activityCode ?? input.eInvoiceSettings?.activityCode ?? undefined,
        },
      });

      if (
        input.currencyCode !== undefined ||
        input.logoUrl !== undefined
      ) {
        await tx.companySettings.upsert({
          where: { companyId },
          create: {
            companyId,
            defaultCurrency: input.currencyCode ?? undefined,
            logoUrl: input.logoUrl ?? undefined,
          },
          update: {
            defaultCurrency: input.currencyCode ?? undefined,
            logoUrl: input.logoUrl === undefined ? undefined : input.logoUrl,
          },
        });
      }

      if (input.eInvoiceSettings) {
        const secret =
          input.eInvoiceSettings.clientSecret &&
          input.eInvoiceSettings.clientSecret !== '********'
            ? input.eInvoiceSettings.clientSecret
            : undefined;

        await tx.eInvoiceSetting.upsert({
          where: { companyId },
          create: {
            companyId,
            clientId: input.eInvoiceSettings.clientId ?? undefined,
            clientSecret: secret,
            activityCode:
              input.eInvoiceSettings.activityCode ?? input.activityCode ?? undefined,
            tokenPin: input.eInvoiceSettings.tokenPin ?? undefined,
            environment: input.eInvoiceSettings.environment ?? 'PRE_PRODUCTION',
            issuerTaxId: input.eInvoiceSettings.issuerTaxId ?? undefined,
          },
          update: {
            clientId: input.eInvoiceSettings.clientId ?? undefined,
            ...(secret !== undefined ? { clientSecret: secret } : {}),
            activityCode:
              input.eInvoiceSettings.activityCode ?? input.activityCode ?? undefined,
            tokenPin: input.eInvoiceSettings.tokenPin ?? undefined,
            environment: input.eInvoiceSettings.environment ?? undefined,
            issuerTaxId: input.eInvoiceSettings.issuerTaxId ?? undefined,
          },
        });
      }
    });

    logger.info({ companyId }, 'Company current profile updated');
    return this.getCurrent(companyId);
  }

  async listBranchesWithDefaults(companyId: string) {
    const branches = await prisma.branch.findMany({
      where: { companyId, deletedAt: null },
      orderBy: { arabicName: 'asc' },
      include: {
        defaultWarehouse: { select: { id: true, arabicName: true, code: true } },
        defaultSafe: { select: { id: true, arabicName: true, code: true } },
      },
    });

    return branches.map((b) => ({
      id: b.id,
      arabicName: b.arabicName,
      branchNumber: b.branchNumber,
      serial: b.serial,
      address: b.address,
      defaultWarehouseId: b.defaultWarehouseId,
      defaultSafeId: b.defaultSafeId,
      defaultWarehouse: b.defaultWarehouse,
      defaultSafe: b.defaultSafe,
    }));
  }

  async upsertBranch(companyId: string, input: UpsertTenantBranchInput) {
    if (input.defaultWarehouseId) {
      const wh = await prisma.warehouse.findFirst({
        where: { id: input.defaultWarehouseId, companyId },
      });
      if (!wh) throw new Error('Default warehouse not found for this company');
    }
    if (input.defaultSafeId) {
      const safe = await prisma.safe.findFirst({
        where: { id: input.defaultSafeId, companyId },
      });
      if (!safe) throw new Error('Default cash safe not found for this company');
    }

    const payload = {
      arabicName: input.arabicName,
      branchNumber: input.branchNumber ?? undefined,
      serial: input.serial ?? undefined,
      address: input.address ?? undefined,
      defaultWarehouseId: input.defaultWarehouseId ?? undefined,
      defaultSafeId: input.defaultSafeId ?? undefined,
    };

    if (input.id) {
      const existing = await prisma.branch.findFirst({
        where: { id: input.id, companyId },
      });
      if (!existing) throw new Error('Branch not found');

      const updated = await prisma.branch.update({
        where: { id: input.id },
        data: payload,
        include: {
          defaultWarehouse: { select: { id: true, arabicName: true, code: true } },
          defaultSafe: { select: { id: true, arabicName: true, code: true } },
        },
      });
      return updated;
    }

    const created = await prisma.branch.create({
      data: { companyId, ...payload },
      include: {
        defaultWarehouse: { select: { id: true, arabicName: true, code: true } },
        defaultSafe: { select: { id: true, arabicName: true, code: true } },
      },
    });
    return created;
  }

  async upsertFiscalYear(companyId: string, input: UpsertTenantFiscalYearInput) {
    return upsertCompanyFiscalYear(companyId, input);
  }

  async saveBasics(companyId: string, input: CompanyBasicsInput) {
    await this.updateCurrent(companyId, {
      nameAr: input.nameAr,
      nameEn: input.nameEn,
      taxRegistrationNumber: input.taxRegistrationNumber,
      commercialRegister: input.commercialRegister,
      activityCode: input.activityCode,
      currencyCode: input.currencyCode,
      logoUrl: input.logoUrl,
      phone: input.phone,
      email: input.email,
      address: input.address,
      eInvoiceSettings: input.eInvoiceSettings,
    });

    const currencyCode = input.currencyCode?.trim() || 'EGP';

    const result = await prisma.$transaction(async (tx) => {
      let branch = input.branch.id
        ? await tx.branch.findFirst({
            where: { id: input.branch.id, companyId, deletedAt: null },
          })
        : await tx.branch.findFirst({
            where: { companyId, deletedAt: null },
            orderBy: { createdAt: 'asc' },
          });

      if (!branch) {
        branch = await tx.branch.create({
          data: {
            companyId,
            arabicName: input.branch.arabicName.trim(),
            branchNumber: '01',
          },
        });
      } else {
        branch = await tx.branch.update({
          where: { id: branch.id },
          data: { arabicName: input.branch.arabicName.trim() },
        });
      }

      const warehouseName = input.branch.warehouseName.trim();
      const { header, warehouse } = await ensureDefaultWarehouseTree(companyId, tx, {
        branchId: branch.id,
        arabicName: warehouseName,
        englishName: warehouseName,
      });
      await tx.warehouse.update({
        where: { id: header.id },
        data: {
          arabicName: warehouseName,
          englishName: warehouseName,
          branchId: header.branchId ?? branch.id,
          isActive: true,
        },
      });
      await tx.warehouse.update({
        where: { id: warehouse.id },
        data: {
          arabicName: warehouseName,
          englishName: warehouseName,
          branchId: warehouse.branchId ?? branch.id,
          isActive: true,
        },
      });

      const cashAccount = await tx.account.findFirst({
        where: {
          companyId,
          deletedAt: null,
          OR: [{ code: '1111' }, { code: '1000' }, { code: '1101' }],
        },
        orderBy: { code: 'asc' },
      });

      let safe =
        (input.branch.defaultSafeId
          ? await tx.safe.findFirst({
              where: { id: input.branch.defaultSafeId, companyId },
            })
          : null) ??
        (await tx.safe.findFirst({
          where: { companyId },
          orderBy: { createdAt: 'asc' },
        }));

      if (!safe) {
        safe = await tx.safe.create({
          data: {
            companyId,
            code: 'SAFE-01',
            arabicName: input.branch.safeName.trim(),
            englishName: input.branch.safeName.trim(),
            currencyCode,
            glAccountId: cashAccount?.id ?? null,
            isActive: true,
          },
        });
      } else {
        safe = await tx.safe.update({
          where: { id: safe.id },
          data: {
            arabicName: input.branch.safeName.trim(),
            isActive: true,
            glAccountId: safe.glAccountId ?? cashAccount?.id ?? null,
          },
        });
      }

      branch = await tx.branch.update({
        where: { id: branch.id },
        data: {
          defaultWarehouseId: warehouse.id,
          defaultSafeId: safe.id,
        },
      });

      const fiscalYear = await upsertCompanyFiscalYear(companyId, input.fiscalYear, tx);
      const unit = await ensureDefaultPieceUnit(companyId, tx);
      await ensureDefaultUngroupedCategory(companyId, tx);

      return {
        branchId: branch.id,
        fiscalYearId: fiscalYear.id,
        warehouseId: warehouse.id,
        safeId: safe.id,
        unitId: unit.id,
      };
    });

    try {
      await companyOnboardingService.syncOnboardedFlag(companyId);
    } catch (err) {
      logger.warn({ err, companyId }, 'Could not sync onboarded flag after company basics');
    }

    logger.info({ companyId, ...result }, 'Company basics saved');
    const company = await this.getCurrent(companyId);
    return { ...company, ...result };
  }
}

export const companyCurrentService = new CompanyCurrentService();
