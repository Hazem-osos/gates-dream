import { describe, expect, it } from 'vitest';
import {
  CONTRACTING_REPORT_CATALOG,
  CONTRACTING_REPORT_GROUPS,
} from '../../modules/contracting/reports/contracting-reports-catalog';

describe('contracting reports catalog', () => {
  it('has unique report keys and valid groups', () => {
    const keys = CONTRACTING_REPORT_CATALOG.map((r) => r.key);
    expect(new Set(keys).size).toBe(keys.length);

    for (const report of CONTRACTING_REPORT_CATALOG) {
      expect(CONTRACTING_REPORT_GROUPS[report.groupId]).toBeDefined();
      expect(report.nameAr.length).toBeGreaterThan(2);
    }
  });

  it('includes Priority A management and financial reports', () => {
    const keys = new Set(CONTRACTING_REPORT_CATALOG.map((r) => r.key));
    for (const required of [
      'management-dashboard',
      'project-financial-position',
      'project-profitability',
      'tender-estimate-vs-actual',
      'margin-erosion',
    ]) {
      expect(keys.has(required)).toBe(true);
    }
  });
});
