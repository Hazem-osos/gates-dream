import { z } from 'zod';

export const priceQuoteLineSchema = z.object({
  itemId: z.string().uuid('Item ID must be a valid UUID'),
  unitId: z.string().uuid('Unit ID must be a valid UUID'),
  baseUnitId: z.string().uuid('Base unit ID must be a valid UUID').optional().nullable(),
  quantity: z.number().positive('Quantity must be positive'),
  baseQuantity: z.number().positive('Base quantity must be positive'),
  unitPrice: z.number().nonnegative('Unit price must be non-negative'),
  total: z.number().nonnegative('Total must be non-negative'),
  discountPercentage: z.number().min(0).max(100, 'Discount percentage must be between 0 and 100').optional(),
  discountValue: z.number().nonnegative('Discount value must be non-negative').optional(),
  taxPercentage: z.number().min(0).max(100, 'Tax percentage must be between 0 and 100').optional(),
  taxValue: z.number().nonnegative('Tax value must be non-negative').optional(),
  netTotal: z.number().nonnegative('Net total must be non-negative'),
});

export const createPriceQuoteSchema = z.object({
  branchId: z.string().uuid('Branch ID must be a valid UUID').optional().nullable(),
  description: z.string().optional(),
  serial: z.string().optional(),
  quoteNumber: z.string().optional(),
  date: z.string().datetime('Date must be a valid ISO datetime'),
  customerId: z.string().uuid('Customer ID must be a valid UUID'),
  warehouseId: z.string().uuid('Warehouse ID must be a valid UUID').optional().nullable(),
  currencyId: z.string().uuid('Currency ID must be a valid UUID').optional().nullable(),
  exchangeRate: z.number().positive('Exchange rate must be positive').optional(),
  paymentMethod: z.enum(['cash', 'credit']).optional(),
  isSalesTaxInvoice: z.boolean().optional(),
  delegateId: z.string().uuid('Delegate ID must be a valid UUID').optional().nullable(),
  costCenterId: z.string().uuid('Cost center ID must be a valid UUID').optional().nullable(),
  conditions: z.array(z.string()).optional(),
  validUntil: z.string().datetime('Valid until must be a valid ISO datetime').optional(),
  lines: z.array(priceQuoteLineSchema).min(1, 'At least one line is required'),
});

export const priceQuoteQuerySchema = z.object({
  branchId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  warehouseId: z.string().uuid().optional(),
  isPosted: z.string().transform((val) => val === 'true').optional(),
  isApproved: z.string().transform((val) => val === 'true').optional(),
  isCancelled: z.string().transform((val) => val === 'true').optional(),
  isConverted: z.string().transform((val) => val === 'true').optional(),
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
  skip: z.string().transform((val) => parseInt(val, 10)).optional(),
  take: z.string().transform((val) => parseInt(val, 10)).optional(),
});

export type CreatePriceQuoteInput = z.infer<typeof createPriceQuoteSchema>;
export type PriceQuoteLineInput = z.infer<typeof priceQuoteLineSchema>;
export type PriceQuoteQueryInput = z.infer<typeof priceQuoteQuerySchema>;

