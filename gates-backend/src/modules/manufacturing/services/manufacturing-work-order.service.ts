import { Decimal } from '@prisma/client/runtime/library';
import prisma from '../../../shared/database/prisma';
import { AppError } from '../../../shared/middleware/error-handler';
import { bomService } from './bom.service';
import { resolveManufacturingWorkOrderNumberInTx } from './manufacturing-work-order-numbering.service';
import type { SaveManufacturingWorkOrderInput } from '../schemas/manufacturing-work-order.schema';
import {
  computeWorkOrderProgress,
  parseBomPlansFromMetadata,
} from '../utils/work-order-progress';

const lineInclude = {
  item: { select: { id: true, arabicName: true, serial: true, barcode: true } },
};

const detailInclude = {
  bom: {
    select: {
      id: true,
      name: true,
      finishedItemId: true,
      finishedItem: { select: { id: true, arabicName: true, serial: true } },
    },
  },
  salesOrder: {
    select: { id: true, invoiceNumber: true, date: true, dueDate: true, customerId: true },
  },
  lines: { orderBy: [{ lineOrder: 'asc' }, { id: 'asc' }], include: lineInclude },
};

function parseWorkDate(value: string): Date {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new AppError(422, 'تاريخ غير صالح');
  return d;
}

function unpackSalesOrderLineNotes(raw: string | null | undefined): {
  specifications: string;
  imageUrl?: string;
} {
  const text = String(raw ?? '').trim();
  const prefix = '{"salesOrderLine":';
  if (!text.startsWith(prefix)) return { specifications: text };
  try {
    const parsed = JSON.parse(text) as {
      salesOrderLine?: { specifications?: string; imageUrl?: string };
    };
    const block = parsed.salesOrderLine;
    return {
      specifications: block?.specifications?.trim() ?? '',
      imageUrl: block?.imageUrl?.trim() || undefined,
    };
  } catch {
    return { specifications: text };
  }
}

function deliveryLeadDaysFromInvoice(date: Date, dueDate: Date | null | undefined): number {
  if (!dueDate) return 0;
  const ms = dueDate.getTime() - date.getTime();
  if (!Number.isFinite(ms)) return 0;
  return Math.max(0, Math.round(ms / (24 * 60 * 60 * 1000)));
}

function normalizeLines(input: SaveManufacturingWorkOrderInput['lines']) {
  const lines = input.map((line, index) => ({
    itemId: line.itemId,
    plannedQuantity: line.plannedQuantity,
    completedQuantity: line.completedQuantity ?? 0,
    unit: line.unit?.trim() || null,
    lineDescription: line.lineDescription?.trim() || null,
    imageUrl: line.imageUrl?.trim() || null,
    lineOrder: line.lineOrder ?? index + 1,
  }));
  const itemIds = [...new Set(lines.map((l) => l.itemId))];
  if (itemIds.length !== lines.length) {
    throw new AppError(400, 'لا يمكن تكرار نفس الصنف في بنود أمر الشغل');
  }
  for (const line of lines) {
    if (line.plannedQuantity < 0 || line.completedQuantity < 0) {
      throw new AppError(422, 'الكميات يجب أن تكون موجبة أو صفر');
    }
  }
  return lines;
}

async function resolveOptionalBomId(companyId: string, bomId?: string | null) {
  const id = bomId?.trim();
  if (!id) return null;
  await bomService.getById(companyId, id);
  return id;
}

async function buildBomPlansForLineItems(
  companyId: string,
  lines: Array<{ itemId: string; plannedQuantity: number }>
) {
  const plans: Array<{ bomId: string; modelCount: number; itemId: string }> = [];
  for (const line of lines) {
    const bom = await prisma.billOfMaterials.findFirst({
      where: { companyId, finishedItemId: line.itemId },
      select: { id: true },
      orderBy: { updatedAt: 'desc' },
    });
    if (!bom) continue;
    plans.push({
      bomId: bom.id,
      modelCount: line.plannedQuantity,
      itemId: line.itemId,
    });
  }
  return plans;
}

function resolveStatusOnSave(
  existingStatus: string,
  inputStatus?: string
): string {
  if (existingStatus === 'CANCELLED' || existingStatus === 'COMPLETED') {
    return existingStatus;
  }
  if (existingStatus === 'IN_PROGRESS') return 'IN_PROGRESS';
  if (inputStatus === 'CLOSED') return 'CLOSED';
  if (inputStatus === 'COMPLETED') return 'COMPLETED';
  return 'CONFIRMED';
}

function mapLineCreates(lines: ReturnType<typeof normalizeLines>) {
  return lines.map((line) => ({
    itemId: line.itemId,
    plannedQuantity: new Decimal(line.plannedQuantity),
    completedQuantity: new Decimal(line.completedQuantity),
    unit: line.unit,
    lineDescription: line.lineDescription,
    imageUrl: line.imageUrl,
    lineOrder: line.lineOrder,
  }));
}

