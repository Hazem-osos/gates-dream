import type { CreateAutomationPurchaseRequestInput } from '../schemas/automation-purchase-request.schema';

/** Mirrors `CreatePurchaseOrderData` without importing the domain service (keeps tests prisma-free). */
export type MappedPurchaseOrderCreate = {
  companyId: string;
  branchId?: string;
  description?: string;
  serial?: string;
  date: string;
  supplierId: string;
  warehouseId?: string;
  currencyId?: string;
  exchangeRate?: number;
  expectedDeliveryDate?: string;
  lines: Array<{
    itemId: string;
    quantity: number;
    unitId?: string;
    baseUnitId?: string;
    unitPrice?: number;
    discountPercentage?: number;
    discountValue?: number;
    taxPercentage?: number;
    taxValue?: number;
  }>;
};

/** Stored on PurchaseOrder.serial so a crashed PENDING run can recover the PO. */
export function automationPurchaseOrderSerial(correlationId: string): string {
  return `n8n:${correlationId}`.slice(0, 191);
}

export function mapAutomationPayloadToPurchaseOrder(
  input: CreateAutomationPurchaseRequestInput
): MappedPurchaseOrderCreate {
  return {
    companyId: input.companyId,
    supplierId: input.supplierId,
    date: input.date,
    warehouseId: input.warehouseId ?? undefined,
    branchId: input.branchId ?? undefined,
    description: input.description,
    currencyId: input.currencyId ?? undefined,
    exchangeRate: input.exchangeRate,
    expectedDeliveryDate: input.expectedDeliveryDate,
    serial: automationPurchaseOrderSerial(input.correlationId),
    lines: input.lines.map((line) => ({
      itemId: line.itemId,
      quantity: line.quantity,
      unitId: line.unitId ?? undefined,
      baseUnitId: line.baseUnitId ?? undefined,
      unitPrice: line.unitPrice,
      discountPercentage: line.discountPercentage ?? line.discount,
      discountValue: line.discountValue,
      taxPercentage: line.taxPercentage ?? line.tax,
      taxValue: line.taxValue,
    })),
  };
}

export function toAutomationPurchaseOrderView(order: {
  id: string;
  orderNumber?: string | null;
  companyId: string;
  isPosted: boolean;
  isApproved: boolean;
}) {
  return {
    id: order.id,
    orderNumber: order.orderNumber ?? null,
    companyId: order.companyId,
    isPosted: order.isPosted,
    isApproved: order.isApproved,
  };
}
