import type { Decimal } from '@prisma/client/runtime/library';
import prisma from '../../../shared/database/prisma';
import { money, moneyZero } from '../utils/money-decimal';

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

const OPEN_RESERVATIONS = ['PENDING', 'CONFIRMED'] as const;
const OPEN_INSTALLMENTS = ['PENDING', 'UNPAID', 'PARTIALLY_PAID', 'OVERDUE'] as const;

export class RealEstateInvestmentDashboardService {
  async getSummary(companyId: string) {
    const asOf = new Date();
    const startToday = new Date(asOf.getFullYear(), asOf.getMonth(), asOf.getDate());
    const in7Days = new Date(startToday);
    in7Days.setDate(in7Days.getDate() + 7);
    const sixMonthsAgo = new Date(asOf.getFullYear(), asOf.getMonth() - 5, 1);

    const [
      reservationGroups,
      reservationAmount,
      expiringReservations,
      units,
      unitValue,
      projectCount,
      customerCount,
      followupDue,
      followupOpen,
      recentReservations,
      monthlyReservations,
      overdueFollowups,
      stackingUnits,
      expiring48h,
      weekInstallments,
    ] = await Promise.all([
      prisma.realEstateReservation.groupBy({
        by: ['status'],
        where: { companyId },
        _count: true,
        _sum: { reservationAmount: true },
      }),
      prisma.realEstateReservation.aggregate({
        where: { companyId, status: { in: [...OPEN_RESERVATIONS] } },
        _count: true,
        _sum: { reservationAmount: true },
      }),
      prisma.realEstateReservation.findMany({
        where: {
          companyId,
          status: 'PENDING',
          expiryDate: { gte: startToday, lte: in7Days },
        },
        select: {
          id: true,
          reservationAmount: true,
          expiryDate: true,
          updatedAt: true,
          unit: { select: { unitCode: true } },
          customer: { select: { arabicName: true } },
        },
        orderBy: { expiryDate: 'asc' },
        take: 8,
      }),
      prisma.realEstateUnit.groupBy({
        by: ['status'],
        where: { building: { project: { companyId } } },
        _count: true,
        _sum: { totalPrice: true },
      }),
      prisma.realEstateUnit.aggregate({
        where: { building: { project: { companyId } }, status: 'AVAILABLE' },
        _count: true,
        _sum: { totalPrice: true },
      }),
      prisma.realEstateProject.count({ where: { companyId } }),
      prisma.customer.count({ where: { companyId, deletedAt: null, isActive: true } }),
      prisma.customerFollowup.count({
        where: {
          companyId,
          status: { notIn: ['completed', 'cancelled', 'COMPLETED', 'CANCELLED'] },
          OR: [{ nextFollowupDate: { lte: startToday } }, { nextFollowupDate: null, followupDate: { lte: startToday } }],
        },
      }),
      prisma.customerFollowup.count({
        where: {
          companyId,
          status: { notIn: ['completed', 'cancelled', 'COMPLETED', 'CANCELLED'] },
        },
      }),
      prisma.realEstateReservation.findMany({
        where: { companyId },
        select: {
          id: true,
          status: true,
          reservationDate: true,
          reservationAmount: true,
          updatedAt: true,
          unit: { select: { unitCode: true } },
          customer: { select: { arabicName: true } },
        },
        orderBy: { updatedAt: 'desc' },
        take: 8,
      }),
      prisma.realEstateReservation.findMany({
        where: { companyId, reservationDate: { gte: sixMonthsAgo } },
        select: { reservationDate: true, reservationAmount: true, status: true },
      }),
      prisma.customerFollowup.findMany({
        where: {
          companyId,
          status: { notIn: ['completed', 'cancelled', 'COMPLETED', 'CANCELLED'] },
          OR: [{ nextFollowupDate: { lte: startToday } }, { nextFollowupDate: null, followupDate: { lte: startToday } }],
        },
        select: {
          id: true,
          followupDate: true,
          nextFollowupDate: true,
          followupType: true,
          updatedAt: true,
          customer: { select: { arabicName: true } },
        },
        orderBy: { followupDate: 'asc' },
        take: 6,
      }),
      prisma.realEstateUnit.findMany({
        where: { building: { project: { companyId } } },
        select: {
          id: true,
          unitCode: true,
          floor: true,
          netArea: true,
          totalPrice: true,
          status: true,
          building: {
            select: {
              id: true,
              name: true,
              buildingCode: true,
              totalFloors: true,
              project: { select: { projectName: true } },
            },
          },
          reservations: {
            where: { status: { in: ['PENDING', 'CONFIRMED'] } },
            select: {
              id: true,
              expiryDate: true,
              status: true,
              reservationAmount: true,
              customer: { select: { arabicName: true } },
            },
            orderBy: { expiryDate: 'asc' },
            take: 1,
          },
        },
        orderBy: [{ building: { buildingCode: 'asc' } }, { floor: 'desc' }, { unitCode: 'asc' }],
        take: 800,
      }),
      prisma.realEstateReservation.findMany({
        where: {
          companyId,
          status: { in: ['PENDING', 'CONFIRMED'] },
          expiryDate: { gte: startToday, lte: new Date(startToday.getTime() + 48 * 3600_000) },
        },
        select: {
          id: true,
          reservationAmount: true,
          expiryDate: true,
          status: true,
          unit: { select: { unitCode: true } },
          customer: { select: { arabicName: true } },
        },
        orderBy: { expiryDate: 'asc' },
        take: 20,
      }),
      prisma.unitInstallment.findMany({
        where: {
          contract: { companyId, status: { in: ['ACTIVE', 'RESALE_IN_PROGRESS'] } },
          status: { in: [...OPEN_INSTALLMENTS] },
          dueDate: { gte: startToday, lte: in7Days },
        },
        select: {
          id: true,
          installmentNumber: true,
          dueDate: true,
          amount: true,
          balance: true,
          status: true,
          contractId: true,
          contract: {
            select: {
              contractNumber: true,
              customer: { select: { arabicName: true } },
              unit: { select: { unitCode: true } },
            },
          },
        },
        orderBy: { dueDate: 'asc' },
        take: 40,
      }),
    ]);

    const reservationByStatus = Object.fromEntries(
      reservationGroups.map((row) => [row.status.toUpperCase(), { count: row._count, value: n(row._sum.reservationAmount) }])
    );
    const unitCounts = Object.fromEntries(units.map((row) => [row.status, row._count]));
    const unitValues = Object.fromEntries(units.map((row) => [row.status, n(row._sum.totalPrice)]));
    const sold = (unitCounts.SOLD ?? 0) + (unitCounts.DELIVERED ?? 0) + (unitCounts.CONTRACTED ?? 0);
    const available = unitCounts.AVAILABLE ?? 0;
    const reserved = unitCounts.RESERVED ?? 0;
    const totalUnits = units.reduce((sum, row) => sum + row._count, 0);

    const monthKeys: string[] = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date(asOf.getFullYear(), asOf.getMonth() - 5 + i, 1);
      monthKeys.push(monthKey(d));
    }
    const reservedMap = new Map<string, Decimal>();
    const confirmedMap = new Map<string, Decimal>();
    for (const key of monthKeys) {
      reservedMap.set(key, moneyZero());
      confirmedMap.set(key, moneyZero());
    }
    for (const row of monthlyReservations) {
      const key = monthKey(row.reservationDate);
      if (!reservedMap.has(key)) continue;
      reservedMap.set(
        key,
        money((reservedMap.get(key) ?? moneyZero()).plus(money(row.reservationAmount ?? 0)))
      );
      if (row.status.toUpperCase() === 'CONFIRMED') {
        confirmedMap.set(
          key,
          money((confirmedMap.get(key) ?? moneyZero()).plus(money(row.reservationAmount ?? 0)))
        );
      }
    }

