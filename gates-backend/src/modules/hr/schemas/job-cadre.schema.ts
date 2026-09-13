import { z } from 'zod';

export const createJobCadreSchema = z.object({
  code: z.string().optional(),
  arabicName: z.string().min(1, 'Arabic name is required'),
  englishName: z.string().optional(),
});

export const updateJobCadreSchema = createJobCadreSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const jobCadreQuerySchema = z.object({
  page: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 1)),
  limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 50)),
  search: z.string().optional(),
  isActive: z
    .string()
    .optional()
    .transform((val) => (val === undefined ? undefined : val === 'true')),
});

export type CreateJobCadreInput = z.infer<typeof createJobCadreSchema>;
export type UpdateJobCadreInput = z.infer<typeof updateJobCadreSchema>;
export type JobCadreQueryInput = z.infer<typeof jobCadreQuerySchema>;
