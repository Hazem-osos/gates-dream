import { z } from 'zod';

export const supplyOrderLineSchema = z.object({
  itemId: z.string().uuid(),
  warehouseId: z.string().uuid(),
  unitId: z.string().uuid().optional(),
  quantity: z.coerce.number().positive('الكمية يجب أن تكون أكبر من صفر'),
  unitPrice: z.coerce.number().min(0).optional(),
});

export const createSupplyOrderSchema = z.object({
  branchId: z.string().uuid().optional(),
  serial: z.string().trim().max(50).optional(),
  description: z.string().trim().max(2000).optional(),
  date: z.string().min(1),
  hijriDate: z.string().trim().max(32).optional(),
  customerId: z.string().uuid(),
  expectedLeadDays: z.coerce.number().int().min(0).max(3650).optional(),
  expectedDeliveryDate: z.string().optional(),
  lines: z.array(supplyOrderLineSchema).min(1, 'أدخل صنفاً واحداً على الأقل'),
});

export const supplyOrderQuerySchema = z.object({
  customerId: z.string().uuid().optional(),
  isClosed: z
    .enum(['true', 'false', '1', '0'])
    .optional()
    .transform((v) => (v === 'true' || v === '1' ? true : v === 'false' || v === '0' ? false : undefined)),
  isCancelled: z
    .enum(['true', 'false', '1', '0'])
    .optional()
    .transform((v) => (v === 'true' || v === '1' ? true : v === 'false' || v === '0' ? false : undefined)),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  search: z.string().trim().max(200).optional(),
  page: z.string().optional(),
  limit: z.string().optional(),
});

export const supplyOrderFollowUpQuerySchema = z.object({
  customerId: z.string().uuid().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  search: z.string().trim().max(200).optional(),
  /** open | closed | cancelled | all */
  status: z.enum(['open', 'closed', 'cancelled', 'all']).optional().default('open'),
  /** full | partial | none | any */
  coverage: z.enum(['full', 'partial', 'none', 'any']).optional().default('any'),
});

export type CreateSupplyOrderInput = z.infer<typeof createSupplyOrderSchema>;
export type SupplyOrderFollowUpQuery = z.infer<typeof supplyOrderFollowUpQuerySchema>;
