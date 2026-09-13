import prisma from '../../../shared/database/prisma';
import { demoCatalogService } from '../../inventory/services/demo-catalog.service';

export type LaunchChecklist = {
  createdFirstInvoice: boolean;
  addedFirstCustomer: boolean;
  createdFirstItem: boolean;
  recordedFirstReceipt: boolean;
  dismissed?: boolean;
  companySetupComplete?: boolean;
};

const DEFAULT: LaunchChecklist = {
  createdFirstInvoice: false,
  addedFirstCustomer: false,
  createdFirstItem: false,
  recordedFirstReceipt: false,
  dismissed: false,
  companySetupComplete: false,
};

export class OnboardingStateService {
  async getState(companyId: string) {
    const company = await prisma.company.findFirst({
      where: { id: companyId, deletedAt: null },
      select: {
        isOnboarded: true,
        onboardedAt: true,
        onboardingStep: true,
        hasCompletedTour: true,
        launchChecklist: true,
      },
    });
    if (!company) throw new Error('Company not found');

    const checklist = await this.syncLaunchChecklist(companyId, company.launchChecklist);

    return {
      isOnboarded: company.isOnboarded,
      onboardedAt: company.onboardedAt?.toISOString() ?? null,
      onboardingStep: company.onboardingStep,
      hasCompletedTour: company.hasCompletedTour,
      hasCreatedFirstInvoice: checklist.createdFirstInvoice,
      launchChecklist: checklist,
      needsOnboarding: !company.isOnboarded,
    };
  }

  async syncLaunchChecklist(companyId: string, raw: unknown): Promise<LaunchChecklist> {
    const prev = { ...DEFAULT, ...(typeof raw === 'object' && raw ? (raw as LaunchChecklist) : {}) };

    const [itemCount, customerCount, saleInvoiceCount, receiptCount] = await Promise.all([
      prisma.item.count({ where: { companyId, isActive: true } }),
      prisma.customer.count({ where: { companyId, isActive: true } }),
      prisma.invoice.count({
        where: { companyId, invoiceKind: 'SALE', isCancelled: false },
      }),
      prisma.treasuryReceipt.count({ where: { companyId } }).catch(() => 0),
    ]);

    const merged: LaunchChecklist = {
      ...prev,
      createdFirstItem: prev.createdFirstItem || itemCount > 0,
      addedFirstCustomer: prev.addedFirstCustomer || customerCount > 0,
      createdFirstInvoice: prev.createdFirstInvoice || saleInvoiceCount > 0,
      recordedFirstReceipt: prev.recordedFirstReceipt || receiptCount > 0,
      companySetupComplete: prev.companySetupComplete ?? true,
    };

    await prisma.company.update({
      where: { id: companyId },
      data: { launchChecklist: merged },
    });

    return merged;
  }

  async updateStep(companyId: string, step: number) {
    await prisma.company.update({
      where: { id: companyId },
      data: { onboardingStep: step },
    });
  }

  async completeTour(companyId: string) {
    await prisma.company.update({
      where: { id: companyId },
      data: { hasCompletedTour: true },
    });
    return { hasCompletedTour: true };
  }

  async patchLaunchChecklist(companyId: string, patch: Partial<LaunchChecklist>) {
    const company = await prisma.company.findFirst({
      where: { id: companyId },
      select: { launchChecklist: true },
    });
    const prev = { ...DEFAULT, ...(company?.launchChecklist as LaunchChecklist) };
    const merged = { ...prev, ...patch };
    await prisma.company.update({
      where: { id: companyId },
      data: { launchChecklist: merged },
    });
    return merged;
  }

  async seedDemoData(companyId: string) {
    return demoCatalogService.ensureDemoCatalog(companyId);
  }
}

export const onboardingStateService = new OnboardingStateService();
