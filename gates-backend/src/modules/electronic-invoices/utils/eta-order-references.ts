/** Same id the sales invoice stores inside `internalNotes`. */
export const EINVOICE_ORDER_REFS_NOTE_ID = 'einvoice-order-refs';

export type EtaOrderReferences = {
  salesOrderReference?: string;
  salesOrderDescription?: string;
  purchaseOrderReference?: string;
  purchaseOrderDescription?: string;
};

function trimmed(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * ETA invoice fields for the sales/purchase order block.
 * Empty values are omitted so the tax authority does not receive blank strings.
 */
export function etaOrderReferencesFromInternalNotes(notes: unknown): EtaOrderReferences {
  if (!Array.isArray(notes)) return {};
  const entry = notes.find(
    (note) =>
      note &&
      typeof note === 'object' &&
      (note as { id?: unknown }).id === EINVOICE_ORDER_REFS_NOTE_ID
  ) as { body?: unknown } | undefined;
  if (!entry || typeof entry.body !== 'string' || !entry.body.trim()) return {};

  let parsed: unknown;
  try {
    parsed = JSON.parse(entry.body);
  } catch {
    return {};
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};

  const body = parsed as Record<string, unknown>;
  const refs: EtaOrderReferences = {};
  const salesOrderReference = trimmed(body.salesOrderNumber);
  const salesOrderDescription = trimmed(body.salesOrderDescription);
  const purchaseOrderReference = trimmed(body.purchaseOrderNumber);
  const purchaseOrderDescription = trimmed(body.purchaseOrderDescription);
  if (salesOrderReference) refs.salesOrderReference = salesOrderReference;
  if (salesOrderDescription) refs.salesOrderDescription = salesOrderDescription;
  if (purchaseOrderReference) refs.purchaseOrderReference = purchaseOrderReference;
  if (purchaseOrderDescription) refs.purchaseOrderDescription = purchaseOrderDescription;
  return refs;
}
