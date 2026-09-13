import { z } from 'zod';

export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
  .optional();

export const optionalUuid = z.string().uuid().optional();
export const requiredUuid = z.string().uuid();
