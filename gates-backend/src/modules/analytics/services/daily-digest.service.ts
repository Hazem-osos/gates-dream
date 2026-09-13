import prisma from '../../../shared/database/prisma';
import { roundTo4 } from '../../../shared/utils/decimal-round';

export type DailyDigestTopItem = {
  itemId: string;
  itemName: string;
  quantity: number;
};

export type DailyDigestResult = {
  companyName: string;
  dateLabel: string;
  dailySales: {
    invoiceCount: number;
    gross: number;
    vat: number;
    net: number;
  };
  collectionsTotal: number;
  overdueDebtDueToday: number;
  chequesDueTomorrow: { count: number; total: number };
  topItems: DailyDigestTopItem[];
};

type PaymentSplitLine = { dueDate?: string; amount?: number };

function dayBounds(base: Date): { start: Date; end: Date } {
  const start = new Date(base);
  start.setHours(0, 0, 0, 0);
  const end = new Date(base);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function tomorrowBounds(from: Date): { start: Date; end: Date } {
  const start = new Date(from);
  start.setDate(start.getDate() + 1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function sameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function parseSplits(raw: unknown): PaymentSplitLine[] {
  if (!raw || !Array.isArray(raw)) return [];
  return raw as PaymentSplitLine[];
}

export class DailyDigestService {
  async getDailyDigest(params: {
    companyId: string;
    branchId?: string;
    date?: Date;
  }): Promise<DailyDigestResult> {
    const anchor = params.date ?? new Date();
    const { start: dayStart, end: dayEnd } = dayBounds(anchor);
    const { start: tmStart, end: tmEnd } = tomorrowBounds(anchor);

    const invoiceBase = {
      companyId: params.companyId,
      isPosted: true,
      isCancelled: false,
      ...(params.branchId ? { branchId: params.branchId } : {}),
    };

    const [company, settings, salesAgg, collectionsAgg, chequesAgg, topGroups, openSales] =
      await Promise.all([
        prisma.company.findUnique({
          where: { id: params.companyId },
          select: { arabicName: true },
        }),
        prisma.companySettings.findUnique({
          where: { companyId: params.companyId },
          select: { advancedSettings: true },
        }),
        prisma.invoice.aggregate({
          where: {
            ...invoiceBase,
            invoiceKind: 'SALE',
            date: { gte: dayStart, lte: dayEnd },
          },
          _count: true,
          _sum: { totalAmount: true, taxAmount: true, netAmount: true },
        }),
        prisma.cashTransaction.aggregate({
          where: {
            companyId: params.companyId,
            transactionKind: 'RECEIPT',
            isPosted: true,
            isCancelled: false,
            date: { gte: dayStart, lte: dayEnd },
            ...(params.branchId ? { branchId: params.branchId } : {}),
          },
          _sum: { amount: true },
        }),
        prisma.cheque.aggregate({
          where: {
            companyId: params.companyId,
            dueDate: { gte: tmStart, lte: tmEnd },
            status: { notIn: ['COLLECTED', 'CANCELLED', 'BOUNCED'] },
          },
          _sum: { amount: true },
          _count: true,
        }),
        prisma.invoiceLine.groupBy({
          by: ['itemId'],
          where: {
            invoice: {
              ...invoiceBase,
              invoiceKind: 'SALE',
              date: { gte: dayStart, lte: dayEnd },
            },
          },
          _sum: { quantity: true },
          orderBy: { _sum: { quantity: 'desc' } },
          take: 3,
        }),
        prisma.invoice.findMany({
          where: {
            ...invoiceBase,
            invoiceKind: 'SALE',
            remainingAmount: { gt: 0 },
            customerId: { not: null },
          },
          select: {
            id: true,
            date: true,
            remainingAmount: true,
            netAmount: true,
            paidAmount: true,
            paymentSplits: true,
          },
        }),
      ]);

    const adv = settings?.advancedSettings as Record<string, unknown> | null;
    const defaultCreditDays =
      typeof adv?.defaultCreditDays === 'number'
        ? adv.defaultCreditDays
        : typeof adv?.defaultCreditDays === 'string'
          ? Number(adv.defaultCreditDays) || 30
          : 30;

    let overdueDebtDueToday = 0;
    for (const inv of openSales) {
      const remaining = Number(inv.remainingAmount);
      if (remaining <= 0) continue;

      const splits = parseSplits(inv.paymentSplits);
      const splitsWithDue = splits.filter((s) => s.dueDate);
      if (splitsWithDue.length > 0) {
        for (const s of splitsWithDue) {
          const due = new Date(String(s.dueDate));
          if (sameCalendarDay(due, anchor)) {
            const amt = Number(s.amount ?? 0);
            overdueDebtDueToday = roundTo4(
              overdueDebtDueToday + (amt > 0 ? amt : remaining)
            );
          }
        }
      } else {
        const due = new Date(inv.date);
        due.setDate(due.getDate() + defaultCreditDays);
        if (sameCalendarDay(due, anchor)) {
          overdueDebtDueToday = roundTo4(overdueDebtDueToday + remaining);
        }
      }
    }

    const itemIds = topGroups.map((g) => g.itemId).filter(Boolean) as string[];
    const items =
      itemIds.length > 0
        ? await prisma.item.findMany({
            where: { id: { in: itemIds }, companyId: params.companyId },
            select: { id: true, arabicName: true },
          })
        : [];
    const nameById = new Map(items.map((i) => [i.id, i.arabicName]));

    const topItems: DailyDigestTopItem[] = topGroups
      .filter((g) => g.itemId)
      .map((g) => ({
        itemId: g.itemId!,
        itemName: nameById.get(g.itemId!) ?? '—',
        quantity: roundTo4(Number(g._sum?.quantity ?? 0)),
      }));

    const dateLabel = dayStart.toLocaleDateString('ar-EG', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    return {
      companyName: company?.arabicName ?? '—',
      dateLabel,
      dailySales: {
        invoiceCount: salesAgg._count,
        gross: roundTo4(Number(salesAgg._sum.totalAmount ?? 0)),
        vat: roundTo4(Number(salesAgg._sum.taxAmount ?? 0)),
        net: roundTo4(Number(salesAgg._sum.netAmount ?? 0)),
      },
      collectionsTotal: roundTo4(Number(collectionsAgg._sum.amount ?? 0)),
      overdueDebtDueToday,
      chequesDueTomorrow: {
        count: chequesAgg._count,
        total: roundTo4(Number(chequesAgg._sum.amount ?? 0)),
      },
      topItems,
    };
  }
}

export const dailyDigestService = new DailyDigestService();
