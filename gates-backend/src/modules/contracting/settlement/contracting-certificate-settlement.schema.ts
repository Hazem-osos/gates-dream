import { z } from 'zod';

export const contractingCertificateCollectionSchema = z
  .object({
    idempotencyKey: z.string().trim().min(8).max(128),
    amount: z.number().positive(),
    date: z.coerce.date().optional(),
    voucherNumber: z.string().max(50).optional(),
    description: z.string().optional(),
    safeId: z.string().uuid().optional(),
    bankAccountId: z.string().uuid().optional(),
    exchangeRate: z.number().positive().optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.safeId && !data.bankAccountId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'حدد الخزينة أو حساب البنك',
        path: ['safeId'],
      });
    }
  });

export const allocateExistingCashToCertificateSchema = z.object({
  idempotencyKey: z.string().trim().min(8).max(128),
  cashTransactionId: z.string().uuid(),
  amount: z.number().positive(),
  allocatedAt: z.coerce.date().optional(),
});

export type ContractingCertificateCollectionInput = z.infer<
  typeof contractingCertificateCollectionSchema
>;
export type AllocateExistingCashToCertificateInput = z.infer<
  typeof allocateExistingCashToCertificateSchema
>;
