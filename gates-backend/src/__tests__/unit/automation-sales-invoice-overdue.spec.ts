import prisma from '../../shared/database/prisma';

jest.mock('../../shared/database/prisma', () => ({
  __esModule: true,
  default: { invoice: { findMany: jest.fn() } },
}));

jest.mock('../../modules/automation/redis/job-idempotency', () => ({
  __esModule: true,
  claimIdempotencyKey: jest.fn().mockResolvedValue(true),
  salesInvoiceOverdueIdempotencyKey: (invoiceId: string, dateKey: string) => `k:${invoiceId}:${dateKey}`,
}));

jest.mock('../../modules/automation/events/automation-event-bus.service', () => ({
  __esModule: true,
  emitDomainEvent: jest.fn().mockResolvedValue(undefined),
}));

import { processSalesInvoiceOverdueScanJob } from '../../modules/automation/processors/sales-invoice-overdue.processor';
import { emitDomainEvent } from '../../modules/automation/events/automation-event-bus.service';
import { claimIdempotencyKey } from '../../modules/automation/redis/job-idempotency';

const findMany = prisma.invoice.findMany as jest.Mock;
const emit = emitDomainEvent as jest.Mock;
const claim = claimIdempotencyKey as jest.Mock;

function fakeJob(asOfDate?: string) {
  return { id: 'job-1', data: { asOfDate } } as never;
}

beforeEach(() => {
  jest.clearAllMocks();
  claim.mockResolvedValue(true);
});

describe('processSalesInvoiceOverdueScanJob', () => {
  it('emits sales.invoice.overdue for a POSTED, unpaid invoice past its dueDate', async () => {
    findMany.mockResolvedValue([
      {
        id: 'inv-1',
        companyId: 'company-a',
        invoiceNumber: 'INV-001',
        customerId: 'cust-1',
        dueDate: new Date('2026-09-10T00:00:00.000Z'),
        date: new Date('2026-09-01T00:00:00.000Z'),
        remainingAmount: { toNumber: () => 500 },
      },
    ]);

    const result = await processSalesInvoiceOverdueScanJob(fakeJob('2026-09-20'));

    expect(result).toEqual({ scanned: 1, emitted: 1 });
    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: 'company-a',
        eventType: 'sales.invoice.overdue',
        data: expect.objectContaining({ invoiceId: 'inv-1', daysOverdue: 10, remainingAmount: 500 }),
      })
    );
  });

  it('does not emit for an invoice due today or in the future', async () => {
    findMany.mockResolvedValue([
      {
        id: 'inv-2',
        companyId: 'company-a',
        invoiceNumber: 'INV-002',
        customerId: 'cust-1',
        dueDate: new Date('2026-09-20T00:00:00.000Z'),
        date: new Date('2026-09-15T00:00:00.000Z'),
        remainingAmount: { toNumber: () => 500 },
      },
    ]);

    const result = await processSalesInvoiceOverdueScanJob(fakeJob('2026-09-20'));
    expect(result.emitted).toBe(0);
    expect(emit).not.toHaveBeenCalled();
  });

  it('skips an invoice whose idempotency key was already claimed today', async () => {
    findMany.mockResolvedValue([
      {
        id: 'inv-3',
        companyId: 'company-a',
        invoiceNumber: 'INV-003',
        customerId: 'cust-1',
        dueDate: new Date('2026-09-01T00:00:00.000Z'),
        date: new Date('2026-08-25T00:00:00.000Z'),
        remainingAmount: { toNumber: () => 100 },
      },
    ]);
    claim.mockResolvedValue(false);

    const result = await processSalesInvoiceOverdueScanJob(fakeJob('2026-09-20'));
    expect(result.emitted).toBe(0);
    expect(emit).not.toHaveBeenCalled();
  });

  it('only queries POSTED, non-PAID SALE invoices', async () => {
    findMany.mockResolvedValue([]);
    await processSalesInvoiceOverdueScanJob(fakeJob('2026-09-20'));
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          invoiceKind: 'SALE',
          workflowStatus: 'POSTED',
          paymentStatus: { not: 'PAID' },
        }),
      })
    );
  });
});
