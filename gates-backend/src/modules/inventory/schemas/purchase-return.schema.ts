import { z } from 'zod';

export const purchaseReturnLineSchema = z.object({
  itemId: z.string().uuid('Item ID must be a valid UUID'),
  unitId: z.string().uuid('Unit ID must be a valid UUID'),
  locationId: z.string().uuid('Location ID must be a valid UUID').optional().nullable(),
  quantity: z.number().positive('Quantity must be positive'),
  baseQuantity: z.number().positive('Base quantity must be positive'),
  unitPrice: z.number().nonnegative('Unit price must be non-negative'),
  total: z.number().nonnegative('Total must be non-negative'),
  discountPercentage: z.number().min(0).max(100, 'Discount percentage must be between 0 and 100').optional(),
  discountValue: z.number().nonnegative('Discount value must be non-negative').optional(),
  taxPercentage: z.number().min(0).max(100, 'Tax percentage must be between 0 and 100').optional(),
  taxValue: z.number().nonnegative('Tax value must be non-negative').optional(),
  netTotal: z.number().nonnegative('Net total must be non-negative'),
  originalInvoiceLineId: z.string().uuid('Original invoice line ID must be a valid UUID').optional().nullable(),
});

export const createPurchaseReturnSchema = z.object({
  branchId: z.string().uuid('Branch ID must be a valid UUID').optional().nullable(),
  description: z.string().optional(),
  serial: z.string().optional(),
  returnNumber: z.string().optional(),
  date: z.string().datetime('Date must be a valid ISO datetime'),
  originalInvoiceId: z.string().uuid('Original invoice ID must be a valid UUID').optional().nullable(),
  supplierId: z.string().uuid('Supplier ID must be a valid UUID'),
  warehouseId: z.string().uuid('Warehouse ID must be a valid UUID'),
  currencyId: z.string().uuid('Currency ID must be a valid UUID').optional().nullable(),
  exchangeRate: z.number().positive('Exchange rate must be positive').optional(),
  paymentMethod: z.enum(['cash', 'credit']).optional(),
  costCenterId: z.string().uuid('Cost center ID must be a valid UUID').optional().nullable(),
  delegateId: z.string().uuid('Delegate ID must be a valid UUID').optional().nullable(),
  lines: z.array(purchaseReturnLineSchema).min(1, 'At least one line is required'),
});

export const purchaseReturnQuerySchema = z.object({
  branchId: z.string().uuid().optional(),
  supplierId: z.string().uuid().optional(),
  warehouseId: z.string().uuid().optional(),
  originalInvoiceId: z.string().uuid().optional(),
  isPosted: z.string().transform((val) => val === 'true').optional(),
  isApproved: z.string().transform((val) => val === 'true').optional(),
  isCancelled: z.string().transform((val) => val === 'true').optional(),
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
  skip: z.string().transform((val) => parseInt(val, 10)).optional(),
  take: z.string().transform((val) => parseInt(val, 10)).optional(),
});

export type CreatePurchaseReturnInput = z.infer<typeof createPurchaseReturnSchema>;
export type PurchaseReturnLineInput = z.infer<typeof purchaseReturnLineSchema>;
export type PurchaseReturnQueryInput = z.infer<typeof purchaseReturnQuerySchema>;

