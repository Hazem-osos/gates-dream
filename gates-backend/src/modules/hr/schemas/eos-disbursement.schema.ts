import { z } from 'zod';

export const createEOSDisbursementSchema = z.object({
  employeeId: z.string().uuid('Employee ID must be a valid UUID'),
  serial: z.string().optional(),
  date: z.coerce.date(),
  hijriDate: z.string().optional(),
  paymentMethod: z.enum(['fund', 'bank']).optional().nullable(),
  vacationId: z.string().optional().nullable(), // Reference to EndOfServiceClearance or vacation type
  amount: z.number().positive('Amount must be greater than 0'),
  notes: z.string().optional().nullable(),
  record: z.string().optional(),
});

export const updateEOSDisbursementSchema = createEOSDisbursementSchema.partial();

export type CreateEOSDisbursementInput = z.infer<typeof createEOSDisbursementSchema>;
export type UpdateEOSDisbursementInput = z.infer<typeof updateEOSDisbursementSchema>;

