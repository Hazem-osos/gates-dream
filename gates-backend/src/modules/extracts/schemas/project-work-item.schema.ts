import { z } from 'zod';

export const createProjectWorkItemSchema = z.object({
  projectId: z.string().uuid(),
  buildingId: z.string().uuid().optional().nullable(),
  itemNumber: z.string().min(1),
  itemGroupCode: z.string().optional().nullable(),
  itemGroupName: z.string().optional().nullable(),
  arabicName: z.string().min(1),
  englishName: z.string().optional().nullable(),
  quantity: z.number().nonnegative(),
  unit: z.string().optional().nullable(),
  unitPrice: z.number().nonnegative().optional().nullable(),
  totalPrice: z.number().nonnegative().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const updateProjectWorkItemSchema = createProjectWorkItemSchema.partial();

export const projectWorkItemQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(1000).optional(),
  projectId: z.string().uuid().optional(),
  buildingId: z.string().uuid().optional(),
  search: z.string().optional(),
});

