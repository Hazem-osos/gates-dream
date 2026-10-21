/** Egyptian standard VAT when the item card has no tax percent. */
export const DEFAULT_INVOICE_VAT_PERCENT = 14;

export type ItemVatSource = {
  isTaxExempt?: boolean | null;
  defaultTaxPercent?: number | string | null;
};

/**
 * Line VAT % when the invoice is marked خاضعة للقيمة المضافة.
 * Off → 0. Exempt item → 0. Stored item percent → that percent. No setting → 14.
 */
export function invoiceLineVatRate(
  item: ItemVatSource | null | undefined,
  vatInvoiceEnabled: boolean
): number {
  if (!vatInvoiceEnabled) return 0;
  if (item?.isTaxExempt) return 0;
  if (item?.defaultTaxPercent == null || item.defaultTaxPercent === '') {
    return DEFAULT_INVOICE_VAT_PERCENT;
  }
  const n = Number(item.defaultTaxPercent);
  if (!Number.isFinite(n) || n < 0) return DEFAULT_INVOICE_VAT_PERCENT;
  return n;
}

export function invoiceLineVatRateForItemId(
  items: Array<ItemVatSource & { id: string }>,
  itemId: string | null | undefined,
  vatInvoiceEnabled: boolean
): number {
  const id = String(itemId ?? '').trim();
  if (!id) return invoiceLineVatRate(undefined, vatInvoiceEnabled);
  return invoiceLineVatRate(
    items.find((row) => row.id === id),
    vatInvoiceEnabled
  );
}
