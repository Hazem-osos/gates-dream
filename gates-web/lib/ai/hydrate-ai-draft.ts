import { sourceLineToPurchaseRow, sourceLineToSalesRow } from '@/lib/invoices/sourceDocument';

export function invoiceDateFromDraft(payload: Record<string, unknown>): string {
  const raw = payload.date;
  if (typeof raw === 'string' && raw.length >= 10) return raw.slice(0, 10);
  return new Date().toISOString().slice(0, 10);
}

export function salesLinesFromAiDraft(payload: Record<string, unknown>, applyTax = true) {
  const warehouseId = String(payload.warehouseId ?? '');
  const lines = Array.isArray(payload.lines) ? payload.lines : [];
  return lines.map((row) => {
    const line = row && typeof row === 'object' ? (row as Record<string, unknown>) : {};
    return sourceLineToSalesRow(
      {
        itemId: String(line.itemId ?? ''),
        itemName: String(line.itemName ?? line.name ?? ''),
        quantity: Number(line.quantity) || 1,
        unitId: line.unitId ? String(line.unitId) : undefined,
        unitPrice: Number(line.price ?? line.unitPrice) || 0,
        taxRate: Number(line.taxPercent ?? line.taxRate ?? 0) || 0,
        withholdingTaxRate: 0,
        discount: 0,
      },
      warehouseId,
      applyTax
    );
  });
}

export function purchaseLinesFromAiDraft(payload: Record<string, unknown>) {
  const warehouseId = String(payload.warehouseId ?? '');
  const lines = Array.isArray(payload.lines) ? payload.lines : [];
  return lines.map((row) => {
    const line = row && typeof row === 'object' ? (row as Record<string, unknown>) : {};
    return sourceLineToPurchaseRow(
      {
        itemId: String(line.itemId ?? ''),
        itemName: String(line.itemName ?? line.name ?? ''),
        quantity: Number(line.quantity) || 1,
        unitId: line.unitId ? String(line.unitId) : undefined,
        unitPrice: Number(line.price ?? line.unitPrice) || 0,
        taxRate: Number(line.taxPercent ?? line.tax ?? 0) || 0,
        withholdingTaxRate: 0,
        discount: 0,
      },
      warehouseId
    );
  });
}

export function issueLinesFromAiDraft(payload: Record<string, unknown>) {
  const lines = Array.isArray(payload.lines) ? payload.lines : [];
  return lines.map((row) => {
    const line = row && typeof row === 'object' ? (row as Record<string, unknown>) : {};
    return {
      itemId: String(line.itemId ?? ''),
      quantity: Number(line.quantity) || 1,
      unitPrice: Number(line.unitPrice ?? line.price) || 0,
      total: Number(line.total ?? 0) || Number(line.quantity) * Number(line.unitPrice ?? line.price ?? 0),
    };
  });
}
