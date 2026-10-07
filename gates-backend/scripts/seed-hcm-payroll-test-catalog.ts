/**
 * Seed deterministic TEST payroll catalog for a company (local/dev only).
 * Usage: COMPANY_ID=<uuid> npx ts-node scripts/seed-hcm-payroll-test-catalog.ts
 */
import { PrismaClient } from '@prisma/client';
import { seedTestPayrollCatalog } from '../src/modules/hr/services/payroll/hcm-payroll-setup.service';

const prisma = new PrismaClient();

async function main() {
  const companyId = process.env.COMPANY_ID;
  if (!companyId) {
    throw new Error('Set COMPANY_ID env var');
  }
  const result = await seedTestPayrollCatalog(companyId);
  console.log('Seeded TEST payroll catalog for', companyId, result);
}

main()
  .finally(() => prisma.$disconnect());
