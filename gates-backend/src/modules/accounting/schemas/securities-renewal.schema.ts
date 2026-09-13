import { z } from 'zod';

export const createSecuritiesRenewalSchema = z.object({
  branchId: z.string().uuid().optional().nullable(),
  serial: z.string().optional(),
  renewalNumber: z.string().optional(),
  date: z.string().transform((val) => new Date(val)),
  hijriDate: z.string().optional(),
  description: z.string().optional(),
  originalSecurityId: z.string().uuid().optional().nullable(),
  originalSecurityType: z.enum(['receipt', 'payment']).optional().nullable(),
  newDueDate: z.string().optional().transform((val) => (val ? new Date(val) : undefined)),
  newAmount: z.number().positive().optional().nullable(),
  renewalFee: z.number().nonnegative().optional().nullable(),
});

export const updateSecuritiesRenewalSchema = createSecuritiesRenewalSchema.partial();

export const securitiesRenewalQuerySchema = z.object({
  page: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 1)),
  limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 50)),
  startDate: z.string().optional().transform((val) => (val ? new Date(val) : undefined)),
  endDate: z.string().optional().transform((val) => (val ? new Date(val) : undefined)),
  isPosted: z.string().optional().transform((val) => val === 'true'),
});

export type CreateSecuritiesRenewalInput = z.infer<typeof createSecuritiesRenewalSchema>;
export type UpdateSecuritiesRenewalInput = z.infer<typeof updateSecuritiesRenewalSchema>;
export type SecuritiesRenewalQueryInput = z.infer<typeof securitiesRenewalQuerySchema>;

