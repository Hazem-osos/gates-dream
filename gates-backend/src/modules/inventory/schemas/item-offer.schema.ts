import { z } from 'zod';
import { normalizePromotionPayload } from '../dto/item-promotions.dto';

const uuidOrEmpty = z
  .string()
  .optional()
  .nullable()
  .transform((val) => (val && val.length > 0 ? val : undefined));

const canonicalOfferFields = z.object({
  branchId: uuidOrEmpty,
  nameAr: z.string().trim().min(1, 'يرجى إدخال اسم العرض').optional(),
  description: z.string().optional(),
  serial: z.string().optional(),
  how: z.enum(['additional-quantity', 'discount-percentage', 'invoice-value']),
  type: z.enum(['purchases', 'sales']),
  source: z.enum(['input-units', 'suppliers', 'customers', 'all']).default('all'),
  fromItemId: z.string().uuid().optional(),
  quantity: z.number().positive().default(1),
  percentage: z.number().min(0).max(100).optional(),
  offerQuantity: z.number().positive().optional(),
  toItemId: z.string().uuid().optional().nullable(),
  invoiceValue: z.number().nonnegative().optional(),
  supplierId: z.string().uuid().optional().nullable(),
  unitId: z.string().uuid().optional().nullable(),
  applyToAllParties: z.boolean().default(true),
  applyToAllPatterns: z.boolean().default(true),
  targetPartyIds: z.array(z.string()).default([]),
  targetPatternIds: z.array(z.string()).default([]),
  fromDate: z.string().datetime(),
  toDate: z.string().datetime(),
  fromDateHijri: z.string().optional(),
  toDateHijri: z.string().optional(),
  isActive: z.boolean().optional(),
});

export const itemOfferSchema = z
  .preprocess((input) => {
    if (!input || typeof input !== 'object') return input;
    return normalizePromotionPayload(input as Record<string, unknown>);
  }, canonicalOfferFields)
  .superRefine((data, ctx) => {
    if (data.how !== 'invoice-value' && !data.fromItemId) {
      ctx.addIssue({ code: 'custom', path: ['fromItemId'], message: 'الصنف الأساسي مطلوب' });
    }
    if (data.how === 'additional-quantity') {
      if (!data.toItemId) {
        ctx.addIssue({ code: 'custom', path: ['toItemId'], message: 'الصنف الهدية مطلوب' });
      }
      if (data.offerQuantity == null) {
        ctx.addIssue({ code: 'custom', path: ['offerQuantity'], message: 'كمية الهدية مطلوبة' });
      }
    }
    if (data.how === 'discount-percentage' && data.percentage == null) {
      ctx.addIssue({ code: 'custom', path: ['percentage'], message: 'نسبة الخصم مطلوبة' });
    }
    if (data.how === 'invoice-value') {
      if (data.invoiceValue == null) {
        ctx.addIssue({ code: 'custom', path: ['invoiceValue'], message: 'الحد الأدنى لقيمة الفاتورة مطلوب' });
      }
      if (data.percentage == null) {
        ctx.addIssue({ code: 'custom', path: ['percentage'], message: 'نسبة الخصم مطلوبة' });
      }
    }
    if (!data.applyToAllParties && data.targetPartyIds.length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['targetPartyIds'],
        message: 'اختر طرفاً واحداً على الأقل أو فعّل تطبيق على كافة الأطراف',
      });
    }
    if (!data.applyToAllPatterns && data.targetPatternIds.length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['targetPatternIds'],
        message: 'اختر نمط إدخال واحد على الأقل أو فعّل تطبيق على كافة الوحدات',
      });
    }
    if (new Date(data.fromDate) > new Date(data.toDate)) {
      ctx.addIssue({
        code: 'custom',
        path: ['toDate'],
        message: 'تاريخ البداية يجب أن يكون قبل أو يساوي تاريخ النهاية',
      });
    }
  });

export const updateItemOfferSchema = z.preprocess((input) => {
  if (!input || typeof input !== 'object') return input;
  return normalizePromotionPayload(input as Record<string, unknown>);
}, canonicalOfferFields.partial());

export const itemOfferQuerySchema = z.object({
  branchId: z.string().uuid().optional(),
  how: z.enum(['additional-quantity', 'discount-percentage', 'invoice-value']).optional(),
  type: z.enum(['purchases', 'sales']).optional(),
  source: z.enum(['input-units', 'suppliers', 'customers', 'all']).optional(),
  fromItemId: z.string().uuid().optional(),
  isActive: z
    .string()
    .transform((val) => val === 'true')
    .optional(),
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
  skip: z
    .string()
    .transform((val) => parseInt(val, 10))
    .optional(),
  take: z
    .string()
    .transform((val) => parseInt(val, 10))
    .optional(),
});

export type CreateItemOfferInput = z.infer<typeof itemOfferSchema>;
export type UpdateItemOfferInput = z.infer<typeof updateItemOfferSchema>;
export type ItemOfferQueryInput = z.infer<typeof itemOfferQuerySchema>;
