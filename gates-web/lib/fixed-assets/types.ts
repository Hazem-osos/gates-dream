/** Fixed assets (الأصول الثابتة) — client types and labels. API: /fixed-assets/* */

export type DepreciationMethod = 'STRAIGHT_LINE' | 'DECLINING_BALANCE' | 'NONE';
export type FixedAssetStatus = 'DRAFT' | 'ACTIVE' | 'FULLY_DEPRECIATED' | 'DISPOSED';
export type AcquisitionType = 'PURCHASE' | 'EXISTING';
export type DocStatus = 'POSTED' | 'UNPOSTED';

export type AccountRef = { id: string; code: string; arabicName: string } | null;
type Money = number | string;

export type FixedAssetCategory = {
  id: string;
  code: string;
  arabicName: string;
  englishName?: string | null;
  parentId?: string | null;
  depreciationMethod: DepreciationMethod;
  usefulLifeMonths?: number | null;
  decliningRate?: Money | null;
  salvagePercent: Money;
  assetAccountId?: string | null;
  accumulatedDepreciationAccountId?: string | null;
  depreciationExpenseAccountId?: string | null;
  disposalGainAccountId?: string | null;
  disposalLossAccountId?: string | null;
  isActive: boolean;
  assetAccount?: AccountRef;
  accumulatedDepreciationAccount?: AccountRef;
  depreciationExpenseAccount?: AccountRef;
  disposalGainAccount?: AccountRef;
  disposalLossAccount?: AccountRef;
  _count?: { assets: number; children: number };
};

export type FixedAsset = {
  id: string;
  code: string;
  arabicName: string;
  englishName?: string | null;
  categoryId: string;
  category?: { id: string; code: string; arabicName: string } | null;
  status: FixedAssetStatus;
  acquisitionType: AcquisitionType;
  acquisitionDate: string;
  inServiceDate: string;
  cost: Money;
  vatAmount: Money;
  salvageValue: Money;
  usefulLifeMonths: number;
  depreciationMethod: DepreciationMethod;
  decliningRate?: Money | null;
  openingAccumulatedDepreciation: Money;
  openingDepreciatedThrough?: string | null;
  accumulatedDepreciation: Money;
  depreciatedThrough?: string | null;
  bookValue: number;
  assetAccountId: string;
  accumulatedDepreciationAccountId: string;
  depreciationExpenseAccountId: string;
  creditAccountId?: string | null;
  supplierId?: string | null;
  journalEntryId?: string | null;
  branchId?: string | null;
  costCenterId?: string | null;
  custodianEmployeeId?: string | null;
  location?: string | null;
  serialNumber?: string | null;
  barcode?: string | null;
  invoiceReference?: string | null;
  warrantyExpiry?: string | null;
  notes?: string | null;
  version: number;
  assetAccount?: AccountRef;
  accumulatedDepreciationAccount?: AccountRef;
  depreciationExpenseAccount?: AccountRef;
  creditAccount?: AccountRef;
  journal?: { id: string; voucherNumber: string; isPosted: boolean; isCancelled: boolean } | null;
  supplier?: { id: string; code?: string | null; arabicName: string } | null;
  custodian?: { id: string; arabicName: string; employeeId?: string | null } | null;
  costCenter?: { id: string; code: string; arabicName: string } | null;
  branch?: { id: string; arabicName: string } | null;
  disposals?: FixedAssetDisposal[];
};

export type ScheduleLine = {
  periodEnd: string;
  amount: number;
  accumulatedAfter: number;
  bookValueAfter: number;
  runNumber?: string;
};

export type AssetSchedule = {
  cost: number;
  salvageValue: number;
  openingAccumulatedDepreciation: number;
  openingDepreciatedThrough: string | null;
  actual: ScheduleLine[];
  projected: ScheduleLine[];
  disposal: {
    disposalNumber: string;
    disposalDate: string;
    catchUpDepreciation: number;
    catchUpMonths: number;
    gainLoss: number;
  } | null;
};

