import { z } from 'zod';

export const createAnnualLeaveDisbursementSchema = z.object({
  employeeId: z.string().uuid('Employee ID must be a valid UUID'),
  serial: z.string().optional(),
  date: z.coerce.date(),
  hijriDate: z.string().optional(),
  paymentMethod: z.enum(['fund', 'bank']).optional().nullable(),
  vacationId: z.string().optional().nullable(), // Reference to AnnualLeaveEntitlementsClearance
  amount: z.number().positive('Amount must be greater than 0'),
  notes: z.string().optional().nullable(),
  record: z.string().optional(),
});

export const updateAnnualLeaveDisbursementSchema = createAnnualLeaveDisbursementSchema.partial();

export type CreateAnnualLeaveDisbursementInput = z.infer<typeof createAnnualLeaveDisbursementSchema>;
export type UpdateAnnualLeaveDisbursementInput = z.infer<typeof updateAnnualLeaveDisbursementSchema>;

