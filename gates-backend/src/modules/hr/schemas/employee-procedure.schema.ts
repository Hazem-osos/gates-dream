import { z } from 'zod';

export const createEmployeeProcedureSchema = z.object({
  employeeId: z.string().uuid('Employee ID must be a valid UUID'),
  serial: z.string().optional(),
  procedureType: z
    .enum([
      'warning',
      'reward',
      'penalty',
      'transfer',
      'promotion',
      'demotion',
      'suspension',
      'termination',
      'other',
    ])
    .or(z.string().min(1, 'Procedure type is required')),
  date: z.coerce.date(),
  hijriDate: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  amount: z.number().nonnegative().optional().nullable(),
  unit: z.string().optional().nullable(), // e.g., "جنية", "دولار", "نسبة"
  reason: z.string().optional().nullable(),
});

export const updateEmployeeProcedureSchema = createEmployeeProcedureSchema.partial().omit({
  employeeId: true,
});

export const employeeProcedureQuerySchema = z.object({
  page: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 1)),
  limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 50)),
  search: z.string().optional(),
  employeeId: z.string().uuid().optional(),
  procedureType: z.string().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

export type CreateEmployeeProcedureInput = z.infer<
  typeof createEmployeeProcedureSchema
>;
export type UpdateEmployeeProcedureInput = z.infer<
  typeof updateEmployeeProcedureSchema
>;
export type EmployeeProcedureQueryInput = z.infer<
  typeof employeeProcedureQuerySchema
>;
