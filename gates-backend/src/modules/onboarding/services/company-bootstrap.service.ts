import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';
import type { BootstrapInput } from '../schemas/onboarding.schema';
import { companyOnboardingService } from '../../company/services/company-onboarding.service';
import type { OnboardingSetupInput } from '../../company/schemas/company-onboarding.schema';
import { demoCatalogService } from '../../inventory/services/demo-catalog.service';
import { retireWelcomeTourNotification } from '../../notifications/services/onboarding-welcome-notification.service';

const VERTICAL_TO_INDUSTRY: Record<BootstrapInput['vertical'], OnboardingSetupInput['industryTemplate']> = {
  TRADING: 'TRADE',
  CONTRACTING: 'CONTRACTING',
  MANUFACTURING: 'MANUFACTURING',
  REAL_ESTATE: 'TRADE',
  SERVICES: 'SERVICES',
};

const DEFAULT_LAUNCH_CHECKLIST = {
  createdFirstInvoice: false,
  addedFirstCustomer: false,
  createdFirstItem: false,
  recordedFirstReceipt: false,
  dismissed: false,
  companySetupComplete: true,
};

export class CompanyBootstrapService {
  async bootstrap(companyId: string, input: BootstrapInput) {
    const setupBody: OnboardingSetupInput = {
      industryTemplate: VERTICAL_TO_INDUSTRY[input.vertical],
      company: {
        nameAr: input.company.tradeNameAr,
        nameEn: input.company.tradeNameEn ?? undefined,
        taxRegistrationNumber: input.company.taxRegistrationNumber ?? undefined,
        commercialRegister: input.company.commercialRegister ?? undefined,
        currencyCode: input.currencyCode,
        logoUrl: input.company.logoUrl ?? undefined,
        activityCode: input.vertical === 'REAL_ESTATE' ? '6810' : undefined,
      },
      fiscalYear: {
        name: String(new Date().getFullYear()),
        startDate: `${new Date().getFullYear()}-01-01T00:00:00.000Z`,
        endDate: `${new Date().getFullYear()}-12-31T23:59:59.000Z`,
      },
      branch: {
        arabicName: input.branch.arabicName,
        branchNumber: '01',
      },
      treasury: {
        safeArabicName: input.branch.safeName,
        safeCode: input.branch.safeCode ?? 'MAIN',
        cashGlAccountCode: '1111',
      },
      warehouse: {
        arabicName: input.branch.warehouseName,
        code: input.branch.warehouseCode ?? 'WH-01',
      },
      seedStandardCoa: true,
    };

    const result = await companyOnboardingService.runSetup(companyId, setupBody);

    const settings = await prisma.companySettings.findFirst({
      where: { companyId },
      select: { advancedSettings: true },
    });
    const prevAdvanced =
      settings?.advancedSettings && typeof settings.advancedSettings === 'object'
        ? (settings.advancedSettings as Record<string, unknown>)
        : {};

    await prisma.company.update({
      where: { id: companyId },
      data: {
        isOnboarded: true,
        onboardedAt: new Date(),
        onboardingStep: input.onboardingStep ?? 5,
        launchChecklist: {
          ...DEFAULT_LAUNCH_CHECKLIST,
          companySetupComplete: true,
        },
      },
    });

    if (settings) {
      await prisma.companySettings.update({
        where: { companyId },
        data: {
          advancedSettings: {
            ...prevAdvanced,
            businessVertical: input.vertical,
            industryTemplate: VERTICAL_TO_INDUSTRY[input.vertical],
            vatRate: 14,
            whtRate: 1,
          } as object,
        },
      });
    } else {
      await prisma.companySettings.create({
        data: {
          companyId,
          advancedSettings: {
            businessVertical: input.vertical,
            industryTemplate: VERTICAL_TO_INDUSTRY[input.vertical],
            vatRate: 14,
            whtRate: 1,
          } as object,
        },
      });
    }

    logger.info({ companyId, vertical: input.vertical }, 'Company bootstrap completed');
    await retireWelcomeTourNotification(companyId);
    return result;
  }

  async seedDemoExplore(companyId: string) {
    return demoCatalogService.ensureDemoCatalog(companyId);
  }
}

export const companyBootstrapService = new CompanyBootstrapService();
