import { z } from 'zod';

export const createExtractPaymentSchema = z.object({
  extractId: z.string().uuid(),
  contractorId: z.string().uuid().optional().nullable(),
  projectId: z.string().uuid(),
  paymentNumber: z.string().optional(),
  paymentDate: z.coerce.date(),
  dueDate: z.coerce.date().optional().nullable(),
  safeId: z.string().uuid().optional().nullable(),
  bankAccountId: z.string().uuid().optional().nullable(),
  checkNumber: z.string().optional().nullable(),
  checkDate: z.coerce.date().optional().nullable(),
  hijriDate: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  paymentAmount: z.number().nonnegative(),
  itemGroup: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const updateExtractPaymentSchema = createExtractPaymentSchema.partial();

export const extractPaymentQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(1000).optional(),
  extractId: z.string().uuid().optional(),
  contractorId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
});

