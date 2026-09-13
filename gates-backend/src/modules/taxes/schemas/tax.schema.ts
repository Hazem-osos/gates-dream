import { z } from 'zod';

export const createTaxPeriodSchema = z.object({
  branchId: z.string().uuid().optional(),
  fiscalYearId: z.string().uuid(),
  periodNumber: z.number().int().positive(),
  periodName: z.string().optional(),
  periodType: z.enum(['MONTHLY', 'QUARTERLY']).optional(),
  sourceYearId: z.string().optional(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
});

export const taxAuthorityPaymentSchema = z.object({
  amount: z.number().positive(),
  safeId: z.string().uuid().optional(),
  bankAccountId: z.string().uuid().optional(),
  currencyCode: z.string().optional(),
});
