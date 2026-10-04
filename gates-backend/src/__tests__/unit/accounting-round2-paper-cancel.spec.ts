const cascade = jest.fn().mockResolvedValue(undefined);
const customerUpdate = jest.fn().mockResolvedValue({});
const receiptUpdate = jest.fn().mockImplementation(async ({ data }) => ({ id: 'paper-1', ...data }));

const tx = {
  journalEntry: {
    findMany: jest.fn().mockResolvedValue([{ id: 'je-1', reversalOfJournalEntryId: null }]),
  },
  customer: { update: customerUpdate },
  supplier: { update: jest.fn() },
  securitiesReceipt: { update: receiptUpdate },
  securitiesPayment: { update: jest.fn() },
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
        amount: 250,
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
    },
  },
}));

jest.mock('../../modules/accounting/services/journal-posting.service', () => ({
  journalPostingService: { cascadeSourceJournalInTx: cascade, reverseJournalEntryInTx: jest.fn() },
}));

jest.mock('../../modules/platform/services/fiscal-year.service', () => ({
  fiscalYearService: { assertOpenForDate: jest.fn().mockResolvedValue('fy-1') },
}));

jest.mock('../../modules/accounting/utils/company-fx-rate', () => ({
  resolveCompanyFxRate: jest.fn().mockResolvedValue({ exchangeRate: 1 }),
  toBaseAmount: (amount: number, rate: number) => amount * rate,
  persistFxRate: jest.fn(),
  persistJournalLineFxRate: jest.fn(),
}));

import { commercialPaperPostingService } from '../../modules/accounting/services/commercial-paper-posting.service';

describe('cancel issued commercial paper', () => {
  it('cancels a posted issued paper in one transaction and reverses its journal', async () => {
    const result = await commercialPaperPostingService.cancelIssuedPaperJournals(
      { companyId: 'co-1', branchId: 'br-1', userId: 'user-1' },
      'RECEIPT',
      'paper-1'
    );

    expect(cascade).toHaveBeenCalledWith(
      tx,
      'co-1',
      ['je-1'],
      'cancel',
      'user-1'
    );
    expect(customerUpdate).toHaveBeenCalled();
    expect(receiptUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isCancelled: true, isPosted: false }),
      })
    );
    expect(result).toEqual(expect.objectContaining({ isCancelled: true, isPosted: false }));
  });
});
