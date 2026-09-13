export const VOID_RATE_THRESHOLD = 0.05;
export const BACKDATE_DAYS = 3;
export const FRAUD_LOOKBACK_DAYS = 90;
export const SHORTAGE_WINDOW_DAYS = 30;
export const SHORTAGE_REPEAT_MIN = 2;
export const REPLACEMENT_LOOKBACK_DAYS = 7;
export const REPLACEMENT_MARKUP = 0.08;
export const CASHFLOW_HORIZON_DAYS = 21;
export const SENTINEL_CACHE_MAX_AGE_MS = 18 * 60 * 60 * 1000;
export const SENTINEL_NARRATIVE_MODEL = 'gpt-5.6-luna';

export type SentinelSeverity = 'info' | 'warn' | 'crit';

export type VoidPatternFlag = {
  type: 'VOID_PATTERN';
  severity: SentinelSeverity;
  userId: string;
  userName: string;
  cancelledVolume: number;
  totalVolume: number;
  voidRate: number;
  cancelledCount: number;
  totalCount: number;
  inspectHref: string;
};

export type BackdatedInvoiceFlag = {
  type: 'BACKDATED_INVOICE';
  severity: SentinelSeverity;
  invoiceId: string;
  invoiceNumber: string;
  userId: string | null;
  userName: string;
  invoiceDate: string;
  createdAt: string;
  lagDays: number;
  inspectHref: string;
};

export type ShortageWriteoffFlag = {
  type: 'REPEATED_SHORTAGE';
  severity: SentinelSeverity;
  itemId: string;
  itemName: string;
  itemCode: string | null;
  eventCount: number;
  totalShortageQty: number;
  windowDays: number;
  inspectHref: string;
};

export type ReplacementCostFlag = {
  type: 'BELOW_REPLACEMENT';
  severity: SentinelSeverity;
  itemId: string;
  itemName: string;
  invoiceId: string;
  invoiceNumber: string;
  salePrice: number;
  replacementCost: number;
  averageCost: number;
  suggestedSalePrice: number;
  soldAboveAverageCost: boolean;
  inspectHref: string;
};

export type ContractingCashGapFlag = {
  type: 'CONTRACTING_CASH_GAP';
  severity: SentinelSeverity;
  projectId: string;
  projectName: string;
  projectCode: string;
  subcontractorDue21d: number;
  ownerInflow21d: number;
  liquidAvailable: number;
  gap: number;
  inspectHref: string;
};

export type SentinelFraudResult = {
  voidPatterns: VoidPatternFlag[];
  backdated: BackdatedInvoiceFlag[];
  shortages: ShortageWriteoffFlag[];
};

export type SentinelCashflowResult = {
  liquidBank: number;
  liquidTreasury: number;
  liquidTotal: number;
  totalSubcontractorDue21d: number;
  totalOwnerInflow21d: number;
  companyGap: number;
  horizonDays: number;
  projects: ContractingCashGapFlag[];
};

export type SentinelExecutiveReport = {
  generatedAt: string;
  asOf: string;
  source: 'live' | 'cache' | 'scheduled';
  narrative: string;
  narrativeSource: 'ai' | 'fallback';
  model: string;
  counts: {
    fraud: number;
    replacement: number;
    cashflow: number;
  };
  fraud: SentinelFraudResult;
  replacement: ReplacementCostFlag[];
  cashflow: SentinelCashflowResult;
};

export type SentinelCompactPayload = {
  asOf: string;
  counts: SentinelExecutiveReport['counts'];
  voidPatterns: Array<{
    userName: string;
    voidRatePct: number;
    cancelledVolume: number;
    totalVolume: number;
    cancelledCount: number;
  }>;
  backdated: Array<{
    invoiceNumber: string;
    lagDays: number;
    userName: string;
  }>;
  shortages: Array<{
    itemName: string;
    eventCount: number;
    totalShortageQty: number;
  }>;
  replacement: Array<{
    itemName: string;
    salePrice: number;
    replacementCost: number;
    averageCost: number;
    suggestedSalePrice: number;
    soldAboveAverageCost: boolean;
  }>;
  cashflow: {
    liquidTotal: number;
    totalSubcontractorDue21d: number;
    totalOwnerInflow21d: number;
    companyGap: number;
    horizonDays: number;
    projects: Array<{
      projectName: string;
      projectCode: string;
      subcontractorDue21d: number;
      ownerInflow21d: number;
      gap: number;
    }>;
  };
};
