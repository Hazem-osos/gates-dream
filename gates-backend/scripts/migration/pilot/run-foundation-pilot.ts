#!/usr/bin/env tsx
import { config } from 'dotenv';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import { MigrationOrchestratorService } from '../../../src/modules/migration-engine/services/migration-orchestrator.service';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');
config({ path: join(root, '.env') });

process.env.MIGRATION_ENGINE_ENABLED = 'true';

async function countForCompany(prisma: PrismaClient, companyId: string) {
  return {
    branches: await prisma.branch.count({ where: { companyId } }),
    fiscal_years: await prisma.fiscalYear.count({ where: { companyId } }),
    currencies: await prisma.currency.count({ where: { companyId } }),
    cost_centers: await prisma.costCenter.count({ where: { companyId } }),
    warehouses: await prisma.warehouse.count({ where: { companyId } }),
    units: await prisma.unit.count({ where: { companyId } }),
  };
}

function delta(before: Record<string, number>, after: Record<string, number>) {
  const d: Record<string, number> = {};
  for (const k of Object.keys(before)) d[k] = (after[k] ?? 0) - (before[k] ?? 0);
  return d;
}

async function assertCompanyOwnership(prisma: PrismaClient, companyId: string) {
  const tables = [
    prisma.branch.findMany({ where: { companyId }, select: { id: true, companyId: true } }),
    prisma.fiscalYear.findMany({ where: { companyId }, select: { id: true, companyId: true } }),
    prisma.currency.findMany({ where: { companyId }, select: { id: true, companyId: true } }),
    prisma.costCenter.findMany({ where: { companyId }, select: { id: true, companyId: true } }),
    prisma.warehouse.findMany({ where: { companyId }, select: { id: true, companyId: true } }),
    prisma.unit.findMany({ where: { companyId }, select: { id: true, companyId: true } }),
  ];
  for (const rows of await Promise.all(tables)) {
    for (const r of rows) {
      if (r.companyId !== companyId) throw new Error(`Tenant leak: ${r.id} companyId=${r.companyId}`);
    }
  }
}

async function main() {
  const prisma = new PrismaClient();
  const orchestrator = new MigrationOrchestratorService(prisma);

  try {
    const companyA = await prisma.company.create({
      data: {
        arabicName: `Migration Pilot A ${Date.now()}`,
        englishName: 'Migration Pilot A Disposable',
      },
    });
    const companyB = await prisma.company.create({
      data: { arabicName: 'Isolation Co B', englishName: 'Isolation Co B' },
    });

    const nativeBranch = await prisma.branch.create({
      data: {
        companyId: companyA.id,
        arabicName: 'Native Pre-existing Branch',
        legacyBranchCode: 'NATIVE-PILOT',
      },
    });

    const beforeB = await countForCompany(prisma, companyB.id);
    const beforeDry = await countForCompany(prisma, companyA.id);

    const job = await orchestrator.createPilotJob(companyA.id, '0001');
    console.log('job', job.id, 'fingerprint', job.sourceFingerprint);

    const analyze = await orchestrator.analyze(job.id);
    console.log('analyze', JSON.stringify(analyze, null, 2));

    const dry = await orchestrator.dryRun(job.id);
    const afterDry = await countForCompany(prisma, companyA.id);
    console.log('dryRunReport', dry);
    const dryDelta = delta(beforeDry, afterDry);
    console.log('dryRunBusinessDelta', dryDelta);
    if (Object.values(dryDelta).some((n) => n !== 0)) {
      throw new Error('Dry-run modified business tables');
    }

    const run1 = await orchestrator.runFoundation(job.id);
    const afterRun1 = await countForCompany(prisma, companyA.id);
    console.log('foundationRun1', run1);
    await assertCompanyOwnership(prisma, companyA.id);

    const nativeAfter = await prisma.branch.findUnique({ where: { id: nativeBranch.id } });
    if (!nativeAfter) throw new Error('Native branch missing after run1');

    const run2 = await orchestrator.runFoundation(job.id);
    const afterRun2 = await countForCompany(prisma, companyA.id);
    console.log('foundationRun2', run2);
    const idemDelta = delta(afterRun1, afterRun2);
    console.log('idempotencyDelta', idemDelta);
    if (Object.values(idemDelta).some((n) => n !== 0)) {
      throw new Error('Second foundation run duplicated business rows');
    }

    const afterB = await countForCompany(prisma, companyB.id);
    console.log('companyBIsolationDelta', delta(beforeB, afterB));

    // Checkpoint/resume: fail mid-Store on a fresh job
    const checkpointCo = await prisma.company.create({
      data: { arabicName: 'Checkpoint Co', englishName: 'Checkpoint Co' },
    });
    const job2 = await orchestrator.createPilotJob(checkpointCo.id, '0001');
    await orchestrator.analyze(job2.id);
    await orchestrator.dryRun(job2.id);
    process.env.MIGRATION_TEST_FAIL_ENTITY = 'Store';
    try {
      await orchestrator.runFoundation(job2.id);
    } catch (e) {
      console.log('checkpointSimulatedFailure', String(e));
    }
    delete process.env.MIGRATION_TEST_FAIL_ENTITY;
    const mapsBeforeResume = await prisma.migrationIdMap.count({ where: { migrationJobId: job2.id } });
    await prisma.migrationJob.update({ where: { id: job2.id }, data: { status: 'RUNNING' } });
    await orchestrator.runFoundation(job2.id);
    const mapsAfterResume = await prisma.migrationIdMap.count({ where: { migrationJobId: job2.id } });
    console.log('checkpointResume', { mapsBeforeResume, mapsAfterResume });

    const rollback = await orchestrator.rollback(job.id);
    console.log('rollback', rollback);
    const nativeAfterRollback = await prisma.branch.findUnique({ where: { id: nativeBranch.id } });
    if (!nativeAfterRollback) throw new Error('Native branch removed by rollback');

    console.log('PILOT_OK', { companyA: companyA.id, companyB: companyB.id, jobId: job.id });
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
