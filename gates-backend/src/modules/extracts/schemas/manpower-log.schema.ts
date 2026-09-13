import { z } from 'zod';

export const createManpowerLogSchema = z.object({
  projectId: z.string().uuid(),
  date: z.coerce.date(),
  workerName: z.string().min(1),
  workerType: z.string().optional().nullable(),
  hours: z.number().nonnegative().optional().nullable(),
  wage: z.number().nonnegative().optional().nullable(),
  total: z.number().nonnegative().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const updateManpowerLogSchema = createManpowerLogSchema.partial();

export const manpowerLogQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(1000).optional(),
  projectId: z.string().uuid().optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
  workerType: z.string().optional(),
  search: z.string().optional(),
});

