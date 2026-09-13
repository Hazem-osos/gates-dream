import { createHash } from 'node:crypto';
import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import {
  isLicenseModuleCode,
  LICENSE_MODULE_CODES,
  type LicenseModuleCode,
  type SubscriptionPlanType,
  type SubscriptionStatus,
} from '../types/license-modules';
import {
  getTenantCached,
  invalidateTenantCache,
  tenantCacheKeys,
} from '../../../shared/cache/tenant-metadata-cache';

function hashLicenseKey(licenseKey: string): string {
  return createHash('sha256').update(licenseKey.trim()).digest('hex');
}

function parseModules(raw: unknown): LicenseModuleCode[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((m): m is LicenseModuleCode => typeof m === 'string' && isLicenseModuleCode(m));
}

export interface ActivateSubscriptionInput {
  companyId: string;
  planType: SubscriptionPlanType;
  status?: SubscriptionStatus;
  startDate?: Date;
  expiryDate?: Date | null;
  allowedModules: LicenseModuleCode[];
  maxBranches?: number;
  maxUsers?: number;
  maxStorageMb?: number;
  licenseKey?: string;
}

export class LicenseSubscriptionService {
  async getForCompany(companyId: string) {
    return getTenantCached(tenantCacheKeys.subscription(companyId), () =>
      prisma.tenantSubscription.findUnique({ where: { companyId } })
    );
  }

  async getCurrent(companyId: string) {
    const sub = await this.getForCompany(companyId);
    if (!sub) {
      return {
        companyId,
        planType: null,
        status: null,
        unrestricted: true,
        allowedModules: [...LICENSE_MODULE_CODES],
      };
    }
    return {
      companyId,
      planType: sub.planType,
      status: sub.status,
      startDate: sub.startDate,
      expiryDate: sub.expiryDate,
      maxBranches: sub.maxBranches,
      maxUsers: sub.maxUsers,
      maxStorageMb: sub.maxStorageMb,
      allowedModules: parseModules(sub.allowedModules),
      unrestricted: false,
    };
  }

  private isSubscriptionUsable(sub: {
    planType: string;
    status: string;
    expiryDate: Date | null;
  }): boolean {
    if (sub.status === 'SUSPENDED' || sub.status === 'EXPIRED') return false;
    if (sub.status !== 'ACTIVE' && sub.status !== 'TRIAL') return false;
    if (sub.planType === 'SUBSCRIPTION' && sub.expiryDate) {
      return sub.expiryDate.getTime() >= Date.now();
    }
    return true;
  }

  async assertModuleLicensed(companyId: string, moduleCode: LicenseModuleCode): Promise<void> {
    if (!isLicenseModuleCode(moduleCode)) {
      throw new AppError(422, 'Invalid module code');
    }

    const sub = await this.getForCompany(companyId);
    if (!sub) return;

    if (!this.isSubscriptionUsable(sub)) {
      throw new AppError(403, 'Tenant subscription is not active');
    }

    const allowed = parseModules(sub.allowedModules);
    if (!allowed.includes(moduleCode)) {
      throw new AppError(403, `Module ${moduleCode} is not licensed for this tenant`);
    }
  }

  async activate(input: ActivateSubscriptionInput) {
    for (const m of input.allowedModules) {
      if (!isLicenseModuleCode(m)) {
        throw new AppError(422, `Invalid module in allowedModules: ${m}`);
      }
    }

    const licenseKeyHash = input.licenseKey ? hashLicenseKey(input.licenseKey) : undefined;
    const status = input.status ?? 'ACTIVE';
    const startDate = input.startDate ?? new Date();

    const data = {
      planType: input.planType,
      status,
      startDate,
      expiryDate: input.expiryDate ?? null,
      maxBranches: input.maxBranches ?? 1,
      maxUsers: input.maxUsers ?? 5,
      maxStorageMb: input.maxStorageMb ?? 512,
      allowedModules: input.allowedModules,
      licenseKeyHash,
    };

    return prisma.tenantSubscription.upsert({
      where: { companyId: input.companyId },
      create: { companyId: input.companyId, ...data },
      update: data,
    }).then(async (row) => {
      await invalidateTenantCache(tenantCacheKeys.subscription(input.companyId));
      return row;
    });
  }
}

export const licenseSubscriptionService = new LicenseSubscriptionService();
