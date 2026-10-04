import { z } from 'zod';

export const createPosTerminalSchema = z.object({
  branchId: z.string().uuid(),
  warehouseId: z.string().uuid(),
  safeId: z.string().uuid(),
  bankAccountId: z.string().uuid().optional(),
  defaultCustomerId: z.string().uuid().optional(),
  name: z.string().min(1),
  deviceCode: z.string().optional(),
});

export const openShiftSchema = z.object({
  terminalId: z.string().uuid(),
  openingCash: z.number().nonnegative(),
  shiftNumber: z.string().optional(),
});

export const closeShiftSchema = z.object({
  closingCashDeclared: z.number().nonnegative().optional(),
  denominations: z.array(z.object({
    value: z.number().positive(),
    count: z.number().int().nonnegative(),
  })).optional(),
}).refine((body) => body.closingCashDeclared != null || (body.denominations?.length ?? 0) > 0, {
  message: 'Counted cash or denominations are required',
});

export const posCashMovementSchema = z.object({
  type: z.enum(['CASH_IN', 'CASH_OUT']),
  amount: z.number().positive(),
  reason: z.string().min(1).max(191),
  contraAccountId: z.string().min(1),
});

const posLineSchema = z.object({
  itemId: z.string().uuid(),
  unitId: z.string().uuid(),
  quantity: z.number().positive(),
  price: z.number().nonnegative().optional(),
  discountPercent: z.number().min(0).max(100).optional(),
  discountAmount: z.number().nonnegative().optional(),
  taxPercent: z.number().nonnegative().optional(),
  lineOrder: z.number().int().positive(),
  notes: z.string().max(191).optional(),
});

// ── Legacy POS sale surface (`/api/v1/pos/sales`).
// The cashier posts PosOrder via /pos/orders. This schema remains for the
// deprecated invoice route. Do not delete it in Phase 1.
// Mirrors `CreatePOSSaleData` / the list + daily-report filters in pos.service.ts.

const posSaleLineSchema = z.object({
  itemId: z.string().uuid(),
  unitId: z.string().uuid(),
  quantity: z.number().positive(),
  baseQuantity: z.number().positive(),
  price: z.number().nonnegative(),
  discountPercent: z.number().nonnegative().optional(),
  discountAmount: z.number().nonnegative().optional(),
  taxPercent: z.number().nonnegative().optional(),
  taxAmount: z.number().nonnegative().optional(),
  lineOrder: z.number().int().positive(),
});

export const createPOSSaleSchema = z.object({
  invoiceNumber: z.string().optional(),
  date: z.coerce.date(),
  hijriDate: z.string().optional(),
  description: z.string().optional(),
  currencyCode: z.string().min(1),
  customerId: z.string().uuid().optional(),
  warehouseId: z.string().uuid(),
  sellerId: z.string().uuid().optional(),
  paymentMethod: z.enum(['cash', 'card', 'multiple']),
  payments: z
    .array(
      z.object({
        method: z.enum(['cash', 'card', 'other']),
        amount: z.number().nonnegative(),
      })
    )
    .optional(),
  lines: z.array(posSaleLineSchema).min(1),
});

export const posSaleQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(500).optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
  warehouseId: z.string().uuid().optional(),
  sellerId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
});

export const dailyPOSReportQuerySchema = z.object({
  date: z.coerce.date(),
  warehouseId: z.string().uuid().optional(),
  sellerId: z.string().uuid().optional(),
});

export const posPaymentSchema = z.object({
  method: z.string().trim().min(1).max(20),
  amount: z.number().positive(),
  tenderedAmount: z.number().nonnegative().optional(),
  safeId: z.string().uuid().optional(),
  bankAccountId: z.string().uuid().optional(),
  referenceNumber: z.string().max(120).optional(),
  currencyCode: z.string().max(8).optional(),
  exchangeRate: z.number().positive().optional(),
});

export const createPosOrderSchema = z.object({
  shiftId: z.string().uuid(),
  orderNumber: z.string().min(1),
  orderType: z.enum(['SALE', 'RETURN']).optional(),
  originalOrderId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  notes: z.string().max(2000).optional(),
  headerDiscountPercent: z.number().min(0).max(100).optional(),
  hold: z.boolean().optional(),
  paymentMethod: z.enum(['CASH', 'CARD', 'CREDIT', 'SPLIT']).optional(),
  cashAmount: z.number().nonnegative().optional(),
  cardAmount: z.number().nonnegative().optional(),
  creditAmount: z.number().nonnegative().optional(),
  currencyCode: z.string().optional(),
  lines: z.array(posLineSchema).min(1),
  clientRequestId: z.string().min(8).max(64).optional(),
  couponCode: z.string().max(40).optional(),
});

export const postPosOrderSchema = z.object({
  payments: z.array(posPaymentSchema).optional(),
  approvalId: z.string().uuid().optional(),
});

export const posReturnSchema = z.object({
  shiftId: z.string().uuid(),
  originalOrderId: z.string().uuid(),
  notes: z.string().max(2000).optional(),
  lines: z
    .array(
      z.object({
        originalLineId: z.string().uuid(),
        quantity: z.number().positive(),
      })
    )
    .min(1),
  payments: z.array(posPaymentSchema).min(1),
  approvalId: z.string().uuid().optional(),
});

export const quotePosOrderSchema = z.object({
  customerId: z.string().uuid().optional(),
  headerDiscountPercent: z.number().min(0).max(100).optional(),
  couponCode: z.string().max(40).optional(),
  lines: z.array(posLineSchema).min(1),
});
