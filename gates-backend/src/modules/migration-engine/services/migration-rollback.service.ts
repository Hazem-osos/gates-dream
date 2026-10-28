import type { PrismaClient } from '@prisma/client';
import { MigrationJobService } from './migration-job.service';

const FOUNDATION_MODELS = ['Warehouse', 'CostCenter', 'Currency', 'FiscalYear', 'Branch', 'Unit'] as const;

export async function rollbackInventory(prisma: PrismaClient, jobId: string) {
  const jobs = new MigrationJobService(prisma);
  const job = await jobs.getJob(jobId);
  if (!job) throw new Error(`Job not found: ${jobId}`);

  const maps = await prisma.migrationIdMap.findMany({
    where: {
      migrationJobId: jobId,
      outcome: 'CREATED_BY_MIGRATION',
      targetModel: 'InventoryMovement',
    },
    orderBy: { createdAt: 'desc' },
  });
  const ids = maps.map((m) => m.targetId);
  let deleted = 0;
  const itemIds = new Set<string>();
  if (ids.length) {
    const linked = await prisma.inventoryMovement.findMany({
      where: { id: { in: ids }, companyId: job.targetCompanyId },
      select: { itemId: true },
    });
    for (const row of linked) itemIds.add(row.itemId);
    const result = await prisma.inventoryMovement.deleteMany({
      where: { id: { in: ids }, companyId: job.targetCompanyId },
    });
    deleted = result.count;
  }
  // Rebuild the stock caches of touched items from the movements that remain (the ledger is the
  // truth). Never wipe caches of items that still have non-migration movements: those existed
  // before the import (or were posted after it) and must survive the rollback.
  const itemsNeedingCostRepair: string[] = [];
  if (itemIds.size) {
    const itemIdList = [...itemIds];
    const remaining = await prisma.inventoryMovement.groupBy({
      by: ['itemId', 'warehouseId'],
      where: { companyId: job.targetCompanyId, itemId: { in: itemIdList } },
      _sum: { quantityDelta: true },
    });
    const itemsWithMovements = new Set(remaining.map((r) => r.itemId));
    const emptyItems = itemIdList.filter((id) => !itemsWithMovements.has(id));
    if (emptyItems.length) {
      await prisma.itemWarehouseBalance.deleteMany({
        where: { companyId: job.targetCompanyId, itemId: { in: emptyItems } },
      });
      await prisma.itemCostHistory.deleteMany({
        where: { companyId: job.targetCompanyId, itemId: { in: emptyItems } },
      });
    }
    for (const itemId of itemsWithMovements) {
      const rows = remaining.filter((r) => r.itemId === itemId);
      const keepWarehouses = rows.map((r) => r.warehouseId);
      await prisma.itemWarehouseBalance.deleteMany({
        where: { companyId: job.targetCompanyId, itemId, warehouseId: { notIn: keepWarehouses } },
      });
      for (const r of rows) {
        await prisma.itemWarehouseBalance.updateMany({
          where: { companyId: job.targetCompanyId, itemId, warehouseId: r.warehouseId },
          data: { quantityOnHand: r._sum.quantityDelta ?? 0 },
        });
      }
      // Average cost / cost history are left as-is: run the standard cost repair for these items.
      itemsNeedingCostRepair.push(itemId);
    }
  }
  await prisma.migrationIdMap.deleteMany({
    where: { migrationJobId: jobId, targetModel: 'InventoryMovement' },
  });
  await prisma.migrationCheckpoint.deleteMany({
    where: { migrationJobId: jobId, stage: 'INVENTORY' },
  });
  return { deletedMovements: deleted, deletedMappings: maps.length, itemsNeedingCostRepair };
}

