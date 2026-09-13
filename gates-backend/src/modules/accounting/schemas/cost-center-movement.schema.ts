import { z } from 'zod';

export const transferCostCenterMovementSchema = z.object({
  fromCostCenterId: z.string().uuid('From cost center ID must be a valid UUID'),
  toCostCenterId: z.string().uuid('To cost center ID must be a valid UUID'),
  fromDate: z.coerce.date(),
  toDate: z.coerce.date(),
  accountId: z.string().uuid().optional(),
  hijriDate: z.string().optional(),
  description: z.string().optional(),
  movementIds: z.array(z.string().uuid()).optional(),
}).refine(
  (data) => data.fromCostCenterId !== data.toCostCenterId,
  {
    message: 'From cost center and to cost center cannot be the same',
    path: ['toCostCenterId'],
  }
).refine(
  (data) => data.fromDate <= data.toDate,
  {
    message: 'From date must be before or equal to to date',
    path: ['toDate'],
  }
);

export const costCenterMovementSummarySchema = z.object({
  costCenterId: z.string().uuid('Cost center ID must be a valid UUID'),
  fromDate: z.coerce.date(),
  toDate: z.coerce.date(),
  accountId: z.string().uuid().optional(),
}).refine(
  (data) => data.fromDate <= data.toDate,
  {
    message: 'From date must be before or equal to to date',
    path: ['toDate'],
  }
);

export type TransferCostCenterMovementInput = z.infer<
  typeof transferCostCenterMovementSchema
>;
export type CostCenterMovementSummaryInput = z.infer<
  typeof costCenterMovementSummarySchema
>;
