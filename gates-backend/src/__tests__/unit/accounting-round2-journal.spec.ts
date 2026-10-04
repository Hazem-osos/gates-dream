const customerUpdate = jest.fn().mockResolvedValue({ count: 1 });
const supplierUpdate = jest.fn().mockResolvedValue({ count: 1 });

const entry = {
  id: 'je-1',
  companyId: 'co-1',
  branchId: null,
  deletedAt: null,
  isPosted: false,
  postingStatus: 'Draft',
  documentStatus: 'Open',
  isBalanced: true,
  isCancelled: false,
  sourceType: 'MANUAL',
  sourceKind: null,
  sourceId: null,
  entryType: 'MANUAL',
  date: new Date('2026-09-01T00:00:00.000Z'),
  currencyCode: 'EGP',
  exchangeRate: 1,
  lines: [
    {
      accountId: 'ar',
      debit: 100,
      credit: 0,
      debitBase: 100,
      creditBase: 0,
      exchangeRate: 1,
      partnerId: 'cust-1',
      partnerType: 'CUSTOMER',
    },
    {
      accountId: 'ap',
      debit: 0,
      credit: 40,
      debitBase: 0,
      creditBase: 40,
      exchangeRate: 1,
      partnerId: 'sup-1',
      partnerType: 'SUPPLIER',
    },
    {
      accountId: 'cash',
      debit: 0,
      credit: 60,
      debitBase: 0,
      creditBase: 60,
      exchangeRate: 1,
      partnerId: null,
      partnerType: null,
    },
  ],
};

const tx = {
  journalEntry: {
    findFirst: jest.fn().mockImplementation(async ({ where }: { where: { id?: string; reversalOfJournalEntryId?: string } }) => {
      if (where.reversalOfJournalEntryId) return null;
      if (where.id === 'je-posted') {
        return {
          id: 'je-posted',
          companyId: 'co-1',
          isPosted: true,
          postingStatus: 'Post',
          isCancelled: false,
          deletedAt: null,
          branchId: null,
          fiscalYearId: 'fy-1',
          lines: [],
        };
      }
      return entry;
    }),
    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    findFirstOrThrow: jest.fn().mockResolvedValue({ id: 'je-1', isPosted: true }),
    update: jest.fn(),
  },
  customer: { updateMany: customerUpdate },
  supplier: { updateMany: supplierUpdate },
};

jest.mock('../../shared/database/prisma', () => ({
  __esModule: true,
  default: {
    $transaction: (fn: (client: typeof tx) => Promise<unknown>) => fn(tx),
  },
}));

jest.mock('../../shared/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

jest.mock('../../modules/platform/services/company-setting.service', () => ({
  companySettingService: { getFlag: jest.fn().mockResolvedValue(true) },
}));

jest.mock('../../modules/platform/services/advanced-rights.service', () => ({
  advancedRightsService: { assertCanPostFamily: jest.fn().mockResolvedValue(undefined) },
}));

jest.mock('../../modules/accounting/services/approval-workflow.service', () => ({
  approvalWorkflowService: { assertCanPostJournal: jest.fn().mockResolvedValue(undefined) },
}));

jest.mock('../../modules/accounting/services/document-audit.service', () => ({
  documentAuditService: { record: jest.fn().mockResolvedValue(undefined) },
}));

jest.mock('../../modules/platform/services/fiscal-year.service', () => ({
  fiscalYearService: { assertOpenForDate: jest.fn().mockResolvedValue('fy-1') },
}));

jest.mock('../../modules/accounting/services/ledger-balance.service', () => ({
  applyPostedJournalBalancesInTx: jest.fn().mockResolvedValue(undefined),
}));

import { journalPostingService } from '../../modules/accounting/services/journal-posting.service';
import { applyPostedJournalBalancesInTx } from '../../modules/accounting/services/ledger-balance.service';

describe('manual journal party balances and posted cancel', () => {
  const ctx = { companyId: 'co-1', userId: 'user-1', fiscalYearId: 'fy-1', isAdmin: true };

  it('applies period and card balances when a manual journal is posted', async () => {
    await journalPostingService.postJournalEntry(ctx, 'je-1');

    expect(applyPostedJournalBalancesInTx).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        companyId: 'co-1',
        currencyCode: 'EGP',
        lines: entry.lines,
      })
    );
  });

  it('cancels a posted source journal by unposting the same entry', async () => {
    const unpost = jest
      .spyOn(journalPostingService, 'unpostSourceJournalInTx')
      .mockResolvedValue({ id: 'je-posted' } as never);

    await journalPostingService.cascadeSourceJournalInTx(tx as never, 'co-1', ['je-posted'], 'cancel', 'user-1');

    expect(unpost).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ companyId: 'co-1' }),
      'je-posted'
    );
    expect(tx.journalEntry.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isCancelled: true }),
      })
    );
    unpost.mockRestore();
  });
});
