import type { Decimal } from '@prisma/client/runtime/library';
import prisma from '../../../shared/database/prisma';
import { money, moneyZero, rate } from '../utils/money-decimal';
import { ACTIVE_LG_STATUSES } from '../letters-of-guarantee/types/project-lg.types';

const PIPELINE_STATUSES = ['SUBMITTED_TO_CLIENT', 'CLIENT_APPROVED', 'FINANCE_POSTED'] as const;
const POSTED_SUB_INV = ['FINANCE_POSTED', 'PAID'] as const;
const COST_LABELS: Record<string, string> = {
  MATERIAL: 'خامات',
  LABOR: 'عمالة',
  EQUIPMENT: 'معدات',
  SUBCONTRACTOR: 'مقاول باطن',
  SITE_EXPENSE: 'مصاريف موقع',
};

function n(value: Decimal | number | null | undefined): number {
  return Number(money(value ?? 0).toFixed(2));
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(key: string): string {
  const [year, month] = key.split('-').map(Number);
  return new Intl.DateTimeFormat('ar-EG', { month: 'short', year: '2-digit' }).format(
    new Date(year, month - 1, 1)
  );
}

function plannedQty(contractQty: Decimal, start: Date | null, end: Date | null, asOf: Date): Decimal {
  const qty = money(contractQty);
  if (!start || !end) return qty;
  const t0 = start.getTime();
  const t1 = end.getTime();
  const t = asOf.getTime();
  if (t <= t0) return moneyZero();
  if (t >= t1 || t1 <= t0) return qty;
  return money(qty.mul((t - t0) / (t1 - t0)));
}

export class ContractingDashboardService {
  async getSummary(companyId: string) {
    const asOf = new Date();
    const in30 = new Date(asOf);
    in30.setDate(in30.getDate() + 30);
    const sixMonthsAgo = new Date(asOf);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);

    const [
      projectAgg,
      boqItems,
      invoiceGroups,
      sheetGroups,
      lgActive,
      lgExpiring,
      rateLines,
      postedSubInvoices,
      siteStock,
      recentInvoices,
      pendingSheets,
      expiringLgs,
    ] = await Promise.all([
      prisma.contractingProject.aggregate({
        where: { companyId, status: 'ACTIVE' },
        _count: true,
        _sum: { contractValue: true },
      }),
      prisma.projectBOQItem.findMany({
        where: { companyId, project: { status: 'ACTIVE' } },
        select: {
          contractQuantity: true,
          cumulativeExecutedQty: true,
          directCostEstimated: true,
          project: { select: { startDate: true, endDate: true } },
        },
      }),
      prisma.clientInvoice.groupBy({
        by: ['status'],
        where: { companyId },
        _count: true,
        _sum: { netPayableByClient: true },
      }),
      prisma.executiveMeasurementSheet.groupBy({
        by: ['status'],
        where: { companyId },
        _count: true,
      }),
      prisma.projectLetterOfGuarantee.aggregate({
        where: { companyId, status: { in: [...ACTIVE_LG_STATUSES] } },
        _count: true,
        _sum: { currentAmount: true, cashMarginAmount: true },
      }),
      prisma.projectLetterOfGuarantee.aggregate({
        where: {
          companyId,
          status: { in: [...ACTIVE_LG_STATUSES] },
          expiryDate: { lte: in30, gte: asOf },
        },
        _count: true,
      }),
      prisma.bOQRateAnalysisItem.findMany({
        where: { companyId },
        select: {
          costElementType: true,
          totalCostPerUnit: true,
          projectBOQItem: { select: { contractQuantity: true } },
        },
      }),
      prisma.subcontractInvoice.findMany({
        where: {
          companyId,
          status: { in: [...POSTED_SUB_INV] },
          subcontract: { project: { companyId, status: 'ACTIVE' } },
        },
        select: { subcontractId: true, sequenceNumber: true, grossCumulativeAmount: true },
        orderBy: { sequenceNumber: 'desc' },
      }),
      prisma.siteStockMaterial.aggregate({
        where: { companyId, status: 'INSTALLED_AND_DEDUCTED' },
        _sum: { netClaimedAmount: true },
      }),
      prisma.clientInvoice.findMany({
        where: { companyId, periodEndDate: { gte: sixMonthsAgo } },
        select: {
          id: true,
          invoiceNumber: true,
          status: true,
          netPayableByClient: true,
          periodEndDate: true,
          updatedAt: true,
          clientContract: { select: { projectId: true, contractNumber: true } },
        },
        orderBy: { updatedAt: 'desc' },
        take: 40,
      }),
      prisma.executiveMeasurementSheet.findMany({
        where: { companyId, status: { in: ['DRAFT', 'SITE_ENGINEER_VERIFIED'] } },
        select: {
          id: true,
          sheetNumber: true,
          status: true,
          projectId: true,
          measurementDate: true,
          updatedAt: true,
        },
        orderBy: { updatedAt: 'desc' },
        take: 8,
      }),
      prisma.projectLetterOfGuarantee.findMany({
        where: {
          companyId,
          status: { in: [...ACTIVE_LG_STATUSES] },
          expiryDate: { lte: in30, gte: asOf },
        },
        select: {
          id: true,
          lgNumber: true,
          currentAmount: true,
          expiryDate: true,
          projectId: true,
        },
        orderBy: { expiryDate: 'asc' },
        take: 8,
      }),
    ]);

    let ev = moneyZero();
    let pv = moneyZero();
    let bac = moneyZero();
    for (const item of boqItems) {
      const rateUnit = money(item.directCostEstimated);
      ev = money(ev.plus(money(item.cumulativeExecutedQty).mul(rateUnit)));
      pv = money(
        pv.plus(
          plannedQty(money(item.contractQuantity), item.project.startDate, item.project.endDate, asOf).mul(
            rateUnit
          )
        )
      );
      bac = money(bac.plus(money(item.contractQuantity).mul(rateUnit)));
    }

    const latestBySub = new Map<string, Decimal>();
    for (const row of postedSubInvoices) {
      if (!latestBySub.has(row.subcontractId)) {
        latestBySub.set(row.subcontractId, money(row.grossCumulativeAmount));
      }
    }
    let ac = moneyZero();
    for (const value of latestBySub.values()) ac = money(ac.plus(value));
    ac = money(ac.plus(money(siteStock._sum.netClaimedAmount ?? 0)));

    const cv = money(ev.minus(ac));
    const cpi = ac.gt(0) ? rate(ev.div(ac)) : null;
    const spi = pv.gt(0) ? rate(ev.div(pv)) : null;

    const invoiceByStatus = Object.fromEntries(
      invoiceGroups.map((row) => [
        row.status,
        { count: row._count, value: n(row._sum.netPayableByClient) },
      ])
    ) as Record<string, { count: number; value: number }>;

    const extractPipeline = PIPELINE_STATUSES.map((status) => ({
      status,
      count: invoiceByStatus[status]?.count ?? 0,
      value: invoiceByStatus[status]?.value ?? 0,
    }));

    const unapprovedSheets =
      (sheetGroups.find((s) => s.status === 'DRAFT')?._count ?? 0) +
      (sheetGroups.find((s) => s.status === 'SITE_ENGINEER_VERIFIED')?._count ?? 0);
    const pendingClientReview = invoiceByStatus.SUBMITTED_TO_CLIENT?.count ?? 0;
    const awaitingGl = invoiceByStatus.CLIENT_APPROVED?.count ?? 0;

    const costMap = new Map<string, Decimal>();
    for (const line of rateLines) {
      const key = line.costElementType;
      const add = money(line.totalCostPerUnit).mul(money(line.projectBOQItem.contractQuantity));
      costMap.set(key, money((costMap.get(key) ?? moneyZero()).plus(add)));
    }
    const costDistribution = Object.entries(COST_LABELS).map(([key, label]) => ({
      key,
      label,
      value: n(costMap.get(key)),
    }));

    const monthKeys: string[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(asOf.getFullYear(), asOf.getMonth() - i, 1);
      monthKeys.push(monthKey(d));
    }
    const billed = new Map<string, Decimal>();
    for (const key of monthKeys) billed.set(key, moneyZero());
    for (const inv of recentInvoices) {
      const key = monthKey(inv.periodEndDate);
      if (!billed.has(key)) continue;
      billed.set(key, money((billed.get(key) ?? moneyZero()).plus(money(inv.netPayableByClient))));
    }
    const monthlyBudget = n(money(projectAgg._sum.contractValue ?? 0).div(12));
    const monthlyBilling = monthKeys.map((key) => ({
      name: monthLabel(key),
      billed: n(billed.get(key)),
      budget: monthlyBudget,
    }));

    const inbox = [
      ...pendingSheets.map((sheet) => ({
        id: sheet.id,
        tone: 'amber' as const,
        title: `حصر ${sheet.sheetNumber} بانتظار اعتماد الاستشاري`,
        detail: sheet.status === 'DRAFT' ? 'مسودة حصر' : 'تم التحقق ميدانياً',
        href: `/contracting/projects/${sheet.projectId}/technical-office`,
        at: sheet.updatedAt.toISOString(),
      })),
      ...recentInvoices
        .filter((inv) => inv.status === 'SUBMITTED_TO_CLIENT')
        .slice(0, 6)
        .map((inv) => ({
          id: inv.id,
          tone: 'blue' as const,
          title: `مستخلص ${inv.invoiceNumber} بانتظار توقيع المالك`,
          detail: inv.clientContract.contractNumber,
          href: `/contracting/projects/${inv.clientContract.projectId}/client-billing`,
          amount: n(inv.netPayableByClient),
          at: inv.updatedAt.toISOString(),
        })),
      ...recentInvoices
        .filter((inv) => inv.status === 'CLIENT_APPROVED')
        .slice(0, 4)
        .map((inv) => ({
          id: `gl-${inv.id}`,
          tone: 'blue' as const,
          title: `مستخلص ${inv.invoiceNumber} جاهز للترحيل`,
          detail: 'معتمد من العميل — TECH_OFFICE / GL',
          href: `/contracting/projects/${inv.clientContract.projectId}/client-billing`,
          amount: n(inv.netPayableByClient),
          at: inv.updatedAt.toISOString(),
        })),
      ...expiringLgs.map((lg) => ({
        id: lg.id,
        tone: 'amber' as const,
        title: `خطاب ضمان ${lg.lgNumber} ينتهي خلال 30 يوماً`,
        detail: lg.expiryDate.toISOString().slice(0, 10),
        href: `/contracting/projects/${lg.projectId}/letters-of-guarantee`,
        amount: n(lg.currentAmount),
        at: lg.expiryDate.toISOString(),
      })),
    ]
      .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
      .slice(0, 8);

    const activity = recentInvoices.slice(0, 5).map((inv) => ({
      id: inv.id,
      title: `مستخلص مالك ${inv.invoiceNumber}`,
      detail: inv.clientContract.contractNumber,
      status: inv.status,
      href: `/contracting/projects/${inv.clientContract.projectId}/client-billing`,
      at: inv.updatedAt.toISOString(),
    }));

    return {
      asOfDate: asOf.toISOString(),
      kpis: {
        activeProjects: projectAgg._count,
        activeContractValue: n(projectAgg._sum.contractValue),
        portfolioCpi: cpi ? Number(cpi.toFixed(4)) : null,
        portfolioSpi: spi ? Number(spi.toFixed(4)) : null,
        earnedValue: n(ev),
        actualCost: n(ac),
        costVariance: n(cv),
        budgetAtCompletion: n(bac),
        lgActiveCount: lgActive._count,
        lgActiveValue: n(lgActive._sum.currentAmount),
        lgFrozenMargin: n(lgActive._sum.cashMarginAmount),
        lgExpiringIn30Days: lgExpiring._count,
      },
      extractPipeline,
      actionQueue: {
        unapprovedMeasurementSheets: unapprovedSheets,
        pendingClientExtracts: pendingClientReview,
        extractsReadyForGl: awaitingGl,
      },
      charts: {
        monthlyBilling,
        costDistribution,
      },
      inbox,
      activity,
    };
  }
}

export const contractingDashboardService = new ContractingDashboardService();
