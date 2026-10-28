import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { encrypt, decrypt } from '../../../shared/security/secrets-manager';
import { MigrationTargetSafetyError } from '../target-safety';
import type { LegacySourceMode } from '../types';
import { LegacyGatesSqlServerAdapter } from '../adapters/legacy-gates-sqlserver.adapter';
import { assertSafeLegacySqlHost } from './legacy-source-ssrf';
import {
  buildMssqlConnectionString,
  type BackupRestoreConfigPayload,
  type ConnectorConfigPayload,
  type LegacySourceConfigPayload,
  type LegacySourceConfigPublic,
  type RemoteSqlServerConfigPayload,
} from './legacy-source.types';
import { LegacySourceAuditService } from './legacy-source-audit.service';

export function normalizeRemoteSqlHostPort(host: string, port: number): { host: string; port: number } {
  let h = host.trim();
  let p = port;
  if (h.includes(',')) {
    const [a, b] = h.split(',', 2);
    h = a.trim();
    const n = Number.parseInt((b ?? '').trim(), 10);
    if (Number.isFinite(n) && n > 0) p = n;
  } else if (h.includes(':') && !h.includes('\\')) {
    const idx = h.lastIndexOf(':');
    const maybePort = h.slice(idx + 1);
    if (/^\d+$/.test(maybePort)) {
      p = Number.parseInt(maybePort, 10);
      h = h.slice(0, idx).trim();
    }
  }
  return { host: h, port: p };
}

export class LegacySourceConfigService {
  private audit: LegacySourceAuditService;

  constructor(private readonly prisma: PrismaClient) {
    this.audit = new LegacySourceAuditService(prisma);
  }

  private parsePayload(encrypted: string): LegacySourceConfigPayload {
    const raw = decrypt(encrypted);
    return JSON.parse(raw) as LegacySourceConfigPayload;
  }

  private toPublic(row: {
    id: string;
    companyId: string;
    mode: string;
    status: string;
    fingerprint: string | null;
    databaseName: string | null;
    lastTestedAt: Date | null;
    lastTestOk: boolean | null;
    lastTestMessage: string | null;
    configEncrypted: string;
  }): LegacySourceConfigPublic {
    const payload = this.parsePayload(row.configEncrypted);
    const base: LegacySourceConfigPublic = {
      id: row.id,
      companyId: row.companyId,
      mode: row.mode as LegacySourceMode,
      status: row.status as LegacySourceConfigPublic['status'],
      fingerprint: row.fingerprint,
      databaseName: row.databaseName,
      lastTestedAt: row.lastTestedAt?.toISOString() ?? null,
      lastTestOk: row.lastTestOk,
      lastTestMessage: row.lastTestMessage,
    };
    if (payload.kind === 'REMOTE_SQL_SERVER') {
      return { ...base, host: payload.host, port: payload.port, database: payload.database, user: payload.user };
    }
    if (payload.kind === 'ON_PREMISE_CONNECTOR') {
      return { ...base, deviceId: payload.deviceId };
    }
    if (payload.kind === 'BACKUP_RESTORE') {
      return {
        ...base,
        restoreRunId: payload.restoreRunId,
        packageId: payload.packageId,
        host: payload.remote?.host,
        port: payload.remote?.port,
        database: payload.remote?.database,
      };
    }
    return base;
  }

  async getForCompany(companyId: string, mode: LegacySourceMode) {
    const row = await this.prisma.migrationLegacySourceConfig.findUnique({
      where: { companyId_mode: { companyId, mode } },
    });
    return row ? this.toPublic(row) : null;
  }

  async getById(companyId: string, configId: string) {
    const row = await this.prisma.migrationLegacySourceConfig.findFirst({
      where: { id: configId, companyId },
    });
    return row ? this.toPublic(row) : null;
  }

