const reverseJournalEntryInTx = jest.fn().mockResolvedValue(undefined);
const unpostSourceJournalInTx = jest.fn().mockResolvedValue({ id: 'je-1' });
const applyPartnerCardBalancesFromLinesInTx = jest.fn().mockResolvedValue(undefined);
const applyPostedJournalBalancesInTx = jest.fn().mockResolvedValue(undefined);
const customerUpdate = jest.fn().mockResolvedValue({});
const receiptUpdate = jest.fn().mockImplementation(async ({ data }) => ({
  id: 'paper-1',
  journalEntryId: data.journalEntryId ?? null,
  isPosted: data.isPosted,
  customerId: 'cust-1',
  amount: 1000.1234,
  currencyCode: 'EGP',
  paperCase: 'ISSUED',
}));

const tx = {
  journalEntry: {
    findMany: jest.fn().mockResolvedValue([
      { id: 'je-1', reversalOfJournalEntryId: null, isCancelled: false },
    ]),
    findFirst: jest.fn().mockResolvedValue({
      date: new Date('2026-01-01'),
      currencyCode: 'EGP',
    }),
  },
  journalEntryLine: {
    findMany: jest.fn().mockResolvedValue([
      {
        accountId: 'ar-1',
        debit: 0,
        credit: 1000,
        debitBase: 0,
        creditBase: 1000,
        partnerId: 'cust-1',
        partnerType: 'CUSTOMER',
      },
    ]),
  },
  securitiesReceipt: { update: receiptUpdate },
  securitiesPayment: { update: jest.fn() },
  customer: { update: customerUpdate },
  supplier: { update: jest.fn() },
  multiCollectionLine: { deleteMany: jest.fn() },
};

jest.mock('../../shared/database/prisma', () => ({
  __esModule: true,
  default: {
    $transaction: (fn: (client: typeof tx) => Promise<unknown>) => fn(tx),
    securitiesReceipt: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'paper-1',
        companyId: 'co-1',
        branchId: 'br-1',
        journalEntryId: 'je-1',
        isPosted: true,
        isCancelled: false,
        paperCase: 'ISSUED',
        customerId: 'cust-1',
        supplierId: null,
        amount: 1000.1234,
        currencyCode: 'EGP',
        receiptNumber: 'R-1',
      }),
    },
    securitiesPayment: { findFirst: jest.fn() },
    journalEntry: {
      findFirst: jest.fn().mockImplementation(async ({ where }: { where: { reversalOfJournalEntryId?: string; id?: string } }) => {
        if (where.reversalOfJournalEntryId) return null;
        if (where.id === 'je-1') return { id: 'je-1' };
        return null;
      }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    branch: { findFirst: jest.fn().mockResolvedValue({ id: 'br-1' }) },
    multiCollectionLine: { findMany: jest.fn().mockResolvedValue([]) },
  },
}));

jest.mock('../../modules/accounting/services/journal-posting.service', () => ({
  journalPostingService: {
    reverseJournalEntryInTx,
    unpostSourceJournalInTx,
    createAndPostInTx: jest.fn(),
    cascadeSourceJournalInTx: jest.fn(),
    buildActiveSourceKey: jest.fn(),
  },
}));

jest.mock('../../modules/accounting/services/ledger-balance.service', () => ({
  applyPartnerCardBalancesFromLinesInTx,
  applyPostedJournalBalancesInTx,
}));

jest.mock('../../modules/platform/services/fiscal-year.service', () => ({
  fiscalYearService: { assertOpenForDate: jest.fn().mockResolvedValue('fy-1') },
}));

jest.mock('../../modules/accounting/utils/company-fx-rate', () => ({
  resolveCompanyFxRate: jest.fn().mockResolvedValue({ exchangeRate: 1 }),
  toBaseAmount: (amount: number, rate: number) => amount * rate,
}));

import { commercialPaperPostingService } from '../../modules/accounting/services/commercial-paper-posting.service';

describe('commercial paper unpost', () => {
  it('unposts the same issue journal so the customer card follows that journal', async () => {
    const result = await commercialPaperPostingService.unpostPaper(
      { companyId: 'co-1', branchId: 'br-1', userId: 'user-1' },
      'RECEIPT',
      'paper-1'
    );

    expect(reverseJournalEntryInTx).not.toHaveBeenCalled();
    expect(unpostSourceJournalInTx).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ companyId: 'co-1', branchId: 'br-1', fiscalYearId: 'fy-1' }),
      'je-1',
      { skipCardColumns: true }
    );
    expect(applyPartnerCardBalancesFromLinesInTx).toHaveBeenCalledWith(
      tx,
      'co-1',
      expect.any(Array),
      { invert: true }
    );
    expect(customerUpdate).not.toHaveBeenCalled();
    expect(receiptUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isPosted: false }),
      })
    );
    expect(receiptUpdate.mock.calls[0][0].data.journalEntryId).toBeUndefined();
    expect(result.isPosted).toBe(false);
  });

  it('does not undo collection when the issue journal is unposted', async () => {
    const prisma = require('../../shared/database/prisma').default;
    prisma.securitiesReceipt.findFirst.mockResolvedValueOnce({
      id: 'paper-1',
      companyId: 'co-1',
      branchId: 'br-1',
      journalEntryId: 'je-1',
      isPosted: true,
      isCancelled: false,
      paperCase: 'COLLECTED',
      customerId: 'cust-1',
      supplierId: null,
      amount: 1000.1234,
      currencyCode: 'EGP',
      receiptNumber: 'R-1',
    });

    await commercialPaperPostingService.unpostPaper(
      { companyId: 'co-1', branchId: 'br-1', userId: 'user-1' },
      'RECEIPT',
      'paper-1'
    );

    expect(tx.multiCollectionLine.deleteMany).not.toHaveBeenCalled();
    expect(receiptUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isPosted: false }),
      })
    );
    expect(receiptUpdate.mock.calls.at(-1)?.[0].data.paperCase).toBeUndefined();
  });

  it('uncollect cancels the collect journal and returns the paper to issued', async () => {
    const prisma = require('../../shared/database/prisma').default;
    prisma.securitiesReceipt.findFirst.mockResolvedValueOnce({
      id: 'paper-1',
      companyId: 'co-1',
      branchId: 'br-1',
      journalEntryId: 'je-1',
      isPosted: true,
      isCancelled: false,
      paperCase: 'COLLECTED',
      customerId: 'cust-1',
      supplierId: null,
      amount: 1000.1234,
      currencyCode: 'EGP',
      receiptNumber: 'R-1',
    });
    tx.journalEntry.findMany.mockResolvedValueOnce([]);

    const result = await commercialPaperPostingService.uncollectPaper(
      { companyId: 'co-1', branchId: 'br-1', userId: 'user-1' },
      'RECEIPT',
      'paper-1'
    );

    expect(tx.multiCollectionLine.deleteMany).toHaveBeenCalled();
    expect(receiptUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ paperCase: 'ISSUED' }),
      })
    );
    expect(result.paperCase).toBe('ISSUED');
  });
});


