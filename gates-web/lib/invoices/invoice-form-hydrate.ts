/** Reload a saved invoice/return form only when the document itself changed. */
export function savedInvoiceHydrateKey(invoice: {
  id?: string | null;
  version?: number | null;
  isPosted?: boolean | null;
} | null | undefined): string | null {
  const id = invoice?.id?.trim();
  if (!id) return null;
  return `${id}:${invoice?.version ?? 0}:${invoice?.isPosted ? 1 : 0}`;
}
