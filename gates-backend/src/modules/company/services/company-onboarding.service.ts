import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';
import type { OnboardingSetupInput } from '../schemas/company-onboarding.schema';
import { tenantProvisioningService } from '../../accounting/services/tenant-provisioning.service';
import { ensureDefaultWarehouseTree } from '../../inventory/services/ensure-default-warehouse';
import { retireWelcomeTourNotification } from '../../notifications/services/onboarding-welcome-notification.service';

const LEGACY_STANDARD_COA: Array<{ code: string; arabicName: string; accountType: string }> = [
  { code: '1000', arabicName: 'الصندوق', accountType: 'asset' },
  { code: '1100', arabicName: 'البنك', accountType: 'asset' },
  { code: '1200', arabicName: 'العملاء', accountType: 'asset' },
  { code: '1300', arabicName: 'المخزون', accountType: 'asset' },
  { code: '2000', arabicName: 'الموردون', accountType: 'liability' },
  { code: '2100', arabicName: 'ضريبة القيمة المضافة', accountType: 'liability' },
  { code: '3000', arabicName: 'حقوق الملكية', accountType: 'equity' },
  { code: '4000', arabicName: 'إيرادات المبيعات', accountType: 'revenue' },
  { code: '5000', arabicName: 'تكلفة البضاعة المباعة', accountType: 'expense' },
  { code: '5100', arabicName: 'مصروفات عمومية وإدارية', accountType: 'expense' },
];

export type OnboardingStatus = {
  /** True when baseline master data is incomplete — user must complete welcome wizard */
  needsOnboarding: boolean;
  isOnboarded: boolean;
  onboardedAt: string | null;
  checklist: {
    companyProfile: boolean;
    branch: boolean;
    fiscalYear: boolean;
    cashSafe: boolean;
    warehouse: boolean;
    chartOfAccounts: boolean;
  };
  readyToComplete: boolean;
};

export class CompanyOnboardingService {
  async getStatus(companyId: string): Promise<OnboardingStatus> {
    const company = await prisma.company.findFirst({
      where: { id: companyId, deletedAt: null },
      select: {
        isOnboarded: true,
        onboardedAt: true,
        arabicName: true,
        taxNumber1: true,
        settings: { select: { defaultCurrency: true } },
      },
    });
    if (!company) throw new Error('Company not found');

    const [branchCount, fyCount, safeCount, whCount, accountCount] = await Promise.all([
      prisma.branch.count({ where: { companyId, deletedAt: null } }),
      prisma.fiscalYear.count({ where: { companyId, isActive: true } }),
      prisma.safe.count({ where: { companyId } }),
      prisma.warehouse.count({ where: { companyId } }),
      prisma.account.count({ where: { companyId, deletedAt: null } }),
    ]);

    const companyProfile = Boolean(
      company.arabicName?.trim() && (company.taxNumber1 || company.settings?.defaultCurrency)
    );

    const checklist = {
      companyProfile,
      branch: branchCount >= 1,
      fiscalYear: fyCount >= 1,
      cashSafe: safeCount >= 1,
      warehouse: whCount >= 1,
      chartOfAccounts: accountCount >= 5,
    };

    const readyToComplete = Object.values(checklist).every(Boolean);

    const completedViaWizard = company.isOnboarded;
    const needsOnboarding = !completedViaWizard && !readyToComplete;

    return {
      needsOnboarding,
      isOnboarded: completedViaWizard || readyToComplete,
      onboardedAt:
        completedViaWizard || readyToComplete
          ? company.onboardedAt?.toISOString() ?? null
          : null,
      checklist,
      readyToComplete,
    };
  }

