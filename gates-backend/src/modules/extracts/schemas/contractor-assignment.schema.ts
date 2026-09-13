import { z } from 'zod';

export const createContractorAssignmentSchema = z.object({
  projectId: z.string().uuid(),
  contractorId: z.string().uuid(),
  workItemId: z.string().uuid(),
  assignmentDate: z.coerce.date().optional(),
  notes: z.string().optional().nullable(),
});

export const updateContractorAssignmentSchema = createContractorAssignmentSchema.partial();

export const contractorAssignmentQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(1000).optional(),
  projectId: z.string().uuid().optional(),
  contractorId: z.string().uuid().optional(),
  workItemId: z.string().uuid().optional(),
});

