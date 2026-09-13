import { z } from 'zod';

export const createMonthlySalarySchema = z.object({
  employeeId: z.string().uuid('Employee ID must be a valid UUID'),
  contractId: z.string().uuid('Contract ID must be a valid UUID').optional(),
  serial: z.string().optional(),
  periodYear: z.string().min(1, 'Period year is required'),
  periodMonth: z.string().min(1, 'Period month is required'),
  date: z.coerce.date(),
  hijriDate: z.string().optional(),
  workDays: z.number().positive().optional(),
  basicSalary: z.number().positive('Basic salary must be positive'),
  totalAllowances: z.number().nonnegative().optional(),
  totalDeductions: z.number().nonnegative().optional(),
  additions: z.number().nonnegative().optional(),
  discounts: z.number().nonnegative().optional(),
  overtime: z.number().nonnegative().optional(),
  absence: z.number().nonnegative().optional(),
  advances: z.number().nonnegative().optional(),
  employeeInsurance: z.number().nonnegative().optional(),
  companyInsurance: z.number().nonnegative().optional(),
  netSalary: z.number().positive('Net salary must be positive'),
  record: z.string().optional(),
  notes: z.string().optional(),
});

export const updateMonthlySalarySchema = createMonthlySalarySchema.partial().extend({
  employeeId: z.string().uuid().optional(),
  periodYear: z.string().optional(),
  periodMonth: z.string().optional(),
  basicSalary: z.number().positive().optional(),
  netSalary: z.number().positive().optional(),
});

export const monthlySalaryQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(1000).optional(),
  employeeId: z.string().uuid().optional(),
  contractId: z.string().uuid().optional(),
  periodYear: z.string().optional(),
  periodMonth: z.string().optional(),
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
  search: z.string().optional(),
});

export type CreateMonthlySalaryInput = z.infer<typeof createMonthlySalarySchema>;
export type UpdateMonthlySalaryInput = z.infer<typeof updateMonthlySalarySchema>;
export type MonthlySalaryQueryInput = z.infer<typeof monthlySalaryQuerySchema>;

