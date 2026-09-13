import type { Decimal } from '@prisma/client/runtime/library';
import prisma from '../../../shared/database/prisma';
import { money, moneyZero } from '../utils/money-decimal';

const PIPELINE = [
  'DRAFT',
  'SITE_SUBMITTED',
  'CONSULTANT_APPROVED',
  'TECH_OFFICE_APPROVED',
  'FINANCE_POSTED',
  'PAID',
] as const;

function n(value: Decimal | number | null | undefined): number {
  return Number(money(value ?? 0).toFixed(2));
}

function currentQuarter(now: Date): { year: number; quarter: 1 | 2 | 3 | 4; start: Date; end: Date } {
  const quarter = (Math.floor(now.getMonth() / 3) + 1) as 1 | 2 | 3 | 4;
  const startMonth = (quarter - 1) * 3;
  const start = new Date(now.getFullYear(), startMonth, 1);
  const end = new Date(now.getFullYear(), startMonth + 3, 0, 23, 59, 59, 999);
  return { year: now.getFullYear(), quarter, start, end };
}

export class SubcontractDashboardService {
  async getSummary(companyId: string) {
    const asOf = new Date();
    const q = currentQuarter(asOf);

    const [
      contractAgg,
      invoiceGroups,
      postedInvoices,
      pendingLogs,
      form41,
      topContracts,
      pendingRecon,
      waitingAudit,
    ] = await Promise.all([
      prisma.subcontract.aggregate({
        where: { companyId, status: 'ACTIVE' },
        _count: true,
        _sum: { totalContractValue: true },
      }),
      prisma.subcontractInvoice.groupBy({
        by: ['status'],
        where: { companyId },
        _count: true,
        _sum: {
          grossCurrentAmount: true,
          grossCumulativeAmount: true,
          retentionDeduction: true,
          taxWithholdingDeduction: true,
          materialOveruseDeduction: true,
          sitePenaltiesDeduction: true,
        },
      }),
      prisma.subcontractInvoice.findMany({
        where: { companyId, status: { in: ['FINANCE_POSTED', 'PAID'] } },
        select: {
          subcontractId: true,
          sequenceNumber: true,
          grossCumulativeAmount: true,
          retentionDeduction: true,
        },
        orderBy: { sequenceNumber: 'desc' },
      }),
      prisma.materialReconciliationLog.aggregate({
        where: { status: 'PENDING_DEDUCTION', subcontract: { companyId } },
        _count: true,
        _sum: { totalPenaltyAmount: true },
      }),
      prisma.subcontractInvoice.aggregate({
        where: {
          companyId,
          status: { in: ['FINANCE_POSTED', 'PAID'] },
          periodEndDate: { gte: q.start, lte: q.end },
        },
        _sum: { taxWithholdingDeduction: true },
      }),
      prisma.subcontract.findMany({
        where: { companyId },
        select: {
          id: true,
          subcontractNumber: true,
          totalContractValue: true,
          subcontractor: { select: { nameAr: true } },
          invoices: {
            where: { status: { in: ['FINANCE_POSTED', 'PAID'] } },
            select: { grossCurrentAmount: true },
          },
        },
        take: 40,
      }),
      prisma.materialReconciliationLog.findMany({
        where: { status: 'PENDING_DEDUCTION', subcontract: { companyId } },
        select: {
          id: true,
          totalPenaltyAmount: true,
          scrapExcessQty: true,
          updatedAt: true,
          subcontractId: true,
          subcontract: { select: { subcontractNumber: true } },
        },
        orderBy: { updatedAt: 'desc' },
        take: 8,
      }),
      prisma.subcontractInvoice.findMany({
        where: { companyId, status: { in: ['SITE_SUBMITTED', 'CONSULTANT_APPROVED', 'TECH_OFFICE_APPROVED'] } },
        select: {
          id: true,
          invoiceNumber: true,
          status: true,
          netPayableAmount: true,
          updatedAt: true,
          subcontractId: true,
          subcontract: { select: { subcontractNumber: true } },
        },
        orderBy: { updatedAt: 'desc' },
        take: 8,
      }),
    ]);

    const latestGross = new Map<string, Decimal>();
    let executed = moneyZero();
    let retentionHeld = moneyZero();
    for (const row of postedInvoices) {
      if (!latestGross.has(row.subcontractId)) {
        latestGross.set(row.subcontractId, money(row.grossCumulativeAmount));
      }
      retentionHeld = money(retentionHeld.plus(money(row.retentionDeduction)));
    }
    for (const value of latestGross.values()) {
      executed = money(executed.plus(value));
    }

    const committed = money(contractAgg._sum.totalContractValue ?? 0);
    const executionRatio = committed.gt(0) ? Number(executed.div(committed).toFixed(4)) : 0;

    const byStatus = Object.fromEntries(
      invoiceGroups.map((row) => [
        row.status,
        {
          count: row._count,
          gross: n(row._sum.grossCurrentAmount),
        },
      ])
    );

    const draftCount = byStatus.DRAFT?.count ?? 0;
    const sitePending = byStatus.SITE_SUBMITTED?.count ?? 0;
    const invoicedToDate = invoiceGroups
      .filter((row) => row.status === 'FINANCE_POSTED' || row.status === 'PAID')
      .reduce((acc, row) => acc + n(row._sum.grossCurrentAmount), 0);

    const approvalFunnel = PIPELINE.map((status) => ({
      status,
      count: byStatus[status]?.count ?? 0,
    }));

    const topSubcontractors = topContracts
      .map((row) => ({
        id: row.id,
        name: row.subcontractor.nameAr,
        contractNumber: row.subcontractNumber,
        invoiced: row.invoices.reduce((sum, inv) => sum + n(inv.grossCurrentAmount), 0),
      }))
      .sort((a, b) => b.invoiced - a.invoiced)
      .slice(0, 5);

    const inbox = [
      ...pendingRecon.map((log) => ({
        id: log.id,
        tone: 'red' as const,
        title: `هالك مواد بانتظار الخصم — ${log.subcontract.subcontractNumber}`,
        detail: `كمية زائدة ${Number(log.scrapExcessQty)}`,
        href: `/subcontracts/${log.subcontractId}`,
        amount: n(log.totalPenaltyAmount),
        at: log.updatedAt.toISOString(),
      })),
      ...waitingAudit.map((inv) => ({
        id: inv.id,
        tone:
          inv.status === 'TECH_OFFICE_APPROVED'
            ? ('blue' as const)
            : inv.status === 'SITE_SUBMITTED'
              ? ('amber' as const)
              : ('blue' as const),
        title:
          inv.status === 'TECH_OFFICE_APPROVED'
            ? `مستخلص ${inv.invoiceNumber} جاهز للترحيل`
            : `مستخلص ${inv.invoiceNumber} بانتظار المراجعة`,
        detail:
          inv.status === 'SITE_SUBMITTED'
            ? 'مقدّم من المهندس المقيم'
            : inv.status === 'TECH_OFFICE_APPROVED'
              ? 'معتمد من المكتب الفني — بانتظار الترحيل'
              : 'بانتظار المكتب الفني',
        href: `/subcontracts/${inv.subcontractId}`,
        amount: n(inv.netPayableAmount),
        at: inv.updatedAt.toISOString(),
      })),
    ]
      .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
      .slice(0, 8);

    const activity = waitingAudit.slice(0, 5).map((inv) => ({
      id: inv.id,
      title: `مستخلص باطن ${inv.invoiceNumber}`,
      detail: inv.subcontract.subcontractNumber,
      status: inv.status,
      href: `/subcontracts/${inv.subcontractId}`,
      at: inv.updatedAt.toISOString(),
    }));

    return {
      asOfDate: asOf.toISOString(),
      kpis: {
        activeSubcontracts: contractAgg._count,
        committedValue: n(committed),
        executedGross: n(executed),
        executionRatio,
        invoicedToDate,
        retentionHeld: n(retentionHeld),
        unappliedPenalties: n(pendingLogs._sum.totalPenaltyAmount),
        pendingMaterialLogs: pendingLogs._count,
        unpostedDrafts: draftCount,
        pendingSiteApprovals: sitePending,
        form41Withheld: n(form41._sum.taxWithholdingDeduction),
        form41Quarter: q.quarter,
        form41Year: q.year,
      },
      charts: {
        topSubcontractors,
        approvalFunnel,
      },
      inbox,
      activity,
    };
  }
}

export const subcontractDashboardService = new SubcontractDashboardService();
