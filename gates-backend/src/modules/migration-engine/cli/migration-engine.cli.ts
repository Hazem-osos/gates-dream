#!/usr/bin/env tsx
import { PrismaClient } from '@prisma/client';
import { MigrationOrchestratorService } from '../services/migration-orchestrator.service';

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const prisma = new PrismaClient();
  const orchestrator = new MigrationOrchestratorService(prisma);

  try {
    if (cmd === 'create-job') {
      const targetCompanyId = rest[0];
      const legacyCode = rest[1] ?? '0001';
      if (!targetCompanyId) throw new Error('Usage: create-job <targetCompanyId> [legacyCompanyCode]');
      const job = await orchestrator.createPilotJob(targetCompanyId, legacyCode);
      console.log(JSON.stringify(job, null, 2));
      return;
    }
    if (cmd === 'analyze') {
      const jobId = rest[0];
      const result = await orchestrator.analyze(jobId);
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    if (cmd === 'dry-run') {
      const jobId = rest[0];
      const report = await orchestrator.dryRun(jobId);
      console.log(JSON.stringify(report, null, 2));
      return;
    }
    if (cmd === 'run-foundation') {
      const jobId = rest[0];
      const report = await orchestrator.runFoundation(jobId);
      console.log(JSON.stringify(report, null, 2));
      return;
    }
    if (cmd === 'dry-run-coa') {
      const jobId = rest[0];
      const report = await orchestrator.dryRunCoa(jobId);
      console.log(JSON.stringify(report, null, 2));
      return;
    }
    if (cmd === 'run-coa') {
      const jobId = rest[0];
      const result = await orchestrator.runCoa(jobId);
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    if (cmd === 'dry-run-parties') {
      const jobId = rest[0];
      const result = await orchestrator.dryRunParties(jobId);
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    if (cmd === 'run-parties') {
      const jobId = rest[0];
      const result = await orchestrator.runParties(jobId);
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    if (cmd === 'reconcile-parties') {
      const jobId = rest[0];
      const result = await orchestrator.reconcilePartiesJob(jobId);
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    if (cmd === 'reconcile-coa') {
      const jobId = rest[0];
      const result = await orchestrator.reconcileCoaJob(jobId);
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    if (cmd === 'rollback') {
      const jobId = rest[0];
      const result = await orchestrator.rollback(jobId);
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    console.log(
      `Commands: create-job | analyze | dry-run | run-foundation | dry-run-coa | run-coa | reconcile-coa | dry-run-parties | run-parties | reconcile-parties | rollback`
    );
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
