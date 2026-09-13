import { z } from 'zod';

export const translateMessageSchema = z.object({
  key: z.string().min(1, 'Translation key is required'),
  language1: z.string().min(1, 'Language 1 is required'),
  language2: z.string().min(1, 'Language 2 is required'),
  category: z.string().optional(),
});

export const translateScreenSchema = z.object({
  screenName: z.string().min(1, 'Screen name is required'),
  language1: z.string().min(1, 'Language 1 is required'),
  language2: z.string().min(1, 'Language 2 is required'),
  translations: z.record(z.string()), // Key-value pairs of translations
});

export const bulkTranslateMessagesSchema = z.object({
  translations: z.array(translateMessageSchema),
});

export const translationQuerySchema = z.object({
  language1: z.string().optional(),
  language2: z.string().optional(),
  category: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(1000).optional(),
});

