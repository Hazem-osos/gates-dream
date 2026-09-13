import { z } from 'zod';

export const createHousingAllowanceDisbursementSchema = z.object({
  employeeId: z.string().uuid('Employee ID must be a valid UUID'),
  serial: z.string().optional(),
  date: z.coerce.date(),
  hijriDate: z.string().optional(),
  paymentMethod: z.enum(['fund', 'bank']).optional().nullable(),
  housingRef: z.string().optional().nullable(), // Reference to HousingAllowanceClearance or type
  amount: z.number().positive('Amount must be greater than 0'),
  notes: z.string().optional().nullable(),
  record: z.string().optional(),
});

export const updateHousingAllowanceDisbursementSchema = createHousingAllowanceDisbursementSchema.partial();

export type CreateHousingAllowanceDisbursementInput = z.infer<typeof createHousingAllowanceDisbursementSchema>;
export type UpdateHousingAllowanceDisbursementInput = z.infer<typeof updateHousingAllowanceDisbursementSchema>;

