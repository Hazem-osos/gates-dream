import { PrismaClient } from '@prisma/client';
import { receiptService } from '../src/modules/inventory/services/receipt.service';

const prisma = new PrismaClient();

async function main() {
  const suffix = String(Date.now());
  const companyId = (await prisma.company.create({ data: { arabicName: `RCP ${suffix}`, isActive: true } })).id;
  const branchId = (await prisma.branch.create({ data: { companyId, arabicName: `Branch ${suffix}` } })).id;
  const fiscalYearId = (
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

  const mkAccount = async (code: string, arabicName: string) =>
    (
      await prisma.account.create({
        data: { companyId, code, arabicName, accountType: 'asset', isActive: true, accountKind: 'POSTING' },
      })
    ).id;

  const inventoryAccountId = await mkAccount(`1${suffix.slice(-5)}`, 'Inventory');
  const expenseAccountId = await mkAccount(`5${suffix.slice(-5)}`, 'Expense');
  const adjustmentAccountId = await mkAccount(`6${suffix.slice(-5)}`, 'Adjustment');

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

  const warehouseId = (
    await prisma.warehouse.create({
      data: { companyId, arabicName: `WH ${suffix}`, inventoryAccountId, isActive: true },
    })
  ).id;

  const unit = await prisma.unit.create({ data: { companyId, arabicName: 'قطعة', code: `U${suffix}` } });
  const item = await prisma.item.create({
    data: {
      companyId,
      arabicName: `Item ${suffix}`,
      serial: `IT${suffix.slice(-6)}`,
      mainAccountId: inventoryAccountId,
      averageCost: 10,
      priceRetail: 12,
    },
  });
  await prisma.itemUnit.create({ data: { itemId: item.id, unitId: unit.id, isBaseUnit: true } });
  const itemId = item.id;

  const receipt = await prisma.receipt.create({
    data: {
      companyId,
      branchId: null,
      warehouseId,
      date: new Date('2026-06-01'),
      serial: `GR-${suffix}`,
      lines: { create: [{ itemId, quantity: 5, unitPrice: 12 }] },
    },
  });

  const glCtx = { companyId, branchId, fiscalYearId, userId: 'smoke', isAdmin: true };

  try {
    const result = await receiptService.postReceipt(companyId, receipt.id, glCtx);
    console.log('POST OK', result);
  } catch (error) {
    console.error('POST FAILED');
    console.error(error);
    if (error instanceof Error) {
      console.error('message:', error.message);
      console.error('name:', error.name);
      console.error('stack:', error.stack);
    }
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
