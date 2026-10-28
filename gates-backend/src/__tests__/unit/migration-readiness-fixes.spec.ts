/**
 * Regression tests for the 2026-10-28 migration readiness fixes
 * (docs/migration/LOCAL_E2E_RESULTS_2026-10-27.md, fixes 27, 30, 31, 34).
 * Fixes 28 (cash "other detail" lines) and 29 (journal branch / year) are covered by the
 * dirty rehearsal and accounting-migration.spec.ts respectively.
 */
import { Decimal } from '@prisma/client/runtime/library';
import { rollbackInventory } from '../../modules/migration-engine/services/migration-rollback.service';
import { mapLegacyInvoiceKind } from '../../modules/migration-engine/transforms/commercial-document-transform';
import { decideHistoricalInvoiceImport } from '../../modules/migration-engine/commercial/commercial-document-decision';
import { journalGroupsOutsideFoundation } from '../../modules/migration-engine/services/migration-preflight.service';
import {
  assertSafeTargetDatabaseUrl,
  MigrationTargetSafetyError,
} from '../../modules/migration-engine/target-safety';

describe('fix 27 — inventory rollback keeps stock that existed before the import', () => {
  function rollbackPrisma() {
    return {
      migrationJob: { findUnique: jest.fn(async () => ({ id: 'job-1', targetCompanyId: 'co-1' })) },
      migrationIdMap: {
        findMany: jest.fn(async () => [{ targetId: 'mv-pre-item' }, { targetId: 'mv-new-item' }]),
        deleteMany: jest.fn(async () => ({ count: 2 })),
      },
      migrationCheckpoint: { deleteMany: jest.fn(async () => ({ count: 1 })) },
      inventoryMovement: {
        findMany: jest.fn(async () => [{ itemId: 'item-pre' }, { itemId: 'item-new' }]),
        deleteMany: jest.fn(async () => ({ count: 2 })),
        // After deleting the migrated movements only item-pre keeps a movement (its pre-import stock).
        groupBy: jest.fn(async () => [
          { itemId: 'item-pre', warehouseId: 'wh-1', _sum: { quantityDelta: new Decimal(7) } },
        ]),
      },
      itemWarehouseBalance: {
        deleteMany: jest.fn(async () => ({ count: 1 })),
        updateMany: jest.fn(async () => ({ count: 1 })),
      },
      itemCostHistory: { deleteMany: jest.fn(async () => ({ count: 1 })) },
    };
  }

  it('deletes caches only for items left with no movements and rebuilds the rest from the ledger', async () => {
    const prisma = rollbackPrisma();
    const result = await rollbackInventory(prisma as never, 'job-1');

    expect(prisma.inventoryMovement.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['mv-pre-item', 'mv-new-item'] }, companyId: 'co-1' },
    });
    // Cost history is deleted for the migration-only item, never for the pre-existing one.
    expect(prisma.itemCostHistory.deleteMany).toHaveBeenCalledTimes(1);
    expect(prisma.itemCostHistory.deleteMany).toHaveBeenCalledWith({
      where: { companyId: 'co-1', itemId: { in: ['item-new'] } },
    });
    // The pre-existing item's balance is recomputed, not wiped.
    expect(prisma.itemWarehouseBalance.deleteMany).toHaveBeenCalledWith({
      where: { companyId: 'co-1', itemId: { in: ['item-new'] } },
    });
    expect(prisma.itemWarehouseBalance.deleteMany).toHaveBeenCalledWith({
      where: { companyId: 'co-1', itemId: 'item-pre', warehouseId: { notIn: ['wh-1'] } },
    });
    expect(prisma.itemWarehouseBalance.updateMany).toHaveBeenCalledWith({
      where: { companyId: 'co-1', itemId: 'item-pre', warehouseId: 'wh-1' },
      data: { quantityOnHand: new Decimal(7) },
    });
    expect(result.itemsNeedingCostRepair).toEqual(['item-pre']);
    expect(result.deletedMovements).toBe(2);
  });

  it('touches no cache when the job created no movements', async () => {
    const prisma = rollbackPrisma();
    prisma.migrationIdMap.findMany.mockResolvedValueOnce([]);
    const result = await rollbackInventory(prisma as never, 'job-1');
    expect(prisma.inventoryMovement.deleteMany).not.toHaveBeenCalled();
    expect(prisma.itemWarehouseBalance.deleteMany).not.toHaveBeenCalled();
    expect(prisma.itemCostHistory.deleteMany).not.toHaveBeenCalled();
    expect(result.itemsNeedingCostRepair).toEqual([]);
  });
});

