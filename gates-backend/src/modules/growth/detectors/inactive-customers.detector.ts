import prisma from '../../../shared/database/prisma';
import { asMoney, average, daysBetween, median, monthsAgo, priorityFromAmount } from '../money';
import type { DetectedOpportunity, OpportunityDetector, OpportunityDetectorContext } from '../types';

export class InactiveCustomersDetector implements OpportunityDetector {
  readonly key = 'inactive-customers';

  async detect({ companyId, asOf }: OpportunityDetectorContext): Promise<DetectedOpportunity[]> {
    const since = monthsAgo(asOf, 18);
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
        date: true,
        netAmount: true,
        customerId: true,
        customer: { select: { id: true, arabicName: true } },
      },
      orderBy: { date: 'asc' },
      take: 8000,
    });

    const byCustomer = new Map<
      string,
      { name: string; dates: Date[]; amounts: number[] }
    >();
    for (const inv of invoices) {
      if (!inv.customerId) continue;
      const row = byCustomer.get(inv.customerId) ?? {
        name: inv.customer?.arabicName || 'عميل',
        dates: [],
        amounts: [],
      };
      row.dates.push(inv.date);
      row.amounts.push(asMoney(inv.netAmount));
      byCustomer.set(inv.customerId, row);
    }

    const opportunities: DetectedOpportunity[] = [];
    for (const [customerId, row] of byCustomer) {
      if (row.dates.length < 3) continue;
      const intervals: number[] = [];
      for (let i = 1; i < row.dates.length; i += 1) {
        intervals.push(daysBetween(row.dates[i - 1], row.dates[i]));
      }
      const typical = Math.max(14, median(intervals));
      const last = row.dates[row.dates.length - 1];
      const idle = daysBetween(last, asOf);
      if (idle < typical * 2 || idle < 45) continue;

      const last12 = row.dates
        .map((d, i) => ({ d, amt: row.amounts[i] }))
        .filter((x) => x.d >= monthsAgo(asOf, 12));
      const monthsCovered = Math.max(1, Math.min(12, last12.length ? 12 : 1));
      const monthly = asMoney(last12.reduce((s, x) => s + x.amt, 0) / monthsCovered);
      if (monthly < 500) continue;

      opportunities.push({
        fingerprint: `inactive-customer:${companyId}:${customerId}`,
        type: 'inactive-customer',
        category: 'REVENUE',
        title: `عميل متوقف عن الشراء — ${row.name}`,
        description: `كان يطلب تقريباً كل ${Math.round(typical)} يوم، وآخر شراء منذ ${idle} يوم. متوسط الإيراد الشهري التاريخي ${monthly.toLocaleString('ar-EG')} ج.م.`,
        whyDetected: `اشتُقّت الدورة المتوقعة من الفترات بين فواتير المبيعات المرحّلة (وسيط ${Math.round(typical)} يوم). التوقف تجاوز ضعف هذه الدورة.`,
        priority: priorityFromAmount(monthly, 80_000, 25_000, 8_000),
        estimatedValue: monthly,
        currencyCode: 'EGP',
        module: 'inventory',
        entityType: 'customer',
        entityId: customerId,
        confidence: row.dates.length >= 6 ? 86 : 72,
        evidence: {
          customerId,
          customerName: row.name,
          orderCount18m: row.dates.length,
          ordersLast12m: last12.length,
          typicalIntervalDays: Math.round(typical),
          intervalRange: `${Math.round(Math.min(...intervals))}-${Math.round(Math.max(...intervals))}`,
          daysSinceLastOrder: idle,
          lastOrderDate: last.toISOString().slice(0, 10),
          averageOrder: asMoney(average(row.amounts)),
          historicalMonthlyRevenue: monthly,
        },
        recommendedActions: [
          {
            key: 'open-customer',
            label: 'فتح سجل العميل',
            href: `/accounting/cards/customer?id=${customerId}`,
            kind: 'navigate',
          },
          { key: 'mark-followup', label: 'تسجيل متابعة إعادة تفعيل', kind: 'record' },
          { key: 'ask-ai', label: 'اقترح رسالة إعادة تواصل', kind: 'ai' },
          { key: 'dismiss', label: 'استبعاد الفرصة', kind: 'record' },
        ],
      });
    }

    return opportunities.sort((a, b) => b.estimatedValue - a.estimatedValue).slice(0, 60);
  }
}
