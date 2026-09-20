import { z } from 'zod';

export const CREATE_PURCHASE_REQUEST_ACTION = 'gates.createPurchaseRequest';

const optionalUuid = z.string().uuid().optional().nullable();

export const automationPurchaseRequestLineSchema = z.object({
  itemId: z.string().uuid('itemId must be a UUID'),
  quantity: z.number().positive('quantity must be greater than 0'),
  unitId: optionalUuid,
  baseUnitId: optionalUuid,
  unitPrice: z.number().nonnegative().optional(),
  discountPercentage: z.number().min(0).max(100).optional(),
  discountValue: z.number().nonnegative().optional(),
  taxPercentage: z.number().min(0).max(100).optional(),
  taxValue: z.number().nonnegative().optional(),
  discount: z.number().min(0).max(100).optional(),
  tax: z.number().min(0).max(100).optional(),
});

export const createAutomationPurchaseRequestSchema = z.object({
  companyId: z.string().uuid('companyId must be a company UUID'),
  eventId: z.string().trim().min(1, 'eventId is required'),
  correlationId: z.string().trim().min(1, 'correlationId is required'),
  eventType: z.string().trim().min(1).optional(),
  ruleId: z.string().uuid('ruleId must be a UUID'),
  supplierId: z.string().uuid('supplierId must be a UUID'),
  date: z.string().datetime({ message: 'date must be a valid ISO datetime' }),
  warehouseId: optionalUuid,
  branchId: optionalUuid,
  description: z.string().trim().max(2000).optional(),
  currencyId: optionalUuid,
  exchangeRate: z.number().positive().optional(),
  expectedDeliveryDate: z.string().datetime().optional(),
  lines: z.array(automationPurchaseRequestLineSchema).min(1, 'At least one line is required'),
});

export type CreateAutomationPurchaseRequestInput = z.infer<
  typeof createAutomationPurchaseRequestSchema
>;
export type AutomationPurchaseRequestLineInput = z.infer<
  typeof automationPurchaseRequestLineSchema
>;
