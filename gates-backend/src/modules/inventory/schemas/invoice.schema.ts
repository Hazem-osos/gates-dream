import { z } from 'zod';

export const invoiceLineSchema = z.object({
  itemId: z.string().uuid('Item ID must be a valid UUID'),
  unitId: z.string().uuid('Unit ID must be a valid UUID').optional(),
  quantity: z.number().positive('Quantity must be greater than 0'),
  baseQuantity: z.number().positive('Base quantity must be greater than 0'),
  conversionFactor: z.number().positive('Conversion factor must be greater than 0').optional().nullable(),
  baseUnitId: z.string().uuid().optional().nullable(),
  price: z.number().nonnegative('Price must be non-negative'),
  discountPercent: z.number().min(0).max(100).optional().nullable(),
  discountAmount: z.number().nonnegative().optional().nullable(),
  taxPercent: z.number().min(0).max(100).optional().nullable(),
  taxAmount: z.number().nonnegative().optional().nullable(),
  lineOrder: z.number().int().positive('Line order must be a positive integer'),
  /** H10 fix: links a return line back to the original sold/purchased line so
   * over-return can be blocked server-side. */
  originalInvoiceLineId: z.string().uuid().optional().nullable(),
  /** Sales Invoice Enterprise Redesign: purely descriptive lot/traceability +
   * note fields — never feed GL posting or costing. */
  batchNumber: z.string().max(191).optional().nullable(),
  expiryDate: z.coerce.date().optional().nullable(),
  productionDate: z.coerce.date().optional().nullable(),
  serialNumbers: z.string().optional().nullable(),
  lineNotes: z.string().optional().nullable(),
  taxExemptionReason: z.string().max(191).optional().nullable(),
  /** Per-line warehouse; falls back to the invoice header warehouse. */
  warehouseId: z.string().uuid().optional().nullable(),
  costCenterId: z.string().uuid().optional().nullable(),
  withholdingTaxRate: z.number().min(0).max(100).optional().nullable(),
  withholdingTaxAmount: z.number().nonnegative().optional().nullable(),
  batchAllocations: z
    .array(
      z.object({
        batchId: z.string().optional(),
        batchNumber: z.string().min(1),
        qty: z.number().positive(),
        expiryDate: z.coerce.date().optional().nullable(),
      })
    )
    .optional()
    .nullable(),
  color: z.string().max(64).optional().nullable(),
  size: z.string().max(64).optional().nullable(),
  customRevenueAccountId: z.string().uuid().optional().nullable(),
});

const invoiceFieldsSchema = z.object({
  invoiceNumber: z.string().optional(),
  invoiceType: z.enum(['sales', 'purchase', 'return'], {
    required_error: 'Invoice type is required',
  }),
  date: z.string().datetime().or(z.date()),
  hijriDate: z.string().optional(),
  description: z.string().optional(),
  currencyCode: z.string().min(1, 'Currency code is required'),
  customerId: z.string().uuid().optional().nullable(),
  supplierId: z.string().uuid().optional().nullable(),
  warehouseId: z.string().uuid('Warehouse ID is required'),
  costCenterId: z.string().uuid().optional().nullable(),
  representativeId: z.string().uuid().optional().nullable(),
  paymentMethod: z.string().optional(),
  sellerId: z.string().uuid().optional().nullable(),
  isSalesTaxInvoice: z.boolean().optional(),
  allowReturn: z.boolean().optional(),
  returnDays: z.number().int().positive().optional().nullable(),
  record: z.string().optional().nullable(),
  conditions: z.array(z.string()).optional().default([]),
  lines: z.array(invoiceLineSchema).min(1, 'Invoice must have at least 1 line item'),
});

export const createInvoiceSchema = invoiceFieldsSchema.refine(
  (data) => {
    if (data.invoiceType === 'sales' && !data.customerId) {
      return false;
    }
    if (data.invoiceType === 'purchase' && !data.supplierId) {
      return false;
    }
    return true;
  },
  {
    message: 'Sales invoice requires customer, purchase invoice requires supplier',
    path: ['invoiceType'],
  }
);

/** PATCH: all fields optional; `.partial()` must run on `ZodObject`, not on `ZodEffects` from `.refine()` */
export const updateInvoiceSchema = invoiceFieldsSchema.partial().extend({
  invoiceType: z.enum(['sales', 'purchase', 'return']).optional(),
  expectedVersion: z.number().int().nonnegative(),
});

export const invoiceQuerySchema = z.object({
  page: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 1)),
  limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 50)),
  search: z.string().optional(),
  invoiceType: z.enum(['sales', 'purchase', 'return']).optional(),
  startDate: z.string().datetime().or(z.date()).optional(),
  endDate: z.string().datetime().or(z.date()).optional(),
  customerId: z.string().uuid().optional().nullable(),
  supplierId: z.string().uuid().optional().nullable(),
  warehouseId: z.string().uuid().optional().nullable(),
  isPosted: z.string().optional().transform((val) => val === 'true'),
  isApproved: z.string().optional().transform((val) => val === 'true'),
  isCancelled: z.string().optional().transform((val) => val === 'true'),
});

export const collectPaymentSchema = z.object({
  paymentAmount: z.number().positive('Payment amount must be greater than 0'),
});

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>;
export type InvoiceQueryInput = z.infer<typeof invoiceQuerySchema>;
export type InvoiceLineInput = z.infer<typeof invoiceLineSchema>;
export type CollectPaymentInput = z.infer<typeof collectPaymentSchema>;
