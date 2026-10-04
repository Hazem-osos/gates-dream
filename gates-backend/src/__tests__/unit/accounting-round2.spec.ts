const closeFiscalYear = jest.fn();
const periodUpdate = jest.fn().mockResolvedValue({ id: 'p1', isClosed: true });
const journalLineCount = jest.fn().mockResolvedValue(2);
const accountUpdate = jest.fn();

jest.mock('../../shared/database/prisma', () => ({
  __esModule: true,
  default: {
    fiscalYear: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'fy-period',
        companyId: 'co-1',
        legacyYearId: '00001',
        status: 'Open',
        arabicName: '2026',
        startDate: new Date('2026-01-01T00:00:00.000Z'),
        endDate: new Date('2026-12-31T00:00:00.000Z'),
      }),
      update: jest.fn().mockImplementation(async ({ where, data }: { where: { id: string }; data: object }) => ({
        id: where.id,
        ...data,
      })),
    },
    period: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'p1',
        companyId: 'co-1',
        code: '00001',
        name: '2026',
        startDate: new Date('2026-01-01T00:00:00.000Z'),
        endDate: new Date('2026-12-31T00:00:00.000Z'),
        isClosed: false,
      }),
      update: periodUpdate,
    },
    account: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'acc-1',
        companyId: 'co-1',
        code: '1101',
        arabicName: 'صندوق',
        accountKind: 'POSTING',
        parentId: null,
      }),
      update: accountUpdate,
    },
    journalEntryLine: { count: journalLineCount },
    costCenter: { count: jest.fn().mockResolvedValue(0) },
  },
}));

jest.mock('../../modules/operations/services/year-end-closing.service', () => ({
  yearEndClosingService: { closeFiscalYear, reopenFiscalYear: jest.fn() },
}));

jest.mock('../../shared/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

import { periodService } from '../../modules/accounting/services/period.service';
import { accountService } from '../../modules/accounting/services/account.service';
import { buildPaymentCollectLines } from '../../modules/accounting/utils/commercial-paper-journals';
import { collectSubtreeIds } from '../../modules/accounting/utils/daily-journal-filters';
import { lineBaseAmount } from '../../modules/treasury/types/vouchers.dto';

describe('accounting round 2', () => {
  it('closes the fiscal year and keeps the period closed', async () => {
    closeFiscalYear.mockResolvedValue({
      fiscalYearId: 'fy-period',
      closingJournalEntryId: 'je-close',
      netProfit: 100,
      retainedEarningsTransfer: 100,
      closedAt: new Date('2026-12-31T00:00:00.000Z'),
    });
    const result = await periodService.closePeriod(
      'co-1',
      'p1',
      { companyId: 'co-1', userId: 'u1', fiscalYearId: 'fy-1' } as never
    );
    expect(closeFiscalYear).toHaveBeenCalledWith(
      expect.objectContaining({ companyId: 'co-1', fiscalYearId: 'fy-period' }),
      'fy-period'
    );
    expect(periodUpdate).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { isClosed: true },
    });
    expect(result.closingJournalEntryId).toBe('je-close');
  });

  it('books a payment-paper partial collection as debit notes and credit bank', () => {
    const lines = buildPaymentCollectLines({
      notesAccountId: 'notes',
      partyAccountId: 'supplier',
      bankAccountId: 'bank',
      amount: 25,
    });
    expect(lines.map((line) => [line.accountId, line.debit, line.credit])).toEqual([
      ['notes', 25, 0],
      ['bank', 0, 25],
    ]);
  });

  it('includes child cost centers when a parent is selected', () => {
    const ids = collectSubtreeIds('parent', [
      { id: 'parent', parentId: null },
      { id: 'child', parentId: 'parent' },
      { id: 'leaf', parentId: 'child' },
      { id: 'other', parentId: null },
    ]);
    expect(ids).toEqual(['parent', 'child', 'leaf']);
  });

  it('rounds a foreign-currency cash leg to 4 decimal places', () => {
    expect(lineBaseAmount({ amount: 10.33333, exchangeRate: 3.7 })).toBe(38.2333);
  });

  it('refuses to turn a posting account with movements into a group account', async () => {
    await expect(
      accountService.updateAccount('co-1', 'acc-1', { accountKind: 'HEADER' })
    ).rejects.toThrow(/حركات/);
    expect(accountUpdate).not.toHaveBeenCalled();
  });
});
