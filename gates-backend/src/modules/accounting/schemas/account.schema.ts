import { z } from 'zod';

export const createAccountSchema = z.object({
  code: z.string().trim().optional().or(z.literal('')),
  arabicName: z.string().min(1, 'Arabic name is required'),
  englishName: z.string().optional(),
  accountType: z.string().optional(),
  parentId: z.string().uuid().optional().nullable(),
  accountSide: z.enum(['مدين', 'دائن']).optional().nullable(),
  accountNature: z.enum(['DEBIT', 'CREDIT']).optional(),
  statementType: z.enum(['BALANCE_SHEET', 'INCOME_STATEMENT']).optional(),
  costCenterRequired: z.enum(['إجباري', 'اختياري', 'بدون']).optional().nullable(),
  requiresCostCenter: z.boolean().optional(),
  defaultCostCenterId: z.string().uuid().optional().nullable(),
  warning: z.enum(['مدين', 'دائن', 'بدون']).optional().nullable(),
  budget: z.number().nonnegative().optional().nullable(),
  currencyCode: z.string().optional().nullable(),
});

export const updateAccountSchema = createAccountSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const accountQuerySchema = z.object({
  page: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 1)),
  limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 50)),
  search: z.string().optional(),
  accountType: z.string().optional(),
  parentId: z.string().uuid().optional().nullable(),
  isActive: z
    .string()
    .optional()
    .transform((val) => (val === undefined ? undefined : val === 'true')),
  leafOnly: z
    .string()
    .optional()
    .transform((val) => (val === undefined ? undefined : val === 'true')),
  statementType: z.enum(['BALANCE_SHEET', 'INCOME_STATEMENT']).optional(),
});

export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
export type AccountQueryInput = z.infer<typeof accountQuerySchema>;
