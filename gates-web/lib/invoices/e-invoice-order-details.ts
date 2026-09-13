import type { InternalNoteEntry } from '@/lib/invoices/payment-split.types';

export const EINVOICE_DETAILS_NOTE_ID = 'einvoice-order-refs';

export type EInvoiceOrderDetails = {
  salesOrderNumber?: string;
  salesOrderDescription?: string;
  purchaseOrderNumber?: string;
  purchaseOrderDescription?: string;
};

export function emptyEInvoiceOrderDetails(): EInvoiceOrderDetails {
  return {
    salesOrderNumber: '',
    salesOrderDescription: '',
    purchaseOrderNumber: '',
    purchaseOrderDescription: '',
  };
}

export function stripEInvoiceDetailsNote(notes: InternalNoteEntry[]): InternalNoteEntry[] {
  return notes.filter((n) => n.id !== EINVOICE_DETAILS_NOTE_ID);
}

export function extractEInvoiceDetails(notes: unknown): EInvoiceOrderDetails {
  const empty = emptyEInvoiceOrderDetails();
  if (!Array.isArray(notes)) return empty;
  const entry = notes.find(
    (n) => n && typeof n === 'object' && (n as { id?: string }).id === EINVOICE_DETAILS_NOTE_ID
  ) as { body?: string } | undefined;
  if (!entry?.body) return empty;
  try {
    const parsed = JSON.parse(entry.body) as EInvoiceOrderDetails;
    return {
      salesOrderNumber: parsed.salesOrderNumber ?? '',
      salesOrderDescription: parsed.salesOrderDescription ?? '',
      purchaseOrderNumber: parsed.purchaseOrderNumber ?? '',
      purchaseOrderDescription: parsed.purchaseOrderDescription ?? '',
    };
  } catch {
    return empty;
  }
}

export function withEInvoiceDetailsNote(
  notes: InternalNoteEntry[],
  details: EInvoiceOrderDetails
): InternalNoteEntry[] {
  const cleaned = stripEInvoiceDetailsNote(notes);
  const hasAny = [
    details.salesOrderNumber,
    details.salesOrderDescription,
    details.purchaseOrderNumber,
    details.purchaseOrderDescription,
  ].some((v) => String(v ?? '').trim());
  if (!hasAny) return cleaned;
  return [
    {
      id: EINVOICE_DETAILS_NOTE_ID,
      body: JSON.stringify({
        salesOrderNumber: details.salesOrderNumber?.trim() || undefined,
        salesOrderDescription: details.salesOrderDescription?.trim() || undefined,
        purchaseOrderNumber: details.purchaseOrderNumber?.trim() || undefined,
        purchaseOrderDescription: details.purchaseOrderDescription?.trim() || undefined,
      }),
      tags: ['فاتورة إلكترونية'],
      createdAt: new Date().toISOString(),
    },
    ...cleaned,
  ];
}
