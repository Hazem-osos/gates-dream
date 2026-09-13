import prisma from '../../../shared/database/prisma';
import {
  invalidateTenantCache,
  tenantCacheKeys,
} from '../../../shared/cache/tenant-metadata-cache';
import { traceAuditService } from '../../platform/services/trace-audit.service';
import {
  AccountingSettingsService,
  type AccountingSettingsDb,
} from './accounting-settings.service';

export const accountingSettingsService = new AccountingSettingsService({
  db: prisma as unknown as AccountingSettingsDb,
  recordTrace: (params) => traceAuditService.record(params),
  onUpdated: async (companyId) => {
    await invalidateTenantCache(tenantCacheKeys.companySettings(companyId));
    await invalidateTenantCache(tenantCacheKeys.settings(companyId));
    await invalidateTenantCache(tenantCacheKeys.taxRates(companyId));
  },
});
