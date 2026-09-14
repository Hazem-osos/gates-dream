import { z } from 'zod';

const accountIdSchema = z.string().uuid().nullable().optional();
const nullableString = z.string().nullable().optional();

export const accountingSettingsGeneralSchema = z.object({
  fiscalYearStart: z.string().optional().nullable(),
  fiscalYearEnd: z.string().optional().nullable(),
  defaultCurrency: z.string().optional().nullable(),
  journalEntryDigits: z.number().int().positive().max(10).optional(),
  decimalsInAmounts: z.number().int().min(0).max(6).optional(),
  accountsGuideDigits: z.number().int().min(0).max(10).optional().nullable(),
  costCentersGuideDigits: z.number().int().min(0).max(10).optional().nullable(),
  storesGuideDigits: z.number().int().min(0).max(10).optional().nullable(),
  itemsGuideDigits: z.number().int().min(0).max(10).optional().nullable(),
  dateUsage: z.enum(['gregorian', 'hijri', 'both']).optional().nullable(),
  operationsFromDate: z.string().optional().nullable(),
  dueSecuritiesWarningDays: z.number().int().nonnegative().optional().nullable(),
  lockPostingBeforeDate: z.string().optional().nullable(),
  autoNumbering: z.boolean().optional(),
  coaAutoNumbering: z.boolean().optional(),
  costMethod: z.enum(['average']).optional().nullable(),
  pricingCalculationBasis: z.enum(['SELECTED_UNIT_QTY', 'BASE_UNIT_QTY']).optional(),
  backupPath: z.string().optional().nullable(),
  theme: z.enum(['light', 'dark']).optional().nullable(),
  temporaryReceipts: z.boolean().optional(),
  documentaryCredits: z.boolean().optional(),
  executiveWhatsAppPhone: z.string().max(30).optional().nullable(),
  autoPostGl: z.boolean().optional(),
  retainedEarningsAccountId: accountIdSchema,
});

export const accountingSettingsControlsSchema = z.object({
  enableApprovalsWorkflow: z.boolean().optional(),
  allowNegativeBalance: z.boolean().optional(),
  preventNegativeStock: z.boolean().optional(),
  preventCashOverdraft: z.boolean().optional(),
  noSellBelowCost: z.boolean().optional(),
  preventSellingBelowCost: z.boolean().optional(),
  requireCostCenterForExpenses: z.boolean().optional(),
  enforceCostCenterForPnl: z.boolean().optional(),
  allowCostCenterWithoutAccount: z.boolean().optional(),
  defaultPaymentTermsDays: z.number().int().nonnegative().nullable().optional(),
  budgetAllowExceed: z.boolean().optional(),
  budgetWarnHalf: z.boolean().optional(),
  budgetWarnSame: z.boolean().optional(),
  budgetWarnExceed: z.boolean().optional(),
  budgetStopMessageOnly: z.boolean().optional(),
  budgetStopLedger: z.boolean().optional(),
  budgetStopOrigin: z.boolean().optional(),
  budgetStopBoth: z.boolean().optional(),
});

export const accountingSettingsTaxSchema = z.object({
  defaultVatRate: z.number().min(0).max(1).optional(),
  whtRate: z.number().min(0).max(1).optional(),
  whtThreshold: z.number().nonnegative().nullable().optional(),
  applyWithholding: z.boolean().optional(),
  salesTaxAccountId: accountIdSchema,
  vatInputAccountId: accountIdSchema,
  whtPayableAccountId: accountIdSchema,
  whtReceivableAccountId: accountIdSchema,
});

export const accountingSettingsAccountsSchema = z.object({
  salesAccountId: accountIdSchema,
  salesReturnAccountId: accountIdSchema,
  cogsAccountId: accountIdSchema,
  inventoryAccountId: accountIdSchema,
  purchaseAccountId: accountIdSchema,
  purchaseReturnAccountId: accountIdSchema,
  salesDiscountAccountId: accountIdSchema,
  purchaseDiscountAccountId: accountIdSchema,
  cashDiscountAllowedAccountId: accountIdSchema,
  cashDiscountReceivedAccountId: accountIdSchema,
  arAccountId: accountIdSchema,
  apAccountId: accountIdSchema,
  cashAccountId: accountIdSchema,
  bankAccountId: accountIdSchema,
  chequesUnderCollectionAccountId: accountIdSchema,
  chequesPayableAccountId: accountIdSchema,
  returnedChequesAccountId: accountIdSchema,
  customerAdvanceAccountId: accountIdSchema,
  supplierAdvanceAccountId: accountIdSchema,
  fxGainAccountId: accountIdSchema,
  fxLossAccountId: accountIdSchema,
  exchangeGainLossAccountId: accountIdSchema,
  roundingDifferenceAccountId: accountIdSchema,
  stocktakingSurplusAccountId: accountIdSchema,
  stocktakingDeficitAccountId: accountIdSchema,
  assemblyExtraCostAccountId: accountIdSchema,
  openingInventoryAccountId: accountIdSchema,
  closingInventoryAccountId: accountIdSchema,
  giftsAccountId: accountIdSchema,
  transferAccountId: accountIdSchema,
});

export const accountingSettingsContractingSchema = z.object({
  contractingRevenueAccountCode: nullableString,
  projectExpenseAccountCode: nullableString,
  clientReceivableAccountCode: nullableString,
  subcontractorPayableAccountCode: nullableString,
  customerAdvanceAccountCode: nullableString,
  subcontractorAdvanceAccountCode: nullableString,
  retentionHeldByOthersAccountCode: nullableString,
  retentionWithheldForOthersAccountCode: nullableString,
  penaltiesExpenseAccountCode: nullableString,
  outputVatAccountCode: nullableString,
  inputVatAccountCode: nullableString,
  whtAssetAccountCode: nullableString,
  whtPayableAccountCode: nullableString,
  defaultVatRate: z.number().min(0).max(1).optional(),
  defaultWhtRate: z.number().min(0).max(1).optional(),
});

export const accountingSettingsStatementLayoutsSchema = z.object({
  incomeStatementSettings: z.unknown().nullable().optional(),
  financialPositionSettings: z.unknown().nullable().optional(),
});

export const updateAccountingSettingsSchema = z
  .object({
    general: accountingSettingsGeneralSchema.optional(),
    controls: accountingSettingsControlsSchema.optional(),
    tax: accountingSettingsTaxSchema.optional(),
    accounts: accountingSettingsAccountsSchema.optional(),
    contracting: accountingSettingsContractingSchema.optional(),
    statementLayouts: accountingSettingsStatementLayoutsSchema.optional(),
  })
  .refine((body) => Object.keys(body).length > 0, {
    message: 'At least one settings section is required',
  });

export type UpdateAccountingSettingsInput = z.infer<typeof updateAccountingSettingsSchema>;
