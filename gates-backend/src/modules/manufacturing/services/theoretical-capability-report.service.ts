import prisma from '../../../shared/database/prisma';
import { stockSummariesForItems } from '../../inventory/services/item-stock-summary';

export type TheoreticalCapabilityReportFilters = {
  companyId: string;
  warehouseId?: string;
  itemId?: string;
};

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** خامة مطلوبة لإنتاج كمية الأساس (baseQuantity) للنموذج — عادة 1 دفعة نموذج. */
function rawRequiredPerModel(lineQty: unknown, scrapPct: unknown): number {
  const qty = num(lineQty);
  if (qty <= 0) return 0;
  const scrap = num(scrapPct);
  return qty * (1 + scrap / 100);
}

export async function getTheoreticalCapabilityReport(
  filters: TheoreticalCapabilityReportFilters,
  options: { page?: number; limit?: number } = {}
) {
  const { companyId, warehouseId, itemId } = filters;
  const page = options.page ?? 1;
  const limit = Math.min(500, options.limit ?? 200);

  const warehouses = await prisma.warehouse.findMany({
    where: {
      companyId,
      ...(warehouseId ? { id: warehouseId } : {}),
    },
    select: { id: true, arabicName: true },
    orderBy: { arabicName: 'asc' },
  });

  if (!warehouses.length) {
    return {
      data: [],
      summary: { rowCount: 0, distinctRawItems: 0, distinctBoms: 0 },
      pagination: { page, limit, total: 0, totalPages: 0 },
    };
  }

  const boms = await prisma.billOfMaterials.findMany({
    where: {
      companyId,
      isActive: true,
      ...(itemId ? { lines: { some: { rawItemId: itemId } } } : {}),
    },
    include: {
      lines: {
        ...(itemId ? { where: { rawItemId: itemId } } : {}),
        include: {
          rawItem: { select: { id: true, arabicName: true, serial: true } },
        },
        orderBy: { lineOrder: 'asc' },
      },
    },
    orderBy: { name: 'asc' },
  });

  const rawIds = new Set<string>();
  for (const bom of boms) {
    for (const line of bom.lines) rawIds.add(line.rawItemId);
  }

  const stockByWh = new Map<string, Map<string, number>>();
  for (const wh of warehouses) {
    const summaries = await stockSummariesForItems(companyId, [...rawIds], wh.id);
    const m = new Map<string, number>();
    for (const [id, s] of summaries) m.set(id, s.availableQuantity);
    stockByWh.set(wh.id, m);
  }

  type Row = {
    rawItemId: string;
    rawItemName: string;
    rawItemSerial: string;
    warehouseId: string;
    warehouseName: string;
    availableQuantity: number;
    bomId: string;
    bomName: string;
    requiredQuantityPerModel: number;
    theoreticalModelCount: number;
  };

  const rows: Row[] = [];

  for (const bom of boms) {
    for (const line of bom.lines) {
      const requiredPerModel = rawRequiredPerModel(line.quantity, line.scrapPercentage);
      if (requiredPerModel <= 0) continue;

      for (const wh of warehouses) {
        const available = stockByWh.get(wh.id)?.get(line.rawItemId) ?? 0;
        const theoreticalModelCount = Math.floor(available / requiredPerModel);

        rows.push({
          rawItemId: line.rawItemId,
          rawItemName: line.rawItem.arabicName,
          rawItemSerial: line.rawItem.serial ?? '',
          warehouseId: wh.id,
          warehouseName: wh.arabicName,
          availableQuantity: available,
          bomId: bom.id,
          bomName: bom.name,
          requiredQuantityPerModel: Math.round(requiredPerModel * 10000) / 10000,
          theoreticalModelCount,
        });
      }
    }
  }

  rows.sort((a, b) => {
    const c = a.rawItemName.localeCompare(b.rawItemName, 'ar');
    if (c !== 0) return c;
    const w = a.warehouseName.localeCompare(b.warehouseName, 'ar');
    if (w !== 0) return w;
    return a.bomName.localeCompare(b.bomName, 'ar');
  });

  const skip = (page - 1) * limit;
  const paginatedData = rows.slice(skip, skip + limit);

  const distinctRaw = new Set(rows.map((r) => r.rawItemId));
  const distinctBom = new Set(rows.map((r) => r.bomId));

  return {
    data: paginatedData,
    summary: {
      rowCount: rows.length,
      distinctRawItems: distinctRaw.size,
      distinctBoms: distinctBom.size,
    },
    pagination: {
      page,
      limit,
      total: rows.length,
      totalPages: Math.ceil(rows.length / limit) || 0,
    },
  };
}
