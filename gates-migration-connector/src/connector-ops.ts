import type sql from 'mssql';
import { createHash } from 'node:crypto';

/** Keep in sync with gates-backend connector-protocol CORE_TABLES. */
export const ALLOWED_LEGACY_TABLES = new Set([
  'Branch', 'Year', 'CostCenter', 'Store', 'Currency', 'Account', 'Accounts', 'Customer', 'Supplier',
  'GLTrxHeader', 'GLTrxDetail', 'BalanceAccountsH', 'BalanceAccountsD',
  'InvoiceTrxHeader', 'InvoiceTrxDetail', 'Item', 'ItemUnit', 'ItemStore',
  'CashTrxHeader', 'CashTrxDetail', 'CKTrxDetail', 'CKTrxDetailSub', 'SettlementTrxHeader',
  'CompanySetting', 'CurrencyHistory', 'ItemGroup', 'ItemUnitDef', 'ItemCost',
  'PKTrxDetail', 'PKTrxDetailSub', 'InventoryMovement', 'StoreCheckHeader', 'BankBoxRights',
  // Counted by Analyze (inventory source profile, readiness): keep in sync with the backend.
  'StoreTransHeader', 'StoreTransDetail', 'StoreCollHeader', 'StoreCollDetail',
  'StoreAdjustHeader', 'StoreAdjustDetail', 'StoreCheckDetail', 'CashTrxotherDetail',
  'CustomerCategory', 'SupplierCategory',
]);

const ORDER_DEFAULTS: Record<string, string> = {
  Branch: 'BranchCode',
  Year: 'YearCode',
  CostCenter: 'CCenterCode',
  Store: 'StoreCode',
  Currency: 'CurrencyCode',
  Account: 'AccountCode',
  Accounts: 'AccountCode',
  Customer: 'CustomerCode',
  Supplier: 'SupplierCode',
};

const SQL_TEMPLATES = {
  ORDER_COLUMN: `SELECT c.name FROM sys.columns c JOIN sys.tables t ON t.object_id=c.object_id WHERE t.name=@t ORDER BY c.column_id`,
  SCHEMA: `SELECT t.name AS name, COUNT(c.column_id) AS column_count FROM sys.tables t JOIN sys.columns c ON c.object_id = t.object_id WHERE t.is_ms_shipped = 0 GROUP BY t.name ORDER BY t.name`,
  TABLE_COUNT: `SELECT COUNT(*) AS table_count FROM sys.tables WHERE is_ms_shipped = 0`,
  DB_NAME: `SELECT DB_NAME() AS name`,
  DB_IDENTITY: `SELECT DB_NAME() AS name, CAST(@@SERVERNAME AS nvarchar(256)) AS server_name, CONVERT(varchar(33), d.create_date, 126) AS created FROM sys.databases d WHERE d.database_id = DB_ID()`,
  TEST: `SELECT 1 AS ok`,
} as const;

/** Removes string literals and comments so neither can hide or fake a keyword. */
export function stripSqlLiteralsAndComments(sqlText: string): string {
  return sqlText
    .replace(/N?'(?:''|[^'])*'/g, "''")
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/--[^\n]*/g, ' ');
}

const BLOCKED_SQL =
  /\b(insert|update|delete|merge|drop|alter|create|truncate|exec|execute|grant|revoke|deny|backup|restore|dbcc|shutdown|reconfigure|kill|bulk|waitfor|use|into|openrowset|opendatasource|openquery|openxml)\b|\b(?:xp|sp)_\w+/i;
