import { AppError } from '../../../shared/middleware/error-handler';
import prisma from '../../../shared/database/prisma';

export type ItemAlternativeRow = {
  id: string;
  alternativeItemId: string;
  quantity: number;
  lineOrder: number;
  alternativeItem: {
    id: string;
    arabicName: string;
    serial: string | null;
    barcode: string | null;
    baseUnitName?: string | null;
  };
};

export type ItemAlternativeDefinitionRow = {
  itemId: string;
  alternativeCount: number;
  item: {
    id: string;
    serial: string | null;
    arabicName: string;
    barcode: string | null;
  };
};

function mapRow(row: {
  id: string;
  alternativeItemId: string;
  quantity: unknown;
  lineOrder: number;
  alternativeItem: {
    id: string;
    arabicName: string;
    serial: string | null;
    barcode: string | null;
    units?: Array<{ unit: { arabicName: string } }>;
  };
}): ItemAlternativeRow {
  const baseUnitName = row.alternativeItem.units?.[0]?.unit?.arabicName ?? null;
  return {
    id: row.id,
    alternativeItemId: row.alternativeItemId,
    quantity: Number(row.quantity) || 0,
    lineOrder: row.lineOrder,
    alternativeItem: {
      id: row.alternativeItem.id,
      arabicName: row.alternativeItem.arabicName,
      serial: row.alternativeItem.serial,
      barcode: row.alternativeItem.barcode,
      baseUnitName,
    },
  };
}

const alternativeInclude = {
  alternativeItem: {
    select: {
      id: true,
      arabicName: true,
      serial: true,
      barcode: true,
      units: {
        where: { isBaseUnit: true },
        take: 1,
        select: { unit: { select: { arabicName: true } } },
      },
    },
  },
};

const itemHeaderSelect = {
  id: true,
  serial: true,
  arabicName: true,
  barcode: true,
};

export class ItemAlternativeService {
  async listForItem(companyId: string, itemId: string): Promise<ItemAlternativeRow[]> {
    const item = await prisma.item.findFirst({
      where: { id: itemId, companyId },
      select: { id: true },
    });
    if (!item) throw new AppError(404, 'الصنف غير موجود');

    const rows = await prisma.itemAlternative.findMany({
      where: { companyId, itemId },
      orderBy: [{ lineOrder: 'asc' }, { createdAt: 'asc' }],
      include: alternativeInclude,
    });
    return rows.map(mapRow);
  }

  async saveForItem(
    companyId: string,
    itemId: string,
    lines: Array<{ alternativeItemId: string; quantity: number; lineOrder?: number }>
  ): Promise<ItemAlternativeRow[]> {
    const item = await prisma.item.findFirst({
      where: { id: itemId, companyId },
      select: { id: true },
    });
    if (!item) throw new AppError(404, 'الصنف غير موجود');

    const normalized = lines.map((line, index) => ({
      alternativeItemId: line.alternativeItemId,
      quantity: line.quantity,
      lineOrder: line.lineOrder ?? index + 1,
    }));

    const altIds = [...new Set(normalized.map((l) => l.alternativeItemId))];
    if (altIds.length !== normalized.length) {
      throw new AppError(400, 'لا يمكن تكرار نفس البديل أكثر من مرة');
    }
    for (const altId of altIds) {
      if (altId === itemId) throw new AppError(400, 'لا يمكن أن يكون البديل هو نفس الصنف');
    }

    const found = await prisma.item.count({
      where: { companyId, id: { in: altIds } },
    });
    if (found !== altIds.length) {
      throw new AppError(400, 'أحد أصناف البدائل غير موجود');
    }

    await prisma.$transaction(async (tx) => {
      await tx.itemAlternative.deleteMany({ where: { companyId, itemId } });
      if (normalized.length) {
        await tx.itemAlternative.createMany({
          data: normalized.map((line) => ({
            companyId,
            itemId,
            alternativeItemId: line.alternativeItemId,
            quantity: line.quantity,
            lineOrder: line.lineOrder,
          })),
        });
      }
    });

    return this.listForItem(companyId, itemId);
  }

  async deleteForItem(companyId: string, itemId: string): Promise<void> {
    const item = await prisma.item.findFirst({
      where: { id: itemId, companyId },
      select: { id: true },
    });
    if (!item) throw new AppError(404, 'الصنف غير موجود');
    await prisma.itemAlternative.deleteMany({ where: { companyId, itemId } });
  }

  async listDefinitions(
    companyId: string,
    options: { page?: number; limit?: number; search?: string } = {}
  ): Promise<{
    data: ItemAlternativeDefinitionRow[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const page = Math.max(1, options.page ?? 1);
    const limit = Math.min(200, Math.max(1, options.limit ?? 50));
    const search = options.search?.trim() ?? '';

    const grouped = await prisma.itemAlternative.groupBy({
      by: ['itemId'],
      where: {
        companyId,
        ...(search
          ? {
              item: {
                OR: [
                  { serial: { contains: search } },
                  { arabicName: { contains: search } },
                  { barcode: { contains: search } },
                ],
              },
            }
          : {}),
      },
      _count: { _all: true },
    });

    const itemIds = grouped.map((row) => row.itemId);
    const items = itemIds.length
      ? await prisma.item.findMany({
          where: { companyId, id: { in: itemIds } },
          select: itemHeaderSelect,
        })
      : [];
    const itemById = new Map(items.map((row) => [row.id, row]));

    const rows: ItemAlternativeDefinitionRow[] = grouped
      .map((row) => {
        const item = itemById.get(row.itemId);
        if (!item) return null;
        return {
          itemId: row.itemId,
          alternativeCount: row._count._all,
          item,
        };
      })
      .filter((row): row is ItemAlternativeDefinitionRow => row != null)
      .sort((a, b) => {
        const sa = a.item.serial ?? '';
        const sb = b.item.serial ?? '';
        const bySerial = sa.localeCompare(sb, 'ar');
        if (bySerial !== 0) return bySerial;
        return a.item.arabicName.localeCompare(b.item.arabicName, 'ar');
      });

    const total = rows.length;
    const data = rows.slice((page - 1) * limit, page * limit);
    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  }

  async listDefinitionItemIds(companyId: string): Promise<string[]> {
    const grouped = await prisma.itemAlternative.groupBy({
      by: ['itemId'],
      where: { companyId },
    });
    if (!grouped.length) return [];
    const items = await prisma.item.findMany({
      where: { companyId, id: { in: grouped.map((row) => row.itemId) } },
      select: { id: true, serial: true, arabicName: true },
    });
    return items
      .sort((a, b) => {
        const sa = a.serial ?? '';
        const sb = b.serial ?? '';
        const bySerial = sa.localeCompare(sb, 'ar');
        if (bySerial !== 0) return bySerial;
        return a.arabicName.localeCompare(b.arabicName, 'ar');
      })
      .map((row) => row.id);
  }

  async countsForItems(companyId: string, itemIds: string[]): Promise<Record<string, number>> {
    const unique = [...new Set(itemIds.filter(Boolean))];
    if (!unique.length) return {};

    const grouped = await prisma.itemAlternative.groupBy({
      by: ['itemId'],
      where: { companyId, itemId: { in: unique } },
      _count: { _all: true },
    });

    const out: Record<string, number> = {};
    for (const row of grouped) {
      out[row.itemId] = row._count._all;
    }
    return out;
  }
}

export const itemAlternativeService = new ItemAlternativeService();
