import { z } from 'zod';

const asPage = z
  .union([z.string(), z.number()])
  .optional()
  .transform((val) => {
    const n = typeof val === 'number' ? val : val ? parseInt(val, 10) : 1;
    return Number.isFinite(n) && n > 0 ? n : 1;
  });

const asLimit = z
  .union([z.string(), z.number()])
  .optional()
  .transform((val) => {
    const n = typeof val === 'number' ? val : val ? parseInt(val, 10) : 50;
    return Number.isFinite(n) && n > 0 ? n : 50;
  });

const quantity = z.coerce
  .number({ invalid_type_error: 'الكمية غير صالحة' })
  .positive('الكمية يجب أن تكون أكبر من صفر');

const reason = z.string().trim().min(1, 'سبب الحجز مطلوب').max(500, 'سبب الحجز أطول من المسموح');

export const createItemReservationSchema = z.object({
  warehouseId: z.string().min(1, 'يرجى اختيار المخزن'),
  itemId: z.string().min(1, 'يرجى اختيار الصنف'),
  quantity,
  reason,
});

export const updateItemReservationSchema = z.object({
  quantity,
  reason,
});

export const itemReservationQuerySchema = z.object({
  page: asPage,
  limit: asLimit,
  warehouseId: z.string().min(1).optional(),
  itemId: z.string().min(1).optional(),
  status: z.enum(['ACTIVE', 'RELEASED', 'ALL', 'OPEN']).optional(),
});

export type CreateItemReservationInput = z.infer<typeof createItemReservationSchema>;
export type UpdateItemReservationInput = z.infer<typeof updateItemReservationSchema>;
