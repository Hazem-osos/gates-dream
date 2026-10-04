import { MigrationContext, MigrationContextError } from '../../modules/migration-engine/migration-context';
import { buildSourceKey, hashSourceKey } from '../../modules/migration-engine/source-key';
import {
  assertTransition,
  canDryRun,
  canRunExecute,
  MigrationStateMachineError,
} from '../../modules/migration-engine/state-machine';
import {
  assertMigrationEngineEnabled,
  assertSafeTargetDatabaseUrl,
  MigrationTargetSafetyError,
} from '../../modules/migration-engine/target-safety';
import { blockLegacyPhaseBItemStore } from '../../modules/migration-engine/policies/inventory-source-policy';
import { inventoryQuantitySourceHint } from '../../modules/migration-engine/source-profile';

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
    expect(canRunExecute('READY', 0)).toBe(true);
    expect(canRunExecute('COMPLETED', 0)).toBe(true);
  });

  it('blocks migration engine when disabled', () => {
    const prev = process.env.MIGRATION_ENGINE_ENABLED;
    delete process.env.MIGRATION_ENGINE_ENABLED;
    expect(() => assertMigrationEngineEnabled()).toThrow(MigrationTargetSafetyError);
    process.env.MIGRATION_ENGINE_ENABLED = prev;
  });

  it('blocks railway production DATABASE_URL', () => {
    process.env.MIGRATION_ENGINE_ENABLED = 'true';
    expect(() =>
      assertSafeTargetDatabaseUrl('mysql://user:pass@containers-us-west-123.railway.app:3306/gates')
    ).toThrow(MigrationTargetSafetyError);
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
});
