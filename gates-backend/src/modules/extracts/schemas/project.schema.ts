import { z } from 'zod';

export const createProjectSchema = z.object({
  serial: z.string().optional(),
  arabicName: z.string().min(1, 'Arabic name is required'),
  englishName: z.string().optional(),
  totalValue: z.number().nonnegative().optional().nullable(),
  advancePaymentPercentage: z.number().nonnegative().max(100).optional().nullable(),
  advancePaymentValue: z.number().nonnegative().optional().nullable(),
  latePenaltyPercentage: z.number().nonnegative().max(100).optional().nullable(),
  latePenaltyPerDays: z.string().optional().default('يوم'),
  businessAffairsPercentage: z.number().nonnegative().max(100).optional().nullable(),
  facilitiesDeductionPercentage: z.number().nonnegative().max(100).optional().nullable(),
  facilitiesDeductionMax: z.number().nonnegative().optional().nullable(),
  otherAdditions: z.array(z.object({
    name: z.string(),
    value: z.number().nonnegative(),
  })).optional().nullable(),
  otherDeductions: z.array(z.object({
    name: z.string(),
    value: z.number().nonnegative(),
  })).optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const updateProjectSchema = createProjectSchema.partial();

export const projectQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(1000).optional(),
  search: z.string().optional(),
  isActive: z.coerce.boolean().optional(),
});

