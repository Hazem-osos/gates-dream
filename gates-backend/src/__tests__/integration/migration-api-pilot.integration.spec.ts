/**
 * Runs only when LEGACY_FORENSIC_URL and MIGRATION_PILOT_DATABASE_URL are set.
 */
import { PrismaClient } from '@prisma/client';
import { MigrationPipelineService } from '../../modules/migration-engine/services/migration-pipeline.service';
import { MigrationOrchestratorService } from '../../modules/migration-engine/services/migration-orchestrator.service';

const legacyUrl = process.env.LEGACY_FORENSIC_URL;
const pilotUrl = process.env.MIGRATION_PILOT_DATABASE_URL;

const describePilot = legacyUrl && pilotUrl ? describe : describe.skip;

describePilot('migration API pilot integration', () => {
  let prisma: PrismaClient;

  beforeAll(() => {
    process.env.MIGRATION_ENGINE_ENABLED = 'true';
    process.env.DATABASE_URL = pilotUrl!;
    prisma = new PrismaClient();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('analyze → dry-run → execute preserves idempotent journal count on rerun', async () => {
    const company = await prisma.company.findFirst({ where: { deletedAt: null } });
    expect(company).toBeTruthy();

    const orchestrator = new MigrationOrchestratorService(prisma);
    const pipeline = new MigrationPipelineService(prisma);
    const job = await orchestrator.createPilotJob(company!.id, '0001');

    await pipeline.analyze(job.id);
    await pipeline.runPipeline(job.id, 'dry-run');
    await pipeline.runPipeline(job.id, 'execute');

    const count1 = await prisma.journalEntry.count({ where: { companyId: company!.id } });
    await pipeline.runPipeline(job.id, 'execute');
    const count2 = await prisma.journalEntry.count({ where: { companyId: company!.id } });
    expect(count2).toBe(count1);
  }, 1_800_000);
});
