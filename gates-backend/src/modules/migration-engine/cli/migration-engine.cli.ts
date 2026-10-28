#!/usr/bin/env tsx
import { PrismaClient } from '@prisma/client';
import { MigrationOrchestratorService } from '../services/migration-orchestrator.service';
import {
  migrationMilestones,
  overallImplementationPercent,
} from '../services/migration-progress.service';

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
    if (cmd === 'dry-run-accounting') {
      const jobId = rest[0];
      const result = await orchestrator.dryRunAccounting(jobId);
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    if (cmd === 'run-accounting') {
      const jobId = rest[0];
      const result = await orchestrator.runAccounting(jobId);
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    if (cmd === 'reconcile-accounting') {
      const jobId = rest[0];
      const result = await orchestrator.reconcileAccountingJob(jobId);
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    if (cmd === 'dry-run-items') {
      const jobId = rest[0];
      const result = await orchestrator.dryRunItems(jobId);
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    if (cmd === 'run-items') {
      const jobId = rest[0];
      const result = await orchestrator.runItems(jobId);
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    if (cmd === 'dry-run-inventory') {
      const jobId = rest[0];
      const result = await orchestrator.dryRunInventory(jobId);
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    if (cmd === 'run-inventory') {
      const jobId = rest[0];
      const result = await orchestrator.runInventory(jobId);
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    if (cmd === 'reconcile-inventory') {
      const jobId = rest[0];
      const result = await orchestrator.reconcileInventoryJob(jobId);
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    if (cmd === 'rollback') {
      const jobId = rest[0];
      const result = await orchestrator.rollback(jobId);
      console.log(JSON.stringify(result, null, 2));
      return;
    }
    if (cmd === 'status') {
      const jobId = rest[0];
      const milestones = migrationMilestones();
      const payload: Record<string, unknown> = {
        overallImplementationPercent: overallImplementationPercent(milestones),
        milestones,
      };
      if (jobId) {
        const job = await prisma.migrationJob.findUnique({
          where: { id: jobId },
          include: { checkpoints: true, _count: { select: { idMaps: true, issues: true } } },
        });
        payload.job = job;
      }
      console.log(JSON.stringify(payload, null, 2));
      return;
    }
    console.log(
      `Commands: create-job | analyze | dry-run | run-foundation | dry-run-coa | run-coa | reconcile-coa | dry-run-parties | run-parties | reconcile-parties | dry-run-accounting | run-accounting | reconcile-accounting | dry-run-items | run-items | dry-run-inventory | run-inventory | reconcile-inventory | rollback | status`
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
