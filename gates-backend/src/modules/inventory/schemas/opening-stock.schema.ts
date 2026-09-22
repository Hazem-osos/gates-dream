import { z } from 'zod';

const emptyToUndefined = (value: unknown) =>
  value === '' || value === null || value === undefined ? undefined : value;

export const openingStockLineSchema = z.object({
  itemId: z.string().min(1, 'اختر الصنف من الدليل'),
  warehouseId: z.preprocess(emptyToUndefined, z.string().min(1, 'اختر المخزن التشغيلي على السطر').optional()),
  locationId: z.preprocess(emptyToUndefined, z.string().optional().nullable()),
  quantity: z.coerce.number().positive('كمية أول المدة لازم تكون أكبر من صفر'),
  unitPrice: z.coerce.number().nonnegative('تكلفة الوحدة لا تقل عن صفر'),
  total: z.coerce.number().nonnegative('إجمالي القيمة غير صالح'),
});

export const createOpeningStockSchema = z.object({
  branchId: z.preprocess(emptyToUndefined, z.string().optional().nullable()),
  description: z.string().optional(),
  serial: z.string().optional(),
  date: z
    .string()
    .min(1, 'تاريخ الكشف غير صالح')
    .transform((value, ctx) => {
      const raw = value.trim();
      const parsed = /^\d{4}-\d{2}-\d{2}$/.test(raw)
        ? new Date(`${raw}T12:00:00`)
        : new Date(raw);
      if (Number.isNaN(parsed.getTime())) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'تاريخ الكشف غير صالح' });
        return raw;
      }
      return parsed.toISOString();
    }),
  lines: z.array(openingStockLineSchema).min(1, 'أدخل صنفاً وكمية أكبر من صفر في سطر واحد على الأقل'),
});

const optionalBool = z
  .union([z.boolean(), z.string()])
  .optional()
  .transform((val) => (val === undefined ? undefined : val === true || val === 'true'));

const optionalInt = z
  .union([z.number(), z.string()])
  .optional()
  .transform((val) => {
    if (val === undefined || val === '') return undefined;
    const n = typeof val === 'number' ? val : Number.parseInt(val, 10);
    return Number.isFinite(n) ? n : undefined;
  });

export const openingStockQuerySchema = z.object({
  branchId: z.string().uuid().optional(),
  isPosted: optionalBool,
  isApproved: optionalBool,
  isCancelled: optionalBool,
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  search: z.string().optional(),
  skip: optionalInt,
  take: optionalInt,
});

export type CreateOpeningStockInput = z.infer<typeof createOpeningStockSchema>;
export type OpeningStockLineInput = z.infer<typeof openingStockLineSchema>;
export type OpeningStockQueryInput = z.infer<typeof openingStockQuerySchema>;

