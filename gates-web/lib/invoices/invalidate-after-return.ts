/** Drop cached returnable-qty / invoice rows so the next open deducts immediately. */
export function invalidateInvoiceReturnCaches(
  invalidateQuery: (queryKey: readonly unknown[]) => void,
  sourceInvoiceId?: string | null,
  returnId?: string | null
) {
  invalidateQuery(['invoices']);
  invalidateQuery(['invoice']);
  if (sourceInvoiceId) {
    invalidateQuery(['invoice', 'returnable-lines', sourceInvoiceId]);
    invalidateQuery(['invoice', sourceInvoiceId]);
    invalidateQuery(['invoice', 'return-source', sourceInvoiceId]);
  }
  if (returnId) invalidateQuery(['invoice', returnId]);
}
