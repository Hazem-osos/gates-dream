import prisma from '../../../shared/database/prisma';
import { asMoney } from '../money';

export class GrowthImpactService {
  async reconcile(companyId: string) {
    const actioned = await prisma.growthOpportunity.findMany({
      where: { companyId, status: { in: ['ACTION_TAKEN', 'WON'] } },
    });

    for (const opp of actioned) {
      if (opp.type === 'overdue-receivable' && opp.entityId) {
        const invoices = await prisma.invoice.findMany({
          where: {
            companyId,
            customerId: opp.entityId,
            invoiceKind: 'SALE',
            isPosted: true,
            isCancelled: false,
            date: { lte: opp.createdAt },
          },
          select: { id: true, invoiceNumber: true, remainingAmount: true, paidAmount: true, netAmount: true },
        });
        const allocations = await prisma.paymentAllocation.findMany({
          where: {
            companyId,
            invoiceId: { in: invoices.map((i) => i.id) },
            createdAt: { gte: opp.actionedAt ?? opp.createdAt },
            cashTransaction: { isPosted: true },
          },
          select: { id: true, invoiceId: true, allocatedAmount: true },
        });
        for (const alloc of allocations) {
          await prisma.growthAttribution.upsert({
            where: {
              companyId_opportunityId_entityType_entityId: {
                companyId,
                opportunityId: opp.id,
                entityType: 'payment-allocation',
                entityId: alloc.id,
              },
            },
            create: {
              companyId,
              opportunityId: opp.id,
              kind: 'CASH_RECOVERED',
              entityType: 'payment-allocation',
              entityId: alloc.id,
              amount: asMoney(alloc.allocatedAmount),
              label: 'تحصيل بعد متابعة الفرصة',
              isRealized: true,
            },
            update: { amount: asMoney(alloc.allocatedAmount), isRealized: true },
          });
        }
      }

      if (
        (opp.type === 'inactive-customer' || opp.type === 'cross-sell' || opp.type === 'upsell') &&
        opp.entityId
      ) {
        const laterSales = await prisma.invoice.findMany({
          where: {
            companyId,
            customerId: opp.entityId,
            invoiceKind: 'SALE',
            isPosted: true,
            isCancelled: false,
            date: { gt: opp.actionedAt ?? opp.createdAt },
          },
          select: { id: true, invoiceNumber: true, netAmount: true },
          take: 8,
        });
        for (const inv of laterSales) {
          await prisma.growthAttribution.upsert({
            where: {
              companyId_opportunityId_entityType_entityId: {
                companyId,
                opportunityId: opp.id,
                entityType: 'invoice',
                entityId: inv.id,
              },
            },
            create: {
              companyId,
              opportunityId: opp.id,
              kind: 'INFLUENCED_REVENUE',
              entityType: 'invoice',
              entityId: inv.id,
              amount: asMoney(inv.netAmount),
              label: `فاتورة لاحقة ${inv.invoiceNumber || ''}`.trim(),
              isRealized: true,
            },
            update: { amount: asMoney(inv.netAmount), isRealized: true },
          });
        }
      }

      if ((opp.type === 'slow-inventory' || opp.type === 'dead-inventory') && opp.entityId) {
        const laterLines = await prisma.invoiceLine.findMany({
          where: {
            itemId: opp.entityId,
            invoice: {
              companyId,
              invoiceKind: 'SALE',
              isPosted: true,
              isCancelled: false,
              date: { gt: opp.actionedAt ?? opp.createdAt },
            },
          },
          select: {
            id: true,
            quantity: true,
            unitCostAtIssue: true,
            invoice: { select: { invoiceNumber: true } },
          },
          take: 20,
        });
        for (const line of laterLines) {
          const recovered = asMoney(line.unitCostAtIssue) * asMoney(line.quantity);
          if (recovered < 1) continue;
          await prisma.growthAttribution.upsert({
            where: {
              companyId_opportunityId_entityType_entityId: {
                companyId,
                opportunityId: opp.id,
                entityType: 'invoice-line',
                entityId: line.id,
              },
            },
            create: {
              companyId,
              opportunityId: opp.id,
              kind: 'INVENTORY_RECOVERED',
              entityType: 'invoice-line',
              entityId: line.id,
              amount: recovered,
              label: `تصريف مخزون بعد الإجراء ${line.invoice.invoiceNumber || ''}`.trim(),
              isRealized: true,
            },
            update: { amount: recovered, isRealized: true },
          });
        }
      }

      const realized = await prisma.growthAttribution.aggregate({
        where: { companyId, opportunityId: opp.id, isRealized: true },
        _sum: { amount: true },
      });
      await prisma.growthOpportunity.update({
        where: { id: opp.id },
        data: { realizedValue: asMoney(realized._sum.amount) },
      });
    }
  }

  async getImpact(companyId: string) {
    await this.reconcile(companyId);
    const rows = await prisma.growthOpportunity.findMany({ where: { companyId } });
    const attributions = await prisma.growthAttribution.findMany({
      where: { companyId, isRealized: true },
    });

    const potential = rows
      .filter((r) => !['DISMISSED', 'EXPIRED', 'LOST'].includes(r.status))
      .reduce((s, r) => s + asMoney(r.estimatedValue), 0);
    const actioned = rows
      .filter((r) => r.status === 'ACTION_TAKEN' || r.status === 'WON')
      .reduce((s, r) => s + asMoney(r.actionedValue || r.estimatedValue), 0);

    let cashRecovered = 0;
    let influencedRevenue = 0;
    let inventoryRecovered = 0;
    for (const a of attributions) {
      if (a.kind === 'CASH_RECOVERED') cashRecovered += asMoney(a.amount);
      if (a.kind === 'INFLUENCED_REVENUE') influencedRevenue += asMoney(a.amount);
      if (a.kind === 'INVENTORY_RECOVERED') inventoryRecovered += asMoney(a.amount);
    }
    const realized = cashRecovered + influencedRevenue + inventoryRecovered;

    const monthlySubscriptionEstimate = 2000;
    const roi =
      monthlySubscriptionEstimate > 0 && realized > 0
        ? Math.round((realized / monthlySubscriptionEstimate) * 10) / 10
        : null;

    const top = [...rows].sort((a, b) => asMoney(b.realizedValue) - asMoney(a.realizedValue))[0];

    return {
      currencyCode: 'EGP',
      potentialValue: asMoney(potential),
      actionedValue: asMoney(actioned),
      realizedValue: asMoney(realized),
      influencedRevenue: asMoney(influencedRevenue),
      cashRecovered: asMoney(cashRecovered),
      costsAvoided: 0,
      inventoryRecovered: asMoney(inventoryRecovered),
      estimatedRoiMultiple: roi,
      subscriptionCost: monthlySubscriptionEstimate,
      labels: {
        influencedRevenue: 'إيراد متأثر بـ Gates (وليس مُولَّداً تلقائياً)',
        roi: 'عائد تقديري مقابل اشتراك افتراضي 2,000 ج.م إن لم يُضبط سعر الاشتراك',
      },
      highlights: {
        topOpportunity: top
          ? { id: top.id, title: top.title, realizedValue: asMoney(top.realizedValue) }
          : null,
      },
      attributions: attributions.slice(0, 40).map((a) => ({
        id: a.id,
        opportunityId: a.opportunityId,
        kind: a.kind,
        label: a.label,
        amount: asMoney(a.amount),
        entityType: a.entityType,
        entityId: a.entityId,
        createdAt: a.createdAt.toISOString(),
      })),
    };
  }
}

export const growthImpactService = new GrowthImpactService();
