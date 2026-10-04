import { z } from 'zod';

const journalDate = z.union([
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  z.string().datetime(),
  z.date(),
]);

function meaningfulJournalLines(raw: unknown): unknown {
  if (!Array.isArray(raw)) return raw;
  return raw.filter((line) => {
    if (!line || typeof line !== 'object') return false;
    const row = line as { accountId?: unknown; debit?: unknown; credit?: unknown };
    return (
      Boolean(String(row.accountId ?? '').trim()) &&
      (Number(row.debit) > 0 || Number(row.credit) > 0)
    );
  });
}

export const journalEntryLineSchema = z
  .object({
    accountId: z.string().uuid('اختر حساباً صحيحاً في السطر'),
    costCenterId: z
      .union([z.string().uuid(), z.literal(''), z.null()])
      .optional()
      .transform((v) => (v ? v : undefined)),
    description: z.string().optional(),
    debit: z.coerce.number().nonnegative('المدين لا يكون سالباً'),
    credit: z.coerce.number().nonnegative('الدائن لا يكون سالباً'),
    lineOrder: z.coerce.number().int().positive('ترتيب السطر غير صحيح'),
    exchangeRate: z.coerce.number().positive().optional(),
    currencyId: z.string().optional().nullable(),
    currencyCode: z.string().optional().nullable(),
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
    { message: 'كل سطر يجب أن يكون مدين أو دائن فقط، وليس الاثنين معاً ولا فارغاً' }
  );

export const createJournalEntrySchema = z
  .object({
    voucherNumber: z.string().optional(),
    date: journalDate,
    hijriDate: z.string().optional(),
    description: z.string().optional(),
    currencyCode: z.string().min(1, 'عملة القيد مطلوبة'),
    isCyclic: z.boolean().optional(),
    isRecurring: z.boolean().optional(),
    entryType: z.string().max(30).optional(),
    sourceType: z.string().max(30).optional(),
    sourceId: z.string().max(80).optional(),
    sourceNumber: z.string().max(80).optional(),
    sourceKind: z.string().max(30).optional(),
    exchangeRate: z.number().positive().optional(),
    saveAsDraft: z.boolean().optional(),
    lines: z.preprocess(
      meaningfulJournalLines,
      z.array(journalEntryLineSchema).min(1, 'أدخل سطراً واحداً على الأقل')
    ),
  })
  .superRefine((data, ctx) => {
    const openingDraft =
      data.saveAsDraft === true && String(data.entryType ?? '').toUpperCase() === 'OPENING_BALANCE';
    if (!openingDraft && data.lines.length < 2) {
      ctx.addIssue({
        code: 'custom',
        path: ['lines'],
        message: 'القيد يحتاج سطرين على الأقل',
      });
    }
  });
  // Balance is enforced in journalPostingService so SaveUnbalanced can allow drafts.

export const updateJournalEntrySchema = z
  .object({
    voucherNumber: z.string().optional(),
    date: journalDate.optional(),
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
    saveAsDraft: z.boolean().optional(),
    lines: z.preprocess(
      (raw) => (raw === undefined ? undefined : meaningfulJournalLines(raw)),
      z.array(journalEntryLineSchema).min(1, 'أدخل سطراً واحداً على الأقل').optional()
    ),
    // M14 fix (Item 40): optional optimistic-locking token. When provided
    // (echoing the `version` a prior read returned), a concurrent edit that
    // changed the entry since the client last read it is rejected with 409
    // instead of silently overwritten.
    expectedVersion: z.number().int().nonnegative().optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.lines) return;
    const openingDraft =
      data.saveAsDraft === true && String(data.entryType ?? '').toUpperCase() === 'OPENING_BALANCE';
    if (!openingDraft && data.lines.length < 2) {
      ctx.addIssue({
        code: 'custom',
        path: ['lines'],
        message: 'القيد يحتاج سطرين على الأقل',
      });
    }
  });

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
  sortBy: z.enum(['voucherNumber', 'date', 'createdAt']).optional(),
  sortDir: z.enum(['asc', 'desc']).optional(),
});

export type CreateJournalEntryInput = z.infer<typeof createJournalEntrySchema>;
export type UpdateJournalEntryInput = z.infer<typeof updateJournalEntrySchema>;
export type JournalEntryQueryInput = z.infer<typeof journalEntryQuerySchema>;
export type JournalEntryLineInput = z.infer<typeof journalEntryLineSchema>;
