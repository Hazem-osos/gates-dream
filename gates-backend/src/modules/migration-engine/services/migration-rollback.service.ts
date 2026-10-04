import type { PrismaClient } from '@prisma/client';
import { MigrationJobService } from './migration-job.service';

const FOUNDATION_MODELS = ['Warehouse', 'CostCenter', 'Currency', 'FiscalYear', 'Branch', 'Unit'] as const;

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
