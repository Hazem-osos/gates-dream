import { z } from 'zod';

const optionalUuid = z.string().uuid().optional().nullable();

export const createItemCategorySchema = z.object({
  code: z.string().optional().nullable(),
  arabicName: z.string().min(1, 'Arabic name is required'),
  englishName: z.string().optional().nullable(),
  groupType: z.enum(['MAIN', 'SUB']).optional().nullable(),
  parentCategoryId: optionalUuid,
  isFeatured: z.boolean().optional(),
  isTaxExempt: z.boolean().optional(),
  taxRate: z.number().min(0).max(100).optional().nullable(),
  defaultInventoryAccountId: optionalUuid,
  defaultSalesAccountId: optionalUuid,
  defaultCogsAccountId: optionalUuid,
});

export const updateItemCategorySchema = createItemCategorySchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const itemCategoryQuerySchema = z.object({
  page: z
    .union([z.string(), z.number()])
    .optional()
    .transform((val) => {
      const n = typeof val === 'number' ? val : val ? parseInt(val, 10) : 1;
      return Number.isFinite(n) && n > 0 ? n : 1;
    }),
  limit: z
    .union([z.string(), z.number()])
    .optional()
    .transform((val) => {
      const n = typeof val === 'number' ? val : val ? parseInt(val, 10) : 50;
      return Number.isFinite(n) && n > 0 ? n : 50;
    }),
  search: z.string().optional(),
  isActive: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((val) =>
      val === undefined ? undefined : val === true || val === 'true'
    ),
});

export type CreateItemCategoryInput = z.infer<typeof createItemCategorySchema>;
export type UpdateItemCategoryInput = z.infer<typeof updateItemCategorySchema>;
export type ItemCategoryQueryInput = z.infer<typeof itemCategoryQuerySchema>;
