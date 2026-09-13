import { z } from 'zod';

export const deleteCancelledOperationsSchema = z.object({
  operationTypes: z.array(z.enum(['journal-entry', 'invoice', 'treasury-receipt', 'treasury-payment', 'all'])).optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  password: z.string().min(1, 'Password is required for this operation'),
});

export const fixAverageCostSchema = z.object({
  itemIds: z.array(z.string().uuid()).optional(), // If empty, fix all items
  warehouseIds: z.array(z.string().uuid()).optional(), // If empty, fix all warehouses
  recalculateFromDate: z.string().optional(), // Recalculate from this date
});

export const importEntrySchema = z.object({
  file: z.string().min(1, 'File path is required'),
  format: z.enum(['csv', 'excel', 'json']).default('csv'),
  entryType: z.enum(['journal-entry', 'invoice', 'treasury-receipt', 'treasury-payment']),
  validateBeforeImport: z.boolean().default(true),
});

export const latePaymentPenaltySchema = z.object({
  customerIds: z.array(z.string().uuid()).optional(), // If empty, apply to all customers
  fromDate: z.string(),
  toDate: z.string(),
  penaltyRate: z.number().min(0).max(100), // Percentage
  penaltyType: z.enum(['daily', 'monthly', 'fixed']).default('daily'),
});

export const postAllOperationsSchema = z.object({
  operationTypes: z.array(z.enum(['journal-entry', 'invoice', 'treasury-receipt', 'treasury-payment', 'all'])).optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  password: z.string().min(1, 'Password is required for this operation'),
});

export const defineOperationScreenSchema = z.object({
  screenName: z.string().min(1),
  operationType: z.string().min(1),
  fields: z.array(z.object({
    name: z.string(),
    type: z.string(),
    required: z.boolean().default(false),
    defaultValue: z.any().optional(),
  })),
  layout: z.any().optional(), // JSON layout configuration
});

