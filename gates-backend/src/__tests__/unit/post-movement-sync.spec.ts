jest.mock('../../shared/database/prisma', () => ({
  __esModule: true,
  default: {},
}));

import { stockMovementService } from '../../modules/inventory/services/stock-movement.service';

function fakeTx(options: {
  existingQuantity?: { id: string; quantity?: { toNumber: () => number } } | null;
  warehouseFound?: boolean;
}) {
  const calls: string[] = [];
  const created: Array<Record<string, unknown>> = [];
  const tx = {
    warehouse: {
      findFirst: async (args: { where: { companyId: string } }) => {
        calls.push(`warehouse:${args.where.companyId}`);
        if (options.warehouseFound === false) return null;
        return { isActive: true, arabicName: 'المخزن' };
      },
    },
    $queryRaw: async () => {
      calls.push('lock');
      return [];
    },
    $executeRaw: async () => {
      calls.push('iwb-write');
      return 1;
    },
    inventoryMovement: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        calls.push('movement');
        created.push(data);
        return { id: 'mov-1' };
      },
      aggregate: async () => ({
        _sum: { quantityDelta: { toNumber: () => (options.existingQuantity ? 4 : 4) } },
      }),
    },
    itemQuantity: {
      findFirst: async () =>
        options.existingQuantity
          ? {
              ...options.existingQuantity,
              quantity: options.existingQuantity.quantity ?? { toNumber: () => 0 },
            }
          : null,
      findMany: async () =>
        options.existingQuantity
          ? [{ id: 'iq-existing', locationId: null, quantity: { toNumber: () => 0 } }]
          : [],
      create: async ({ data }: { data: Record<string, unknown> }) => {
        calls.push('iq-create');
        created.push(data);
        return { id: 'iq-1' };
      },
      update: async () => {
        calls.push('iq-update');
      },
    },
    companySettings: {
      findUnique: async () => ({ allowNegativeBalance: true, preventNegativeStock: false }),
    },
    companySettingEntry: { findFirst: async () => null },
    itemWarehouseBalance: {
      findUnique: async () => ({
        quantityOnHand: { toNumber: () => 4 },
        reservedQuantity: { toNumber: () => 0 },
      }),
    },
  };
  return { tx, calls, created };
}

const input = {
  companyId: 'co-1',
  warehouseId: 'wh-1',
  itemId: 'item-1',
  quantityDelta: 4,
  unitCost: 10,
  movementType: 'ADJUSTMENT_POSITIVE',
  sourceType: 'TEST',
  sourceNumber: '1',
  sourceYearId: '2026',
  documentDate: new Date('2026-01-01'),
};

describe('postMovementInTx keeps the three quantity stores together', () => {
  it('writes a movement, a location quantity, and the warehouse balance for a new receipt', async () => {
    const { tx, calls } = fakeTx({});
    await stockMovementService.postMovementInTx(tx as never, input);
    expect(calls).toContain('movement');
    expect(calls).toContain('iq-create');
    expect(calls).toContain('iwb-write');
    expect(calls.indexOf('lock')).toBeLessThan(calls.indexOf('iq-create'));
  });

  it('updates the existing location row instead of inserting a second NULL location', async () => {
    const { tx, calls } = fakeTx({
      existingQuantity: { id: 'iq-existing', quantity: { toNumber: () => 0 } },
    });
    await stockMovementService.postMovementInTx(tx as never, input);
    expect(calls).toContain('iq-update');
    expect(calls).not.toContain('iq-create');
    expect(calls).toContain('movement');
    expect(calls).toContain('iwb-write');
  });

  it('refuses a warehouse that does not belong to the company', async () => {
    const { tx } = fakeTx({ warehouseFound: false });
    await expect(
      stockMovementService.postMovementInTx(tx as never, { ...input, companyId: 'co-other' })
    ).rejects.toThrow('المخزن غير موجود');
  });

  it('stamps the movement with the caller company, not another tenant', async () => {
    const { tx, created } = fakeTx({});
    await stockMovementService.postMovementInTx(tx as never, input);
    expect(created[0]).toEqual(expect.objectContaining({ companyId: 'co-1', itemId: 'item-1', warehouseId: 'wh-1' }));
  });
});