/** db.schema.table, db..table, [db].[schema].[table]: reads outside the connected database. */
const CROSS_DATABASE_NAME = /(?:\[[^\]]+\]|[A-Za-z_][\w@$#]*)\s*\.\s*(?:\[[^\]]*\]|[A-Za-z_][\w@$#]*)?\s*\.\s*(?:\[|[A-Za-z_])/;

/**
 * Gates may only read the one database this agent was started on: a single SELECT, no writes,
 * no SELECT … INTO, no remote/OPEN* sources, no procedures, no three-part (cross-database) names.
 */
export function assertReadOnlySelectSql(s: string) {
  const code = stripSqlLiteralsAndComments(s).trim();
  if (!/^select\b/i.test(code)) throw new Error('Only SELECT allowed');
  if (/;/.test(code.replace(/;\s*$/, ''))) throw new Error('Multi-statement blocked');
  if (BLOCKED_SQL.test(code)) throw new Error('Mutating or external SQL blocked');
  if (CROSS_DATABASE_NAME.test(code)) throw new Error('Cross-database read blocked');
}

function safeTable(table: string): string {
  const safe = table.replace(/[^\w]/g, '');
  if (!safe || !ALLOWED_LEGACY_TABLES.has(safe)) throw new Error('Table not allowlisted');
  return safe;
}

function safeIdentifier(name: string): string {
  const safe = name.replace(/[^\w]/g, '');
  if (!safe || safe.length > 128) throw new Error('Invalid identifier');
  return safe;
}

async function resolveOrderColumn(pool: sql.ConnectionPool, table: string): Promise<string> {
  if (ORDER_DEFAULTS[table]) return ORDER_DEFAULTS[table];
  const r = await pool.request().input('t', table).query<{ name: string }>(SQL_TEMPLATES.ORDER_COLUMN);
  const first = r.recordset[0]?.name;
  if (!first) throw new Error(`Cannot resolve order column for ${table}`);
  return safeIdentifier(first);
}

export async function handleConnectorOp(
  op: string,
  payload: Record<string, unknown>,
  pool: sql.ConnectionPool
): Promise<Record<string, unknown>> {
  if (op === 'PING' || op === 'TEST') {
    await pool.request().query(SQL_TEMPLATES.TEST);
    return {};
  }
  if (op === 'DB_NAME') {
    const r = await pool.request().query(SQL_TEMPLATES.DB_NAME);
    return { name: r.recordset[0]?.name };
  }
  if (op === 'FINGERPRINT') {
    const cc = String(payload.legacyCompanyCode ?? '0001');
    // Server + creation time distinguish two databases with the same name and schema
    // (another branch copy, another customer's restore) — the job refuses a changed source.
    const id = (await pool.request().query(SQL_TEMPLATES.DB_IDENTITY)).recordset[0] ?? {};
    const meta = await pool.request().query(SQL_TEMPLATES.TABLE_COUNT);
    const raw = `${id.name}|server=${id.server_name}|created=${id.created}|company=${cc}|tables=${meta.recordset[0]?.table_count ?? 0}`;
    return { fingerprint: createHash('sha256').update(raw).digest('hex') };
  }
  if (op === 'DISCOVER_SCHEMA') {
    const r = await pool.request().query(SQL_TEMPLATES.SCHEMA);
    return { rows: r.recordset };
  }
  if (op === 'COUNT') {
    const table = safeTable(String(payload.table ?? ''));
    const cc = String(payload.legacyCompanyCode);
    const r = await pool.request().input('cc', cc).query(
      `SELECT COUNT(*) AS cnt FROM dbo.[${table}] WHERE RTRIM(CompanyCode)=@cc`
    );
    return { cnt: r.recordset[0]?.cnt };
  }
  if (op === 'QUERY_BATCH') {
    const table = safeTable(String(payload.table ?? ''));
    const cc = String(payload.legacyCompanyCode);
    const cursor = payload.cursor != null && payload.cursor !== '' ? String(payload.cursor) : null;
    const lim = Math.max(1, Math.min(Number(payload.limit ?? 500), 5000));
    const orderCol = await resolveOrderColumn(pool, table);
    const req = pool.request().input('cc', cc);
    let result;
    if (cursor) {
      req.input('cursor', cursor);
      result = await req.query(
        `SELECT TOP (${lim}) * FROM dbo.[${table}] WHERE RTRIM(CompanyCode)=@cc AND ${orderCol} > @cursor ORDER BY ${orderCol}`
      );
    } else {
      result = await req.query(
        `SELECT TOP (${lim}) * FROM dbo.[${table}] WHERE RTRIM(CompanyCode)=@cc ORDER BY ${orderCol}`
      );
    }
    const rows = result.recordset as Record<string, unknown>[];
    const nextCursor =
      rows.length > 0 ? String(rows[rows.length - 1][orderCol] ?? '') : null;
    return {
      rows,
      nextCursor: rows.length < lim ? null : nextCursor,
    };
  }
  if (op === 'QUERY_SQL_ID') {
    const templateId = String(payload.templateId ?? '') as keyof typeof SQL_TEMPLATES;
    const sqlText = SQL_TEMPLATES[templateId];
    if (!sqlText) throw new Error('Unknown SQL template');
    assertReadOnlySelectSql(sqlText);
    const req = pool.request();
    const params = (payload.params ?? {}) as Record<string, unknown>;
    for (const [k, v] of Object.entries(params)) req.input(k, v as string | number);
    const r = await req.query(sqlText);
    return { rows: r.recordset };
  }
  if (op === 'QUERY_READONLY') {
    const sqlText = String(payload.sql ?? '');
    assertReadOnlySelectSql(sqlText);
    const req = pool.request();
    const params = (payload.params ?? {}) as Record<string, unknown>;
    for (const [k, v] of Object.entries(params)) req.input(k, v as string | number);
    const r = await req.query(sqlText);
    return { rows: r.recordset };
  }
  throw new Error(`Unsupported operation ${op}`);
}
