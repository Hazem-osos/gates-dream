import { MigrationBakRestoreLifecycleService } from '../../modules/migration-engine/services/migration-bak-restore-lifecycle.service';

describe('MigrationBakRestoreLifecycleService', () => {
  it('detects active migration jobs holding restore config', async () => {
    const count = jest.fn().mockResolvedValue(1);
    const prisma = {
      migrationJob: { count },
      migrationBakRestoreRun: { updateMany: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
      migrationConnectorCommand: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
    } as unknown as import('@prisma/client').PrismaClient;

    const svc = new MigrationBakRestoreLifecycleService(prisma);
    await expect(svc.isRestoreConfigInUse('cfg-1')).resolves.toBe(true);
    expect(count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ legacySourceConfigId: 'cfg-1' }),
      })
    );
  });

  it('does not drop databases when DROP env is off', async () => {
    const prev = process.env.MIGRATION_RESTORE_DROP_EXPIRED_DB;
    delete process.env.MIGRATION_RESTORE_DROP_EXPIRED_DB;
    const prisma = {
      migrationJob: { count: jest.fn() },
      migrationBakRestoreRun: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findMany: jest.fn(),
      },
      migrationConnectorCommand: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
    } as unknown as import('@prisma/client').PrismaClient;
    const svc = new MigrationBakRestoreLifecycleService(prisma);
    const r = await svc.dropExpiredRestoredDatabases();
    expect(r.dropped).toBe(0);
    process.env.MIGRATION_RESTORE_DROP_EXPIRED_DB = prev;
  });
});
