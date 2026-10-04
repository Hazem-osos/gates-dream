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
  profileId: z.string().uuid().optional(),
  partyId: z.string().uuid().optional(),
  status: z.enum(['كامل', 'مكتمل', 'جزئي', 'مفتوح', 'ملغي']).optional(),
  search: z.string().trim().max(200).optional(),
  page: z.string().optional().transform((v) => {
    const n = v ? parseInt(v, 10) : 1;
    return Number.isFinite(n) && n > 0 ? n : 1;
  }),
  limit: z.string().optional().transform((v) => {
    const n = v ? parseInt(v, 10) : 50;
    return Math.min(Math.max(Number.isFinite(n) ? n : 50, 1), 2000);
  }),
});

export const invoiceAnalyticalQuerySchema = z.object({
  fromDate: z.string().min(1),
  toDate: z.string().min(1),
  partyId: z.string().uuid().optional(),
  warehouseId: z.string().uuid().optional(),
  kind: z.enum(['SALE', 'PURCHASE', 'SALE_RETURN', 'PURCHASE_RETURN']).optional(),
  showUnposted: z.enum(['true', 'false', '1', '0']).optional(),
});

export type SelectableSourceType = z.infer<typeof selectableSourceTypeSchema>;
export type SourceDocumentTypeValue = z.infer<typeof sourceDocumentTypeSchema>;
