#!/usr/bin/env tsx
/**
 * Phase 2 COA pilot — requires LEGACY_FORENSIC_URL + MIGRATION_PILOT_DATABASE_URL.
 */
import { PrismaClient } from '@prisma/client';
import { MigrationOrchestratorService } from '../../../src/modules/migration-engine/services/migration-orchestrator.service';

async function main() {
  process.env.MIGRATION_ENGINE_ENABLED = 'true';
  const pilotUrl = process.env.MIGRATION_PILOT_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!pilotUrl) throw new Error('Set MIGRATION_PILOT_DATABASE_URL');
  if (!process.env.LEGACY_FORENSIC_URL) throw new Error('Set LEGACY_FORENSIC_URL');

  process.env.DATABASE_URL = pilotUrl;
  const prisma = new PrismaClient();
  const orchestrator = new MigrationOrchestratorService(prisma);

  const company = await prisma.company.findFirst({
    where: { legacyCompanyCode: '0001' },
    orderBy: { createdAt: 'desc' },
  });
  if (!company) throw new Error('No pilot company with legacyCompanyCode 0001 — run foundation pilot first');

  const job = await orchestrator.createPilotJob(company.id, '0001');
  console.log('job', job.id);

  const analysis = await orchestrator.analyze(job.id);
  console.log('analyze', JSON.stringify(analysis.coaPreview, null, 2));

  await orchestrator.dryRun(job.id);
  await orchestrator.runFoundation(job.id);
  const dryCoa = await orchestrator.dryRunCoa(job.id);
  console.log('dry-run-coa', dryCoa);

  const before = await prisma.account.count({ where: { companyId: company.id } });
  const run = await orchestrator.runCoa(job.id);
  const after = await prisma.account.count({ where: { companyId: company.id } });
  console.log('run-coa accounts', { before, after, created: after - before });
  console.log('reconcile', JSON.stringify(run.reconcile, null, 2));

  const dry2 = await orchestrator.dryRunCoa(job.id);
  console.log('second dry-run simulated', dry2.simulated);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
