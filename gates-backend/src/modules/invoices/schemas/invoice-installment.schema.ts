import { z } from 'zod';

export const invoiceInstallmentInputSchema = z.object({
  installmentNumber: z.number().int().positive().optional(),
  dueDate: z.coerce.date(),
  hijriDueDate: z.string().max(80).optional().nullable(),
  amount: z.number().positive(),
  notes: z.string().max(2000).optional().nullable(),
});

export const invoiceInstallmentsArraySchema = z.array(invoiceInstallmentInputSchema);

export const invoiceInstallmentTrackerQuerySchema = z.object({
  invoiceId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  status: z.enum(['PENDING', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'UNPAID']).optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  invoiceKind: z.enum(['PURCHASE', 'SALE', 'PURCHASE_RETURN', 'SALE_RETURN']).optional(),
});

export const collectInvoiceInstallmentSchema = z
  .object({
    amount: z.number().positive().optional(),
    date: z.coerce.date().optional(),
    voucherNumber: z.string().max(50).optional(),
    description: z.string().optional(),
    safeId: z.string().uuid().optional(),
    bankAccountId: z.string().uuid().optional(),
    offsetAccountId: z.string().uuid().optional(),
    exchangeRate: z.number().positive().optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.safeId && !data.bankAccountId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'تحصيل القسط يتطلب خزينة أو حساباً بنكياً',
        path: ['safeId'],
      });
    }
  });

export type InvoiceInstallmentInput = z.infer<typeof invoiceInstallmentInputSchema>;
export type CollectInvoiceInstallmentInput = z.infer<typeof collectInvoiceInstallmentSchema>;
export type InvoiceInstallmentTrackerQuery = z.infer<typeof invoiceInstallmentTrackerQuerySchema>;
