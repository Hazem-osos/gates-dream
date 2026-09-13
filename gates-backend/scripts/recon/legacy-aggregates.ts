/**
 * Pure aggregations over legacy (Delphi/SQL Server) rows, used as the "before" side of the
 * migration parity harness. Mirrors the rules the ETL applies so a mismatch means real
 * data loss rather than a definitional difference:
 *   - only headers with Status=Post and Deleted<>T reach the trial balance
 *   - base amounts are DebitValue/CreditValue multiplied by the header/line exchange rate
 */
import type { LegacyRow } from '../migration/types';
import { legacyBool, legacyDate, legacyDecimal, legacyTrim } from '../migration/utils/legacy-values';

export interface LegacyTrialBalanceRow {
  accountCode: string;
  debit: number;
  credit: number;
}

export interface LegacyStockRow {
  storeCode: string;
  itemCode: string;
  quantity: number;
}

export interface DateWindow {
  from?: Date;
  to?: Date;
}

function headerKey(row: LegacyRow): string {
  return [
    legacyTrim(row.CompanyCode),
    legacyTrim(row.BranchCode),
    legacyTrim(row.YearID ?? row.YearCode),
    legacyTrim(row.GlNum),
  ].join('|');
}

function inWindow(date: Date | null, window: DateWindow): boolean {
  if (!date) return true;
  if (window.from && date < window.from) return false;
  if (window.to && date > window.to) return false;
  return true;
}

/** Headers eligible for the trial balance, keyed the same way details reference them. */
export function selectPostedHeaders(headers: LegacyRow[], window: DateWindow = {}): Set<string> {
  const keys = new Set<string>();
  for (const row of headers) {
    if (legacyBool(row.Deleted, false)) continue;
    if (legacyTrim(row.Status).toLowerCase() !== 'post') continue;
    if (!inWindow(legacyDate(row.Date), window)) continue;
    keys.add(headerKey(row));
  }
  return keys;
}

export function aggregateLegacyTrialBalance(
  headers: LegacyRow[],
  details: LegacyRow[],
  window: DateWindow = {}
): Map<string, LegacyTrialBalanceRow> {
  const posted = selectPostedHeaders(headers, window);
  const byAccount = new Map<string, LegacyTrialBalanceRow>();

  for (const row of details) {
    if (!posted.has(headerKey(row))) continue;
    const accountCode = legacyTrim(row.AccountNo ?? row.AccountCode);
    if (!accountCode) continue;

    const rate = legacyDecimal(row.Change ?? 1, 6) || 1;
    const debit = legacyDecimal(legacyDecimal(row.DebitValue ?? row.Debit, 4) * rate, 4);
    const credit = legacyDecimal(legacyDecimal(row.CreditValue ?? row.Credit, 4) * rate, 4);

    const current = byAccount.get(accountCode) ?? { accountCode, debit: 0, credit: 0 };
    current.debit = legacyDecimal(current.debit + debit, 4);
    current.credit = legacyDecimal(current.credit + credit, 4);
    byAccount.set(accountCode, current);
  }

  return byAccount;
}

/** Quantity on hand per store/item, matching Phase B's ItemStore load. */
export function aggregateLegacyStock(itemStores: LegacyRow[]): Map<string, LegacyStockRow> {
  const byKey = new Map<string, LegacyStockRow>();
  for (const row of itemStores) {
    const storeCode = legacyTrim(row.StoreCode);
    const itemCode = legacyTrim(row.ItemCode);
    if (!storeCode || !itemCode) continue;
    const quantity = legacyDecimal(row.Quantity ?? row.Qty, 3);
    const key = `${storeCode}|${itemCode}`;
    const current = byKey.get(key) ?? { storeCode, itemCode, quantity: 0 };
    current.quantity = legacyDecimal(current.quantity + quantity, 3);
    byKey.set(key, current);
  }
  return byKey;
}

/**
 * Latest moving-average cost per item: highest Serial wins, falling back to the most recent
 * Date — the same precedence Delphi uses when reading ItemCost.
 */
export function latestLegacyCosts(itemCosts: LegacyRow[]): Map<string, number> {
  const best = new Map<string, { serial: number; time: number; cost: number }>();
  for (const row of itemCosts) {
    const itemCode = legacyTrim(row.ItemCode);
    if (!itemCode) continue;
    const serial = parseInt(String(row.Serial ?? row.IdNum ?? '0'), 10) || 0;
    const time = legacyDate(row.Date)?.getTime() ?? 0;
    const cost = legacyDecimal(row.Cost ?? row.AverageCost, 4);
    const current = best.get(itemCode);
    if (!current || serial > current.serial || (serial === current.serial && time > current.time)) {
      best.set(itemCode, { serial, time, cost });
    }
  }
  return new Map([...best].map(([code, v]) => [code, v.cost]));
}
