import { z } from 'zod';

const decimalMessage = (field: string) => `${field} must be a valid non-negative number`;
const rateMessage = (field: string) =>
  `${field} must be a decimal rate between 0 and 1 (e.g. 0.05 for 5%)`;

const decimalField = (field: string, opts: { min?: number; max?: number } = {}) =>
  z.union([z.string(), z.number()]).refine(
    (value) => {
      const n = Number(value);
      if (!Number.isFinite(n)) return false;
      if (opts.min != null && n < opts.min) return false;
      if (opts.max != null && n > opts.max) return false;
      return true;
    },
    { message: opts.max != null ? rateMessage(field) : decimalMessage(field) }
  );

const rateField = (field: string) => decimalField(field, { min: 0, max: 1 });
const moneyField = (field: string) => decimalField(field, { min: 0 });
const isoDate = (field: string) =>
  z.coerce.date({
    required_error: `${field} is required`,
    invalid_type_error: `${field} must be a valid date`,
  });

export const COST_ELEMENT_TYPES = [
  'MATERIAL',
  'LABOR',
  'EQUIPMENT',
  'SUBCONTRACTOR',
  'SITE_EXPENSE',
] as const;

export const PROJECT_LG_TYPES = [
  'BID_BOND_INITIAL',
  'ADVANCE_PAYMENT_BOND',
  'PERFORMANCE_BOND_FINAL',
  'RETENTION_RELEASE_BOND',
] as const;

export const idParamSchema = z.object({
  id: z.string().min(1, { message: 'id is required' }),
});

export const projectIdParamSchema = z.object({
  projectId: z.string().min(1, { message: 'projectId is required' }),
});

export const notesOnlySchema = z
  .object({
    notes: z.string().optional(),
  })
  .optional()
  .default({});

export const evmQuerySchema = z.object({
  asOfDate: isoDate('asOfDate').optional(),
});

export const rateAnalysisItemSchema = z.object({
  costElementType: z.enum(COST_ELEMENT_TYPES, {
    required_error: 'costElementType is required',
    invalid_type_error: 'costElementType must be MATERIAL, LABOR, EQUIPMENT, SUBCONTRACTOR, or SITE_EXPENSE',
  }),
  resourceCode: z.string().min(1).optional().nullable(),
  descriptionAr: z.string().min(1, { message: 'Arabic description is required' }).optional(),
  descriptionEn: z.string().optional().nullable(),
  unit: z.string().min(1, { message: 'unit is required' }).max(20, {
    message: 'unit must be 20 characters or fewer',
  }),
  consumptionQuotaPerUnit: moneyField('consumptionQuotaPerUnit'),
  unitCost: moneyField('unitCost'),
  wasteFactorRate: rateField('wasteFactorRate').optional().default(0),
  notes: z.string().optional().nullable(),
});

export const upsertRateAnalysisSchema = z.object({
  items: z
    .array(rateAnalysisItemSchema)
    .min(1, { message: 'At least one rate-analysis cost element is required' }),
});

export const markupStructureSchema = z.object({
  generalOverheadRate: rateField('generalOverheadRate'),
  siteOverheadRate: rateField('siteOverheadRate'),
  contingencyRiskRate: rateField('contingencyRiskRate'),
  profitMarginRate: rateField('profitMarginRate'),
  contractTaxesRate: rateField('contractTaxesRate'),
  applyAtProjectLevel: z
    .boolean({ invalid_type_error: 'applyAtProjectLevel must be a boolean' })
    .optional(),
});

const attachmentSchema = z.union([
  z.string().min(1),
  z.object({
    fileName: z.string().optional(),
    url: z.string().optional(),
    mimeType: z.string().optional(),
  }),
]);

export const BOQ_ITEM_UNITS = ['M2', 'M3', 'TON', 'ITEM', 'LM', 'LS'] as const;

export const createOwnerBoqItemSchema = z.object({
  itemCode: z.string().min(1, { message: 'itemCode is required' }),
  descriptionAr: z.string().min(1, { message: 'Arabic description is required' }),
  descriptionEn: z.string().optional().nullable(),
  unit: z.enum(BOQ_ITEM_UNITS, {
    required_error: 'unit is required',
    invalid_type_error: 'unit must be M2, M3, TON, ITEM, LM, or LS',
  }),
  contractQuantity: moneyField('contractQuantity'),
});

