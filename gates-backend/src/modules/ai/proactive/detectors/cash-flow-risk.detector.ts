import { InsightCategory, InsightSeverity } from '@prisma/client';
import { addDays, isoDate, money, type AnomalyDetector, type DetectorFinding } from '../detector.types';

export type CashFlowPorts = {
  liquidCash: (companyId: string) => Promise<{ treasuryTotal: number; bankTotal: number }>;
  upcomingCheques: (
    companyId: string,
    from: Date,
    to: Date
  ) => Promise<Array<{ id: string; number: string; amount: number; dueDate: Date }>>;
  upcomingSecurities: (
    companyId: string,
    from: Date,
    to: Date
  ) => Promise<Array<{ id: string; number: string; amount: number; dueDate: Date }>>;
  upcomingSupplierInvoices: (
    companyId: string,
    from: Date,
    to: Date
  ) => Promise<Array<{ id: string; number: string; amount: number; dueDate: Date }>>;
};

const HORIZON_DAYS = 14;
const CRITICAL_RATIO = 1.1;

export function evaluateCashFlowRisk(input: {
  currentLiquidCash: number;
  upcomingObligations: number;
}): { flagged: boolean; severity: InsightSeverity; deficit: number } {
  const deficit = money(input.upcomingObligations - input.currentLiquidCash);
  if (input.upcomingObligations > input.currentLiquidCash * CRITICAL_RATIO) {
    return { flagged: true, severity: InsightSeverity.CRITICAL, deficit };
  }
  if (input.upcomingObligations > input.currentLiquidCash && input.upcomingObligations > 0) {
    return { flagged: true, severity: InsightSeverity.WARNING, deficit };
  }
  return { flagged: false, severity: InsightSeverity.INFO, deficit };
}

export class CashFlowRiskDetector implements AnomalyDetector {
  readonly name = 'CashFlowRiskDetector';

  constructor(private readonly ports: CashFlowPorts) {}

  async detect(ctx: { companyId: string; asOf: Date }): Promise<DetectorFinding[]> {
    const to = addDays(ctx.asOf, HORIZON_DAYS);
    const [cash, cheques, securities, invoices] = await Promise.all([
      this.ports.liquidCash(ctx.companyId),
      this.ports.upcomingCheques(ctx.companyId, ctx.asOf, to),
      this.ports.upcomingSecurities(ctx.companyId, ctx.asOf, to),
      this.ports.upcomingSupplierInvoices(ctx.companyId, ctx.asOf, to),
    ]);

    const chequeTotal = cheques.reduce((sum, row) => sum + money(row.amount), 0);
    const securitiesTotal = securities.reduce((sum, row) => sum + money(row.amount), 0);
    const supplierTotal = invoices.reduce((sum, row) => sum + money(row.amount), 0);
    const upcomingObligations = money(chequeTotal + securitiesTotal + supplierTotal);
    const currentLiquidCash = money(cash.treasuryTotal + cash.bankTotal);
    const verdict = evaluateCashFlowRisk({ currentLiquidCash, upcomingObligations });
    if (!verdict.flagged) return [];

    const sampleCheque = cheques[0]?.number;
    const title =
      verdict.severity === InsightSeverity.CRITICAL
        ? 'خطر سيولة: التزامات أسبوعين قادمين تفوق رصيد البنوك'
        : 'تنبيه سيولة: الالتزامات القادمة تقارب الرصيد النقدي';

    return [
      {
        category: InsightCategory.CASH_FLOW_RISK,
        severity: verdict.severity,
        title,
        fallbackSummary: [
          `الرصيد السائل ${currentLiquidCash.toLocaleString('en-US')} مقابل التزامات ${upcomingObligations.toLocaleString('en-US')} خلال ${HORIZON_DAYS} يوماً (عجز ${verdict.deficit.toLocaleString('en-US')}).`,
          sampleCheque
            ? `يُوصى بتأجيل سداد الشيك رقم ${sampleCheque} أو تحصيل مستحقات العملاء لتفادي عجز السيولة.`
            : 'يُوصى بتأجيل أوراق الدفع غير الحرجة أو تسريع التحصيل.',
        ].join(' '),
        deterministicData: {
          currentBalance: currentLiquidCash,
          treasuryTotal: money(cash.treasuryTotal),
          bankTotal: money(cash.bankTotal),
          upcomingObligations,
          chequeTotal,
          securitiesTotal,
          supplierTotal,
          deficit: verdict.deficit,
          horizonDays: HORIZON_DAYS,
          asOf: isoDate(ctx.asOf),
          sampleChequeNumbers: cheques.slice(0, 5).map((row) => row.number),
        },
        actionLink: '/accounting/operations/securities/payment',
        fingerprint: 'CASH_FLOW_RISK:14d',
      },
    ];
  }
}
