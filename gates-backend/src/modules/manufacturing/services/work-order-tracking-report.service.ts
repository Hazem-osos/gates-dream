import prisma from '../../../shared/database/prisma';
import { computeWorkOrderProgress } from '../utils/work-order-progress';
import { manufacturingWorkOrderStatusLabelAr } from './work-order-status.labels';

export type WorkOrderTrackingReportFilters = {
  companyId: string;
  fromDate?: Date;
  toDate?: Date;
  status?: string;
  orderNumber?: string;
};

export async function getWorkOrderTrackingReport(filters: WorkOrderTrackingReportFilters) {
  const where: Record<string, unknown> = {
    companyId: filters.companyId,
    status: { not: 'CANCELLED' },
  };
  if (filters.status) where.status = filters.status;
  if (filters.orderNumber?.trim()) {
    where.orderNumber = { contains: filters.orderNumber.trim() };
  }
  if (filters.fromDate || filters.toDate) {
    where.workDate = {};
    if (filters.fromDate) (where.workDate as { gte?: Date }).gte = filters.fromDate;
    if (filters.toDate) (where.workDate as { lte?: Date }).lte = filters.toDate;
  }

  const rows = await prisma.manufacturingWorkOrder.findMany({
    where,
    orderBy: [{ workDate: 'desc' }, { updatedAt: 'desc' }],
    take: 500,
    include: {
      bom: { select: { id: true, name: true } },
      salesOrder: {
        select: { id: true, invoiceNumber: true, date: true },
      },
      lines: {
        orderBy: { lineOrder: 'asc' },
        include: { item: { select: { id: true, arabicName: true, serial: true } } },
      },
      productionOrders: {
        where: { status: { not: 'CANCELLED' } },
        select: {
          id: true,
          orderNumber: true,
          status: true,
          bomId: true,
          plannedQuantity: true,
          actualQuantity: true,
          bom: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  const data = await Promise.all(
    rows.map(async (wo) => {
      const progress = await computeWorkOrderProgress(filters.companyId, wo.id);
      return {
        id: wo.id,
        orderNumber: wo.orderNumber,
        workDate: wo.workDate.toISOString().slice(0, 10),
        status: wo.status,
        statusLabel: manufacturingWorkOrderStatusLabelAr(wo.status),
        description: wo.description ?? '',
        salesOrderId: wo.salesOrderInvoiceId,
        salesOrderNumber: wo.salesOrder?.invoiceNumber ?? '',
        percentComplete: progress?.percentComplete ?? 0,
        requiredTotal: progress?.requiredTotal ?? 0,
        completedTotal: progress?.completedTotal ?? 0,
        remainingTotal: progress?.remainingTotal ?? 0,
        inProgressTotal: progress?.inProgressTotal ?? 0,
        bomPlans: progress?.bomRows ?? [],
        finishedLines: wo.lines.map((l) => ({
          itemId: l.itemId,
          itemName: l.item.arabicName,
          itemSerial: l.item.serial ?? '',
          plannedQuantity: Number(l.plannedQuantity),
          completedQuantity: Number(l.completedQuantity),
          lineDescription: l.lineDescription ?? '',
        })),
        productionOrders: wo.productionOrders.map((po) => ({
          id: po.id,
          orderNumber: po.orderNumber,
          status: po.status,
          bomId: po.bomId,
          bomName: po.bom?.name ?? '',
          plannedQuantity: Number(po.plannedQuantity),
          actualQuantity: po.actualQuantity != null ? Number(po.actualQuantity) : null,
        })),
      };
    })
  );

  const summary = {
    total: data.length,
    confirmed: data.filter((r) => r.status === 'CONFIRMED' || r.status === 'OPEN').length,
    inProgress: data.filter((r) => r.status === 'IN_PROGRESS').length,
    completed: data.filter((r) => r.status === 'COMPLETED' || r.status === 'CLOSED').length,
  };

  return { data, summary };
}
