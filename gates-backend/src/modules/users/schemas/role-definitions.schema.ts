import { z } from 'zod';

export const roleDefinitionsQuerySchema = z.object({
  module: z.string().optional(),
});

export type RoleDefinitionsQueryInput = z.infer<
  typeof roleDefinitionsQuerySchema
>;

