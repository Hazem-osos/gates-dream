import { buildMigrationProgressSnapshot } from '../../modules/migration-engine/services/migration-job-progress.service';
import type { MigrationCheckpoint, MigrationJob } from '@prisma/client';

function job(partial: Partial<MigrationJob>): MigrationJob {
  return {
    id: 'j1',
    targetCompanyId: 'c1',
    legacyCompanyCode: '0001',
    sourceType: 'LEGACY_GATES_SQLSERVER',
    sourceFingerprint: 'fp',
    sourceDatabaseName: 'Legacy',
    status: 'RUNNING',
    currentStage: 'COA',
    dryRun: false,
    legacyConnectionRef: 'LEGACY_FORENSIC_URL',
    reconciliationBaseline: null,
    progress: { ui: { sourceMode: 'LEGACY_CONNECTION' } },
    lockToken: null,
    lockExpiresAt: null,
    startedAt: new Date(Date.now() - 60_000),
    completedAt: null,
    failedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...partial,
  };
}

describe('migration-job-progress', () => {
  it('builds module rows and overall percent from checkpoints', () => {
    const checkpoints: MigrationCheckpoint[] = [
      {
        id: 'cp1',
        migrationJobId: 'j1',
        stage: 'FOUNDATION',
        entity: 'Branch',
        cursorKey: null,
        processedCount: BigInt(10),
        successCount: BigInt(10),
        warningCount: BigInt(0),
        errorCount: BigInt(0),
        updatedAt: new Date(),
      },
      {
        id: 'cp2',
        migrationJobId: 'j1',
        stage: 'COA',
        entity: 'Account',
        cursorKey: '100',
        processedCount: BigInt(50),
        successCount: BigInt(40),
        warningCount: BigInt(2),
        errorCount: BigInt(0),
        updatedAt: new Date(),
      },
    ];

    const snap = buildMigrationProgressSnapshot({
      job: job({}),
      checkpoints,
      issues: [{ severity: 'BLOCKER', resolutionState: 'OPEN' }],
      openBlockers: 1,
    });

    expect(snap.overallPercent).toBeGreaterThan(0);
    expect(snap.overallPercent).toBeLessThan(100);
    expect(snap.modules.find((m) => m.stage === 'FOUNDATION')?.status).toBe('done');
    expect(snap.modules.find((m) => m.stage === 'COA')?.status).toBe('active');
    expect(snap.openBlockers).toBe(1);
    expect(snap.ui?.sourceMode).toBe('LEGACY_CONNECTION');
  });

  it('keeps lastEnqueuedAt on a DRAFT job so the wizard can show queued', () => {
    const snap = buildMigrationProgressSnapshot({
      job: job({
        status: 'DRAFT',
        currentStage: null,
        startedAt: null,
        progress: { ui: { lastEnqueuedAt: '2026-10-25T11:00:00.000Z', lastError: null } },
      }),
      checkpoints: [],
      issues: [],
      openBlockers: 0,
    });
    expect(snap.status).toBe('DRAFT');
    expect(snap.overallPercent).toBe(0);
    expect(snap.ui?.lastEnqueuedAt).toBe('2026-10-25T11:00:00.000Z');
  });

  it('returns 100% when job completed', () => {
    const snap = buildMigrationProgressSnapshot({
      job: job({ status: 'COMPLETED', currentStage: 'INVENTORY', completedAt: new Date() }),
      checkpoints: [],
      issues: [],
      openBlockers: 0,
    });
    expect(snap.overallPercent).toBe(100);
  });
});
