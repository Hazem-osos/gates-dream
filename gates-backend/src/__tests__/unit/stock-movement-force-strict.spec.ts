jest.mock('../../shared/database/prisma', () => ({
  __esModule: true,
  default: {},
}));

import { stockMovementService } from '../../modules/inventory/services/stock-movement.service';

describe('assertNegativeStockAllowed force flag', () => {
  it('rejects outbound when company allows negative but force strict is set', async () => {
    const tx = {
      companySettings: {
        findUnique: async () => ({
          allowNegativeBalance: true,
          preventNegativeStock: false,
        }),
      },
      companySettingEntry: { findFirst: async () => null },
      itemWarehouseBalance: {
        findUnique: async () => ({
          quantityOnHand: 1,
          reservedQuantity: 0,
        }),
      },
      item: {
        findFirst: async () => ({ arabicName: 'صنف', serial: '1' }),
      },
      warehouse: {
        findFirst: async () => ({ arabicName: 'مخزن', code: '01' }),
      },
    };

    await expect(
      stockMovementService.assertNegativeStockAllowed(
        'co-1',
        'wh-1',
        'item-1',
        null,
        -2,
        tx as never,
        true
      )
    ).rejects.toMatchObject({ statusCode: 422 });
  });
});
