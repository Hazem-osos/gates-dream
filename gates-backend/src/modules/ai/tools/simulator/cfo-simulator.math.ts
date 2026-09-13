import type { CfoScenarioType, CfoSimulatorVerdict } from './cfo-simulator.types';

export const MONTHLY_COST_OF_CAPITAL = 0.015;

export function money(value: number): number {
  return Math.round(value * 100) / 100;
}

export function pct(value: number): number {
  return Math.round(value * 100) / 100;
}

export function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function lookbackWindow(months: number): { start: Date; end: Date } {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const start = new Date(now.getFullYear(), now.getMonth() - months, 1, 0, 0, 0, 0);
  return { start, end };
}

export function projectScenario(input: {
  scenarioType: CfoScenarioType;
  percentageDelta: number;
  volumeDelta: number;
  monthlyRevenue: number;
  monthlyCogs: number;
  monthlyExpenses: number;
  cashRatio: number;
  dsoDays: number;
}): {
  projectedMonthlyRevenue: number;
  projectedGrossProfit: number;
  projectedNetProfit: number;
  marginImpactEgp: number;
  netProfitImpactEgp: number;
  cashAccelerationDays: number;
  cashFreedEgp: number;
  workingCapitalDeltaEgp: number;
  newCashRatio: number;
  breakEvenVolumeDeltaPercent: number | null;
  assumptions: string[];
} {
  const signedDelta =
    input.scenarioType === 'CASH_DISCOUNT_OFFER' && input.percentageDelta > 0
      ? -input.percentageDelta
      : input.percentageDelta;
  const priceDelta = signedDelta / 100;
  const volume = input.volumeDelta / 100;
  const cashRatio = Math.min(1, Math.max(0, input.cashRatio));
  const creditRatio = 1 - cashRatio;
  const oldGp = input.monthlyRevenue - input.monthlyCogs;
  const oldNp = oldGp - input.monthlyExpenses;
  const assumptions: string[] = [
    `تكلفة رأس المال العامل المستخدمة في الحكم: ${(MONTHLY_COST_OF_CAPITAL * 100).toFixed(1)}٪ شهرياً.`,
  ];

  if (input.scenarioType === 'CASH_DISCOUNT_OFFER') {
    const discount = Math.abs(priceDelta);
    const shift = Math.min(0.2, discount * 3);
    const newCashRatio = Math.min(1, cashRatio + creditRatio * shift);
    const newCreditRatio = 1 - newCashRatio;
    const volumeFactor = 1 + volume;
    const cashSlice = input.monthlyRevenue * newCashRatio * volumeFactor * (1 - discount);
    const creditSlice = input.monthlyRevenue * newCreditRatio * volumeFactor;
    const projectedMonthlyRevenue = cashSlice + creditSlice;
    const projectedCogs = input.monthlyCogs * volumeFactor;
    const projectedGrossProfit = projectedMonthlyRevenue - projectedCogs;
    const projectedNetProfit = projectedGrossProfit - input.monthlyExpenses;
    const cashAccelerationDays =
      creditRatio > 0.02 ? money(input.dsoDays * (1 - newCreditRatio / creditRatio)) : 0;
    const dailySales = input.monthlyRevenue / 30;
    const cashFreedEgp = money(Math.max(0, cashAccelerationDays) * dailySales);
    const marginImpactEgp = money(projectedGrossProfit - oldGp);
    const workingCapitalDeltaEgp = money(cashFreedEgp + marginImpactEgp);
    const gpAfterDiscountNoVolume =
      input.monthlyRevenue * (cashRatio * (1 - discount) + creditRatio) - input.monthlyCogs;
    const breakEvenVolumeDeltaPercent =
      input.monthlyRevenue - input.monthlyCogs > 0
        ? pct(((oldGp - gpAfterDiscountNoVolume) / Math.max(input.monthlyRevenue - input.monthlyCogs, 1)) * 100)
        : null;
    assumptions.push(
      `الخصم يُطبَّق على المبيعات النقدية فقط، مع تحول تقديري ${(shift * 100).toFixed(1)}٪ من الآجل إلى كاش.`
    );
    return {
      projectedMonthlyRevenue: money(projectedMonthlyRevenue),
      projectedGrossProfit: money(projectedGrossProfit),
      projectedNetProfit: money(projectedNetProfit),
      marginImpactEgp,
      netProfitImpactEgp: money(projectedNetProfit - oldNp),
      cashAccelerationDays: money(Math.max(0, cashAccelerationDays)),
      cashFreedEgp,
      workingCapitalDeltaEgp,
      newCashRatio,
      breakEvenVolumeDeltaPercent,
      assumptions,
    };
  }

  if (input.scenarioType === 'PRICE_ADJUSTMENT') {
    const projectedMonthlyRevenue = input.monthlyRevenue * (1 + volume) * (1 + priceDelta);
    const projectedCogs = input.monthlyCogs * (1 + volume);
    const projectedGrossProfit = projectedMonthlyRevenue - projectedCogs;
    const projectedNetProfit = projectedGrossProfit - input.monthlyExpenses;
    const denom = input.monthlyRevenue * (1 + priceDelta) - input.monthlyCogs;
    const breakEvenVolumeDeltaPercent =
      denom !== 0 ? pct(((-input.monthlyRevenue * priceDelta) / denom) * 100) : null;
    assumptions.push('تكلفة البضاعة تتغير مع الحجم فقط، وليس مع تعديل السعر.');
    return {
      projectedMonthlyRevenue: money(projectedMonthlyRevenue),
      projectedGrossProfit: money(projectedGrossProfit),
      projectedNetProfit: money(projectedNetProfit),
      marginImpactEgp: money(projectedGrossProfit - oldGp),
      netProfitImpactEgp: money(projectedNetProfit - oldNp),
      cashAccelerationDays: 0,
      cashFreedEgp: 0,
      workingCapitalDeltaEgp: money((projectedMonthlyRevenue - input.monthlyRevenue) * creditRatio),
      newCashRatio: cashRatio,
      breakEvenVolumeDeltaPercent,
      assumptions,
    };
  }

  const expenseDelta = input.monthlyExpenses * priceDelta;
  const projectedMonthlyRevenue = input.monthlyRevenue * (1 + volume);
  const projectedCogs = input.monthlyCogs * (1 + volume);
  const projectedGrossProfit = projectedMonthlyRevenue - projectedCogs;
  const projectedExpenses = input.monthlyExpenses + expenseDelta;
  const projectedNetProfit = projectedGrossProfit - projectedExpenses;
  const breakEvenVolumeDeltaPercent = oldGp > 0 ? pct((expenseDelta / oldGp) * 100) : null;
  assumptions.push('زيادة الأعباء تُحمَّل تحت مجمل الربح (مصروف تشغيلي) وتخفض السيولة شهرياً بنفس القيمة.');
  return {
    projectedMonthlyRevenue: money(projectedMonthlyRevenue),
    projectedGrossProfit: money(projectedGrossProfit),
    projectedNetProfit: money(projectedNetProfit),
    marginImpactEgp: money(projectedGrossProfit - oldGp),
    netProfitImpactEgp: money(projectedNetProfit - oldNp),
    cashAccelerationDays: 0,
    cashFreedEgp: 0,
    workingCapitalDeltaEgp: money(-expenseDelta),
    newCashRatio: cashRatio,
    breakEvenVolumeDeltaPercent,
    assumptions,
  };
}

