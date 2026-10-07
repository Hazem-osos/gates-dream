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
  };
}): ItemAlternativeRow {
  return {
    id: row.id,
    alternativeItemId: row.alternativeItemId,
    quantity: Number(row.quantity) || 0,
    lineOrder: row.lineOrder,
    alternativeItem: row.alternativeItem,
  };
}

const alternativeInclude = {
  alternativeItem: {
    select: { id: true, arabicName: true, serial: true, barcode: true },
  },
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
