import { z } from 'zod';

export const multiCollectionLineSchema = z.object({
  accountId: z.string().uuid('الحساب مطلوب لكل سطر'),
  amount: z.number().positive('مبلغ السطر يجب أن يكون أكبر من صفر'),
  description: z.string().optional().nullable(),
});

export const executeMultiCollectionSchema = z
  .object({
    collectionDate: z.union([z.string(), z.date()]).transform((val) =>
      val instanceof Date ? val : new Date(val)
    ),
    hijriDate: z.string().optional(),
    commissionAmount: z.number().nonnegative().optional().nullable(),
    commissionAccountId: z
      .union([z.string().uuid(), z.literal(''), z.null()])
      .optional()
      .transform((v) => (v ? v : null)),
    destinationAccountId: z.string().uuid('حساب الإيداع / الخزنة مطلوب'),
    lines: z.array(multiCollectionLineSchema).min(1, 'أضف سطر تحصيل واحداً على الأقل'),
    notes: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    const commission = Number(data.commissionAmount) || 0;
    if (commission > 0 && !data.commissionAccountId) {
      ctx.addIssue({
        code: 'custom',
        message: 'اختر حساب العمولة عند إدخال قيمة عمولة',
        path: ['commissionAccountId'],
      });
    }
  });

export type ExecuteMultiCollectionInput = z.infer<typeof executeMultiCollectionSchema>;
