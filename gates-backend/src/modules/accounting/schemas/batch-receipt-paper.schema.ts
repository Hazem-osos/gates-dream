import { z } from 'zod';

const dateLike = z.union([z.string().min(1), z.date()]);

export const batchReceiptPaperItemSchema = z.object({
  paperNumber: z.string().trim().min(1, 'رقم الورقة مطلوب'),
  amount: z.coerce.number().positive('المبلغ يجب أن يكون أكبر من صفر'),
  dueDate: dateLike,
  hijriDueDate: z.string().optional(),
  bankName: z.string().optional(),
  branchName: z.string().optional(),
  description: z.string().optional(),
});

export const createBatchReceiptPapersSchema = z.object({
  issueDate: dateLike,
  hijriIssueDate: z.string().optional(),
  partyId: z.string().uuid('اختر الساحب / العميل'),
  entityName: z.string().max(191).optional().nullable(),
  entityId: z.string().uuid().optional().nullable(),
  partyName: z.string().optional().nullable(),
  currencyCode: z.string().optional(),
  partyType: z.enum(['customer', 'supplier']).optional(),
  papers: z.array(batchReceiptPaperItemSchema).min(1, 'أضف ورقة واحدة على الأقل'),
});

export type CreateBatchReceiptPapersInput = z.infer<typeof createBatchReceiptPapersSchema>;
