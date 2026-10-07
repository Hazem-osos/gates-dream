import type { Prisma } from '@prisma/client';
import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { logger } from '../../../shared/logger';
import { documentSequenceService } from '../../platform/services/document-sequence.service';
import { scopedItemQuantityWhere } from '../utils/item-quantity-tenant';
import type {
  CreateSupplyOrderInput,
  SupplyOrderFollowUpQuery,
} from '../schemas/supply-order.schema';

export type SupplyOrderLineInput = CreateSupplyOrderInput['lines'][number];

function lineTotal(qty: number, price: number) {
  return Math.round(qty * price * 100) / 100;
}

async function nextSupplyOrderSerial(
  tx: Prisma.TransactionClient,
  companyId: string,
  branchId?: string | null,
  clientSerial?: string
) {
  const trimmed = clientSerial?.trim();
  if (trimmed) {
    const taken = await tx.supplyOrder.findFirst({
      where: { companyId, serial: trimmed },
      select: { id: true },
    });
    if (taken) throw new AppError(422, 'رقم أمر التوريد مستخدم مسبقاً');
    return trimmed;
  }
  return documentSequenceService.nextNumberForFamilyInTx(tx, {
    companyId,
    branchId: branchId ?? null,
    fiscalYearId: null,
    docType: 'STO',
    legacySuffix: 'STO01',
    seedFromExisting: documentSequenceService.maxExistingNumber(async () => {
      const rows = await tx.supplyOrder.findMany({
        where: { companyId },
        select: { serial: true },
      });
      return rows.map((r) => r.serial);
    }),
    isAvailable: async (candidate) => {
      const taken = await tx.supplyOrder.findFirst({
        where: { companyId, serial: candidate },
        select: { id: true },
      });
      return !taken;
    },
  });
}

async function assertCustomerAndLines(companyId: string, data: CreateSupplyOrderInput) {
  const customer = await prisma.customer.findFirst({
    where: { id: data.customerId, companyId },
    select: { id: true },
  });
  if (!customer) throw new AppError(422, 'العميل غير موجود');

  const itemIds = [...new Set(data.lines.map((l) => l.itemId))];
  const whIds = [...new Set(data.lines.map((l) => l.warehouseId))];
  const [items, warehouses] = await Promise.all([
    prisma.item.findMany({ where: { companyId, id: { in: itemIds } }, select: { id: true } }),
    prisma.warehouse.findMany({ where: { companyId, id: { in: whIds } }, select: { id: true } }),
  ]);
  if (items.length !== itemIds.length) throw new AppError(422, 'صنف أو أكثر غير موجود');
  if (warehouses.length !== whIds.length) throw new AppError(422, 'مخزن أو أكثر غير موجود');
}

export class SupplyOrderService {
  async create(companyId: string, data: CreateSupplyOrderInput & { branchId?: string }) {
    await assertCustomerAndLines(companyId, data);
    const totalAmount = data.lines.reduce(
      (s, l) => s + lineTotal(l.quantity, l.unitPrice ?? 0),
      0
    );

    const record = await prisma.$transaction(async (tx) => {
      const serial = await nextSupplyOrderSerial(tx, companyId, data.branchId, data.serial);
      const order = await tx.supplyOrder.create({
        data: {
          companyId,
          branchId: data.branchId ?? null,
          serial,
          description: data.description ?? null,
          date: new Date(data.date),
          hijriDate: data.hijriDate ?? null,
          customerId: data.customerId,
          expectedLeadDays: data.expectedLeadDays ?? null,
          expectedDeliveryDate: data.expectedDeliveryDate
            ? new Date(data.expectedDeliveryDate)
            : null,
          totalAmount,
          isClosed: false,
          isCancelled: false,
        },
      });

      let lineOrder = 0;
      for (const line of data.lines) {
        const price = line.unitPrice ?? 0;
        await tx.supplyOrderLine.create({
          data: {
            supplyOrderId: order.id,
            itemId: line.itemId,
            warehouseId: line.warehouseId,
            unitId: line.unitId ?? null,
            quantity: line.quantity,
            unitPrice: price,
            total: lineTotal(line.quantity, price),
            lineOrder: lineOrder++,
          },
        });
      }
      return order;
    });

    logger.info({ companyId, supplyOrderId: record.id }, 'Supply order created');
    return this.getById(companyId, record.id);
  }