  async upsertRemote(
    companyId: string,
    input: Omit<RemoteSqlServerConfigPayload, 'kind'>,
    actorId?: string
  ): Promise<LegacySourceConfigPublic> {
    const { host, port } = normalizeRemoteSqlHostPort(input.host, input.port);
    await assertSafeLegacySqlHost(host);
    if (!input.database?.trim() || !input.user?.trim()) {
      throw new MigrationTargetSafetyError('Database and user are required');
    }
    if (port < 1 || port > 65535) {
      throw new MigrationTargetSafetyError('Invalid port');
    }
    const payload: RemoteSqlServerConfigPayload = {
      kind: 'REMOTE_SQL_SERVER',
      ...input,
      host,
      port,
      encrypt: input.encrypt !== false,
      trustServerCertificate: input.trustServerCertificate === true,
    };
    const encrypted = encrypt(JSON.stringify(payload));
    const row = await this.prisma.migrationLegacySourceConfig.upsert({
      where: { companyId_mode: { companyId, mode: 'REMOTE_SQL_SERVER' } },
      create: {
        id: randomUUID(),
        companyId,
        mode: 'REMOTE_SQL_SERVER',
        status: 'DRAFT',
        configEncrypted: encrypted,
      },
      update: {
        configEncrypted: encrypted,
        status: 'DRAFT',
        fingerprint: null,
        databaseName: null,
        lastTestOk: null,
        lastTestMessage: null,
      },
    });
    await this.audit.log({
      companyId,
      mode: 'REMOTE_SQL_SERVER',
      action: 'REMOTE_CONFIG_UPSERT',
      actorId,
      detail: `host=${input.host};db=${input.database}`,
    });
    return this.toPublic(row);
  }

  async testRemoteConnection(
    companyId: string,
    legacyCompanyCode: string,
    actorId?: string
  ): Promise<LegacySourceConfigPublic> {
    const row = await this.prisma.migrationLegacySourceConfig.findUnique({
      where: { companyId_mode: { companyId, mode: 'REMOTE_SQL_SERVER' } },
    });
    if (!row) throw new MigrationTargetSafetyError('Remote SQL source not configured');

    const payload = this.parsePayload(row.configEncrypted) as RemoteSqlServerConfigPayload;
    const { host, port } = normalizeRemoteSqlHostPort(payload.host, payload.port);
    if (host !== payload.host || port !== payload.port) {
      payload.host = host;
      payload.port = port;
      await this.prisma.migrationLegacySourceConfig.update({
        where: { id: row.id },
        data: { configEncrypted: encrypt(JSON.stringify(payload)) },
      });
    }
    await assertSafeLegacySqlHost(payload.host);
    const cs = buildMssqlConnectionString(payload);
    const adapter = new LegacyGatesSqlServerAdapter(cs, 'REMOTE_SQL_SERVER');
    let ok = false;
    let message = '';
    let fingerprint: string | null = null;
    let dbName: string | null = null;
    try {
      await adapter.testConnection();
      fingerprint = await adapter.getFingerprint(legacyCompanyCode);
      dbName = await adapter.getDatabaseName();
      ok = true;
      message = 'Connection successful';
    } catch (err) {
      message = err instanceof Error ? err.message : String(err);
    } finally {
      await adapter.close();
    }

    const updated = await this.prisma.migrationLegacySourceConfig.update({
      where: { id: row.id },
      data: {
        lastTestedAt: new Date(),
        lastTestOk: ok,
        lastTestMessage: message.slice(0, 512),
        fingerprint: ok ? fingerprint : row.fingerprint,
        databaseName: ok ? dbName : row.databaseName,
        status: ok ? 'READY' : 'FAILED',
      },
    });
    await this.audit.log({
      companyId,
      mode: 'REMOTE_SQL_SERVER',
      action: ok ? 'REMOTE_TEST_OK' : 'REMOTE_TEST_FAIL',
      actorId,
      detail: message.slice(0, 512),
    });
    return this.toPublic(updated);
  }

