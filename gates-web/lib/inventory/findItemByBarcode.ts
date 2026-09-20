import { fetchApiQuery } from '@/lib/api/query-fetch';
import type { ItemOption } from '@/lib/hooks/useMasterDataQueries';
import { resolvePriceListSalePrice } from '@/lib/inventory/pricing-engine';

export type BarcodeItemHit = ItemOption & {
  barcode?: string | null;
};

function normalizeBarcode(value: string): string {
  return value.trim();
}

export function matchItemByBarcode<T extends BarcodeItemHit>(
  items: T[],
  barcode: string
): T | undefined {
  const normalized = normalizeBarcode(barcode);
  if (!normalized) return undefined;
  return items.find((item) => {
    const keys = [item.barcode, item.serial, item.code];
    return keys.some((key) => (key ?? '').trim() === normalized);
  });
}

export function itemBarcodeValue(item: BarcodeItemHit, fallback = ''): string {
  return (item.barcode || item.serial || item.code || fallback).trim();
}

function withSalePrice(item: BarcodeItemHit): BarcodeItemHit {
  const listPrice = resolvePriceListSalePrice(item);
  if (listPrice > 0) return { ...item, salesPrice: listPrice };
  if (item.salesPrice != null) return item;
  const raw = item as BarcodeItemHit & { priceRetail?: number | string | null };
  const retail = raw.priceRetail != null ? Number(raw.priceRetail) : NaN;
  if (Number.isFinite(retail) && retail > 0) {
    return { ...item, salesPrice: retail };
  }
  return item;
}

/** Local cache first, then GET /inventory/items/find-by-barcode, then list search. */
export async function findItemByBarcode(
  barcode: string,
  localItems: BarcodeItemHit[] = []
): Promise<BarcodeItemHit | null> {
  const normalized = normalizeBarcode(barcode);
  if (!normalized) return null;

  const cached = matchItemByBarcode(localItems, normalized);
  if (cached) return withSalePrice(cached);

  try {
    const res = await fetchApiQuery<BarcodeItemHit>('/inventory/items/find-by-barcode', {
      barcode: normalized,
    });
    if (res.data) return withSalePrice(res.data);
  } catch {
    /* 404 or network — try prefix search below */
  }

  try {
    const res = await fetchApiQuery<BarcodeItemHit[]>('/inventory/items', {
      search: normalized,
      limit: 8,
      isActive: true,
    });
    const found = matchItemByBarcode(res.data ?? [], normalized);
    return found ? withSalePrice(found) : null;
  } catch {
    return null;
  }
}
