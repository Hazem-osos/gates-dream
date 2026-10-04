import { z } from 'zod';
import { paperDueBeforeIssue } from '../utils/paper-due-date';

const dateLike = z.union([z.string().min(1), z.date()]);

export const batchReceiptPaperItemSchema = z.object({
  paperNumber: z.string().trim().min(1, 'رقم الورقة مطلوب'),
  amount: z.coerce.number().positive('المبلغ يجب أن يكون أكبر من صفر'),
  dueDate: dateLike,
  hijriDueDate: z.string().optional(),
  bankName: z.string().optional(),
  branchName: z.string().optional(),
  description: z.string().optional(),
  accountId: z.string().uuid('اختر حساب الورقة').optional(),
});

export const createBatchReceiptPapersSchema = z.object({
  issueDate: dateLike,
  hijriIssueDate: z.string().optional(),
  partyId: z.string().uuid('اختر الساحب / العميل'),
  entityName: z.string().max(191).optional().nullable(),
  entityId: z.string().uuid().optional().nullable(),
  partyName: z.string().optional().nullable(),
  currencyCode: z.string().optional(),
  partyType: z.enum(['customer', 'supplier', 'account']).optional(),
  opening: z.boolean().optional(),
  papers: z.array(batchReceiptPaperItemSchema).min(1, 'أضف ورقة واحدة على الأقل'),
}).superRefine((data, ctx) => {
  if (data.opening) {
    data.papers.forEach((paper, index) => {
      if (paper.accountId) return;
      ctx.addIssue({
        code: 'custom',
        message: `اختر الحساب للورقة ${paper.paperNumber}`,
        path: ['papers', index, 'accountId'],
      });
    });
  }
  data.papers.forEach((paper, index) => {
    if (!paperDueBeforeIssue(data.issueDate, paper.dueDate)) return;
    ctx.addIssue({
      code: 'custom',
      message: `تاريخ استحقاق الورقة ${paper.paperNumber} لا يمكن أن يكون قبل تاريخ التحرير`,
      path: ['papers', index, 'dueDate'],
    });
  });
});

export type CreateBatchReceiptPapersInput = z.infer<typeof createBatchReceiptPapersSchema>;
