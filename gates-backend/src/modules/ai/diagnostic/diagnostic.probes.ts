import { addDays } from '../sentinel/sentinel.math';
import {
  bandScore,
  clampScore,
  healthStatus,
  money,
  pct,
} from './diagnostic.math';
import type {
  BelowReplacementRow,
  ContractingProjectRow,
  CustomerRevenueRow,
  PayrollSnapshot,
  ProductionSnapshot,
  RealEstateSnapshot,
  StockItemRow,
} from './diagnostic.ports';
import {
  PROBE_LABEL_AR,
  PROBE_LICENSE,
  PROBE_WEIGHT,
  type DiagnosticProbeResult,
} from './diagnostic.types';

function pack(
  key: DiagnosticProbeResult['key'],
  score: number,
  metrics: DiagnosticProbeResult['metrics'],
  findings: string[],
  actions: DiagnosticProbeResult['actions']
): DiagnosticProbeResult {
  const rounded = clampScore(score);
  return {
    key,
    labelAr: PROBE_LABEL_AR[key],
    licenseCode: PROBE_LICENSE[key],
    score: rounded,
    weight: PROBE_WEIGHT[key],
    status: healthStatus(rounded),
    metrics,
    findings,
    actions,
  };
}

export function evaluateFinancial(input: {
  liquid: number;
  sales30: number;
  purchases30: number;
  receivables: number;
  payables: number;
  inventoryValue: number;
}): DiagnosticProbeResult {
  const burn = Math.max(money(input.purchases30), 1);
  const netIncome = money(input.sales30 - input.purchases30);
  const coverageMonths = money(input.liquid / burn);
  const workingCapital = money(input.liquid + input.receivables + input.inventoryValue - input.payables);
  const cashQuality = input.sales30 > 0 ? pct(input.liquid, input.sales30) : input.liquid > 0 ? 100 : 40;

  const coverageScore = bandScore(coverageMonths, [
    { max: 0.5, score: 25 },
    { max: 1, score: 45 },
    { max: 3, score: 70 },
    { max: 6, score: 88 },
    { max: 999, score: 96 },
  ]);
  const qualityScore =
    netIncome >= 0 ? clampScore(60 + Math.min(40, cashQuality / 2)) : clampScore(40 + Math.min(20, coverageMonths * 8));
  const wcScore = workingCapital >= 0 ? (workingCapital >= input.sales30 * 0.2 ? 92 : 78) : 40;
  const score = (coverageScore + qualityScore + wcScore) / 3;

  const findings: string[] = [];
  if (coverageMonths < 1) findings.push(`تغطية الحرق النقدي ${coverageMonths} شهراً فقط.`);
  if (netIncome < 0) findings.push(`صافي الفترة سالب بمقدار ${money(Math.abs(netIncome))}.`);
  if (workingCapital < 0) findings.push(`رأس المال العامل سالب (${workingCapital}).`);
  if (!findings.length) findings.push('السيولة ورأس المال العامل داخل نطاق تشغيلي مقبول.');

  return pack(
    'financial',
    score,
    [
      { id: 'coverage', label: 'تغطية الحرق (شهر)', value: coverageMonths, unit: 'months', score: coverageScore },
      { id: 'cashQuality', label: 'سيولة إلى مبيعات 30ي %', value: cashQuality, unit: 'percent', score: qualityScore },
      { id: 'workingCapital', label: 'رأس المال العامل', value: workingCapital, unit: 'money', score: wcScore },
    ],
    findings,
    [{ label: 'فتح الخزينة', href: '/accounting' }]
  );
}

