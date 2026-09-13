/** Facade field → `CompanySettings.accountDefinitions` alias keys (first is canonical). */
export const ACCOUNT_SLOT_ALIASES = {
  salesAccountId: ['salesAccount', 'salesRevenueAccount', 'revenueAccount', 'defaultSalesAccountId'],
  salesReturnAccountId: ['salesReturnAccount', 'defaultSalesReturnAccountId'],
  cogsAccountId: ['cogsAccount', 'costOfSalesAccount', 'salesCostAccount', 'defaultCogsAccountId'],
  inventoryAccountId: ['inventoryAccount', 'stockAccount', 'storeAccount', 'defaultInventoryAccountId'],
  purchaseAccountId: ['purchaseAccount', 'purchasesAccount'],
  purchaseReturnAccountId: ['purchaseReturnAccount', 'purchasesReturnAccount'],
  salesDiscountAccountId: ['salesDiscountAccount', 'discountAccount'],
  purchaseDiscountAccountId: ['purchaseDiscountAccount'],
  cashDiscountAllowedAccountId: ['cashDiscountAllowedAccount'],
  cashDiscountReceivedAccountId: ['cashDiscountReceivedAccount'],
  arAccountId: ['arAccount', 'customerAccount', 'salesDebtorAccount', 'defaultArAccountId'],
  apAccountId: ['apAccount', 'supplierAccount', 'purchaseCreditorAccount', 'defaultApAccountId'],
  cashAccountId: ['cashAccount', 'defaultCashAccount', 'cashBoxAccount'],
  bankAccountId: ['bankAccount', 'defaultBankAccount', 'bankGlAccount'],
  chequesUnderCollectionAccountId: [
    'chequesUnderCollectionAccount',
    'chequesInBankAccount',
    'chequesForCollectionAccount',
    'defaultUnderCollectionChequeAccountId',
  ],
  chequesPayableAccountId: ['chequesPayableAccount', 'notesPayableAccount', 'issuedChequesAccount'],
  returnedChequesAccountId: ['returnedChequesAccount', 'bouncedChequesAccount'],
  customerAdvanceAccountId: [
    'customerAdvanceAccount',
    'advanceFromCustomersAccount',
    'unappliedReceiptsAccount',
  ],
  supplierAdvanceAccountId: ['supplierAdvanceAccount', 'advanceToSuppliersAccount'],
  fxGainAccountId: ['fxGainAccount', 'foreignExchangeGainAccount'],
  fxLossAccountId: ['fxLossAccount', 'foreignExchangeLossAccount'],
  exchangeGainLossAccountId: ['exchangeGainLossAccount'],
  roundingDifferenceAccountId: ['roundingDifferenceAccount', 'roundingAccount'],
  stocktakingSurplusAccountId: ['stocktakingSurplusAccount'],
  stocktakingDeficitAccountId: ['stocktakingDeficitAccount', 'itemLossAccount', 'inventoryAdjustmentAccount'],
  assemblyExtraCostAccountId: ['assemblyExtraCostAccount'],
  openingInventoryAccountId: ['openingInventoryAccount'],
  closingInventoryAccountId: ['closingInventoryAccount'],
  giftsAccountId: ['giftsAccount'],
  transferAccountId: ['transferAccount'],
} as const;

export const TAX_ACCOUNT_SLOT_ALIASES = {
  salesTaxAccountId: ['salesTaxAccount', 'vatOutputAccount', 'defaultVatAccountId'],
  vatInputAccountId: ['vatInputAccount', 'purchaseTaxAccount'],
  whtPayableAccountId: ['whtPayableAccount', 'withholdingTaxAccount', 'daribaManbaAccount'],
  whtReceivableAccountId: [
    'whtReceivableAccount',
    'withholdingTaxReceivableAccount',
    'daribaManbaAccountDebit',
  ],
} as const;

export type AccountSlotKey = keyof typeof ACCOUNT_SLOT_ALIASES;
export type TaxAccountSlotKey = keyof typeof TAX_ACCOUNT_SLOT_ALIASES;
export type AccountDefs = Record<string, string | undefined>;

export type AccountRef = {
  id: string;
  code: string;
  arabicName: string;
};

export function pickAccountDef(defs: AccountDefs, keys: readonly string[]): string | null {
  for (const key of keys) {
    const value = defs[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

export function applyAccountSlot(
  defs: AccountDefs,
  aliases: readonly string[],
  accountId: string | null | undefined
): void {
  if (accountId === undefined) return;
  if (accountId === null || accountId === '') {
    for (const alias of aliases) delete defs[alias];
    return;
  }
  for (const alias of aliases) defs[alias] = accountId;
}

export function overlayColumnAccountIds(
  defs: AccountDefs,
  columns: {
    roundingAccountId?: string | null;
    exchangeGainLossAccountId?: string | null;
    retainedEarningsAccountId?: string | null;
  }
): AccountDefs {
  const next: AccountDefs = { ...defs };
  if (columns.roundingAccountId) {
    next.roundingDifferenceAccount ??= columns.roundingAccountId;
    next.roundingAccount ??= columns.roundingAccountId;
  }
  if (columns.exchangeGainLossAccountId) {
    next.exchangeGainLossAccount ??= columns.exchangeGainLossAccountId;
    next.fxGainAccount ??= columns.exchangeGainLossAccountId;
    next.fxLossAccount ??= columns.exchangeGainLossAccountId;
  }
  if (columns.retainedEarningsAccountId) {
    next.retainedEarningsAccount ??= columns.retainedEarningsAccountId;
    next.defaultRetainedEarningsAccountId ??= columns.retainedEarningsAccountId;
  }
  return next;
}

export function collectFacadeAccountIds(
  defs: AccountDefs,
  columns: {
    roundingAccountId?: string | null;
    exchangeGainLossAccountId?: string | null;
    retainedEarningsAccountId?: string | null;
  }
): Record<AccountSlotKey, string | null> {
  const overlaid = overlayColumnAccountIds(defs, columns);
  const result = {} as Record<AccountSlotKey, string | null>;
  for (const [key, aliases] of Object.entries(ACCOUNT_SLOT_ALIASES) as Array<
    [AccountSlotKey, readonly string[]]
  >) {
    result[key] = pickAccountDef(overlaid, aliases);
  }
  if (columns.roundingAccountId) {
    result.roundingDifferenceAccountId = columns.roundingAccountId;
  }
  if (columns.exchangeGainLossAccountId) {
    result.exchangeGainLossAccountId = columns.exchangeGainLossAccountId;
  }
  return result;
}

export function collectTaxAccountIds(defs: AccountDefs): Record<TaxAccountSlotKey, string | null> {
  const result = {} as Record<TaxAccountSlotKey, string | null>;
  for (const [key, aliases] of Object.entries(TAX_ACCOUNT_SLOT_ALIASES) as Array<
    [TaxAccountSlotKey, readonly string[]]
  >) {
    result[key] = pickAccountDef(defs, aliases);
  }
  return result;
}
