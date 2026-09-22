// @ts-nocheck — Prisma interactive transaction client is a subset of prisma.
import { Decimal } from '@prisma/client/runtime/library';
import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';
import { AppError } from '../../../shared/middleware/error-handler';
import type {
  CreateItemOrderLimitInput,
  ItemOrderLimitLineInput,
  UpdateItemOrderLimitInput,
} from '../schemas/item-order-limit.schema';

const includeDetail = {
  warehouse: { select: { id: true, code: true, arabicName: true } },
  lines: {
    include: {
      item: {
        select: {
          id: true,
          code: true,
          serial: true,
          arabicName: true,
          orderLimit: true,
          lowerLimit: true,
          upperLimit: true,
        },
      },
    },
    orderBy: { item: { arabicName: 'asc' as const } },
  },
};

function filledLines(lines?: ItemOrderLimitLineInput[]) {
  return (lines ?? []).filter((line) => line.itemId);
}

export class ItemOrderLimitService {
  async list(
    companyId: string,
    options: {
      page?: number;
      limit?: number;
      search?: string;
      isActive?: boolean;
      warehouseId?: string;
    }
  ) {
    const page = options.page || 1;
    const limit = options.limit || 50;
    const skip = (page - 1) * limit;
    const where: {
      companyId: string;
      isActive?: boolean;
      warehouseId?: string;
      OR?: { code?: { contains: string }; description?: { contains: string } }[];
    } = { companyId };
    if (options.search) {
      where.OR = [
        { code: { contains: options.search } },
        { description: { contains: options.search } },
      ];
    }
    if (options.isActive !== undefined) where.isActive = options.isActive;
    if (options.warehouseId) where.warehouseId = options.warehouseId;

    const [rows, total] = await Promise.all([
      prisma.itemOrderLimitList.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          warehouse: { select: { id: true, code: true, arabicName: true } },
          _count: { select: { lines: true } },
        },
      }),
      prisma.itemOrderLimitList.count({ where }),
    ]);

    return {
      rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getById(companyId: string, id: string) {
    const row = await prisma.itemOrderLimitList.findFirst({
      where: { id, companyId },
      include: includeDetail,
    });
    if (!row) throw new AppError(404, 'بطاقة حد الطلب غير موجودة');
    return row;
  }

  private async replaceLines(
    tx: typeof prisma,
    companyId: string,
    listId: string,
    lines: ItemOrderLimitLineInput[]
  ) {
    const kept = filledLines(lines);
    const itemIds = [...new Set(kept.map((l) => l.itemId))];
    if (itemIds.length) {
      const items = await tx.item.findMany({
        where: { companyId, id: { in: itemIds } },
        select: { id: true },
      });
      if (items.length !== itemIds.length) throw new AppError(400, 'صنف أو أكثر غير موجود');
    }

    await tx.itemOrderLimitLine.deleteMany({ where: { listId } });
    if (kept.length) {
      await tx.itemOrderLimitLine.createMany({
        data: kept.map((line) => ({
          listId,
          itemId: line.itemId,
          orderLimit: new Decimal(line.orderLimit ?? 0),
        })),
      });
      await Promise.all(
        kept.map((line) =>
          tx.item.update({
            where: { id: line.itemId },
            data: {
              orderLimit: new Decimal(line.orderLimit ?? 0),
              ...(line.lowerLimit != null ? { lowerLimit: new Decimal(line.lowerLimit) } : {}),
              ...(line.upperLimit != null ? { upperLimit: new Decimal(line.upperLimit) } : {}),
            },
          })
        )
      );
    }
  }

  async create(companyId: string, data: CreateItemOrderLimitInput) {
    const warehouse = await prisma.warehouse.findFirst({
      where: { id: data.warehouseId, companyId },
    });
    if (!warehouse) throw new AppError(400, 'المخزن غير موجود');

    const existing = await prisma.itemOrderLimitList.findFirst({
      where: { companyId, warehouseId: data.warehouseId, isActive: true },
      select: { id: true },
    });
    if (existing) {
      return this.update(companyId, existing.id, data);
    }

    const requested = data.code?.trim() || null;
    const codeClash = requested
      ? await prisma.itemOrderLimitList.findFirst({
          where: { companyId, code: requested },
          select: { id: true },
        })
      : null;
    const code = codeClash ? `OL-${warehouse.code || warehouse.id.slice(0, 8)}` : requested;

    const created = await prisma.$transaction(async (tx) => {
      const list = await tx.itemOrderLimitList.create({
        data: {
          companyId,
          code,
          warehouseId: data.warehouseId,
          description: data.description || null,
        },
      });
      await this.replaceLines(tx, companyId, list.id, data.lines ?? []);
      return list.id;
    });

    logger.info({ companyId, id: created }, 'Item order limit list created');
    return this.getById(companyId, created);
  }

  async update(companyId: string, id: string, data: UpdateItemOrderLimitInput) {
    const existing = await prisma.itemOrderLimitList.findFirst({
      where: { id, companyId },
    });
    if (!existing) throw new AppError(404, 'بطاقة حد الطلب غير موجودة');

    if (data.warehouseId) {
      const warehouse = await prisma.warehouse.findFirst({
        where: { id: data.warehouseId, companyId },
      });
      if (!warehouse) throw new AppError(400, 'المخزن غير موجود');
    }

    await prisma.$transaction(async (tx) => {
      await tx.itemOrderLimitList.update({
        where: { id },
        data: {
          ...(data.code !== undefined && { code: data.code || null }),
          ...(data.warehouseId && { warehouseId: data.warehouseId }),
          ...(data.description !== undefined && { description: data.description || null }),
          ...(data.isActive !== undefined && { isActive: data.isActive }),
        },
      });
      if (data.lines) {
        await this.replaceLines(tx, companyId, id, data.lines);
      }
    });

    logger.info({ companyId, id }, 'Item order limit list updated');
    return this.getById(companyId, id);
  }

  async remove(companyId: string, id: string) {
    const existing = await prisma.itemOrderLimitList.findFirst({
      where: { id, companyId },
    });
    if (!existing) throw new AppError(404, 'بطاقة حد الطلب غير موجودة');
    await prisma.itemOrderLimitList.delete({ where: { id } });
    logger.info({ companyId, id }, 'Item order limit list permanently deleted');
    return { success: true };
  }
}

export const itemOrderLimitService = new ItemOrderLimitService();
