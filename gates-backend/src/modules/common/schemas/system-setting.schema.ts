import { z } from 'zod';

export const systemSettingQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  category: z.string().optional(),
  isPublic: z.coerce.boolean().optional(),
  search: z.string().optional(),
});

export const createSystemSettingSchema = z.object({
  key: z.string().min(1).max(255),
  value: z.any().optional(),
  type: z.enum(['string', 'number', 'boolean', 'json']).optional().default('string'),
  category: z.string().max(100).optional(),
  description: z.string().optional(),
  isPublic: z.boolean().optional().default(false),
});

export const updateSystemSettingSchema = z.object({
  value: z.any().optional(),
  type: z.enum(['string', 'number', 'boolean', 'json']).optional(),
  category: z.string().max(100).optional(),
  description: z.string().optional(),
  isPublic: z.boolean().optional(),
});

export type SystemSettingQueryInput = z.infer<typeof systemSettingQuerySchema>;
export type CreateSystemSettingInput = z.infer<typeof createSystemSettingSchema>;
export type UpdateSystemSettingInput = z.infer<typeof updateSystemSettingSchema>;

