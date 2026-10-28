type UploadSessionRow = {
  id: string;
  companyId: string;
  originalName: string;
  totalChunks: number;
  tempPath: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
};
type UploadChunkRow = {
  id: string;
  sessionId: string;
  chunkIndex: number;
  sha256: string;
  createdAt: Date;
};

const uploadSessionStore = new Map<string, UploadSessionRow>();
const uploadChunkStore = new Map<string, UploadChunkRow>();

jest.mock('../../shared/database/prisma', () => ({
  __esModule: true,
  default: {
    migrationPackageUploadSession: {
      create: jest.fn(async ({ data }: { data: UploadSessionRow }) => {
        const row = {
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        uploadSessionStore.set(data.id, row);
        return row;
      }),
      findFirst: jest.fn(async ({ where }: { where: { id?: string; companyId?: string } }) => {
        const row = uploadSessionStore.get(where.id ?? '');
        if (!row) return null;
        if (where.companyId && row.companyId !== where.companyId) return null;
        return row;
      }),
      findMany: jest.fn(async () => []),
      delete: jest.fn(async ({ where }: { where: { id: string } }) => {
        uploadSessionStore.delete(where.id);
        for (const [k, c] of uploadChunkStore) {
          if (c.sessionId === where.id) uploadChunkStore.delete(k);
        }
        return {};
      }),
    },
    migrationPackageUploadChunk: {
      create: jest.fn(async ({ data }: { data: Omit<UploadChunkRow, 'createdAt'> }) => {
        const key = `${data.sessionId}:${data.chunkIndex}`;
        const row = { ...data, createdAt: new Date() };
        uploadChunkStore.set(key, row);
        return row;
      }),
      findUnique: jest.fn(
        async ({ where }: { where: { sessionId_chunkIndex: { sessionId: string; chunkIndex: number } } }) => {
          const key = `${where.sessionId_chunkIndex.sessionId}:${where.sessionId_chunkIndex.chunkIndex}`;
          return uploadChunkStore.get(key) ?? null;
        }
      ),
      findMany: jest.fn(async ({ where }: { where: { sessionId: string } }) =>
        [...uploadChunkStore.values()].filter((c) => c.sessionId === where.sessionId)
      ),
    },
  },
}));

import { MigrationJobService } from '../../modules/migration-engine/services/migration-job.service';
import { MigrationCheckpointService } from '../../modules/migration-engine/services/migration-checkpoint.service';
import { MigrationProgressThrottle } from '../../modules/migration-engine/services/migration-progress-throttle.service';
import {
  assertBackupPathUnderRoot,
  assertSafeSqlServerIdentifier,
} from '../../modules/migration-engine/migration-sql-safety';
import { MigrationTargetSafetyError } from '../../modules/migration-engine/target-safety';
import {
  initChunkedUpload,
  appendUploadChunk,
  abortChunkedUpload,
  __testOnlyClearUploadSessionCache,
} from '../../modules/migration-engine/services/migration-chunked-upload.service';
import { MigrationPausedAtCheckpoint } from '../../modules/migration-engine/migration-cooperative-pause';
import path from 'node:path';
import os from 'node:os';
import fsp from 'node:fs/promises';

function mockPrismaJob(overrides: Record<string, unknown> = {}) {
  let row: Record<string, unknown> = {
    id: 'job-1',
    targetCompanyId: 'co-a',
    status: 'RUNNING',
    lockToken: null,
    lockExpiresAt: null,
    progress: {},
    dryRun: false,
    currentStage: 'ACCOUNTING',
    startedAt: new Date(),
    ...overrides,
  };
  return {
    migrationJob: {
      findUnique: jest.fn(async () => row),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        row = { ...row, ...data };
        return row;
      }),
      updateMany: jest.fn(async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        if (where.id === row.id) {
          if (where.lockToken != null && row.lockToken !== where.lockToken) return { count: 0 };
          if (where.OR && row.lockToken != null) {
            const exp = row.lockExpiresAt as Date | null;
            if (exp && exp.getTime() > Date.now()) return { count: 0 };
          }
          row = { ...row, ...data };
          return { count: 1 };
        }
        return { count: 0 };
      }),
      count: jest.fn(),
    },
    migrationCheckpoint: {
      upsert: jest.fn(async () => ({})),
    },
    getRow: () => row,
    setRow: (patch: Record<string, unknown>) => {
      row = { ...row, ...patch };
    },
  };
}

