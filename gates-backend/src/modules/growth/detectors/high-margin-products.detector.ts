import prisma from '../../../shared/database/prisma';
import { asMoney, monthsAgo, priorityFromAmount } from '../money';
import type { DetectedOpportunity, OpportunityDetector, OpportunityDetectorContext } from '../types';

export class HighMarginProductsDetector implements OpportunityDetector {
  readonly key = 'high-margin-products';

  async detect({ companyId, asOf }: OpportunityDetectorContext): Promise<DetectedOpportunity[]> {
    const recentFrom = monthsAgo(asOf, 3);
    const priorFrom = monthsAgo(asOf, 6);

    const lines = await prisma.invoiceLine.findMany({
      where: {
        invoice: {
          companyId,
          invoiceKind: 'SALE',
          isPosted: true,
          isCancelled: false,
          date: { gte: priorFrom },
        },
      },
      select: {
        itemId: true,
        quantity: true,
        price: true,
        total: true,
        unitCostAtIssue: true,
        invoice: { select: { date: true } },
        item: {
          select: {
            id: true,
            arabicName: true,
            averageCost: true,
            isService: true,
          },
        },
      },
      take: 12000,
    });

    const balances = await prisma.itemWarehouseBalance.groupBy({
      by: ['itemId'],
      where: { companyId, quantityOnHand: { gt: 0 } },
      _sum: { quantityOnHand: true },
    });
    const stock = new Map(balances.map((b) => [b.itemId, asMoney(b._sum.quantityOnHand)]));

    type Agg = {
      name: string;
      recentRev: number;
      priorRev: number;
      recentQty: number;
      marginWeighted: number;
      marginWeight: number;
    };
    const byItem = new Map<string, Agg>();
    for (const line of lines) {
      if (line.item.isService) continue;
      const cost = asMoney(line.unitCostAtIssue) || asMoney(line.item.averageCost);
      const price = asMoney(line.price);
      if (price <= 0 || cost <= 0 || cost >= price) continue;
      const qty = asMoney(line.quantity);
      const rev = asMoney(line.total) || price * qty;
      const margin = (price - cost) / price;
      const row = byItem.get(line.itemId) ?? {
        name: line.item.arabicName,
        recentRev: 0,
        priorRev: 0,
        recentQty: 0,
        marginWeighted: 0,
        marginWeight: 0,
      };
      if (line.invoice.date >= recentFrom) {
        row.recentRev += rev;
        row.recentQty += qty;
      } else {
        row.priorRev += rev;
      }
      row.marginWeighted += margin * rev;
      row.marginWeight += rev;
      byItem.set(line.itemId, row);
    }

    const opportunities: DetectedOpportunity[] = [];
    for (const [itemId, row] of byItem) {
      const onHand = stock.get(itemId) || 0;
      const margin = row.marginWeight > 0 ? row.marginWeighted / row.marginWeight : 0;
      if (margin < 0.22 || onHand <= 0 || row.recentRev < 1_500) continue;
      const trend =
        row.priorRev > 0 ? ((row.recentRev - row.priorRev) / row.priorRev) * 100 : row.recentRev > 0 ? 100 : 0;
      if (trend < -15) continue;

      opportunities.push({
        fingerprint: `high-margin:${companyId}:${itemId}`,
        type: 'high-margin-product',
        category: 'REVENUE',
        title: `صنف هامشه قوي ومتاح — ${row.name}`,
        description: `هامش إجمالي ${(margin * 100).toFixed(1)}٪، رصيد ${onHand.toLocaleString('ar-EG')}، ومبيعات آخر 90 يوماً ${row.recentRev.toLocaleString('ar-EG')} ج.م.`,
        whyDetected: `الهامش من سعر البيع مقابل تكلفة الإصدار (unitCostAtIssue) أو متوسط التكلفة المتحرك. القيمة المحتملة = مبيعات آخر 90 يوماً كحدّ تشغيلي محافظ، وليست مخترعة.`,
        priority: priorityFromAmount(row.recentRev, 120_000, 35_000, 8_000),
        estimatedValue: asMoney(row.recentRev),
        currencyCode: 'EGP',
        module: 'inventory',
        entityType: 'item',
        entityId: itemId,
        confidence: 74,
        evidence: {
          itemId,
          itemName: row.name,
          grossMarginPercent: asMoney(margin * 100),
          availableStock: onHand,
          revenueLast90Days: asMoney(row.recentRev),
          revenuePrior90Days: asMoney(row.priorRev),
          salesTrendPercent: asMoney(trend),
        },
        recommendedActions: [
          {
            key: 'open-item',
            label: 'فتح الصنف',
            href: `/inventory/creations/item-card?id=${itemId}`,
            kind: 'navigate',
          },
          { key: 'mark-sales-push', label: 'تسجيل توصية لفريق المبيعات', kind: 'record' },
          { key: 'ask-ai', label: 'اسأل الذكاء عن خطة البيع', kind: 'ai' },
          { key: 'dismiss', label: 'استبعاد الفرصة', kind: 'record' },
        ],
      });
    }

    return opportunities.sort((a, b) => b.estimatedValue - a.estimatedValue).slice(0, 40);
  }
}
