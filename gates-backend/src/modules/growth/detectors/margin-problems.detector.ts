import prisma from '../../../shared/database/prisma';
import { asMoney, monthsAgo, priorityFromAmount } from '../money';
import type { DetectedOpportunity, OpportunityDetector, OpportunityDetectorContext } from '../types';

export class MarginProblemsDetector implements OpportunityDetector {
  readonly key = 'margin-problems';

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
        price: true,
        quantity: true,
        total: true,
        discountPercent: true,
        unitCostAtIssue: true,
        invoice: { select: { date: true } },
        item: { select: { arabicName: true, averageCost: true, isService: true } },
      },
      take: 12000,
    });

    type Bucket = { rev: number; cost: number; priceQty: number; disc: number };
    const empty = (): Bucket => ({ rev: 0, cost: 0, priceQty: 0, disc: 0 });
    const map = new Map<string, { name: string; recent: Bucket; prior: Bucket }>();

    for (const line of lines) {
      if (line.item.isService) continue;
      const cost = asMoney(line.unitCostAtIssue) || asMoney(line.item.averageCost);
      const qty = asMoney(line.quantity);
      const price = asMoney(line.price);
      const rev = asMoney(line.total) || price * qty;
      if (qty <= 0 || rev <= 0 || cost <= 0) continue;
      const row = map.get(line.itemId) ?? { name: line.item.arabicName, recent: empty(), prior: empty() };
      const bucket = line.invoice.date >= recentFrom ? row.recent : row.prior;
      bucket.rev += rev;
      bucket.cost += cost * qty;
      bucket.priceQty += price * qty;
      bucket.disc += asMoney(line.discountPercent);
      map.set(line.itemId, row);
    }

    const opportunities: DetectedOpportunity[] = [];
    for (const [itemId, row] of map) {
      if (row.recent.rev < 3_000 || row.prior.rev < 3_000) continue;
      const recentMargin = (row.recent.rev - row.recent.cost) / row.recent.rev;
      const priorMargin = (row.prior.rev - row.prior.cost) / row.prior.rev;
      const avgPriceRecent = row.recent.priceQty / Math.max(row.recent.rev, 1);
      const avgPricePrior = row.prior.priceQty / Math.max(row.prior.rev, 1);
      const avgCostRecent = row.recent.cost / Math.max(row.recent.rev, 1);
      const avgCostPrior = row.prior.cost / Math.max(row.prior.rev, 1);
      const costChange = avgCostPrior > 0 ? ((avgCostRecent - avgCostPrior) / avgCostPrior) * 100 : 0;
      const priceChange = avgPricePrior > 0 ? ((avgPriceRecent - avgPricePrior) / avgPricePrior) * 100 : 0;
      const drop = priorMargin - recentMargin;
      if (drop < 0.04 && !(costChange >= 8 && priceChange < 2)) continue;

      const monthlyLost = asMoney(Math.max(0, drop) * row.recent.rev / 3);
      if (monthlyLost < 400) continue;

      opportunities.push({
        fingerprint: `margin-problem:${companyId}:${itemId}`,
        type: 'margin-problem',
        category: 'PRICING',
        title: `تآكل الهامش — ${row.name}`,
        description: `الهامش انخفض من ${(priorMargin * 100).toFixed(1)}٪ إلى ${(recentMargin * 100).toFixed(1)}٪. التكلفة ${costChange.toFixed(1)}٪ والسعر ${priceChange.toFixed(1)}٪.`,
        whyDetected: `مقارنة متوسط تكلفة/سعر فواتير المبيعات المرحّلة لآخر 90 يوماً مقابل الـ 90 السابقة. الهامش الضائع الشهري ≈ فرق الهامش × إيراد الربع / 3.`,
        priority: priorityFromAmount(monthlyLost, 40_000, 12_000, 2_000),
        estimatedValue: monthlyLost,
        currencyCode: 'EGP',
        module: 'inventory',
        entityType: 'item',
        entityId: itemId,
        confidence: 70,
        evidence: {
          itemId,
          itemName: row.name,
          previousMarginPercent: asMoney(priorMargin * 100),
          currentMarginPercent: asMoney(recentMargin * 100),
          costChangePercent: asMoney(costChange),
          sellingPriceChangePercent: asMoney(priceChange),
          estimatedLostMonthlyMargin: monthlyLost,
        },
        recommendedActions: [
          {
            key: 'open-item',
            label: 'فتح الصنف',
            href: `/inventory/creations/item-card?id=${itemId}`,
            kind: 'navigate',
          },
          { key: 'mark-price-review', label: 'تسجيل مراجعة سعر', kind: 'record' },
          { key: 'ask-ai', label: 'اسأل الذكاء عن محاكاة السعر', kind: 'ai' },
          { key: 'dismiss', label: 'استبعاد الفرصة', kind: 'record' },
        ],
      });
    }

    return opportunities.sort((a, b) => b.estimatedValue - a.estimatedValue).slice(0, 30);
  }
}
