/**
 * Target cheque numbers that cannot collide.
 *
 * The target key is (company, chequeNumber, direction). Legacy cheque paper numbers (IdNum)
 * repeat across banks and branches, and the fallback voucher number repeats per branch/year.
 * A number is kept as-is when only one legacy line in that direction uses it; otherwise each
 * of those lines is qualified with branch/year/voucher/line so no two source cheques merge.
 */
import { legacyTrim } from '../transforms/legacy-values';
import { legacyChequeNumber } from './settlement-cheque-decision';
import type { LegacyChequeLineRow } from '../services/legacy-cheque-data.service';
import type { LegacySourceAdapter } from '../types';

export type ChequeNumberPlan = (row: LegacyChequeLineRow, direction: 'INWARD' | 'OUTWARD') => string;

function qualifier(row: LegacyChequeLineRow): string {
  const voucher = legacyTrim(row.CKNum) || legacyTrim(row.PKNum);
  const id = legacyTrim(row.Id);
  return [legacyTrim(row.BranchCode), legacyTrim(row.YearID), legacyTrim(row.Type), voucher, id]
    .filter(Boolean)
    .join('/');
}

export function planChequeNumbers(
  rows: Array<{ row: LegacyChequeLineRow; direction: 'INWARD' | 'OUTWARD' }>
): ChequeNumberPlan {
  const counts = new Map<string, number>();
  for (const { row, direction } of rows) {
    const k = `${direction}|${legacyChequeNumber(row)}`;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return (row, direction) => {
    const base = legacyChequeNumber(row);
    return (counts.get(`${direction}|${base}`) ?? 1) > 1 ? `${base} (${qualifier(row)})` : base;
  };
}

export async function loadChequeNumberPlan(adapter: LegacySourceAdapter, companyCode: string): Promise<ChequeNumberPlan> {
  const ck = await adapter.querySql<LegacyChequeLineRow>(
    `SELECT BranchCode, YearID, Type, CKNum, Id, IdNum FROM dbo.CKTrxDetail WHERE RTRIM(CompanyCode)=@cc`,
    { cc: companyCode }
  );
  let pk: LegacyChequeLineRow[] = [];
  try {
    pk = await adapter.querySql<LegacyChequeLineRow>(
      `SELECT BranchCode, YearID, Type, PKNum, IdNum FROM dbo.PKTrxDetail WHERE RTRIM(CompanyCode)=@cc`,
      { cc: companyCode }
    );
  } catch {
    pk = [];
  }
  return planChequeNumbers([
    ...ck.map((row) => ({ row, direction: 'INWARD' as const })),
    ...pk.map((row) => ({ row, direction: 'OUTWARD' as const })),
  ]);
}