export function evaluateSales(input: {
  customers: CustomerRevenueRow[];
  receivables: number;
  overdue: number;
  overdue90: number;
  sales90: number;
}): DiagnosticProbeResult {
  const ranked = [...input.customers].sort((a, b) => b.revenue - a.revenue);
  const total = ranked.reduce((sum, row) => sum + row.revenue, 0);
  const top3 = ranked.slice(0, 3).reduce((sum, row) => sum + row.revenue, 0);
  const concentration = total > 0 ? pct(top3, total) : 0;
  const dailySales = input.sales90 > 0 ? input.sales90 / 90 : 0;
  const dso = dailySales > 0 ? money(input.receivables / dailySales) : 0;
  const overdueRatio = input.receivables > 0 ? pct(input.overdue, input.receivables) : 0;

  const concScore = invertHigh(concentration, [40, 60, 80], [96, 78, 52, 28]);
  const dsoScore = invertHigh(dso, [45, 60, 90], [96, 78, 55, 30]);
  const overdueScore = invertHigh(overdueRatio, [10, 25, 40], [96, 74, 48, 22]);
  const score = (concScore + dsoScore + overdueScore) / 3;
  const topName = ranked[0]?.customerName;

  const findings: string[] = [];
  if (concentration >= 60) findings.push(`تركّز الإيراد: أعلى 3 عملاء يمثلون ${concentration}٪.`);
  if (dso > 60) findings.push(`فترة التحصيل ${dso} يوماً.`);
  if (overdueRatio >= 25) findings.push(`المتأخرات ${overdueRatio}٪ من المدينين (${input.overdue90} فوق 90 يوماً).`);
  if (!findings.length) findings.push('تنويع العملاء والتحصيل داخل الحدود المقبولة.');

  return pack(
    'sales',
    score,
    [
      { id: 'concentration', label: 'تركّز أعلى 3 عملاء %', value: concentration, unit: 'percent', score: concScore },
      { id: 'dso', label: 'أيام التحصيل DSO', value: dso, unit: 'days', score: dsoScore },
      { id: 'overdue', label: 'نسبة المتأخرات %', value: overdueRatio, unit: 'percent', score: overdueScore },
    ],
    findings,
    [
      {
        label: topName ? `فحص فواتير العميل ${topName}` : 'فتح المبيعات',
        href: '/sales',
      },
    ]
  );
}

export function evaluateInventory(input: {
  items: StockItemRow[];
  cogs90: number;
  inventoryValue: number;
  belowReplacement: BelowReplacementRow[];
  asOf: Date;
}): DiagnosticProbeResult {
  const cutoff = addDays(input.asOf, -60);
  let trapped = 0;
  let totalValue = 0;
  for (const item of input.items) {
    const value = money(item.quantityOnHand * item.averageCost);
    if (value <= 0) continue;
    totalValue += value;
    const stagnant = !item.lastSaleAt || item.lastSaleAt.getTime() < cutoff.getTime();
    if (stagnant) trapped += value;
  }
  const inventoryValue = totalValue || input.inventoryValue;
  const trappedPct = inventoryValue > 0 ? pct(trapped, inventoryValue) : 0;
  const dailyCogs = input.cogs90 > 0 ? input.cogs90 / 90 : 0;
  const dsi = dailyCogs > 0 ? money(inventoryValue / dailyCogs) : 0;
  const gapCount = input.belowReplacement.length;

  const trappedScore = invertHigh(trappedPct, [15, 30, 50], [95, 76, 50, 28]);
  const dsiScore = invertHigh(dsi, [45, 75, 120], [94, 76, 54, 30]);
  const gapScore = invertHigh(gapCount, [0, 3, 8], [96, 80, 55, 32]);
  const score = (trappedScore + dsiScore + gapScore) / 3;

  const findings: string[] = [];
  if (trappedPct >= 30) findings.push(`رأس مال محبوس في راكد (>60 يوماً): ${trappedPct}٪ بقيمة ${money(trapped)}.`);
  if (dsi > 75) findings.push(`دوران المخزون بطيء: DSI ${dsi} يوماً.`);
  if (gapCount) findings.push(`${gapCount} أصناف تُباع دون تكلفة الإحلال.`);
  if (!findings.length) findings.push('المخزون يدور دون تآكل هوامش الإحلال.');

  const sample = input.belowReplacement[0]?.itemName;
  return pack(
    'inventory',
    score,
    [
      { id: 'trapped', label: 'رأس مال راكد %', value: trappedPct, unit: 'percent', score: trappedScore },
      { id: 'dsi', label: 'أيام المخزون DSI', value: dsi, unit: 'days', score: dsiScore },
      { id: 'replacementGaps', label: 'فجوات تكلفة الإحلال', value: gapCount, unit: 'count', score: gapScore },
    ],
    findings,
    [{ label: sample ? `مراجعة صنف ${sample}` : 'فتح المخزون', href: '/inventory' }]
  );
}

