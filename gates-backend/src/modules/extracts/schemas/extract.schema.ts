import { z } from 'zod';

export const createExtractSchema = z.object({
  projectId: z.string().uuid(),
  contractorId: z.string().uuid().optional().nullable(),
  extractNumber: z.string().optional(),
  extractDate: z.coerce.date(),
  statementType: z.enum(['partial', 'final']).default('partial'),
  statement: z.string().optional().nullable(),
  extractType: z.enum(['contractor', 'owner', 'self-execution']).default('contractor'),
  items: z.array(z.object({
    workItemId: z.string().uuid().optional().nullable(),
    buildingId: z.string().uuid().optional().nullable(),
    unitNumber: z.string().optional().nullable(),
    modelNumber: z.string().optional().nullable(),
    groupCode: z.string().optional().nullable(),
    groupName: z.string().optional().nullable(),
    itemNumber: z.string().optional().nullable(),
    itemName: z.string().min(1),
    quantity: z.number().nonnegative(),
    unit: z.string().optional().nullable(),
    unitPrice: z.number().nonnegative().optional().nullable(),
    totalPrice: z.number().nonnegative().optional().nullable(),
    notes: z.string().optional().nullable(),
  })).min(1, 'At least one item is required'),
  notes: z.string().optional().nullable(),
});

export const updateExtractSchema = createExtractSchema.partial().extend({
  items: z.array(z.object({
    id: z.string().uuid().optional(),
    workItemId: z.string().uuid().optional().nullable(),
    buildingId: z.string().uuid().optional().nullable(),
    unitNumber: z.string().optional().nullable(),
    modelNumber: z.string().optional().nullable(),
    groupCode: z.string().optional().nullable(),
    groupName: z.string().optional().nullable(),
    itemNumber: z.string().optional().nullable(),
    itemName: z.string().min(1).optional(),
    quantity: z.number().nonnegative().optional(),
    unit: z.string().optional().nullable(),
    unitPrice: z.number().nonnegative().optional().nullable(),
    totalPrice: z.number().nonnegative().optional().nullable(),
    notes: z.string().optional().nullable(),
  })).optional(),
});

export const extractQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(1000).optional(),
  projectId: z.string().uuid().optional(),
  contractorId: z.string().uuid().optional(),
  extractType: z.enum(['contractor', 'owner', 'self-execution']).optional(),
  statementType: z.enum(['partial', 'final']).optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
});

