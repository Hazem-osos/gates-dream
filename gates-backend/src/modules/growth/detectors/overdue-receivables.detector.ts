import prisma from '../../../shared/database/prisma';
import { asMoney, daysBetween, median, priorityFromAmount } from '../money';
import type { DetectedOpportunity, OpportunityDetector, OpportunityDetectorContext } from '../types';

export class OverdueReceivablesDetector implements OpportunityDetector {
  readonly key = 'overdue-receivables';

  async detect({ companyId, asOf }: OpportunityDetectorContext): Promise<DetectedOpportunity[]> {
    const invoices = await prisma.invoice.findMany({
      where: {
        companyId,
        invoiceKind: 'SALE',
        isPosted: true,
        isCancelled: false,
        remainingAmount: { gt: 0 },
        customerId: { not: null },
        OR: [{ dueDate: { lt: asOf } }, { AND: [{ dueDate: null }, { date: { lt: asOf } }] }],
      },
      select: {
        id: true,
        invoiceNumber: true,
        date: true,
        dueDate: true,
        remainingAmount: true,
        netAmount: true,
        customerId: true,
        customer: { select: { id: true, arabicName: true } },
      },
      take: 2500,
    });

    const byCustomer = new Map<
      string,
      {
        name: string;
        invoices: typeof invoices;
        outstanding: number;
        maxDays: number;
      }
    >();

    for (const inv of invoices) {
      const customerId = inv.customerId;
      if (!customerId) continue;
      const due = inv.dueDate ?? inv.date;
      const days = Math.max(0, daysBetween(due, asOf));
      const remaining = asMoney(inv.remainingAmount);
      const current = byCustomer.get(customerId);
      if (!current) {
        byCustomer.set(customerId, {
          name: inv.customer?.arabicName || 'عميل',
          invoices: [inv],
          outstanding: remaining,
          maxDays: days,
        });
      } else {
        current.invoices.push(inv);
        current.outstanding += remaining;
        current.maxDays = Math.max(current.maxDays, days);
      }
    }

    const customerIds = [...byCustomer.keys()];
    const allocations = customerIds.length
      ? await prisma.paymentAllocation.findMany({
          where: {
            companyId,
            invoice: {
              companyId,
              customerId: { in: customerIds },
              invoiceKind: 'SALE',
              isPosted: true,
              isCancelled: false,
            },
            cashTransaction: { isPosted: true },
          },
          select: {
            allocatedAt: true,
            invoice: { select: { customerId: true, date: true } },
          },
          take: 8000,
        })
      : [];
    const payDays = new Map<string, number[]>();
    for (const alloc of allocations) {
      const customerId = alloc.invoice.customerId;
      if (!customerId) continue;
      const days = daysBetween(alloc.invoice.date, alloc.allocatedAt);
      if (days < 0 || days > 800) continue;
      const list = payDays.get(customerId) ?? [];
      list.push(days);
      payDays.set(customerId, list);
    }

    const opportunities: DetectedOpportunity[] = [];
    for (const [customerId, row] of byCustomer) {
      if (row.outstanding < 1) continue;
      const highPriorityShare = row.invoices
        .filter((inv) => daysBetween(inv.dueDate ?? inv.date, asOf) >= 30)
        .reduce((sum, inv) => sum + asMoney(inv.remainingAmount), 0);
      const history = payDays.get(customerId) ?? [];
      const typicalPay = history.length >= 2 ? Math.round(median(history)) : null;
      const paymentBehavior = typicalPay
        ? `عادة يسدد خلال ${Math.max(1, typicalPay - 5)}-${typicalPay + 5} يوم`
        : 'لا يوجد تاريخ سداد كافٍ';

      opportunities.push({
        fingerprint: `overdue-receivable:${companyId}:${customerId}`,
        type: 'overdue-receivable',
        category: 'CASH_RECOVERY',
        title: `مستحقات متأخرة — ${row.name}`,
        description: `${row.invoices.length} فاتورة متأخرة بإجمالي ${row.outstanding.toLocaleString('ar-EG')} ج.م. أقدم تأخير ${row.maxDays} يوم. ${paymentBehavior}.`,
        whyDetected: `فواتير مبيعات مرحّلة وغير ملغاة برصيد متبقٍّ بعد تاريخ الاستحقاق. القيمة المحتملة = مجموع remainingAmount. سلوك السداد من توزيعات التحصيل المرحّلة.`,
        priority: priorityFromAmount(row.outstanding, 200_000, 50_000, 10_000),
        estimatedValue: asMoney(row.outstanding),
        currencyCode: 'EGP',
        module: 'inventory',
        entityType: 'customer',
        entityId: customerId,
        confidence: row.maxDays >= 45 ? 92 : 80,
        evidence: {
          customerId,
          customerName: row.name,
          invoiceCount: row.invoices.length,
          outstanding: row.outstanding,
          highPriorityRecoverable: highPriorityShare,
          maxDaysOverdue: row.maxDays,
          historicalPaymentDays: typicalPay,
          paymentBehavior,
          invoices: row.invoices.slice(0, 12).map((inv) => ({
            id: inv.id,
            number: inv.invoiceNumber,
            remaining: asMoney(inv.remainingAmount),
            daysOverdue: Math.max(0, daysBetween(inv.dueDate ?? inv.date, asOf)),
            dueDate: (inv.dueDate ?? inv.date).toISOString().slice(0, 10),
          })),
        },
        recommendedActions: [
          {
            key: 'open-customer',
            label: 'فتح بطاقة العميل',
            href: `/accounting/cards/customer?id=${customerId}`,
            kind: 'navigate',
          },
          {
            key: 'open-invoice',
            label: 'فتح أحدث فاتورة',
            href: `/inventory/operations/sales-invoice?invoiceId=${row.invoices[0]?.id ?? ''}`,
            kind: 'navigate',
          },
          { key: 'mark-collection', label: 'تسجيل متابعة تحصيل', kind: 'record' },
          { key: 'ask-ai', label: 'اسأل الذكاء عن استراتيجية التحصيل', kind: 'ai' },
          { key: 'dismiss', label: 'استبعاد الفرصة', kind: 'record' },
        ],
      });
    }

    return opportunities.sort((a, b) => b.estimatedValue - a.estimatedValue).slice(0, 80);
  }
}
