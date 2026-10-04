const journalEntryFindMany = jest.fn();
const journalEntryUpdate = jest.fn();

jest.mock('../../shared/database/prisma', () => ({
  __esModule: true,
  default: {
    journalEntry: {
      findMany: journalEntryFindMany,
      update: journalEntryUpdate,
    },
    invoice: { findMany: jest.fn(), update: jest.fn() },
    treasuryReceipt: { findMany: jest.fn(), update: jest.fn() },
    treasuryPayment: { findMany: jest.fn(), update: jest.fn() },
  },
}));

import { renumberOperationsService } from '../../modules/database-tools/services/renumber-operations.service';

const CO_A = '11111111-1111-4111-8111-111111111111';

beforeEach(() => {
  jest.clearAllMocks();
  journalEntryUpdate.mockResolvedValue({});
});

describe('RenumberOperationsService', () => {
  it('renumbers journal entries by voucherNumber only', async () => {
    journalEntryFindMany.mockResolvedValue([
      { id: 'je-1', date: new Date('2026-01-01') },
      { id: 'je-2', date: new Date('2026-01-02') },
    ]);

    const result = await renumberOperationsService.renumberOperations({
      companyId: CO_A,
      operationType: 'journal-entry',
      startNumber: 10,
    });

    expect(result.renumbered).toBe(2);
    expect(journalEntryUpdate).toHaveBeenCalledTimes(2);
    expect(journalEntryUpdate).toHaveBeenNthCalledWith(1, {
      where: { id: 'je-1' },
      data: { voucherNumber: '000010' },
    });
    expect(journalEntryUpdate).toHaveBeenNthCalledWith(2, {
      where: { id: 'je-2' },
      data: { voucherNumber: '000011' },
    });
    for (const call of journalEntryUpdate.mock.calls) {
      expect(Object.keys(call[0].data)).toEqual(['voucherNumber']);
    }
  });
});
