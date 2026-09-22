/** Items the items guide actually lists — live, and under a visible group or ungrouped. */

export function isUngroupedCategory(row?: {
  code?: string | null;
  arabicName?: string | null;
} | null) {
  if (!row) return false;
  return row.code === 'UNG' || row.arabicName === 'بدون مجموعة';
}

export function asItemList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === 'object') {
    const nested =
      (data as { items?: unknown }).items ??
      (data as { categories?: unknown }).categories ??
      (data as { data?: unknown }).data;
    if (Array.isArray(nested)) return nested as T[];
  }
  return [];
}

export function isLiveInventoryItem(item: {
  isActive?: boolean | null;
  inactiveItem?: boolean | null;
  id?: string;
  arabicName?: string | null;
}) {
  if (!item.id || !String(item.arabicName ?? '').trim()) return false;
  if (item.isActive === false) return false;
  if (item.inactiveItem === true) return false;
  return true;
}

export function isVisibleInItemsGuide(
  item: {
    id?: string;
    arabicName?: string | null;
    isActive?: boolean | null;
    inactiveItem?: boolean | null;
    categoryId?: string | null;
    category?: { id?: string; code?: string | null; arabicName?: string | null } | null;
  },
  activeGroupIds: Set<string>,
  ungroupedCategoryIds?: Set<string>
) {
  if (!isLiveInventoryItem(item)) return false;
  const categoryId = item.categoryId ?? item.category?.id ?? '';
  if (!categoryId) return true;
  if (isUngroupedCategory(item.category)) return true;
  if (ungroupedCategoryIds?.has(categoryId)) return true;
  return activeGroupIds.has(categoryId);
}
