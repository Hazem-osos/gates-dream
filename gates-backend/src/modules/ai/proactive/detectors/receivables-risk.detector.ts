import { InsightCategory, InsightSeverity } from '@prisma/client';
import { isoDate, money, type AnomalyDetector, type DetectorFinding } from '../detector.types';

export type ReceivableCustomer = {
  customerId: string;
  customerName: string;
  overdue45: number;
  openBalance: number;
  creditLimit: number | null;
};

export type ReceivablesPorts = {
  loadCustomers: (companyId: string, asOf: Date) => Promise<ReceivableCustomer[]>;
};

const OVERDUE_DAYS = 45;

export function isReceivableRisk(row: ReceivableCustomer): boolean {
  if (money(row.overdue45) > 0) return true;
  if (row.creditLimit != null && row.creditLimit > 0 && money(row.openBalance) > money(row.creditLimit)) {
    return true;
  }
  return false;
}

export class ReceivablesRiskDetector implements AnomalyDetector {
  readonly name = 'ReceivablesRiskDetector';

  constructor(private readonly ports: ReceivablesPorts) {}

  async detect(ctx: { companyId: string; asOf: Date }): Promise<DetectorFinding[]> {
    const rows = (await this.ports.loadCustomers(ctx.companyId, ctx.asOf)).filter(isReceivableRisk);
    if (!rows.length) return [];

    const ranked = [...rows].sort((a, b) => money(b.overdue45 || b.openBalance) - money(a.overdue45 || a.openBalance));
    const totalOverdue = money(ranked.reduce((sum, row) => sum + money(row.overdue45), 0));
    const overLimit = ranked.filter(
      (row) => row.creditLimit != null && row.creditLimit > 0 && money(row.openBalance) > money(row.creditLimit)
    );
    const top = ranked[0];
    const severity =
      totalOverdue > 0 || overLimit.length > 0 ? InsightSeverity.WARNING : InsightSeverity.INFO;

    return [
      {
        category: InsightCategory.OVERDUE_RECEIVABLES,
        severity,
        title: `ذمم متأخرة: ${ranked.length} عملاء يتجاوزون ${OVERDUE_DAYS} يوماً أو حد الائتمان`,
        fallbackSummary: [
          `إجمالي المتأخر أكثر من ${OVERDUE_DAYS} يوماً: ${totalOverdue.toLocaleString('en-US')}.`,
          top
            ? `أكبر تعرض: ${top.customerName} (متأخر ${money(top.overdue45).toLocaleString('en-US')}). يُوصى بتحصيل مستحقات هذا العميل فوراً.`
            : '',
        ]
          .filter(Boolean)
          .join(' '),
        deterministicData: {
          asOf: isoDate(ctx.asOf),
          overdueDays: OVERDUE_DAYS,
          customerCount: ranked.length,
          totalOverdue45: totalOverdue,
          overCreditLimitCount: overLimit.length,
          customers: ranked.slice(0, 15).map((row) => ({
            customerId: row.customerId,
            customerName: row.customerName,
            overdue45: money(row.overdue45),
            openBalance: money(row.openBalance),
            creditLimit: row.creditLimit == null ? null : money(row.creditLimit),
          })),
        },
        actionLink: '/inventory/reports/overdue-payments',
        fingerprint: 'OVERDUE_RECEIVABLES:45d',
      },
    ];
  }
}
