import { createHash } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import type {
  LegacySchemaTable,
  LegacySourceAdapter,
  LegacySourceHealth,
  SourceBatch,
} from '../types';
import { ConnectorCommandService } from '../legacy-source/connector-command.service';
import {
  assertAllowedLegacyTable,
  assertReadOnlySelectSql,
  type ConnectorSqlTemplateId,
} from '../legacy-source/connector-protocol';

export class ConnectorProxyLegacyAdapter implements LegacySourceAdapter {
  private commands: ConnectorCommandService;

  constructor(
    prisma: PrismaClient,
    private readonly companyId: string,
    private readonly migrationJobId: string,
    /** Bound agent: commands go to this device only, never to another paired agent. */
    private readonly deviceId: string | null = null
  ) {
    this.commands = new ConnectorCommandService(prisma);
  }

  mode() {
    return 'ON_PREMISE_CONNECTOR' as const;
  }

  async connect(): Promise<void> {
    await this.testConnection();
  }

  async testConnection(): Promise<void> {
    await this.runOp('TEST', {});
  }

  private async runOp<T extends Record<string, unknown>>(
    operation: Parameters<ConnectorCommandService['enqueue']>[0]['operation'],
    payload: Record<string, unknown>
  ): Promise<T> {
    const id = await this.commands.enqueue({
      companyId: this.companyId,
      migrationJobId: this.migrationJobId,
      operation,
      payload,
      deviceId: this.deviceId,
    });
    return this.commands.waitForResult<T>(id);
  }

  async discoverSchema(): Promise<LegacySchemaTable[]> {
    const res = await this.runOp<{ rows: LegacySchemaTable[] }>('DISCOVER_SCHEMA', {});
    return res.rows ?? [];
  }

  async reportHealth(): Promise<LegacySourceHealth> {
    const start = Date.now();
    try {
      await this.testConnection();
      return { ok: true, mode: 'ON_PREMISE_CONNECTOR', latencyMs: Date.now() - start };
    } catch (err) {
      return {
        ok: false,
        mode: 'ON_PREMISE_CONNECTOR',
        latencyMs: Date.now() - start,
        message: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async getDatabaseName(): Promise<string> {
    const res = await this.runOp<{ name: string }>('DB_NAME', {});
    return res.name ?? 'unknown';
  }

  async getFingerprint(legacyCompanyCode: string): Promise<string> {
    const res = await this.runOp<{ fingerprint: string }>('FINGERPRINT', { legacyCompanyCode });
    if (res.fingerprint) return res.fingerprint;
    const db = await this.getDatabaseName();
    const payload = `${db}|company=${legacyCompanyCode}|connector=1`;
    return createHash('sha256').update(payload).digest('hex');
  }

  async count(table: string, legacyCompanyCode: string): Promise<number> {
    const safeTable = assertAllowedLegacyTable(table);
    const res = await this.runOp<{ cnt: number }>('COUNT', { table: safeTable, legacyCompanyCode });
    return Number(res.cnt ?? 0);
  }

  async queryBatch(
    table: string,
    legacyCompanyCode: string,
    cursor: string | null,
    limit: number
  ): Promise<SourceBatch> {
    const safeTable = assertAllowedLegacyTable(table);
    const res = await this.runOp<{ rows: Record<string, unknown>[]; nextCursor: string | null }>(
      'QUERY_BATCH',
      { table: safeTable, legacyCompanyCode, cursor, limit }
    );
    return { rows: res.rows ?? [], nextCursor: res.nextCursor ?? null };
  }

  async querySql<T>(sql: string, params?: Record<string, unknown>): Promise<T[]> {
    const templateId = params?.__templateId as ConnectorSqlTemplateId | undefined;
    if (templateId) {
      const res = await this.runOp<{ rows: T[] }>('QUERY_SQL_ID', {
        templateId,
        params: { ...params, __templateId: undefined },
      });
      return res.rows ?? [];
    }
    // Same rule the agent enforces — fail here, clearly, instead of after a round trip.
    assertReadOnlySelectSql(sql);
    const res = await this.runOp<{ rows: T[] }>('QUERY_READONLY', { sql, params: params ?? {} });
    return res.rows ?? [];
  }

  async streamRows(
    table: string,
    legacyCompanyCode: string,
    onBatch: (batch: SourceBatch) => Promise<void> | void,
    options?: { batchSize?: number; maxRows?: number }
  ): Promise<void> {
    const batchSize = Math.max(1, Math.min(options?.batchSize ?? 500, 5000));
    let cursor: string | null = null;
    let total = 0;
    for (;;) {
      const batch = await this.queryBatch(table, legacyCompanyCode, cursor, batchSize);
      if (batch.rows.length === 0) break;
      await onBatch(batch);
      total += batch.rows.length;
      if (options?.maxRows != null && total >= options.maxRows) break;
      if (!batch.nextCursor) break;
      cursor = batch.nextCursor;
    }
  }

  async close(): Promise<void> {
    /* stateless */
  }
}