describe('fix 31 — unknown invoice types are blocked, never guessed', () => {
  it.each(['PO01', 'SO01', 'QT01', 'P', 'S', 'SALESRET', 'PURCHASE'])('%s has no invoice kind', (type) => {
    expect(mapLegacyInvoiceKind(type)).toBeNull();
  });

  it.each([
    ['SI03', 'SALE'],
    ['SV99', 'SALE'],
    ['PI07', 'PURCHASE'],
    ['SR05', 'SALE_RETURN'],
    ['PR03', 'PURCHASE_RETURN'],
  ])('known family variant %s still maps to %s', (type, kind) => {
    expect(mapLegacyInvoiceKind(type)?.invoiceKind).toBe(kind);
  });

  it('a posted PO01 is BLOCKED as UNKNOWN_INVOICE_TYPE', () => {
    expect(
      decideHistoricalInvoiceImport({
        type: 'PO01',
        glNum: '00000001',
        journalEntryId: 'je-1',
        alreadyMapped: false,
        requireJournalLink: true,
      })
    ).toMatchObject({ action: 'BLOCK', category: 'UNKNOWN_INVOICE_TYPE' });
  });
});

describe('fix 34 — Analyze reports posted journals whose branch / year will not be migrated', () => {
  const branches = [{ BranchCode: '01 ' }, { BranchCode: '02' }];
  const years = [{ YearCode: '2025' }, { YearID: '2026 ' }];

  it('passes groups whose branch and year both exist', () => {
    expect(
      journalGroupsOutsideFoundation(
        [
          { y: '2025', b: '01', n: 10 },
          { y: '2026', b: '02 ', n: 3 },
        ],
        branches,
        years
      )
    ).toEqual([]);
  });

  it('reports an unknown branch, an unknown year, and both', () => {
    expect(
      journalGroupsOutsideFoundation(
        [
          { y: '2026', b: '99', n: 1 },
          { y: '2019', b: '01', n: 4 },
          { y: '2019', b: '99', n: 2 },
        ],
        branches,
        years
      )
    ).toEqual([
      '2026|99 (1 قيد، ناقص: فرع)',
      '2019|01 (4 قيد، ناقص: سنة)',
      '2019|99 (2 قيد، ناقص: سنة+فرع)',
    ]);
  });
});

describe('fix 30 — the live app database host is a production target', () => {
  const saved = { ...process.env };
  beforeEach(() => {
    process.env.MIGRATION_ENGINE_ENABLED = 'true';
    delete process.env.MIGRATION_ALLOW_PRODUCTION_TARGET;
  });
  afterEach(() => {
    process.env = { ...saved };
  });

  it('blocks mysql.railway.internal even outside NODE_ENV=production', () => {
    process.env.NODE_ENV = 'development';
    expect(() => assertSafeTargetDatabaseUrl('mysql://root:pw@mysql.railway.internal:3306/railway')).toThrow(
      MigrationTargetSafetyError
    );
  });

  it('still allows the disposable local database', () => {
    process.env.NODE_ENV = 'development';
    expect(() => assertSafeTargetDatabaseUrl('mysql://root:pw@127.0.0.1:3307/gates_mig_e2e')).not.toThrow();
  });
});
