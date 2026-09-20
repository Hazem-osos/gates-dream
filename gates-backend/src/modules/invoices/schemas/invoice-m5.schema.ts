import { z } from 'zod';
import { invoiceLineSchema } from '../../inventory/schemas/invoice.schema';
import { invoicePaymentSplitsSchema } from '../types/invoice-payment-split.types';
import { invoiceInstallmentsArraySchema } from './invoice-installment.schema';
import { sourceDocumentTypeSchema } from './invoice-source.schema';

export const invoiceAdjustmentLineSchema = z
  .object({
    type: z.enum(['ADDITION', 'DEDUCTION']),
    calcType: z.enum(['FIXED', 'PERCENTAGE']).default('FIXED'),
    rate: z.number().min(0).max(100).optional().nullable(),
    amount: z.number().nonnegative(),
    description: z.string().max(191).optional().nullable(),
    currency: z.string().trim().min(1).max(10).optional().default('EGP'),
    exchangeRate: z.number().positive().optional().nullable(),
    accountId: z.string().uuid(),
    offsetAccountId: z.string().uuid().optional().nullable(),
    costCenterId: z.string().uuid().optional().nullable(),
  })
  .superRefine((row, ctx) => {
    if (row.calcType === 'PERCENTAGE' && (row.rate == null || Number(row.rate) <= 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'حدد نسبة الإضافة أو الخصم',
        path: ['rate'],
      });
    }
    if (row.calcType === 'FIXED' && !(Number(row.amount) > 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'حدد قيمة الإضافة أو الخصم',
        path: ['amount'],
      });
    }
  });

export const invoiceKindSchema = z.enum([
  'PURCHASE',
  'SALE',
  'PURCHASE_RETURN',
  'SALE_RETURN',
]);

export const createM5InvoiceSchema = z
  .object({
    invoiceNumber: z.string().optional(),
    invoiceKind: invoiceKindSchema,
    /** NewModule row id — resolved to the 4-char suffix (SI02, PI01, …). */
    newModuleId: z.string().uuid().optional().nullable(),
    /** Direct 4-char NewModule fullCode when the caller already has it. */
    moduleCode: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{2}\d{2}$/, 'moduleCode must be a 4-char NewModule code (e.g. SI02)')
      .optional(),
    date: z.coerce.date(),
    /** H6 fix: explicit due date; falls back to customer/supplier payment terms, then `date`. */
    dueDate: z.coerce.date().optional().nullable(),
    hijriDate: z.string().optional(),
    description: z.string().optional(),
    currencyCode: z.string().min(1),
    exchangeRate: z.number().positive().optional().default(1),
    sourceYearId: z.string().optional(),
    customerId: z.string().uuid().optional().nullable(),
    supplierId: z.string().uuid().optional().nullable(),
    warehouseId: z.string().uuid(),
    documentProfileId: z.string().uuid().optional().nullable(),
    costCenterId: z.string().uuid().optional().nullable(),
    representativeId: z.string().uuid().optional().nullable(),
    driverId: z.string().uuid().optional().nullable(),
    distributorId: z.string().uuid().optional().nullable(),
    /** Sales Invoice Enterprise Redesign: distinct "Salesman" from the sales
     * representative above — existing `Invoice.sellerId` column, previously
     * validated only by the legacy invoice/POS schemas and never wired
     * through this (M5) path that the sales-invoice screen actually uses. */
    sellerId: z.string().uuid().optional().nullable(),
    paymentMethod: z.string().optional(),
    paymentSplits: invoicePaymentSplitsSchema.optional(),
    internalNotes: z.array(z.record(z.unknown())).optional(),
    isSalesTaxInvoice: z.boolean().optional(),
    /** Richer companion to isSalesTaxInvoice — the UI derives the boolean
     * from this so existing tax-calculation math is untouched. */
    taxTreatmentType: z.enum(['taxable', 'exempt', 'export']).optional().nullable(),
    allowReturn: z.boolean().optional(),
    returnDays: z.number().int().positive().optional().nullable(),
    isDelivered: z.boolean().optional(),
    handoverDate: z.coerce.date().optional().nullable(),
    invoiceConditions: z.array(z.string().min(1)).optional(),
    withholdingTaxAmount: z.number().nonnegative().optional().default(0),
    /** M7 fix: whole-invoice discount on top of line discounts. */
    headerDiscountPercent: z.number().min(0).max(100).optional().nullable(),
    /** Optional cross-check against `headerDiscountPercent`-derived amount. */
    headerDiscountAmount: z.number().nonnegative().optional().nullable(),
    /** رسم تنمية: نسبة على الصافي قبل الضريبة (السيرفر يعيد الحساب). */
    developmentFeeRate: z.number().min(0).max(100).optional().nullable(),
    /** مبلغ ثابت أو معاينة العميل — يُرفض إن خالف النسبة. */
    developmentFeeAmount: z.number().nonnegative().optional().nullable(),
    installments: invoiceInstallmentsArraySchema.optional(),
    pricingCalculationBasis: z.enum(['SELECTED_UNIT_QTY', 'BASE_UNIT_QTY']).optional(),
    sourceType: sourceDocumentTypeSchema.optional(),
    sourceId: z.string().uuid().optional().nullable(),
    sourceNumber: z.string().trim().max(80).optional().nullable(),
    originalInvoiceId: z.string().uuid().optional().nullable(),
    originalInvoiceNumber: z.string().trim().max(50).optional().nullable(),
    adjustments: z.array(invoiceAdjustmentLineSchema).optional(),
    lines: z.array(invoiceLineSchema).min(1),
  })
  .superRefine((data, ctx) => {
    if (
      (data.invoiceKind === 'SALE' || data.invoiceKind === 'SALE_RETURN') &&
      !data.customerId
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Customer is required for sale documents',
        path: ['customerId'],
      });
    }
    if (
      (data.invoiceKind === 'PURCHASE' || data.invoiceKind === 'PURCHASE_RETURN') &&
      !data.supplierId
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Supplier is required for purchase documents',
        path: ['supplierId'],
      });
    }
  });

