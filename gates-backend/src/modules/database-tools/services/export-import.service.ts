import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from '../../../shared/logger';
import prisma from '../../../shared/database/prisma';
import { env } from '../../../shared/config/env';
import { AppError } from '../../../shared/middleware/error-handler';

export interface ExportOptions {
  tables?: string[];
  format: 'json' | 'csv' | 'sql';
  path?: string;
  companyId?: string;
}

export interface ImportOptions {
  file: string;
  format: 'json' | 'csv' | 'sql';
  tables?: string[];
  overwrite?: boolean;
  companyId?: string;
}

/**
 * SECURITY: this tool used to interpolate caller-supplied table names into
 * `$queryRawUnsafe`/`$executeRawUnsafe` (SQL injection) and filtered on a `company_id`
 * column that doesn't exist in this schema (columns are camelCase `companyId`), so every
 * export silently came back empty. Both the injection risk and the tenant-scoping bug are
 * fixed by routing exclusively through Prisma models for a fixed allow-list of tables.
 */
type AllowedTable = 'customers' | 'suppliers' | 'items';

const TABLE_ALIASES: Record<string, AllowedTable> = {
  customers: 'customers',
  customer: 'customers',
  suppliers: 'suppliers',
  supplier: 'suppliers',
  vendors: 'suppliers',
  vendor: 'suppliers',
  items: 'items',
  item: 'items',
  inventory_items: 'items',
};

function resolveTable(name: string): AllowedTable | null {
  return TABLE_ALIASES[name.trim().toLowerCase()] ?? null;
}

function getDelegate(table: AllowedTable) {
  switch (table) {
    case 'customers':
      return prisma.customer;
    case 'suppliers':
      return prisma.supplier;
    case 'items':
      return prisma.item;
  }
}

export class ExportImportService {
  /**
   * Export data from database. Tenant-scoped and limited to the allow-listed tables above.
   */
  async exportData(options: ExportOptions): Promise<{ filePath: string; size: number; recordCount: number }> {
    if (!options.companyId) {
      throw new AppError(400, 'Company ID is required');
    }

    try {
      const exportDir = options.path || env.EXPORT_PATH || './exports';
      await fs.mkdir(exportDir, { recursive: true });

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `export_${timestamp}.${options.format}`;
      const filePath = path.join(exportDir, fileName);

      const requested = options.tables?.length ? options.tables : ['customers', 'suppliers', 'items'];
      const data: Record<string, unknown[]> = {};
      let recordCount = 0;

      for (const requestedName of requested) {
        const table = resolveTable(requestedName);
        if (!table) {
          logger.warn({ table: requestedName }, 'Skipping unsupported export table');
          continue;
        }
        if (data[table]) continue; // aliases (e.g. "vendors" and "supplier") can collide

        const delegate = getDelegate(table);
        const rows = await (delegate as { findMany: (args: unknown) => Promise<unknown[]> }).findMany({
          where: { companyId: options.companyId },
        });
        data[table] = rows;
        recordCount += rows.length;
      }

      if (options.format === 'json') {
        await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
      } else if (options.format === 'csv') {
        await fs.writeFile(filePath, this.convertToCSV(data), 'utf-8');
      } else if (options.format === 'sql') {
        // Text generation only — never executed, so this remains safe as an export format.
        await fs.writeFile(filePath, this.convertToSQL(data), 'utf-8');
      }

      const stats = await fs.stat(filePath);
      const size = stats.size;

      logger.info({ filePath, size, recordCount, format: options.format }, 'Data exported');

      return { filePath, size, recordCount };
    } catch (error) {
      logger.error({ error, options }, 'Error exporting data');
      throw error;
    }
  }

