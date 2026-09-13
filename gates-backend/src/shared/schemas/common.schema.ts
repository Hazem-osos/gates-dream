import { z } from 'zod';

// Date validation schemas (both Gregorian and Hijri)
export const dateSchema = z.string().regex(/^\d{2}-\d{2}-\d{4}$/);

export const serialNumberSchema = z.string().min(1);

// Pagination schemas
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
});

export const sortOrderSchema = z.enum(['asc', 'desc']).default('desc');

// Common query parameters
export const commonQuerySchema = z.object({
  search: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: sortOrderSchema.optional(),
}).merge(paginationSchema);

export type PaginationInput = z.infer<typeof paginationSchema>;
export type CommonQueryInput = z.infer<typeof commonQuerySchema>;
