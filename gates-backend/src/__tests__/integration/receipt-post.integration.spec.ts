/**
 * Receipt post E2E on local MySQL (database name must contain "test" or use gates_db).
 */
import { PrismaClient } from '@prisma/client';
import { receiptService } from '../../modules/inventory/services/receipt.service';
import type { StockGlPostingContext } from '../../modules/inventory/services/stock-movement-gl.service';

const dbName = (() => {
  try {
    return new URL(process.env.DATABASE_URL ?? '').pathname.replace(/^\//, '');
  } catch {
    return '';
  }
})();
const describeDb = dbName ? describe : describe.skip;
const prisma = new PrismaClient();

describeDb('Receipt post (integration)', () => {
  jest.setTimeout(180_000);
  const suffix = String(Date.now());
  let companyId: string;
  let branchId: string;
  let fiscalYearId: string;
  let warehouseId: string;
  let itemId: string;
  let inventoryAccountId: string;
  let adjustmentAccountId: string;
  let expenseAccountId: string;
  let receiptId: string;
  let glCtx: StockGlPostingContext;

  beforeAll(async () => {
    companyId = (await prisma.company.create({ data: { arabicName: `RCP ${suffix}`, isActive: true } })).id;
    branchId = (await prisma.branch.create({ data: { companyId, arabicName: `Branch ${suffix}` } })).id;
    fiscalYearId = (
      await prisma.fiscalYear.create({
        data: {
          companyId,
          legacyYearId: '2026',
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-12-31'),
          status: 'Open',
          isActive: true,
        },
      })
    ).id;

    const mkAccount = (code: string, arabicName: string) =>
      prisma.account.create({
        data: { companyId, code, arabicName, accountType: 'asset', isActive: true, accountKind: 'POSTING' },
      });

    inventoryAccountId = (await mkAccount(`1${suffix.slice(-5)}`, 'Inventory')).id;
    expenseAccountId = (await mkAccount(`5${suffix.slice(-5)}`, 'Expense')).id;
    adjustmentAccountId = (await mkAccount(`6${suffix.slice(-5)}`, 'Adjustment')).id;

    await prisma.companySettings.create({
      data: {
        companyId,
        allowNegativeBalance: true,
        advancedSettings: { inventorySystem: 'PERPETUAL' },
        accountDefinitions: {
          inventoryAccount: inventoryAccountId,
          stockIssueExpenseAccount: expenseAccountId,
          inventoryAdjustmentAccount: adjustmentAccountId,
        },
      },
    });

    warehouseId = (
      await prisma.warehouse.create({
        data: {
          companyId,
          arabicName: `WH ${suffix}`,
          inventoryAccountId,
          isActive: true,
        },
      })
    ).id;

    const unit = await prisma.unit.create({ data: { companyId, arabicName: 'قطعة', englishName: 'PC' } });
    itemId = (
      await prisma.item.create({
        data: {
          companyId,
          arabicName: `Item ${suffix}`,
          code: `IT${suffix.slice(-6)}`,
          unitId: unit.id,
          mainAccountId: inventoryAccountId,
          averageCost: 10,
        },
      })
    ).id;

    glCtx = {
      companyId,
      branchId,
      fiscalYearId,
      userId: 'integration-test',
      isAdmin: true,
    };
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('posts a receipt with null document branchId using header branch context', async () => {
    const receipt = await prisma.receipt.create({
      data: {
        companyId,
        branchId: null,
        warehouseId,
        date: new Date('2026-06-01'),
        serial: `GR-${suffix}`,
        lines: {
          create: [{ itemId, quantity: 5, unitPrice: 12 }],
        },
      },
      include: { lines: true },
    });
    receiptId = receipt.id;

    const result = await receiptService.postReceipt(companyId, receiptId, glCtx);
    expect(result.success).toBe(true);

    const posted = await prisma.receipt.findUnique({ where: { id: receiptId } });
    expect(posted?.isPosted).toBe(true);
    expect(posted?.branchId).toBe(branchId);
    expect(posted?.journalEntryId).toBeTruthy();

    const movements = await prisma.inventoryMovement.count({
      where: { companyId, sourceDocumentId: receiptId },
    });
    expect(movements).toBe(1);

    const costRows = await prisma.itemCostHistory.count({
      where: { companyId, itemId, sourceType: 'GR' },
    });
    expect(costRows).toBe(1);

    await expect(receiptService.postReceipt(companyId, receiptId, glCtx)).rejects.toThrow(/مرحّل/);
  });
});
