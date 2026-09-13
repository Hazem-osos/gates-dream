import { formatMoneyAr } from '@/lib/formatMoney';
import { itemLabel, type ItemPick } from '@/lib/inventory/itemDisplay';

export type SimpleInvoiceLine = {
  itemId: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  tax?: number;
};

export function lineGross(line: SimpleInvoiceLine): number {
  const gross = line.quantity * line.unitPrice;
  const discount = line.discount ?? 0;
  return Math.max(0, gross - discount);
}

/** Cells for wide inventory invoice line tables (12 cols). */
export function simpleInvoiceLineRowCells(
  items: ItemPick[],
  line: SimpleInvoiceLine,
  index: number
): (string | number)[] {
  const gross = lineGross(line);
  const taxAmt = line.tax ?? 0;
  return [
    index + 1,
    itemLabel(items, line.itemId),
    '—',
    line.quantity,
    '—',
    line.quantity,
    formatMoneyAr(line.unitPrice),
    formatMoneyAr(gross),
    line.discount != null ? formatMoneyAr(line.discount) : '—',
    '—',
    line.tax != null ? `${line.tax}%` : '—',
    formatMoneyAr(taxAmt),
  ];
}