export async function rollbackItems(prisma: PrismaClient, jobId: string) {
  const jobs = new MigrationJobService(prisma);
  const job = await jobs.getJob(jobId);
  if (!job) throw new Error(`Job not found: ${jobId}`);

  const itemMaps = await prisma.migrationIdMap.findMany({
    where: { migrationJobId: jobId, targetModel: 'Item', outcome: 'CREATED_BY_MIGRATION' },
  });
  const unitMaps = await prisma.migrationIdMap.findMany({
    where: { migrationJobId: jobId, targetModel: 'Unit', outcome: 'CREATED_BY_MIGRATION' },
  });
  const catMaps = await prisma.migrationIdMap.findMany({
    where: { migrationJobId: jobId, targetModel: 'ItemCategory', outcome: 'CREATED_BY_MIGRATION' },
  });
  const itemIds = itemMaps.map((m) => m.targetId);
  if (itemIds.length) {
    await prisma.inventoryMovement.deleteMany({
      where: { companyId: job.targetCompanyId, itemId: { in: itemIds } },
    });
    await prisma.itemCostHistory.deleteMany({
      where: { companyId: job.targetCompanyId, itemId: { in: itemIds } },
    });
    await prisma.itemWarehouseBalance.deleteMany({
      where: { companyId: job.targetCompanyId, itemId: { in: itemIds } },
    });
    await prisma.itemUnit.deleteMany({ where: { itemId: { in: itemIds } } });
  }
  let deletedItems = 0;
  for (const map of itemMaps) {
    deletedItems += (
      await prisma.item.deleteMany({ where: { id: map.targetId, companyId: job.targetCompanyId } })
    ).count;
  }
  let deletedUnits = 0;
  for (const map of unitMaps) {
    deletedUnits += (
      await prisma.unit.deleteMany({ where: { id: map.targetId, companyId: job.targetCompanyId } })
    ).count;
  }
  let deletedCategories = 0;
  const remaining = new Set(catMaps.map((m) => m.targetId));
  while (remaining.size) {
    const cats = await prisma.itemCategory.findMany({
      where: { id: { in: [...remaining] }, companyId: job.targetCompanyId },
      select: { id: true, parentCategoryId: true },
    });
    const leaf = cats.find((c) => !cats.some((o) => o.parentCategoryId === c.id && remaining.has(o.id)));
    if (!leaf) break;
    deletedCategories += (
      await prisma.itemCategory.deleteMany({ where: { id: leaf.id, companyId: job.targetCompanyId } })
    ).count;
    remaining.delete(leaf.id);
  }
  await prisma.migrationIdMap.deleteMany({
    where: {
      migrationJobId: jobId,
      targetModel: { in: ['Item', 'ItemCategory', 'Unit'] },
    },
  });
  await prisma.migrationCheckpoint.deleteMany({ where: { migrationJobId: jobId, stage: 'ITEMS' } });
  return { deletedItems, deletedUnits, deletedCategories };
}

export async function rollbackAccounting(prisma: PrismaClient, jobId: string) {
  const jobs = new MigrationJobService(prisma);
  const job = await jobs.getJob(jobId);
  if (!job) throw new Error(`Job not found: ${jobId}`);

  const maps = await prisma.migrationIdMap.findMany({
    where: {
      migrationJobId: jobId,
      outcome: 'CREATED_BY_MIGRATION',
      targetModel: 'JournalEntry',
    },
    orderBy: { createdAt: 'desc' },
  });

  let deleted = 0;
  for (const map of maps) {
    const result = await prisma.journalEntry.deleteMany({
      where: { id: map.targetId, companyId: job.targetCompanyId },
    });
    deleted += result.count;
  }

  await prisma.migrationIdMap.deleteMany({
    where: { migrationJobId: jobId, targetModel: 'JournalEntry' },
  });
  await prisma.migrationCheckpoint.deleteMany({
    where: { migrationJobId: jobId, stage: 'ACCOUNTING' },
  });

  return { deletedJournals: deleted, deletedMappings: maps.length };
}

export async function rollbackCoa(prisma: PrismaClient, jobId: string) {
  const jobs = new MigrationJobService(prisma);
  const job = await jobs.getJob(jobId);
  if (!job) throw new Error(`Job not found: ${jobId}`);

  const maps = await prisma.migrationIdMap.findMany({
    where: {
      migrationJobId: jobId,
      outcome: 'CREATED_BY_MIGRATION',
      targetModel: 'Account',
    },
    orderBy: { createdAt: 'desc' },
  });

  const accounts = await prisma.account.findMany({
    where: { id: { in: maps.map((m) => m.targetId) }, companyId: job.targetCompanyId },
    select: { id: true, parentId: true, code: true },
  });
  const idSet = new Set(accounts.map((a) => a.id));
  const childrenCount = new Map<string, number>();
  for (const a of accounts) {
    if (a.parentId && idSet.has(a.parentId)) {
      childrenCount.set(a.parentId, (childrenCount.get(a.parentId) ?? 0) + 1);
    }
  }

  let deleted = 0;
  const remaining = new Set(idSet);
  while (remaining.size > 0) {
    const leaf = [...remaining].find((id) => {
      const kids = accounts.filter((a) => a.parentId === id && remaining.has(a.id));
      return kids.length === 0;
    });
    if (!leaf) break;
    await prisma.account.deleteMany({ where: { id: leaf, companyId: job.targetCompanyId } });
    remaining.delete(leaf);
    deleted += 1;
  }

  await prisma.migrationIdMap.deleteMany({
    where: { migrationJobId: jobId, targetModel: 'Account' },
  });

  return { deletedAccounts: deleted, deletedMappings: maps.length };
}

