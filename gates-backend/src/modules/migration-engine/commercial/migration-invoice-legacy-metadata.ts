import { legacyTrim } from '../transforms/legacy-values';

/** Header fields with first-class Invoice columns — not duplicated in legacyMigration blob. */
export const INVOICE_HEADER_MAPPED_KEYS = new Set([
  'CompanyCode',
  'BranchCode',
  'YearID',
  'Type',
  'InvoiceNum',
  'Date',
  'DateH',
  'GLNum',
  'Status',
  'Deleted',
  'CustomerCode',
  'SupplierCode',
  'StoreCode',
  'CurrencyCode',
  'Change',
  'TotalValue',
  'TotalAmount',
  'DiscountValue',
  'DaribaValue',
  'SalesDaribaAmount',
  'NetValue',
  'NetAmount',
  'RemainingValue',
  'CashType',
  'ReturnInvoiceType',
  'ReturnInvoiceNum',
  'ReturnInvoiceYearID',
  'SourceType',
  'SourceNum',
  'PaidAmount',
  'DescA',
  'AllowReturn',
  'Days',
  'AffectStore',
  'CCenter',
  'OrderNum',
  'OrderType',
  'OrderYearID',
]);

/** Non-target invoice header fields preserved under Invoice.internalNotes.legacyMigration */
export function pickLegacyInvoiceHeaderMetadata(row: Record<string, unknown>): Record<string, string | number | null> {
  const out: Record<string, string | number | null> = {};
  for (const [key, v] of Object.entries(row)) {
    if (INVOICE_HEADER_MAPPED_KEYS.has(key) || v == null || v === '') continue;
    if (typeof v === 'number') out[key] = v;
    else if (v instanceof Date) out[key] = v.toISOString();
    else out[key] = legacyTrim(v);
  }
  return out;
}
