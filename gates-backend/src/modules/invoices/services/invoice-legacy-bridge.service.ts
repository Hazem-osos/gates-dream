import type { UpdateM5InvoiceInput } from '../schemas/invoice-m5.schema';
import type {
  InvoiceLineData,
  UpdateInvoiceData,
} from '../../inventory/services/invoice.service';

function mapLines(lines: InvoiceLineData[]): UpdateM5InvoiceInput['lines'] {
  return lines.map((line, index) => ({
    itemId: line.itemId,
    unitId: line.unitId,
    quantity: line.quantity,
    baseQuantity: line.baseQuantity,
    price: line.price,
    discountPercent: line.discountPercent,
    discountAmount: line.discountAmount,
    taxPercent: line.taxPercent,
    taxAmount: line.taxAmount,
    lineOrder: line.lineOrder ?? index + 1,
  }));
}

/** Maps legacy `/inventory/invoices` update bodies to M5 update input. */
export function legacyUpdateBodyToM5(data: UpdateInvoiceData): UpdateM5InvoiceInput {
  const out: UpdateM5InvoiceInput = {};

  if (data.invoiceNumber !== undefined) out.invoiceNumber = data.invoiceNumber;
  if (data.date !== undefined) out.date = data.date;
  if (data.hijriDate !== undefined) out.hijriDate = data.hijriDate;
  if (data.description !== undefined) out.description = data.description;
  if (data.currencyCode !== undefined) out.currencyCode = data.currencyCode;
  if (data.customerId !== undefined) out.customerId = data.customerId;
  if (data.supplierId !== undefined) out.supplierId = data.supplierId;
  if (data.warehouseId !== undefined) out.warehouseId = data.warehouseId;
  if (data.costCenterId !== undefined) out.costCenterId = data.costCenterId;
  if (data.representativeId !== undefined) out.representativeId = data.representativeId;
  if (data.paymentMethod !== undefined) out.paymentMethod = data.paymentMethod;
  if (data.lines) out.lines = mapLines(data.lines);
  if (data.expectedVersion !== undefined) out.expectedVersion = data.expectedVersion;

  return out;
}