  /**
   * Import data into database. Tenant-scoped, allow-listed tables, and no arbitrary SQL
   * execution — SQL-format imports (which used to run the whole file via `$executeRawUnsafe`)
   * are rejected outright.
   */
  async importData(options: ImportOptions): Promise<{ imported: number; failed: number }> {
    if (!options.companyId) {
      throw new AppError(400, 'Company ID is required');
    }
    if (options.format === 'sql') {
      throw new AppError(
        400,
        'SQL import is disabled: executing arbitrary SQL files is not tenant-safe. Use JSON or CSV format instead.'
      );
    }

    try {
      const fileContent = await fs.readFile(options.file, 'utf-8');
      const data: Record<string, Array<Record<string, unknown>>> =
        options.format === 'json' ? JSON.parse(fileContent) : this.parseCSV(fileContent);

      let imported = 0;
      let failed = 0;

      const requestedNames = options.tables?.length ? options.tables : Object.keys(data);
      const seen = new Set<AllowedTable>();

      for (const requestedName of requestedNames) {
        const table = resolveTable(requestedName);
        if (!table || seen.has(table)) continue;
        const sourceRows = data[requestedName] ?? data[table];
        if (!sourceRows || sourceRows.length === 0) continue;
        seen.add(table);

        const delegate = getDelegate(table) as {
          deleteMany: (args: unknown) => Promise<unknown>;
          create: (args: unknown) => Promise<unknown>;
        };

        try {
          if (options.overwrite) {
            await delegate.deleteMany({ where: { companyId: options.companyId } });
          }

          for (const record of sourceRows) {
            try {
              const { id: _id, companyId: _companyId, ...rest } = record;
              await delegate.create({ data: { ...rest, companyId: options.companyId } });
              imported++;
            } catch (error) {
              logger.warn({ error, table, record }, 'Failed to import record');
              failed++;
            }
          }
        } catch (error) {
          logger.error({ error, table }, `Failed to import table ${table}`);
          failed += sourceRows.length;
        }
      }

      logger.info({ imported, failed, file: options.file }, 'Data imported');

      return { imported, failed };
    } catch (error) {
      logger.error({ error, options }, 'Error importing data');
      throw error;
    }
  }

  /**
   * Convert data to CSV format
   */
  private convertToCSV(data: Record<string, unknown>): string {
    let csv = '';
    for (const [table, records] of Object.entries(data)) {
      if (Array.isArray(records) && records.length > 0) {
        csv += `\n=== ${table} ===\n`;
        const headers = Object.keys(records[0]).join(',');
        csv += headers + '\n';
        for (const record of records) {
          const values = Object.values(record)
            .map((v) => (typeof v === 'string' ? `"${v.replace(/"/g, '""')}"` : v))
            .join(',');
          csv += values + '\n';
        }
      }
    }
    return csv;
  }

  /**
   * Convert data to SQL format (export-only, never executed)
   */
  private convertToSQL(data: Record<string, unknown>): string {
    let sql = '';
    for (const [table, records] of Object.entries(data)) {
      if (Array.isArray(records) && records.length > 0) {
        sql += `\n-- Table: ${table}\n`;
        for (const record of records) {
          const columns = Object.keys(record).join(', ');
          const values = Object.values(record)
            .map((v) => (typeof v === 'string' ? `'${v.replace(/'/g, "''")}'` : v === null ? 'NULL' : v))
            .join(', ');
          sql += `INSERT INTO ${table} (${columns}) VALUES (${values});\n`;
        }
      }
    }
    return sql;
  }

  /**
   * Parse CSV content
   */
  private parseCSV(content: string): Record<string, Array<Record<string, unknown>>> {
    // Simplified CSV parser - for production, use a proper CSV library
    const lines = content.split('\n');
    const data: Record<string, Array<Record<string, unknown>> & { _headers?: string[] }> = {};
    let currentTable = '';

    for (const line of lines) {
      if (line.startsWith('===')) {
        currentTable = line.replace(/=== /g, '').replace(/ ===/g, '').trim();
        data[currentTable] = [] as Array<Record<string, unknown>> & { _headers?: string[] };
      } else if (line.trim() && currentTable) {
        const values = line.split(',').map((v) => v.replace(/^"|"$/g, '').replace(/""/g, '"'));
        const bucket = data[currentTable] as Array<Record<string, unknown>> & { _headers?: string[] };
        if (!bucket._headers) {
          bucket._headers = values;
        } else {
          const record: Record<string, unknown> = {};
          bucket._headers.forEach((header: string, index: number) => {
            record[header] = values[index];
          });
          bucket.push(record);
        }
      }
    }

    for (const table in data) {
      delete (data[table] as { _headers?: string[] })._headers;
    }

    return data;
  }
}

export const exportImportService = new ExportImportService();
