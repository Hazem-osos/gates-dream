import { z } from 'zod';

export const purchaseOrderLineSchema = z.object({
  itemId: z.string().uuid('Item ID must be a valid UUID'),
  unitId: z.string().uuid('Unit ID must be a valid UUID').optional().nullable(),
  baseUnitId: z.string().uuid('Base unit ID must be a valid UUID').optional().nullable(),
  quantity: z.number().positive('Quantity must be positive'),
  baseQuantity: z.number().positive('Base quantity must be positive').optional(),
  unitPrice: z.number().nonnegative('Unit price must be non-negative').optional(),
  total: z.number().nonnegative('Total must be non-negative').optional(),
  discountPercentage: z.number().min(0).max(100, 'Discount percentage must be between 0 and 100').optional(),
  discountValue: z.number().nonnegative('Discount value must be non-negative').optional(),
  taxPercentage: z.number().min(0).max(100, 'Tax percentage must be between 0 and 100').optional(),
  taxValue: z.number().nonnegative('Tax value must be non-negative').optional(),
  netTotal: z.number().nonnegative('Net total must be non-negative').optional(),
});

export const createPurchaseOrderSchema = z.object({
  branchId: z.string().uuid('Branch ID must be a valid UUID').optional().nullable(),
  description: z.string().optional(),
  serial: z.string().optional(),
  orderNumber: z.string().optional(),
  date: z.string().datetime('Date must be a valid ISO datetime'),
  hijriDate: z.string().optional(),
  supplierId: z.string().uuid('Supplier ID must be a valid UUID'),
  warehouseId: z.string().uuid('Warehouse ID must be a valid UUID').optional().nullable(),
  currencyId: z.string().uuid('Currency ID must be a valid UUID').optional().nullable(),
  exchangeRate: z.number().positive('Exchange rate must be positive').optional(),
  conditions: z.array(z.string()).optional(),
  expectedDeliveryDate: z.string().datetime('Expected delivery date must be a valid ISO datetime').optional(),
  expectedDeliveryDateHijri: z.string().optional(),
  costCenterId: z.string().uuid().optional().nullable(),
  lines: z.array(purchaseOrderLineSchema).min(1, 'At least one line is required'),
});

export const purchaseOrderQuerySchema = z.object({
  branchId: z.string().uuid().optional(),
  supplierId: z.string().uuid().optional(),
  warehouseId: z.string().uuid().optional(),
  isPosted: z.string().transform((val) => val === 'true').optional(),
  isApproved: z.string().transform((val) => val === 'true').optional(),
  isCancelled: z.string().transform((val) => val === 'true').optional(),
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
  skip: z.string().transform((val) => parseInt(val, 10)).optional(),
  take: z.string().transform((val) => parseInt(val, 10)).optional(),
});

export type CreatePurchaseOrderInput = z.infer<typeof createPurchaseOrderSchema>;
export type PurchaseOrderLineInput = z.infer<typeof purchaseOrderLineSchema>;
export type PurchaseOrderQueryInput = z.infer<typeof purchaseOrderQuerySchema>;