export const createMeasurementSheetSchema = z.object({
  projectBOQItemId: z.string().min(1, { message: 'projectBOQItemId is required' }),
  sheetNumber: z.string().min(1, { message: 'sheetNumber is required' }),
  measurementDate: isoDate('measurementDate'),
  locationZone: z.string().optional().nullable(),
  axisGridRef: z.string().optional().nullable(),
  statement: z.string().optional().nullable(),
  multiplierCount: moneyField('multiplierCount').optional(),
  dimensionLength: moneyField('dimensionLength').optional().nullable(),
  dimensionWidth: moneyField('dimensionWidth').optional().nullable(),
  dimensionHeight: moneyField('dimensionHeight').optional().nullable(),
  deductionQty: moneyField('deductionQty').optional(),
  attachments: z.array(attachmentSchema).optional().nullable(),
});

export const createClientContractSchema = z.object({
  projectId: z.string().min(1, { message: 'projectId is required' }),
  contractNumber: z.string().min(1, { message: 'contractNumber is required' }),
  clientCustomerId: z.string().min(1, { message: 'clientCustomerId is required' }),
  contractDate: isoDate('contractDate'),
  totalContractValue: moneyField('totalContractValue'),
  advancePaymentAmount: moneyField('advancePaymentAmount').optional(),
  advanceRecoveryRate: rateField('advanceRecoveryRate').optional(),
  retentionRate: rateField('retentionRate').optional(),
  engineeringStampsRate: rateField('engineeringStampsRate').optional(),
});

export const calculateDraftClientInvoiceSchema = z
  .object({
    invoiceId: z.string().min(1).optional(),
    invoiceNumber: z.string().min(1).optional(),
    periodStartDate: isoDate('periodStartDate'),
    periodEndDate: isoDate('periodEndDate'),
    type: z.enum(['INTERIM', 'FINAL_SETTLEMENT']).optional(),
    items: z
      .array(
        z.object({
          projectBOQItemId: z.string().min(1, { message: 'projectBOQItemId is required' }),
          currentQuantity: moneyField('currentQuantity'),
        })
      )
      .min(1, { message: 'Invoice must include at least one owner BOQ line' }),
    otherClientPenalties: moneyField('otherClientPenalties').optional(),
    claimSiteStockMaterialIds: z.array(z.string().min(1)).optional(),
    installSiteStockMaterialIds: z.array(z.string().min(1)).optional(),
    allowVariationOrder: z.boolean().optional(),
  })
  .refine((data) => data.periodEndDate >= data.periodStartDate, {
    message: 'periodEndDate must be on or after periodStartDate',
    path: ['periodEndDate'],
  });

export const postClientInvoiceSchema = z
  .object({
    installSiteStockMaterialIds: z.array(z.string().min(1)).optional(),
  })
  .optional()
  .default({});

export const createSiteStockSchema = z.object({
  projectId: z.string().min(1, { message: 'projectId is required' }).optional(),
  materialDescription: z.string().min(1, { message: 'materialDescription is required' }),
  deliveryDate: isoDate('deliveryDate'),
  warehouseReceiptRef: z.string().optional().nullable(),
  deliveredQuantity: moneyField('deliveredQuantity'),
  unitPrice: moneyField('unitPrice'),
  approvedPercentage: rateField('approvedPercentage').optional(),
});

export const issueLgSchema = z
  .object({
    projectId: z.string().min(1, { message: 'projectId is required' }),
    lgNumber: z.string().min(1, { message: 'lgNumber is required' }),
    bankAccountId: z.string().min(1, { message: 'bankAccountId is required' }),
    bankName: z.string().min(1, { message: 'bankName is required' }),
    beneficiaryName: z.string().min(1, { message: 'beneficiaryName is required' }),
    type: z.enum(PROJECT_LG_TYPES, {
      required_error: 'type is required',
      invalid_type_error:
        'type must be BID_BOND_INITIAL, ADVANCE_PAYMENT_BOND, PERFORMANCE_BOND_FINAL, or RETENTION_RELEASE_BOND',
    }),
    issuanceDate: isoDate('issuanceDate'),
    expiryDate: isoDate('expiryDate'),
    originalAmount: moneyField('originalAmount'),
    cashMarginRate: rateField('cashMarginRate'),
    issuanceCommissionAmount: moneyField('issuanceCommissionAmount').optional(),
  })
  .refine((data) => data.expiryDate > data.issuanceDate, {
    message: 'expiryDate must be after issuanceDate',
    path: ['expiryDate'],
  });

