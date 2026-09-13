import { z } from 'zod';

export const createLetterOfGuaranteeSettingsSchema = z.object({
  guaranteeAccountId: z.string().uuid().optional().nullable(),
  expenseAccountId: z.string().uuid().optional().nullable(),
  defaultCurrencyId: z.string().uuid().optional().nullable(),
  defaultBidPercentage: z.number().min(0).max(100).optional().nullable(),
  autoRenewalEnabled: z.boolean().default(false),
  renewalWarningDays: z.number().int().positive().optional().nullable(),
  includeBankExpenses: z.boolean().default(false),
});

export const updateLetterOfGuaranteeSettingsSchema = createLetterOfGuaranteeSettingsSchema.partial();

