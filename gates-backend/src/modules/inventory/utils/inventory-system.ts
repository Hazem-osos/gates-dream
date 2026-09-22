import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';

export type InventorySystem = 'PERPETUAL' | 'PERIODIC';

export function parseInventorySystem(value: unknown): InventorySystem {
  const raw = String(value ?? '')
    .trim()
    .toUpperCase();
  if (
    raw === 'PERIODIC' ||
    raw === 'P' ||
    raw === 'دوري' ||
    raw.includes('PERIODIC') ||
    raw.includes('دوري')
  ) {
    return 'PERIODIC';
  }
  return 'PERPETUAL';
}

export function pickInventoryAccount(
  system: InventorySystem,
  companyAccountId: string | null | undefined,
  warehouseAccountId?: string | null,
  itemAccountId?: string | null
): string | undefined {
  if (system === 'PERIODIC') {
    return companyAccountId || undefined;
  }
  return warehouseAccountId || itemAccountId || companyAccountId || undefined;
}

export function readInventorySystem(advancedSettings: unknown): InventorySystem {
  const record =
    advancedSettings && typeof advancedSettings === 'object' && !Array.isArray(advancedSettings)
      ? (advancedSettings as Record<string, unknown>)
      : {};
  return parseInventorySystem(record.inventorySystem);
}

export async function assertWarehouseActive(
  companyId: string,
  warehouseId: string | null | undefined,
  options?: { label?: string }
) {
  const label = options?.label ?? 'المخزن';
  if (!warehouseId) {
    throw new AppError(400, `${label} مطلوب`);
  }
  const warehouse = await prisma.warehouse.findFirst({
    where: { id: warehouseId, companyId },
    select: { id: true, isActive: true, arabicName: true, code: true, warehouseKind: true },
  });
  if (!warehouse) {
    throw new AppError(404, `${label} غير موجود`);
  }
  if (!warehouse.isActive) {
    throw new AppError(
      409,
      `${label} «${warehouse.arabicName}» غير نشط. اختر مخزناً شغّالاً.`
    );
  }
  if (warehouse.warehouseKind === 'HEADER') {
    const childCount = await prisma.warehouse.count({
      where: { companyId, parentWarehouseId: warehouse.id, isActive: true },
    });
    if (childCount > 0) {
      throw new AppError(
        409,
        `${label} «${warehouse.arabicName}» مخزن رئيسي وله فروع. اختَر مخزن عمليات.`
      );
    }
  }
  return warehouse;
}

export async function getInventorySystem(companyId: string): Promise<InventorySystem> {
  const settings = await prisma.companySettings.findUnique({
    where: { companyId },
    select: { advancedSettings: true },
  });
  return readInventorySystem(settings?.advancedSettings);
}

export async function loadWarehouseGlMap(
  companyId: string,
  warehouseIds: Array<string | null | undefined>
): Promise<Map<string, { inventoryAccountId: string | null; costAccountId: string | null; giftAccountId: string | null }>> {
  const ids = [...new Set(warehouseIds.filter((id): id is string => Boolean(id)))];
  const map = new Map<
    string,
    { inventoryAccountId: string | null; costAccountId: string | null; giftAccountId: string | null }
  >();
  if (ids.length === 0) return map;

  const rows = await prisma.warehouse.findMany({
    where: { id: { in: ids }, companyId },
    select: {
      id: true,
      inventoryAccountId: true,
      costAccountId: true,
      giftAccountId: true,
    },
  });
  for (const row of rows) {
    map.set(row.id, {
      inventoryAccountId: row.inventoryAccountId,
      costAccountId: row.costAccountId,
      giftAccountId: row.giftAccountId,
    });
  }
  return map;
}
