import { z } from 'zod';

const optionalNumber = z.number().nonnegative().optional().nullable();

export const commissionPolicyTierSchema = z.object({
  targetSlice: z.string().optional().nullable(),
  targetPct: optionalNumber,
  commissionPct: optionalNumber,
  bonusPct: optionalNumber,
  increasePct: optionalNumber,
});

export const createCommissionPolicySchema = z.object({
  code: z.string().optional().nullable(),
  arabicName: z.string().min(1, 'Arabic name is required'),
  englishName: z.string().optional().nullable(),
  tiers: z.array(commissionPolicyTierSchema).optional().default([]),
});

export const updateCommissionPolicySchema = createCommissionPolicySchema.partial();

export const commissionPolicyQuerySchema = z.object({
  page: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 1)),
  limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 50)),
  search: z.string().optional(),
});

export type CreateCommissionPolicyInput = z.infer<typeof createCommissionPolicySchema>;
export type UpdateCommissionPolicyInput = z.infer<typeof updateCommissionPolicySchema>;
