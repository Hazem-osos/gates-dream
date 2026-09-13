import {
  calendarPeriodFromDate,
  compareLedgerKey,
  sortAccountIds,
} from '../../src/modules/accounting/services/ledger-balance.service';

describe('compareLedgerKey', () => {
  it('sorts numeric ids ascending', () => {
    expect([3, 1, 2].sort(compareLedgerKey)).toEqual([1, 2, 3]);
  });

  it('sorts numeric string ids with Number subtraction', () => {
    expect(sortAccountIds(['10', '2', '1'])).toEqual(['1', '2', '10']);
  });

  it('sorts uuid account ids deterministically', () => {
    const ids = [
      'c0b1a2d3-0000-4000-8000-000000000002',
      'a0b1a2d3-0000-4000-8000-000000000001',
    ];
    expect([...ids].sort(compareLedgerKey)).toEqual([
      'a0b1a2d3-0000-4000-8000-000000000001',
      'c0b1a2d3-0000-4000-8000-000000000002',
    ]);
  });
});

describe('calendarPeriodFromDate', () => {
  it('uses UTC year and 1-based month', () => {
    expect(calendarPeriodFromDate(new Date('2026-03-15T00:00:00.000Z'))).toEqual({
      fiscalYear: 2026,
      periodMonth: 3,
    });
  });

  it('keeps December as month 12', () => {
    expect(calendarPeriodFromDate(new Date('2025-12-31T23:00:00.000Z'))).toEqual({
      fiscalYear: 2025,
      periodMonth: 12,
    });
  });
});
