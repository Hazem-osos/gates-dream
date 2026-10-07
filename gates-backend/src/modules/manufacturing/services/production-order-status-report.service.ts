import prisma from '../../../shared/database/prisma';
import { productionOrderStatusLabelAr } from './production-order-status.labels';

export type ProductionOrderStatusReportFilters = {
  companyId: string;
  fromDate?: Date;
  toDate?: Date;
  status?: string;
  bomId?: string;
  warehouseIdRaw?: string;
  warehouseIdFinished?: string;
  orderNumber?: string;
};

export async function getProductionOrderStatusReport(
  filters: ProductionOrderStatusReportFilters
) {
  const { companyId, fromDate, toDate, status, bomId, warehouseIdRaw, warehouseIdFinished, orderNumber } =
    filters;

  const rows = await prisma.productionOrder.findMany({
    where: {
      companyId,
      ...(fromDate || toDate
        ? {
            createdAt: {
              ...(fromDate ? { gte: fromDate } : {}),
              ...(toDate ? { lte: toDate } : {}),
            },
          }
        : {}),
      ...(status ? { status } : {}),
      ...(bomId ? { bomId } : {}),
      ...(warehouseIdRaw ? { warehouseIdRaw } : {}),
      ...(warehouseIdFinished ? { warehouseIdFinished } : {}),
      ...(orderNumber?.trim()
        ? { orderNumber: { contains: orderNumber.trim() } }
        : {}),
    },
    include: {
      bom: { select: { id: true, name: true } },
      finishedItem: { select: { id: true, arabicName: true, serial: true } },
      warehouseRaw: { select: { id: true, arabicName: true } },
      warehouseFinished: { select: { id: true, arabicName: true } },
    },
    orderBy: [{ updatedAt: 'desc' }],
    take: 500,
  });

  const data = rows.map((row) => {
    const meta = row.processMetadata as { description?: string; stage?: string } | null;
    return {
      id: row.id,
      orderNumber: row.orderNumber,
      status: row.status,
      statusLabel: productionOrderStatusLabelAr(row.status),
      bomName: row.bom?.name ?? '',
      finishedItemName: row.finishedItem?.arabicName ?? '',
      finishedItemSerial: row.finishedItem?.serial ?? '',
      plannedQuantity: Number(row.plannedQuantity),
      actualQuantity: row.actualQuantity != null ? Number(row.actualQuantity) : null,
      warehouseRawName: row.warehouseRaw?.arabicName ?? '',
      warehouseFinishedName: row.warehouseFinished?.arabicName ?? '',
      stage: meta?.stage ?? '',
      description: meta?.description ?? '',
      totalMaterialCost: Number(row.totalMaterialCost),
      totalLaborCost: Number(row.totalLaborCost),
      totalOverheadCost: Number(row.totalOverheadCost),
      materialsPosted: Boolean(row.materialsIssueJournalEntryId),
      completionPosted: Boolean(row.completionJournalEntryId),
      createdAt: row.createdAt,
      releasedAt: row.releasedAt,
      completedAt: row.completedAt,
    };
  });

  const byStatus = data.reduce<Record<string, number>>((acc, row) => {
    acc[row.status] = (acc[row.status] ?? 0) + 1;
    return acc;
  }, {});

  return {
    data,
    summary: {
      total: data.length,
      confirmed: (byStatus.RELEASED ?? 0) + (byStatus.DRAFT ?? 0),
      inProgress: byStatus.IN_PROGRESS ?? 0,
      completed: byStatus.COMPLETED ?? 0,
      cancelled: byStatus.CANCELLED ?? 0,
    },
  };
}