  async runSetup(companyId: string, input: OnboardingSetupInput) {
    const result = await prisma.$transaction(async (tx) => {
      await tx.company.update({
        where: { id: companyId },
        data: {
          arabicName: input.company.nameAr,
          englishName: input.company.nameEn ?? undefined,
          taxNumber1: input.company.taxRegistrationNumber ?? undefined,
          entityNumber: input.company.commercialRegister ?? undefined,
          entityTypeCode: input.company.activityCode ?? undefined,
        },
      });

      const prevSettings = await tx.companySettings.findUnique({ where: { companyId } });
      const prevAdvanced =
        prevSettings?.advancedSettings && typeof prevSettings.advancedSettings === 'object'
          ? (prevSettings.advancedSettings as Record<string, unknown>)
          : {};
      const advancedSettings = input.industryTemplate
        ? { ...prevAdvanced, industryTemplate: input.industryTemplate }
        : prevSettings?.advancedSettings ?? undefined;

      await tx.companySettings.upsert({
        where: { companyId },
        create: {
          companyId,
          defaultCurrency: input.company.currencyCode,
          logoUrl: input.company.logoUrl ?? undefined,
          advancedSettings: input.industryTemplate
            ? { industryTemplate: input.industryTemplate }
            : undefined,
        },
        update: {
          defaultCurrency: input.company.currencyCode,
          logoUrl: input.company.logoUrl === undefined ? undefined : input.company.logoUrl,
          ...(input.industryTemplate ? { advancedSettings } : {}),
        },
      });

      await tx.currency.upsert({
        where: { companyId_code: { companyId, code: input.company.currencyCode } },
        create: {
          companyId,
          code: input.company.currencyCode,
          arabicName: input.company.currencyCode,
          englishName: input.company.currencyCode,
          isActive: true,
        },
        update: { isActive: true },
      });

      let branch = await tx.branch.findFirst({
        where: { companyId, deletedAt: null },
        orderBy: { createdAt: 'asc' },
      });
      if (!branch) {
        branch = await tx.branch.create({
          data: {
            companyId,
            arabicName: input.branch.arabicName,
            branchNumber: input.branch.branchNumber ?? '01',
          },
        });
      } else {
        branch = await tx.branch.update({
          where: { id: branch.id },
          data: {
            arabicName: input.branch.arabicName,
            branchNumber: input.branch.branchNumber ?? branch.branchNumber,
          },
        });
      }

      const legacyYearId =
        input.fiscalYear.legacyYearId ??
        (input.fiscalYear.name.replace(/\D/g, '').slice(0, 4) ||
          String(new Date(input.fiscalYear.startDate).getFullYear()));

      let fiscalYear = await tx.fiscalYear.findFirst({
        where: { companyId, isActive: true },
        orderBy: { startDate: 'desc' },
      });
      if (!fiscalYear) {
        fiscalYear = await tx.fiscalYear.create({
          data: {
            companyId,
            legacyYearId,
            arabicName: input.fiscalYear.name,
            englishName: input.fiscalYear.name,
            startDate: new Date(input.fiscalYear.startDate),
            endDate: new Date(input.fiscalYear.endDate),
            status: 'Open',
            isActive: true,
          },
        });
      }

      if (!input.seedStandardCoa) {
        const existing = await tx.account.count({ where: { companyId, deletedAt: null } });
        if (existing < 5) {
          for (const row of LEGACY_STANDARD_COA) {
            const found = await tx.account.findFirst({
              where: { companyId, code: row.code },
            });
            if (!found) {
              await tx.account.create({
                data: {
                  companyId,
                  code: row.code,
                  arabicName: row.arabicName,
                  accountType: row.accountType,
                  isActive: true,
                },
              });
            }
          }
        }
      }

      let cashAccount = await tx.account.findFirst({
        where: {
          companyId,
          OR: [
            { code: input.treasury.cashGlAccountCode },
            { code: '1111' },
            { code: '1000' },
          ],
        },
      });
      if (!cashAccount) {
        cashAccount = await tx.account.create({
          data: {
            companyId,
            code: input.treasury.cashGlAccountCode,
            arabicName: 'الصندوق',
            accountType: 'asset',
            isActive: true,
          },
        });
      }

      let safe = await tx.safe.findFirst({ where: { companyId } });
      if (!safe) {
        safe = await tx.safe.create({
          data: {
            companyId,
            code: input.treasury.safeCode ?? 'MAIN',
            arabicName: input.treasury.safeArabicName,
            currencyCode: input.company.currencyCode,
            glAccountId: cashAccount.id,
            isActive: true,
          },
        });
      }

      await tx.branch.update({
        where: { id: branch.id },
        data: { defaultSafeId: safe.id },
      });

      const { warehouse } = await ensureDefaultWarehouseTree(companyId, tx, {
        branchId: branch.id,
        arabicName: input.warehouse.arabicName,
        postingCode: input.warehouse.code,
      });

      await tx.branch.update({
        where: { id: branch.id },
        data: { defaultWarehouseId: warehouse.id },
      });

      await tx.company.update({
        where: { id: companyId },
        data: { isOnboarded: true, onboardedAt: new Date() },
      });

      return {
        branchId: branch.id,
        fiscalYearId: fiscalYear.id,
        safeId: safe.id,
        warehouseId: warehouse.id,
      };
    });

    if (input.seedStandardCoa) {
      await tenantProvisioningService.provisionStandardTenant(companyId, {
        currencyCode: input.company.currencyCode,
      });
    }

    logger.info({ companyId, ...result }, 'Company onboarding setup completed');
    await retireWelcomeTourNotification(companyId);
    return { ...result, isOnboarded: true };
  }

  async markComplete(companyId: string) {
    const status = await this.getStatus(companyId);
    if (!status.readyToComplete && !status.isOnboarded) {
      throw new Error('Baseline configuration is incomplete');
    }
    await prisma.company.update({
      where: { id: companyId },
      data: { isOnboarded: true, onboardedAt: new Date() },
    });
    await retireWelcomeTourNotification(companyId);
    return { isOnboarded: true };
  }

  /** Sync flag from checklist (e.g. after manual setup) */
  async syncOnboardedFlag(companyId: string) {
    const status = await this.getStatus(companyId);
    if (status.readyToComplete) {
      await prisma.company.update({
        where: { id: companyId },
        data: { isOnboarded: true, onboardedAt: new Date() },
      });
      await retireWelcomeTourNotification(companyId);
    }
    return status;
  }
}

export const companyOnboardingService = new CompanyOnboardingService();
