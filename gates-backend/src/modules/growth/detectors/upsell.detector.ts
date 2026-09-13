import prisma from '../../../shared/database/prisma';
import { asMoney, average, monthsAgo, priorityFromAmount } from '../money';
import type { DetectedOpportunity, OpportunityDetector, OpportunityDetectorContext } from '../types';

export class UpsellDetector implements OpportunityDetector {
  readonly key = 'upsell';

  async detect({ companyId, asOf }: OpportunityDetectorContext): Promise<DetectedOpportunity[]> {
    const since = monthsAgo(asOf, 18);
    const lines = await prisma.invoiceLine.findMany({
      where: {
        invoice: {
          companyId,
          invoiceKind: 'SALE',
          isPosted: true,
          isCancelled: false,
          customerId: { not: null },
          date: { gte: since },
        },
      },
      select: {
        itemId: true,
        quantity: true,
        price: true,
        invoice: { select: { date: true, customerId: true } },
        item: { select: { arabicName: true } },
      },
      orderBy: { invoice: { date: 'asc' } },
      take: 12000,
    });

    type Row = { name: string; qtys: number[]; prices: number[]; lastQty: number; lastPrice: number; customerId: string };
    const map = new Map<string, Row>();
    for (const line of lines) {
      const customerId = line.invoice.customerId;
      if (!customerId) continue;
      const key = `${customerId}:${line.itemId}`;
      const qty = asMoney(line.quantity);
      const price = asMoney(line.price);
      const row = map.get(key) ?? {
        name: line.item.arabicName,
        qtys: [],
        prices: [],
        lastQty: qty,
        lastPrice: price,
        customerId,
      };
      row.qtys.push(qty);
      row.prices.push(price);
      row.lastQty = qty;
      row.lastPrice = price;
      map.set(key, row);
    }

    const candidates: Array<{ key: string; customerId: string; itemId: string; gap: number; avgQty: number; row: Row }> =
      [];
    for (const [key, row] of map) {
      if (row.qtys.length < 3) continue;
      const avgQty = average(row.qtys);
      if (avgQty <= 0 || row.lastQty >= avgQty * 0.7) continue;
      const gap = (avgQty - row.lastQty) * row.lastPrice;
      if (gap < 800) continue;
      const [customerId, itemId] = key.split(':');
      candidates.push({ key, customerId, itemId, gap, avgQty, row });
    }

    const customerIds = [...new Set(candidates.map((c) => c.customerId))];
    const customers = customerIds.length
      ? await prisma.customer.findMany({
          where: { companyId, id: { in: customerIds } },
          select: { id: true, arabicName: true },
        })
      : [];
    const customerNames = new Map(customers.map((c) => [c.id, c.arabicName]));

    const opportunities: DetectedOpportunity[] = [];
    for (const item of candidates) {
      const customerName = customerNames.get(item.customerId);

      opportunities.push({
        fingerprint: `upsell:${companyId}:${item.customerId}:${item.itemId}`,
        type: 'upsell',
        category: 'REVENUE',
        title: `فرصة رفع كمية — ${customerName || 'عميل'} / ${item.row.name}`,
        description: `آخر كمية ${item.row.lastQty} مقابل متوسط تاريخي ${item.avgQty.toFixed(1)}. الفارق التقديري ${asMoney(item.gap).toLocaleString('ar-EG')} ج.م.`,
        whyDetected: `نفس العميل ونفس الصنف على فواتير مبيعات مرحّلة (≥ 3 حركات). الكمية الأخيرة أقل من 70٪ من متوسطه.`,
        priority: priorityFromAmount(item.gap, 40_000, 12_000, 3_000),
        estimatedValue: asMoney(item.gap),
        currencyCode: 'EGP',
        module: 'inventory',
        entityType: 'customer',
        entityId: item.customerId,
        confidence: 68,
        evidence: {
          customerId: item.customerId,
          customerName,
          itemId: item.itemId,
          itemName: item.row.name,
          lastQuantity: item.row.lastQty,
          historicalAverageQuantity: asMoney(item.avgQty),
          lastUnitPrice: item.row.lastPrice,
          purchaseCount: item.row.qtys.length,
        },
        recommendedActions: [
          {
            key: 'open-customer',
            label: 'فتح العميل',
            href: `/accounting/cards/customer?id=${item.customerId}`,
            kind: 'navigate',
          },
          { key: 'mark-upsell', label: 'تسجيل متابعة رفع الكمية', kind: 'record' },
          { key: 'ask-ai', label: 'اسأل الذكاء عن عرض الكمية', kind: 'ai' },
          { key: 'dismiss', label: 'استبعاد الفرصة', kind: 'record' },
        ],
      });
    }

    return opportunities.sort((a, b) => b.estimatedValue - a.estimatedValue).slice(0, 40);
  }
}
