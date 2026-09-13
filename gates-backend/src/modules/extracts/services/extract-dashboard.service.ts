import type { Decimal } from '@prisma/client/runtime/library';
import prisma from '../../../shared/database/prisma';

function n(value: Decimal | number | null | undefined): number {
  return Number(Number(value ?? 0).toFixed(2));
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

export class ExtractDashboardService {
  async getSummary(companyId: string) {
    const asOf = new Date();
    const sixMonthsAgo = new Date(asOf);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);

    const projectScope = { companyId, isActive: true };

    const [
      projectAgg,
      contractorCount,
      assignmentCount,
      extractGroups,
      postedExtractAgg,
      draftExtracts,
      paymentAgg,
      pendingPayments,
      topProjectsRaw,
      recentExtracts,
      recentPayments,
      monthlyExtracts,
    ] = await Promise.all([
      prisma.project.aggregate({
        where: projectScope,
        _count: true,
        _sum: { totalValue: true },
      }),
      prisma.contractor.count({ where: { companyId, isActive: true } }),
      prisma.contractorAssignment.count({ where: { project: { companyId } } }),
      prisma.extract.groupBy({
        by: ['isPosted', 'isCancelled'],
        where: { project: { companyId } },
        _count: true,
        _sum: { netWorkValue: true, totalValue: true },
      }),
      prisma.extract.aggregate({
        where: { project: { companyId }, isPosted: true, isCancelled: false },
        _count: true,
        _sum: { netWorkValue: true, totalValue: true },
      }),
      prisma.extract.findMany({
        where: { project: { companyId }, isPosted: false, isCancelled: false },
        select: {
          id: true,
          extractNumber: true,
          extractDate: true,
          netWorkValue: true,
          totalValue: true,
          updatedAt: true,
          projectId: true,
          project: { select: { arabicName: true, serial: true } },
          contractor: { select: { arabicName: true } },
        },
        orderBy: { updatedAt: 'desc' },
        take: 8,
      }),
      prisma.extractPayment.aggregate({
        where: { project: { companyId }, isPosted: true },
        _count: true,
        _sum: { paymentAmount: true },
      }),
      prisma.extractPayment.findMany({
        where: { project: { companyId }, isPosted: false },
        select: {
          id: true,
          paymentNumber: true,
          paymentAmount: true,
          paymentDate: true,
          updatedAt: true,
          projectId: true,
          project: { select: { arabicName: true } },
          contractor: { select: { arabicName: true } },
        },
        orderBy: { updatedAt: 'desc' },
        take: 8,
      }),
      prisma.project.findMany({
        where: { companyId },
        select: {
          id: true,
          arabicName: true,
          serial: true,
          extracts: {
            where: { isPosted: true, isCancelled: false },
            select: { netWorkValue: true, totalValue: true },
          },
        },
        take: 40,
      }),
      prisma.extract.findMany({
        where: { project: { companyId }, isCancelled: false },
        select: {
          id: true,
          extractNumber: true,
          isPosted: true,
          extractDate: true,
          updatedAt: true,
          projectId: true,
          project: { select: { arabicName: true, serial: true } },
        },
        orderBy: { updatedAt: 'desc' },
        take: 6,
      }),
      prisma.extractPayment.findMany({
        where: { project: { companyId }, isPosted: true },
        select: {
          id: true,
          paymentNumber: true,
          paymentAmount: true,
          paymentDate: true,
          projectId: true,
          project: { select: { arabicName: true } },
        },
        orderBy: { paymentDate: 'desc' },
        take: 6,
      }),
      prisma.extract.findMany({
        where: {
          project: { companyId },
          isPosted: true,
          isCancelled: false,
          extractDate: { gte: sixMonthsAgo },
        },
        select: { extractDate: true, netWorkValue: true, totalValue: true },
      }),
    ]);

    let draftCount = 0;
    let cancelledCount = 0;
    let postedCount = 0;
    for (const row of extractGroups) {
      if (row.isCancelled) {
        cancelledCount += row._count;
      } else if (row.isPosted) {
        postedCount += row._count;
      } else {
        draftCount += row._count;
      }
    }

    const postedNet = n(postedExtractAgg._sum.netWorkValue ?? postedExtractAgg._sum.totalValue);
    const paidTotal = n(paymentAgg._sum.paymentAmount);
    const portfolioValue = n(projectAgg._sum.totalValue);

    const topProjects = topProjectsRaw
      .map((row) => ({
        id: row.id,
        name: row.arabicName,
        serial: row.serial,
        invoiced: row.extracts.reduce(
          (sum, ex) => sum + n(ex.netWorkValue ?? ex.totalValue),
          0
        ),
      }))
      .filter((row) => row.invoiced > 0)
      .sort((a, b) => b.invoiced - a.invoiced)
      .slice(0, 5);

    const monthlyMap = new Map<string, number>();
    for (let i = 0; i < 6; i++) {
      const d = new Date(asOf);
      d.setMonth(d.getMonth() - (5 - i));
      monthlyMap.set(monthKey(d), 0);
    }
    for (const row of monthlyExtracts) {
      const key = monthKey(row.extractDate);
      if (!monthlyMap.has(key)) continue;
      monthlyMap.set(key, (monthlyMap.get(key) ?? 0) + n(row.netWorkValue ?? row.totalValue));
    }
    const monthlyBilling = [...monthlyMap.entries()].map(([key, value]) => ({
      name: monthLabel(key),
      billed: value,
      budget: 0,
    }));

    const statusFunnel = [
      { label: 'مسودة', value: draftCount },
      { label: 'مرحّل', value: postedCount },
      { label: 'ملغى', value: cancelledCount },
    ].filter((row) => row.value > 0);

    const inbox = [
      ...draftExtracts.map((ex) => ({
        id: ex.id,
        tone: 'amber' as const,
        title: `مستخلص ${ex.extractNumber ?? 'بدون رقم'} — ${ex.project.arabicName}`,
        detail: ex.contractor?.arabicName
          ? `مقاول: ${ex.contractor.arabicName} · بانتظار الترحيل`
          : 'مسودة بانتظار الترحيل',
        href: `/extracts/operations/projects/make-extract?projectId=${ex.projectId}`,
        amount: n(ex.netWorkValue ?? ex.totalValue),
        at: ex.updatedAt.toISOString(),
      })),
      ...pendingPayments.map((pay) => ({
        id: pay.id,
        tone: 'blue' as const,
        title: `سداد ${pay.paymentNumber ?? '—'} — ${pay.project.arabicName}`,
        detail: pay.contractor?.arabicName
          ? `مقاول: ${pay.contractor.arabicName} · بانتظار الترحيل`
          : 'دفعة بانتظار الترحيل',
        href: '/extracts/operations/extract-payment',
        amount: n(pay.paymentAmount),
        at: pay.updatedAt.toISOString(),
      })),
    ]
      .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
      .slice(0, 8);

    const activity = [
      ...recentExtracts.map((ex) => ({
        id: ex.id,
        title: `مستخلص ${ex.extractNumber ?? '—'}`,
        detail: ex.project.arabicName,
        status: ex.isPosted ? 'FINANCE_POSTED' : 'DRAFT',
        href: `/extracts/operations/projects/make-extract?projectId=${ex.projectId}`,
        at: ex.updatedAt.toISOString(),
      })),
      ...recentPayments.map((pay) => ({
        id: pay.id,
        title: `سداد ${pay.paymentNumber ?? '—'}`,
        detail: pay.project.arabicName,
        status: 'PAID',
        href: '/extracts/operations/extract-payment',
        at: pay.paymentDate.toISOString(),
      })),
    ]
      .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
      .slice(0, 6);

    return {
      asOfDate: asOf.toISOString(),
      kpis: {
        activeProjects: projectAgg._count,
        portfolioValue,
        activeContractors: contractorCount,
        workItemAssignments: assignmentCount,
        draftExtracts: draftCount,
        postedExtracts: postedCount,
        postedNetValue: postedNet,
        totalPaid: paidTotal,
        outstandingPayable: Math.max(0, postedNet - paidTotal),
        pendingPayments: pendingPayments.length,
      },
      charts: {
        topProjects,
        statusFunnel,
        monthlyBilling,
      },
      inbox,
      activity,
    };
  }
}

export const extractDashboardService = new ExtractDashboardService();