describe('migration infrastructure reliability', () => {
  it('acquireLock prevents duplicate concurrent runners', async () => {
    const db = mockPrismaJob();
    const jobs = new MigrationJobService(db as any);
    expect(await jobs.acquireLock('job-1', 'token-a')).toBe(true);
    expect(await jobs.acquireLock('job-1', 'token-b')).toBe(false);
    await jobs.releaseLock('job-1', 'token-a');
    expect(await jobs.acquireLock('job-1', 'token-b')).toBe(true);
  });

  it('extendLock renews lease for holder only', async () => {
    const db = mockPrismaJob();
    const jobs = new MigrationJobService(db as any);
    await jobs.acquireLock('job-1', 'token-a', 60_000);
    expect(await jobs.extendLock('job-1', 'token-a', 120_000)).toBe(true);
    expect(await jobs.extendLock('job-1', 'token-b', 120_000)).toBe(false);
  });

  it('checkpoint saveAfterCommittedBatch skips save when batch throws', async () => {
    const db = mockPrismaJob();
    const cps = new MigrationCheckpointService(db as any);
    await expect(
      cps.saveAfterCommittedBatch(
        {
          jobId: 'job-1',
          stage: 'ACCOUNTING',
          entity: 'Journal',
          cursorKey: '10',
          processedCount: BigInt(10),
          successCount: BigInt(10),
          warningCount: BigInt(0),
          errorCount: BigInt(0),
        },
        async () => {
          throw new Error('batch failed');
        }
      )
    ).rejects.toThrow('batch failed');
    expect(db.migrationCheckpoint.upsert).not.toHaveBeenCalled();
  });

  it('progress throttle flushes committed counters immediately', async () => {
    const db = mockPrismaJob();
    const jobs = new MigrationJobService(db as any);
    const throttle = new MigrationProgressThrottle('job-1', jobs, 60_000);
    await throttle.patch({ heartbeat: 1 });
    expect(db.migrationJob.update).not.toHaveBeenCalled();
    await throttle.patch({ committed: { stage: 'ACCOUNTING', success: 5 } }, { immediate: true });
    expect(db.migrationJob.update).toHaveBeenCalled();
    throttle.dispose();
  });

  it('rejects unsafe SQL Server identifiers for restore', () => {
    expect(() => assertSafeSqlServerIdentifier('GatesLegacyRestore_abc')).not.toThrow();
    expect(() => assertSafeSqlServerIdentifier("x'; DROP DATABASE master;--")).toThrow(
      MigrationTargetSafetyError
    );
  });

  it('rejects backup paths outside package root', () => {
    const root = path.join(os.tmpdir(), 'migration-packages-test');
    const inside = path.join(root, 'co-1', 'file.bak');
    const outside = '/etc/passwd';
    expect(() => assertBackupPathUnderRoot(inside, root)).not.toThrow();
    expect(() => assertBackupPathUnderRoot(outside, root)).toThrow(MigrationTargetSafetyError);
  });

  it('chunked upload is idempotent per chunk index', async () => {
    uploadSessionStore.clear();
    uploadChunkStore.clear();
    process.env.MIGRATION_PACKAGES_DIR = path.join(os.tmpdir(), `gates-mig-upload-${Date.now()}`);
    const { uploadId } = await initChunkedUpload({
      companyId: 'co-1',
      originalName: 'legacy.bak',
      totalChunks: 2,
    });
    const buf = Buffer.from('chunk-0');
    await appendUploadChunk({ companyId: 'co-1', uploadId, index: 0, data: buf });
    const dup = await appendUploadChunk({ companyId: 'co-1', uploadId, index: 0, data: buf });
    expect(dup.duplicate).toBe(true);
    await expect(
      appendUploadChunk({ companyId: 'co-1', uploadId, index: 0, data: Buffer.from('other') })
    ).rejects.toThrow(/different content/);
    await abortChunkedUpload({ companyId: 'co-1', uploadId });
    await fsp.rm(process.env.MIGRATION_PACKAGES_DIR!, { recursive: true, force: true });
  });

  it('chunked upload resumes from DB after process cache clear', async () => {
    uploadSessionStore.clear();
    uploadChunkStore.clear();
    process.env.MIGRATION_PACKAGES_DIR = path.join(os.tmpdir(), `gates-mig-upload-resume-${Date.now()}`);
    const { uploadId } = await initChunkedUpload({
      companyId: 'co-1',
      originalName: 'legacy.bak',
      totalChunks: 2,
    });
    const buf0 = Buffer.from('chunk-0');
    await appendUploadChunk({ companyId: 'co-1', uploadId, index: 0, data: buf0 });
    __testOnlyClearUploadSessionCache();
    const dup = await appendUploadChunk({ companyId: 'co-1', uploadId, index: 0, data: buf0 });
    expect(dup.duplicate).toBe(true);
    const buf1 = Buffer.from('chunk-1');
    const next = await appendUploadChunk({ companyId: 'co-1', uploadId, index: 1, data: buf1 });
    expect(next.received).toBe(2);
    await abortChunkedUpload({ companyId: 'co-1', uploadId });
    await fsp.rm(process.env.MIGRATION_PACKAGES_DIR!, { recursive: true, force: true });
  });

  it('cooperative pause error is detectable', () => {
    const err = new MigrationPausedAtCheckpoint('job-1', 'ACCOUNTING', 'Journal');
    expect(err.name).toBe('MigrationPausedAtCheckpoint');
  });

  it('assertJobBelongsToCompany blocks cross-tenant access', () => {
    const db = mockPrismaJob({ targetCompanyId: 'co-a' });
    const jobs = new MigrationJobService(db as any);
    expect(() => jobs.assertJobBelongsToCompany({ targetCompanyId: 'co-b' }, 'co-a')).toThrow();
  });
});
