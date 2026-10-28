import { legacyTrim } from '../transforms/legacy-values';

/** Map legacy InvoiceTrxHeader.SourceType module codes to GATES SourceDocumentType (evidence: NewModule prefixes). */
export function mapLegacyInvoiceSourceDocumentType(
  sourceType: unknown,
  sourceNum: unknown
): 'QUOTATION' | 'SALES_ORDER' | 'PURCHASE_ORDER' | 'PURCHASE_INVOICE' | 'GOODS_RECEIPT' | 'DELIVERY_NOTE' | 'SALES_INVOICE' | 'NONE' {
  const st = legacyTrim(sourceType).toUpperCase();
  const num = legacyTrim(sourceNum);
  if (!st && !num) return 'NONE';
  if (st.startsWith('QT')) return 'QUOTATION';
  if (st.startsWith('SO')) return 'SALES_ORDER';
  if (st.startsWith('PO') && st !== 'PO01') return 'PURCHASE_ORDER';
  if (st.startsWith('PI')) return 'PURCHASE_INVOICE';
  if (st.startsWith('SI') || st.startsWith('SV')) return 'SALES_INVOICE';
  if (st.startsWith('GR') || st === 'SL01') return 'GOODS_RECEIPT';
  if (st.startsWith('DN') || st.startsWith('DL')) return 'DELIVERY_NOTE';
  if (num && !st) return 'NONE';
  return 'NONE';
}
