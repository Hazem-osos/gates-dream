import type { SourceHydratePayload } from '@/lib/invoices/sourceDocument';
import { mergeSourceNote } from '@/lib/invoices/sourceDocument';
import {
  blankStockVoucherLine,
  type StockVoucherLine,
} from '@/components/inventory/stock/StockVoucherLinesGrid';
import type { CommercialDocumentLine } from '@/components/inventory/commercial/commercial-line-types';

export function mapSourcePayloadToStockLines(payload: SourceHydratePayload): StockVoucherLine[] {
  if (!payload.lines.length) return [blankStockVoucherLine()];
  return payload.lines.map((line) => {
    const qty = line.quantity || 0;
    const price = line.unitPrice || 0;
    return {
      ...blankStockVoucherLine(),
      itemId: line.itemId,
      quantity: qty,
      unitPrice: price,
      total: qty * price,
    };
  });
}

export type StockDocumentHeaderFromSource = {
  supplierId?: string;
  customerId?: string;
  warehouseId?: string;
  description?: string;
};

export function mapSourcePayloadToCommercialLines(
  payload: SourceHydratePayload
): CommercialDocumentLine[] {
  return payload.lines.map((line) => ({
    itemId: line.itemId,
    itemCode: '',
    itemName: line.itemName,
    unitId: line.unitId || '',
    unitName: '',
    quantity: line.quantity || 0,
    unitPrice: line.unitPrice || 0,
    discount: line.discount || 0,
    taxRate: line.taxRate || 14,
    notes: '',
    costCenterId: line.costCenterId || '',
  }));
}

export function stockHeaderFieldsFromSource(
  payload: SourceHydratePayload,
  previousDescription?: string
): StockDocumentHeaderFromSource {
  return {
    supplierId: payload.supplierId ?? undefined,
    customerId: payload.customerId ?? undefined,
    warehouseId: payload.warehouseId ?? undefined,
    description: mergeSourceNote(previousDescription, payload.notes),
  };
}

export type AdjustmentLineFromSource = {
  itemId: string;
  locationId?: string;
  bookQuantity?: number;
  actualQuantity: number;
  unitPrice?: number;
  adjustmentQuantity?: number;
  adjustmentTotal?: number;
};

export function mapSourcePayloadToAdjustmentLines(
  payload: SourceHydratePayload
): AdjustmentLineFromSource[] {
  if (!payload.lines.length) {
    return [{ itemId: '', actualQuantity: 0 }];
  }
  return payload.lines.map((line) => {
    const qty = line.quantity || 0;
    const price = line.unitPrice || 0;
    return {
      itemId: line.itemId,
      actualQuantity: qty,
      unitPrice: price,
      adjustmentTotal: qty * price,
    };
  });
}

export type StocktakingLineFromSource = {
  itemId: string;
  bookValue: number;
  actualValue: number;
  shortage: number;
  surplus: number;
  unitPrice: number;
};

export function mapSourcePayloadToStocktakingLines(
  payload: SourceHydratePayload
): StocktakingLineFromSource[] {
  if (!payload.lines.length) {
    return [
      {
        itemId: '',
        bookValue: 0,
        actualValue: 0,
        shortage: 0,
        surplus: 0,
        unitPrice: 0,
      },
    ];
  }
  return payload.lines.map((line) => {
    const qty = line.quantity || 0;
    const price = line.unitPrice || 0;
    return {
      itemId: line.itemId,
      bookValue: 0,
      actualValue: qty,
      shortage: 0,
      surplus: qty,
      unitPrice: price,
    };
  });
}
