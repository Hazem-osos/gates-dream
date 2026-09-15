import { z } from 'zod';

export const sourceDocumentTypeSchema = z.enum([
  'QUOTATION',
  'SALES_ORDER',
  'PURCHASE_ORDER',
  'PURCHASE_INVOICE',
  'DELIVERY_NOTE',
  'NONE',
]);

export const selectableSourceTypeSchema = z.enum([
  'QUOTATION',
  'SALES_ORDER',
  'PURCHASE_ORDER',
  'PURCHASE_INVOICE',
  'DELIVERY_NOTE',
]);

export const listSourceDocumentsQuerySchema = z.object({
  type: selectableSourceTypeSchema,
  search: z.string().trim().max(200).optional(),
  page: z.string().optional().transform((v) => {
    const n = v ? parseInt(v, 10) : 1;
    return Number.isFinite(n) && n > 0 ? n : 1;
  }),
  limit: z.string().optional().transform((v) => {
    const n = v ? parseInt(v, 10) : 100;
    return Math.min(Math.max(Number.isFinite(n) ? n : 100, 1), 200);
  }),
});

export const sourceDocumentParamsSchema = z.object({
  type: selectableSourceTypeSchema,
  id: z.string().uuid(),
});

export const analyticalInvoiceMovementQuerySchema = z.object({
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  sourceType: selectableSourceTypeSchema.optional(),
  partyId: z.string().uuid().optional(),
  status: z.enum(['كامل', 'جزئي', 'ملغي']).optional(),
  search: z.string().trim().max(200).optional(),
  page: z.string().optional().transform((v) => {
    const n = v ? parseInt(v, 10) : 1;
    return Number.isFinite(n) && n > 0 ? n : 1;
  }),
  limit: z.string().optional().transform((v) => {
    const n = v ? parseInt(v, 10) : 50;
    return Math.min(Math.max(Number.isFinite(n) ? n : 50, 1), 200);
  }),
});

export type SelectableSourceType = z.infer<typeof selectableSourceTypeSchema>;
export type SourceDocumentTypeValue = z.infer<typeof sourceDocumentTypeSchema>;
