/** Standard GL codes provisioned for every tenant (Egyptian COA template). */
export const SYSTEM_GL_CODES = {
  cashMain: '1111',
  bankDefault: '1112',
  ar: '1121',
  chequesInHand: '1131',
  chequesUnderCollection: '1132',
  inventory: '1141',
  whtReceivable: '1151',
  vatInput: '1152',
  fixedAssets: '1210',
  ap: '2111',
  notesPayable: '2121',
  vatOutput: '2131',
  whtPayable: '2132',
  customerAdvance: '2141',
  capital: '311',
  retainedEarnings: '321',
  salesRevenue: '411',
  salesDiscount: '412',
  salesReturn: '413',
  cogs: '511',
  subcontractorCost: '512',
  payroll: '521',
  rent: '522',
  utilities: '523',
  bankFees: '524',
  contractRevenue: '415',
  retentionReceivable: '1181',
  retentionPayable: '2181',
  subcontractorAdvance: '1191',
  contractPenalty: '513',
  /** Wave 2 fix: realized FX gain/loss on foreign-currency settlements. */
  fxGain: '416',
  fxLoss: '525',
  /** Legacy parity (foundation-account-slots): SolafAccount / OhdaAccount. */
  employeeLoans: '1161',
  /** Legacy parity: EhlakAccount (depreciation). */
  depreciation: '526',
  /** Legacy parity: ItemLossAccount. */
  itemLoss: '527',
  /** Legacy parity: MarketingExpensesAccount. */
  marketingExpenses: '528',
} as const;

export type SystemGlCodeKey = keyof typeof SYSTEM_GL_CODES;

/** Required on every tenant after seed (non-industry-specific). */
export const CORE_SYSTEM_GL_CODES = {
  cashMain: SYSTEM_GL_CODES.cashMain,
  bankDefault: SYSTEM_GL_CODES.bankDefault,
  ar: SYSTEM_GL_CODES.ar,
  chequesInHand: SYSTEM_GL_CODES.chequesInHand,
  chequesUnderCollection: SYSTEM_GL_CODES.chequesUnderCollection,
  inventory: SYSTEM_GL_CODES.inventory,
  whtReceivable: SYSTEM_GL_CODES.whtReceivable,
  vatInput: SYSTEM_GL_CODES.vatInput,
  fixedAssets: SYSTEM_GL_CODES.fixedAssets,
  ap: SYSTEM_GL_CODES.ap,
  notesPayable: SYSTEM_GL_CODES.notesPayable,
  vatOutput: SYSTEM_GL_CODES.vatOutput,
  whtPayable: SYSTEM_GL_CODES.whtPayable,
  customerAdvance: SYSTEM_GL_CODES.customerAdvance,
  capital: SYSTEM_GL_CODES.capital,
  retainedEarnings: SYSTEM_GL_CODES.retainedEarnings,
  salesRevenue: SYSTEM_GL_CODES.salesRevenue,
  salesDiscount: SYSTEM_GL_CODES.salesDiscount,
  salesReturn: SYSTEM_GL_CODES.salesReturn,
  cogs: SYSTEM_GL_CODES.cogs,
  subcontractorCost: SYSTEM_GL_CODES.subcontractorCost,
  payroll: SYSTEM_GL_CODES.payroll,
  rent: SYSTEM_GL_CODES.rent,
  utilities: SYSTEM_GL_CODES.utilities,
  bankFees: SYSTEM_GL_CODES.bankFees,
  fxGain: SYSTEM_GL_CODES.fxGain,
  fxLoss: SYSTEM_GL_CODES.fxLoss,
} as const;

