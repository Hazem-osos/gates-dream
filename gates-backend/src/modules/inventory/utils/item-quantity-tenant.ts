import type { Prisma } from '@prisma/client';

/**
 * ItemQuantity rows have no companyId column — scope via item + warehouse ownership.
 */
export function scopedItemQuantityWhere(
  companyId: string,
  core: Prisma.ItemQuantityWhereInput
): Prisma.ItemQuantityWhereInput {
  const { item, warehouse, ...rest } = core;
  const itemExtra =
    item && typeof item === 'object' && !Array.isArray(item) ? item : ({} as Prisma.ItemWhereInput);
  const warehouseExtra =
    warehouse && typeof warehouse === 'object' && !Array.isArray(warehouse)
      ? warehouse
      : ({} as Prisma.WarehouseWhereInput);

  return {
    ...rest,
    item: { ...itemExtra, companyId },
    warehouse: { ...warehouseExtra, companyId },
  };
}
