import { createHash } from 'crypto';
import {
  CREATE_PURCHASE_REQUEST_ACTION,
  type CreateAutomationPurchaseRequestInput,
} from '../schemas/automation-purchase-request.schema';

/** Mirrors `CreatePurchaseOrderData` without importing the domain service (keeps tests prisma-free). */
export type MappedPurchaseOrderCreate = {
  companyId: string;
  branchId?: string;
  description?: string;
  serial?: string;
  automationIdempotencyKey?: string;
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

/**
 * DB-enforced identity for one automation action. Independent of correlationId.
 * Fits VARCHAR(255); hashes if the raw key would overflow.
 */
export function automationIdempotencyKey(input: {
  eventId: string;
  ruleId: string;
  actionType?: string;
}): string {
  const actionType = input.actionType ?? CREATE_PURCHASE_REQUEST_ACTION;
  const raw = `${input.eventId}:${input.ruleId}:${actionType}`;
  const prefixed = `pr:${raw}`;
  if (Buffer.byteLength(prefixed, 'utf8') <= 255) return prefixed;
  return `pr:${createHash('sha256').update(raw).digest('hex')}`;
}

/**
 * Recovery keys for a run. The first-claim correlationId is canonical;
 * an incoming retry correlationId is only an extra lookup, never the sole key.
 */
export function recoverySerialsForRun(
  run: { correlationId: string },
  incomingCorrelationId?: string
): string[] {
  const serials = [automationPurchaseOrderSerial(run.correlationId)];
  if (incomingCorrelationId && incomingCorrelationId !== run.correlationId) {
    serials.push(automationPurchaseOrderSerial(incomingCorrelationId));
  }
  return [...new Set(serials)];
}

export function mapAutomationPayloadToPurchaseOrder(
  input: CreateAutomationPurchaseRequestInput,
  options?: { serial?: string }
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
    serial: options?.serial ?? automationPurchaseOrderSerial(input.correlationId),
    automationIdempotencyKey: automationIdempotencyKey(input),
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
