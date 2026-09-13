import { z } from 'zod';

export const recurringFrequencySchema = z.enum(['WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY']);

export const recurringJournalLineInputSchema = z
  .object({
    accountId: z.string().uuid('Account ID must be a valid UUID'),
    costCenterId: z.string().uuid().optional().nullable(),
    description: z.string().max(500).optional().nullable(),
    debit: z.number().nonnegative().default(0),
    credit: z.number().nonnegative().default(0),
  })
  .refine((line) => (line.debit > 0) !== (line.credit > 0), {
    message: 'Each recurring line must have either debit or credit',
  });

export const createRecurringEntrySchema = z.object({
  templateNameAr: z.string().min(1, 'اسم القيد الدوري مطلوب').max(191),
  frequency: recurringFrequencySchema.optional(),
  notes: z.string().max(2000).optional().nullable(),
  lines: z.array(recurringJournalLineInputSchema).min(2, 'القيد الدوري يحتاج سطرين على الأقل'),
});

export const recurringEntryQuerySchema = z.object({
  search: z.string().optional(),
  includeInactive: z
    .union([z.string(), z.boolean()])
    .optional()
    .transform((val) => val === true || val === 'true'),
});

export type CreateRecurringEntryInput = z.infer<typeof createRecurringEntrySchema>;