export function decideVerdict(input: {
  scenarioType: CfoScenarioType;
  marginImpactEgp: number;
  cashFreedEgp: number;
  netProfitImpactEgp: number;
  cashAccelerationDays: number;
  monthlyRevenue: number;
}): { verdict: CfoSimulatorVerdict; executiveRecommendation: string } {
  const capitalBenefit = input.cashFreedEgp * MONTHLY_COST_OF_CAPITAL;

  if (input.scenarioType === 'CASH_DISCOUNT_OFFER') {
    const net = input.marginImpactEgp + capitalBenefit;
    if (input.cashAccelerationDays >= 4 && net >= 0) {
      return {
        verdict: 'APPLY',
        executiveRecommendation:
          'طبق عرض خصم الكاش: تسريع التحصيل يغطي تنازل الهامش وفق تكلفة رأس المال المستخدمة.',
      };
    }
    if (input.cashAccelerationDays >= 2 && input.marginImpactEgp > -input.monthlyRevenue * 0.02) {
      return {
        verdict: 'APPLY_WITH_CONDITIONS',
        executiveRecommendation:
          'طبق بشروط: قصّر العرض على عملاء الكاش الفعليين لمدة شهر واحد وقِس تحول الآجل قبل التثبيت.',
      };
    }
    return {
      verdict: 'DO_NOT_APPLY',
      executiveRecommendation:
        'لا تطبق: تكلفة الهامش أكبر من السيولة المُحرَّرة، والعرض يضعف الربحية دون مقابل تحصيل كافٍ.',
    };
  }

  if (input.scenarioType === 'PRICE_ADJUSTMENT') {
    if (input.marginImpactEgp > 0 && input.netProfitImpactEgp > 0) {
      return {
        verdict: 'APPLY',
        executiveRecommendation: 'طبق تعديل السعر: مجمل الربح وصافي الفترة يرتفعان على الأساس التاريخي الحالي.',
      };
    }
    if (input.marginImpactEgp >= 0) {
      return {
        verdict: 'APPLY_WITH_CONDITIONS',
        executiveRecommendation: 'طبق بشروط: راقب تراجع الكمية حتى نقطة التعادل قبل تعميم الزيادة على كل العملاء.',
      };
    }
    return {
      verdict: 'DO_NOT_APPLY',
      executiveRecommendation: 'لا تطبق: السيناريو يخفض مجمل الربح على أساس المبيعات التاريخية.',
    };
  }

  if (input.netProfitImpactEgp >= 0) {
    return {
      verdict: 'APPLY',
      executiveRecommendation: 'طبق: الأثر الصافي على الربحية موجب أو محايد بعد زيادة الأعباء.',
    };
  }
  if (Math.abs(input.netProfitImpactEgp) <= input.monthlyRevenue * 0.01) {
    return {
      verdict: 'APPLY_WITH_CONDITIONS',
      executiveRecommendation: 'طبق بشروط: الأثر محدود، اربطه بزيادة إيراد أو كفاءة تغطي المصروف الإضافي خلال ربع.',
    };
  }
  return {
    verdict: 'DO_NOT_APPLY',
    executiveRecommendation: 'لا تطبق: زيادة الأعباء تأكل صافي الربح وتضغط رأس المال العامل دون مقابل إيراد ظاهر.',
  };
}
