const queryRaw = jest.fn().mockResolvedValue([]);

jest.mock('../../shared/database/prisma', () => ({
  __esModule: true,
  default: {
    costCenter: {
      findMany: jest.fn().mockResolvedValue([
        { id: 'parent', parentId: null },
        { id: 'child', parentId: 'parent' },
        { id: 'other', parentId: null },
      ]),
    },
    account: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    $queryRaw: queryRaw,
  },
}));

jest.mock('../../modules/platform/services/fiscal-year.service', () => ({
  fiscalYearService: { assertOpenForDate: jest.fn() },
}));

import { financialReportService } from '../../modules/accounting/services/financial-report.service';

function sqlValues(value: unknown, out: unknown[] = []): unknown[] {
  if (!value || typeof value !== 'object') return out;
  const sql = value as { values?: unknown[] };
  if (!Array.isArray(sql.values)) return out;
  for (const item of sql.values) {
    if (item && typeof item === 'object' && 'values' in (item as object)) sqlValues(item, out);
    else out.push(item);
  }
  return out;
}

describe('trial balance cost center subtree', () => {
  it('includes the selected center and its children in the journal filter', async () => {
    await financialReportService.getTrialBalance({
      companyId: 'co-1',
      costCenterId: 'parent',
      startDate: new Date('2026-01-01T00:00:00.000Z'),
      endDate: new Date('2026-09-24T23:59:59.000Z'),
    });

    const values = queryRaw.mock.calls.flatMap((call) => sqlValues(call[0]));
    expect(values).toEqual(expect.arrayContaining(['parent', 'child']));
    expect(values).not.toContain('other');
  });
});
