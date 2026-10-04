import { z } from 'zod';
import { paperDueBeforeIssue } from '../utils/paper-due-date';

const invoiceAllocationSchema = z.object({
  invoiceId: z.string().uuid(),
  allocatedAmount: z.number().positive(),
});

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
  partyAccountId: z.string().uuid().optional().nullable(),
  depositAccountId: z.string().uuid().optional().nullable(),
  depositDate: z
    .string()
    .optional()
    .nullable()
    .transform((val) => (val ? new Date(val) : undefined)),
  issuerName: z.string().optional(),
  issuerBank: z.string().optional(),
  securityNumber: z.string().optional(),
  dueDate: z.string().optional().transform((val) => (val ? new Date(val) : undefined)),
  amount: z.number().positive('Amount must be positive'),
  currencyCode: z.string().min(1, 'Currency code is required'),
  entityName: z.string().max(191).optional().nullable(),
  entityId: z.string().uuid().optional().nullable(),
  allocations: z.array(invoiceAllocationSchema).optional(),
});

export const createSecuritiesReceiptSchema = securitiesReceiptFieldsSchema
  .refine((data) => data.customerId || data.supplierId || data.partyAccountId, {
    message: 'اختر العميل أو حساب حركة',
    path: ['partyAccountId'],
  })
  .refine((data) => !paperDueBeforeIssue(data.date, data.dueDate), {
    message: 'تاريخ الاستحقاق لا يمكن أن يكون قبل تاريخ التحرير',
    path: ['dueDate'],
  });

export const updateSecuritiesReceiptSchema = securitiesReceiptFieldsSchema.partial();

export const bounceSecuritiesReceiptSchema = z.object({
  description: z.string().optional(),
  date: z
    .string()
    .optional()
    .transform((val) => (val ? new Date(val) : undefined)),
  accountId: z.string().uuid().optional(),
});

export const depositSecuritiesReceiptSchema = z.object({
  accountId: z.string().uuid().nullable().optional(),
  date: z
    .string()
    .optional()
    .nullable()
    .transform((val) => (val ? new Date(val) : null)),
});

export const collectSecuritiesSchema = z.object({
  accountId: z.string().uuid('اختر حساب التحصيل'),
  date: z
    .string()
    .optional()
    .transform((val) => (val ? new Date(val) : undefined)),
  description: z.string().optional(),
  costCenterId: z.string().uuid().optional().nullable(),
});

export const endorseSecuritiesReceiptSchema = z.object({
  accountId: z.string().uuid('اختر الحساب'),
  supplierId: z.string().uuid().optional(),
  description: z.string().optional(),
  date: z
    .string()
    .optional()
    .transform((val) => (val ? new Date(val) : undefined)),
});

export const securitiesReceiptQuerySchema = z.object({
  page: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 1)),
  limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 50)),
  startDate: z.string().optional().transform((val) => (val ? new Date(val) : undefined)),
  endDate: z.string().optional().transform((val) => (val ? new Date(val) : undefined)),
  securityType: z.enum(['check', 'promissory-note', 'bond', 'other']).optional(),
  customerId: z.string().uuid().optional(),
  supplierId: z.string().uuid().optional(),
  entityId: z.string().uuid().optional(),
  isPosted: z
    .enum(['true', 'false'])
    .optional()
    .transform((val) => (val == null ? undefined : val === 'true')),
});

export type CreateSecuritiesReceiptInput = z.infer<typeof createSecuritiesReceiptSchema>;
export type UpdateSecuritiesReceiptInput = z.infer<typeof updateSecuritiesReceiptSchema>;
export type BounceSecuritiesReceiptInput = z.infer<typeof bounceSecuritiesReceiptSchema>;
export type CollectSecuritiesInput = z.infer<typeof collectSecuritiesSchema>;
export type EndorseSecuritiesReceiptInput = z.infer<typeof endorseSecuritiesReceiptSchema>;
export type SecuritiesReceiptQueryInput = z.infer<typeof securitiesReceiptQuerySchema>;

