import { MigrationContext, MigrationContextError } from '../../modules/migration-engine/migration-context';
import { buildSourceKey, hashSourceKey } from '../../modules/migration-engine/source-key';
import {
  assertTransition,
  canAnalyze,
  canDryRun,
  canRunExecute,
  MigrationStateMachineError,
} from '../../modules/migration-engine/state-machine';
import {
  assertCustomerExecuteAllowed,
  assertMigrationEngineEnabled,
  assertSafeTargetDatabaseUrl,
  customerExecuteAllowed,
  MigrationTargetSafetyError,
} from '../../modules/migration-engine/target-safety';
import { blockLegacyPhaseBItemStore } from '../../modules/migration-engine/policies/inventory-source-policy';
import { inventoryQuantitySourceHint } from '../../modules/migration-engine/source-profile';
import {
  runMigrationJobSchema,
  runModeRequiresTargetWriteConfirm,
} from '../../modules/migration-engine/schemas/migration-engine.schema';
import { MigrationJobService } from '../../modules/migration-engine/services/migration-job.service';
import {
  connectorProvisionalFingerprint,
  isProvisionalPackageFingerprint,
  packageProvisionalFingerprint,
} from '../../modules/migration-engine/types';

describe('migration-engine', () => {
  it('requires targetCompanyId on context', () => {
    expect(
      () =>
        new MigrationContext(
          {
            migrationJobId: 'j1',
            targetCompanyId: '',
            legacyCompanyCode: '0001',
            sourceFingerprint: 'fp',
            dryRun: true,
            options: { legacyCompanyCode: '0001' },
          },
          {} as any
        )
    ).toThrow(MigrationContextError);
  });

  it('composite source keys hash deterministically', () => {
    const k = buildSourceKey({ companyCode: '0001', branchCode: '01' });
    expect(hashSourceKey(k)).toHaveLength(64);
    expect(hashSourceKey(k)).toBe(hashSourceKey(buildSourceKey({ branchCode: '01', companyCode: '0001' })));
  });

  it('state machine rejects illegal transitions', () => {
    expect(() => assertTransition('COMPLETED', 'ANALYZING')).toThrow(MigrationStateMachineError);
    expect(() => assertTransition('COMPLETED', 'RUNNING')).not.toThrow();
    expect(() => assertTransition('DRAFT', 'ANALYZING')).not.toThrow();
  });

  it('open blockers prevent dry-run and execute', () => {
    expect(canDryRun('READY_FOR_DRY_RUN', 1)).toBe(false);
    expect(canRunExecute('READY', 1)).toBe(false);
    expect(canDryRun('READY_FOR_DRY_RUN', 0)).toBe(true);
    expect(canDryRun('FAILED', 0)).toBe(true);
    expect(canDryRun('PAUSED', 0)).toBe(true);
    expect(canRunExecute('READY', 0)).toBe(true);
    expect(canRunExecute('COMPLETED', 0)).toBe(true);
    expect(canRunExecute('PAUSED', 0)).toBe(true);
  });

  it('blocks migration engine when disabled', () => {
    const prev = process.env.MIGRATION_ENGINE_ENABLED;
    delete process.env.MIGRATION_ENGINE_ENABLED;
    expect(() => assertMigrationEngineEnabled()).toThrow(MigrationTargetSafetyError);
    process.env.MIGRATION_ENGINE_ENABLED = prev;
  });

  it('blocks railway production DATABASE_URL', () => {
    const prev = process.env.MIGRATION_ALLOW_PRODUCTION_TARGET;
    delete process.env.MIGRATION_ALLOW_PRODUCTION_TARGET;
    process.env.MIGRATION_ENGINE_ENABLED = 'true';
    try {
      expect(() =>
        assertSafeTargetDatabaseUrl('mysql://user:pass@containers-us-west-123.railway.app:3306/gates')
      ).toThrow(MigrationTargetSafetyError);
    } finally {
      if (prev === undefined) delete process.env.MIGRATION_ALLOW_PRODUCTION_TARGET;
      else process.env.MIGRATION_ALLOW_PRODUCTION_TARGET = prev;
    }
  });

  it('allows railway production DATABASE_URL when owner cutover flag is set', () => {
    process.env.MIGRATION_ENGINE_ENABLED = 'true';
    process.env.MIGRATION_ALLOW_PRODUCTION_TARGET = 'true';
    expect(() =>
      assertSafeTargetDatabaseUrl('mysql://user:pass@example-prod.proxy.rlwy.net:15432/railway')
    ).not.toThrow();
  });

  it('blocks customer execute until the internal testing flag is set', () => {
    const prevFlag = process.env.MIGRATION_CUSTOMER_EXECUTE_ENABLED;
    const prevAllow = process.env.MIGRATION_INTERNAL_TEST_USER_IDS;
    delete process.env.MIGRATION_CUSTOMER_EXECUTE_ENABLED;
    delete process.env.MIGRATION_INTERNAL_TEST_USER_IDS;
    expect(customerExecuteAllowed('u1')).toBe(false);
    expect(() => assertCustomerExecuteAllowed('u1')).toThrow(MigrationTargetSafetyError);
    process.env.MIGRATION_CUSTOMER_EXECUTE_ENABLED = 'true';
    process.env.MIGRATION_INTERNAL_TEST_USER_IDS = 'allowed-user';
    expect(customerExecuteAllowed('other')).toBe(false);
    expect(customerExecuteAllowed('allowed-user')).toBe(true);
    if (prevFlag === undefined) delete process.env.MIGRATION_CUSTOMER_EXECUTE_ENABLED;
    else process.env.MIGRATION_CUSTOMER_EXECUTE_ENABLED = prevFlag;
    if (prevAllow === undefined) delete process.env.MIGRATION_INTERNAL_TEST_USER_IDS;
    else process.env.MIGRATION_INTERNAL_TEST_USER_IDS = prevAllow;
  });

  it('allows localhost target when enabled', () => {
    process.env.MIGRATION_ENGINE_ENABLED = 'true';
    expect(() =>
      assertSafeTargetDatabaseUrl('mysql://root:pass@127.0.0.1:3306/gates_dev')
    ).not.toThrow();
  });

  it('blocks legacy phase B when engine enabled', () => {
    process.env.MIGRATION_ENGINE_ENABLED = 'true';
    expect(() => blockLegacyPhaseBItemStore()).toThrow();
  });

  it('auto pipeline can leave DRAFT through analyze, dry-run, then execute', () => {
    expect(() => assertTransition('DRAFT', 'ANALYZING')).not.toThrow();
    expect(() => assertTransition('ANALYZING', 'READY_FOR_DRY_RUN')).not.toThrow();
    expect(() => assertTransition('READY_FOR_DRY_RUN', 'DRY_RUNNING')).not.toThrow();
    expect(() => assertTransition('DRY_RUNNING', 'READY')).not.toThrow();
    expect(() => assertTransition('READY', 'DRY_RUNNING')).not.toThrow();
    expect(() => assertTransition('FAILED', 'DRY_RUNNING')).not.toThrow();
    expect(() => assertTransition('DRY_RUNNING', 'PAUSED')).not.toThrow();
    expect(() => assertTransition('DRY_RUNNING', 'FAILED')).not.toThrow();
    expect(() => assertTransition('READY_FOR_DRY_RUN', 'ANALYZING')).not.toThrow();
    expect(() => assertTransition('READY', 'ANALYZING')).not.toThrow();
    expect(() => assertTransition('FAILED', 'READY_FOR_DRY_RUN')).not.toThrow();
    expect(() => assertTransition('READY', 'RUNNING')).not.toThrow();
    expect(canDryRun('READY_FOR_DRY_RUN', 0)).toBe(true);
    expect(canAnalyze('FAILED')).toBe(true);
    expect(canAnalyze('DRY_RUNNING')).toBe(false);
    expect(canRunExecute('DRAFT', 0)).toBe(false);
    expect(canRunExecute('READY', 0)).toBe(true);
  });

  it('requires confirmTargetWrite for execute and auto only', () => {
    expect(runModeRequiresTargetWriteConfirm('auto')).toBe(true);
    expect(runModeRequiresTargetWriteConfirm('execute')).toBe(true);
    expect(runModeRequiresTargetWriteConfirm('analyze')).toBe(false);
    expect(runModeRequiresTargetWriteConfirm('dry-run')).toBe(false);
    expect(runMigrationJobSchema.parse({ mode: 'auto', confirmTargetWrite: true }).mode).toBe('auto');
  });

  it('reuses an existing coordinator lock instead of throwing', async () => {
    const prisma = {
      migrationJob: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findUnique: jest.fn().mockResolvedValue({
          lockToken: 'coordinator-token',
          lockExpiresAt: new Date(Date.now() + 60_000),
        }),
      },
    };
    const jobs = new MigrationJobService(prisma as never);
    await expect(jobs.acquireLockOrReuse('job-1', 'stage-token')).resolves.toBe('reused');
  });

  it('acquires a fresh lock when none is held', async () => {
    const prisma = {
      migrationJob: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUnique: jest.fn(),
      },
    };
    const jobs = new MigrationJobService(prisma as never);
    await expect(jobs.acquireLockOrReuse('job-1', 'stage-token')).resolves.toBe('acquired');
    expect(prisma.migrationJob.findUnique).not.toHaveBeenCalled();
  });

  it('inventory hint uses movements when ItemStore empty', () => {
    expect(
      inventoryQuantitySourceHint({
        databaseName: 'x',
        legacyCompanyCode: '0001',
        tableCount: 100,
        hasItemStore: true,
        itemStoreRowCount: 0,
        hasStoreTransDetail: true,
        storeTransDetailRowCount: 10,
        hasItemCost: true,
        hasGL: true,
        glHeaderCount: 1,
        hasInvoiceTables: true,
        invoiceRowCount: 1,
        hasBalanceAccounts: false,
        balanceAccountRowCount: 0,
        hasOpeningStock: false,
        openingStockRowCount: 0,
        hasPerformedFlag: false,
        inventoryQuantitySourceHint: '',
      })
    ).toBe('DERIVE_FROM_STORE_TRANS_DETAIL');
  });

  it('treats connector fingerprints as provisional until analyze', () => {
    const fp = connectorProvisionalFingerprint('cfg-1');
    expect(fp).toBe('connector:cfg-1');
    expect(isProvisionalPackageFingerprint(fp)).toBe(true);
    expect(isProvisionalPackageFingerprint(packageProvisionalFingerprint('abc'.repeat(22)))).toBe(true);
    expect(isProvisionalPackageFingerprint('pending')).toBe(true);
    expect(isProvisionalPackageFingerprint('sha256:committed')).toBe(false);
  });

  it('commits a connector provisional fingerprint instead of mismatching', async () => {
    const row = {
      id: '4ecf3616-a274-40ab-a65d-a6ec87229bc8',
      sourceFingerprint: 'connector:e2395060-9224-4d9a-9b59-8e6d0da14589',
      sourceDatabaseName: null,
    };
    const findUnique = jest.fn().mockResolvedValue(row);
    const update = jest.fn().mockResolvedValue({ ...row, sourceFingerprint: 'real-hash' });
    const jobs = new MigrationJobService({ migrationJob: { findUnique, update } } as never);
    await jobs.assertFingerprint(row.id, 'real-hash');
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: row.id },
        data: expect.objectContaining({ sourceFingerprint: 'real-hash' }),
      })
    );
  });
});
