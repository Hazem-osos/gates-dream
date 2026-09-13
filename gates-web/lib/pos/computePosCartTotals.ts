import { formatMoneyAr } from '@/lib/formatMoney';

export type PosCartLine = {
  id: string;
  barcode: string;
  itemCode: string;
  itemName: string;
  unitLabel: string;
  price: number;
  quantity: number;
  discountPercent: number;
  discountAmount: number;
  taxPercent: number;
};

function lineNet(line: PosCartLine): number {
  const gross = line.price * line.quantity;
  const discount =
    line.discountAmount > 0
      ? line.discountAmount
      : gross * (line.discountPercent / 100);
  const afterDiscount = Math.max(0, gross - discount);
  const tax = afterDiscount * (line.taxPercent / 100);
  return afterDiscount + tax;
}

export function computePosCartTotals(lines: PosCartLine[]) {
  const subtotal = lines.reduce((s, l) => s + l.price * l.quantity, 0);
  const net = lines.reduce((s, l) => s + lineNet(l), 0);
  const taxable = lines.reduce((s, l) => {
    const gross = l.price * l.quantity;
    const discount =
      l.discountAmount > 0 ? l.discountAmount : gross * (l.discountPercent / 100);
    return s + Math.max(0, gross - discount);
  }, 0);
  return {
    subtotal,
    net,
    taxable,
    formatted: {
      total: formatMoneyAr(net),
      net: formatMoneyAr(net),
      taxable: formatMoneyAr(taxable),
      paid: formatMoneyAr(net),
      remaining: formatMoneyAr(0),
    },
  };
}

export function createEmptyPosCartLine(index: number): PosCartLine {
  return {
    id: `line-${index}`,
    barcode: '',
    itemCode: '',
    itemName: '',
    unitLabel: '',
    price: 0,
    quantity: 0,
    discountPercent: 0,
    discountAmount: 0,
    taxPercent: 0,
  };
}
