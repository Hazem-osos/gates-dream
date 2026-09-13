export type DashboardTone = 'red' | 'amber' | 'blue';

export function monthOverMonthHint(current?: number, previous?: number): string | undefined {
  if (current == null || previous == null) return undefined;
  if (previous === 0) return current === 0 ? undefined : 'ارتفاع عن الشهر السابق';
  const pct = ((current - previous) / Math.abs(previous)) * 100;
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(1)}٪ مقارنة بالشهر السابق`;
}

export type DashboardInboxItem = {
  id: string;
  tone: DashboardTone;
  title: string;
  detail: string;
  href: string;
  amount?: number;
  at: string;
};

export type DashboardActivityItem = {
  id: string;
  title: string;
  detail: string;
  status: string;
  href: string;
  at: string;
};

export type ContractingDashboardSummary = {
  asOfDate: string;
  kpis: {
    activeProjects: number;
    activeContractValue: number;
    portfolioCpi: number | null;
    portfolioSpi: number | null;
    earnedValue: number;
    actualCost: number;
    costVariance: number;
    budgetAtCompletion: number;
    lgActiveCount: number;
    lgActiveValue: number;
    lgFrozenMargin: number;
    lgExpiringIn30Days: number;
  };
  extractPipeline: { status: string; count: number; value: number }[];
  actionQueue: {
    unapprovedMeasurementSheets: number;
    pendingClientExtracts: number;
    extractsReadyForGl: number;
  };
  charts: {
    monthlyBilling: { name: string; billed: number; budget: number }[];
    costDistribution: { key: string; label: string; value: number }[];
  };
  inbox: DashboardInboxItem[];
  activity: DashboardActivityItem[];
};

export type SubcontractDashboardSummary = {
  asOfDate: string;
  kpis: {
    activeSubcontracts: number;
    committedValue: number;
    executedGross: number;
    executionRatio: number;
    invoicedToDate: number;
    retentionHeld: number;
    unappliedPenalties: number;
    pendingMaterialLogs: number;
    unpostedDrafts: number;
    pendingSiteApprovals: number;
    form41Withheld: number;
    form41Quarter: number;
    form41Year: number;
  };
  charts: {
    topSubcontractors: { id: string; name: string; contractNumber: string; invoiced: number }[];
    approvalFunnel: { status: string; count: number }[];
  };
  inbox: DashboardInboxItem[];
  activity: DashboardActivityItem[];
};

export type ExtractsDashboardSummary = {
  asOfDate: string;
  kpis: {
    activeProjects: number;
    portfolioValue: number;
    activeContractors: number;
    workItemAssignments: number;
    draftExtracts: number;
    postedExtracts: number;
    postedNetValue: number;
    totalPaid: number;
    outstandingPayable: number;
    pendingPayments: number;
  };
  charts: {
    topProjects: { id: string; name: string; serial: string | null; invoiced: number }[];
    statusFunnel: { label: string; value: number }[];
    monthlyBilling: { name: string; billed: number; budget: number }[];
  };
  inbox: DashboardInboxItem[];
  activity: DashboardActivityItem[];
};

export type RealEstateInvestmentDashboardSummary = {
  asOfDate: string;
  kpis: {
    projects: number;
    customers: number;
    unitsTotal: number;
    unitsAvailable: number;
    unitsReserved: number;
    unitsSold: number;
    availableInventoryValue: number;
    openReservations: number;
    openReservationValue: number;
    pendingReservations: number;
    confirmedReservations: number;
    expiringReservations: number;
    openFollowups: number;
    overdueFollowups: number;
  };
  inventory: { key: string; label: string; value: number }[];
  reservationFunnel: { label: string; value: number }[];
  charts: {
    monthlyReservations: { name: string; reserved: number; confirmed: number }[];
    unitValueByStatus: { key: string; label: string; value: number }[];
  };
  inbox: DashboardInboxItem[];
  activity: DashboardActivityItem[];
  stacking: Array<{
    id: string;
    name: string;
    projectName: string;
    totalFloors: number;
    units: Array<{
      id: string;
      unitCode: string;
      floor: number;
      netArea: number;
      totalPrice: number;
      status: string;
      reservation: {
        id: string;
        expiryDate: string | null;
        customerName: string;
        status: string;
        reservationAmount: number;
      } | null;
    }>;
  }>;
  expiring48h: Array<{
    id: string;
    unitCode: string;
    customerName: string;
    expiryDate: string | null;
    amount: number;
    status: string;
  }>;
  weekInstallments: Array<{
    id: string;
    contractId: string;
    contractNumber: string;
    customerName: string;
    unitCode: string;
    installmentNumber: number;
    dueDate: string;
    amount: number;
    balance: number;
    status: string;
  }>;
  collectionGauge: { expected: number; collected: number; weekDue: number };
};

export type ElectronicInvoiceDashboardSummary = {
  asOfDate: string;
  settings: { ready: boolean; environment: string; issuerName: string | null };
  kpis: {
    postedSales: number;
    notSubmitted: number;
    processing: number;
    valid: number;
    invalid: number;
    validValue: number;
    invalidValue: number;
    salesInvoices: number;
    returnsInvoices: number;
    amendments: number;
    salesValue: number;
    itemCards: number;
    customerCards: number;
    legacyDraft: number;
    legacySubmitted: number;
  };
  pipeline: { id: string; label: string; count: number }[];
  statusFunnel: { key: string; label: string; value: number }[];
  charts: { monthlySubmissions: { name: string; submitted: number; accepted: number }[] };
  inbox: DashboardInboxItem[];
  activity: DashboardActivityItem[];
};

export type RealEstateDashboardSummary = {
  asOfDate: string;
  kpis: {
    portfolioSales: number;
    cashCollected: number;
    collectionRatio: number;
    overdueCount: number;
    overdueDebt: number;
    lateFees: number;
    overdueOver60Count: number;
    overdueOver60Debt: number;
    chequesUnderCollection: number;
    unitsSold: number;
    unitsAvailable: number;
    unitsReserved: number;
    unitsTotal: number;
    resaleInProgress: number;
    resalePendingClearance: number;
  };
  cheques: {
    custody: { count: number; value: number };
    underCollection: { count: number; value: number };
    cleared: { count: number; value: number };
    bounced: { count: number; value: number };
  };
  inventory: { key: string; label: string; value: number }[];
  charts: { monthlyCash: { name: string; expected: number; collected: number }[] };
  inbox: DashboardInboxItem[];
  activity: DashboardActivityItem[];
};