export function evaluateContracting(input: {
  projects: ContractingProjectRow[];
  liquid: number;
}): DiagnosticProbeResult {
  const subDue = money(input.projects.reduce((sum, row) => sum + row.subcontractorDue, 0));
  const owner = money(input.projects.reduce((sum, row) => sum + row.ownerInflow, 0));
  const gap = money(subDue - owner - input.liquid);
  const mismatchPct = subDue > 0 ? pct(Math.max(gap, 0), subDue) : 0;
  const overruns = input.projects.filter((row) => row.actualCost > row.estimatedCost && row.estimatedCost > 0);
  const overrunPct =
    input.projects.length > 0 ? pct(overruns.length, input.projects.length) : 0;
  const worst = [...input.projects].sort(
    (a, b) => b.subcontractorDue - b.ownerInflow - (a.subcontractorDue - a.ownerInflow)
  )[0];

  const gapScore = invertHigh(mismatchPct, [5, 20, 40], [95, 72, 48, 24]);
  const overrunScore = invertHigh(overrunPct, [10, 25, 40], [94, 74, 50, 28]);
  const score = (gapScore + overrunScore) / 2;

  const findings: string[] = [];
  if (gap > 0) findings.push(`فجوة سيولة مقاولات ${gap} (مقاولون ${subDue} مقابل مالك ${owner} وسيولة ${input.liquid}).`);
  if (overruns.length) findings.push(`${overruns.length} مشروع يتجاوز تكلفة المقايسة التقديرية.`);
  if (!findings.length) findings.push('مستخلصات المالك تغطي التزامات المقاولين داخل الأفق.');

  return pack(
    'contracting',
    score,
    [
      { id: 'mismatch', label: 'فجوة سيولة المقاولات %', value: mismatchPct, unit: 'percent', score: gapScore },
      { id: 'overrun', label: 'مشاريع متجاوزة للمقايسة %', value: overrunPct, unit: 'percent', score: overrunScore },
      { id: 'gapMoney', label: 'العجز النقدي', value: Math.max(gap, 0), unit: 'money', score: gapScore },
    ],
    findings,
    [
      {
        label: worst ? `مراجعة مستخلصات المقاول — ${worst.projectName}` : 'فتح المقاولات',
        href: '/contracting',
      },
    ]
  );
}

export function evaluateManufacturing(input: ProductionSnapshot): DiagnosticProbeResult {
  const utilization = input.plannedQuantity > 0 ? pct(input.actualQuantity, input.plannedQuantity) : 0;
  const scrapVariance =
    input.standardMaterialQty > 0
      ? pct(Math.max(input.issuedMaterialQty - input.standardMaterialQty, 0), input.standardMaterialQty)
      : 0;
  const noData = input.plannedQuantity <= 0 && input.standardMaterialQty <= 0;

  const utilScore = noData
    ? 85
    : utilization >= 80 && utilization <= 110
      ? 94
      : utilization >= 60
        ? 70
        : 42;
  const scrapScore = noData ? 85 : invertHigh(scrapVariance, [5, 12, 25], [96, 74, 50, 28]);
  const score = (utilScore + scrapScore) / 2;

  const findings: string[] = [];
  if (noData) findings.push('لا أوامر تشغيل مكتملة أو مصروفة خلال 90 يوماً.');
  else {
    if (utilization < 70) findings.push(`استغلال الطاقة ${utilization}٪ من الكمية المخططة.`);
    if (scrapVariance > 12) findings.push(`انحراف الهالك ${scrapVariance}٪ فوق المعياري.`);
    if (!findings.length) findings.push('الهالك واستغلال الطاقة ضمن المعيار.');
  }

  return pack(
    'manufacturing',
    score,
    [
      { id: 'utilization', label: 'استغلال الطاقة %', value: utilization, unit: 'percent', score: utilScore },
      { id: 'scrap', label: 'انحراف الهالك %', value: scrapVariance, unit: 'percent', score: scrapScore },
    ],
    findings,
    [{ label: 'أوامر التشغيل', href: '/manufacturing' }]
  );
}

