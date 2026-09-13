import { z } from 'zod';

export const createElectronicInvoiceItemSchema = z.object({
  itemId: z.string().uuid().optional().nullable(),
  itemCode: z.string().min(1, 'Item code is required'),
  arabicName: z.string().min(1, 'Arabic name is required'),
  englishName: z.string().optional().nullable(),
  unitCode: z.string().optional().nullable(),
  unitName: z.string().optional().nullable(),
  taxType: z.string().optional().nullable(),
  taxRate: z.number().nonnegative().max(100).optional().nullable(),
  price: z.number().nonnegative().optional().nullable(),
  description: z.string().optional().nullable(),
});

export const updateElectronicInvoiceItemSchema = createElectronicInvoiceItemSchema.partial();

export const electronicInvoiceItemQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(1000).optional(),
  search: z.string().optional(),
  isActive: z.coerce.boolean().optional(),
});

