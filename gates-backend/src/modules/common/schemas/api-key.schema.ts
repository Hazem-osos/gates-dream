import { z } from 'zod';

export const createApiKeySchema = z.object({
  name: z.string().min(1).max(255),
  userId: z.string().uuid().optional(),
  tenantId: z.string().uuid().optional(),
  permissions: z.array(z.string()).min(1),
  expiresInDays: z.number().int().positive().optional(),
});

export const updateApiKeySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  permissions: z.array(z.string()).min(1).optional(),
  expiresInDays: z.number().int().positive().optional(),
});

export const apiKeyQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  userId: z.string().uuid().optional(),
  tenantId: z.string().uuid().optional(),
});

export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;
export type UpdateApiKeyInput = z.infer<typeof updateApiKeySchema>;
export type ApiKeyQueryInput = z.infer<typeof apiKeyQuerySchema>;

