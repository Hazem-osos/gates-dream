import { z } from 'zod';

export const createDocumentaryCreditDefinitionSchema = z.object({
  serial: z.string().optional(),
  supplierId: z.string().uuid().optional().nullable(),
  supplierName: z.string().optional(),
  description: z.string().optional(),
  shippingPort: z.string().optional(),
  creditValue: z.number().nonnegative().optional().nullable(),
  creditNumber: z.string().optional(),
  currencyId: z.string().uuid().optional().nullable(),
  currencyName: z.string().optional(),
  shippingMethod: z.enum(['بحري', 'جوي', 'برى']).optional(),
  paymentMethod: z.enum(['فيزا', 'شيك', 'نقد']).optional(),
  openingDate: z.string().datetime().or(z.date()).optional().nullable(),
  openingDateHijri: z.string().optional(),
  closingDate: z.string().datetime().or(z.date()).optional().nullable(),
  closingDateHijri: z.string().optional(),
  shippingDate: z.string().datetime().or(z.date()).optional().nullable(),
  shippingDateHijri: z.string().optional(),
});

export const updateDocumentaryCreditDefinitionSchema = createDocumentaryCreditDefinitionSchema.partial();