export type DepreciationRun = {
  id: string;
  runNumber: string;
  periodEnd: string;
  status: DocStatus;
  totalAmount: Money;
  journalEntryId?: string | null;
  notes?: string | null;
  postedAt?: string | null;
  _count?: { lines: number };
  journal?: { id: string; voucherNumber: string; isPosted: boolean; isCancelled: boolean } | null;
  lines?: Array<{
    id: string;
    periodMonth: string;
    amount: Money;
    accumulatedAfter: Money;
    asset: { id: string; code: string; arabicName: string };
  }>;
};

export type JournalPreviewLine = {
  accountId: string;
  accountCode?: string;
  accountName?: string;
  debit: number;
  credit: number;
  description?: string;
  costCenterId?: string;
};

export type RunPreview = {
  periodEnd: string;
  totalAmount: number;
  assets: Array<{ assetId: string; code: string; name: string; months: number; amount: number; accumulatedAfter: number }>;
  journal: JournalPreviewLine[];
};

export type FixedAssetDisposal = {
  id: string;
  disposalNumber: string;
  assetId: string;
  asset?: { id: string; code: string; arabicName: string };
  disposalType: 'SALE' | 'SCRAP';
  disposalDate: string;
  status: DocStatus;
  proceeds: Money;
  vatAmount: Money;
  customerId?: string | null;
  proceedsAccountId?: string | null;
  catchUpDepreciation: Money;
  costAmount: Money;
  accumulatedAmount: Money;
  bookValue: Money;
  gainLoss: Money;
  journalEntryId?: string | null;
  notes?: string | null;
};

export type DisposalPreview = {
  catchUpDepreciation: number;
  catchUpMonths: number;
  cost: number;
  accumulatedDepreciation: number;
  bookValue: number;
  gainLoss: number;
  journal: JournalPreviewLine[];
};

export type MovementRow = {
  categoryId: string;
  code: string;
  name: string;
  costOpening: number;
  costAdditions: number;
  costDisposals: number;
  costClosing: number;
  accOpening: number;
  accOnAdditions: number;
  accCharge: number;
  accDisposals: number;
  accClosing: number;
  bookValueOpening: number;
  bookValueClosing: number;
};

export const METHOD_LABELS: Record<DepreciationMethod, string> = {
  STRAIGHT_LINE: 'القسط الثابت',
  DECLINING_BALANCE: 'القسط المتناقص',
  NONE: 'لا يُهلك (أراضٍ)',
};

export const STATUS_LABELS: Record<FixedAssetStatus, string> = {
  DRAFT: 'مسودة',
  ACTIVE: 'في الخدمة',
  FULLY_DEPRECIATED: 'مُهلك بالكامل',
  DISPOSED: 'مستبعد',
};

export const STATUS_VARIANT: Record<FixedAssetStatus, 'neutral' | 'success' | 'warning' | 'danger'> = {
  DRAFT: 'neutral',
  ACTIVE: 'success',
  FULLY_DEPRECIATED: 'warning',
  DISPOSED: 'danger',
};

export const ACQUISITION_LABELS: Record<AcquisitionType, string> = {
  PURCHASE: 'شراء جديد (يُنشئ قيد شراء)',
  EXISTING: 'مسجل في الحسابات مسبقًا (رصيد افتتاحي أو فاتورة) — بدون قيد',
};

export function toNumber(value: Money | null | undefined): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export function formatMoney(value: Money | null | undefined): string {
  return toNumber(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatDay(value: string | null | undefined): string {
  return value ? String(value).slice(0, 10) : '—';
}

/** Same journal-entry screen the report engine opens (`journalEntryHref`). */
export function journalHref(journalEntryId: string): string {
  return `/accounting/operations/journal-entry?id=${encodeURIComponent(journalEntryId)}`;
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Last day of the previous month — the usual depreciation run date. */
export function lastMonthEndIso(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0)).toISOString().slice(0, 10);
}
