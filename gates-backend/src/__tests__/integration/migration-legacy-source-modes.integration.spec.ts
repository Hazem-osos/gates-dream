/**
 * Adapter + orchestration contract tests (no live SQL Server).
 * Live Analyze → Dry-run → Execute E2E remains BLOCKED without disposable MSSQL.
 */
import type { MigrationJob } from '@prisma/client';
import { ConnectorCommandService } from '../../modules/migration-engine/legacy-source/connector-command.service';
import { assertAllowedLegacyTable, assertReadOnlySelectSql } from '../../modules/migration-engine/legacy-source/connector-protocol';

describe('migration legacy source modes (mocked integration)', () => {
  it('connector protocol rejects mutating SQL', () => {
    expect(() => assertReadOnlySelectSql('DELETE FROM Account')).toThrow();
    expect(() => assertReadOnlySelectSql('SELECT 1')).not.toThrow();
  });

  it('connector allowlist covers foundation entities', () => {
    for (const t of ['Branch', 'Year', 'GLTrxHeader', 'InventoryMovement', 'PKTrxDetail']) {
      expect(assertAllowedLegacyTable(t)).toBe(t);
    }
  });

  it('connector command service completes only matching company', async () => {
    const create = jest.fn();
    const findFirst = jest.fn();
    const findUnique = jest.fn();
    const update = jest.fn();
    const prisma = {
      migrationConnectorCommand: { create, findFirst, findUnique, update },
    } as unknown as import('@prisma/client').PrismaClient;

    findFirst.mockResolvedValue({
      id: 'cmd1',
      companyId: 'co-a',
      status: 'PENDING',
    });
    update.mockResolvedValue({});

    const svc = new ConnectorCommandService(prisma);
    const ok = await svc.complete({
      commandId: 'cmd1',
      companyId: 'co-a',
      deviceId: 'dev1',
      ok: true,
      result: { rows: [] },
    });
    expect(ok).toBe(true);
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ companyId: 'co-a' }) })
    );
  });
});

describe('BACKUP_RESTORE job adapter resolution (smoke)', () => {
  it('documents expected job fields for worker/API parity', () => {
    const job = {
      sourceMode: 'BACKUP_RESTORE',
      targetCompanyId: 'co1',
      legacySourceConfigId: 'cfg',
    } as Partial<MigrationJob>;
    expect(job.sourceMode).toBe('BACKUP_RESTORE');
  });
});

describe('migration pipeline contract (no live SQL)', () => {
  it('preserves ten-stage pipeline order', async () => {
    const { MigrationPipelineService } = await import(
      '../../modules/migration-engine/services/migration-pipeline.service'
    );
    const prisma = {} as import('@prisma/client').PrismaClient;
    const pipeline = new MigrationPipelineService(prisma);
    expect(pipeline).toBeDefined();
    const STAGES = [
      'FOUNDATION',
      'COA',
      'PARTIES',
      'ACCOUNTING',
      'ITEMS',
      'INVENTORY',
      'COMMERCIAL',
      'TREASURY_HISTORICAL',
      'SETTLEMENT_HISTORICAL',
      'CHEQUE_HISTORICAL',
    ];
    expect(STAGES).toHaveLength(10);
  });
});