export class ManufacturingWorkOrderService {
  async list(companyId: string, limit = 100) {
    return prisma.manufacturingWorkOrder.findMany({
      where: { companyId, status: { not: 'CANCELLED' } },
      orderBy: { updatedAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 500),
      include: {
        bom: {
          select: {
            id: true,
            name: true,
            finishedItem: { select: { id: true, arabicName: true, serial: true } },
          },
        },
        lines: {
          orderBy: { lineOrder: 'asc' },
          select: {
            itemId: true,
            plannedQuantity: true,
            completedQuantity: true,
            item: { select: { id: true, arabicName: true, serial: true } },
          },
        },
      },
    });
  }

  async getById(companyId: string, id: string) {
    const row = await prisma.manufacturingWorkOrder.findFirst({
      where: { id, companyId },
      include: detailInclude,
    });
    if (!row) throw new AppError(404, 'أمر الشغل غير موجود');
    return row;
  }

  async getBySalesOrderInvoiceId(companyId: string, salesOrderInvoiceId: string) {
    const row = await prisma.manufacturingWorkOrder.findFirst({
      where: { companyId, salesOrderInvoiceId, status: { not: 'CANCELLED' } },
      include: detailInclude,
      orderBy: { createdAt: 'desc' },
    });
    if (!row) return null;
    return row;
  }

  async createFromSalesOrder(
    companyId: string,
    salesOrderInvoiceId: string,
    ctx: { branchId?: string | null; fiscalYearId?: string | null }
  ) {
    const existing = await this.getBySalesOrderInvoiceId(companyId, salesOrderInvoiceId);
    if (existing) {
      throw new AppError(409, 'يوجد أمر شغل مرتبط بأمر البيع بالفعل');
    }

    const invoice = await prisma.invoice.findFirst({
      where: {
        id: salesOrderInvoiceId,
        companyId,
        invoiceKind: 'SALES_ORDER',
        isCancelled: false,
      },
      include: {
        lines: { orderBy: { lineOrder: 'asc' }, include: { item: true } },
        customer: { select: { id: true, arabicName: true } },
      },
    });
    if (!invoice) throw new AppError(404, 'أمر البيع غير موجود');

    const orderLines = invoice.lines.filter((l) => Number(l.quantity) > 0);
    if (!orderLines.length) throw new AppError(422, 'أمر البيع لا يحتوي على أصناف');

    const deliveryLeadDays = deliveryLeadDaysFromInvoice(invoice.date, invoice.dueDate);
    const expectedDeliveryDate = invoice.dueDate
      ? invoice.dueDate.toISOString().slice(0, 10)
      : null;

    const lines = orderLines.map((line, index) => {
      const extras = unpackSalesOrderLineNotes(line.lineNotes);
      return {
        itemId: line.itemId,
        plannedQuantity: Number(line.quantity),
        completedQuantity: 0,
        unit: null,
        lineDescription: extras.specifications || null,
        imageUrl: extras.imageUrl || null,
        lineOrder: index + 1,
      };
    });

    const bomPlans = await buildBomPlansForLineItems(
      companyId,
      lines.map((l) => ({ itemId: l.itemId, plannedQuantity: l.plannedQuantity }))
    );
    const primaryBomId = bomPlans[0]?.bomId ?? null;

    const processMetadata = {
      salesOrderNumber: invoice.invoiceNumber ?? '',
      salesOrderInvoiceId: invoice.id,
      customerId: invoice.customerId,
      customerName: invoice.customer?.arabicName ?? '',
      deliveryLeadDays,
      expectedDeliveryDate,
      planningWarehouseId: invoice.warehouseId ?? undefined,
      bomPlans,
    };

    return this.create(companyId, {
      branchId: ctx.branchId,
      fiscalYearId: ctx.fiscalYearId,
      bomId: primaryBomId,
      salesOrderInvoiceId: invoice.id,
      description: `أمر شغل من أمر بيع ${invoice.invoiceNumber ?? ''}`.trim(),
      workDate: new Date().toISOString().slice(0, 10),
      modelQuantity: 1,
      status: 'CONFIRMED',
      processMetadata,
      lines,
    });
  }

  async create(
    companyId: string,
    input: SaveManufacturingWorkOrderInput & { branchId?: string | null; fiscalYearId?: string | null }
  ) {
    const lines = normalizeLines(input.lines);
    const bomId =
      (await resolveOptionalBomId(companyId, input.bomId)) ??
      (lines.length
        ? (
            await prisma.billOfMaterials.findFirst({
              where: { companyId, finishedItemId: lines[0].itemId },
              select: { id: true },
              orderBy: { updatedAt: 'desc' },
            })
          )?.id ??
          null
        : null);
    if (!bomId && !input.salesOrderInvoiceId && lines.length === 0) {
      throw new AppError(422, 'أضف أصناف أمر الشغل أو اربط أمر بيع');
    }
    const itemCount = await prisma.item.count({
      where: { companyId, id: { in: lines.map((l) => l.itemId) } },
    });
    if (itemCount !== lines.length) throw new AppError(400, 'أحد أصناف البنود غير موجود');

    return prisma.$transaction(async (tx) => {
      const orderNumber = await resolveManufacturingWorkOrderNumberInTx(tx, {
        companyId,
        branchId: input.branchId ?? null,
        fiscalYearId: input.fiscalYearId ?? null,
        clientSerial: input.orderNumber,
      });

      return tx.manufacturingWorkOrder.create({
        data: {
          companyId,
          branchId: input.branchId ?? undefined,
          orderNumber,
          bomId,
          salesOrderInvoiceId: input.salesOrderInvoiceId ?? undefined,
          description: input.description?.trim() || null,
          workDate: parseWorkDate(input.workDate),
          modelQuantity: new Decimal(input.modelQuantity),
          status: 'CONFIRMED',
          processMetadata: input.processMetadata ?? undefined,
          lines: { create: mapLineCreates(lines) },
        },
        include: detailInclude,
      });
    });
  }

