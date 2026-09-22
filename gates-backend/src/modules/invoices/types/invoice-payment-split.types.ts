import { z } from 'zod';

const amount = z.coerce.number().positive('مبلغ التحصيل يجب أن يكون أكبر من صفر');

export const paymentSplitLineSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('CASH'),
    safeId: z.string().uuid('حدد الخزينة في الفاتورة النقدية'),
    amount,
  }),
  z.object({
    type: z.literal('BANK'),
    bankAccountId: z.string().uuid('حدد الحساب البنكي'),
    referenceNumber: z.string().max(120).optional(),
    amount,
  }),
  z.object({
    type: z.literal('CHEQUE'),
    chequeNumber: z.string().min(1, 'رقم الشيك مطلوب').max(60),
    bankName: z.string().min(1).max(120),
    dueDate: z.coerce.date(),
    bankAccountId: z.string().uuid().optional(),
    amount,
  }),
  z.object({ type: z.literal('ON_ACCOUNT'), amount: z.coerce.number().nonnegative() }),
]);

export const invoicePaymentSplitsSchema = z.preprocess(
  (val) => (Array.isArray(val) && val.length === 0 ? undefined : val),
  z.array(paymentSplitLineSchema).min(1, 'حدد طريقة التحصيل').optional()
);

export type InvoicePaymentSplitLine = z.infer<typeof paymentSplitLineSchema>;

export const internalNoteEntrySchema = z.object({
  id: z.string().uuid(),
  body: z.string().max(8000),
  tags: z.array(z.string()).optional(),
  authorUserId: z.string().optional(),
  authorName: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string().optional(),
});

export const internalNotesSchema = z.array(internalNoteEntrySchema);

export type InternalNoteEntry = z.infer<typeof internalNoteEntrySchema>;

export function validatePaymentSplitsTotal(
  splits: InvoicePaymentSplitLine[],
  grandTotal: number,
  tolerance = 0.0001
): boolean {
  const sum = splits.reduce((s, line) => s + line.amount, 0);
  return Math.abs(sum - grandTotal) <= tolerance;
}

export function paymentSplitTenders(raw: unknown): InvoicePaymentSplitLine[] {
  const parsed = invoicePaymentSplitsSchema.safeParse(raw);
  if (!parsed.success || !parsed.data?.length) return [];
  return parsed.data.filter((line) => line.type !== 'ON_ACCOUNT');
}

export function paymentSplitTenderTotal(raw: unknown): number {
  return paymentSplitTenders(raw).reduce((sum, line) => sum + Number(line.amount || 0), 0);
}

/** Keep tender amounts as-is and refill the deferred remainder so a 10 EGP cash
 * down-payment on a larger invoice never gets stretched to the invoice net. */
export function withNormalizedOnAccount(
  splits: InvoicePaymentSplitLine[],
  grandTotal: number
): InvoicePaymentSplitLine[] {
  const tenders = splits.filter((line) => line.type !== 'ON_ACCOUNT');
  const tenderSum = tenders.reduce((sum, line) => sum + Number(line.amount || 0), 0);
  const remainder = Math.round(Math.max(0, grandTotal - tenderSum) * 10000) / 10000;
  return remainder > 0.0001 ? [...tenders, { type: 'ON_ACCOUNT', amount: remainder }] : tenders;
}
