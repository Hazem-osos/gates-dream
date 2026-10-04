import { z } from 'zod';

export const contractIdParamSchema = z.object({
  contractId: z.string().uuid(),
});

export const ownerPrelimParamsSchema = z.object({
  contractId: z.string().uuid(),
  certificateId: z.string().uuid(),
});

export const subPrelimParamsSchema = z.object({
  id: z.string().uuid(),
  certificateId: z.string().uuid(),
});

const lineSchema = z.object({
  projectBOQItemId: z.string().uuid(),
  requestedCurrentQuantity: z.coerce.number().min(0),
  approvedCurrentQuantity: z.coerce.number().min(0).optional(),
});

const subLineSchema = z.object({
  subcontractBOQItemId: z.string().uuid(),
  requestedCurrentQuantity: z.coerce.number().min(0),
  approvedCurrentQuantity: z.coerce.number().min(0).optional(),
});

export const saveOwnerPreliminarySchema = z.object({
  certificateId: z.string().uuid().optional(),
  periodStartDate: z.coerce.date(),
  periodEndDate: z.coerce.date(),
  otherClientPenalties: z.coerce.number().min(0).optional(),
  lines: z.array(lineSchema).min(1),
  measurementSheetIds: z
    .array(
      z.object({
        executiveMeasurementSheetId: z.string().uuid(),
        consumedQuantity: z.coerce.number().min(0),
      })
    )
    .optional(),
});

export const approveOwnerPreliminarySchema = z.object({
  lines: z.array(
    z.object({
      projectBOQItemId: z.string().uuid(),
      approvedCurrentQuantity: z.coerce.number().min(0),
    })
  ),
});

export const rejectPreliminarySchema = z.object({
  reason: z.string().trim().min(3).max(2000),
});

export const convertPreliminarySchema = z.object({
  idempotencyKey: z.string().trim().min(8).max(128),
});

export const saveSubPreliminarySchema = z.object({
  certificateId: z.string().uuid().optional(),
  periodStartDate: z.coerce.date(),
  periodEndDate: z.coerce.date(),
  lines: z.array(subLineSchema).min(1),
  applyEarlyPaymentDiscount: z.boolean().optional(),
});

export const approveSubPreliminarySchema = z.object({
  lines: z.array(
    z.object({
      subcontractBOQItemId: z.string().uuid(),
      approvedCurrentQuantity: z.coerce.number().min(0),
    })
  ),
});