export const extendLgSchema = z.object({
  newExpiryDate: isoDate('newExpiryDate'),
  bankReferenceNo: z.string().optional(),
  extensionCommission: moneyField('extensionCommission').optional(),
  notes: z.string().optional(),
});

export const amendLgAmountSchema = z.object({
  newAmount: moneyField('newAmount'),
  bankReferenceNo: z.string().optional(),
  notes: z.string().optional(),
});

export const releaseLgSchema = z.object({
  releaseDate: isoDate('releaseDate'),
  bankReferenceNo: z.string().optional(),
  notes: z.string().optional(),
});

export const liquidateLgSchema = z.object({
  liquidationDate: isoDate('liquidationDate'),
  liquidationReason: z.string().min(1, { message: 'liquidationReason is required' }),
  notes: z.string().optional(),
});

export type CreateOwnerBoqItemInput = z.infer<typeof createOwnerBoqItemSchema>;
export type RateAnalysisItemInput = z.infer<typeof rateAnalysisItemSchema>;
export type UpsertRateAnalysisInput = z.infer<typeof upsertRateAnalysisSchema>;
export type MarkupStructureInput = z.infer<typeof markupStructureSchema>;
export type CreateMeasurementSheetInput = z.infer<typeof createMeasurementSheetSchema>;
export type CreateClientContractInput = z.infer<typeof createClientContractSchema>;
export type CalculateDraftClientInvoiceInput = z.infer<typeof calculateDraftClientInvoiceSchema>;
export type CreateSiteStockInput = z.infer<typeof createSiteStockSchema>;
export type IssueLgInput = z.infer<typeof issueLgSchema>;
export type ExtendLgInput = z.infer<typeof extendLgSchema>;
export type AmendLgAmountInput = z.infer<typeof amendLgAmountSchema>;
export type ReleaseLgInput = z.infer<typeof releaseLgSchema>;
export type LiquidateLgInput = z.infer<typeof liquidateLgSchema>;

export const excelBoqTypeQuerySchema = z.object({
  type: z.enum(['OWNER', 'SUBCONTRACTOR']).optional().default('OWNER'),
  projectId: z.string().min(1).optional(),
  subcontractId: z.string().min(1).optional(),
});

export const excelMeasurementQuerySchema = z.object({
  projectId: z.string().min(1, { message: 'projectId is required' }),
});

export const excelExportBoqQuerySchema = z.object({
  subcontractId: z.string().min(1).optional(),
});

const boqImportRowSchema = z.object({
  itemCode: z.string().min(1),
  descriptionAr: z.string().min(1),
  descriptionEn: z.string().optional().nullable(),
  unit: z.enum(BOQ_ITEM_UNITS),
  quantity: moneyField('quantity'),
  unitPrice: moneyField('unitPrice'),
  totalPrice: moneyField('totalPrice').optional(),
  notes: z.string().optional().nullable(),
});

export const commitBoqImportSchema = z.object({
  type: z.enum(['OWNER', 'SUBCONTRACTOR']),
  projectId: z.string().min(1).optional(),
  subcontractId: z.string().min(1).optional(),
  rows: z.array(boqImportRowSchema).min(1).max(5000),
});

const measurementImportRowSchema = z.object({
  itemCode: z.string().min(1),
  projectBOQItemId: z.string().min(1).optional(),
  sheetNumber: z.string().min(1),
  locationZone: z.string().optional().nullable(),
  axisGridRef: z.string().optional().nullable(),
  statement: z.string().optional().nullable(),
  multiplierCount: moneyField('multiplierCount').optional(),
  dimensionLength: moneyField('dimensionLength').optional().nullable(),
  dimensionWidth: moneyField('dimensionWidth').optional().nullable(),
  dimensionHeight: moneyField('dimensionHeight').optional().nullable(),
  calculatedGrossQty: moneyField('calculatedGrossQty').optional(),
  deductionQty: moneyField('deductionQty').optional(),
  netExecutedQty: moneyField('netExecutedQty').optional(),
  measurementDate: isoDate('measurementDate').optional(),
});

export const commitMeasurementImportSchema = z.object({
  projectId: z.string().min(1),
  rows: z.array(measurementImportRowSchema).min(1).max(5000),
  status: z.enum(['DRAFT', 'SITE_ENGINEER_VERIFIED']).optional().default('DRAFT'),
});
