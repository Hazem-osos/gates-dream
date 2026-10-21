import type { SelectableSourceType } from '@/lib/invoices/sourceDocument';
import { destinationAppTabHref } from '@/lib/navigation/tab-memory';

export const FOLLOW_UP_SOURCE_TYPE_PARAM = 'followSourceType';
export const FOLLOW_UP_SOURCE_ID_PARAM = 'followSourceId';

export function buildStockDocumentFollowUpHref(
  target: 'issue' | 'receipt',
  sourceType: SelectableSourceType,
  sourceId: string
): string {
  const base =
    target === 'issue' ? '/inventory/operations/issue' : '/inventory/operations/receipt';
  const q = new URLSearchParams({
    [FOLLOW_UP_SOURCE_TYPE_PARAM]: sourceType,
    [FOLLOW_UP_SOURCE_ID_PARAM]: sourceId,
  });
  return destinationAppTabHref(`${base}?${q.toString()}`);
}

export function buildSalesInvoiceHref(invoiceId: string): string {
  return destinationAppTabHref(
    `/inventory/operations/sales-invoice?invoiceId=${encodeURIComponent(invoiceId)}`
  );
}

export function buildPurchaseInvoiceHref(invoiceId: string): string {
  return destinationAppTabHref(
    `/inventory/operations/final-purchase-invoice?invoiceId=${encodeURIComponent(invoiceId)}`
  );
}

export function readFollowUpSourceFromSearchParams(
  searchParams: URLSearchParams
): { sourceType: SelectableSourceType; sourceId: string } | null {
  const sourceType = searchParams.get(FOLLOW_UP_SOURCE_TYPE_PARAM)?.trim();
  const sourceId = searchParams.get(FOLLOW_UP_SOURCE_ID_PARAM)?.trim();
  if (!sourceType || !sourceId) return null;
  return { sourceType: sourceType as SelectableSourceType, sourceId };
}

export function stripFollowUpParams(searchParams: URLSearchParams): string {
  const next = new URLSearchParams(searchParams.toString());
  next.delete(FOLLOW_UP_SOURCE_TYPE_PARAM);
  next.delete(FOLLOW_UP_SOURCE_ID_PARAM);
  const qs = next.toString();
  return qs ? `?${qs}` : '';
}