export function buildAccountDefinitions(codeToId: Map<string, string>): Record<string, string> {
  const id = (code: string): string => {
    const v = codeToId.get(code);
    if (!v) throw new Error(`Standard account code ${code} is missing after COA seed`);
    return v;
  };

  const ar = id(SYSTEM_GL_CODES.ar);
  const ap = id(SYSTEM_GL_CODES.ap);
  const inventory = id(SYSTEM_GL_CODES.inventory);
  const sales = id(SYSTEM_GL_CODES.salesRevenue);
  const cogs = id(SYSTEM_GL_CODES.cogs);
  const salesReturn = id(SYSTEM_GL_CODES.salesReturn);
  const retained = id(SYSTEM_GL_CODES.retainedEarnings);
  const vatOut = id(SYSTEM_GL_CODES.vatOutput);
  const vatIn = id(SYSTEM_GL_CODES.vatInput);
  const cash = id(SYSTEM_GL_CODES.cashMain);
  const bank = id(SYSTEM_GL_CODES.bankDefault);
  const chequesCollection = id(SYSTEM_GL_CODES.chequesUnderCollection);
  const chequesHand = id(SYSTEM_GL_CODES.chequesInHand);
  const notesPayable = id(SYSTEM_GL_CODES.notesPayable);
  const customerAdvance = id(SYSTEM_GL_CODES.customerAdvance);
  const salesDiscount = id(SYSTEM_GL_CODES.salesDiscount);
  const fxGain = id(SYSTEM_GL_CODES.fxGain);
  const fxLoss = id(SYSTEM_GL_CODES.fxLoss);
  const fixedAssets = id(SYSTEM_GL_CODES.fixedAssets);
  const whtPayable = id(SYSTEM_GL_CODES.whtPayable);
  const whtReceivable = id(SYSTEM_GL_CODES.whtReceivable);
  const employeeLoans = id(SYSTEM_GL_CODES.employeeLoans);
  const depreciation = id(SYSTEM_GL_CODES.depreciation);
  const itemLoss = id(SYSTEM_GL_CODES.itemLoss);
  const marketingExpenses = id(SYSTEM_GL_CODES.marketingExpenses);

  return {
    defaultArAccountId: ar,
    defaultApAccountId: ap,
    defaultSalesAccountId: sales,
    defaultSalesReturnAccountId: salesReturn,
    defaultCogsAccountId: cogs,
    defaultInventoryAccountId: inventory,
    defaultRetainedEarningsAccountId: retained,
    defaultVatAccountId: vatOut,
    defaultUnderCollectionChequeAccountId: chequesCollection,

    arAccount: ar,
    customerAccount: ar,
    salesDebtorAccount: ar,
    apAccount: ap,
    supplierAccount: ap,
    purchaseCreditorAccount: ap,
    inventoryAccount: inventory,
    stockAccount: inventory,
    storeAccount: inventory,
    salesRevenueAccount: sales,
    salesAccount: sales,
    revenueAccount: sales,
    salesReturnAccount: salesReturn,
    /** M7 fix: sales discounts (line + header) now post here as a visible
     * contra-revenue debit instead of being netted silently into revenue. */
    salesDiscountAccount: salesDiscount,
    discountAccount: salesDiscount,
    purchaseAccount: inventory,
    purchasesAccount: inventory,
    purchaseReturnAccount: inventory,
    returnedChequesAccount: chequesHand,
    bouncedChequesAccount: chequesHand,
    exchangeGainLossAccount: fxLoss,
    cogsAccount: cogs,
    costOfSalesAccount: cogs,
    salesCostAccount: cogs,
    vatOutputAccount: vatOut,
    salesTaxAccount: vatOut,
    vatInputAccount: vatIn,
    purchaseTaxAccount: vatIn,

    // Withholding tax. The legacy-parity aliases below (`daribaManbaAccount` /
    // `daribaManbaAccountDebit`) were seeded but never read: the invoice
    // resolver looks for these names instead, so a freshly provisioned tenant
    // hit "Purchase withholding tax requires withholdingTaxAccount in company
    // account definitions" until someone hand-edited the JSON.
    withholdingTaxAccount: whtPayable,
    whtPayableAccount: whtPayable,
    whtReceivableAccount: whtReceivable,
    withholdingTaxReceivableAccount: whtReceivable,

    // Stock GL legs. `resolveStockGlAccounts` requires both of these and 422s
    // when either is missing, but neither was seeded — every goods issue and
    // every inventory adjustment failed to post on a new tenant.
    stockIssueExpenseAccount: cogs,
    operatingExpenseAccount: cogs,
    inventoryAdjustmentAccount: itemLoss,
    stockAdjustmentAccount: itemLoss,
    stockSettlementAccount: itemLoss,
    cashAccount: cash,
    defaultCashAccount: cash,
    cashBoxAccount: cash,
    bankAccount: bank,
    defaultBankAccount: bank,
    bankGlAccount: bank,
    chequesUnderCollectionAccount: chequesCollection,
    chequesInBankAccount: chequesCollection,
    chequesForCollectionAccount: chequesCollection,
    chequesUnderHandAccount: chequesHand,
    chequesInPortfolioAccount: chequesHand,
    receivedChequesAccount: chequesHand,
    notesPayableAccount: notesPayable,
    issuedChequesAccount: notesPayable,
    chequesPayableAccount: notesPayable,
    retainedEarningsAccount: retained,

    customerAdvanceAccount: customerAdvance,
    advanceFromCustomersAccount: customerAdvance,
    unappliedReceiptsAccount: customerAdvance,

    fxGainAccount: fxGain,
    foreignExchangeGainAccount: fxGain,
    fxLossAccount: fxLoss,
    foreignExchangeLossAccount: fxLoss,

    // --- Legacy parity (foundation-account-slots): mirror the exact
    // untcompanyvariables.pas CompanySetting key names as aliases so the
    // reconciliation in docs/parity is 1:1 and greppable. See
    // gates-backend/src/modules/accounting/data/legacy-account-slots.ts for
    // the full 30-key catalog and which slots are "direct posting account"
    // vs "legacy COA-tree scope filter" (deferred to the owning wave).
    boxesAccount: cash,
    banksAccount: bank,
    customersAccount: ar,
    suppliersAccount: ap,
    fixedAssetsAccount: fixedAssets,
    daribaManbaAccount: whtPayable,
    daribaManbaAccountDebit: whtReceivable,
    profitAccount: retained,
    solafAccount: employeeLoans,
    ohdaAccount: employeeLoans,
    ehlakAccount: depreciation,
    itemLossAccount: itemLoss,
    offerAccount: salesDiscount,
    marketingExpensesAccount: marketingExpenses,
  };
}

/** Public shape for form defaults API. */
export function glDefaultsForForms(codeToId: Map<string, string>) {
  const pick = (code: string) => codeToId.get(code) ?? null;
  return {
    inventoryAccountId: pick(SYSTEM_GL_CODES.inventory),
    salesAccountId: pick(SYSTEM_GL_CODES.salesRevenue),
    cogsAccountId: pick(SYSTEM_GL_CODES.cogs),
    arAccountId: pick(SYSTEM_GL_CODES.ar),
    apAccountId: pick(SYSTEM_GL_CODES.ap),
    cashAccountId: pick(SYSTEM_GL_CODES.cashMain),
    bankAccountId: pick(SYSTEM_GL_CODES.bankDefault),
    salesReturnAccountId: pick(SYSTEM_GL_CODES.salesReturn),
    vatAccountId: pick(SYSTEM_GL_CODES.vatOutput),
    retainedEarningsAccountId: pick(SYSTEM_GL_CODES.retainedEarnings),
    underCollectionChequeAccountId: pick(SYSTEM_GL_CODES.chequesUnderCollection),
    purchaseAccountId: pick(SYSTEM_GL_CODES.inventory),
    returnedChequesAccountId: pick(SYSTEM_GL_CODES.chequesInHand),
  };
}
