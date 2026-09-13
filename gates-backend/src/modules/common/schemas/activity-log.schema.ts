import { z } from 'zod';

export const activityLogQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  kind: z.string().optional(),
  subjectType: z.string().optional(),
  subjectId: z.string().optional(),
  severity: z.string().optional(),
  actorId: z.string().uuid().optional(),
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
});

export type ActivityLogQueryInput = z.infer<typeof activityLogQuerySchema>;

