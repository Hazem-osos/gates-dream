import { z } from 'zod';

const securitiesPaymentFieldsSchema = z.object({
  branchId: z.string().uuid().optional().nullable(),
  serial: z.string().optional(),
  paymentNumber: z.string().optional(),
  date: z.string().transform((val) => new Date(val)),
  hijriDate: z.string().optional(),
  description: z.string().optional(),
  securityType: z.enum(['check', 'promissory-note', 'bond', 'other']),
  customerId: z.string().uuid().optional().nullable(),
  supplierId: z.string().uuid().optional().nullable(),
  destinationAccountId: z.string().uuid().optional().nullable(),
  payeeName: z.string().optional(),
  payeeBank: z.string().optional(),
  securityNumber: z.string().optional(),
  dueDate: z.string().optional().transform((val) => (val ? new Date(val) : undefined)),
  amount: z.number().positive('Amount must be positive'),
  currencyCode: z.string().min(1, 'Currency code is required'),
  entityName: z.string().max(191).optional().nullable(),
});

export const createSecuritiesPaymentSchema = securitiesPaymentFieldsSchema.refine(
  (data) => data.customerId || data.supplierId || data.destinationAccountId,
  {
    message: 'اختر العميل أو حساباً آخر',
    path: ['destinationAccountId'],
  }
);

export const updateSecuritiesPaymentSchema = securitiesPaymentFieldsSchema.partial();

export const bounceSecuritiesPaymentSchema = z.object({
  description: z.string().optional(),
  date: z
    .string()
    .optional()
    .transform((val) => (val ? new Date(val) : undefined)),
  accountId: z.string().uuid().optional(),
});

export const securitiesPaymentQuerySchema = z.object({
  page: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 1)),
  limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 50)),
  startDate: z.string().optional().transform((val) => (val ? new Date(val) : undefined)),
  endDate: z.string().optional().transform((val) => (val ? new Date(val) : undefined)),
  securityType: z.enum(['check', 'promissory-note', 'bond', 'other']).optional(),
  customerId: z.string().uuid().optional(),
  supplierId: z.string().uuid().optional(),
  isPosted: z.string().optional().transform((val) => val === 'true'),
});

export type CreateSecuritiesPaymentInput = z.infer<typeof createSecuritiesPaymentSchema>;
export type UpdateSecuritiesPaymentInput = z.infer<typeof updateSecuritiesPaymentSchema>;
export type BounceSecuritiesPaymentInput = z.infer<typeof bounceSecuritiesPaymentSchema>;
export type SecuritiesPaymentQueryInput = z.infer<typeof securitiesPaymentQuerySchema>;

