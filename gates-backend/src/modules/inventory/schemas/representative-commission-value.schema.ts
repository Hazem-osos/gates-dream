import { z } from 'zod';

export const commissionValueTierSchema = z.object({
  days: z.number().int().nonnegative().optional().nullable(),
  commissionPct: z.number().nonnegative().optional().nullable(),
});

export const createCommissionValueSchema = z.object({
  serial: z.string().optional().nullable(),
  name: z.string().min(1, 'Name is required'),
  target: z.number().nonnegative().optional().nullable(),
  targetPercentage: z.number().nonnegative().optional().nullable(),
  tiers: z.array(commissionValueTierSchema).optional().default([]),
});

export const updateCommissionValueSchema = createCommissionValueSchema.partial();

export const commissionValueQuerySchema = z.object({
  page: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 1)),
  limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 50)),
  search: z.string().optional(),
});

export type CreateCommissionValueInput = z.infer<typeof createCommissionValueSchema>;
export type UpdateCommissionValueInput = z.infer<typeof updateCommissionValueSchema>;
