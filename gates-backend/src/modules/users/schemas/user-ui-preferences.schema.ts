import { z } from 'zod';

export const pageFavoriteSchema = z.object({
  href: z.string().min(1).max(500),
  label: z.string().min(1).max(200),
  starredAt: z.number().finite(),
});

export const savedViewSchema = z.object({
  id: z.string().min(1).max(80),
  name: z.string().min(1).max(120),
  filters: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])),
  createdAt: z.number().finite(),
});

export const userUiPreferencesSchema = z.object({
  pageFavorites: z.array(pageFavoriteSchema).max(40).optional(),
  savedViewsByScreen: z.record(z.array(savedViewSchema).max(24)).optional(),
});

export type UserUiPreferencesInput = z.infer<typeof userUiPreferencesSchema>;
