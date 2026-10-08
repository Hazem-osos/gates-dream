import prisma from '../../../shared/database/prisma';
import { roundTo4 } from '../../../shared/utils/decimal-round';
import { productionOrderStatusLabelAr } from './production-order-status.labels';
import { additionalCostsTotalFromMetadata } from '../utils/production-order-posting.helpers';

export type ProductionCostPostingSummaryFilters = {
  companyId: string;
  fromDate?: Date;
  toDate?: Date;
  warehouseIdRaw?: string;
  warehouseIdFinished?: string;
  costCenter?: string;
  postedOnly?: boolean;
};

function num(v: unknown): number {
  return Number(v ?? 0) || 0;
}

function processCostCenter(meta: unknown): string {
  if (!meta || typeof meta !== 'object') return '';
  const m = meta as { costCenter?: string; costCenterId?: string };
  return (m.costCenterId ?? m.costCenter ?? '').trim();
}

export async function getProductionCostPostingSummaryReport(
  filters: ProductionCostPostingSummaryFilters
) {
  const dateOr: Array<Record<string, unknown>> = [];
  if (filters.fromDate || filters.toDate) {
    const range = {
      ...(filters.fromDate ? { gte: filters.fromDate } : {}),
      ...(filters.toDate ? { lte: filters.toDate } : {}),
    };
    dateOr.push({ releasedAt: range }, { completedAt: range }, { createdAt: range });
  }

  const rows = await prisma.productionOrder.findMany({
    where: {
      companyId: filters.companyId,
      status: { not: 'CANCELLED' },
      ...(filters.warehouseIdRaw ? { warehouseIdRaw: filters.warehouseIdRaw } : {}),
      ...(filters.warehouseIdFinished ? { warehouseIdFinished: filters.warehouseIdFinished } : {}),
      ...(dateOr.length ? { OR: dateOr } : {}),
    },
    include: {
      bom: { select: { name: true } },
      finishedItem: { select: { arabicName: true, serial: true } },
      warehouseRaw: { select: { arabicName: true } },
      warehouseFinished: { select: { arabicName: true } },
      manufacturingWorkOrder: { select: { orderNumber: true } },
    },
    orderBy: [{ completedAt: 'desc' }, { releasedAt: 'desc' }, { createdAt: 'desc' }],
    take: 500,
  });

  const jeIds = new Set<string>();
  for (const row of rows) {
    if (row.materialsIssueJournalEntryId) jeIds.add(row.materialsIssueJournalEntryId);
    if (row.laborOverheadJournalEntryId) jeIds.add(row.laborOverheadJournalEntryId);
    if (row.completionJournalEntryId) jeIds.add(row.completionJournalEntryId);
    if (row.additionalCostsJournalEntryId) jeIds.add(row.additionalCostsJournalEntryId);
  }

  const journalSerialById = new Map<string, string>();
  if (jeIds.size > 0) {
    const journals = await prisma.journalEntry.findMany({
      where: { id: { in: [...jeIds] }, companyId: filters.companyId },
      select: { id: true, voucherNumber: true, legacyGlNum: true },
    });
    for (const j of journals) {
      const label = j.voucherNumber?.trim() || j.legacyGlNum?.trim() || j.id.slice(0, 8);
      journalSerialById.set(j.id, label);
    }
  }

  const data = rows
    .map((row) => {
      const costCenter = processCostCenter(row.processMetadata);
      if (filters.costCenter?.trim() && costCenter !== filters.costCenter.trim()) {
        return null;
      }

      const materialCost = num(row.totalMaterialCost);
      const laborCost = num(row.totalLaborCost);
      const overheadCost = num(row.totalOverheadCost);
      const additionalCost = additionalCostsTotalFromMetadata(row.processMetadata);
      const useUnifiedPosting = Boolean(row.additionalCostsJournalEntryId);
      const materialsPosted = Boolean(row.materialsIssueJournalEntryId);
      const laborPosted = Boolean(row.laborOverheadJournalEntryId);
      const completionPosted = Boolean(row.completionJournalEntryId);
      const additionalPosted = Boolean(row.additionalCostsJournalEntryId);

      if (
        filters.postedOnly &&
        !materialsPosted &&
        !laborPosted &&
        !completionPosted &&
        !additionalPosted
      ) {
        return null;
      }

      const actualQty = row.actualQuantity != null ? num(row.actualQuantity) : 0;
      const unitCost = num(row.unitCost);
      const totalCostEstimate = roundTo4(
        materialCost +
          laborCost +
          overheadCost +
          (useUnifiedPosting ? additionalCost : 0)
      );

      const completionValue =
        completionPosted && actualQty > 0
          ? roundTo4(actualQty * unitCost)
          : completionPosted
            ? totalCostEstimate
            : 0;

      const chargedToWip = materialsPosted ? totalCostEstimate : 0;
      const wipBalance =
        materialsPosted && row.status !== 'COMPLETED'
          ? roundTo4(Math.max(0, chargedToWip - completionValue))
          : 0;

      const postingAlerts: string[] = [];
      if (row.status !== 'DRAFT' && row.status !== 'CANCELLED' && !materialsPosted) {
        postingAlerts.push('بدون ترحيل صرف خامات');
      }
      if (row.status === 'IN_PROGRESS' && materialsPosted && !completionPosted) {
        postingAlerts.push('قيد التنفيذ — لم يُكمَل بعد');
      }
      if (row.status === 'IN_PROGRESS' && wipBalance > 0.01) {
        postingAlerts.push('رصيد WIP تقديري');
      }
      if (
        materialsPosted &&
        (laborCost > 0 || overheadCost > 0) &&
        !laborPosted &&
        row.status !== 'COMPLETED'
      ) {
        postingAlerts.push('أجور/مصاريف غير مرحّلة');
      }

      const mapJe = (id: string | null) =>
        id
          ? { id, serial: journalSerialById.get(id) ?? id.slice(0, 8) }
          : null;

      return {
        id: row.id,
        orderNumber: row.orderNumber,
        status: row.status,
        statusLabel: productionOrderStatusLabelAr(row.status),
        bomName: row.bom?.name ?? '',
        finishedItemName: row.finishedItem?.arabicName ?? '',
        workOrderNumber: row.manufacturingWorkOrder?.orderNumber ?? '',
        warehouseRawName: row.warehouseRaw?.arabicName ?? '',
        warehouseFinishedName: row.warehouseFinished?.arabicName ?? '',
        costCenter,
        plannedQuantity: num(row.plannedQuantity),
        actualQuantity: row.actualQuantity != null ? actualQty : null,
        unitCost: completionPosted || unitCost > 0 ? unitCost : null,
        materialCost,
        laborCost,
        overheadCost,
        additionalCost,
        totalCostEstimate,
        completionValue,
        wipBalance,
        postingMode: useUnifiedPosting ? 'unified' : 'standard',
        postingModeLabel: useUnifiedPosting ? 'موحّد (خامات + إضافي)' : 'WIP كلاسيكي',
        materialsPosted,
        laborPosted,
        completionPosted,
        additionalPosted,
        postingAlerts,
        journals: {
          materialsIssue: mapJe(row.materialsIssueJournalEntryId),
          laborOverhead: mapJe(row.laborOverheadJournalEntryId),
          completion: mapJe(row.completionJournalEntryId),
          additionalCosts: mapJe(row.additionalCostsJournalEntryId),
        },
        releasedAt: row.releasedAt?.toISOString() ?? null,
        completedAt: row.completedAt?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
      };
    })
    .filter((r): r is NonNullable<typeof r> => r != null);

  const statusCounts: Record<string, number> = {};
  for (const row of data) {
    statusCounts[row.status] = (statusCounts[row.status] ?? 0) + 1;
  }

  const materialsPostedTotal = roundTo4(
    data.filter((r) => r.materialsPosted).reduce((s, r) => s + r.materialCost, 0)
  );
  const laborPostedTotal = roundTo4(
    data.filter((r) => r.laborPosted).reduce((s, r) => s + r.laborCost, 0)
  );
  const overheadPostedTotal = roundTo4(
    data.filter((r) => r.laborPosted).reduce((s, r) => s + r.overheadCost, 0)
  );
  const additionalTotal = roundTo4(
    data.filter((r) => r.additionalPosted).reduce((s, r) => s + r.additionalCost, 0)
  );

  const summary = {
    orderCount: data.length,
    materialsPostedTotal,
    laborPostedTotal,
    overheadPostedTotal,
    additionalTotal,
    completionTotal: roundTo4(data.reduce((s, r) => s + r.completionValue, 0)),
    wipBalanceTotal: roundTo4(data.reduce((s, r) => s + r.wipBalance, 0)),
    totalCostEstimate: roundTo4(data.reduce((s, r) => s + r.totalCostEstimate, 0)),
    withoutMaterialsPosting: data.filter((r) => r.status !== 'DRAFT' && !r.materialsPosted).length,
    inProgressCount: statusCounts.IN_PROGRESS ?? 0,
    completedCount: statusCounts.COMPLETED ?? 0,
    releasedCount: statusCounts.RELEASED ?? 0,
    unifiedPostingCount: data.filter((r) => r.postingMode === 'unified').length,
    withAlertsCount: data.filter((r) => r.postingAlerts.length > 0).length,
    periodFrom: filters.fromDate?.toISOString() ?? null,
    periodTo: filters.toDate?.toISOString() ?? null,
    chartBuckets: [
      { key: 'COMPLETED', label: 'منتهي', value: statusCounts.COMPLETED ?? 0, color: '#059669' },
      { key: 'IN_PROGRESS', label: 'قيد التنفيذ', value: statusCounts.IN_PROGRESS ?? 0, color: '#0E78AA' },
      { key: 'RELEASED', label: 'مؤكد', value: statusCounts.RELEASED ?? 0, color: '#E3A008' },
      { key: 'DRAFT', label: 'مسودة', value: statusCounts.DRAFT ?? 0, color: '#94A3B8' },
    ],
    costComposition: [
      { key: 'material', label: 'مواد خام', value: materialsPostedTotal, color: '#0E78AA' },
      { key: 'labor', label: 'أجور', value: laborPostedTotal, color: '#1787B8' },
      { key: 'overhead', label: 'مصاريف', value: overheadPostedTotal, color: '#38BDF8' },
      { key: 'additional', label: 'تكاليف إضافية (موحّد)', value: additionalTotal, color: '#8B5CF6' },
      { key: 'completion', label: 'قيمة إتمام', value: roundTo4(data.reduce((s, r) => s + r.completionValue, 0)), color: '#059669' },
    ].filter((c) => c.value > 0),
    topCostOrders: [...data]
      .sort((a, b) => b.totalCostEstimate - a.totalCostEstimate)
      .slice(0, 8)
      .map((r) => ({
        id: r.id,
        orderNumber: r.orderNumber,
        label: r.finishedItemName || r.bomName || r.orderNumber,
        totalCost: r.totalCostEstimate,
        statusLabel: r.statusLabel,
      })),
  };

  return { data, summary };
}