/** Same shape as create, minus the kind (an invoice never changes kind after creation). */
export const updateM5InvoiceSchema = z.object({
  invoiceNumber: z.string().optional(),
  date: z.coerce.date().optional(),
  dueDate: z.coerce.date().optional().nullable(),
  hijriDate: z.string().optional(),
  description: z.string().optional(),
  currencyCode: z.string().min(1).optional(),
  exchangeRate: z.number().positive().optional(),
  sourceYearId: z.string().optional(),
  customerId: z.string().uuid().optional().nullable(),
  supplierId: z.string().uuid().optional().nullable(),
  warehouseId: z.string().uuid().optional(),
  documentProfileId: z.string().uuid().optional().nullable(),
  costCenterId: z.string().uuid().optional().nullable(),
  representativeId: z.string().uuid().optional().nullable(),
  driverId: z.string().uuid().optional().nullable(),
  distributorId: z.string().uuid().optional().nullable(),
  sellerId: z.string().uuid().optional().nullable(),
  paymentMethod: z.string().optional(),
  paymentSplits: invoicePaymentSplitsSchema.optional(),
  internalNotes: z.array(z.record(z.unknown())).optional(),
  isSalesTaxInvoice: z.boolean().optional(),
  taxTreatmentType: z.enum(['taxable', 'exempt', 'export']).optional().nullable(),
  allowReturn: z.boolean().optional(),
  returnDays: z.number().int().positive().optional().nullable(),
  isDelivered: z.boolean().optional(),
  handoverDate: z.coerce.date().optional().nullable(),
  printTermsOnInvoice: z.boolean().optional(),
  invoiceConditions: z.array(z.string().min(1)).optional(),
  withholdingTaxAmount: z.number().nonnegative().optional(),
  headerDiscountPercent: z.number().min(0).max(100).optional().nullable(),
  headerDiscountAmount: z.number().nonnegative().optional().nullable(),
  developmentFeeRate: z.number().min(0).max(100).optional().nullable(),
  developmentFeeAmount: z.number().nonnegative().optional().nullable(),
  installments: invoiceInstallmentsArraySchema.optional(),
  pricingCalculationBasis: z.enum(['SELECTED_UNIT_QTY', 'BASE_UNIT_QTY']).optional(),
  sourceType: sourceDocumentTypeSchema.optional(),
  sourceId: z.string().uuid().optional().nullable(),
  sourceNumber: z.string().trim().max(80).optional().nullable(),
  originalInvoiceId: z.string().uuid().optional().nullable(),
  originalInvoiceNumber: z.string().trim().max(50).optional().nullable(),
  adjustments: z.array(invoiceAdjustmentLineSchema).optional(),
  lines: z.array(invoiceLineSchema).min(1).optional(),
  // Module 2: HTTP updates require the version the form loaded.
  expectedVersion: z.number().int().nonnegative(),
});

