import { z } from 'zod';

export const permissionDefinitionsQuerySchema = z.object({
  module: z.string().optional(),
  resource: z.string().optional(),
});

export type PermissionDefinitionsQueryInput = z.infer<
  typeof permissionDefinitionsQuerySchema
>;

