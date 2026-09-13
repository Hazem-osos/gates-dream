import { z } from 'zod';

export const housingAllowanceClearanceSchema = z.object({
  employeeId: z.string().uuid('Invalid employee ID'),
  contractId: z.string().uuid('Invalid contract ID').optional().nullable(),
  serial: z.string().optional(),
  date: z.coerce.date(),
  hijriDate: z.string().optional(),
  daysSinceLastDisbursement: z.number().int().nonnegative().optional().nullable(),
  monthsSinceLastDisbursement: z.number().int().nonnegative().optional().nullable(),
  availableAdditions: z.number().nonnegative().optional().nullable(),
  monthlySalary: z.number().nonnegative().optional().nullable(),
  totalValue: z.number().nonnegative().optional().nullable(),
  totalSalary: z.number().nonnegative().optional().nullable(),
  allowanceAmount: z.number().positive('Allowance amount must be positive'),
  accountId: z.string().uuid('Invalid account ID').optional().nullable(),
  notes: z.string().optional(),
  record: z.string().optional(),
});

export type HousingAllowanceClearanceInput = z.infer<
  typeof housingAllowanceClearanceSchema
>;

