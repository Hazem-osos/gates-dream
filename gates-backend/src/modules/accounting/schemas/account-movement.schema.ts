import { z } from 'zod';

export const transferAccountMovementSchema = z.object({
  fromAccountId: z.string().uuid('From account ID must be a valid UUID'),
  toAccountId: z.string().uuid('To account ID must be a valid UUID'),
  fromDate: z.coerce.date(),
  toDate: z.coerce.date(),
  hijriDate: z.string().optional(),
  description: z.string().optional(),
  /// C9 fix: the reclassification journal must be posted against a branch;
  /// defaults to the company's first branch when omitted.
  branchId: z.string().uuid().optional(),
  lineIds: z.array(z.string().uuid()).optional(),
}).refine(
  (data) => data.fromAccountId !== data.toAccountId,
  {
    message: 'From account and to account cannot be the same',
    path: ['toAccountId'],
  }
).refine(
  (data) => data.fromDate <= data.toDate,
  {
    message: 'From date must be before or equal to to date',
    path: ['toDate'],
  }
);

export const accountMovementSummarySchema = z.object({
  accountId: z.string().uuid('Account ID must be a valid UUID'),
  fromDate: z.coerce.date(),
  toDate: z.coerce.date(),
}).refine(
  (data) => data.fromDate <= data.toDate,
  {
    message: 'From date must be before or equal to to date',
    path: ['toDate'],
  }
);

export type TransferAccountMovementInput = z.infer<
  typeof transferAccountMovementSchema
>;
export type AccountMovementSummaryInput = z.infer<
  typeof accountMovementSummarySchema
>;
