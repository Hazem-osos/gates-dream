import { z } from 'zod';

const decimalMessage = (field: string) => `${field} must be a valid non-negative number`;
const rateMessage = (field: string) => `${field} must be a decimal rate between 0 and 1 (e.g. 0.01 for 1%)`;

const decimalField = (field: string, opts: { min?: number; max?: number } = {}) =>
  z
    .union([z.string(), z.number()])
    .refine((value) => {
      const n = Number(value);
      if (!Number.isFinite(n)) return false;
      if (opts.min != null && n < opts.min) return false;
      if (opts.max != null && n > opts.max) return false;
      return true;
    }, { message: opts.max != null ? rateMessage(field) : decimalMessage(field) });

const rateField = (field: string) => decimalField(field, { min: 0, max: 1 });
const moneyField = (field: string) => decimalField(field, { min: 0 });
const isoDate = (field: string) =>
  z.coerce.date({ required_error: `${field} is required`, invalid_type_error: `${field} must be a valid date` });

export const idParamSchema = z.object({
  id: z.string().min(1, { message: 'id is required' }),
});

export const invoiceParamsSchema = z.object({
  id: z.string().min(1, { message: 'Subcontract id is required' }),
  invoiceId: z.string().min(1, { message: 'Invoice id is required' }),
});

export const createSubcontractSchema = z.object({
  subcontractorId: z.string().min(1, { message: 'Contractor ID (subcontractorId) is required' }),
  projectId: z.string().min(1, { message: 'Project ID is required' }),
  subcontractNumber: z.string().min(1, { message: 'Subcontract number is required' }).optional(),
  contractDate: isoDate('Contract date'),
  totalContractValue: moneyField('Contract value'),
  advancePaymentTotal: moneyField('Advance payment total').optional(),
  advancePaymentRecoveryRate: rateField('Advance recovery %').optional(),
  retentionRate: rateField('Retention %').optional(),
  taxWithholdingRate: rateField('WHT %').optional(),
  socialInsuranceRate: rateField('Social insurance %').optional(),
  standardScrapToleranceRate: rateField('Scrap tolerance %').optional(),
  contractAdminOverheadRate: rateField('Admin overhead %').optional(),
  earlyPaymentDiscountRate: rateField('Early payment discount %').optional(),
  maxAllowedVariationOrderRate: rateField('Variation order %').optional(),
  notes: z.string().optional(),
});

export const createBoqItemSchema = z.object({
  itemCode: z.string().min(1, { message: 'BOQ item code is required' }),
  descriptionAr: z.string().min(1, { message: 'Arabic description is required' }),
  descriptionEn: z.string().optional(),
  unit: z.string().min(1, { message: 'Unit of measure is required' }),
  contractQuantity: moneyField('Contract quantity'),
  unitPrice: moneyField('Unit price'),
  maxAllowedQuantity: moneyField('Max allowed quantity').optional(),
});

export const bulkUpsertBoqSchema = z.object({
  items: z.array(createBoqItemSchema).min(1, { message: 'At least one BOQ item is required' }),
});

export const calculateDraftInvoiceSchema = z.object({
  invoiceId: z.string().optional(),
  invoiceNumber: z.string().optional(),
  periodStartDate: isoDate('Invoice period start'),
  periodEndDate: isoDate('Invoice period end'),
  type: z.enum(['INTERIM_RUNNING', 'FINAL_SETTLEMENT']).optional(),
  items: z
    .array(
      z.object({
        boqItemId: z.string().min(1, { message: 'boqItemId is required' }).optional(),
        subcontractBOQItemId: z.string().min(1).optional(),
        currentQuantity: moneyField('Current quantity'),
      }).refine((row) => Boolean(row.boqItemId || row.subcontractBOQItemId), {
        message: 'Each line must include boqItemId',
      })
    )
    .min(1, { message: 'Invoice must include at least one BOQ line' }),
  applyEarlyPaymentDiscount: z.boolean({ invalid_type_error: 'applyEarlyPaymentDiscount must be a boolean' }).optional(),
  notes: z.string().optional(),
}).refine((data) => data.periodEndDate >= data.periodStartDate, {
  message: 'Invoice period end must be on or after period start',
  path: ['periodEndDate'],
});

export const submitInvoiceSchema = z.object({
  notes: z.string().optional(),
});

export const createSitePenaltySchema = z.object({
  penaltyType: z.enum(
    ['DELAY_PENALTY', 'NCR_QUALITY_DEFECT', 'HSE_SAFETY_VIOLATION', 'MANPOWER_SHORTAGE', 'EQUIPMENT_DEMURRAGE'],
    { required_error: 'Penalty type is required', invalid_type_error: 'Invalid penalty type' }
  ),
  amount: moneyField('Penalty amount'),
  incidentDate: isoDate('Incident date'),
  description: z.string().min(1, { message: 'Penalty description is required' }),
  consultantReportRef: z.string().min(1, { message: 'Consultant report reference is required' }).optional(),
  approveForDeduction: z.boolean().optional(),
});

export const createMaterialReconciliationSchema = z.object({
  materialId: z.string().min(1, { message: 'Material ID is required' }),
  warehouseIssueSlipNumber: z.string().min(1, { message: 'Issue slip number is required' }).optional(),
  standardEngineeredQty: moneyField('Engineered quota'),
  actualIssuedQty: moneyField('Actual issued quantity'),
  marketPricePerUnit: moneyField('Unit market price'),
});

export const createSubcontractorSchema = z.object({
  nameAr: z.string().min(1, { message: 'Arabic name is required' }),
  nameEn: z.string().optional(),
  taxRegistrationNumber: z.string().optional(),
  commercialRegister: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
});

export const taxForm41QuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100, { message: 'year must be a valid calendar year' }),
  quarter: z.coerce.number().int().min(1).max(4, { message: 'quarter must be 1, 2, 3, or 4' }),
  format: z.enum(['CSV', 'EXCEL'], { invalid_type_error: 'format must be CSV or EXCEL' }).default('CSV'),
});

export const taxForm41PreviewQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100, { message: 'year must be a valid calendar year' }),
  quarter: z.coerce.number().int().min(1).max(4, { message: 'quarter must be 1, 2, 3, or 4' }),
});

export const debitNoteQuerySchema = z.object({
  penaltyId: z.string().optional(),
  materialLogId: z.string().optional(),
}).refine((data) => Boolean(data.penaltyId || data.materialLogId), {
  message: 'Provide penaltyId or materialLogId',
});

export type CreateSubcontractorInput = z.infer<typeof createSubcontractorSchema>;
export type CreateSubcontractInput = z.infer<typeof createSubcontractSchema>;
export type BulkUpsertBoqInput = z.infer<typeof bulkUpsertBoqSchema>;
export type CalculateDraftInvoiceInput = z.infer<typeof calculateDraftInvoiceSchema>;
export type CreateSitePenaltyInput = z.infer<typeof createSitePenaltySchema>;
export type CreateMaterialReconciliationInput = z.infer<typeof createMaterialReconciliationSchema>;
