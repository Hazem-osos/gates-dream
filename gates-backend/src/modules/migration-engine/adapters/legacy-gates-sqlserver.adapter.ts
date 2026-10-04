import { createHash } from 'node:crypto';
import type { LegacySourceAdapter, SourceBatch } from '../types';
import { assertSafeLegacyReadOnly } from '../target-safety';

type MssqlModule = typeof import('mssql');

export class LegacyGatesSqlServerAdapter implements LegacySourceAdapter {
  private pool: import('mssql').ConnectionPool | null = null;

  constructor(private readonly connectionString: string) {}

  private async getPool() {
    assertSafeLegacyReadOnly();
    if (this.pool) return this.pool;
    let mssql: MssqlModule;
    try {
      mssql = await import('mssql');
    } catch {
      throw new Error('Package "mssql" is required for LegacyGatesSqlServerAdapter. npm install mssql');
    }
    this.pool = await mssql.default.connect(this.connectionString);
    return this.pool;
  }

  async testConnection(): Promise<void> {
    const pool = await this.getPool();
    await pool.request().query('SELECT 1 AS ok');
  }

  async getDatabaseName(): Promise<string> {
    const rows = await this.querySql<{ name: string }>('SELECT DB_NAME() AS name');
    return rows[0]?.name ?? 'unknown';
  }

  async getFingerprint(legacyCompanyCode: string): Promise<string> {
    const db = await this.getDatabaseName();
    const meta = await this.querySql<{ table_count: number }>(
      `SELECT COUNT(*) AS table_count FROM sys.tables WHERE is_ms_shipped = 0`
    );
    const payload = `${db}|company=${legacyCompanyCode}|tables=${meta[0]?.table_count ?? 0}`;
    return createHash('sha256').update(payload).digest('hex');
  }

  async count(table: string, legacyCompanyCode: string): Promise<number> {
    const safeTable = table.replace(/[^\w]/g, '');
    const pool = await this.getPool();
    const req = pool.request().input('cc', legacyCompanyCode);
    const result = await req.query<{ cnt: number }>(
      `SELECT COUNT(*) AS cnt FROM dbo.[${safeTable}] WHERE RTRIM(CompanyCode)=@cc`
    );
    return Number(result.recordset[0]?.cnt ?? 0);
  }

  async queryBatch(
    table: string,
    legacyCompanyCode: string,
    cursor: string | null,
    limit: number
  ): Promise<SourceBatch> {
    const safeTable = table.replace(/[^\w]/g, '');
    const orderCol = await this.resolveOrderColumn(safeTable);
    const lim = Math.max(1, Math.min(limit, 5000));
    const pool = await this.getPool();
    const req = pool.request().input('cc', legacyCompanyCode);
    let result;
    if (cursor) {
      req.input('cursor', cursor);
      result = await req.query(
        `SELECT TOP (${lim}) * FROM dbo.[${safeTable}] WHERE RTRIM(CompanyCode)=@cc AND ${orderCol} > @cursor ORDER BY ${orderCol}`
      );
    } else {
      result = await req.query(
        `SELECT TOP (${lim}) * FROM dbo.[${safeTable}] WHERE RTRIM(CompanyCode)=@cc ORDER BY ${orderCol}`
      );
    }
    const rows = result.recordset as Record<string, unknown>[];
    const nextCursor =
      rows.length > 0 ? String(rows[rows.length - 1][orderCol] ?? '') : null;
    return { rows, nextCursor: rows.length < limit ? null : nextCursor };
  }

  async querySql<T>(sql: string, params?: Record<string, unknown>): Promise<T[]> {
    const pool = await this.getPool();
    const req = pool.request();
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        req.input(k, v as string | number);
      }
    }
    const result = await req.query(sql);
    return result.recordset as T[];
  }

  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.close();
      this.pool = null;
    }
  }

  private async resolveOrderColumn(table: string): Promise<string> {
    const defaults: Record<string, string> = {
      Branch: 'BranchCode',
      Year: 'YearCode',
      CostCenter: 'CCenterCode',
      Store: 'StoreCode',
      Currency: 'CurrencyCode',
      Account: 'AccountCode',
      Customer: 'CustomerCode',
      Supplier: 'SupplierCode',
    };
    if (defaults[table]) return defaults[table];
    const cols = await this.querySql<{ name: string }>(
      `SELECT c.name FROM sys.columns c JOIN sys.tables t ON t.object_id=c.object_id WHERE t.name=@t ORDER BY c.column_id`,
      { t: table }
    );
    const first = cols[0]?.name;
    if (!first) throw new Error(`Cannot resolve order column for ${table}`);
    return first;
  }
}