export async function rollbackFoundation(prisma: PrismaClient, jobId: string) {
  const jobs = new MigrationJobService(prisma);
  const job = await jobs.getJob(jobId);
  if (!job) throw new Error(`Job not found: ${jobId}`);

  const maps = await prisma.migrationIdMap.findMany({
    where: {
      migrationJobId: jobId,
      outcome: 'CREATED_BY_MIGRATION',
      targetModel: { in: [...FOUNDATION_MODELS] },
    },
    orderBy: { createdAt: 'desc' },
  });

  let deleted = 0;
  for (const m of maps) {
    const id = m.targetId;
    switch (m.targetModel) {
      case 'Warehouse':
        await prisma.warehouse.deleteMany({ where: { id, companyId: job.targetCompanyId } });
        break;
      case 'CostCenter':
        await prisma.costCenter.deleteMany({ where: { id, companyId: job.targetCompanyId } });
        break;
      case 'Currency':
        await prisma.currency.deleteMany({ where: { id, companyId: job.targetCompanyId } });
        break;
      case 'FiscalYear':
        await prisma.fiscalYear.deleteMany({ where: { id, companyId: job.targetCompanyId } });
        break;
      case 'Branch':
        await prisma.branch.deleteMany({ where: { id, companyId: job.targetCompanyId } });
        break;
      case 'Unit':
        await prisma.unit.deleteMany({ where: { id, companyId: job.targetCompanyId } });
        break;
      default:
        continue;
    }
    deleted += 1;
  }

  await prisma.migrationIdMap.deleteMany({
    where: { migrationJobId: jobId, targetModel: { in: [...FOUNDATION_MODELS] } },
  });
  await prisma.migrationCheckpoint.deleteMany({ where: { migrationJobId: jobId } });
  await jobs.transition(jobId, 'ROLLED_BACK');
  return { deletedMappings: maps.length, deletedEntities: deleted };
}

export async function rollbackParties(prisma: PrismaClient, jobId: string) {
  const jobs = new MigrationJobService(prisma);
  const job = await jobs.getJob(jobId);
  if (!job) throw new Error(`Job not found: ${jobId}`);

  const maps = await prisma.migrationIdMap.findMany({
    where: {
      migrationJobId: jobId,
      outcome: 'CREATED_BY_MIGRATION',
      targetModel: { in: ['Customer', 'Supplier', 'CustomerCategory', 'SupplierCategory'] },
    },
    orderBy: { createdAt: 'desc' },
  });

  let deleted = 0;
  for (const m of maps) {
    const id = m.targetId;
    switch (m.targetModel) {
      case 'Customer':
        await prisma.customer.deleteMany({ where: { id, companyId: job.targetCompanyId } });
        break;
      case 'Supplier':
        await prisma.supplier.deleteMany({ where: { id, companyId: job.targetCompanyId } });
        break;
      case 'CustomerCategory':
        await prisma.customerCategory.deleteMany({ where: { id, companyId: job.targetCompanyId } });
        break;
      case 'SupplierCategory':
        await prisma.supplierCategory.deleteMany({ where: { id, companyId: job.targetCompanyId } });
        break;
      default:
        continue;
    }
    deleted += 1;
  }

  await prisma.migrationIdMap.deleteMany({
    where: {
      migrationJobId: jobId,
      targetModel: { in: ['Customer', 'Supplier', 'CustomerCategory', 'SupplierCategory'] },
    },
  });

  return { deletedParties: deleted, deletedMappings: maps.length };
}

