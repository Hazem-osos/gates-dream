const reuse = jest.fn().mockResolvedValue({ id: 'je-1' });
const createAndPost = jest.fn();
const journalDelete = jest.fn();
const lineDelete = jest.fn();

const existing = {
  id: 'je-1',
  isPosted: false,
  postingStatus: 'UnPost',
  isCancelled: false,
  lines: [],
};

const tx = {
  journalEntry: {
    findFirst: jest.fn().mockImplementation(async (args: { where?: { reversalOfJournalEntryId?: string } }) => {
      if (args.where?.reversalOfJournalEntryId) return null;
      return existing;
    }),
    delete: journalDelete,
  },
  journalEntryLine: { deleteMany: lineDelete },
};

jest.mock('../../shared/database/prisma', () => ({
  __esModule: true,
  default: { companySettings: { findUnique: jest.fn() } },
}));

jest.mock('../../modules/accounting/services/journal-posting.service', () => ({
  journalPostingService: {
    reuseSourceJournalInTx: reuse,
    createAndPostInTx: createAndPost,
    buildActiveSourceKey: () => 'co-1|CP|15|',
  },
}));

jest.mock('../../modules/accounting/services/gl-account-resolver.service', () => ({
  glAccountResolver: {
    enforceCostCenters: jest.fn(async (_tx: unknown, _companyId: string, lines: unknown) => lines),
  },
}));

jest.mock('../../modules/platform/services/document-sequence.service', () => ({
  documentSequenceService: { nextGlNumberInTx: jest.fn() },
}));

jest.mock('../../modules/platform/services/fiscal-year.service', () => ({
  fiscalYearService: { assertOpenForDate: jest.fn() },
}));

jest.mock('../../modules/platform/services/company-setting.service', () => ({
  companySettingService: { getFlag: jest.fn() },
}));

import { autoGlPostingService } from '../../modules/accounting/services/auto-gl-posting.service';

describe('auto-gl commit reuses the source journal', () => {
  it('does not delete the unposted journal or book a second entry', async () => {
    const result = await autoGlPostingService.commitInTx(
      tx as never,
      { companyId: 'co-1', userId: 'user-1', fiscalYearId: 'fy-1' },
      {
        sourceType: 'CP',
        sourceId: 'cash-1',
        sourceNumber: '15',
        date: new Date('2026-09-01T00:00:00.000Z'),
        description: 'سند صرف',
        currencyCode: 'EGP',
        exchangeRate: 1,
        fiscalYearId: 'fy-1',
        lines: [
          { accountId: 'exp', debit: 100, credit: 0, lineOrder: 1 },
          { accountId: 'cash', debit: 0, credit: 100, lineOrder: 2 },
        ],
      }
    );

    expect(result).toEqual({ id: 'je-1' });
    expect(reuse).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ companyId: 'co-1' }),
      'je-1',
      expect.objectContaining({ sourceNumber: '15' })
    );
    expect(journalDelete).not.toHaveBeenCalled();
    expect(lineDelete).not.toHaveBeenCalled();
    expect(createAndPost).not.toHaveBeenCalled();
  });
});
