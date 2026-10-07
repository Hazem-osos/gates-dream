/**
 * Run: npx ts-node scripts/hcm-backfill-proof.ts <companyId>
 * Applies backfill twice and prints counts (local/disposable DB only).
 */
import { PrismaClient } from '@prisma/client';
import { hcmBackfillService } from '../src/modules/hr/services/hcm/hcm-backfill.service';

const companyId = process.argv[2];
if (!companyId) {
  console.error('Usage: npx ts-node scripts/hcm-backfill-proof.ts <companyId>');
  process.exit(1);
}

const prisma = new PrismaClient();

async function main() {
  const employeesExamined = await prisma.employee.count({
    where: { companyId, isActive: true },
  });
  const run1 = await hcmBackfillService.backfillCompany(companyId);
  const run2 = await hcmBackfillService.backfillCompany(companyId);
  const employments = await prisma.hcmEmployment.count({ where: { companyId } });
  const assignments = await prisma.hcmEmploymentAssignment.count({ where: { companyId } });
  const compensations = await prisma.hcmCompensationAssignment.count({ where: { companyId } });

  console.log('HCM BACKFILL PROOF');
  console.log('companyId:', companyId);
  console.log('employeesExamined:', employeesExamined);
  console.log('run1:', run1);
  console.log('run2:', run2);
  console.log('totals:', { employments, assignments, compensations });
  console.log('secondRunDuplicates:', {
    employmentsCreated: run2.employmentsCreated,
    assignmentsCreated: run2.assignmentsCreated,
    compensationsCreated: run2.compensationsCreated,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
