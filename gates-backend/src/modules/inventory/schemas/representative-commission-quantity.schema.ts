import { z } from 'zod';

const optionalNumber = z.number().nonnegative().optional().nullable();

export const commissionQuantityLineSchema = z.object({
  id: z.string().uuid().optional(),
  itemId: z.string().uuid().optional().nullable(),
  itemName: z.string().optional().nullable(),
  policyName: z.string().optional().nullable(),
  days: z.number().int().nonnegative().optional().nullable(),
  commissionBefore: optionalNumber,
  commissionAfter: optionalNumber,
  cashRate: optionalNumber,
  creditRate: optionalNumber,
  percent: optionalNumber,
  target: optionalNumber,
});

export const replaceCommissionQuantitiesSchema = z.object({
  lines: z.array(commissionQuantityLineSchema).default([]),
});

export const commissionQuantityQuerySchema = z.object({
  page: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 1)),
  limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 100)),
  search: z.string().optional(),
});

export type CommissionQuantityLineInput = z.infer<typeof commissionQuantityLineSchema>;
export type ReplaceCommissionQuantitiesInput = z.infer<typeof replaceCommissionQuantitiesSchema>;
