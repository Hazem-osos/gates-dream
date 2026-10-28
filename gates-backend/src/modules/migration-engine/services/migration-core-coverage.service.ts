import type { MigrationContext } from '../migration-context';
import { legacyTableExists } from '../accounting-source-profile';
import { resolveInventoryCutoverPolicyForRun } from '../policies/migration-inventory-cutover-policy';

export type FieldCoverageClass =
  | 'MAPPED'
  | 'TRANSFORMED'
  | 'LEGACY_METADATA'
  | 'UNSUPPORTED'
  | 'REQUIRES_EVIDENCE';

export type CoreCoverageRow = {
  legacyTable: string;
  legacyField: string;
  targetModel: string;
  targetField: string;
  classification: FieldCoverageClass;
  notes?: string;
};

export type CoreAreaCoverage = {
  id: string;
  labelAr: string;
  labelEn: string;
  stageIds: string[];
  implemented: boolean;
  legacyTables: string[];
  targetModels: string[];
  sampleFields: CoreCoverageRow[];
  gaps: string[];
  legacyRowCount?: number | null;
};

/** Evidence-based coverage for the 9 core migration areas (not full 570-table catalog). */
export const CORE_AREA_DEFINITIONS: Omit<CoreAreaCoverage, 'legacyRowCount'>[] = [
  {
    id: 'FOUNDATION',
    labelAr: 'الأساسيات',
    labelEn: 'Company Setup & Foundation',
    stageIds: ['FOUNDATION'],
    implemented: true,
    legacyTables: ['Branch', 'Year', 'Currency', 'CurrencyHistory', 'CostCenter', 'Store', 'CompanySetting'],
    targetModels: ['Branch', 'FiscalYear', 'Currency', 'ExchangeRateHistory', 'CostCenter', 'Warehouse', 'CompanySettingEntry', 'DocumentSequence'],
    sampleFields: [
      { legacyTable: 'Branch', legacyField: 'BranchCode', targetModel: 'Branch', targetField: 'legacyBranchCode', classification: 'MAPPED' },
      { legacyTable: 'Year', legacyField: 'YearID', targetModel: 'FiscalYear', targetField: 'legacyYearId', classification: 'MAPPED' },
      { legacyTable: 'CurrencyHistory', legacyField: 'Change+Date', targetModel: 'ExchangeRateHistory', targetField: 'rate+recordedAt', classification: 'TRANSFORMED', notes: 'When table exists' },
      { legacyTable: 'CompanySetting', legacyField: 'Name/Value', targetModel: 'CompanySettingEntry', targetField: 'name/value', classification: 'MAPPED' },
      { legacyTable: 'CompanySetting', legacyField: 'SerialStart*', targetModel: 'DocumentSequence', targetField: 'lastNumber', classification: 'TRANSFORMED', notes: 'MAX legacy serial + settings' },
    ],
    gaps: ['Wide CompanySettings row (logo/theme) — not all keys have typed targets'],
  },
  {
    id: 'GL',
    labelAr: 'الحسابات والقيود',
    labelEn: 'General Ledger & Accounting',
    stageIds: ['COA', 'ACCOUNTING'],
    implemented: true,
    legacyTables: ['Account', 'GLTrxHeader', 'GLTrxDetail', 'BalanceAccountsH/D'],
    targetModels: ['Account', 'JournalEntry', 'JournalEntryLine'],
    sampleFields: [
      { legacyTable: 'GLTrxDetail', legacyField: 'DebitValue/CreditValue', targetModel: 'JournalEntryLine', targetField: 'debit/credit', classification: 'MAPPED' },
      { legacyTable: 'GLTrxDetail', legacyField: 'CCenterCode', targetModel: 'JournalEntryLine', targetField: 'costCenterId', classification: 'TRANSFORMED' },
      { legacyTable: 'GLTrxHeader', legacyField: 'GLNum', targetModel: 'JournalEntry', targetField: 'record+sourceKey', classification: 'MAPPED' },
      { legacyTable: 'BalanceAccountsH', legacyField: 'BalanceAccount1-5', targetModel: 'CompanySettingEntry', targetField: 'legacyBalanceAccountsH.*', classification: 'LEGACY_METADATA', notes: 'Preserved when GL_ONLY — not posted as JE' },
    ],
    gaps: ['BalanceAccounts monetary amounts live in GL — header slots preserved only'],
  },
  {
    id: 'PARTIES',
    labelAr: 'العملاء والموردين',
    labelEn: 'Customers & Suppliers',
    stageIds: ['PARTIES'],
    implemented: true,
    legacyTables: ['Customer', 'Supplier'],
    targetModels: ['Customer', 'Supplier', 'Account'],
    sampleFields: [
      { legacyTable: 'Customer', legacyField: 'CustomerCode', targetModel: 'Customer', targetField: 'code', classification: 'MAPPED' },
      { legacyTable: 'Customer', legacyField: 'AccountNo', targetModel: 'Customer', targetField: 'mainAccountId', classification: 'TRANSFORMED' },
      { legacyTable: 'Customer', legacyField: 'CreditLimit', targetModel: 'Customer', targetField: 'creditLimit', classification: 'REQUIRES_EVIDENCE', notes: 'Imported when column present in source' },
      { legacyTable: 'Customer', legacyField: 'OpeningBalance', targetModel: 'Customer', targetField: 'balance', classification: 'UNSUPPORTED', notes: 'GL is truth; balance=0 on import' },
    ],
    gaps: ['Party opening balances from subledger only if not in GL — not fabricated'],
  },
  {
    id: 'SALES',
    labelAr: 'المبيعات',
    labelEn: 'Sales',
    stageIds: ['COMMERCIAL'],
    implemented: true,
    legacyTables: ['InvoiceTrxHeader', 'InvoiceTrxDetail'],
    targetModels: ['Invoice', 'InvoiceLine'],
    sampleFields: [
      { legacyTable: 'InvoiceTrxHeader', legacyField: 'Type SI*/SR*', targetModel: 'Invoice', targetField: 'invoiceKind', classification: 'TRANSFORMED' },
      { legacyTable: 'InvoiceTrxHeader', legacyField: 'GLNum', targetModel: 'Invoice', targetField: 'journalEntryId', classification: 'MAPPED' },
      { legacyTable: 'InvoiceTrxHeader', legacyField: 'NetAmount − PaidAmount', targetModel: 'Invoice', targetField: 'remainingAmount/paidAmount', classification: 'TRANSFORMED' },
      { legacyTable: 'InvoiceTrxHeader', legacyField: 'ReturnInvoice*', targetModel: 'Invoice', targetField: 'originalInvoiceId', classification: 'MAPPED' },
    ],
    gaps: ['Reversed invoice semantics — no reversalOf column in legacy header'],
  },
  {
    id: 'PURCHASING',
    labelAr: 'المشتريات',
    labelEn: 'Purchasing',
    stageIds: ['COMMERCIAL'],
    implemented: true,
    legacyTables: ['InvoiceTrxHeader', 'InvoiceTrxDetail'],
    targetModels: ['Invoice', 'InvoiceLine'],
    sampleFields: [
      { legacyTable: 'InvoiceTrxHeader', legacyField: 'Type PI*/PR*', targetModel: 'Invoice', targetField: 'invoiceKind', classification: 'TRANSFORMED' },
      { legacyTable: 'InvoiceTrxDetail', legacyField: 'ItemCode', targetModel: 'InvoiceLine', targetField: 'itemId', classification: 'MAPPED' },
    ],
    gaps: ['Landed cost / expense invoices — separate legacy types may BLOCK'],
  },
  {
    id: 'TREASURY',
    labelAr: 'الخزينة والبنوك',
    labelEn: 'Treasury & Banking',
    stageIds: ['TREASURY_HISTORICAL'],
    implemented: true,
    legacyTables: ['CashTrxHeader', 'CashTrxDetail', 'CashTrxotherDetail'],
    targetModels: ['CashTransaction', 'CashTransactionLine'],
    sampleFields: [
      { legacyTable: 'CashTrxHeader', legacyField: 'GLNum', targetModel: 'CashTransaction', targetField: 'journalEntryId', classification: 'MAPPED' },
      { legacyTable: 'CashTrxHeader', legacyField: 'Type BP/BR/KP/KR', targetModel: 'CashTransaction', targetField: 'transactionKind', classification: 'TRANSFORMED' },
      { legacyTable: 'CashTrxDetail', legacyField: 'AccountNo', targetModel: 'CashTransactionLine', targetField: 'accountId', classification: 'MAPPED' },
      { legacyTable: 'CashTrxotherDetail', legacyField: 'BankAccountNo', targetModel: 'CashTransaction', targetField: 'bankAccountId', classification: 'MAPPED' },
      { legacyTable: 'CashTrxotherDetail', legacyField: 'AccountNo', targetModel: 'CashTransactionLine', targetField: 'accountId (CREDIT)', classification: 'MAPPED' },
    ],
    gaps: ['Inter-safe transfers without CashTrxHeader evidence'],
  },
  {
    id: 'SETTLEMENTS',
    labelAr: 'التسويات',
    labelEn: 'Settlements & Allocations',
    stageIds: ['SETTLEMENT_HISTORICAL'],
    implemented: true,
    legacyTables: ['CashTrxDetail'],
    targetModels: ['PaymentAllocation'],
    sampleFields: [
      { legacyTable: 'CashTrxDetail', legacyField: 'InvoiceType/Num/Year', targetModel: 'PaymentAllocation', targetField: 'invoiceId+cashTransactionId', classification: 'MAPPED' },
      { legacyTable: 'CashTrxDetail', legacyField: 'Accepted', targetModel: '—', targetField: '—', classification: 'TRANSFORMED', notes: 'F = skip inactive line' },
      { legacyTable: 'SettlementTrxHeader', legacyField: '*', targetModel: '—', targetField: '—', classification: 'UNSUPPORTED', notes: 'Not in erp_schema.txt' },
    ],
    gaps: ['Advance/unapplied cash without invoice columns — not fabricated'],
  },
  {
    id: 'CHEQUES',
    labelAr: 'الشيكات وأوراق مالية',
    labelEn: 'Cheques & Financial Papers',
    stageIds: ['CHEQUE_HISTORICAL'],
    implemented: true,
    legacyTables: ['CKTrxDetail', 'CKTrxDetailSub', 'PKTrxDetail', 'PKTrxDetailSub'],
    targetModels: ['Cheque'],
    sampleFields: [
      { legacyTable: 'CKTrxDetail', legacyField: 'Type CK01', targetModel: 'Cheque', targetField: 'direction=INWARD', classification: 'MAPPED' },
      { legacyTable: 'PKTrxDetail', legacyField: 'Type PK01', targetModel: 'Cheque', targetField: 'direction=OUTWARD', classification: 'MAPPED' },
      { legacyTable: 'CKTrxDetail', legacyField: 'TakeGLNum/EditGLNum', targetModel: 'Cheque', targetField: 'clear/portfolio JE ids', classification: 'MAPPED' },
      { legacyTable: 'PKTrxDetailSub', legacyField: 'TakeGLNum', targetModel: 'Cheque', targetField: 'clearJournalEntryId', classification: 'MAPPED' },
    ],
    gaps: ['Securities PKTrx beyond PK01 cheque lifecycle', 'Extra sub-collections logged as INFO only'],
  },
  {
    id: 'INVENTORY',
    labelAr: 'المخزون',
    labelEn: 'Inventory & Warehouses',
    stageIds: ['ITEMS', 'INVENTORY'],
    implemented: true,
    legacyTables: ['Item', 'ItemUnit', 'StoreTrans*', 'InvoiceTrx*', 'ItemCost', 'StoreCheck*'],
    targetModels: ['Item', 'InventoryMovement', 'Stocktaking'],
    sampleFields: [
      { legacyTable: 'StoreTransHeader', legacyField: 'Qty', targetModel: 'InventoryMovement', targetField: 'quantity', classification: 'MAPPED' },
      { legacyTable: 'ItemCost', legacyField: 'Cost', targetModel: 'ItemCostHistory', targetField: 'unitCost', classification: 'TRANSFORMED' },
      { legacyTable: 'InvoiceTrx*', legacyField: 'AffectStore', targetModel: 'InventoryMovement', targetField: 'sourceDocument', classification: 'TRANSFORMED' },
      { legacyTable: '301001/401001 GL', legacyField: 'Periodic', targetModel: '—', targetField: '—', classification: 'UNSUPPORTED', notes: 'No invented inv-GL' },
    ],
    gaps: ['Inventory valuation GL cutover — owner policy (FULL_CUTOVER_READINESS)'],
  },
];

