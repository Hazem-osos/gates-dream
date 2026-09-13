import { z } from 'zod';

const amount = z.number().positive();

export const paymentSplitLineSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('CASH'), safeId: z.string().uuid(), amount }),
  z.object({
    type: z.literal('BANK'),
    bankAccountId: z.string().uuid(),
    referenceNumber: z.string().max(120).optional(),
    amount,
  }),
  z.object({
    type: z.literal('CHEQUE'),
    chequeNumber: z.string().min(1).max(60),
    bankName: z.string().min(1).max(120),
    dueDate: z.coerce.date(),
    bankAccountId: z.string().uuid().optional(),
    amount,
  }),
  z.object({ type: z.literal('ON_ACCOUNT'), amount: z.number().nonnegative() }),
]);

export const invoicePaymentSplitsSchema = z.array(paymentSplitLineSchema).min(1);

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
