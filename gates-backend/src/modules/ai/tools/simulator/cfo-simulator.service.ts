import { decideVerdict, isoDay, lookbackWindow, money, pct, projectScenario } from './cfo-simulator.math';
import type {
  CfoSimulatorBaseline,
  CfoSimulatorInput,
  CfoSimulatorPorts,
  CfoSimulatorResult,
} from './cfo-simulator.types';

export { projectScenario } from './cfo-simulator.math';

export class CfoSimulatorService {
  constructor(private readonly ports: CfoSimulatorPorts) {}

  async simulate(
    companyId: string,
    input: CfoSimulatorInput,
    options: { branchId?: string; fiscalYearId?: string } = {}
  ): Promise<CfoSimulatorResult> {
    const lookbackPeriodMonths = Math.min(24, Math.max(1, Math.round(input.lookbackPeriodMonths ?? 3)));
    const volumeDelta = input.expectedVolumeDeltaPercent ?? 0;
    const { start, end } = lookbackWindow(lookbackPeriodMonths);
    const periodDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000));

    const [statement, mix, receivables] = await Promise.all([
      this.ports.getIncomeStatement({
        companyId,
        branchId: options.branchId,
        fiscalYearId: options.fiscalYearId,
        startDate: start,
        endDate: end,
      }),
      this.ports.salesMix({
        companyId,
        branchId: options.branchId,
        startDate: start,
        endDate: end,
      }),
      this.ports.receivablesOutstanding({ companyId, branchId: options.branchId }),
    ]);

    const periodRevenue = Number(statement.summary?.totalRevenue ?? statement.revenues ?? 0);
    const periodCogs = Number(statement.summary?.costOfGoodsSold ?? statement.costOfGoodsSold ?? 0);
    const periodGrossProfit = Number(
      statement.summary?.grossProfit ?? statement.grossProfit ?? periodRevenue - periodCogs
    );
    const periodOperatingExpenses = Number(statement.summary?.totalExpenses ?? statement.operatingExpenses ?? 0);
    const currentMonthlyRevenue = money(periodRevenue / lookbackPeriodMonths);
    const monthlyCogs = money(periodCogs / lookbackPeriodMonths);
    const monthlyGrossProfit = money(periodGrossProfit / lookbackPeriodMonths);
    const monthlyOperatingExpenses = money(periodOperatingExpenses / lookbackPeriodMonths);
    const mixTotal = mix.cash + mix.credit;
    const cashSalesRatio = mixTotal > 0 ? mix.cash / mixTotal : 0;
    const dailySales = periodRevenue / periodDays;
    const dsoDays = dailySales > 0 ? money(receivables / dailySales) : 0;

    const baseline: CfoSimulatorBaseline = {
      lookbackFrom: isoDay(start),
      lookbackTo: isoDay(end),
      lookbackPeriodMonths,
      periodRevenue: money(periodRevenue),
      periodCogs: money(periodCogs),
      periodGrossProfit: money(periodGrossProfit),
      periodOperatingExpenses: money(periodOperatingExpenses),
      currentMonthlyRevenue,
      monthlyCogs,
      monthlyGrossProfit,
      monthlyOperatingExpenses,
      grossMarginPercent: currentMonthlyRevenue > 0 ? pct((monthlyGrossProfit / currentMonthlyRevenue) * 100) : 0,
      cashSalesRatio: pct(cashSalesRatio * 100),
      creditSalesRatio: pct((1 - cashSalesRatio) * 100),
      dsoDays,
      receivablesOutstanding: money(receivables),
    };

    const projected = projectScenario({
      scenarioType: input.scenarioType,
      percentageDelta: input.percentageDelta,
      volumeDelta,
      monthlyRevenue: currentMonthlyRevenue,
      monthlyCogs,
      monthlyExpenses: monthlyOperatingExpenses,
      cashRatio: cashSalesRatio,
      dsoDays,
    });

    const decision = decideVerdict({
      scenarioType: input.scenarioType,
      marginImpactEgp: projected.marginImpactEgp,
      cashFreedEgp: projected.cashFreedEgp,
      netProfitImpactEgp: projected.netProfitImpactEgp,
      cashAccelerationDays: projected.cashAccelerationDays,
      monthlyRevenue: currentMonthlyRevenue,
    });

    const projectedGrossMarginPercent =
      projected.projectedMonthlyRevenue > 0
        ? pct((projected.projectedGrossProfit / projected.projectedMonthlyRevenue) * 100)
        : 0;

    return {
      scenarioType: input.scenarioType,
      percentageDelta:
        input.scenarioType === 'CASH_DISCOUNT_OFFER' && input.percentageDelta > 0
          ? -input.percentageDelta
          : input.percentageDelta,
      expectedVolumeDeltaPercent: volumeDelta,
      currentMonthlyRevenue,
      projectedMonthlyRevenue: projected.projectedMonthlyRevenue,
      projectedGrossMarginPercent,
      marginImpactEgp: projected.marginImpactEgp,
      netProfitImpactEgp: projected.netProfitImpactEgp,
      cashAccelerationDays: projected.cashAccelerationDays,
      cashFreedEgp: projected.cashFreedEgp,
      workingCapitalDeltaEgp: projected.workingCapitalDeltaEgp,
      breakEvenVolumeDeltaPercent: projected.breakEvenVolumeDeltaPercent,
      verdict: decision.verdict,
      executiveRecommendation: decision.executiveRecommendation,
      baseline,
      assumptions: [
        ...projected.assumptions,
        `الأساس من قيود الأستاذ والفواتير المرحلة خلال ${lookbackPeriodMonths} أشهر (${baseline.lookbackFrom} إلى ${baseline.lookbackTo}).`,
      ],
    };
  }
}