export async function rollbackCommercial(prisma: PrismaClient, jobId: string) {
  const jobs = new MigrationJobService(prisma);
  const job = await jobs.getJob(jobId);
  if (!job) throw new Error(`Job not found: ${jobId}`);

  const maps = await prisma.migrationIdMap.findMany({
    where: {
      migrationJobId: jobId,
      targetModel: 'Invoice',
      outcome: 'CREATED_BY_MIGRATION',
    },
  });
  const ids = maps.map((m) => m.targetId);
  if (ids.length) {
    await prisma.invoiceLine.deleteMany({ where: { invoiceId: { in: ids } } });
    await prisma.cashTransaction.updateMany({
      where: { invoiceId: { in: ids }, companyId: job.targetCompanyId },
      data: { invoiceId: null },
    });
    await prisma.invoice.deleteMany({ where: { id: { in: ids }, companyId: job.targetCompanyId } });
  }
  await prisma.migrationIdMap.deleteMany({
    where: { migrationJobId: jobId, targetModel: 'Invoice' },
  });
  await prisma.migrationCheckpoint.deleteMany({
    where: { migrationJobId: jobId, stage: 'COMMERCIAL' },
  });
  return { deletedInvoices: ids.length };
}

export async function rollbackSettlementHistorical(prisma: PrismaClient, jobId: string) {
  const jobs = new MigrationJobService(prisma);
  const job = await jobs.getJob(jobId);
  if (!job) throw new Error(`Job not found: ${jobId}`);

  const maps = await prisma.migrationIdMap.findMany({
    where: {
      migrationJobId: jobId,
      targetModel: 'PaymentAllocation',
      outcome: 'CREATED_BY_MIGRATION',
    },
  });
  const ids = maps.map((m) => m.targetId);
  if (ids.length) {
    await prisma.paymentAllocation.deleteMany({ where: { id: { in: ids }, companyId: job.targetCompanyId } });
  }
  await prisma.migrationIdMap.deleteMany({
    where: { migrationJobId: jobId, targetModel: 'PaymentAllocation' },
  });
  await prisma.migrationCheckpoint.deleteMany({
    where: { migrationJobId: jobId, stage: 'SETTLEMENT_HISTORICAL' },
  });
  return { deletedPaymentAllocations: ids.length };
}

export async function rollbackChequeHistorical(prisma: PrismaClient, jobId: string) {
  const jobs = new MigrationJobService(prisma);
  const job = await jobs.getJob(jobId);
  if (!job) throw new Error(`Job not found: ${jobId}`);

  const maps = await prisma.migrationIdMap.findMany({
    where: {
      migrationJobId: jobId,
      targetModel: 'Cheque',
      outcome: 'CREATED_BY_MIGRATION',
    },
  });
  const ids = maps.map((m) => m.targetId);
  if (ids.length) {
    await prisma.cheque.deleteMany({ where: { id: { in: ids }, companyId: job.targetCompanyId } });
  }
  await prisma.migrationIdMap.deleteMany({
    where: { migrationJobId: jobId, targetModel: 'Cheque' },
  });
  await prisma.migrationCheckpoint.deleteMany({
    where: { migrationJobId: jobId, stage: 'CHEQUE_HISTORICAL' },
  });
  return { deletedCheques: ids.length };
}

export async function rollbackTreasuryHistorical(prisma: PrismaClient, jobId: string) {
  const jobs = new MigrationJobService(prisma);
  const job = await jobs.getJob(jobId);
  if (!job) throw new Error(`Job not found: ${jobId}`);

  const maps = await prisma.migrationIdMap.findMany({
    where: {
      migrationJobId: jobId,
      targetModel: 'CashTransaction',
      outcome: 'CREATED_BY_MIGRATION',
    },
  });
  const ids = maps.map((m) => m.targetId);
  if (ids.length) {
    await prisma.cashTransactionLine.deleteMany({ where: { cashTransactionId: { in: ids } } });
    await prisma.cashTransaction.deleteMany({ where: { id: { in: ids }, companyId: job.targetCompanyId } });
  }
  await prisma.migrationIdMap.deleteMany({
    where: {
      migrationJobId: jobId,
      OR: [{ targetModel: 'CashTransaction' }, { targetModel: 'CashTransactionLine' }, { sourceEntity: 'CashTrxDetailLine' }],
    },
  });
  await prisma.migrationCheckpoint.deleteMany({
    where: { migrationJobId: jobId, stage: 'TREASURY_HISTORICAL' },
  });
  return { deletedCashTransactions: ids.length };
}
