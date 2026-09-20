import type { Prisma, Warehouse } from '@prisma/client';
import { nextHierarchicalCode } from '../../../shared/utils/next-numeric-code';

export const DEFAULT_WAREHOUSE_AR = 'المخزن الرئيسي';
export const DEFAULT_WAREHOUSE_EN = 'Main Warehouse';

export type DefaultWarehouseSeedRow = {
  id: string;
  parentWarehouseId: string | null;
  warehouseKind: 'HEADER' | 'POSTING' | string;
};

export type DefaultWarehousePlan =
  | { type: 'use-tree'; headerId: string; postingId: string }
  | { type: 'add-posting'; headerId: string }
  | { type: 'wrap-posting'; postingId: string }
  | { type: 'create-both' };

/** HEADER folder named المخزن الرئيسي, with a POSTING child we actually move stock on. */
export function pickDefaultWarehousePlan(rows: DefaultWarehouseSeedRow[]): DefaultWarehousePlan {
  const postingKids = (parentId: string) =>
    rows.filter((row) => row.parentWarehouseId === parentId && row.warehouseKind !== 'HEADER');

  for (const row of rows) {
    if (row.warehouseKind !== 'HEADER') continue;
    const child = postingKids(row.id)[0];
    if (child) return { type: 'use-tree', headerId: row.id, postingId: child.id };
  }

  const rootHeader = rows.find((row) => row.warehouseKind === 'HEADER' && !row.parentWarehouseId);
  if (rootHeader) return { type: 'add-posting', headerId: rootHeader.id };

  const rootPosting = rows.find((row) => row.warehouseKind !== 'HEADER' && !row.parentWarehouseId);
  if (rootPosting) return { type: 'wrap-posting', postingId: rootPosting.id };

  return { type: 'create-both' };
}

function unusedWarehouseCode(
  preferred: string | null | undefined,
  used: Set<string>
): string | null {
  const code = preferred?.trim() || '';
  if (!code || used.has(code)) return null;
  return code;
}

export async function ensureDefaultWarehouseTree(
  companyId: string,
  client: Prisma.TransactionClient,
  options?: {
    branchId?: string | null;
    arabicName?: string;
    englishName?: string | null;
    postingCode?: string | null;
  }
): Promise<{ header: Warehouse; warehouse: Warehouse }> {
  const arabicName = options?.arabicName?.trim() || DEFAULT_WAREHOUSE_AR;
  const englishName = options?.englishName?.trim() || DEFAULT_WAREHOUSE_EN;
  const branchId = options?.branchId ?? null;

  const all = await client.warehouse.findMany({
    where: { companyId, isActive: true },
    select: {
      id: true,
      code: true,
      warehouseKind: true,
      parentWarehouseId: true,
      branchId: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  const scoped = branchId ? all.filter((row) => row.branchId === branchId || !row.branchId) : all;
  const plan = pickDefaultWarehousePlan(scoped);
  const usedCodes = new Set(
    all.map((row) => (row.code ?? '').trim()).filter((code): code is string => Boolean(code))
  );

  const createHeader = async () => {
    const code = nextHierarchicalCode(
      null,
      all.map((row) => row.code)
    );
    return client.warehouse.create({
      data: {
        companyId,
        branchId,
        code,
        arabicName,
        englishName,
        storeType: 'MAIN',
        warehouseKind: 'HEADER',
        parentWarehouseId: null,
        isActive: true,
      },
    });
  };

  const createPosting = async (header: Warehouse) => {
    const siblings = all.filter((row) => row.parentWarehouseId === header.id);
    const code =
      unusedWarehouseCode(options?.postingCode, usedCodes) ??
      nextHierarchicalCode(
        header.code,
        siblings.map((row) => row.code)
      );
    return client.warehouse.create({
      data: {
        companyId,
        branchId: header.branchId ?? branchId,
        code,
        arabicName,
        englishName,
        storeType: 'SUB',
        warehouseKind: 'POSTING',
        parentWarehouseId: header.id,
        isActive: true,
      },
    });
  };

  if (plan.type === 'use-tree') {
    const [header, warehouse] = await Promise.all([
      client.warehouse.findUniqueOrThrow({ where: { id: plan.headerId } }),
      client.warehouse.findUniqueOrThrow({ where: { id: plan.postingId } }),
    ]);
    return { header, warehouse };
  }

  if (plan.type === 'add-posting') {
    const header = await client.warehouse.findUniqueOrThrow({ where: { id: plan.headerId } });
    if (header.warehouseKind !== 'HEADER') {
      await client.warehouse.update({
        where: { id: header.id },
        data: { warehouseKind: 'HEADER', storeType: header.parentWarehouseId ? 'SUB' : 'MAIN' },
      });
    }
    const warehouse = await createPosting(header);
    return { header, warehouse };
  }

  if (plan.type === 'wrap-posting') {
    const header = await createHeader();
    const warehouse = await client.warehouse.update({
      where: { id: plan.postingId },
      data: {
        parentWarehouseId: header.id,
        warehouseKind: 'POSTING',
        storeType: 'SUB',
        branchId: branchId ?? undefined,
      },
    });
    return { header, warehouse };
  }

  const header = await createHeader();
  if (header.code) usedCodes.add(header.code);
  const warehouse = await createPosting(header);
  return { header, warehouse };
}
