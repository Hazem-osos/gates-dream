import prisma from '../../../shared/database/prisma';
import { computeWorkOrderProgress } from '../utils/work-order-progress';
import { manufacturingWorkOrderStatusLabelAr } from './work-order-status.labels';

export type SalesOrderTrackingReportFilters = {
  companyId: string;
  fromDate?: Date;
  toDate?: Date;
  invoiceNumber?: string;
  customerId?: string;
  itemId?: string;
  warehouseId?: string;
};

function lineWarehouseId(lineWarehouseId: string | null, headerWarehouseId: string | null): string | null {
  return lineWarehouseId?.trim() || headerWarehouseId?.trim() || null;
}

async function availableByItemWarehouse(
  companyId: string,
  pairs: Array<{ itemId: string; warehouseId: string }>
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (!pairs.length) return out;
  const unique = new Map<string, { itemId: string; warehouseId: string }>();
  for (const p of pairs) {
    unique.set(`${p.itemId}:${p.warehouseId}`, p);
  }
  const list = [...unique.values()];
  const rows = await prisma.itemWarehouseBalance.findMany({
    where: {
      companyId,
      OR: list.map((p) => ({ itemId: p.itemId, warehouseId: p.warehouseId })),
    },
    select: {
      itemId: true,
      warehouseId: true,
      quantityOnHand: true,
      reservedQuantity: true,
    },
  });
  for (const row of rows) {
    const onHand = Number(row.quantityOnHand ?? 0);
    const reserved = Number(row.reservedQuantity ?? 0);
    out.set(`${row.itemId}:${row.warehouseId}`, Math.max(0, onHand - reserved));
  }
  return out;
}

export async function getSalesOrderTrackingReport(filters: SalesOrderTrackingReportFilters) {
  const where: Record<string, unknown> = {
    companyId: filters.companyId,
    invoiceKind: 'SALES_ORDER',
    isCancelled: false,
  };
  if (filters.customerId) where.customerId = filters.customerId;
  if (filters.invoiceNumber?.trim()) {
    where.invoiceNumber = { contains: filters.invoiceNumber.trim() };
  }
  if (filters.itemId) {
    where.lines = { some: { itemId: filters.itemId } };
  }
  if (filters.warehouseId) {
    where.OR = [
      { warehouseId: filters.warehouseId },
      { lines: { some: { warehouseId: filters.warehouseId } } },
    ];
  }
  if (filters.fromDate || filters.toDate) {
    where.date = {};
    if (filters.fromDate) (where.date as { gte?: Date }).gte = filters.fromDate;
    if (filters.toDate) (where.date as { lte?: Date }).lte = filters.toDate;
  }

  const invoices = await prisma.invoice.findMany({
    where,
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    take: 300,
    include: {
      customer: { select: { id: true, arabicName: true } },
      warehouse: { select: { id: true, arabicName: true } },
      lines: {
        orderBy: { lineOrder: 'asc' },
        include: {
          item: { select: { id: true, arabicName: true, serial: true } },
          warehouse: { select: { id: true, arabicName: true } },
        },
      },
      manufacturingWorkOrders: {
        where: { status: { not: 'CANCELLED' } },
        include: {
          bom: { select: { name: true } },
          lines: {
            orderBy: { lineOrder: 'asc' },
            include: { item: { select: { arabicName: true } } },
          },
        },
      },
    },
  });

  const stockPairs: Array<{ itemId: string; warehouseId: string }> = [];
  for (const inv of invoices) {
    const headerWh = inv.warehouseId;
    for (const line of inv.lines) {
      const wh = lineWarehouseId(line.warehouseId, headerWh);
      if (wh) stockPairs.push({ itemId: line.itemId, warehouseId: wh });
    }
  }
  const stockMap = await availableByItemWarehouse(filters.companyId, stockPairs);

  const data = await Promise.all(
    invoices.map(async (inv) => {
      const headerWh = inv.warehouseId;
      const workOrders = await Promise.all(
        inv.manufacturingWorkOrders.map(async (wo) => {
          const progress = await computeWorkOrderProgress(filters.companyId, wo.id);
          return {
            id: wo.id,
            orderNumber: wo.orderNumber,
            status: wo.status,
            statusLabel: manufacturingWorkOrderStatusLabelAr(wo.status),
            percentComplete: progress?.percentComplete ?? 0,
            requiredTotal: progress?.requiredTotal ?? 0,
            completedTotal: progress?.completedTotal ?? 0,
            inProgressTotal: progress?.inProgressTotal ?? 0,
            remainingTotal: progress?.remainingTotal ?? 0,
            bomPlans: (progress?.bomRows ?? []).map((p) => ({
              bomName: p.bomName,
              requiredQuantity: p.requiredQuantity,
              completedQuantity: p.completedQuantity,
              inProgressQuantity: p.inProgressQuantity,
              remainingQuantity: p.remainingQuantity,
              percentComplete: p.percentComplete,
            })),
            lines: wo.lines.map((l) => ({
              itemName: l.item.arabicName,
              plannedQuantity: Number(l.plannedQuantity),
              completedQuantity: Number(l.completedQuantity),
              lineDescription: l.lineDescription ?? '',
            })),
          };
        })
      );

      const aggPercent =
        workOrders.length > 0
          ? Math.round(
              (workOrders.reduce((s, w) => s + w.percentComplete, 0) / workOrders.length) * 10
            ) / 10
          : 0;

      const lines = inv.lines.map((l) => {
        const whId = lineWarehouseId(l.warehouseId, headerWh);
        const whName = l.warehouse?.arabicName ?? inv.warehouse?.arabicName ?? '';
        const availableQuantity =
          whId != null ? stockMap.get(`${l.itemId}:${whId}`) ?? 0 : null;
        return {
          itemId: l.itemId,
          itemName: l.item.arabicName,
          itemSerial: l.item.serial ?? '',
          quantity: Number(l.quantity),
          lineNotes: l.lineNotes ?? '',
          warehouseId: whId,
          warehouseName: whName,
          availableQuantity,
        };
      });

      const primaryWarehouseName =
        inv.warehouse?.arabicName ??
        lines.find((l) => l.warehouseName)?.warehouseName ??
        '';

      return {
        id: inv.id,
        invoiceNumber: inv.invoiceNumber ?? '',
        date: inv.date.toISOString().slice(0, 10),
        dueDate: inv.dueDate?.toISOString().slice(0, 10) ?? '',
        description: inv.description ?? '',
        customerId: inv.customerId,
        customerName: inv.customer?.arabicName ?? '',
        warehouseId: inv.warehouseId,
        warehouseName: primaryWarehouseName,
        percentComplete: aggPercent,
        lines,
        workOrders,
      };
    })
  );

  const summary = {
    total: data.length,
    withWorkOrder: data.filter((r) => r.workOrders.length > 0).length,
    withoutWorkOrder: data.filter((r) => r.workOrders.length === 0).length,
  };

  return { data, summary };
}
