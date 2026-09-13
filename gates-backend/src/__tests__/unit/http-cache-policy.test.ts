import {
  AUTH_CACHE_CONTROL,
  MASTER_DATA_CACHE_CONTROL,
  TRANSACTIONAL_CACHE_CONTROL,
  cacheControlForPath,
  isMasterOrReportPath,
} from '../../shared/http/http-cache-policy';

describe('http-cache-policy', () => {
  it('classifies master-data and report paths', () => {
    expect(isMasterOrReportPath('/api/v1/accounting/accounts/hierarchy')).toBe(true);
    expect(isMasterOrReportPath('/api/v1/accounting/accounts/tree')).toBe(true);
    expect(isMasterOrReportPath('/api/v1/accounting/chart-of-accounts')).toBe(true);
    expect(isMasterOrReportPath('/api/v1/company/branches')).toBe(true);
    expect(isMasterOrReportPath('/api/v1/settings/branches')).toBe(true);
    expect(isMasterOrReportPath('/api/v1/permissions')).toBe(true);
    expect(isMasterOrReportPath('/api/v1/rbac/permissions')).toBe(true);
    expect(isMasterOrReportPath('/api/v1/inventory/reports/item-movement-reports')).toBe(true);
    expect(isMasterOrReportPath('/api/v1/invoices')).toBe(false);
  });

  it('assigns Cache-Control by path', () => {
    expect(cacheControlForPath('/api/v1/accounting/accounts')).toBe(MASTER_DATA_CACHE_CONTROL);
    expect(cacheControlForPath('/api/v1/invoices')).toBe(TRANSACTIONAL_CACHE_CONTROL);
    expect(cacheControlForPath('/api/v1/accounting/journal-entries')).toBe(
      TRANSACTIONAL_CACHE_CONTROL
    );
    expect(cacheControlForPath('/api/v1/auth/login')).toBe(AUTH_CACHE_CONTROL);
    expect(cacheControlForPath('/health')).toBeNull();
  });
});
