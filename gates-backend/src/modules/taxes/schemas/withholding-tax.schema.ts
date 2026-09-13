import { z } from 'zod';

export const withholdingTaxPaymentSchema = z.object({
  serial: z.string().optional(),
  description: z.string().optional(),
  gregorianDate: z.coerce.date().optional(),
  hijriDate: z.string().optional(),
  selectedPeriod: z.string().optional(), // e.g., "الفترة الأولى", "الفترة الثانية"
  due: z.number().nonnegative().optional().nullable(),
  paid: z.number().nonnegative().optional().nullable(),
  dueBalance: z.number().nonnegative().optional().nullable(),
  supplierId: z.string().uuid('Invalid supplier ID'),
  invoiceId: z.string().uuid('Invalid invoice ID').optional(),
  paymentDate: z.coerce.date().optional(),
  /** Amount withheld / paid to tax authority */
  taxAmount: z.number().positive('Tax amount must be positive').optional(),
  /** WHT payable/liability account being cleared (debited). Required (H13). */
  accountId: z.string().uuid('Invalid account ID'),
  /** Cash source paying the tax authority — one of these is required (H13). */
  safeId: z.string().uuid('Invalid safe ID').optional(),
  bankAccountId: z.string().uuid('Invalid bank account ID').optional(),
  currencyCode: z.string().optional(),
  notes: z.string().optional(),
}).superRefine((data, ctx) => {
  if (!data.safeId && !data.bankAccountId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'safeId or bankAccountId is required',
      path: ['safeId'],
    });
  }
});

export type WithholdingTaxPaymentInput = z.infer<
  typeof withholdingTaxPaymentSchema
>;

