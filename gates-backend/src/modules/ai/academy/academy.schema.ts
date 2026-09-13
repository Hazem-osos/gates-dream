import { z } from 'zod';

export const academyModuleQuerySchema = z
  .object({
    moduleSlug: z.string().trim().min(1).max(80).optional(),
    currentPath: z.string().trim().max(500).optional(),
  })
  .strip();

export const academyProgressBodySchema = z
  .object({
    moduleSlug: z.string().trim().min(1).max(80),
    isCompleted: z.boolean().optional(),
    lastStepIndex: z.number().int().min(0).max(50).optional(),
    dismissed: z.boolean().optional(),
  })
  .strip();

export type AcademyModuleQuery = z.infer<typeof academyModuleQuerySchema>;
export type AcademyProgressBody = z.infer<typeof academyProgressBodySchema>;
