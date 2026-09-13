import { z } from 'zod';

export const issueLineSchema = z.object({
  itemId: z.string().uuid('Item ID must be a valid UUID'),
  locationId: z.string().uuid('Location ID must be a valid UUID').optional().nullable(),
  quantity: z.number().positive('Quantity must be positive'),
  unitPrice: z.number().nonnegative('Unit price must be non-negative').optional(),
  total: z.number().nonnegative('Total must be non-negative').optional(),
});

export const createIssueSchema = z.object({
  branchId: z.string().uuid('Branch ID must be a valid UUID').optional().nullable(),
  description: z.string().optional(),
  serial: z.string().optional(),
  date: z.string().datetime('Date must be a valid ISO datetime'),
  hijriDate: z.string().optional(),
  warehouseId: z.string().uuid('Warehouse ID must be a valid UUID'),
  record: z.string().optional(),
  lines: z.array(issueLineSchema).min(1, 'At least one line is required'),
});

export const issueQuerySchema = z.object({
  branchId: z.string().uuid().optional(),
  warehouseId: z.string().uuid().optional(),
  isPosted: z.string().transform((val) => val === 'true').optional(),
  isApproved: z.string().transform((val) => val === 'true').optional(),
  isCancelled: z.string().transform((val) => val === 'true').optional(),
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
  skip: z.string().transform((val) => parseInt(val, 10)).optional(),
  take: z.string().transform((val) => parseInt(val, 10)).optional(),
});

export type CreateIssueInput = z.infer<typeof createIssueSchema>;
export type IssueLineInput = z.infer<typeof issueLineSchema>;
export type IssueQueryInput = z.infer<typeof issueQuerySchema>;