  async update(companyId: string, id: string, data: CreateSupplyOrderInput) {
    const existing = await prisma.supplyOrder.findFirst({
      where: { id, companyId },
      select: { id: true, isClosed: true, isCancelled: true },
    });
    if (!existing) throw new AppError(404, 'أمر التوريد غير موجود');
    if (existing.isCancelled) throw new AppError(422, 'لا يمكن تعديل أمر ملغي');
    if (existing.isClosed) throw new AppError(422, 'لا يمكن تعديل أمر مغلق — افتحه أولاً');

    await assertCustomerAndLines(companyId, data);
    const totalAmount = data.lines.reduce(
      (s, l) => s + lineTotal(l.quantity, l.unitPrice ?? 0),
      0
    );

    await prisma.$transaction(async (tx) => {
      if (data.serial?.trim()) {
        const taken = await tx.supplyOrder.findFirst({
          where: { companyId, serial: data.serial.trim(), id: { not: id } },
          select: { id: true },
        });
        if (taken) throw new AppError(422, 'رقم أمر التوريد مستخدم مسبقاً');
      }
      await tx.supplyOrderLine.deleteMany({ where: { supplyOrderId: id } });
      await tx.supplyOrder.update({
        where: { id },
        data: {
          description: data.description ?? null,
          serial: data.serial?.trim() || undefined,
          date: new Date(data.date),
          hijriDate: data.hijriDate ?? null,
          customerId: data.customerId,
          expectedLeadDays: data.expectedLeadDays ?? null,
          expectedDeliveryDate: data.expectedDeliveryDate
            ? new Date(data.expectedDeliveryDate)
            : null,
          totalAmount,
        },
      });
      let lineOrder = 0;
      for (const line of data.lines) {
        const price = line.unitPrice ?? 0;
        await tx.supplyOrderLine.create({
          data: {
            supplyOrderId: id,
            itemId: line.itemId,
            warehouseId: line.warehouseId,
            unitId: line.unitId ?? null,
            quantity: line.quantity,
            unitPrice: price,
            total: lineTotal(line.quantity, price),
            lineOrder: lineOrder++,
          },
        });
      }
    });

    return this.getById(companyId, id);
  }

  async getById(companyId: string, id: string) {
    const row = await prisma.supplyOrder.findFirst({
      where: { id, companyId },
      include: {
        customer: { select: { id: true, arabicName: true, code: true } },
        lines: {
          orderBy: { lineOrder: 'asc' },
          include: {
            item: { select: { id: true, serial: true, arabicName: true } },
            warehouse: { select: { id: true, arabicName: true, code: true } },
          },
        },
      },
    });
    if (!row) throw new AppError(404, 'أمر التوريد غير موجود');
    return row;
  }

