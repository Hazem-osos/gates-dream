import { describe, expect, it } from 'vitest';
import { resolveReportApiPath } from './resolveReportEndpoint';

describe('HR report endpoints', () => {
  it.each([
    ['hr/employee-penalties-report', '/hr/reports/procedures/penalties'],
    ['hr/employee-rewards-report', '/hr/reports/procedures/rewards'],
    ['hr/employee-courses-report', '/hr/reports/procedures/courses'],
    ['hr/housing-allowance-report', '/hr/reports/procedures/housing-allowance'],
    ['hr/employee-loans-report', '/hr/reports/loans'],
    ['hr/end-of-service-report', '/hr/reports/end-of-service'],
  ])('%s → %s', (registryPath, api) => {
    expect(resolveReportApiPath(registryPath)).toBe(api);
  });
});