  async update(companyId: string, id: string, input: SaveManufacturingWorkOrderInput) {
    const existing = await this.getById(companyId, id);
    if (existing.status === 'CANCELLED') {
      throw new AppError(422, 'لا يمكن تعديل أمر ملغي');
    }
    const bomId =
      (await resolveOptionalBomId(companyId, input.bomId)) ?? existing.bomId ?? null;
    const lines = normalizeLines(input.lines);
    const itemCount = await prisma.item.count({
      where: { companyId, id: { in: lines.map((l) => l.itemId) } },
    });
    if (itemCount !== lines.length) throw new AppError(400, 'أحد أصناف البنود غير موجود');

    const orderNumber = input.orderNumber?.trim() || existing.orderNumber;
    if (!orderNumber) throw new AppError(422, 'رقم الأمر مطلوب');

    return prisma.$transaction(async (tx) => {
      const clash = await tx.manufacturingWorkOrder.findFirst({
        where: { companyId, orderNumber, id: { not: id } },
        select: { id: true },
      });
      if (clash) throw new AppError(409, 'رقم الأمر مستخدم مسبقاً');

      await tx.manufacturingWorkOrderLine.deleteMany({ where: { workOrderId: id } });

      return tx.manufacturingWorkOrder.update({
        where: { id },
        data: {
          orderNumber,
          bomId,
          description: input.description?.trim() || null,
          workDate: parseWorkDate(input.workDate),
          modelQuantity: new Decimal(input.modelQuantity),
          status: resolveStatusOnSave(existing.status, input.status),
          processMetadata: input.processMetadata ?? undefined,
          lines: { create: mapLineCreates(lines) },
        },
        include: detailInclude,
      });
    });
  }

  async getProgress(companyId: string, id: string) {
    await this.getById(companyId, id);
    const progress = await computeWorkOrderProgress(companyId, id);
    if (!progress) throw new AppError(404, 'أمر الشغل غير موجود');
    return progress;
  }

  async finish(companyId: string, id: string) {
    const existing = await this.getById(companyId, id);
    if (existing.status === 'CANCELLED') {
      throw new AppError(422, 'لا يمكن إنهاء أمر ملغي');
    }
    if (existing.status === 'COMPLETED') {
      return existing;
    }
    const progress = await computeWorkOrderProgress(companyId, id);
    if (!progress?.canFinish) {
      throw new AppError(
        422,
        'لا يمكن الإنهاء قبل إكمال كل كميات النماذج المطلوبة في أوامر التصنيع'
      );
    }
    const plans = parseBomPlansFromMetadata(
      existing.processMetadata,
      existing.bomId,
      existing.modelQuantity
    );
    return prisma.$transaction(async (tx) => {
      for (const plan of plans) {
        const row = progress.bomRows.find((r) => r.bomId === plan.bomId);
        const bom = await tx.billOfMaterials.findFirst({
          where: { id: plan.bomId, companyId },
          select: { finishedItemId: true },
        });
        if (!bom?.finishedItemId) continue;
        const completedQty = row?.completedQuantity ?? 0;
        if (completedQty <= 0) continue;
        await tx.manufacturingWorkOrderLine.updateMany({
          where: { workOrderId: id, itemId: bom.finishedItemId },
          data: { completedQuantity: new Decimal(completedQty) },
        });
      }
      return tx.manufacturingWorkOrder.update({
        where: { id },
        data: { status: 'COMPLETED' },
        include: detailInclude,
      });
    });
  }

  async setStatus(companyId: string, id: string, status: 'CLOSED' | 'CANCELLED') {
    const existing = await this.getById(companyId, id);
    if (existing.status === 'CANCELLED') {
      throw new AppError(422, 'الأمر ملغي بالفعل');
    }
    if (status === 'CANCELLED' && existing.status === 'CLOSED') {
      throw new AppError(422, 'لا يمكن إلغاء أمر مغلق');
    }
    return prisma.manufacturingWorkOrder.update({
      where: { id },
      data: { status },
      include: detailInclude,
    });
  }
}

export const manufacturingWorkOrderService = new ManufacturingWorkOrderService();
