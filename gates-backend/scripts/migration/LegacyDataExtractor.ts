import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { LegacyRow } from './types';
import { companyFilter } from './utils/legacy-values';

export interface ExtractBatchOptions {
  limit?: number;
  companyCode?: string;
  batchSize: number;
}

export class LegacyDataExtractor {
  private mssqlPool: unknown | null = null;

  constructor(
    private readonly dataPath: string,
    private readonly mssqlUrl?: string
  ) {}

  private tableFilePath(tableName: string): string {
    return path.join(this.dataPath, `${tableName}.json`);
  }

  async loadTable(tableName: string, options: ExtractBatchOptions): Promise<LegacyRow[]> {
    if (this.mssqlUrl) {
      return this.loadFromMssql(tableName, options);
    }
    return this.loadFromJson(tableName, options);
  }

  private async loadFromJson(
    tableName: string,
    options: ExtractBatchOptions
  ): Promise<LegacyRow[]> {
    const filePath = this.tableFilePath(tableName);
    let raw: string;
    try {
      raw = await readFile(filePath, 'utf8');
    } catch {
      return [];
    }
    const parsed = JSON.parse(raw) as LegacyRow[];
    if (!Array.isArray(parsed)) return [];

    let rows = parsed.filter((r) => companyFilter(r, options.companyCode));
    if (options.limit != null && options.limit > 0) {
      rows = rows.slice(0, options.limit);
    }
    return rows;
  }

  private async loadFromMssql(
    tableName: string,
    options: ExtractBatchOptions
  ): Promise<LegacyRow[]> {
    if (!this.mssqlUrl) return [];
    if (!this.mssqlPool) {
      let mssql: typeof import('mssql');
      try {
        mssql = await import('mssql');
      } catch {
        throw new Error(
          'LEGACY_MSSQL_URL is set but package "mssql" is not installed. Run: npm install mssql'
        );
      }
      this.mssqlPool = await mssql.default.connect(this.mssqlUrl);
    }

    const pool = this.mssqlPool as import('mssql').ConnectionPool;
    const request = pool.request();
    let sql = `SELECT * FROM [${tableName}]`;
    if (options.companyCode) {
      request.input('companyCode', options.companyCode);
      sql += ' WHERE CompanyCode = @companyCode';
    }
    if (options.limit != null && options.limit > 0) {
      sql = `SELECT TOP (${options.limit}) * FROM (${sql}) AS src`;
    }
    const result = await request.query(sql);
    return result.recordset as LegacyRow[];
  }

  async *iterateBatches(
    tableName: string,
    options: ExtractBatchOptions
  ): AsyncGenerator<{ batch: LegacyRow[]; batchIndex: number; batchTotal: number }> {
    const rows = await this.loadTable(tableName, options);
    const batchSize = options.batchSize;
    const batchTotal = Math.max(1, Math.ceil(rows.length / batchSize) || 1);
    if (rows.length === 0) {
      yield { batch: [], batchIndex: 0, batchTotal: 0 };
      return;
    }
    for (let i = 0; i < rows.length; i += batchSize) {
      yield {
        batch: rows.slice(i, i + batchSize),
        batchIndex: Math.floor(i / batchSize) + 1,
        batchTotal,
      };
    }
  }

  async close() {
    const pool = this.mssqlPool as { close?: () => Promise<void> } | null;
    if (pool?.close) await pool.close();
    this.mssqlPool = null;
  }
}
