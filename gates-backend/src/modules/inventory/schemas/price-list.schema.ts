import { z } from 'zod';

export const createPriceListSchema = z.object({
  code: z.string().optional(),
  arabicName: z.string().min(1, 'Arabic name is required'),
  englishName: z.string().optional(),
  description: z.string().optional().nullable(),
  discountPercentage: z.number().nonnegative().optional().nullable(),
  currencyCode: z.string().optional().nullable(),
  priceMode: z.enum(['value', 'cost', 'last']).optional().nullable(),
});

export const updatePriceListSchema = createPriceListSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const priceListQuerySchema = z.object({
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

export const priceListPriceRowSchema = z.object({
  id: z.string().uuid().optional(),
  itemId: z.string().uuid(),
  unitId: z.string().uuid(),
  price: z.number().nonnegative().optional(),
  discount: z.number().nonnegative().nullable().optional(),
  purchasePrice: z.number().nonnegative().nullable().optional(),
  wholesale: z.number().nonnegative().nullable().optional(),
  semiWholesale: z.number().nonnegative().nullable().optional(),
  exportPrice: z.number().nonnegative().nullable().optional(),
  representativePrice: z.number().nonnegative().nullable().optional(),
  retailPrice: z.number().nonnegative().nullable().optional(),
  consumerPrice: z.number().nonnegative().nullable().optional(),
});

export const upsertPriceListPricesSchema = z.object({
  replace: z.boolean().optional(),
  prices: z.array(priceListPriceRowSchema),
});

export type CreatePriceListInput = z.infer<typeof createPriceListSchema>;
export type UpdatePriceListInput = z.infer<typeof updatePriceListSchema>;
export type PriceListQueryInput = z.infer<typeof priceListQuerySchema>;
export type UpsertPriceListPricesInput = z.infer<typeof upsertPriceListPricesSchema>;
