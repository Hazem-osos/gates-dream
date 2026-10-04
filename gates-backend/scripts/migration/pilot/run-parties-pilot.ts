#!/usr/bin/env tsx
/**
 * Foundation → COA → Parties pilot (LegacyForensic 0001).
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
  if (!company) throw new Error('Pilot company 0001 not found — bootstrap foundation first');

  const job = await orchestrator.createPilotJob(company.id, '0001');
  await orchestrator.analyze(job.id);
  await orchestrator.dryRun(job.id);
  await orchestrator.runFoundation(job.id);
  await orchestrator.dryRunCoa(job.id);
  await orchestrator.runCoa(job.id);

  const partiesDry = await orchestrator.dryRunParties(job.id);
  console.log('dry-run-parties', partiesDry.summary);

  const partiesRun = await orchestrator.runParties(job.id);
  console.log('run-parties', partiesRun.report.sourceCounts);
  console.log('reconcile', partiesRun.reconcile.postPartyGlReadiness);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
