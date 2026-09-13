import { z } from 'zod';

export const createMonthlySalariesDisbursementSchema = z.object({
  serial: z.string().optional(),
  month: z.string().min(1, 'Month is required'), // e.g., "يناير", "فبراير"
  year: z.string().min(1, 'Year is required'), // e.g., "2025"
  notes: z.string().optional().nullable(),
  record: z.string().optional(),
});

export const updateMonthlySalariesDisbursementSchema = createMonthlySalariesDisbursementSchema.partial();

export type CreateMonthlySalariesDisbursementInput = z.infer<typeof createMonthlySalariesDisbursementSchema>;
export type UpdateMonthlySalariesDisbursementInput = z.infer<typeof updateMonthlySalariesDisbursementSchema>;

