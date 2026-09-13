import { z } from 'zod';

export const createBankAccountSchema = z.object({
  bankId: z.string().uuid('Invalid bank ID'),
  code: z.string().optional(),
  arabicName: z.string().min(1, 'Arabic name is required'),
  englishName: z.string().optional(),
  accountNumber: z.string().optional(),
  iban: z.string().optional(),
  currencyCode: z.string().min(1, 'Currency code is required'),
});

export const updateBankAccountSchema = createBankAccountSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const bankAccountQuerySchema = z.object({
  page: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 1)),
  limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 50)),
  search: z.string().optional(),
  bankId: z.string().uuid().optional(),
  isActive: z
    .string()
    .optional()
    .transform((val) => (val === undefined ? undefined : val === 'true')),
});

export type CreateBankAccountInput = z.infer<typeof createBankAccountSchema>;
export type UpdateBankAccountInput = z.infer<typeof updateBankAccountSchema>;
export type BankAccountQueryInput = z.infer<typeof bankAccountQuerySchema>;

