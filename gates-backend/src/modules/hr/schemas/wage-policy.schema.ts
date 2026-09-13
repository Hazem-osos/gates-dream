import { z } from 'zod';

export const createWagePolicySchema = z.object({
  code: z.string().optional(),
  arabicName: z.string().min(1, 'Arabic name is required'),
  englishName: z.string().optional(),
});

export const updateWagePolicySchema = createWagePolicySchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const wagePolicyQuerySchema = z.object({
  page: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 1)),
  limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 50)),
  search: z.string().optional(),
  isActive: z
    .string()
    .optional()
    .transform((val) => (val === undefined ? undefined : val === 'true')),
});

export type CreateWagePolicyInput = z.infer<typeof createWagePolicySchema>;
export type UpdateWagePolicyInput = z.infer<typeof updateWagePolicySchema>;
export type WagePolicyQueryInput = z.infer<typeof wagePolicyQuerySchema>;
