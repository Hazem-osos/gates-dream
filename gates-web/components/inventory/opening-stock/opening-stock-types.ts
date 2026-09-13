export type OpeningStockLineForm = {
  itemId: string;
  itemCode: string;
  itemName: string;
  unitName: string;
  warehouseId: string;
  quantity: number;
  unitCost: number;
  batchNumber: string;
  expiryDate: string;
};

export function emptyOpeningStockLine(warehouseId = ''): OpeningStockLineForm {
  return {
    itemId: '',
    itemCode: '',
    itemName: '',
    unitName: '',
    warehouseId,
    quantity: 0,
    unitCost: 0,
    batchNumber: '',
    expiryDate: '',
  };
}

export function lineValue(line: OpeningStockLineForm) {
  return (Number(line.quantity) || 0) * (Number(line.unitCost) || 0);
}

export function isEnteredOpeningStockLine(line: OpeningStockLineForm) {
  return Boolean(line.itemId) && Number(line.quantity) > 0;
}

export function formatQty(value: number) {
  if (!value) return '';
  return value.toLocaleString('en-US', {
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 3,
  });
}

export function formatMoney(value: number) {
  return value.toLocaleString('ar-EG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
