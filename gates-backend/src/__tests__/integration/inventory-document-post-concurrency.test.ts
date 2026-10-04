/**
 * H-01: two simultaneous post (or unpost) requests for the same stock
 * transfer, stock adjustment or other adjustment must move stock exactly once.
 *
 * Needs a real MySQL database. Skipped unless the DATABASE_URL database name
 * contains "test" so it can never write into a dev or production database.
 *
 * Both calls are held right after the friendly `isPosted` pre-check (inside
 * `fiscalYearService.assertOpenForDate`, which every post/unpost path calls
 * before opening its transaction) until both have arrived, so the race is
 * reproduced on every run instead of depending on timing.
 */
import { PrismaClient } from '@prisma/client';
import sharedPrisma from '../../shared/database/prisma';
import { fiscalYearService } from '../../modules/platform/services/fiscal-year.service';
import { inventoryCostingService } from '../../modules/inventory/services/inventory-costing.service';
import { COSTING_MOVEMENT } from '../../modules/inventory/services/inventory-costing-math';
import { transferService } from '../../modules/inventory/services/transfer.service';
import { adjustmentService } from '../../modules/inventory/services/adjustment.service';
import { otherAdjustmentService } from '../../modules/inventory/services/other-adjustment.service';

const dbName = (() => {
  try {
    return new URL(process.env.DATABASE_URL ?? '').pathname.replace(/^\//, '');
  } catch {
    return '';
  }
})();
const describeDb = /test/i.test(dbName) ? describe : describe.skip;

const DOC_DATE = new Date('2026-06-15T00:00:00.000Z');
const SEED_QTY = 100;
const SEED_COST = 5;
const MOVE_QTY = 10;

/** The loser must be stopped by the document claim, not by some unrelated constraint. */
const ALREADY_POSTED = 'المستند مرحّل بالفعل';
const NOT_POSTED = 'المستند غير مرحّل';

const prisma = new PrismaClient();

/** Hold every caller of assertOpenForDate until `parties` callers have arrived. */
function holdUntilBothArrive(parties = 2) {
  const original = fiscalYearService.assertOpenForDate.bind(fiscalYearService);
  let arrived = 0;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  return jest
    .spyOn(fiscalYearService, 'assertOpenForDate')
    .mockImplementation(async (...args: Parameters<typeof original>) => {
      const result = await original(...args);
      arrived += 1;
      if (arrived >= parties) release();
      await Promise.race([gate, new Promise((r) => setTimeout(r, 5_000))]);
      return result;
    });
}

async function race<T>(run: () => Promise<T>) {
  const spy = holdUntilBothArrive();
  try {
    const results = await Promise.allSettled([run(), run()]);
    return {
      fulfilled: results.filter((r) => r.status === 'fulfilled').length,
      rejected: results
        .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
        .map((r) => (r.reason instanceof Error ? r.reason.message : String(r.reason))),
    };
  } finally {
    spy.mockRestore();
  }
}

describeDb('H-01 inventory document post/unpost concurrency (real MySQL)', () => {
  jest.setTimeout(120_000);

  let companyId: string;
  let branchId: string;
  let sourceWarehouseId: string;
  let destinationWarehouseId: string;
  let serialSeq = 0;

  const nextSerial = (prefix: string) => `${prefix}-${Date.now()}-${++serialSeq}`;

  async function seededItem(warehouseIds: string[] = [sourceWarehouseId]) {
    const item = await prisma.item.create({
      data: { companyId, arabicName: `H01 Item ${nextSerial('I')}` },
    });
    for (const warehouseId of warehouseIds) {
      await sharedPrisma.$transaction((tx) =>
        inventoryCostingService.applyInboundMovement(tx, {
          companyId,
          branchId,
          itemId: item.id,
          warehouseId,
          quantity: SEED_QTY,
          unitCost: SEED_COST,
          movementType: COSTING_MOVEMENT.PURCHASE,
          sourceType: 'H01-SEED',
          sourceNumber: item.id.slice(0, 8),
          transactionDate: DOC_DATE,
          updateLastPurchasePrice: false,
        })
      );
    }
    return item.id;
  }

  async function onHand(itemId: string, warehouseId: string) {
    const row = await prisma.itemWarehouseBalance.findUnique({
      where: { companyId_itemId_warehouseId: { companyId, itemId, warehouseId } },
      select: { quantityOnHand: true },
    });
    return Number(row?.quantityOnHand ?? 0);
  }

  async function documentMovements(sourceDocumentId: string) {
    return prisma.inventoryMovement.count({ where: { companyId, sourceDocumentId } });
  }

  async function journalEntries() {
    return prisma.journalEntry.count({ where: { companyId } });
  }

  beforeAll(async () => {
    const suffix = String(Date.now());
    const company = await prisma.company.create({
      data: { arabicName: `H01 Concurrency ${suffix}`, englishName: `H01 ${suffix}`, isActive: true },
    });
    companyId = company.id;

    const branch = await prisma.branch.create({
      data: { companyId, arabicName: `H01 Branch ${suffix}` },
    });
    branchId = branch.id;

    await prisma.fiscalYear.create({
      data: {
        companyId,
        legacyYearId: '2026',
        startDate: new Date('2026-01-01T00:00:00.000Z'),
        endDate: new Date('2026-12-31T23:59:59.000Z'),
        status: 'Open',
        isActive: true,
      },
    });

    const [source, destination] = await Promise.all([
      prisma.warehouse.create({ data: { companyId, arabicName: `H01 Source ${suffix}` } }),
      prisma.warehouse.create({ data: { companyId, arabicName: `H01 Destination ${suffix}` } }),
    ]);
    sourceWarehouseId = source.id;
    destinationWarehouseId = destination.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await sharedPrisma.$disconnect();
  });

  describe('stock transfer', () => {
    // Both warehouses start stocked so a double reversal cannot be masked by the negative-stock guard.
    async function createTransfer(itemId: string) {
      const transfer = await prisma.transfer.create({
        data: {
          companyId,
          branchId,
          serial: nextSerial('TRF'),
          date: DOC_DATE,
          fromWarehouseId: sourceWarehouseId,
          toWarehouseId: destinationWarehouseId,
          lines: { create: [{ itemId, quantity: MOVE_QTY }] },
        },
      });
      return transfer.id;
    }

    async function snapshot(transferId: string, itemId: string) {
      const transfer = await prisma.transfer.findUniqueOrThrow({ where: { id: transferId } });
      return {
        isPosted: transfer.isPosted,
        movements: await documentMovements(transferId),
        source: await onHand(itemId, sourceWarehouseId),
        destination: await onHand(itemId, destinationWarehouseId),
        journalEntries: await journalEntries(),
      };
    }

    it('post → unpost → repost moves stock once each time', async () => {
      const itemId = await seededItem([sourceWarehouseId, destinationWarehouseId]);
      const transferId = await createTransfer(itemId);

      await transferService.postTransfer(companyId, transferId);
      expect(await snapshot(transferId, itemId)).toEqual({
        isPosted: true,
        movements: 2,
        source: SEED_QTY - MOVE_QTY,
        destination: SEED_QTY + MOVE_QTY,
        journalEntries: 0,
      });

      await transferService.unpostTransfer(companyId, transferId);
      expect(await snapshot(transferId, itemId)).toEqual({
        isPosted: false,
        movements: 4,
        source: SEED_QTY,
        destination: SEED_QTY,
        journalEntries: 0,
      });

      await transferService.postTransfer(companyId, transferId);
      expect(await snapshot(transferId, itemId)).toEqual({
        isPosted: true,
        movements: 6,
        source: SEED_QTY - MOVE_QTY,
        destination: SEED_QTY + MOVE_QTY,
        journalEntries: 0,
      });
    });

    it('two concurrent posts: exactly one wins and stock moves once', async () => {
      const itemId = await seededItem([sourceWarehouseId, destinationWarehouseId]);
      const transferId = await createTransfer(itemId);

      const outcome = await race(() => transferService.postTransfer(companyId, transferId));

      expect({ fulfilled: outcome.fulfilled, ...(await snapshot(transferId, itemId)) }).toEqual({
        fulfilled: 1,
        isPosted: true,
        movements: 2,
        source: SEED_QTY - MOVE_QTY,
        destination: SEED_QTY + MOVE_QTY,
        journalEntries: 0,
      });
      expect(outcome.rejected).toEqual([ALREADY_POSTED]);
    });

    it('two concurrent unposts: exactly one wins and stock is reversed once', async () => {
      const itemId = await seededItem([sourceWarehouseId, destinationWarehouseId]);
      const transferId = await createTransfer(itemId);
      await transferService.postTransfer(companyId, transferId);

      const outcome = await race(() => transferService.unpostTransfer(companyId, transferId));

      expect({ fulfilled: outcome.fulfilled, ...(await snapshot(transferId, itemId)) }).toEqual({
        fulfilled: 1,
        isPosted: false,
        movements: 4,
        source: SEED_QTY,
        destination: SEED_QTY,
        journalEntries: 0,
      });
      expect(outcome.rejected).toEqual([NOT_POSTED]);
    });
  });

  describe('stock adjustment (تسوية جردية)', () => {
    async function createAdjustment(itemId: string) {
      const adjustment = await prisma.adjustment.create({
        data: {
          companyId,
          branchId,
          serial: nextSerial('ADJ'),
          date: DOC_DATE,
          warehouseId: sourceWarehouseId,
          lines: {
            create: [
              {
                itemId,
                bookQuantity: SEED_QTY,
                actualQuantity: SEED_QTY + MOVE_QTY,
                adjustmentQuantity: MOVE_QTY,
                unitPrice: SEED_COST,
              },
            ],
          },
        },
      });
      return adjustment.id;
    }

    async function snapshot(adjustmentId: string, itemId: string) {
      const adjustment = await prisma.adjustment.findUniqueOrThrow({ where: { id: adjustmentId } });
      return {
        isPosted: adjustment.isPosted,
        movements: await documentMovements(adjustmentId),
        onHand: await onHand(itemId, sourceWarehouseId),
        journalEntries: await journalEntries(),
      };
    }

    it('post → unpost → repost moves stock once each time', async () => {
      const itemId = await seededItem();
      const adjustmentId = await createAdjustment(itemId);

      await adjustmentService.postAdjustment(companyId, adjustmentId);
      expect(await snapshot(adjustmentId, itemId)).toEqual({
        isPosted: true,
        movements: 1,
        onHand: SEED_QTY + MOVE_QTY,
        journalEntries: 0,
      });

      await adjustmentService.unpostAdjustment(companyId, adjustmentId);
      expect(await snapshot(adjustmentId, itemId)).toEqual({
        isPosted: false,
        movements: 2,
        onHand: SEED_QTY,
        journalEntries: 0,
      });

      await adjustmentService.postAdjustment(companyId, adjustmentId);
      expect(await snapshot(adjustmentId, itemId)).toEqual({
        isPosted: true,
        movements: 3,
        onHand: SEED_QTY + MOVE_QTY,
        journalEntries: 0,
      });
    });

    it('two concurrent posts: exactly one wins and stock moves once', async () => {
      const itemId = await seededItem();
      const adjustmentId = await createAdjustment(itemId);

      const outcome = await race(() => adjustmentService.postAdjustment(companyId, adjustmentId));

      expect({ fulfilled: outcome.fulfilled, ...(await snapshot(adjustmentId, itemId)) }).toEqual({
        fulfilled: 1,
        isPosted: true,
        movements: 1,
        onHand: SEED_QTY + MOVE_QTY,
        journalEntries: 0,
      });
      expect(outcome.rejected).toEqual([ALREADY_POSTED]);
    });

    it('two concurrent unposts: exactly one wins and stock is reversed once', async () => {
      const itemId = await seededItem();
      const adjustmentId = await createAdjustment(itemId);
      await adjustmentService.postAdjustment(companyId, adjustmentId);

      const outcome = await race(() => adjustmentService.unpostAdjustment(companyId, adjustmentId));

      expect({ fulfilled: outcome.fulfilled, ...(await snapshot(adjustmentId, itemId)) }).toEqual({
        fulfilled: 1,
        isPosted: false,
        movements: 2,
        onHand: SEED_QTY,
        journalEntries: 0,
      });
      expect(outcome.rejected).toEqual([NOT_POSTED]);
    });
  });

  describe('other adjustment (تسوية أخرى)', () => {
    async function createOtherAdjustment(itemId: string) {
      const adjustment = await prisma.otherAdjustment.create({
        data: {
          companyId,
          branchId,
          serial: nextSerial('OADJ'),
          date: DOC_DATE,
          warehouseId: sourceWarehouseId,
          lines: { create: [{ itemId, quantity: MOVE_QTY, adjustmentType: 'discount' }] },
        },
      });
      return adjustment.id;
    }

    async function snapshot(adjustmentId: string, itemId: string) {
      const adjustment = await prisma.otherAdjustment.findUniqueOrThrow({
        where: { id: adjustmentId },
      });
      return {
        isPosted: adjustment.isPosted,
        movements: await documentMovements(adjustmentId),
        onHand: await onHand(itemId, sourceWarehouseId),
        journalEntries: await journalEntries(),
      };
    }

    it('post → unpost → repost moves stock once each time', async () => {
      const itemId = await seededItem();
      const adjustmentId = await createOtherAdjustment(itemId);

      await otherAdjustmentService.postOtherAdjustment(companyId, adjustmentId);
      expect(await snapshot(adjustmentId, itemId)).toEqual({
        isPosted: true,
        movements: 1,
        onHand: SEED_QTY - MOVE_QTY,
        journalEntries: 0,
      });

      await otherAdjustmentService.unpostOtherAdjustment(companyId, adjustmentId);
      expect(await snapshot(adjustmentId, itemId)).toEqual({
        isPosted: false,
        movements: 2,
        onHand: SEED_QTY,
        journalEntries: 0,
      });

      await otherAdjustmentService.postOtherAdjustment(companyId, adjustmentId);
      expect(await snapshot(adjustmentId, itemId)).toEqual({
        isPosted: true,
        movements: 3,
        onHand: SEED_QTY - MOVE_QTY,
        journalEntries: 0,
      });
    });

    it('two concurrent posts: exactly one wins and stock moves once', async () => {
      const itemId = await seededItem();
      const adjustmentId = await createOtherAdjustment(itemId);

      const outcome = await race(() =>
        otherAdjustmentService.postOtherAdjustment(companyId, adjustmentId)
      );

      expect({ fulfilled: outcome.fulfilled, ...(await snapshot(adjustmentId, itemId)) }).toEqual({
        fulfilled: 1,
        isPosted: true,
        movements: 1,
        onHand: SEED_QTY - MOVE_QTY,
        journalEntries: 0,
      });
      expect(outcome.rejected).toEqual([ALREADY_POSTED]);
    });

    it('two concurrent unposts: exactly one wins and stock is reversed once', async () => {
      const itemId = await seededItem();
      const adjustmentId = await createOtherAdjustment(itemId);
      await otherAdjustmentService.postOtherAdjustment(companyId, adjustmentId);

      const outcome = await race(() =>
        otherAdjustmentService.unpostOtherAdjustment(companyId, adjustmentId)
      );

      expect({ fulfilled: outcome.fulfilled, ...(await snapshot(adjustmentId, itemId)) }).toEqual({
        fulfilled: 1,
        isPosted: false,
        movements: 2,
        onHand: SEED_QTY,
        journalEntries: 0,
      });
      expect(outcome.rejected).toEqual([NOT_POSTED]);
    });
  });
});
