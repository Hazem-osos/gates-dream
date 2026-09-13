import { z } from 'zod';

export const createProjectBuildingSchema = z.object({
  projectId: z.string().uuid(),
  groupNumber: z.string().optional().nullable(),
  modelNumber: z.string().optional().nullable(),
  unitNumber: z.string().optional().nullable(),
  arabicName: z.string().optional().nullable(),
  imageUrl: z.string().optional().nullable(),
});

export const updateProjectBuildingSchema = createProjectBuildingSchema.partial();

export const projectBuildingQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(1000).optional(),
  projectId: z.string().uuid().optional(),
  search: z.string().optional(),
});

