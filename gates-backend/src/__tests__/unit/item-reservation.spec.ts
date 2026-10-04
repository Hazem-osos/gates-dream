const lockWarehouseBalanceInTx = jest.fn().mockResolvedValue(undefined);
const adjustStockInTx = jest.fn().mockResolvedValue({
  quantityOnHand: 10,
  reservedQuantity: 4,
  availableQuantity: 6,
});
const getWarehouseBalance = jest.fn();

const tx = {
  $queryRaw: jest.fn(),
  itemReservation: {
    create: jest.fn().mockResolvedValue({ id: 'res-1' }),
    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    findFirst: jest.fn(),
  },
};

jest.mock('../../shared/database/prisma', () => ({
  __esModule: true,
  default: {
    $transaction: (fn: (client: typeof tx) => Promise<unknown>) => fn(tx),
    item: { findFirst: jest.fn() },
    warehouse: { findFirst: jest.fn() },
    itemReservation: {
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
    },
  },
}));

jest.mock('../../modules/inventory/services/adjust-stock-in-tx', () => ({
  lockWarehouseBalanceInTx,
  adjustStockInTx,
  getWarehouseBalance,
}));

import prisma from '../../shared/database/prisma';
import { AppError } from '../../shared/middleware/error-handler';
import {
  assertCanReleaseReserved,
  assertCanReserve,
  itemReservationService,
  reservationStockDelta,
} from '../../modules/inventory/services/item-reservation.service';

const itemFind = prisma.item.findFirst as jest.Mock;
const warehouseFind = prisma.warehouse.findFirst as jest.Mock;

const detail = {
  id: 'res-1',
  warehouseId: 'wh-1',
  itemId: 'item-1',
  quantity: '4.0000',
  fulfilledQuantity: '0.0000',
  reason: 'عميل',
  status: 'ACTIVE',
  releasedAt: null,
  createdAt: new Date('2026-09-28T09:00:00.000Z'),
  updatedAt: new Date('2026-09-28T09:00:00.000Z'),
  warehouse: { id: 'wh-1', code: 'M1', arabicName: 'الرئيسي' },
  item: { id: 'item-1', serial: '1', arabicName: 'سكر' },
};

beforeEach(() => {
  jest.clearAllMocks();
  warehouseFind.mockResolvedValue({
    id: 'wh-1',
    isActive: true,
    arabicName: 'الرئيسي',
    code: 'M1',
    warehouseKind: 'POSTING',
  });
  itemFind.mockResolvedValue({ id: 'item-1', inactiveItem: false });
  getWarehouseBalance.mockResolvedValue({
    quantityOnHand: 10,
    reservedQuantity: 0,
    availableQuantity: 10,
  });
  tx.itemReservation.findFirst.mockResolvedValue(detail);
  tx.itemReservation.updateMany.mockResolvedValue({ count: 1 });
});

describe('item reservation quantity rules', () => {
  it('rejects a hold larger than the free quantity', () => {
    expect(() => assertCanReserve(3, 4)).toThrow('الكمية المتاحة لا تكفي للحجز');
    expect(() => assertCanReserve(4, 4)).not.toThrow();
  });

  it('rejects releasing more than the warehouse currently holds as reserved', () => {
    expect(() => assertCanReleaseReserved(2, 4)).toThrow('الكمية المحجوزة في المخزن أقل من هذا الحجز');
  });

  it('computes only the change when a hold is edited', () => {
    expect(reservationStockDelta(4, 6)).toBe(2);
    expect(reservationStockDelta(6, 4)).toBe(-2);
    expect(reservationStockDelta(4, 4)).toBe(0);
  });
});

describe('item reservation stock effect', () => {
  it('adds the reserved quantity without changing on-hand stock', async () => {
    const row = await itemReservationService.create('co-1', {
      warehouseId: 'wh-1',
      itemId: 'item-1',
      quantity: 4,
      reason: 'عميل',
    });

    expect(adjustStockInTx).toHaveBeenCalledWith(tx, {
      companyId: 'co-1',
      itemId: 'item-1',
      warehouseId: 'wh-1',
      deltaReserved: 4,
    });
    expect(adjustStockInTx.mock.calls[0][1]).not.toHaveProperty('deltaQty');
    expect(row.quantity).toBe(4);
    expect(row.itemName).toBe('سكر');
  });

  it('does not reserve when the free quantity is short', async () => {
    getWarehouseBalance.mockResolvedValue({
      quantityOnHand: 3,
      reservedQuantity: 0,
      availableQuantity: 3,
    });

    await expect(
      itemReservationService.create('co-1', {
        warehouseId: 'wh-1',
        itemId: 'item-1',
        quantity: 4,
        reason: 'عميل',
      })
    ).rejects.toBeInstanceOf(AppError);
    expect(adjustStockInTx).not.toHaveBeenCalled();
    expect(tx.itemReservation.create).not.toHaveBeenCalled();
  });

  it('returns the held quantity when the reservation is released, and ignores a second release', async () => {
    tx.$queryRaw.mockResolvedValueOnce([
      {
        id: 'res-1',
        warehouseId: 'wh-1',
        itemId: 'item-1',
        quantity: '4.0000',
        fulfilledQuantity: '0.0000',
        status: 'ACTIVE',
      },
    ]);
    getWarehouseBalance.mockResolvedValue({
      quantityOnHand: 10,
      reservedQuantity: 4,
      availableQuantity: 6,
    });

    await itemReservationService.release('co-1', 'res-1');
    expect(adjustStockInTx).toHaveBeenCalledWith(tx, {
      companyId: 'co-1',
      itemId: 'item-1',
      warehouseId: 'wh-1',
      deltaReserved: -4,
    });

    adjustStockInTx.mockClear();
    tx.$queryRaw.mockResolvedValueOnce([
      {
        id: 'res-1',
        warehouseId: 'wh-1',
        itemId: 'item-1',
        quantity: '4.0000',
        fulfilledQuantity: '0.0000',
        status: 'RELEASED',
      },
    ]);
    await expect(itemReservationService.release('co-1', 'res-1')).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(adjustStockInTx).not.toHaveBeenCalled();
  });
});
