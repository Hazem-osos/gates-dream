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
  closingCashDeclared: z.number().nonnegative(),
});

const posLineSchema = z.object({
  itemId: z.string().uuid(),
  unitId: z.string().uuid(),
  quantity: z.number().positive(),
  price: z.number().nonnegative(),
  /** H12 fix: percent-based discount, matching invoice lines. */
  discountPercent: z.number().min(0).max(100).optional(),
  discountAmount: z.number().nonnegative().optional(),
  taxPercent: z.number().nonnegative().optional(),
  lineOrder: z.number().int().positive(),
});

// ── Legacy POS sale surface (`/api/v1/pos/sales`, still used by the POS screens) ──────────
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

export const createPosOrderSchema = z.object({
  shiftId: z.string().uuid(),
  orderNumber: z.string().min(1),
  orderType: z.enum(['SALE', 'RETURN']).optional(),
  originalOrderId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  paymentMethod: z.enum(['CASH', 'CARD', 'CREDIT', 'SPLIT']),
  cashAmount: z.number().nonnegative().optional(),
  cardAmount: z.number().nonnegative().optional(),
  creditAmount: z.number().nonnegative().optional(),
  currencyCode: z.string().optional(),
  lines: z.array(posLineSchema).min(1),
});