    const inbox = [
      ...expiringReservations.map((row) => ({
        id: row.id,
        tone: 'amber' as const,
        title: `حجز ينتهي قريباً — ${row.unit.unitCode}`,
        detail: row.customer.arabicName ? `عميل: ${row.customer.arabicName}` : 'بانتظار التأكيد أو الإقفال',
        href: '/real-estate-investment/operations/reservation',
        amount: n(row.reservationAmount),
        at: (row.expiryDate ?? row.updatedAt).toISOString(),
      })),
      ...overdueFollowups.map((row) => ({
        id: row.id,
        tone: 'red' as const,
        title: `متابعة متأخرة — ${row.customer.arabicName}`,
        detail: row.followupType ? `نوع: ${row.followupType}` : 'بانتظار إجراء المتابعة',
        href: '/real-estate-investment/reports/customer-followup',
        at: (row.nextFollowupDate ?? row.followupDate).toISOString(),
      })),
    ]
      .sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
      .slice(0, 8);

    const activity = recentReservations.map((row) => ({
      id: row.id,
      title: `حجز ${row.unit.unitCode}`,
      detail: row.customer.arabicName ?? '—',
      status: row.status,
      href: '/real-estate-investment/operations/reservation',
      at: row.updatedAt.toISOString(),
    }));

