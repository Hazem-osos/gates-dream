import prisma from '../../../shared/database/prisma';
import { computeWorkOrderProgress } from '../utils/work-order-progress';
import { manufacturingWorkOrderStatusLabelAr } from './work-order-status.labels';

export type ProductionCommitmentsReportFilters = {
  companyId: string;
  fromDate?: Date;
  toDate?: Date;
  invoiceNumber?: string;
  customerId?: string;
  includeCompleted?: boolean;
};

function daysUntil(isoDate: string | null | undefined): number | null {
  if (!isoDate) return null;
  const due = new Date(isoDate);
  if (Number.isNaN(due.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
}

const OPEN_PO_STATUSES = ['DRAFT', 'RELEASED', 'IN_PROGRESS'] as const;

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

type CommitmentBucket =
  | 'withoutWorkOrder'
  | 'overdue'
  | 'dueSoon'
  | 'completed'
  | 'onTrack';

function commitmentBucket(row: {
  workOrders: unknown[];
  percentComplete: number;
  isOverdue: boolean;
  daysUntilDue: number | null;
}): CommitmentBucket {
  if (row.workOrders.length === 0) return 'withoutWorkOrder';
  if (row.percentComplete >= 99.99) return 'completed';
  if (row.isOverdue) return 'overdue';
  if (
    row.daysUntilDue != null &&
    row.daysUntilDue >= 0 &&
    row.daysUntilDue <= 7
  ) {
    return 'dueSoon';
  }
  return 'onTrack';
}

export async function getProductionCommitmentsReport(
  filters: ProductionCommitmentsReportFilters
) {
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
    orderBy: [{ dueDate: 'asc' }, { date: 'desc' }],
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
          productionOrders: {
            where: { status: { not: 'CANCELLED' } },
            select: {
              id: true,
              orderNumber: true,
              status: true,
              plannedQuantity: true,
              materialsIssueJournalEntryId: true,
            },
            orderBy: { createdAt: 'desc' },
          },
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
      const dueDate = inv.dueDate?.toISOString().slice(0, 10) ?? '';
      const daysUntilDue = dueDate ? daysUntil(dueDate) : null;

      const workOrders = await Promise.all(
        inv.manufacturingWorkOrders.map(async (wo) => {
          const progress = await computeWorkOrderProgress(filters.companyId, wo.id);
          const openProductionOrders = wo.productionOrders.filter((po) =>
            OPEN_PO_STATUSES.includes(po.status as (typeof OPEN_PO_STATUSES)[number])
          );
          const poWithoutIssue = wo.productionOrders.filter(
            (po) =>
              po.status !== 'DRAFT' &&
              po.status !== 'CANCELLED' &&
              !po.materialsIssueJournalEntryId
          );

          const woAlerts: string[] = [];
          if (openProductionOrders.length === 0 && (progress?.remainingTotal ?? 0) > 0) {
            woAlerts.push('لا يوجد أمر تصنيع مفتوح للمتبقي');
          }
          if (poWithoutIssue.length > 0) {
            woAlerts.push('أمر تصنيع مؤكد بدون ترحيل مواد');
          }

          return {
            id: wo.id,
            orderNumber: wo.orderNumber,
            status: wo.status,
            statusLabel: manufacturingWorkOrderStatusLabelAr(wo.status),
            percentComplete: progress?.percentComplete ?? 0,
            requiredTotal: progress?.requiredTotal ?? 0,
            completedTotal: progress?.completedTotal ?? 0,
            remainingTotal: progress?.remainingTotal ?? 0,
            inProgressTotal: progress?.inProgressTotal ?? 0,
            bomPlans: progress?.bomRows ?? [],
            finishedLines: wo.lines.map((l) => ({
              itemName: l.item.arabicName,
              plannedQuantity: Number(l.plannedQuantity),
              completedQuantity: Number(l.completedQuantity),
            })),
            productionOrders: wo.productionOrders.map((po) => ({
              id: po.id,
              orderNumber: po.orderNumber,
              status: po.status,
              plannedQuantity: Number(po.plannedQuantity),
              materialsPosted: Boolean(po.materialsIssueJournalEntryId),
            })),
            alerts: woAlerts,
          };
        })
      );

      const requiredTotal = workOrders.reduce((s, w) => s + w.requiredTotal, 0);
      const completedTotal = workOrders.reduce((s, w) => s + w.completedTotal, 0);
      const inProgressTotal = workOrders.reduce((s, w) => s + w.inProgressTotal, 0);
      const remainingTotal = workOrders.reduce((s, w) => s + w.remainingTotal, 0);

      const aggPercent =
        requiredTotal > 0
          ? round1((completedTotal / requiredTotal) * 100)
          : workOrders.length > 0
            ? round1(
                workOrders.reduce((s, w) => s + w.percentComplete, 0) / workOrders.length
              )
            : 0;

      const isOverdue =
        daysUntilDue != null && daysUntilDue < 0 && aggPercent < 99.99;

      const alerts: string[] = [];
      if (workOrders.length === 0) {
        alerts.push('بدون أمر شغل');
      }
      if (isOverdue) {
        alerts.push('تأخر عن تاريخ التسليم');
      }
      if (
        daysUntilDue != null &&
        daysUntilDue >= 0 &&
        daysUntilDue <= 7 &&
        aggPercent < 99.99
      ) {
        alerts.push('تسليم خلال 7 أيام والإنجاز غير مكتمل');
      }
      for (const wo of workOrders) {
        alerts.push(...wo.alerts.map((a) => `${wo.orderNumber}: ${a}`));
      }

      const isComplete = aggPercent >= 99.99 && workOrders.length > 0;
      if (!filters.includeCompleted && isComplete && !isOverdue) {
        return null;
      }

      const rowCore = {
        id: inv.id,
        invoiceNumber: inv.invoiceNumber ?? '',
        date: inv.date.toISOString().slice(0, 10),
        dueDate,
        daysUntilDue,
        isOverdue,
        customerId: inv.customerId,
        customerName: inv.customer?.arabicName ?? '',
        percentComplete: aggPercent,
        requiredTotal,
        completedTotal,
        inProgressTotal,
        remainingTotal,
        workOrderCount: workOrders.length,
        productionOrderCount: workOrders.reduce((s, w) => s + w.productionOrders.length, 0),
        alerts: [...new Set(alerts)],
        lines: inv.lines.map((l) => ({
          itemName: l.item.arabicName,
          quantity: Number(l.quantity),
        })),
        workOrders,
      };

      return {
        ...rowCore,
        statusBucket: commitmentBucket(rowCore),
      };
    })
  );

  const rows = data.filter((r): r is NonNullable<typeof r> => r != null);

  const bucketCounts = {
    withoutWorkOrder: 0,
    overdue: 0,
    dueSoon: 0,
    completed: 0,
    onTrack: 0,
  };
  for (const row of rows) {
    bucketCounts[row.statusBucket] += 1;
  }

  const totalRequired = rows.reduce((s, r) => s + r.requiredTotal, 0);
  const totalCompleted = rows.reduce((s, r) => s + r.completedTotal, 0);
  const avgProgress =
    totalRequired > 0 ? round1((totalCompleted / totalRequired) * 100) : round1(
      rows.length
        ? rows.reduce((s, r) => s + r.percentComplete, 0) / rows.length
        : 0
    );

  const summary = {
    total: rows.length,
    overdue: bucketCounts.overdue,
    dueWithin7Days: bucketCounts.dueSoon,
    withoutWorkOrder: bucketCounts.withoutWorkOrder,
    completed: bucketCounts.completed,
    onTrack: bucketCounts.onTrack,
    withAlerts: rows.filter((r) => r.alerts.length > 0).length,
    avgProgress,
    totalRequired,
    totalCompleted,
    totalRemaining: rows.reduce((s, r) => s + r.remainingTotal, 0),
    periodFrom: filters.fromDate?.toISOString().slice(0, 10) ?? null,
    periodTo: filters.toDate?.toISOString().slice(0, 10) ?? null,
    chartBuckets: [
      { key: 'withoutWorkOrder', label: 'بدون أمر شغل', value: bucketCounts.withoutWorkOrder, color: '#f59e0b' },
      { key: 'overdue', label: 'متأخر التسليم', value: bucketCounts.overdue, color: '#e11d48' },
      { key: 'dueSoon', label: 'تسليم ≤ 7 أيام', value: bucketCounts.dueSoon, color: '#f97316' },
      { key: 'onTrack', label: 'على المسار', value: bucketCounts.onTrack, color: '#0E78AA' },
      { key: 'completed', label: 'مكتمل تصنيعاً', value: bucketCounts.completed, color: '#10b981' },
    ],
    progressLeaders: [...rows]
      .sort((a, b) => b.percentComplete - a.percentComplete)
      .slice(0, 8)
      .map((r) => ({
        id: r.id,
        label: r.invoiceNumber || r.id.slice(0, 8),
        percentComplete: r.percentComplete,
        remainingTotal: r.remainingTotal,
      })),
  };

  return { data: rows, summary };
}
