/**
 * Reconciliation of the ~30 legacy `CompanySetting` GL account slots
 * (`untcompanyvariables.pas` `set_variables`, defaults 'Nothing') against the
 * web `CompanySettings.accountDefinitions` JSON aliases built by
 * `buildAccountDefinitions` (system-account-map.ts).
 *
 * Two legacy usage shapes, verified by grepping each field's consumers in
 * `MainProgram/*.pas`:
 * - `direct-posting-account` — the legacy field is used AS an account
 *   code/id directly (comparison or GL line). These now have a 1:1 web
 *   alias in `buildAccountDefinitions`.
 * - `coa-tree-scope-filter` — the legacy field only *scopes* an account
 *   picker/tree to a parent node (`FullPath Like '%\<code>\%'`), it is not
 *   itself a postable account. Web account pickers aren't COA-tree-scoped
 *   yet, so these are captured here (so the concept isn't silently lost)
 *   but deferred to the specific document-conversion wave that builds that
 *   picker (GL/treasury/contracting/tax waves — see plan "Later waves").
 *
 * Having an alias in `buildAccountDefinitions` is not the same as being *read*
 * at posting time: the posting resolvers look up their own generic key names
 * (`arAccount`, `cogsAccount`, …). Three slots that the gl-account-defaults
 * screen writes were seeded but never consulted, so configuring them through
 * the UI had no effect — `DaribaManbaAccount` and `DaribaManbaAccountDebit` are
 * now read by `invoice-account-resolver.service.ts` for withholding tax, and
 * `ItemLossAccount` by `resolveStockGlAccounts` for stock variance.
 */
export type LegacyAccountSlotUsage = 'direct-posting-account' | 'coa-tree-scope-filter';

export interface LegacyAccountSlot {
  /** Exact legacy CompanySetting key (untcompanyvariables.pas). */
  legacyKey: string;
  descriptionEn: string;
  usage: LegacyAccountSlotUsage;
  /** Web `accountDefinitions` alias key, once reconciled. Null while deferred. */
  webAlias: string | null;
  /** True for CustomersAccount — legacy also filters by BranchCode (untbranchvariables.pas). */
  branchScoped?: boolean;
  /** Where this was verified from (untcompanyvariables.pas.line for the load-time default; consumer file for usage). */
  verifiedIn: string;
}