    const buildingsMap = new Map<
      string,
      {
        id: string;
        name: string;
        projectName: string;
        totalFloors: number;
        units: Array<{
          id: string;
          unitCode: string;
          floor: number;
          netArea: number;
          totalPrice: number;
          status: string;
          reservation: {
            id: string;
            expiryDate: string | null;
            customerName: string;
            status: string;
            reservationAmount: number;
          } | null;
        }>;
      }
    >();
    for (const u of stackingUnits) {
      const bid = u.building.id;
      if (!buildingsMap.has(bid)) {
        buildingsMap.set(bid, {
          id: bid,
          name: u.building.name || u.building.buildingCode,
          projectName: u.building.project.projectName,
          totalFloors: u.building.totalFloors,
          units: [],
        });
      }
      const openRes = u.reservations[0];
      buildingsMap.get(bid)!.units.push({
        id: u.id,
        unitCode: u.unitCode,
        floor: u.floor,
        netArea: n(u.netArea),
        totalPrice: n(u.totalPrice),
        status: u.status,
        reservation: openRes
          ? {
              id: openRes.id,
              expiryDate: openRes.expiryDate?.toISOString() ?? null,
              customerName: openRes.customer.arabicName,
              status: openRes.status,
              reservationAmount: n(openRes.reservationAmount),
            }
          : null,
      });
    }

    const thisMonth = monthKeys[monthKeys.length - 1];
    const collectionGauge = {
      expected: n(reservedMap.get(thisMonth)),
      collected: n(confirmedMap.get(thisMonth)),
      weekDue: weekInstallments.reduce((s, r) => s + n(r.balance ?? r.amount), 0),
    };

    return {
      asOfDate: asOf.toISOString(),
      kpis: {
        projects: projectCount,
        customers: customerCount,
        unitsTotal: totalUnits,
        unitsAvailable: available,
        unitsReserved: reserved,
        unitsSold: sold,
        availableInventoryValue: n(unitValue._sum.totalPrice),
        openReservations: reservationAmount._count,
        openReservationValue: n(reservationAmount._sum.reservationAmount),
        pendingReservations: reservationByStatus.PENDING?.count ?? 0,
        confirmedReservations: reservationByStatus.CONFIRMED?.count ?? 0,
        expiringReservations: expiringReservations.length,
        openFollowups: followupOpen,
        overdueFollowups: followupDue,
      },
      inventory: [
        { key: 'AVAILABLE', label: 'متاح', value: available },
        { key: 'RESERVED', label: 'محجوز', value: reserved },
        { key: 'SOLD', label: 'متعاقد', value: sold },
      ],
      reservationFunnel: [
        { label: 'قيد الانتظار', value: reservationByStatus.PENDING?.count ?? 0 },
        { label: 'مؤكد', value: reservationByStatus.CONFIRMED?.count ?? 0 },
        { label: 'منتهٍ', value: reservationByStatus.EXPIRED?.count ?? 0 },
        { label: 'ملغى', value: reservationByStatus.CANCELLED?.count ?? 0 },
      ].filter((row) => row.value > 0),
      charts: {
        monthlyReservations: monthKeys.map((key) => ({
          name: monthLabel(key),
          reserved: n(reservedMap.get(key)),
          confirmed: n(confirmedMap.get(key)),
        })),
        unitValueByStatus: [
          { key: 'AVAILABLE', label: 'متاح', value: unitValues.AVAILABLE ?? 0 },
          { key: 'RESERVED', label: 'محجوز', value: unitValues.RESERVED ?? 0 },
          { key: 'SOLD', label: 'متعاقد', value: (unitValues.SOLD ?? 0) + (unitValues.DELIVERED ?? 0) },
        ].filter((row) => row.value > 0),
      },
      inbox,
      activity,
      stacking: [...buildingsMap.values()],
      expiring48h: expiring48h.map((row) => ({
        id: row.id,
        unitCode: row.unit.unitCode,
        customerName: row.customer.arabicName,
        expiryDate: row.expiryDate?.toISOString() ?? null,
        amount: n(row.reservationAmount),
        status: row.status,
      })),
      weekInstallments: weekInstallments.map((row) => ({
        id: row.id,
        contractId: row.contractId,
        contractNumber: row.contract.contractNumber,
        customerName: row.contract.customer.arabicName,
        unitCode: row.contract.unit.unitCode,
        installmentNumber: row.installmentNumber,
        dueDate: row.dueDate.toISOString(),
        amount: n(row.amount),
        balance: n(row.balance),
        status: row.status,
      })),
      collectionGauge,
    };
  }
}

export const realEstateInvestmentDashboardService = new RealEstateInvestmentDashboardService();
