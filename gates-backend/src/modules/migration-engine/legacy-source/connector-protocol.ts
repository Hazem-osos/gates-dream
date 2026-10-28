/** Allowlisted legacy table names for connector read protocol (Gates SQL Server ERP). */
const CORE_TABLES = new Set([
  'Branch',
  'Year',
  'CostCenter',
  'Store',
  'Currency',
  'Account',
  'Accounts',
  'Customer',
  'Supplier',
  'GLTrxHeader',
  'GLTrxDetail',
  'BalanceAccountsH',
  'BalanceAccountsD',
  'InvoiceTrxHeader',
  'InvoiceTrxDetail',
  'Item',
  'ItemUnit',
  'ItemStore',
  'CashTrxHeader',
  'CashTrxDetail',
  'CKTrxDetail',
  'CKTrxDetailSub',
  'SettlementTrxHeader',
  'CompanySetting',
  'CurrencyHistory',
  'ItemGroup',
  'ItemUnitDef',
  'ItemCost',
  'PKTrxDetail',
  'PKTrxDetailSub',
  'InventoryMovement',
  'StoreCheckHeader',
  'BankBoxRights',
  // Counted by Analyze (inventory source profile, readiness). Keep in sync with
  // gates-migration-connector/src/connector-ops.ts ALLOWED_LEGACY_TABLES.
  'StoreTransHeader',
  'StoreTransDetail',
  'StoreCollHeader',
  'StoreCollDetail',
  'StoreAdjustHeader',
  'StoreAdjustDetail',
  'StoreCheckDetail',
  'CashTrxotherDetail',
  'CustomerCategory',
  'SupplierCategory',
]);

export type ConnectorOperation =
  | 'PING'
  | 'TEST'
  | 'DB_NAME'
  | 'FINGERPRINT'
  | 'DISCOVER_SCHEMA'
  | 'COUNT'
  | 'QUERY_BATCH'
  | 'QUERY_SQL_ID'
  | 'QUERY_READONLY';

/** Removes string literals and comments so neither can hide or fake a keyword. */
export function stripSqlLiteralsAndComments(sqlText: string): string {
  return sqlText
    .replace(/N?'(?:''|[^'])*'/g, "''")
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/--[^\n]*/g, ' ');
}

const BLOCKED_SQL =
  /\b(insert|update|delete|merge|drop|alter|create|truncate|exec|execute|grant|revoke|deny|backup|restore|dbcc|shutdown|reconfigure|kill|bulk|waitfor|use|into|openrowset|opendatasource|openquery|openxml)\b|\b(?:xp|sp)_\w+/i;
const CROSS_DATABASE_NAME = /(?:\[[^\]]+\]|[A-Za-z_][\w@$#]*)\s*\.\s*(?:\[[^\]]*\]|[A-Za-z_][\w@$#]*)?\s*\.\s*(?:\[|[A-Za-z_])/;

/**
 * Same rule as the agent (gates-migration-connector/src/connector-ops.ts): one SELECT on the
 * connected database only — no writes, SELECT … INTO, OPEN* sources, procedures or
 * three-part (cross-database) names.
 */
export function assertReadOnlySelectSql(sql: string): void {
  const s = stripSqlLiteralsAndComments(sql).trim();
  if (!/^select\b/i.test(s)) {
    throw new Error('Only SELECT statements are allowed on connector');
  }
  if (/;/.test(s.replace(/;\s*$/, ''))) {
    throw new Error('Multi-statement SQL is not allowed');
  }
  if (BLOCKED_SQL.test(s)) {
    throw new Error('Mutating or external SQL is not allowed');
  }
  if (CROSS_DATABASE_NAME.test(s)) {
    throw new Error('Cross-database reads are not allowed');
  }
}

export function assertAllowedLegacyTable(table: string): string {
  const safe = table.replace(/[^\w]/g, '');
  if (!safe || safe.length > 128) {
    throw new Error('Invalid table name');
  }
  if (!CORE_TABLES.has(safe)) {
    throw new Error(`Table not allowlisted for connector reads: ${safe}`);
  }
  return safe;
}

/** Fixed SQL templates — connector never accepts free-form SQL from clients. */
export const CONNECTOR_SQL_TEMPLATES = {
  ORDER_COLUMN: `SELECT c.name FROM sys.columns c JOIN sys.tables t ON t.object_id=c.object_id WHERE t.name=@t ORDER BY c.column_id`,
  SCHEMA: `SELECT t.name, COUNT(c.column_id) AS column_count FROM sys.tables t JOIN sys.columns c ON c.object_id = t.object_id WHERE t.is_ms_shipped = 0 GROUP BY t.name ORDER BY t.name`,
  TABLE_COUNT: `SELECT COUNT(*) AS table_count FROM sys.tables WHERE is_ms_shipped = 0`,
  DB_NAME: `SELECT DB_NAME() AS name`,
  DB_IDENTITY: `SELECT DB_NAME() AS name, CAST(@@SERVERNAME AS nvarchar(256)) AS server_name, CONVERT(varchar(33), d.create_date, 126) AS created FROM sys.databases d WHERE d.database_id = DB_ID()`,
  TEST: `SELECT 1 AS ok`,
} as const;

export type ConnectorSqlTemplateId = keyof typeof CONNECTOR_SQL_TEMPLATES;

export function resolveConnectorSql(id: ConnectorSqlTemplateId): string {
  return CONNECTOR_SQL_TEMPLATES[id];
}