  async list(
    companyId: string,
    opts: {
      customerId?: string;
      isClosed?: boolean;
      isCancelled?: boolean;
      fromDate?: string;
      toDate?: string;
      search?: string;
      page?: number;
      limit?: number;
    }
  ) {
    const page = opts.page && opts.page > 0 ? opts.page : 1;
    const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { companyId };
    if (opts.customerId) where.customerId = opts.customerId;
    if (opts.isClosed !== undefined) where.isClosed = opts.isClosed;
    if (opts.isCancelled !== undefined) where.isCancelled = opts.isCancelled;
    if (opts.fromDate || opts.toDate) {
      where.date = {};
      if (opts.fromDate) (where.date as { gte?: Date }).gte = new Date(opts.fromDate);
      if (opts.toDate) (where.date as { lte?: Date }).lte = new Date(opts.toDate);
    }
    if (opts.search?.trim()) {
      const s = { contains: opts.search.trim() };
      where.OR = [
        { serial: s },
        { description: s },
        { customer: { arabicName: s } },
      ];
    }

    const [rows, total] = await Promise.all([
      prisma.supplyOrder.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        include: {
          customer: { select: { id: true, arabicName: true } },
          lines: { take: 3, include: { item: { select: { arabicName: true } } } },
        },
      }),
      prisma.supplyOrder.count({ where }),
    ]);

    return { data: rows, total, page, limit };
  }

  async setClosed(companyId: string, id: string, closed: boolean) {
    const row = await prisma.supplyOrder.findFirst({
      where: { id, companyId },
      select: { id: true, isCancelled: true },
    });
    if (!row) throw new AppError(404, 'أمر التوريد غير موجود');
    if (row.isCancelled) throw new AppError(422, 'لا يمكن تغيير حالة أمر ملغي');
    await prisma.supplyOrder.update({
      where: { id },
      data: {
        isClosed: closed,
        closedAt: closed ? new Date() : null,
      },
    });
    return this.getById(companyId, id);
  }

  async cancel(companyId: string, id: string) {
    const row = await prisma.supplyOrder.findFirst({
      where: { id, companyId, isCancelled: false },
      select: { id: true },
    });
    if (!row) throw new AppError(404, 'أمر التوريد غير موجود أو ملغي مسبقاً');
    await prisma.supplyOrder.update({
      where: { id },
      data: { isCancelled: true, cancelledAt: new Date() },
    });
    return this.getById(companyId, id);
  }

  async restore(companyId: string, id: string) {
    await prisma.supplyOrder.updateMany({
      where: { id, companyId, isCancelled: true },
      data: { isCancelled: false, cancelledAt: null },
    });
    return this.getById(companyId, id);
  }

  private async stockQtyMap(
    companyId: string,
    keys: Array<{ itemId: string; warehouseId: string }>
  ) {
    const map = new Map<string, number>();
    if (!keys.length) return map;
    const itemIds = [...new Set(keys.map((k) => k.itemId))];
    const warehouseIds = [...new Set(keys.map((k) => k.warehouseId))];
    const rows = await prisma.itemQuantity.findMany({
      where: scopedItemQuantityWhere(companyId, {
        itemId: { in: itemIds },
        warehouseId: { in: warehouseIds },
      }),
      select: { itemId: true, warehouseId: true, quantity: true },
    });
    for (const row of rows) {
      const key = `${row.itemId}:${row.warehouseId}`;
      map.set(key, (map.get(key) ?? 0) + Number(row.quantity));
    }
    return map;
  }

  coveragePercent(stockQty: number, orderQty: number) {
    if (orderQty <= 0) return 0;
    return Math.round((stockQty / orderQty) * 10000) / 100;
  }

  classifyCoverage(pct: number): 'none' | 'partial' | 'full' {
    if (pct <= 0) return 'none';
    if (pct >= 100) return 'full';
    return 'partial';
  }

  async followUpReport(companyId: string, query: SupplyOrderFollowUpQuery) {
    const where: Record<string, unknown> = { companyId };
    if (query.customerId) where.customerId = query.customerId;
    if (query.fromDate || query.toDate) {
      where.date = {};
      if (query.fromDate) (where.date as { gte?: Date }).gte = new Date(query.fromDate);
      if (query.toDate) (where.date as { lte?: Date }).lte = new Date(query.toDate);
    }
    if (query.status === 'open') {
      where.isCancelled = false;
      where.isClosed = false;
    } else if (query.status === 'closed') {
      where.isCancelled = false;
      where.isClosed = true;
    } else if (query.status === 'cancelled') {
      where.isCancelled = true;
    }
    if (query.search?.trim()) {
      const s = { contains: query.search.trim() };
      where.OR = [
        { serial: s },
        { customer: { arabicName: s } },
        { lines: { some: { item: { arabicName: s } } } },
      ];
    }

    const orders = await prisma.supplyOrder.findMany({
      where,
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      include: {
        customer: { select: { id: true, arabicName: true } },
        lines: {
          orderBy: { lineOrder: 'asc' },
          include: {
            item: { select: { id: true, serial: true, arabicName: true } },
            warehouse: { select: { id: true, arabicName: true, code: true } },
          },
        },
      },
      take: 500,
    });

    const stockKeys = orders.flatMap((o) =>
      o.lines.map((l) => ({ itemId: l.itemId, warehouseId: l.warehouseId }))
    );
    const stockMap = await this.stockQtyMap(companyId, stockKeys);

    const rows = [];
    for (const order of orders) {
      for (const line of order.lines) {
        const orderQty = Number(line.quantity);
        const stockQty = stockMap.get(`${line.itemId}:${line.warehouseId}`) ?? 0;
        const coveragePct = this.coveragePercent(stockQty, orderQty);
        const coverageClass = this.classifyCoverage(coveragePct);
        if (query.coverage === 'full' && coverageClass !== 'full') continue;
        if (query.coverage === 'partial' && coverageClass !== 'partial') continue;
        if (query.coverage === 'none' && coverageClass !== 'none') continue;

        rows.push({
          supplyOrderId: order.id,
          serial: order.serial,
          orderDate: order.date,
          expectedDeliveryDate: order.expectedDeliveryDate,
          expectedLeadDays: order.expectedLeadDays,
          isClosed: order.isClosed,
          isCancelled: order.isCancelled,
          customerId: order.customerId,
          customerName: order.customer.arabicName,
          lineId: line.id,
          itemId: line.itemId,
          itemCode: line.item.serial,
          itemName: line.item.arabicName,
          warehouseId: line.warehouseId,
          warehouseName: line.warehouse.arabicName,
          orderQuantity: orderQty,
          stockQuantity: stockQty,
          unitPrice: Number(line.unitPrice),
          lineTotal: Number(line.total),
          coveragePercent: coveragePct,
          coverageClass,
        });
      }
    }

    return { rows, total: rows.length };
  }
}

export const supplyOrderService = new SupplyOrderService();
