import type { MigrationJob } from '@prisma/client';
import { encrypt } from '../../shared/security/secrets-manager';
import { resolveLegacySourceAdapterForJob } from '../../modules/migration-engine/legacy-source/legacy-source.factory';
import { ConnectorProxyLegacyAdapter } from '../../modules/migration-engine/adapters/connector-proxy.adapter';
import { LegacyGatesSqlServerAdapter } from '../../modules/migration-engine/adapters/legacy-gates-sqlserver.adapter';

const findUnique = jest.fn();

const prismaMock = {
  migrationLegacySourceConfig: { findUnique },
} as unknown as import('@prisma/client').PrismaClient;

describe('resolveLegacySourceAdapterForJob', () => {
  beforeEach(() => {
    findUnique.mockReset();
  });

  it('returns connector proxy for ON_PREMISE_CONNECTOR when device paired', async () => {
    findUnique.mockResolvedValue({
      id: 'cfg1',
      status: 'READY',
      configEncrypted: encrypt(
        JSON.stringify({ kind: 'ON_PREMISE_CONNECTOR', deviceId: 'dev-1' })
      ),
      companyId: 'co1',
      mode: 'ON_PREMISE_CONNECTOR',
    });

    const job = {
      id: 'job1',
      targetCompanyId: 'co1',
      sourceMode: 'ON_PREMISE_CONNECTOR',
      legacySourceConfigId: 'cfg1',
      legacyConnectionRef: null,
      progress: null,
    } as MigrationJob;

    const adapter = await resolveLegacySourceAdapterForJob(prismaMock, job);
    expect(adapter).toBeInstanceOf(ConnectorProxyLegacyAdapter);
  });

  it('returns SQL adapter when BACKUP_RESTORE config is READY', async () => {
    const payload = {
      kind: 'BACKUP_RESTORE',
      restoreRunId: 'r1',
      packageId: 'p1',
      remote: {
        host: '127.0.0.1',
        port: 1433,
        database: 'GatesLegacyRestore_x',
        user: 'sa',
        password: 'secret',
        encrypt: true,
        trustServerCertificate: true,
      },
    };
    findUnique.mockResolvedValue({
      id: 'cfg2',
      status: 'READY',
      configEncrypted: encrypt(JSON.stringify(payload)),
      companyId: 'co1',
      mode: 'BACKUP_RESTORE',
    });

    const job = {
      id: 'job2',
      targetCompanyId: 'co1',
      sourceMode: 'BACKUP_RESTORE',
      legacySourceConfigId: 'cfg2',
      legacyConnectionRef: null,
      progress: null,
    } as MigrationJob;

    const adapter = await resolveLegacySourceAdapterForJob(prismaMock, job);
    expect(adapter).toBeInstanceOf(LegacyGatesSqlServerAdapter);
    expect(adapter.mode()).toBe('BACKUP_RESTORE');
  });

  it('does not fall through to env SQL when BACKUP_RESTORE is not READY', async () => {
    findUnique.mockResolvedValue(null);
    const job = {
      id: 'job3',
      targetCompanyId: 'co1',
      sourceMode: 'BACKUP_RESTORE',
      legacySourceConfigId: null,
      legacyConnectionRef: null,
      progress: null,
    } as MigrationJob;
    await expect(resolveLegacySourceAdapterForJob(prismaMock, job)).rejects.toThrow(
      /Isolated SQL Server host not configured/
    );
  });
});
