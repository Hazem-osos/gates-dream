import {
  tenantProvisioningService,
  type TenantProvisionResult,
} from './tenant-provisioning.service';
import type { CoaIndustryKey } from '../data/coa-template.data';

export type SeedDefaultCoaResult = TenantProvisionResult;

export type SeedCoaOptions = {
  force?: boolean;
  industry?: CoaIndustryKey | string;
};

export class CoaSeederService {
  /**
   * Idempotent Egyptian standard COA + GL system mappings + default safe/warehouse.
   */
  seedDefaults(companyId: string, options?: SeedCoaOptions): Promise<SeedDefaultCoaResult> {
    return tenantProvisioningService.provisionStandardTenant(companyId, options);
  }
}

export const coaSeederService = new CoaSeederService();

/** @deprecated Use coaSeederService — kept for route compatibility */
export class AccountSeedService {
  seedDefaultCoa(companyId: string, options?: SeedCoaOptions): Promise<SeedDefaultCoaResult> {
    return coaSeederService.seedDefaults(companyId, options);
  }
}

export const accountSeedService = new AccountSeedService();
