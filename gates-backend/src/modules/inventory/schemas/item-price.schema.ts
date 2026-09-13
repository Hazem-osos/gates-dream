import { z } from 'zod';

const optionalMoney = z.number().nonnegative().nullable().optional();

const priceTierFields = {
  discount: optionalMoney,
  wholesale: optionalMoney,
  semiWholesale: optionalMoney,
  exportPrice: optionalMoney,
  representativePrice: optionalMoney,
  retailPrice: optionalMoney,
  consumerPrice: optionalMoney,
};

export const createItemPriceSchema = z.object({
  itemId: z.string().uuid('Item ID must be a valid UUID'),
  priceListId: z.string().uuid('Price list ID must be a valid UUID'),
  unitId: z.string().uuid('Unit ID must be a valid UUID'),
  price: z.number().nonnegative('Price must be non-negative'),
  ...priceTierFields,
});

export const updateItemPriceSchema = z.object({
  price: z.number().nonnegative('Price must be non-negative').optional(),
  ...priceTierFields,
});

export const itemPriceQuerySchema = z.object({
  page: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 1)),
  limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 50)),
  search: z.string().optional(),
  itemId: z.string().uuid().optional(),
  priceListId: z.string().uuid().optional(),
  unitId: z.string().uuid().optional(),
});

export type CreateItemPriceInput = z.infer<typeof createItemPriceSchema>;
export type UpdateItemPriceInput = z.infer<typeof updateItemPriceSchema>;
export type ItemPriceQueryInput = z.infer<typeof itemPriceQuerySchema>;
