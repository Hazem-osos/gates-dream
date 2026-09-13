import { z } from 'zod';

const securitiesReceiptFieldsSchema = z.object({
  branchId: z.string().uuid().optional().nullable(),
  serial: z.string().optional(),
  receiptNumber: z.string().optional(),
  date: z.string().transform((val) => new Date(val)),
  hijriDate: z.string().optional(),
  description: z.string().optional(),
  securityType: z.enum(['check', 'promissory-note', 'bond', 'other']),
  customerId: z.string().uuid().optional().nullable(),
  supplierId: z.string().uuid().optional().nullable(),
  destinationAccountId: z.string().uuid().optional().nullable(),
  issuerName: z.string().optional(),
  issuerBank: z.string().optional(),
  securityNumber: z.string().optional(),
  dueDate: z.string().optional().transform((val) => (val ? new Date(val) : undefined)),
  amount: z.number().positive('Amount must be positive'),
  currencyCode: z.string().min(1, 'Currency code is required'),
  entityName: z.string().max(191).optional().nullable(),
});

export const createSecuritiesReceiptSchema = securitiesReceiptFieldsSchema.refine(
  (data) => data.customerId || data.supplierId || data.destinationAccountId,
  {
    message: 'اختر العميل أو حساباً آخر',
    path: ['destinationAccountId'],
  }
);

export const updateSecuritiesReceiptSchema = securitiesReceiptFieldsSchema.partial();

export const bounceSecuritiesReceiptSchema = z.object({
  description: z.string().optional(),
});

export const endorseSecuritiesReceiptSchema = z.object({
  supplierId: z.string().uuid('اختر المظهَّر إليه'),
  description: z.string().optional(),
});

export const securitiesReceiptQuerySchema = z.object({
  page: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 1)),
  limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 50)),
  startDate: z.string().optional().transform((val) => (val ? new Date(val) : undefined)),
  endDate: z.string().optional().transform((val) => (val ? new Date(val) : undefined)),
  securityType: z.enum(['check', 'promissory-note', 'bond', 'other']).optional(),
  customerId: z.string().uuid().optional(),
  supplierId: z.string().uuid().optional(),
  isPosted: z.string().optional().transform((val) => val === 'true'),
});

export type CreateSecuritiesReceiptInput = z.infer<typeof createSecuritiesReceiptSchema>;
export type UpdateSecuritiesReceiptInput = z.infer<typeof updateSecuritiesReceiptSchema>;
export type BounceSecuritiesReceiptInput = z.infer<typeof bounceSecuritiesReceiptSchema>;
export type EndorseSecuritiesReceiptInput = z.infer<typeof endorseSecuritiesReceiptSchema>;
export type SecuritiesReceiptQueryInput = z.infer<typeof securitiesReceiptQuerySchema>;

