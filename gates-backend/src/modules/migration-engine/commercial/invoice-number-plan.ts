/**
 * Target invoice numbers that cannot collide.
 *
 * The target key is (company, branch, fiscal year, invoiceType, invoiceNumber) with
 * invoiceType 'sales' / 'purchase'. Legacy numbers each type separately (SI01 #1, SR01 #1,
 * SV01 #1 can all exist in one branch/year) and several legacy types share one target
 * invoiceType. A legacy number is kept as-is when it is unique in its target group;
 * otherwise every invoice in that group gets the legacy type prefix (`SR01-1`), so the
 * mapping is deterministic and never merges two source documents.
 */
import type { LegacySourceAdapter } from '../types';
import { legacyTrim } from '../transforms/legacy-values';
import { mapLegacyInvoiceKind } from '../transforms/commercial-document-transform';

export type InvoiceNumberPlan = (row: {
  BranchCode?: unknown;
  YearID?: unknown;
  Type?: unknown;
  InvoiceNum?: unknown;
}) => string;

export function planInvoiceNumbers(
  keys: Array<{ BranchCode?: unknown; YearID?: unknown; Type?: unknown; InvoiceNum?: unknown }>
): InvoiceNumberPlan {
  const group = (r: (typeof keys)[number]) => {
    const kind = mapLegacyInvoiceKind(legacyTrim(r.Type));
    return [legacyTrim(r.BranchCode), legacyTrim(r.YearID), kind?.invoiceType ?? '?', legacyTrim(r.InvoiceNum)].join('|');
  };
  const typesByGroup = new Map<string, Set<string>>();
  for (const k of keys) {
    const g = group(k);
    if (!typesByGroup.has(g)) typesByGroup.set(g, new Set());
    typesByGroup.get(g)!.add(legacyTrim(k.Type).toUpperCase());
  }
  return (row) => {
    const num = legacyTrim(row.InvoiceNum);
    const shared = (typesByGroup.get(group(row))?.size ?? 1) > 1;
    return shared ? `${legacyTrim(row.Type).toUpperCase()}-${num}` : num;
  };
}

export async function loadInvoiceNumberPlan(
  adapter: LegacySourceAdapter,
  companyCode: string
): Promise<InvoiceNumberPlan> {
  const keys = await adapter.querySql<{ BranchCode?: unknown; YearID?: unknown; Type?: unknown; InvoiceNum?: unknown }>(
    `SELECT DISTINCT RTRIM(h.BranchCode) AS BranchCode, RTRIM(h.YearID) AS YearID,
            RTRIM(h.Type) AS Type, RTRIM(h.InvoiceNum) AS InvoiceNum
     FROM dbo.InvoiceTrxHeader h
     WHERE RTRIM(h.CompanyCode)=@cc`,
    { cc: companyCode }
  );
  return planInvoiceNumbers(keys);
}
