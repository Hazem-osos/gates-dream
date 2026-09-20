import prisma from '../../shared/database/prisma';

jest.mock('../../shared/database/prisma', () => ({
  __esModule: true,
  default: { item: { findFirst: jest.fn() } },
}));

jest.mock('../../modules/automation/events/automation-event-bus.service', () => ({
  __esModule: true,
  emitDomainEvent: jest.fn().mockResolvedValue(undefined),
}));

import { stockMovementService } from '../../modules/inventory/services/stock-movement.service';
import { emitDomainEvent } from '../../modules/automation/events/automation-event-bus.service';

const findFirst = prisma.item.findFirst as jest.Mock;
const emit = emitDomainEvent as jest.Mock;

// Accesses the private helper directly — this is a fire-and-forget side
// effect appended to postMovementInTx and isn't itself part of the public
// contract, so unit-testing it in isolation (rather than through a full
// Prisma transaction) is the safest way to verify its logic without
// touching the hot, universal stock-posting transaction path.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const svc = stockMovementService as any;

const baseInput = {
  companyId: 'company-a',
  warehouseId: 'wh-1',
  itemId: 'item-1',
  quantityDelta: -5,
  movementType: 'ISSUE',
  documentDate: new Date('2026-09-20T00:00:00.000Z'),
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('StockMovementService — inventory.stock.belowMinimum emission', () => {
  it('emits with the correct shortageQuantity when quantity falls below lowerLimit', async () => {
    findFirst.mockResolvedValue({ lowerLimit: { toNumber: () => 10 } });

    await svc.maybeEmitStockBelowMinimum(baseInput, 4);

    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: 'company-a',
        eventType: 'inventory.stock.belowMinimum',
        data: expect.objectContaining({
          itemId: 'item-1',
          warehouseId: 'wh-1',
          quantityOnHand: 4,
          minimumQuantity: 10,
          shortageQuantity: 6,
        }),
      })
    );
  });

  it('does not emit when the item has no configured lowerLimit', async () => {
    findFirst.mockResolvedValue({ lowerLimit: null });
    await svc.maybeEmitStockBelowMinimum(baseInput, 4);
    expect(emit).not.toHaveBeenCalled();
  });

  it('does not emit when quantity on hand is still at/above the minimum', async () => {
    findFirst.mockResolvedValue({ lowerLimit: { toNumber: () => 10 } });
    await svc.maybeEmitStockBelowMinimum(baseInput, 10);
    expect(emit).not.toHaveBeenCalled();
  });

  it('never throws even if the lookup itself fails', async () => {
    findFirst.mockRejectedValue(new Error('db down'));
    await expect(svc.maybeEmitStockBelowMinimum(baseInput, 4)).resolves.toBeUndefined();
    expect(emit).not.toHaveBeenCalled();
  });
});
