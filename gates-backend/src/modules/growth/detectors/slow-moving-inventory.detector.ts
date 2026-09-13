import prisma from '../../../shared/database/prisma';
import { asMoney, daysBetween, monthsAgo, priorityFromAmount } from '../money';
import type { DetectedOpportunity, OpportunityDetector, OpportunityDetectorContext } from '../types';

export class SlowMovingInventoryDetector implements OpportunityDetector {
  readonly key = 'slow-moving-inventory';

  async detect({ companyId, asOf }: OpportunityDetectorContext): Promise<DetectedOpportunity[]> {
    const balances = await prisma.itemWarehouseBalance.findMany({
      where: { companyId, quantityOnHand: { gt: 0 } },
      select: {
        itemId: true,
        warehouseId: true,
        quantityOnHand: true,
        averageCost: true,
        item: { select: { id: true, arabicName: true, averageCost: true, isService: true } },
        warehouse: { select: { id: true, arabicName: true } },
      },
      take: 4000,
    });

    const itemIds = [...new Set(balances.filter((b) => !b.item.isService).map((b) => b.itemId))];
    if (!itemIds.length) return [];

    const since = monthsAgo(asOf, 18);
    const saleLines = await prisma.invoiceLine.findMany({
      where: {
        itemId: { in: itemIds },
        invoice: {
          companyId,
          invoiceKind: 'SALE',
          isPosted: true,
          isCancelled: false,
          date: { gte: since },
        },
      },
      select: { itemId: true, quantity: true, invoice: { select: { date: true } } },
      take: 12000,
    });

    const lastSale = new Map<string, Date>();
    const soldQty = new Map<string, number>();
    for (const line of saleLines) {
      const prev = lastSale.get(line.itemId);
      if (!prev || line.invoice.date > prev) lastSale.set(line.itemId, line.invoice.date);
      soldQty.set(line.itemId, (soldQty.get(line.itemId) || 0) + asMoney(line.quantity));
    }

    const byItem = new Map<
      string,
      { name: string; qty: number; value: number; warehouses: string[] }
    >();
    for (const bal of balances) {
      if (bal.item.isService) continue;
      const cost = asMoney(bal.averageCost) || asMoney(bal.item.averageCost);
      const qty = asMoney(bal.quantityOnHand);
      const value = qty * cost;
      const row = byItem.get(bal.itemId) ?? {
        name: bal.item.arabicName,
        qty: 0,
        value: 0,
        warehouses: [],
      };
      row.qty += qty;
      row.value += value;
      if (bal.warehouse?.arabicName) row.warehouses.push(bal.warehouse.arabicName);
      byItem.set(bal.itemId, row);
    }

    const opportunities: DetectedOpportunity[] = [];
    for (const [itemId, row] of byItem) {
      if (row.value < 2_000) continue;
      const last = lastSale.get(itemId);
      const idle = last ? daysBetween(last, asOf) : 400;
      const monthlyVelocity = (soldQty.get(itemId) || 0) / 18;
      const isDead = idle >= 120 && monthlyVelocity <= 0.2;
      const isSlow = idle >= 75 && monthlyVelocity < row.qty / 6;
      if (!isDead && !isSlow) continue;

      opportunities.push({
        fingerprint: `slow-inventory:${companyId}:${itemId}`,
        type: isDead ? 'dead-inventory' : 'slow-inventory',
        category: 'INVENTORY',
        title: `${isDead ? 'مخزون راكد' : 'مخزون بطيء'} — ${row.name}`,
        description: `${asMoney(row.value).toLocaleString('ar-EG')} ج.م رأس مال مربوط في ${row.qty.toLocaleString('ar-EG')} وحدة. ${last ? `آخر بيع منذ ${idle} يوم.` : 'لا يوجد بيع مرحّل خلال 18 شهراً.'}`,
        whyDetected: `القيمة = الكمية × متوسط التكلفة المتحرك من رصيد المخزن. الحركة من فواتير المبيعات المرحّلة فقط.`,
        priority: priorityFromAmount(row.value, 150_000, 40_000, 8_000),
        estimatedValue: asMoney(row.value),
        currencyCode: 'EGP',
        module: 'inventory',
        entityType: 'item',
        entityId: itemId,
        confidence: last ? 78 : 88,
        evidence: {
          itemId,
          itemName: row.name,
          quantityOnHand: row.qty,
          inventoryValue: asMoney(row.value),
          daysSinceLastSale: idle,
          lastSaleDate: last ? last.toISOString().slice(0, 10) : null,
          monthlySalesVelocity: asMoney(monthlyVelocity),
          warehouses: row.warehouses,
          classification: isDead ? 'dead' : 'slow',
        },
        recommendedActions: [
          {
            key: 'open-item',
            label: 'فتح بطاقة الصنف',
            href: `/inventory/creations/item-card?id=${itemId}`,
            kind: 'navigate',
          },
          { key: 'mark-promotion', label: 'تسجيل اقتراح تصريف', kind: 'record' },
          { key: 'ask-ai', label: 'اسأل الذكاء عن استراتيجية التصريف', kind: 'ai' },
          { key: 'dismiss', label: 'استبعاد الفرصة', kind: 'record' },
        ],
      });
    }

    return opportunities.sort((a, b) => b.estimatedValue - a.estimatedValue).slice(0, 50);
  }
}