  async bindConnectorDevice(companyId: string, deviceId: string, actorId?: string) {
    const device = await this.prisma.migrationConnectorDevice.findFirst({
      where: { id: deviceId, companyId, status: 'ACTIVE' },
    });
    if (!device) throw new MigrationTargetSafetyError('Connector device not found or inactive');

    const payload: ConnectorConfigPayload = { kind: 'ON_PREMISE_CONNECTOR', deviceId };
    const encrypted = encrypt(JSON.stringify(payload));
    const row = await this.prisma.migrationLegacySourceConfig.upsert({
      where: { companyId_mode: { companyId, mode: 'ON_PREMISE_CONNECTOR' } },
      create: {
        id: randomUUID(),
        companyId,
        mode: 'ON_PREMISE_CONNECTOR',
        status: 'READY',
        configEncrypted: encrypted,
      },
      update: { configEncrypted: encrypted, status: 'READY' },
    });
    await this.audit.log({
      companyId,
      mode: 'ON_PREMISE_CONNECTOR',
      action: 'CONNECTOR_BOUND',
      actorId,
      detail: deviceId,
    });
    return this.toPublic(row);
  }

  async bindBackupRestoreSource(
    companyId: string,
    restoreRunId: string,
    packageId: string,
    remote: RemoteSqlServerConfigPayload,
    fingerprint: string,
    databaseName: string
  ) {
    const payload: BackupRestoreConfigPayload = {
      kind: 'BACKUP_RESTORE',
      restoreRunId,
      packageId,
      remote: {
        host: remote.host,
        port: remote.port,
        database: remote.database,
        user: remote.user,
        password: remote.password,
        encrypt: remote.encrypt,
        trustServerCertificate: remote.trustServerCertificate,
        connectTimeoutMs: remote.connectTimeoutMs,
      },
    };
    const encrypted = encrypt(JSON.stringify(payload));
    const row = await this.prisma.migrationLegacySourceConfig.upsert({
      where: { companyId_mode: { companyId, mode: 'BACKUP_RESTORE' } },
      create: {
        id: randomUUID(),
        companyId,
        mode: 'BACKUP_RESTORE',
        status: 'READY',
        configEncrypted: encrypted,
        fingerprint,
        databaseName,
        lastTestOk: true,
        lastTestMessage: 'Restored database bound',
        lastTestedAt: new Date(),
      },
      update: {
        configEncrypted: encrypted,
        status: 'READY',
        fingerprint,
        databaseName,
        lastTestOk: true,
        lastTestMessage: 'Restored database bound',
        lastTestedAt: new Date(),
      },
    });
    await this.audit.log({
      companyId,
      mode: 'BACKUP_RESTORE',
      action: 'BACKUP_SOURCE_BOUND',
      detail: restoreRunId,
    });
    return row;
  }

  /** Resolve decrypted remote connection for adapter factory (workers only — never log). */
  async resolveConnectionString(companyId: string, mode: LegacySourceMode): Promise<string | null> {
    const row = await this.prisma.migrationLegacySourceConfig.findUnique({
      where: { companyId_mode: { companyId, mode } },
    });
    if (!row || row.status !== 'READY') return null;

    const payload = this.parsePayload(row.configEncrypted);
    if (payload.kind === 'REMOTE_SQL_SERVER') {
      return buildMssqlConnectionString(payload);
    }
    if (payload.kind === 'BACKUP_RESTORE' && payload.remote) {
      return buildMssqlConnectionString({ kind: 'REMOTE_SQL_SERVER', ...payload.remote });
    }
    return null;
  }

  async getConnectorDeviceId(companyId: string): Promise<string | null> {
    const row = await this.prisma.migrationLegacySourceConfig.findUnique({
      where: { companyId_mode: { companyId, mode: 'ON_PREMISE_CONNECTOR' } },
    });
    if (!row || row.status !== 'READY') return null;
    const payload = this.parsePayload(row.configEncrypted) as ConnectorConfigPayload;
    return payload.deviceId;
  }
}
