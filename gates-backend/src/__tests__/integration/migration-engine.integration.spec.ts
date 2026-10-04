/**
 * DB-backed migration tests — requires:
 *   MIGRATION_PILOT_DATABASE_URL (from bootstrap-pilot-target.mjs)
 *   LEGACY_FORENSIC_URL
 *   MIGRATION_ENGINE_ENABLED=true
 */
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { MigrationOrchestratorService } from '../../modules/migration-engine/services/migration-orchestrator.service';
import { MigrationIdMapService } from '../../modules/migration-engine/services/migration-id-map.service';
import { MigrationJobService } from '../../modules/migration-engine/services/migration-job.service';
import { buildSourceKey, hashSourceKey } from '../../modules/migration-engine/source-key';

const pilotUrl = process.env.MIGRATION_PILOT_DATABASE_URL ?? process.env.DATABASE_URL;
const legacyUrl = process.env.LEGACY_FORENSIC_URL;
const enabled = process.env.MIGRATION_ENGINE_ENABLED === 'true';
const run = pilotUrl && legacyUrl && enabled ? describe : describe.skip;

run('migration-engine integration', () => {
  let prisma: PrismaClient;

  beforeAll(() => {
    process.env.DATABASE_URL = pilotUrl!;
    process.env.MIGRATION_ENGINE_ENABLED = 'true';
    prisma = new PrismaClient({ datasources: { db: { url: pilotUrl! } } });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('fingerprint mismatch refused', async () => {
    const orchestrator = new MigrationOrchestratorService(prisma);
    const company = await prisma.company.create({
      data: { arabicName: 'FP test', englishName: 'FP test' },
    });
    const job = await orchestrator.createPilotJob(company.id, '0001');
    await prisma.migrationJob.update({
      where: { id: job.id },
      data: { sourceFingerprint: 'bad' },
    });
    await expect(orchestrator.analyze(job.id)).rejects.toThrow(/fingerprint mismatch/i);
  });

  it('dry-run zero business writes', async () => {
    const orchestrator = new MigrationOrchestratorService(prisma);
    const company = await prisma.company.create({
      data: { arabicName: 'Dry', englishName: 'Dry' },
    });
    const before = await prisma.branch.count({ where: { companyId: company.id } });
    const job = await orchestrator.createPilotJob(company.id, '0001');
    await orchestrator.analyze(job.id);
    await orchestrator.dryRun(job.id);
    const after = await prisma.branch.count({ where: { companyId: company.id } });
    expect(after).toBe(before);
  });

  it('id map duplicate rejected', async () => {
    const idMap = new MigrationIdMapService(prisma);
    const job = await prisma.migrationJob.create({
      data: {
        targetCompanyId: randomUUID(),
        legacyCompanyCode: '0001',
        sourceType: 'TEST',
        sourceFingerprint: 'x',
        status: 'DRAFT',
      },
    });
    const key = { companyCode: '0001', branchCode: '01' };
    await idMap.recordMapping({
      jobId: job.id,
      sourceEntity: 'Branch',
      sourceKeyParts: key,
      targetModel: 'Branch',
      targetId: randomUUID(),
      outcome: 'CREATED_BY_MIGRATION',
    });
    const dup = await idMap.recordMapping({
      jobId: job.id,
      sourceEntity: 'Branch',
      sourceKeyParts: key,
      targetModel: 'Branch',
      targetId: randomUUID(),
      outcome: 'CREATED_BY_MIGRATION',
    });
    expect(dup.outcome).toBe('ALREADY_MAPPED');
  });

  it('state persisted on job', async () => {
    const jobs = new MigrationJobService(prisma);
    const job = await jobs.createJob({
      targetCompanyId: randomUUID(),
      legacyCompanyCode: '0001',
      sourceType: 'TEST',
      sourceFingerprint: 'st',
    });
    await jobs.transition(job.id, 'ANALYZING');
    await jobs.transition(job.id, 'READY_FOR_DRY_RUN');
    expect((await jobs.getJob(job.id))?.status).toBe('READY_FOR_DRY_RUN');
  });
});
