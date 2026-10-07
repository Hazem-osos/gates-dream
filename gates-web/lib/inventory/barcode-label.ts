import type { ItemOption } from '@/lib/hooks/useMasterDataQueries';
import { resolveItemBarcode } from '@/lib/inventory/item-barcode-default';

export function barcodeScanValue(item: Pick<ItemOption, 'barcode' | 'serial' | 'code' | 'id'>): string {
  const serial = (item.serial || item.code || '').trim();
  return resolveItemBarcode(item.barcode || '', serial) || serial || item.id.slice(0, 12);
}

/** Human-readable code on the sticker — same value encoded in the bars (CODE128). */
export function itemStickerCode(
  item: Pick<ItemOption, 'barcode' | 'serial' | 'code' | 'id'>
): string {
  return barcodeScanValue(item);
}

export function resolveItemLabelPrice(item: ItemOption): number | null {
  if (typeof item.salesPrice === 'number' && Number.isFinite(item.salesPrice)) {
    return item.salesPrice;
  }
  if (item.itemPrices?.length) {
    const def = item.itemPrices.find((p) => p.priceList?.isDefault) ?? item.itemPrices[0];
    const raw = def?.retailPrice ?? def?.price;
    if (raw != null) {
      const n = Number(raw);
      if (Number.isFinite(n)) return n;
    }
  }
  if (item.lastPurchasePrice != null) {
    const n = Number(item.lastPurchasePrice);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

export function formatStickerPrice(value: number): string {
  return `${value.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ج.م`;
}