/** Service-level patch — `expectedVersion` optional so internal callers / tests can omit it. */
export const updateM5InvoiceServiceSchema = updateM5InvoiceSchema.extend({
  expectedVersion: z.number().int().nonnegative().optional(),
});

export const settleM5InvoiceSchema = z
  .object({
    amount: z.number().positive(),
    date: z.coerce.date().optional(),
    voucherNumber: z.string().max(50).optional(),
    description: z.string().optional(),
    safeId: z.string().uuid().optional(),
    bankAccountId: z.string().uuid().optional(),
    offsetAccountId: z.string().uuid().optional(),
    /** Wave 2 fix: the FX rate in effect at settlement date for a foreign-currency
     * invoice. When it differs from the invoice's own booked rate, the difference
     * is posted as a realized FX gain/loss instead of silently defaulting to 1. */
    exchangeRate: z.number().positive().optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.safeId && !data.bankAccountId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Settlement requires safeId or bankAccountId',
        path: ['safeId'],
      });
    }
  });

export const m5InvoiceQuerySchema = z.object({
  page: z.string().optional().transform((v) => (v ? parseInt(v, 10) : 1)),
  cursor: z.string().min(1).optional(),
  direction: z.enum(['forward', 'backward']).optional(),
  limit: z
    .string()
    .optional()
    .transform((v) => {
      const n = v ? parseInt(v, 10) : 50;
      return Math.min(Math.max(n, 1), 200);
    }),
  invoiceKind: invoiceKindSchema.optional(),
  // Wave 5 fix: `v === 'true'` always produced a boolean even when the
  // param was never sent (`undefined === 'true'` is `false`), so the list
  // service's `if (opts.isPosted !== undefined)` guard was always true and
  // every "all documents" list request silently narrowed to drafts only —
  // posted invoices never appeared unless the caller explicitly asked for
  // isPosted=true. Preserving `undefined` when the param is absent lets the
  // "no filter" case actually mean no filter.
  isPosted: z
    .string()
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  includeLines: z.string().optional().transform((v) => v === 'true'),
  // Wave 5 fix: the list UI (`InventoryInvoicesListSection`) has always sent
  // `search`/`startDate`/`endDate`, but this schema silently dropped them
  // (Zod strips unknown keys by default), so the filter/search boxes on the
  // invoice list never had any effect.
  search: z.string().trim().min(1).max(200).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  // Wave 5 fix: the open-invoice allocation grid (treasury cash receipt/
  // payment) used to fetch a flat top-100 list of posted invoices for the
  // whole company and filter by party in the browser, so a party's older
  // open invoices could fall outside that window. Filter server-side instead.
  customerId: z.string().uuid().optional(),
  supplierId: z.string().uuid().optional(),
  openOnly: z.string().optional().transform((v) => v === 'true'),
  profileId: z.string().uuid().optional(),
});

export type CreateM5InvoiceInput = z.infer<typeof createM5InvoiceSchema>;
export type UpdateM5InvoiceInput = z.infer<typeof updateM5InvoiceServiceSchema>;
export type SettleM5InvoiceInput = z.infer<typeof settleM5InvoiceSchema>;
