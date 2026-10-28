/**
 * Maps erp_schema.txt column names to migration SQL / target fields when legacy
 * catalogs use different physical names (TotalAmount vs TotalValue, etc.).
 */
export type ColumnAliasEvidence = {
  legacyTable: string;
  schemaColumn: string;
  sqlSourceColumn?: string;
  targetModel: string;
  targetField: string;
  importer: string;
  preservationMode: 'MAPPED' | 'TRANSFORMED' | 'METADATA' | 'ID_MAP_KEY';
  transformation?: string;
  testRef?: string;
};

const KEY_PARTS = new Set(['companycode', 'branchcode', 'yearid']);

/** Per-table schema column → implementation evidence (code-backed). */
export const COLUMN_ALIAS_EVIDENCE: ColumnAliasEvidence[] = [
  // Invoice header — catalog vs runtime SQL
  ...[
    ['TotalAmount', 'TotalAmount AS TotalValue', 'Invoice', 'totalAmount', 'transformHistoricalInvoiceHeader'],
    ['NetAmount', 'NetAmount AS NetValue', 'Invoice', 'netAmount', 'transformHistoricalInvoiceHeader'],
    ['SalesDaribaAmount', 'SalesDaribaAmount AS DaribaValue', 'Invoice', 'taxAmount', 'transformHistoricalInvoiceHeader'],
    ['OfferAmount', 'OfferAmount AS DiscountValue', 'Invoice', 'discountAmount', 'transformHistoricalInvoiceHeader'],
    ['SupplierAccountCode', 'SupplierAccountCode AS CustomerCode/SupplierCode', 'Invoice', 'customerId/supplierId', 'transformHistoricalInvoiceHeader'],
    ['DescA', 'DescA', 'Invoice', 'description', 'transformHistoricalInvoiceHeader'],
    ['DescE', 'DescE', 'Invoice', 'internalNotes.legacyDescE', 'transformHistoricalInvoiceHeader'],
    ['AllowReturn', 'AllowReturn', 'Invoice', 'allowReturn', 'transformHistoricalInvoiceHeader'],
    ['Days', 'Days', 'Invoice', 'returnDays', 'transformHistoricalInvoiceHeader'],
    ['AffectStore', 'AffectStore', 'Invoice', 'affectsStock (inventory stage)', 'loadPostedInvoiceStockLines'],
    ['CCenter', 'CCenter', 'Invoice', 'costCenterId', 'commercial.stage resolve'],
    ['PaidAmount', 'PaidAmount', 'Invoice', 'paidAmount', 'transformHistoricalInvoiceHeader'],
    ['OrderNum', 'OrderNum', 'Invoice', 'sourceNumber (with OrderType)', 'mapLegacyInvoiceSourceDocumentType'],
    ['OrderType', 'OrderType', 'Invoice', 'sourceType', 'mapLegacyInvoiceSourceDocumentType'],
  ].map(([schemaCol, sqlCol, model, field, importer]) => ({
    legacyTable: 'InvoiceTrxHeader',
    schemaColumn: schemaCol as string,
    sqlSourceColumn: sqlCol as string,
    targetModel: model as string,
    targetField: field as string,
    importer: importer as string,
    preservationMode: 'TRANSFORMED' as const,
    testRef: 'commercial-document-migration.spec.ts',
  })),
  // Store check / adjust — document number column in catalog
  {
    legacyTable: 'StoreCheckHeader',
    schemaColumn: 'StoreCheckCode',
    targetModel: 'Stocktaking',
    targetField: 'serial',
    importer: 'importHistoricalStocktaking',
    preservationMode: 'MAPPED',
    testRef: 'migration-inventory-stocktaking.spec.ts',
  },
  {
    legacyTable: 'StoreAdjustHeader',
    schemaColumn: 'StoreCheckCode',
    targetModel: 'InventoryMovement',
    targetField: 'source document key (family SA)',
    importer: 'loadPostedStoreAdjustDetailLines',
    preservationMode: 'MAPPED',
  },
  {
    legacyTable: 'StoreCollDetail',
    schemaColumn: 'StoreCollCode',
    targetModel: 'InventoryMovement',
    targetField: 'sourceKey',
    importer: 'loadPostedStoreCollLines',
    preservationMode: 'MAPPED',
  },
  // Bank box rights
  {
    legacyTable: 'BankBoxRights',
    schemaColumn: 'AccountCode',
    targetModel: 'BankBoxRight | CompanySettingEntry',
    targetField: 'safeId/bankAccountId or migration.legacyBankBoxRights',
    importer: 'preserveLegacyBankBoxRights',
    preservationMode: 'METADATA',
    transformation: 'Resolve Safe/BankAccount when COA account maps; always preserve row JSON',
    testRef: 'migration-bank-box-rights.spec.ts',
  },
  {
    legacyTable: 'BankBoxRights',
    schemaColumn: 'UserCode',
    targetModel: 'BankBoxRight',
    targetField: 'userId',
    importer: 'preserveLegacyBankBoxRights',
    preservationMode: 'METADATA',
    transformation: 'EVIDENCE_BLOCKED: no legacyUserCode on User — preserved in CompanySettingEntry',
  },
];

export function aliasEvidenceFor(table: string, column: string): ColumnAliasEvidence | undefined {
  const lc = column.toLowerCase();
  return COLUMN_ALIAS_EVIDENCE.find(
    (e) => e.legacyTable.toLowerCase() === table.toLowerCase() && e.schemaColumn.toLowerCase() === lc
  );
}

export function isStandardIdMapKeyColumn(column: string): boolean {
  return KEY_PARTS.has(column.toLowerCase());
}
