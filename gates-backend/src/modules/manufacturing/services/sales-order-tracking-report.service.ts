import prisma from '../../../shared/database/prisma';
import { computeWorkOrderProgress } from '../utils/work-order-progress';
import { manufacturingWorkOrderStatusLabelAr } from './work-order-status.labels';

export type SalesOrderTrackingReportFilters = {
  companyId: string;
  fromDate?: Date;
  toDate?: Date;
  invoiceNumber?: string;
  customerId?: string;
};

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
      lines: {
        orderBy: { lineOrder: 'asc' },
        include: { item: { select: { id: true, arabicName: true, serial: true } } },
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

  const data = await Promise.all(
    invoices.map(async (inv) => {
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
            remainingTotal: progress?.remainingTotal ?? 0,
            bomPlans: progress?.bomRows ?? [],
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

      return {
        id: inv.id,
        invoiceNumber: inv.invoiceNumber ?? '',
        date: inv.date.toISOString().slice(0, 10),
        dueDate: inv.dueDate?.toISOString().slice(0, 10) ?? '',
        customerId: inv.customerId,
        customerName: inv.customer?.arabicName ?? '',
        percentComplete: aggPercent,
        lines: inv.lines.map((l) => ({
          itemId: l.itemId,
          itemName: l.item.arabicName,
          itemSerial: l.item.serial ?? '',
          quantity: Number(l.quantity),
          lineNotes: l.lineNotes ?? '',
        })),
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
