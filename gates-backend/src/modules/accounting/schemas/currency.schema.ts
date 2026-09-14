import { z } from 'zod';

export const createCurrencySchema = z.object({
  serial: z.number().int().positive().optional().nullable(),
  code: z.string().min(1, 'Currency code is required'),
  symbol: z.string().max(16).optional().nullable(),
  arabicName: z.string().min(1, 'Arabic name is required'),
  englishName: z.string().optional(),
  exchangeRate: z.number().positive().optional().nullable(),
});

export const updateCurrencySchema = createCurrencySchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const currencyQuerySchema = z.object({
  page: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 1)),
  limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 50)),
  search: z.string().optional(),
  isActive: z
    .string()
    .optional()
    .transform((val) => (val === undefined ? undefined : val === 'true')),
});

export type CreateCurrencyInput = z.infer<typeof createCurrencySchema>;
export type UpdateCurrencyInput = z.infer<typeof updateCurrencySchema>;
export type CurrencyQueryInput = z.infer<typeof currencyQuerySchema>;
