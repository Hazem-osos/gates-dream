import type { NotificationSeverity } from '@prisma/client';
import prisma from '../../../shared/database/prisma';
import { logger } from '../../../shared/logger';
import type { AIProvider } from '../interfaces/ai-provider';
import { prismaCashFlowPorts } from '../proactive/detector-ports.prisma';
import { money } from '../proactive/detector.types';
import { aiNotificationStore, type AiNotificationStore } from './ai-notification.store';
import type { SentinelFinding } from './ai-notification.types';
import { CATEGORY_TARGET_ROLES } from './notification-rbac';
import { synthesizeRbacAlerts } from './synthesize-rbac-alerts';

const LIQUIDITY_HORIZON_DAYS = 3;
const LIQUIDITY_RATIO = 0.8;
const DISCOUNT_THRESHOLD = 15;
const MARKUP_FLOOR = 1.1;
const EXPIRY_DAYS = 30;
const DRAFT_HOURS = 48;
const INWARD_OPEN: Array<'UNDER_HAND' | 'SENT_TO_BANK'> = ['UNDER_HAND', 'SENT_TO_BANK'];

function egp(value: number): string {
  return `${money(value).toLocaleString('ar-EG', { maximumFractionDigits: 2 })} ج.م`;
}

function addDays(from: Date, days: number): Date {
  const next = new Date(from);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function startOfDay(value: Date): Date {
  const next = new Date(value);
  next.setHours(0, 0, 0, 0);
  return next;
}

function dayKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export class AiSentinelService {
  constructor(
    private readonly provider: AIProvider,
    private readonly store: AiNotificationStore = aiNotificationStore
  ) {}

  async runForCompany(companyId: string, asOf = new Date()): Promise<{ created: number }> {
    const findings = (
      await Promise.all([
        this.analyzeLiquidity(companyId, asOf),
        this.analyzeProfitAnomaly(companyId, asOf),
        this.analyzeChequesDue(companyId, asOf),
        this.analyzeStockReorder(companyId, asOf),
        this.analyzeExpiringBatches(companyId, asOf),
        this.analyzeUnpostedDrafts(companyId, asOf),
      ])
    ).flat();
    const synthesized = await synthesizeRbacAlerts(this.provider, findings);
    const created = await this.store.upsertFindings(companyId, synthesized, asOf);
    logger.info({ companyId, findings: findings.length, created: created.length }, 'RBAC sentinel scan');
    return { created: created.length };
  }

  private async analyzeLiquidity(companyId: string, asOf: Date): Promise<SentinelFinding[]> {
    const to = addDays(asOf, LIQUIDITY_HORIZON_DAYS);
    const [cash, cheques, securities, invoices] = await Promise.all([
      prismaCashFlowPorts.liquidCash(companyId),
      prismaCashFlowPorts.upcomingCheques(companyId, asOf, to),
      prismaCashFlowPorts.upcomingSecurities(companyId, asOf, to),
      prismaCashFlowPorts.upcomingSupplierInvoices(companyId, asOf, to),
    ]);
    const obligations = money(
      cheques.reduce((sum, row) => sum + money(row.amount), 0) +
        securities.reduce((sum, row) => sum + money(row.amount), 0) +
        invoices.reduce((sum, row) => sum + money(row.amount), 0)
    );
    const liquidity = money(cash.treasuryTotal + cash.bankTotal);
    if (liquidity <= 0 || obligations < liquidity * LIQUIDITY_RATIO) return [];
    const severity: NotificationSeverity = obligations >= liquidity ? 'CRITICAL' : 'WARNING';
    return [
      {
        category: 'FINANCIAL_LIQUIDITY',
        severity,
        targetRoles: CATEGORY_TARGET_ROLES.FINANCIAL_LIQUIDITY,
        titleAr: 'تنبيه سيولة',
        messageAr: `تنبيه سيولة: مستحقات الموردين والشيكات الصادرة خلال الـ 72 ساعة القادمة (${egp(obligations)}) تقترب من إجمالي السيولة المتاحة في البنوك والخزينة (${egp(liquidity)}).`,
        actionUrl: '/accounting/vouchers/payment',
        actionLabelAr: 'عرض أوامر الصرف',
        fingerprint: `FINANCIAL_LIQUIDITY:${dayKey(asOf)}`,
        metadata: { obligations, liquidity, horizonDays: LIQUIDITY_HORIZON_DAYS },
      },
    ];
  }

  private async analyzeProfitAnomaly(companyId: string, asOf: Date): Promise<SentinelFinding[]> {
    const since = new Date(asOf.getTime() - 24 * 60 * 60 * 1000);
    const invoices = await prisma.invoice.findMany({
      where: {
        companyId,
        isCancelled: false,
        invoiceKind: 'SALE',
        createdAt: { gte: since },
      },
      select: {
        id: true,
        invoiceNumber: true,
        totalAmount: true,
        discountAmount: true,
        headerDiscountPercent: true,
        customer: { select: { arabicName: true } },
        lines: {
          select: {
            price: true,
            discountPercent: true,
            item: { select: { arabicName: true, averageCost: true } },
          },
        },
      },
      take: 80,
    });

    const findings: SentinelFinding[] = [];
    for (const invoice of invoices) {
      const total = money(invoice.totalAmount);
      const discount = money(invoice.discountAmount);
      const headerPct = money(invoice.headerDiscountPercent ?? 0);
      const discountPct = headerPct > 0 ? headerPct : total > 0 ? (discount / total) * 100 : 0;
      const belowCost = invoice.lines.find((line) => {
        const cost = money(line.item.averageCost);
        const price = money(line.price);
        return cost > 0 && price > 0 && price < cost * MARKUP_FLOOR;
      });
      const lineDiscount = invoice.lines.find((line) => money(line.discountPercent ?? 0) > DISCOUNT_THRESHOLD);
      if (discountPct <= DISCOUNT_THRESHOLD && !belowCost && !lineDiscount) continue;
      const customerName = invoice.customer?.arabicName || 'عميل';
      const pct = Math.max(discountPct, money(lineDiscount?.discountPercent ?? 0));
      findings.push({
        category: 'PROFIT_ANOMALY',
        severity: pct >= 25 || Boolean(belowCost) ? 'CRITICAL' : 'WARNING',
        targetRoles: CATEGORY_TARGET_ROLES.PROFIT_ANOMALY,
        titleAr: 'تدقيق خصم مبيعات',
        messageAr: belowCost
          ? `تدقيق رقابي: فاتورة ${invoice.invoiceNumber || invoice.id} للعميل ${customerName} تتضمن بيع ${belowCost.item.arabicName} بأقل من هامش التكلفة المعياري.`
          : `تدقيق رقابي: تم تسجيل فاتورة مبيعات للعميل ${customerName} بخصم ${pct.toFixed(1)}%، يرجى المراجعة والاعتماد.`,
        actionUrl: `/inventory/operations/sales-invoice?id=${encodeURIComponent(invoice.id)}`,
        actionLabelAr: 'مراجعة الفاتورة',
        fingerprint: `PROFIT_ANOMALY:${invoice.id}`,
        metadata: { invoiceId: invoice.id, customerName, discountPct: pct },
      });
    }
    return findings.slice(0, 12);
  }

  private async analyzeChequesDue(companyId: string, asOf: Date): Promise<SentinelFinding[]> {
    const todayStart = startOfDay(asOf);
    const rows = await prisma.cheque.findMany({
      where: {
        companyId,
        direction: 'INWARD',
        status: { in: INWARD_OPEN },
        dueDate: { lte: asOf },
      },
      select: { id: true, amount: true, dueDate: true },
    });
    if (!rows.length) return [];
    const dueToday = rows.filter((row) => row.dueDate && row.dueDate >= todayStart);
    const focus = dueToday.length ? dueToday : rows;
    const total = focus.reduce((sum, row) => sum + money(row.amount), 0);
    const overdue = rows.length - dueToday.length;
    return [
      {
        category: 'CHEQUE_DUE',
        severity: overdue > 0 ? 'CRITICAL' : 'WARNING',
        targetRoles: CATEGORY_TARGET_ROLES.CHEQUE_DUE,
        titleAr: 'شيكات واردة مستحقة',
        messageAr:
          dueToday.length > 0
            ? `لديك ${dueToday.length} شيكات واردة من عملاء تستحق التحصيل اليوم بإجمالي ${egp(total)}.`
            : `لديك ${overdue} شيكات واردة متأخرة التحصيل بإجمالي ${egp(total)}.`,
        actionUrl: '/accounting/cheques/incoming',
        actionLabelAr: 'عرض الشيكات المستحقة',
        fingerprint: `CHEQUE_DUE:${dayKey(asOf)}`,
        metadata: { count: focus.length, total, overdue },
      },
    ];
  }

  private async analyzeStockReorder(companyId: string, asOf: Date): Promise<SentinelFinding[]> {
    const balances = await prisma.itemWarehouseBalance.findMany({
      where: {
        companyId,
        item: { isActive: true, isService: false, inactiveItem: false },
      },
      select: {
        quantityOnHand: true,
        item: { select: { id: true, arabicName: true, orderLimit: true, lowerLimit: true } },
        warehouse: { select: { arabicName: true } },
      },
      take: 400,
    });
    const hits = balances
      .map((row) => {
        const qty = money(row.quantityOnHand);
        const limit = money(row.item.orderLimit ?? row.item.lowerLimit ?? 0);
        return { qty, limit, item: row.item, warehouse: row.warehouse.arabicName };
      })
      .filter((row) => row.limit > 0 && row.qty <= row.limit)
      .sort((a, b) => a.qty - b.qty)
      .slice(0, 8);
    return hits.map((row) => ({
      category: 'STOCK_REORDER' as const,
      severity: (row.qty <= 0 ? 'CRITICAL' : 'WARNING') as NotificationSeverity,
      targetRoles: CATEGORY_TARGET_ROLES.STOCK_REORDER,
      titleAr: 'نقص مخزون',
      messageAr: `نقص مخزون: الصنف ${row.item.arabicName} وصل لحد الطلب (المتبقي ${row.qty.toLocaleString('ar-EG')} وحدة فقط في مخزن ${row.warehouse}).`,
      actionUrl: '/purchases/invoices/new',
      actionLabelAr: 'إنشاء فاتورة شراء',
      fingerprint: `STOCK_REORDER:${row.item.id}:${dayKey(asOf)}`,
      metadata: { itemId: row.item.id, qty: row.qty, limit: row.limit, warehouse: row.warehouse },
    }));
  }

  private async analyzeExpiringBatches(companyId: string, asOf: Date): Promise<SentinelFinding[]> {
    const until = addDays(asOf, EXPIRY_DAYS);
    const lines = await prisma.invoiceLine.findMany({
      where: {
        expiryDate: { gte: asOf, lte: until },
        invoice: { companyId, isCancelled: false, invoiceKind: { in: ['PURCHASE', 'SALE'] } },
      },
      select: {
        expiryDate: true,
        quantity: true,
        batchNumber: true,
        item: { select: { id: true, arabicName: true } },
        warehouse: { select: { arabicName: true } },
      },
      take: 40,
    });
    if (!lines.length) return [];
    const sample = lines[0];
    const days = sample.expiryDate
      ? Math.max(0, Math.ceil((sample.expiryDate.getTime() - asOf.getTime()) / 86_400_000))
      : EXPIRY_DAYS;
    return [
      {
        category: 'EXPIRING_BATCH',
        severity: days <= 7 ? 'CRITICAL' : 'WARNING',
        targetRoles: CATEGORY_TARGET_ROLES.EXPIRING_BATCH,
        titleAr: 'دفعات قاربت الانتهاء',
        messageAr: `تنبيه صلاحية: ${lines.length} دفعات تنتهي خلال ${EXPIRY_DAYS} يوماً — أقربها ${sample.item.arabicName}${sample.batchNumber ? ` (تشغيلة ${sample.batchNumber})` : ''} خلال ${days} يوم.`,
        actionUrl: '/inventory/operations/issue',
        actionLabelAr: 'صرف الدفعات الأقرب',
        fingerprint: `EXPIRING_BATCH:${dayKey(asOf)}`,
        metadata: { count: lines.length, sampleItem: sample.item.arabicName, days },
      },
    ];
  }

  private async analyzeUnpostedDrafts(companyId: string, asOf: Date): Promise<SentinelFinding[]> {
    const cutoff = new Date(asOf.getTime() - DRAFT_HOURS * 60 * 60 * 1000);
    const [invoices, issues] = await Promise.all([
      prisma.invoice.count({
        where: { companyId, isPosted: false, isCancelled: false, createdAt: { lte: cutoff } },
      }),
      prisma.issue.count({
        where: { companyId, isPosted: false, isCancelled: false, createdAt: { lte: cutoff } },
      }),
    ]);
    const total = invoices + issues;
    if (total <= 0) return [];
    return [
      {
        category: 'UNPOSTED_DRAFTS',
        severity: total >= 10 ? 'CRITICAL' : 'WARNING',
        targetRoles: CATEGORY_TARGET_ROLES.UNPOSTED_DRAFTS,
        titleAr: 'مسودات معلّقة',
        messageAr: `يوجد ${total} مستندات معلقة كمسودة منذ أكثر من 48 ساعة لم يتم ترحيلها محاسبياً.`,
        actionUrl: '/inventory/operations/sales-invoice',
        actionLabelAr: 'مراجعة المسودات',
        fingerprint: `UNPOSTED_DRAFTS:${dayKey(asOf)}`,
        metadata: { invoices, issues, total },
      },
    ];
  }
}
