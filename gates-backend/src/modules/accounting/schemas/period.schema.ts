import { z } from 'zod';

const periodFieldsSchema = z.object({
  code: z.string().trim().max(50).optional(),
  name: z.string().min(1, 'Period name is required'),
  startDate: z.string().datetime().or(z.date()),
  endDate: z.string().datetime().or(z.date()),
});

export const createPeriodSchema = periodFieldsSchema.refine((data) => {
  const start = typeof data.startDate === 'string' ? new Date(data.startDate) : data.startDate;
  const end = typeof data.endDate === 'string' ? new Date(data.endDate) : data.endDate;
  return start < end;
}, {
  message: 'Start date must be before end date',
  path: ['endDate'],
});

export const updatePeriodSchema = periodFieldsSchema.partial().extend({
  isActive: z.boolean().optional(),
  isClosed: z.boolean().optional(),
});

export const periodQuerySchema = z.object({
  page: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 1)),
  limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 50)),
  search: z.string().optional(),
  isActive: z
    .string()
    .optional()
    .transform((val) => (val === undefined ? undefined : val === 'true')),
  isClosed: z.string().optional().transform((val) => val === 'true'),
});

export type CreatePeriodInput = z.infer<typeof createPeriodSchema>;
export type UpdatePeriodInput = z.infer<typeof updatePeriodSchema>;
export type PeriodQueryInput = z.infer<typeof periodQuerySchema>;
