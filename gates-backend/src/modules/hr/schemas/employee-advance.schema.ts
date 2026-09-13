import { z } from 'zod';

export const createEmployeeAdvanceSchema = z.object({
  employeeId: z.string().uuid('Employee ID must be a valid UUID'),
  serial: z.string().optional(),
  date: z.coerce.date(),
  hijriDate: z.string().optional(),
  value: z.number().positive('Advance value must be greater than 0'),
  monthlyInstallment: z.number().nonnegative().optional().nullable(),
  fromMonth: z.string().optional().nullable(),
  toYear: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  record: z.string().optional(),
  paymentMethod: z.enum(['fund', 'bank']).optional().nullable(),
});

export const updateEmployeeAdvanceSchema = createEmployeeAdvanceSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const employeeAdvanceQuerySchema = z.object({
  page: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 1)),
  limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 50)),
  search: z.string().optional(),
  employeeId: z.string().uuid().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

export type CreateEmployeeAdvanceInput = z.infer<typeof createEmployeeAdvanceSchema>;
export type UpdateEmployeeAdvanceInput = z.infer<typeof updateEmployeeAdvanceSchema>;
export type EmployeeAdvanceQueryInput = z.infer<typeof employeeAdvanceQuerySchema>;
