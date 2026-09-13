import type { Decimal } from '@prisma/client/runtime/library';
import prisma from '../../../shared/database/prisma';
import { money, moneyZero } from '../utils/money-decimal';

const OPEN_INSTALLMENTS = ['PENDING', 'UNPAID', 'PARTIALLY_PAID', 'OVERDUE'] as const;

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

export class RealEstateDashboardService {
  async getSummary(companyId: string) {
    const asOf = new Date();
    const startToday = new Date(asOf.getFullYear(), asOf.getMonth(), asOf.getDate());
    const days60 = new Date(startToday);
    days60.setDate(days60.getDate() - 60);
    const horizonStart = new Date(asOf.getFullYear(), asOf.getMonth() - 2, 1);
    const horizonEnd = new Date(asOf.getFullYear(), asOf.getMonth() + 4, 0, 23, 59, 59, 999);

    const [
      contracts,
      units,
      installmentAgg,
      overdueAgg,
      overdue60,
      cheques,
      resalePending,
      bounced,
      overdueRows,
      resaleRows,
    ] = await Promise.all([
      prisma.unitContract.aggregate({
        where: { companyId, status: { in: ['ACTIVE', 'RESALE_IN_PROGRESS', 'COMPLETED'] } },
        _count: true,
        _sum: { totalContractAmount: true, totalSellingPrice: true, outstandingArBalance: true },
      }),
      prisma.realEstateUnit.groupBy({
        by: ['status'],
        where: { building: { project: { companyId } } },
        _count: true,
      }),
      prisma.unitInstallment.aggregate({
        where: { contract: { companyId } },
        _sum: { amount: true, paidAmount: true, balance: true, accumulatedLateFee: true },
      }),
      prisma.unitInstallment.aggregate({
        where: {
          contract: { companyId },
          status: { in: [...OPEN_INSTALLMENTS] },
          dueDate: { lt: startToday },
        },
        _count: true,
        _sum: { balance: true, accumulatedLateFee: true },
      }),
      prisma.unitInstallment.aggregate({
        where: {
          contract: { companyId },
          status: { in: [...OPEN_INSTALLMENTS] },
          dueDate: { lt: days60 },
        },
        _count: true,
        _sum: { balance: true },
      }),
      prisma.postDatedCheque.groupBy({
        by: ['status'],
        where: { companyId },
        _count: true,
        _sum: { amount: true },
      }),
      prisma.unitResaleTransfer.aggregate({
        where: { contract: { companyId }, clearanceStatus: 'PENDING_CLEARANCE' },
        _count: true,
        _sum: { assignmentFeeAmount: true },
      }),
      prisma.postDatedCheque.findMany({
        where: { companyId, status: 'BOUNCED_RETURNED' },
        select: {
          id: true,
          chequeNumber: true,
          amount: true,
          updatedAt: true,
          unitContractId: true,
        },
        orderBy: { updatedAt: 'desc' },
        take: 6,
      }),
      prisma.unitInstallment.findMany({
        where: {
          contract: { companyId },
          status: { in: [...OPEN_INSTALLMENTS] },
          dueDate: { lt: days60 },
        },
        select: {
          id: true,
          installmentNumber: true,
          balance: true,
          accumulatedLateFee: true,
          dueDate: true,
          contractId: true,
          contract: { select: { contractNumber: true } },
        },
        orderBy: { dueDate: 'asc' },
        take: 6,
      }),
      prisma.unitResaleTransfer.findMany({
        where: { contract: { companyId }, clearanceStatus: 'PENDING_CLEARANCE' },
        select: {
          id: true,
          assignmentFeeAmount: true,
          updatedAt: true,
          unitContractId: true,
          contract: { select: { contractNumber: true } },
        },
        orderBy: { updatedAt: 'desc' },
        take: 4,
      }),
    ]);

    const [monthInstallments, monthCheques, resaleInProgress] = await Promise.all([
      prisma.unitInstallment.findMany({
        where: {
          contract: { companyId },
          dueDate: { gte: horizonStart, lte: horizonEnd },
          status: { notIn: ['CANCELLED'] },
        },
        select: { dueDate: true, amount: true, paidAmount: true },
      }),
      prisma.postDatedCheque.findMany({
        where: {
          companyId,
          status: 'CLEARED_COLLECTED',
          collectionDate: { gte: horizonStart, lte: horizonEnd },
        },
        select: { collectionDate: true, amount: true },
      }),
      prisma.unitContract.count({ where: { companyId, status: 'RESALE_IN_PROGRESS' } }),
    ]);

    const unitCounts = Object.fromEntries(units.map((row) => [row.status, row._count]));
    const sold = (unitCounts.SOLD ?? 0) + (unitCounts.DELIVERED ?? 0);
    const available = unitCounts.AVAILABLE ?? 0;
    const reserved = unitCounts.RESERVED ?? 0;
    const totalUnits = units.reduce((sum, row) => sum + row._count, 0);

    const chequeMap = Object.fromEntries(
      cheques.map((row) => [row.status, { count: row._count, value: n(row._sum.amount) }])
    );

    const monthKeys: string[] = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date(asOf.getFullYear(), asOf.getMonth() - 2 + i, 1);
      monthKeys.push(monthKey(d));
    }
    const expected = new Map<string, Decimal>();
    const collected = new Map<string, Decimal>();
    for (const key of monthKeys) {
      expected.set(key, moneyZero());
      collected.set(key, moneyZero());
    }
    for (const row of monthInstallments) {
      const key = monthKey(row.dueDate);
      if (!expected.has(key)) continue;
      expected.set(key, money((expected.get(key) ?? moneyZero()).plus(money(row.amount))));
    }
    for (const row of monthCheques) {
      if (!row.collectionDate) continue;
      const key = monthKey(row.collectionDate);
      if (!collected.has(key)) continue;
      collected.set(key, money((collected.get(key) ?? moneyZero()).plus(money(row.amount))));
    }

