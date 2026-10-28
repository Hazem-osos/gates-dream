/**
 * Fixed-asset depreciation math (EAS 10). Pure functions — no I/O — shared by
 * the run preview, the run posting, disposal catch-up and the schedule report,
 * so all four always agree.
 *
 * Months are integer keys: year * 12 + monthIndex (0-based), all in UTC.
 * Owner decision (2026-10-28): an asset put in service on or before the 15th
 * depreciates for that whole month, after the 15th it starts next month.
 * The same rule ends depreciation on disposal.
 */
import { roundTo4 } from '../../../shared/utils/decimal-round';

export type DepreciationMethod = 'STRAIGHT_LINE' | 'DECLINING_BALANCE' | 'NONE';

export interface DepreciableAsset {
  method: DepreciationMethod;
  cost: number;
  salvageValue: number;
  usefulLifeMonths: number;
  /** Annual percent, declining balance only. */
  decliningRate?: number | null;
  inServiceDate: Date;
}

export interface DepreciationState {
  /** Total depreciation booked so far (opening + posted). */
  accumulated: number;
  /** Accumulated at the start of the calendar year of the next month to depreciate. */
  accumulatedAtYearStart: number;
}

export interface MonthLine {
  month: number;
  periodEnd: Date;
  amount: number;
  accumulatedAfter: number;
  bookValueAfter: number;
}

export const MID_MONTH_CUTOFF_DAY = 15;
/** Safety bound for schedule projection (100 years). */
const MAX_PROJECTION_MONTHS = 1200;

export function monthKey(date: Date): number {
  return date.getUTCFullYear() * 12 + date.getUTCMonth();
}

export function monthEndDate(key: number): Date {
  const year = Math.floor(key / 12);
  const month = key - year * 12;
  return new Date(Date.UTC(year, month + 1, 0));
}

export function monthStartDate(key: number): Date {
  const year = Math.floor(key / 12);
  const month = key - year * 12;
  return new Date(Date.UTC(year, month, 1));
}

export function isJanuary(key: number): boolean {
  return key % 12 === 0;
}

/** First month that carries depreciation. */
export function firstDepreciationMonth(inServiceDate: Date): number {
  const key = monthKey(inServiceDate);
  return inServiceDate.getUTCDate() <= MID_MONTH_CUTOFF_DAY ? key : key + 1;
}

/** Last month that carries depreciation when the asset leaves on `disposalDate`. */
export function lastDepreciationMonthOnDisposal(disposalDate: Date): number {
  const key = monthKey(disposalDate);
  return disposalDate.getUTCDate() <= MID_MONTH_CUTOFF_DAY ? key - 1 : key;
}

/** Last month of the useful life (straight line ends here). */
export function lastLifeMonth(asset: DepreciableAsset): number {
  return firstDepreciationMonth(asset.inServiceDate) + Math.max(1, asset.usefulLifeMonths) - 1;
}

export function depreciableBase(asset: DepreciableAsset): number {
  return roundTo4(Math.max(0, asset.cost - asset.salvageValue));
}

/**
 * Depreciation for one month. Straight line spreads what is left over the
 * remaining life, so opening balances and life/salvage revisions apply
 * prospectively (EAS 10) and the last month absorbs rounding exactly.
 */
export function monthAmount(
  asset: DepreciableAsset,
  month: number,
  state: DepreciationState
): number {
  if (asset.method === 'NONE') return 0;
  const start = firstDepreciationMonth(asset.inServiceDate);
  if (month < start) return 0;
  const remaining = roundTo4(depreciableBase(asset) - state.accumulated);
  if (remaining <= 0) return 0;
  const end = lastLifeMonth(asset);

  if (asset.method === 'STRAIGHT_LINE') {
    const monthsLeft = end - month + 1;
    if (monthsLeft <= 1) return remaining;
    return Math.min(remaining, roundTo4(remaining / monthsLeft));
  }

  // Declining balance: annual rate on the book value at the start of the year.
  if (month >= end) return remaining;
  const rate = Number(asset.decliningRate ?? 0) / 100;
  if (!(rate > 0)) return 0;
  const yearBase = Math.max(0, asset.cost - state.accumulatedAtYearStart);
  return Math.min(remaining, roundTo4((yearBase * rate) / 12));
}

/** Depreciate every month in [fromMonth, toMonth]; months with zero are skipped. */
export function depreciateMonths(
  asset: DepreciableAsset,
  fromMonth: number,
  toMonth: number,
  initial: DepreciationState
): { lines: MonthLine[]; state: DepreciationState } {
  const state = { ...initial };
  const lines: MonthLine[] = [];
  for (let month = fromMonth; month <= toMonth; month++) {
    if (isJanuary(month) && month !== fromMonth) {
      state.accumulatedAtYearStart = state.accumulated;
    }
    const amount = monthAmount(asset, month, state);
    if (amount <= 0) continue;
    state.accumulated = roundTo4(state.accumulated + amount);
    lines.push({
      month,
      periodEnd: monthEndDate(month),
      amount,
      accumulatedAfter: state.accumulated,
      bookValueAfter: roundTo4(asset.cost - state.accumulated),
    });
  }
  return { lines, state };
}

/** Future months until the asset is fully depreciated (schedule report). */
export function projectSchedule(
  asset: DepreciableAsset,
  fromMonth: number,
  initial: DepreciationState
): MonthLine[] {
  if (asset.method === 'NONE') return [];
  const start = Math.max(fromMonth, firstDepreciationMonth(asset.inServiceDate));
  const lines: MonthLine[] = [];
  const state = { ...initial };
  for (let month = start; month < start + MAX_PROJECTION_MONTHS; month++) {
    if (isJanuary(month) && month !== start) state.accumulatedAtYearStart = state.accumulated;
    if (roundTo4(depreciableBase(asset) - state.accumulated) <= 0) break;
    const amount = monthAmount(asset, month, state);
    if (amount <= 0) continue;
    state.accumulated = roundTo4(state.accumulated + amount);
    lines.push({
      month,
      periodEnd: monthEndDate(month),
      amount,
      accumulatedAfter: state.accumulated,
      bookValueAfter: roundTo4(asset.cost - state.accumulated),
    });
  }
  return lines;
}

/** Gain (positive) or loss (negative) on disposal: proceeds − book value. */
export function disposalGainLoss(cost: number, accumulated: number, proceeds: number): {
  bookValue: number;
  gainLoss: number;
} {
  const bookValue = roundTo4(cost - accumulated);
  return { bookValue, gainLoss: roundTo4(proceeds - bookValue) };
}

export function isFullyDepreciated(asset: DepreciableAsset, accumulated: number): boolean {
  return roundTo4(depreciableBase(asset) - accumulated) <= 0;
}
