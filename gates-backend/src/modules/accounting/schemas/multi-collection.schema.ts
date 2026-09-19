import { z } from 'zod';

export const executeMultiCollectionSchema = z.object({
  collectionDate: z.union([z.string(), z.date()]).transform((val) =>
    val instanceof Date ? val : new Date(val)
  ),
  hijriDate: z.string().optional(),
  accountId: z.string().uuid('الحساب مطلوب'),
  amount: z.number().positive('القيمة يجب أن تكون أكبر من صفر'),
  notes: z.string().optional(),
});

export type ExecuteMultiCollectionInput = z.infer<typeof executeMultiCollectionSchema>;