    const monthlyCash = monthKeys.map((key) => ({
      name: monthLabel(key),
      expected: n(expected.get(key)),
      collected: n(collected.get(key)),
    }));

    const installmentDue = money(installmentAgg._sum.amount ?? 0);
    const installmentPaid = money(installmentAgg._sum.paidAmount ?? 0);
    const collectionRatio = installmentDue.gt(0)
      ? Number(installmentPaid.div(installmentDue).toFixed(4))
      : 0;

    const inbox = [
      ...bounced.map((ch) => ({
        id: ch.id,
        tone: 'red' as const,
        title: `شيك مرتد ${ch.chequeNumber}`,
        detail: 'يتطلب إعادة إصدار أو إجراء قانوني',
        href: '/real-estate/cheques',
        amount: n(ch.amount),
        at: ch.updatedAt.toISOString(),
      })),
      ...overdueRows.map((row) => ({
        id: row.id,
        tone: 'amber' as const,
        title: `قسط متأخر +60 يوم — ${row.contract.contractNumber}`,
        detail: `قسط رقم ${row.installmentNumber}`,
        href: `/real-estate/contracts/${row.contractId}`,
        amount: n(money(row.balance).plus(money(row.accumulatedLateFee))),
        at: row.dueDate.toISOString(),
      })),
      ...resaleRows.map((row) => ({
        id: row.id,
        tone: 'blue' as const,
        title: `تنازل بانتظار رسوم التحويل — ${row.contract.contractNumber}`,
        detail: 'RESALE_IN_PROGRESS',
        href: '/real-estate/resale',
        amount: n(row.assignmentFeeAmount),
        at: row.updatedAt.toISOString(),
      })),
    ]
      .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
      .slice(0, 8);

    const activity = [...bounced, ...resaleRows]
      .sort((a, b) => Date.parse(b.updatedAt.toISOString()) - Date.parse(a.updatedAt.toISOString()))
      .slice(0, 5)
      .map((row) =>
        'chequeNumber' in row
          ? {
              id: row.id,
              title: `شيك ${row.chequeNumber}`,
              detail: 'ارتداد من البنك',
              status: 'BOUNCED_RETURNED',
              href: '/real-estate/cheques',
              at: row.updatedAt.toISOString(),
            }
          : {
              id: row.id,
              title: `تنازل ${row.contract.contractNumber}`,
              detail: 'بانتظار سداد رسوم التنازل',
              status: 'PENDING_CLEARANCE',
              href: '/real-estate/resale',
              at: row.updatedAt.toISOString(),
            }
      );

    return {
      asOfDate: asOf.toISOString(),
      kpis: {
        portfolioSales: n(contracts._sum.totalSellingPrice ?? contracts._sum.totalContractAmount),
        cashCollected: n(installmentPaid),
        collectionRatio,
        overdueCount: overdueAgg._count,
        overdueDebt: n(overdueAgg._sum.balance),
        lateFees: n(overdueAgg._sum.accumulatedLateFee ?? installmentAgg._sum.accumulatedLateFee),
        overdueOver60Count: overdue60._count,
        overdueOver60Debt: n(overdue60._sum.balance),
        chequesUnderCollection: chequeMap.DEPOSITED_UNDER_COLLECTION?.value ?? 0,
        unitsSold: sold,
        unitsAvailable: available,
        unitsReserved: reserved,
        unitsTotal: totalUnits,
        resaleInProgress,
        resalePendingClearance: resalePending._count,
      },
      cheques: {
        custody: chequeMap.UNDER_SAFE_CUSTODY ?? { count: 0, value: 0 },
        underCollection: chequeMap.DEPOSITED_UNDER_COLLECTION ?? { count: 0, value: 0 },
        cleared: chequeMap.CLEARED_COLLECTED ?? { count: 0, value: 0 },
        bounced: chequeMap.BOUNCED_RETURNED ?? { count: 0, value: 0 },
      },
      inventory: [
        { key: 'AVAILABLE', label: 'متاح', value: available },
        { key: 'RESERVED', label: 'محجوز', value: reserved },
        { key: 'SOLD', label: 'متعاقد', value: sold },
        { key: 'RESALE', label: 'تنازل', value: resaleInProgress },
      ],
      charts: { monthlyCash },
      inbox,
      activity,
    };
  }
}

export const realEstateDashboardService = new RealEstateDashboardService();