export function evaluateRealEstate(input: RealEstateSnapshot): DiagnosticProbeResult {
  const absorption = input.totalUnits > 0 ? pct(input.absorbedUnits, input.totalUnits) : 0;
  const defaultRate = input.dueInstallments > 0 ? pct(input.overdueInstallments, input.dueInstallments) : 0;
  const noData = input.totalUnits <= 0;

  const absScore = noData ? 85 : bandScore(absorption, [
    { max: 20, score: 40 },
    { max: 40, score: 62 },
    { max: 70, score: 82 },
    { max: 100, score: 94 },
  ]);
  const defaultScore = noData ? 85 : invertHigh(defaultRate, [8, 18, 30], [95, 72, 48, 26]);
  const score = (absScore + defaultScore) / 2;

  const findings: string[] = [];
  if (noData) findings.push('لا وحدات عقارية مسجّلة للفحص.');
  else {
    if (absorption < 40) findings.push(`معدل الامتصاص ${absorption}٪ فقط من الوحدات.`);
    if (defaultRate >= 18) findings.push(`تعثّر الأقساط ${defaultRate}٪ من المستحق.`);
    if (!findings.length) findings.push('الامتصاص وتحصيل الأقساط في مسار آمن.');
  }

  return pack(
    'real-estate',
    score,
    [
      { id: 'absorption', label: 'معدل امتصاص الوحدات %', value: absorption, unit: 'percent', score: absScore },
      { id: 'defaults', label: 'تعثّر الأقساط %', value: defaultRate, unit: 'percent', score: defaultScore },
    ],
    findings,
    [{ label: 'عقود الوحدات', href: '/real-estate/contracts' }]
  );
}

export function evaluateHr(input: { payroll: PayrollSnapshot | null; sales30: number }): DiagnosticProbeResult {
  if (!input.payroll) {
    return pack(
      'hr',
      85,
      [
        { id: 'payrollRatio', label: 'الرواتب إلى الإيراد %', value: 0, unit: 'percent', score: 85 },
        { id: 'overtime', label: 'تسرّب الوقت الإضافي %', value: 0, unit: 'percent', score: 85 },
      ],
      ['لا توجد مسيرات رواتب مرحّلة للمقارنة.'],
      [{ label: 'المرتبات', href: '/hr/monthly-salaries' }]
    );
  }
  const payrollRatio = input.sales30 > 0 ? pct(input.payroll.gross, input.sales30) : 0;
  const overtimeLeak = input.payroll.gross > 0 ? pct(input.payroll.overtime, input.payroll.gross) : 0;
  const ratioScore = invertHigh(payrollRatio, [25, 40, 55], [94, 74, 50, 28]);
  const otScore = invertHigh(overtimeLeak, [8, 15, 25], [96, 76, 52, 30]);
  const score = (ratioScore + otScore) / 2;

  const findings: string[] = [];
  if (payrollRatio > 40) findings.push(`الرواتب تبتلع ${payrollRatio}٪ من إيراد 30 يوماً.`);
  if (overtimeLeak > 15) findings.push(`الوقت الإضافي ${overtimeLeak}٪ من الإجمالي.`);
  if (!findings.length) findings.push('تكلفة الأجور والوقت الإضافي ضمن السقف.');

  return pack(
    'hr',
    score,
    [
      { id: 'payrollRatio', label: 'الرواتب إلى الإيراد %', value: payrollRatio, unit: 'percent', score: ratioScore },
      { id: 'overtime', label: 'تسرّب الوقت الإضافي %', value: overtimeLeak, unit: 'percent', score: otScore },
    ],
    findings,
    [{ label: 'مراجعة الوقت الإضافي', href: '/hr/employee-absence-overtime' }]
  );
}

function invertHigh(value: number, cuts: [number, number, number], scores: [number, number, number, number]): number {
  if (value <= cuts[0]) return scores[0];
  if (value <= cuts[1]) return scores[1];
  if (value <= cuts[2]) return scores[2];
  return scores[3];
}

