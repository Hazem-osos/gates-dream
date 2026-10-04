import { z } from 'zod';

export const contractVariationParamsSchema = z.object({
  contractId: z.string().uuid(),
  variationOrderId: z.string().uuid(),
});

export const subcontractVariationParamsSchema = z.object({
  id: z.string().uuid(),
  variationOrderId: z.string().uuid(),
});

const changeTypeSchema = z.enum(['QUANTITY_CHANGE', 'RATE_CHANGE', 'NEW_ITEM', 'OMIT']);

const ownerVariationLineSchema = z.object({
  changeType: changeTypeSchema,
  projectBOQItemId: z.string().uuid().optional().nullable(),
  itemCodeSnapshot: z.string().trim().min(1).max(64),
  descriptionArSnapshot: z.string().trim().min(1).max(500),
  unitSnapshot: z.string().trim().min(1).max(20),
  quantityDelta: z.coerce.number().optional(),
  approvedRate: z.coerce.number().min(0).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
});

const subcontractVariationLineSchema = z.object({
  changeType: changeTypeSchema,
  subcontractBOQItemId: z.string().uuid().optional().nullable(),
  itemCodeSnapshot: z.string().trim().min(1).max(64),
  descriptionArSnapshot: z.string().trim().min(1).max(500),
  unitSnapshot: z.string().trim().min(1).max(20),
  quantityDelta: z.coerce.number().optional(),
  approvedRate: z.coerce.number().min(0).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
});

export const saveContractVariationOrderSchema = z.object({
  variationOrderId: z.string().uuid().optional(),
  orderDate: z.coerce.date(),
  reason: z.string().trim().min(3).max(4000),
  lines: z.array(ownerVariationLineSchema).min(1),
});

export const saveSubcontractVariationOrderSchema = z.object({
  variationOrderId: z.string().uuid().optional(),
  orderDate: z.coerce.date(),
  reason: z.string().trim().min(3).max(4000),
  lines: z.array(subcontractVariationLineSchema).min(1),
});

export const rejectVariationOrderSchema = z.object({
  reason: z.string().trim().min(3).max(2000),
});

export const cancelApprovedVariationOrderSchema = z.object({
  reason: z.string().trim().min(3).max(2000),
});
