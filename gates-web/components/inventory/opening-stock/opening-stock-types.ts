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

export function openingStockLineIssues(line: OpeningStockLineForm): string[] {
  const issues: string[] = [];
  if (!line.itemId) issues.push('اختر الصنف من الدليل');
  if (!line.warehouseId) issues.push('اختر المخزن التشغيلي');
  if (!(Number(line.quantity) > 0)) issues.push('كمية أول المدة لازم تكون أكبر من صفر');
  if (Number(line.unitCost) < 0) issues.push('تكلفة الوحدة لا تقل عن صفر');
  return issues;
}

export function summarizeOpeningStockIssues(lines: OpeningStockLineForm[]): string[] {
  return lines.flatMap((line, index) => {
    const started = Boolean(line.itemId || line.itemCode || line.itemName || Number(line.quantity) > 0);
    if (!started) return [];
    return openingStockLineIssues(line).map((issue) => `سطر ${index + 1}: ${issue}`);
  });
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
