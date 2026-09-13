import { z } from 'zod';

export const createElectronicInvoiceSchema = z.object({
  branchId: z.string().uuid().optional().nullable(),
  customerId: z.string().uuid(),
  invoiceType: z.enum(['sales', 'return', 'amendment']).default('sales'),
  invoiceNumber: z.string().optional().nullable(),
  invoiceDate: z.coerce.date(),
  hijriDate: z.string().optional().nullable(),
  lines: z.array(z.object({
    itemId: z.string().uuid().optional().nullable(),
    itemCode: z.string().min(1),
    arabicName: z.string().min(1),
    englishName: z.string().optional().nullable(),
    quantity: z.number().nonnegative(),
    unitCode: z.string().optional().nullable(),
    unitName: z.string().optional().nullable(),
    unitPrice: z.number().nonnegative(),
    totalPrice: z.number().nonnegative(),
    taxType: z.string().optional().nullable(),
    taxRate: z.number().nonnegative().max(100).optional().nullable(),
    taxAmount: z.number().nonnegative(),
    discountAmount: z.number().nonnegative().optional().nullable(),
    totalAfterTax: z.number().nonnegative(),
  })).min(1, 'At least one line item is required'),
  discountAmount: z.number().nonnegative().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const updateElectronicInvoiceSchema = createElectronicInvoiceSchema.partial();

export const electronicInvoiceQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(1000).optional(),
  customerId: z.string().uuid().optional(),
  invoiceType: z.enum(['sales', 'return', 'amendment']).optional(),
  status: z.enum(['draft', 'submitted', 'approved', 'rejected', 'cancelled']).optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
});

