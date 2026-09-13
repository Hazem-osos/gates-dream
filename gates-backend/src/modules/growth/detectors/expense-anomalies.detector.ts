import prisma from '../../../shared/database/prisma';
import { asMoney, median, monthsAgo, priorityFromAmount } from '../money';
import type { DetectedOpportunity, OpportunityDetector, OpportunityDetectorContext } from '../types';

export class ExpenseAnomaliesDetector implements OpportunityDetector {
  readonly key = 'expense-anomalies';

  async detect({ companyId, asOf }: OpportunityDetectorContext): Promise<DetectedOpportunity[]> {
    const since = monthsAgo(asOf, 12);
    const purchases = await prisma.invoice.findMany({
      where: {
        companyId,
        invoiceKind: 'PURCHASE',
        isPosted: true,
        isCancelled: false,
        date: { gte: since },
      },
      select: { id: true, date: true, netAmount: true, invoiceNumber: true },
      take: 4000,
    });
    if (purchases.length < 6) return [];

    const byMonth = new Map<string, number>();
    for (const inv of purchases) {
      const key = `${inv.date.getFullYear()}-${String(inv.date.getMonth() + 1).padStart(2, '0')}`;
      byMonth.set(key, (byMonth.get(key) || 0) + asMoney(inv.netAmount));
    }
    const months = [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b));
    if (months.length < 4) return [];

    const latest = months[months.length - 1];
    const prior = months.slice(0, -1).map(([, v]) => v);
    const typical = median(prior);
    if (typical <= 0) return [];
    const ratio = latest[1] / typical;
    if (ratio < 1.6 || latest[1] - typical < 5_000) return [];

    const excess = asMoney(latest[1] - typical);
    return [
      {
        fingerprint: `expense-anomaly:${companyId}:${latest[0]}`,
        type: 'expense-anomaly',
        category: 'COSTS',
        title: `نمط إنفاق غير معتاد — ${latest[0]}`,
        description: `مشتريات الشهر ${latest[1].toLocaleString('ar-EG')} ج.م مقابل وسيط الأشهر السابقة ${typical.toLocaleString('ar-EG')} ج.م (${(ratio * 100).toFixed(0)}٪).`,
        whyDetected: `لا يوجد مستند مصروف عام منفصل؛ المقارنة على فواتير المشتريات المرحّلة مجمّعة شهرياً. الزيادة = أحدث شهر − وسيط الأشهر السابقة. ليست اتهاماً باحتيال.`,
        priority: priorityFromAmount(excess, 80_000, 25_000, 8_000),
        estimatedValue: excess,
        currencyCode: 'EGP',
        module: 'inventory',
        entityType: 'period',
        entityId: latest[0],
        confidence: 64,
        evidence: {
          month: latest[0],
          latestPurchaseSpend: asMoney(latest[1]),
          historicalMedian: asMoney(typical),
          ratioPercent: asMoney(ratio * 100),
          unusualSpend: excess,
          monthlySeries: months.map(([month, amount]) => ({ month, amount: asMoney(amount) })),
        },
        recommendedActions: [
          {
            key: 'open-purchases',
            label: 'فتح فواتير المشتريات',
            href: '/inventory/operations/final-purchase-invoice',
            kind: 'navigate',
          },
          { key: 'mark-review', label: 'تسجيل مراجعة إنفاق', kind: 'record' },
          { key: 'ask-ai', label: 'اسأل الذكاء عن تفسير النمط', kind: 'ai' },
          { key: 'dismiss', label: 'استبعاد الفرصة', kind: 'record' },
        ],
      },
    ];
  }
}