const TABLE_COUNT_BY_AREA: Record<string, string> = {
  FOUNDATION: 'Branch',
  GL: 'GLTrxHeader',
  PARTIES: 'Customer',
  SALES: 'InvoiceTrxHeader',
  PURCHASING: 'InvoiceTrxHeader',
  TREASURY: 'CashTrxHeader',
  SETTLEMENTS: 'CashTrxDetail',
  CHEQUES: 'CKTrxDetail',
  INVENTORY: 'Item',
};

export async function buildCoreCoverageMatrix(ctx: MigrationContext): Promise<{
  areas: CoreAreaCoverage[];
  inventoryCutoverPolicy: string;
  inventoryCutoverPolicySelected: boolean;
}> {
  const areas: CoreAreaCoverage[] = [];
  for (const def of CORE_AREA_DEFINITIONS) {
    const countTable = TABLE_COUNT_BY_AREA[def.id];
    let legacyRowCount: number | null = null;
    if (countTable && (await legacyTableExists(ctx.source, countTable))) {
      try {
        legacyRowCount = await ctx.source.count(countTable, ctx.legacyCompanyCode);
      } catch {
        legacyRowCount = null;
      }
    }
    areas.push({ ...def, legacyRowCount });
  }

  const job = await ctx.jobs.getJob(ctx.migrationJobId);
  const inv = resolveInventoryCutoverPolicyForRun(job?.progress);

  return { areas, inventoryCutoverPolicy: inv.label, inventoryCutoverPolicySelected: Boolean(inv.policy) };
}
