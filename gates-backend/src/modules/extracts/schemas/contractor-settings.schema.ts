import { z } from 'zod';

export const contractorSettingsSchema = z.object({
  advancePaymentPercentage: z.coerce.number().min(0).max(100).optional().nullable(),
  workInsurancePercentage: z.coerce.number().min(0).max(100).optional().nullable(),
  taxDeductionPercentage: z.coerce.number().min(0).max(100).optional().nullable(),
  otherSettings: z.record(z.any()).optional().nullable(),
});

export const updateContractorSettingsSchema = contractorSettingsSchema.partial();

