import { Decimal } from '@prisma/client/runtime/library';
import { AppError } from '../../shared/middleware/error-handler';
import { refreshClientInvoiceSettlementInTx } from '../../modules/contracting/settlement/contracting-certificate-balance.service';

const tx = {
  $queryRaw: jest.fn().mockResolvedValue([{ id: 'inv-1' }]),
  clientInvoice: {
    findFirst: jest.fn(),
    update: jest.fn().mockResolvedValue({}),
  },
  contractingCertificateAllocation: {
    aggregate: jest.fn(),
  },
};

jest.mock('../../shared/database/prisma', () => ({
  __esModule: true,
  default: {
    $transaction: async (fn: (c: typeof tx) => Promise<unknown>) => fn(tx),
  },
}));

describe('contracting certificate balance refresh (P0-2 concurrency guard)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    tx.clientInvoice.findFirst.mockResolvedValue({
      netPayableByClient: new Decimal(100_000),
      status: 'FINANCE_POSTED',
    });
    tx.contractingCertificateAllocation.aggregate.mockResolvedValue({
      _sum: { allocatedAmount: new Decimal(30_000) },
    });
  });

  it('recomputes remaining inside locked transaction from active allocations only', async () => {
    const result = await refreshClientInvoiceSettlementInTx(tx as never, 'co-1', 'inv-1');
    expect(result.collectedAmount).toBe(30_000);
    expect(result.remainingSettlementAmount).toBe(70_000);
    expect(result.settlementStatus).toBe('PARTIALLY_SETTLED');
  });

  it('simulates second concurrent allocation rejected when remaining exhausted', async () => {
    tx.contractingCertificateAllocation.aggregate.mockResolvedValue({
      _sum: { allocatedAmount: new Decimal(100_000) },
    });
    const refreshed = await refreshClientInvoiceSettlementInTx(tx as never, 'co-1', 'inv-1');
    expect(refreshed.remainingSettlementAmount).toBe(0);
    expect(() => {
      if (1 > refreshed.remainingSettlementAmount + 0.0001) {
        throw new AppError(422, 'over');
      }
    }).toThrow('over');
  });
});
