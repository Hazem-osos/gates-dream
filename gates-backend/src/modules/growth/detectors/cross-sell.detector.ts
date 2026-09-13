import prisma from '../../../shared/database/prisma';
import { asMoney, monthsAgo, priorityFromAmount } from '../money';
import type { DetectedOpportunity, OpportunityDetector, OpportunityDetectorContext } from '../types';

const MIN_SUPPORT_INVOICES = 4;
const MIN_CUSTOMERS = 3;
const MIN_CONFIDENCE = 0.45;

export class CrossSellDetector implements OpportunityDetector {
  readonly key = 'cross-sell';

  async detect({ companyId, asOf }: OpportunityDetectorContext): Promise<DetectedOpportunity[]> {
    const since = monthsAgo(asOf, 12);
    const invoices = await prisma.invoice.findMany({
      where: {
        companyId,
        invoiceKind: 'SALE',
        isPosted: true,
        isCancelled: false,
        customerId: { not: null },
        date: { gte: since },
      },
      select: {
        id: true,
        customerId: true,
        lines: {
          select: { itemId: true, total: true, item: { select: { arabicName: true } } },
        },
      },
      take: 2500,
    });

    const pairCount = new Map<string, { count: number; customers: Set<string>; bRevenue: number }>();
    const customerItems = new Map<string, Set<string>>();
    const itemName = new Map<string, string>();

    for (const inv of invoices) {
      if (!inv.customerId) continue;
      const items = [...new Set(inv.lines.map((l) => l.itemId))];
      const owned = customerItems.get(inv.customerId) ?? new Set<string>();
      for (const id of items) owned.add(id);
      customerItems.set(inv.customerId, owned);
      for (const line of inv.lines) itemName.set(line.itemId, line.item.arabicName);
      for (let i = 0; i < items.length; i += 1) {
        for (let j = 0; j < items.length; j += 1) {
          if (i === j) continue;
          const key = `${items[i]}>${items[j]}`;
          const row = pairCount.get(key) ?? { count: 0, customers: new Set(), bRevenue: 0 };
          row.count += 1;
          row.customers.add(inv.customerId);
          const bLine = inv.lines.find((l) => l.itemId === items[j]);
          row.bRevenue += asMoney(bLine?.total);
          pairCount.set(key, row);
        }
      }
    }

    const itemCustomers = new Map<string, number>();
    for (const set of customerItems.values()) {
      for (const id of set) itemCustomers.set(id, (itemCustomers.get(id) || 0) + 1);
    }

    type Pair = { a: string; b: string; confidence: number; support: number; avgB: number };
    const pairs: Pair[] = [];
    for (const [key, row] of pairCount) {
      if (row.count < MIN_SUPPORT_INVOICES || row.customers.size < MIN_CUSTOMERS) continue;
      const [a, b] = key.split('>');
      const buyersA = itemCustomers.get(a) || 0;
      if (buyersA < MIN_CUSTOMERS) continue;
      const confidence = row.customers.size / buyersA;
      if (confidence < MIN_CONFIDENCE) continue;
      pairs.push({
        a,
        b,
        confidence,
        support: row.customers.size,
        avgB: row.bRevenue / Math.max(row.count, 1),
      });
    }
    pairs.sort((x, y) => y.confidence - x.confidence);

    const nameRows = await prisma.customer.findMany({
      where: { companyId, id: { in: [...customerItems.keys()] } },
      select: { id: true, arabicName: true },
    });
    const customerNames = new Map(nameRows.map((c) => [c.id, c.arabicName]));

    const opportunities: DetectedOpportunity[] = [];
    const used = new Set<string>();
    for (const pair of pairs.slice(0, 12)) {
      for (const [customerId, items] of customerItems) {
        if (!items.has(pair.a) || items.has(pair.b)) continue;
        const fp = `cross-sell:${companyId}:${customerId}:${pair.a}:${pair.b}`;
        if (used.has(fp) || opportunities.length >= 40) continue;
        used.add(fp);
        const customerName = customerNames.get(customerId);
        opportunities.push({
          fingerprint: fp,
          type: 'cross-sell',
          category: 'REVENUE',
          title: `بيع متقاطع — ${customerName || 'عميل'}`,
          description: `${Math.round(pair.confidence * 100)}٪ من عملاء «${itemName.get(pair.a)}» يشترون أيضاً «${itemName.get(pair.b)}». هذا العميل اشترى الأول دون الثاني.`,
          whyDetected: `الارتباط محسوب من فواتير المبيعات المرحّلة خلال 12 شهراً (دعم ${pair.support} عميل، ثقة ${(pair.confidence * 100).toFixed(0)}٪). ليست تخميناً من النموذج.`,
          priority: priorityFromAmount(pair.avgB, 40_000, 12_000, 3_000),
          estimatedValue: asMoney(pair.avgB),
          currencyCode: 'EGP',
          module: 'inventory',
          entityType: 'customer',
          entityId: customerId,
          confidence: Math.min(90, Math.round(pair.confidence * 100)),
          evidence: {
            customerId,
            customerName,
            productAId: pair.a,
            productAName: itemName.get(pair.a),
            productBId: pair.b,
            productBName: itemName.get(pair.b),
            associationConfidence: asMoney(pair.confidence * 100),
            supportingCustomers: pair.support,
            typicalBRevenue: asMoney(pair.avgB),
          },
          recommendedActions: [
            {
              key: 'open-customer',
              label: 'فتح العميل',
              href: `/accounting/cards/customer?id=${customerId}`,
              kind: 'navigate',
            },
            {
              key: 'open-item',
              label: 'فتح الصنف المقترح',
              href: `/inventory/creations/item-card?id=${pair.b}`,
              kind: 'navigate',
            },
            { key: 'mark-offer', label: 'تسجيل عرض بيع متقاطع', kind: 'record' },
            { key: 'dismiss', label: 'استبعاد الفرصة', kind: 'record' },
          ],
        });
      }
    }

    return opportunities;
  }
}
