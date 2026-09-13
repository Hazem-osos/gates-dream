import { z } from 'zod';

export const eosClearanceSchema = z.object({
  employeeId: z.string().uuid('Invalid employee ID'),
  contractId: z.string().uuid('Invalid contract ID').optional().nullable(),
  serial: z.string().optional(),
  date: z.coerce.date(),
  hijriDate: z.string().optional(),
  workDays: z.number().nonnegative().optional().nullable(),
  absenceDays: z.number().nonnegative().optional().nullable(),
  yearsOfWork: z.number().nonnegative().optional().nullable(),
  netWorkDays: z.number().nonnegative().optional().nullable(),
  vacationDays: z.number().nonnegative().optional().nullable(),
  dueDays: z.number().nonnegative().optional().nullable(),
  dueDaysValue: z.number().nonnegative().optional().nullable(),
  monthlySalary: z.number().nonnegative().optional().nullable(),
  totalValue: z.number().nonnegative().optional().nullable(),
  vacationDaysValue: z.number().nonnegative().optional().nullable(),
  eosAmount: z.number().positive('EOS amount must be positive'),
  accountId: z.string().uuid('Invalid account ID').optional().nullable(),
  notes: z.string().optional(),
  record: z.string().optional(),
});

export type EOSClearanceInput = z.infer<typeof eosClearanceSchema>;

