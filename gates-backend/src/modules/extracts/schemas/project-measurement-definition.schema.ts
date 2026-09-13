import { z } from 'zod';

export const createProjectMeasurementDefinitionSchema = z.object({
  projectId: z.string().uuid(),
  arabicName: z.string().min(1),
  englishName: z.string().optional().nullable(),
  unit: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const updateProjectMeasurementDefinitionSchema = createProjectMeasurementDefinitionSchema.partial();

export const projectMeasurementDefinitionQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(1000).optional(),
  projectId: z.string().uuid().optional(),
  search: z.string().optional(),
});

