import { z } from 'zod';

export const companySettingsSchema = z.object({
  // General settings
  fiscalYearStart: z.string().optional(),
  fiscalYearEnd: z.string().optional(),
  defaultCurrency: z.string().optional(),
  journalEntryDigits: z.number().int().positive().max(10).optional(),
  allowNegativeBalance: z.boolean().optional(),
  allowCostCenterWithoutAccount: z.boolean().optional(),
  lockPostingBeforeDate: z.string().optional(),
  enableApprovalsWorkflow: z.boolean().optional(),
  autoNumbering: z.boolean().optional(),
  decimalsInAmounts: z.number().int().min(0).max(6).optional(),
  // Guide digits
  accountsGuideDigits: z.number().int().min(0).max(10).optional(),
  costCentersGuideDigits: z.number().int().min(0).max(10).optional(),
  storesGuideDigits: z.number().int().min(0).max(10).optional(),
  itemsGuideDigits: z.number().int().min(0).max(10).optional(),
  // Date settings
  dateUsage: z.enum(['gregorian', 'hijri', 'both']).optional(),
  operationsFromDate: z.string().optional(),
  // Securities
  dueSecuritiesWarningDays: z.number().int().nonnegative().optional(),
  // Budget settings
  budgetAllowExceed: z.boolean().optional(),
  budgetWarnHalf: z.boolean().optional(),
  budgetWarnSame: z.boolean().optional(),
  budgetWarnExceed: z.boolean().optional(),
  budgetStopMessageOnly: z.boolean().optional(),
  budgetStopLedger: z.boolean().optional(),
  budgetStopOrigin: z.boolean().optional(),
  budgetStopBoth: z.boolean().optional(),
  // System settings
  backupPath: z.string().optional(),
  // C8 fix: 'fifo' and 'lifo' are not implemented anywhere in the costing
  // engine (item-cost.service.ts only computes a moving average) — letting
  // a tenant "choose" them silently lied about how COGS/inventory value is
  // actually computed. Only 'average' is accepted until layer-based costing
  // ships.
  costMethod: z.enum(['average', 'fifo', 'lifo']).optional(),
  theme: z.enum(['light', 'dark']).optional(),
  temporaryReceipts: z.boolean().optional(),
  documentaryCredits: z.boolean().optional(),
  pricingCalculationBasis: z.enum(['SELECTED_UNIT_QTY', 'BASE_UNIT_QTY']).optional(),
  // Advanced settings (flexible JSON)
  advancedSettings: z.record(z.any()).optional(),
  executiveWhatsAppPhone: z.string().max(30).optional().nullable(),
  // Account definitions (flexible JSON)
  accountDefinitions: z.record(z.any()).optional(),
  autoPostGl: z.boolean().optional(),
  retainedEarningsAccountId: z.string().uuid().nullable().optional(),
  preventNegativeStock: z.boolean().optional(),
  preventCashOverdraft: z.boolean().optional(),
  enforceCostCenterForPnl: z.boolean().optional(),
  preventSellingBelowCost: z.boolean().optional(),
  roundingAccountId: z.string().uuid().nullable().optional(),
  exchangeGainLossAccountId: z.string().uuid().nullable().optional(),
}).refine(
  (data) => data.costMethod === undefined || data.costMethod === 'average',
  {
    // C8 fix: the costing engine (item-cost.service.ts) only ever computes
    // a moving average — 'fifo'/'lifo' were accepted by the API and shown
    // in the UI but silently had zero effect on COGS or inventory value.
    // Reject them explicitly instead of lying to the tenant.
    message: 'FIFO/LIFO costing is not implemented — only "average" cost method is supported',
    path: ['costMethod'],
  }
);

export type CompanySettingsInput = z.infer<typeof companySettingsSchema>;

