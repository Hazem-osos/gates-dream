import { z } from 'zod';

export const leaveEntitlementsDisbursementSchema = z.object({
  employeeId: z.string().uuid('Invalid employee ID'),
  contractId: z.string().uuid('Invalid contract ID').optional().nullable(),
  serial: z.string().optional(),
  date: z.coerce.date(),
  hijriDate: z.string().optional(),
  fromDate: z.coerce.date().optional().nullable(),
  fromDateHijri: z.string().optional(),
  toDate: z.coerce.date().optional().nullable(),
  toDateHijri: z.string().optional(),
  lastDirectDate: z.coerce.date().optional().nullable(),
  lastDirectDateHijri: z.string().optional(),
  workDays: z.number().nonnegative().optional().nullable(),
  dueDays: z.number().nonnegative().optional().nullable(),
  previousBalance: z.number().nonnegative().optional().nullable(),
  totalAvailableDays: z.number().nonnegative().optional().nullable(),
  monthlySalary: z.number().nonnegative().optional().nullable(),
  availableAllowances: z.number().nonnegative().optional().nullable(),
  totalValue: z.number().nonnegative().optional().nullable(),
  dueTickets: z.number().nonnegative().optional().nullable(),
  addedValue: z.number().nonnegative().optional().nullable(),
  requiredDays: z.number().nonnegative().optional().nullable(),
  deductedValue: z.number().nonnegative().optional().nullable(),
  leaveEntitlements: z.number().nonnegative().optional().nullable(),
  totalEntitlements: z.number().nonnegative().optional().nullable(),
  entitlementDays: z.number().positive('Entitlement days must be positive'),
  accountId: z.string().uuid().optional().nullable(),
  notes: z.string().optional(),
  record: z.string().optional(),
});

export type LeaveEntitlementsDisbursementInput = z.infer<
  typeof leaveEntitlementsDisbursementSchema
>;

