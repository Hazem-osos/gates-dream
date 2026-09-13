/**
 * Create demo item + customer for active companies missing ITEM-01.
 * Run: npm run seed:demo-catalog
 * Optional: COMPANY_ID=... for one company only
 */
import { PrismaClient } from '@prisma/client';
import { demoCatalogService } from '../src/modules/inventory/services/demo-catalog.service.js';
import { tenantProvisioningService } from '../src/modules/accounting/services/tenant-provisioning.service.js';

const prisma = new PrismaClient();

async function main() {
  const onlyId = process.env.COMPANY_ID?.trim();

  const companies = onlyId
    ? await prisma.company.findMany({
        where: { id: onlyId, isActive: true, deletedAt: null },
        select: { id: true, arabicName: true },
      })
    : await prisma.company.findMany({
        where: { isActive: true, deletedAt: null },
        select: { id: true, arabicName: true },
      });

  if (companies.length === 0) {
    throw new Error('No active company found');
  }

  for (const company of companies) {
    await tenantProvisioningService.provisionStandardTenant(company.id);
    const result = await demoCatalogService.ensureDemoCatalog(company.id);
    console.log(`OK ${company.arabicName} (${company.id})`, result);
  }

  await prisma.$disconnect();
  process.exit(0);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
