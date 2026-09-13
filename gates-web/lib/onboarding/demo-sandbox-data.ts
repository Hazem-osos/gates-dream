import type {
  AgingSummary,
  ExecutiveAnalytics,
  ExecutiveKpis,
  ExecutiveOverview,
} from '@/lib/hooks/useExecutiveDashboard';

function monthKey(offset: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function todayLocalDateOnly(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function buildSandboxKpis(): ExecutiveKpis {
  const salesByMonth: Record<string, number> = {};
  const purchaseByMonth: Record<string, number> = {};
  const sales = [412_000, 458_500, 501_200, 487_800, 533_400, 612_750];
  const purchases = [268_000, 291_400, 305_100, 298_600, 322_900, 348_200];
  for (let i = 5; i >= 0; i -= 1) {
    salesByMonth[monthKey(i)] = sales[5 - i];
    purchaseByMonth[monthKey(i)] = purchases[5 - i];
  }
  return {
    periodTotals: {
      monthlySales: 612_750,
      monthlyPurchases: 348_200,
      netProfitLoss: 186_420,
      month: monthKey(0),
    },
    monthlyTrend: { salesByMonth, purchaseByMonth },
    cashAndBankLiquidity: 1_284_500,
    topCustomers: [
      { customerId: 'demo-1', customerName: 'شركة النور للتجارة', revenue: 186_400 },
      { customerId: 'demo-2', customerName: 'مجموعة الأفق', revenue: 142_900 },
      { customerId: 'demo-3', customerName: 'مؤسسة وادي النيل', revenue: 98_250 },
    ],
    topProducts: [
      { itemId: 'i1', itemName: 'حديد تسليح 16 مم', quantity: 420, revenue: 214_000 },
      { itemId: 'i2', itemName: 'أسمنت بورتلاندي', quantity: 860, revenue: 129_500 },
    ],
    pendingDocuments: {
      unpostedJournalEntries: 3,
      unpostedInvoices: 5,
      unpostedTreasuryTransactions: 2,
      total: 10,
    },
  };
}

export function buildSandboxAging(kind: 'CUSTOMER' | 'SUPPLIER'): AgingSummary {
  const customerParties = [
    {
      partyName: 'شركة النور للتجارة',
      totalBalance: 186_400,
      buckets: { CURRENT: 92_000, PAST_DUE_31_60: 48_200, OVERDUE_61_90: 28_100, DELINQUENT_90_PLUS: 18_100 },
    },
    {
      partyName: 'مجموعة الأفق',
      totalBalance: 142_900,
      buckets: { CURRENT: 71_400, PAST_DUE_31_60: 36_000, OVERDUE_61_90: 22_500, DELINQUENT_90_PLUS: 13_000 },
    },
    {
      partyName: 'مؤسسة وادي النيل',
      totalBalance: 99_300,
      buckets: { CURRENT: 54_000, PAST_DUE_31_60: 24_800, OVERDUE_61_90: 12_500, DELINQUENT_90_PLUS: 8_000 },
    },
  ];
  const supplierParties = [
    {
      partyName: 'مصانع الحديد المتحدة',
      totalBalance: 98_200,
      buckets: { CURRENT: 52_000, PAST_DUE_31_60: 28_000, OVERDUE_61_90: 12_200, DELINQUENT_90_PLUS: 6_000 },
    },
    {
      partyName: 'شركة البناء الحديث',
      totalBalance: 64_150,
      buckets: { CURRENT: 38_000, PAST_DUE_31_60: 16_400, OVERDUE_61_90: 6_750, DELINQUENT_90_PLUS: 3_000 },
    },
    {
      partyName: 'تجارة الجملة المصرية',
      totalBalance: 34_000,
      buckets: { CURRENT: 22_000, PAST_DUE_31_60: 8_000, OVERDUE_61_90: 4_000, DELINQUENT_90_PLUS: 0 },
    },
  ];
  return {
    summary: {
      totalOutstanding: kind === 'CUSTOMER' ? 428_600 : 196_350,
      partyCount: kind === 'CUSTOMER' ? 18 : 9,
    },
    parties: kind === 'CUSTOMER' ? customerParties : supplierParties,
  };
}

export function buildSandboxOverview(): ExecutiveOverview {
  return {
    liquidity: {
      netAvailable: 1_284_500,
      safes: 186_400,
      banks: 1_098_100,
      sparkline: [920_000, 980_400, 1_040_200, 1_112_000, 1_198_600, 1_284_500],
    },
    monthlyPerformance: {
      revenue: 612_750,
      grossProfit: 264_550,
      grossMarginPct: 43.2,
      revenueGrowthPctVsLastMonth: 14.9,
      sparkline: [412_000, 458_500, 501_200, 487_800, 533_400, 612_750],
    },
    receivables: {
      total: 428_600,
      current: 217_400,
      overdueOver60Days: 79_700,
      sparkline: [360_000, 378_200, 401_500, 412_800, 420_100, 428_600],
    },
    shortTermCommitments: {
      total: 214_800,
      supplierApDue14Days: 86_400,
      outwardChequesDue14Days: 128_400,
    },
    chequesPipeline: {
      inwardDueThisWeek: { count: 4, amount: 96_500 },
      outwardDueNext7Days: { count: 3, amount: 72_200 },
      sparkline: [48_000, 62_000, 71_500, 80_200, 88_400, 96_500],
    },
    monthlyCashFlow: [
      { month: monthKey(5), inflow: 398_000, expense: 271_000 },
      { month: monthKey(4), inflow: 441_000, expense: 288_000 },
      { month: monthKey(3), inflow: 486_000, expense: 301_000 },
      { month: monthKey(2), inflow: 472_000, expense: 294_000 },
      { month: monthKey(1), inflow: 518_000, expense: 319_000 },
      { month: monthKey(0), inflow: 596_000, expense: 341_000 },
    ],
    dailyMilestone: {
      todaySales: 48_250,
      dailySalesTarget: 40_000,
      targetReached: true,
    },
    asOf: todayLocalDateOnly(),
  };
}

export function buildSandboxAnalytics(): ExecutiveAnalytics {
  return {
    topProfitableItems: [
      { itemId: 'i1', name: 'حديد تسليح 16 مم', grossProfit: 64_200, revenue: 214_000 },
      { itemId: 'i2', name: 'أسمنت بورتلاندي', grossProfit: 31_800, revenue: 129_500 },
      { itemId: 'i3', name: 'رمل مغسول', grossProfit: 18_400, revenue: 62_000 },
    ],
    topClientsByCollection: [
      { customerId: 'demo-1', customerName: 'شركة النور للتجارة', collectedAmount: 142_000 },
      { customerId: 'demo-2', customerName: 'مجموعة الأفق', collectedAmount: 98_600 },
      { customerId: 'demo-3', customerName: 'مؤسسة وادي النيل', collectedAmount: 71_250 },
    ],
    costCenterRanking: [
      {
        costCenterId: 'cc-1',
        name: 'فرع القاهرة',
        revenue: 312_400,
        cost: 198_200,
        profit: 114_200,
        budget: 340_000,
        budgetUtilizationPct: 91.9,
      },
      {
        costCenterId: 'cc-2',
        name: 'فرع الإسكندرية',
        revenue: 186_200,
        cost: 121_000,
        profit: 65_200,
        budget: 200_000,
        budgetUtilizationPct: 93.1,
      },
    ],
    branchHealth: [
      { branchId: 'b-1', name: 'القاهرة', revenue: 312_400 },
      { branchId: 'b-2', name: 'الإسكندرية', revenue: 186_200 },
      { branchId: 'b-3', name: 'المنصورة', revenue: 114_150 },
    ],
    periodDays: 30,
  };
}
