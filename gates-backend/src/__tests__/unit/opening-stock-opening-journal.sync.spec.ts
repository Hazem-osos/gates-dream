import { syncOpeningStockIntoOpeningJournalInTx } from '../../modules/inventory/services/opening-stock-opening-journal.sync';

describe('syncOpeningStockIntoOpeningJournalInTx', () => {
  it('returns null when no company opening journal exists yet', async () => {
    const tx = {
      journalEntry: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };
    const result = await syncOpeningStockIntoOpeningJournalInTx(tx as never, 'company-1', {
      openingStockId: 'ob-1',
      glSlices: [{ accountId: 'acc-1', value: 100, description: 'x', warehouseId: 'wh-1' }],
      creditAccountId: 'adj-1',
    });
    expect(result).toBeNull();
    expect(tx.journalEntry.findFirst).toHaveBeenCalled();
  });
});
