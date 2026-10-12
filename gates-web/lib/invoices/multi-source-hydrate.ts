import {
  SOURCE_TYPE_LABELS,
  type SourceHydrateLine,
  type SourceHydratePayload,
} from '@/lib/invoices/sourceDocument';

export const MULTI_STOCK_PERMIT_SOURCE_TYPES = ['DELIVERY_NOTE', 'GOODS_RECEIPT'] as const;

export type MultiStockPermitSourceType = (typeof MULTI_STOCK_PERMIT_SOURCE_TYPES)[number];

export type MultiSourceLineMode = 'merge_similar' | 'separate';

function lineMergeKey(line: SourceHydrateLine): string {
  return `${line.itemId}|${String(line.unitId ?? '')}`;
}

/** دمج الأصناف المتشابهة (نفس الصنف والوحدة) أو إبقاء كل سطر كما هو. */
export function combineSourceHydrateLines(
  groups: SourceHydrateLine[][],
  mode: MultiSourceLineMode
): SourceHydrateLine[] {
  const flat = groups.flat().filter((line) => line.itemId && Number(line.quantity) > 0);
  if (mode === 'separate') return flat;

  const merged = new Map<string, SourceHydrateLine>();
  for (const line of flat) {
    const key = lineMergeKey(line);
    const prev = merged.get(key);
    if (!prev) {
      merged.set(key, { ...line });
      continue;
    }
    const qty = prev.quantity + line.quantity;
    const unitPrice =
      qty > 0
        ? (prev.unitPrice * prev.quantity + line.unitPrice * line.quantity) / qty
        : prev.unitPrice;
    merged.set(key, {
      ...prev,
      quantity: qty,
      unitPrice,
      itemName: prev.itemName || line.itemName,
    });
  }
  return [...merged.values()];
}

export type MultiStockPermitHydrateRequest = {
  payloads: SourceHydratePayload[];
  lineMode: MultiSourceLineMode;
  replaceExisting: boolean;
};

export function buildMultiSourceHydrateNote(payloads: SourceHydratePayload[]): string {
  if (!payloads.length) return '';
  const parts = payloads.map(
    (p) => `${SOURCE_TYPE_LABELS[p.sourceType]} ${p.sourceNumber}`.trim()
  );
  return `تحميل متعدد: ${parts.join('، ')}`;
}