export const LEGACY_ACCOUNT_SLOTS: LegacyAccountSlot[] = [
  { legacyKey: 'BoxesAccount', descriptionEn: 'Default cash boxes control account', usage: 'direct-posting-account', webAlias: 'boxesAccount', verifiedIn: 'untChartOfAccounts.pas (AccountCode compare)' },
  { legacyKey: 'BanksAccount', descriptionEn: 'Default banks control account', usage: 'direct-posting-account', webAlias: 'banksAccount', verifiedIn: 'untChartOfAccounts.pas (AccountCode compare)' },
  {
    legacyKey: 'CustomersAccount',
    descriptionEn: 'Default AR control account — legacy is branch-scoped (CompanySetting.BranchCode)',
    usage: 'direct-posting-account',
    webAlias: 'customersAccount',
    branchScoped: true,
    verifiedIn: 'untbranchvariables.pas:114-122 (branch-scoped read); untcompanyvariables.pas (company-wide fallback)',
  },
  { legacyKey: 'SuppliersAccount', descriptionEn: 'Default AP control account', usage: 'direct-posting-account', webAlias: 'suppliersAccount', verifiedIn: 'untcompanyvariables.pas set_variables' },
  { legacyKey: 'FixedAssetsAccount', descriptionEn: 'Default fixed assets control account', usage: 'direct-posting-account', webAlias: 'fixedAssetsAccount', verifiedIn: 'untcompanyvariables.pas set_variables' },
  { legacyKey: 'DaribaManbaAccount', descriptionEn: 'Withholding tax at source — payable (credit) side', usage: 'direct-posting-account', webAlias: 'daribaManbaAccount', verifiedIn: 'UntBP.pas / untSetting.pas' },
  { legacyKey: 'DaribaManbaAccountDebit', descriptionEn: 'Withholding tax at source — receivable (debit) side', usage: 'direct-posting-account', webAlias: 'daribaManbaAccountDebit', verifiedIn: 'untSetting.pas' },
  { legacyKey: 'ProfitAccount', descriptionEn: 'Current-year profit/retained-earnings account, excluded from manual account pickers', usage: 'direct-posting-account', webAlias: 'profitAccount', verifiedIn: 'UntBG.pas:4060, UntBP.pas:5433 (AccountCode <> ProfitAccount)' },
  { legacyKey: 'SolafAccount', descriptionEn: '"سلف" — employee loans/advances GL account', usage: 'direct-posting-account', webAlias: 'solafAccount', verifiedIn: 'UntRussianClass.pas:494,533' },
  { legacyKey: 'OhdaAccount', descriptionEn: '"عهدة" — employee custody-advance GL account (shares employeeLoans slot with SolafAccount for now)', usage: 'direct-posting-account', webAlias: 'ohdaAccount', verifiedIn: 'untSetting.pas:6307,6961' },
  { legacyKey: 'EhlakAccount', descriptionEn: '"إهلاك" — depreciation expense account', usage: 'direct-posting-account', webAlias: 'ehlakAccount', verifiedIn: 'untAAOptions.pas:792' },
  { legacyKey: 'ItemLossAccount', descriptionEn: 'Inventory shrinkage/loss expense account', usage: 'direct-posting-account', webAlias: 'itemLossAccount', verifiedIn: 'untPInovice.pas:16826' },
  { legacyKey: 'OfferAccount', descriptionEn: 'Sales offers/promotions discount account (shares salesDiscount slot)', usage: 'direct-posting-account', webAlias: 'offerAccount', verifiedIn: 'untSetting.pas:6227,7093' },
  { legacyKey: 'MarketingExpensesAccount', descriptionEn: 'Marketing commission expense account (contracting module)', usage: 'direct-posting-account', webAlias: 'marketingExpensesAccount', verifiedIn: 'UntProjectContract.pas:1879-1894' },
  { legacyKey: 'SalesTaxAccount', descriptionEn: 'Sales tax GL account (already reconciled as vatOutputAccount/salesTaxAccount)', usage: 'direct-posting-account', webAlias: 'salesTaxAccount', verifiedIn: 'UntBP.pas:783,921' },

  // --- COA-tree scope filters (legacy limits an account picker to a parent
  // node; not a single postable account). Captured for completeness, not
  // yet wired into a web picker — deferred to the owning document wave.
  { legacyKey: 'RecievesAccount', descriptionEn: 'Parent-scope filter for receipt vouchers account picker', usage: 'coa-tree-scope-filter', webAlias: null, verifiedIn: 'untChartOfAccounts.pas:1082, untSetting.pas:5713' },
  { legacyKey: 'RecievesBankAccount', descriptionEn: 'Parent-scope filter for bank/cheque receipts account picker', usage: 'coa-tree-scope-filter', webAlias: null, verifiedIn: 'untRecieveCheck.pas:5915' },
  { legacyKey: 'PaymentsAccount', descriptionEn: 'Parent-scope filter for payment vouchers account picker', usage: 'coa-tree-scope-filter', webAlias: null, verifiedIn: 'untChartOfAccounts.pas:1087, untDAOptions.pas:979' },
  { legacyKey: 'EmployeesAccount', descriptionEn: 'Parent-scope filter for employee-related account picker', usage: 'coa-tree-scope-filter', webAlias: null, verifiedIn: 'untChartOfAccounts.pas:1077, untDFOptions.pas:830' },
  { legacyKey: 'CreditsAccount', descriptionEn: 'Parent-scope filter for "credits" account picker', usage: 'coa-tree-scope-filter', webAlias: null, verifiedIn: 'untDFOptions.pas:779,829' },
  { legacyKey: 'MasrofatAccount', descriptionEn: '"مصروفات" — parent-scope filter for the general expenses account picker', usage: 'coa-tree-scope-filter', webAlias: null, verifiedIn: 'untAAOptions.pas:619,1045' },
  { legacyKey: 'TransferAccount', descriptionEn: 'Inter-branch/store transfer clearing account picker scope', usage: 'coa-tree-scope-filter', webAlias: null, verifiedIn: 'untPInovice.pas:16857, untSetting.pas:6257' },
  { legacyKey: 'PayAccount', descriptionEn: 'Parent-scope filter for Dariba Mabiaat (sales tax) payment picker', usage: 'coa-tree-scope-filter', webAlias: null, verifiedIn: 'untDaribaMabiat.pas:1723,1818' },
  { legacyKey: 'SellAccount', descriptionEn: 'Parent-scope filter for the sales/revenue account picker', usage: 'coa-tree-scope-filter', webAlias: null, verifiedIn: 'UntProjectContract.pas:1864, UntRussianClass.pas:420' },
  { legacyKey: 'ReturnPayAccount', descriptionEn: 'Parent-scope filter for the tax-return-payment picker', usage: 'coa-tree-scope-filter', webAlias: null, verifiedIn: 'untDaribaMabiat.pas:2420, untSetting.pas:6287' },
  { legacyKey: 'ReturnSellAccount', descriptionEn: 'Parent-scope filter for the sales-return revenue picker', usage: 'coa-tree-scope-filter', webAlias: null, verifiedIn: 'untDaribaMabiat.pas:2357, untPOSSetting.pas:207' },
  { legacyKey: 'CostAccount', descriptionEn: 'Parent-scope filter for the COGS account picker', usage: 'coa-tree-scope-filter', webAlias: null, verifiedIn: 'untSetting.pas:6207,6217' },
  { legacyKey: 'FirstTimeAccount', descriptionEn: 'Periodic-inventory (StoreWay=P) opening valuation account', usage: 'coa-tree-scope-filter', webAlias: null, verifiedIn: 'UntBG.pas:3859,3875' },
  { legacyKey: 'LastTimeAccount', descriptionEn: 'Periodic-inventory (StoreWay=P) closing valuation account', usage: 'coa-tree-scope-filter', webAlias: null, verifiedIn: 'untITOptions.pas:509, untSetting.pas:7129' },
  { legacyKey: 'EtemadAccount', descriptionEn: '"اعتماد" — letter-of-credit/trust account picker scope', usage: 'coa-tree-scope-filter', webAlias: null, verifiedIn: 'UntEtemad.pas:2232, untDaribaMabiat.pas:1992' },
];
