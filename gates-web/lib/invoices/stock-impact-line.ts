/** عرض اسم الصنف في تبويب الأثر المخزني — لا نعرض معرف UUID للمستخدم. */
export type StockImpactLine = {
  itemId?: string;
  itemName?: string;
};

export function readInvoiceLineItemName(line: Record<string, unknown>): string {
  const item = line.item as { arabicName?: string; englishName?: string } | undefined;
  return String(item?.arabicName ?? item?.englishName ?? '').trim();
}

export function stockImpactItemLabel(line: StockImpactLine): string {
  const name = String(line.itemName ?? '').trim();
  if (name) return name;
  const id = String(line.itemId ?? '').trim();
  if (!id) return '—';
  return id.length > 12 ? `${id.slice(0, 8)}…` : id;
}
