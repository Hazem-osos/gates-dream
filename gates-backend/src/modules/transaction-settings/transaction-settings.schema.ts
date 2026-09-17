import { z } from 'zod';

export const transactionDocumentTypeSchema = z.enum([
  'SALES_INVOICE',
  'PURCHASE_INVOICE',
  'PAYMENT_VOUCHER',
  'RECEIPT_VOUCHER',
  'STOCK_ISSUE',
  'STOCK_RECEIPT',
  'SALES_RETURN',
  'PURCHASE_RETURN',
  'BANK_DEBIT_ADVICE',
  'BANK_CREDIT_ADVICE',
  'JOURNAL_ENTRY',
  'OPENING_BALANCE',
  'SECURITIES_RECEIPT',
  'SECURITIES_PAYMENT',
]);

export const numberingModeSchema = z.enum(['AUTOMATIC', 'MANUAL']);
export const sequenceModeSchema = z.enum(['CONTINUOUS', 'ANNUAL_RESET']);
export const pricingPolicySchema = z.enum([
  'COST',
  'LAST_PURCHASE',
  'LAST_SALE',
  'LAST_SALE_TO_CUSTOMER',
]);
export const costCenterPostingSideSchema = z.enum(['DEBIT', 'CREDIT']);
export const costCenterAllocationTargetSchema = z.enum(['SALES', 'COST_OF_GOODS_SOLD']);

const optionalUuid = z.string().uuid().nullable().optional();

export const updateTransactionSettingsSchema = z.object({
  numberingMode: numberingModeSchema.optional(),
  sequenceMode: sequenceModeSchema.optional(),
  autoPostOnSave: z.boolean().optional(),
  autoPrintOnSave: z.boolean().optional(),
  generateEntryOnSave: z.boolean().optional(),
  affectStock: z.boolean().optional(),
  allowItemPriceOverride: z.boolean().optional(),
  preventSellingBelowCost: z.boolean().optional(),
  preventNegativeStock: z.boolean().optional(),
  autoApplyVat: z.boolean().optional(),
  autoApplyWht: z.boolean().optional(),
  autoApplyDevelopmentTax: z.boolean().optional(),
  cascadingDiscounts: z.boolean().optional(),
  showAllAccountsInCustomerField: z.boolean().optional(),
  defaultSalesAccountId: optionalUuid,
  defaultPurchaseReturnAccountId: optionalUuid,
  defaultCashAccountId: optionalUuid,
  defaultBankGlAccountId: optionalUuid,
  defaultOffsetAccountId: optionalUuid,
  defaultChargesAccountId: optionalUuid,
  defaultCostCenterId: optionalUuid,
  defaultWarehouseId: optionalUuid,
  pricingPolicy: pricingPolicySchema.optional(),
  costCenterSide: costCenterPostingSideSchema.optional(),
  costCenterAllocationTarget: costCenterAllocationTargetSchema.optional(),
  allowStandaloneReturns: z.boolean().optional(),
  enforceOriginalPrice: z.boolean().optional(),
  showFxColumns: z.boolean().optional(),
  allowEditLoadedOrder: z.boolean().optional(),
});

export const documentTypeParamsSchema = z.object({
  documentType: transactionDocumentTypeSchema,
});

export const itemPricingPolicyQuerySchema = z.object({
  customerId: z.string().uuid().optional(),
  policy: pricingPolicySchema.optional(),
  warehouseId: z.string().uuid().optional(),
});

export type TransactionDocumentType = z.infer<typeof transactionDocumentTypeSchema>;
export type UpdateTransactionSettingsInput = z.infer<typeof updateTransactionSettingsSchema>;
export type PricingPolicy = z.infer<typeof pricingPolicySchema>;
