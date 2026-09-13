import { z } from 'zod';
import { amountsEqualAt4 } from '../../../shared/utils/decimal-round';
import { sumBaseLines, validateJournalLineSides } from '../../../shared/utils/money.util';

export const journalEntryLineSchema = z
  .object({
    accountId: z.string().uuid('Account ID must be a valid UUID'),
    costCenterId: z.string().uuid().optional().nullable(),
    description: z.string().optional(),
    debit: z.number().nonnegative('Debit must be non-negative'),
    credit: z.number().nonnegative('Credit must be non-negative'),
    lineOrder: z.number().int().positive('Line order must be a positive integer'),
    exchangeRate: z.number().positive().optional(),
    currencyId: z.string().optional().nullable(),
    debitBase: z.number().nonnegative().optional(),
    creditBase: z.number().nonnegative().optional(),
    partnerId: z
      .union([z.string().uuid(), z.literal(''), z.null()])
      .optional()
      .transform((v) => (v ? v : undefined)),
    partnerType: z.enum(['CUSTOMER', 'SUPPLIER']).optional(),
    isTiedToInvoice: z.boolean().optional(),
    invoiceId: z
      .union([z.string().uuid(), z.literal(''), z.null()])
      .optional()
      .transform((v) => (v ? v : null)),
    invoiceNumber: z.string().max(80).optional().nullable(),
  })
  .refine(
    (line) => {
      const hasDebit = line.debit > 0;
      const hasCredit = line.credit > 0;
      return hasDebit !== hasCredit;
    },
    { message: 'Each line must have either debit or credit (not both, not neither)' }
  );

function baseTotals(lines: z.infer<typeof journalEntryLineSchema>[], headerRate: number) {
  return sumBaseLines(
    lines.map((line) => ({
      debit: line.debit,
      credit: line.credit,
      exchangeRate: line.exchangeRate ?? headerRate,
    }))
  );
}

export const createJournalEntrySchema = z
  .object({
    voucherNumber: z.string().optional(),
    date: z.string().datetime().or(z.date()),
    hijriDate: z.string().optional(),
    description: z.string().optional(),
    currencyCode: z.string().min(1, 'Currency code is required'),
    isCyclic: z.boolean().optional(),
    isRecurring: z.boolean().optional(),
    entryType: z.string().max(30).optional(),
    sourceType: z.string().max(30).optional(),
    sourceId: z.string().max(80).optional(),
    sourceNumber: z.string().max(80).optional(),
    sourceKind: z.string().max(30).optional(),
    exchangeRate: z.number().positive().optional(),
    lines: z
      .array(journalEntryLineSchema)
      .min(2, 'Journal entry must have at least 2 line items'),
  })
  .refine(
    (data) => {
      const { debitBase, creditBase } = baseTotals(data.lines, data.exchangeRate ?? 1);
      return amountsEqualAt4(debitBase, creditBase);
    },
    {
      message: 'Debit base total must equal credit base total (4 decimal places)',
      path: ['lines'],
    }
  );

export const updateJournalEntrySchema = z
  .object({
    voucherNumber: z.string().optional(),
    date: z.string().datetime().or(z.date()).optional(),
    hijriDate: z.string().optional(),
    description: z.string().optional(),
    currencyCode: z.string().optional(),
    isCyclic: z.boolean().optional(),
    isRecurring: z.boolean().optional(),
    entryType: z.string().max(30).optional(),
    sourceType: z.string().max(30).optional(),
    sourceId: z.string().max(80).optional(),
    sourceNumber: z.string().max(80).optional(),
    sourceKind: z.string().max(30).optional(),
    exchangeRate: z.number().positive().optional(),
    lines: z
      .array(journalEntryLineSchema)
      .min(2, 'Journal entry must have at least 2 line items')
      .optional(),
    // M14 fix (Item 40): optional optimistic-locking token. When provided
    // (echoing the `version` a prior read returned), a concurrent edit that
    // changed the entry since the client last read it is rejected with 409
    // instead of silently overwritten.
    expectedVersion: z.number().int().nonnegative().optional(),
  })
  .refine(
    (data) => {
      if (!data.lines) return true;
      const { debitBase, creditBase } = baseTotals(
        data.lines,
        data.exchangeRate ?? 1
      );
      return amountsEqualAt4(debitBase, creditBase);
    },
    {
      message: 'Debit base total must equal credit base total (4 decimal places)',
      path: ['lines'],
    }
  );

/** Hub/list filters send `YYYY-MM-DD`; keep full ISO datetime accepted too. */
const optionalQueryDate = z
  .union([
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    z.string().datetime(),
    z.date(),
  ])
  .optional();

const optionalQueryBool = z
  .union([z.string(), z.boolean()])
  .optional()
  .transform((val) => {
    if (val === undefined) return undefined;
    return val === true || val === 'true';
  });

export const journalEntryQuerySchema = z.object({
  page: z
    .union([z.string(), z.number()])
    .optional()
    .transform((val) => {
      const n = val === undefined || val === '' ? 1 : Number(val);
      return Number.isFinite(n) ? n : 1;
    }),
  cursor: z.string().min(1).optional(),
  direction: z.enum(['forward', 'backward']).optional(),
  limit: z
    .union([z.string(), z.number()])
    .optional()
    .transform((val) => {
      const n = val === undefined || val === '' ? 50 : Number(val);
      return Math.min(Math.max(Number.isFinite(n) ? n : 50, 1), 200);
    }),
  search: z.string().optional(),
  startDate: optionalQueryDate,
  endDate: optionalQueryDate,
  isPosted: optionalQueryBool,
  isApproved: optionalQueryBool,
  isCancelled: optionalQueryBool,
  includeLines: optionalQueryBool,
  entryType: z.string().max(30).optional(),
});

export type CreateJournalEntryInput = z.infer<typeof createJournalEntrySchema>;
export type UpdateJournalEntryInput = z.infer<typeof updateJournalEntrySchema>;
export type JournalEntryQueryInput = z.infer<typeof journalEntryQuerySchema>;
export type JournalEntryLineInput = z.infer<typeof journalEntryLineSchema>;
