export type CommercialDocumentLine = {
  itemId: string;
  itemCode: string;
  itemName: string;
  unitId: string;
  unitName: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  taxRate: number;
  notes: string;
  costCenterId: string;
};

export function emptyCommercialLine(): CommercialDocumentLine {
  return {
    itemId: '',
    itemCode: '',
    itemName: '',
    unitId: '',
    unitName: '',
    quantity: 0,
    unitPrice: 0,
    discount: 0,
    taxRate: 14,
    notes: '',
    costCenterId: '',
  };
}

export function commercialLineNet(line: CommercialDocumentLine) {
  const qty = Number(line.quantity) || 0;
  const price = Number(line.unitPrice) || 0;
  const discount = Number(line.discount) || 0;
  const tax = Number(line.taxRate) || 0;
  const afterDiscount = qty * price * (1 - discount / 100);
  return afterDiscount * (1 + tax / 100);
}

export function commercialLineParts(line: CommercialDocumentLine) {
  const qty = Number(line.quantity) || 0;
  const price = Number(line.unitPrice) || 0;
  const discount = Number(line.discount) || 0;
  const tax = Number(line.taxRate) || 0;
  const gross = qty * price;
  const discountValue = gross * (discount / 100);
  const afterDiscount = gross - discountValue;
  const taxValue = afterDiscount * (tax / 100);
  return { gross, discountValue, afterDiscount, taxValue, net: afterDiscount + taxValue };
}

export function isEnteredCommercialLine(line: CommercialDocumentLine) {
  return Boolean(line.itemId) && Number(line.quantity) > 0;
}
