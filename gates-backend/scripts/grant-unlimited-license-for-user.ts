#!/usr/bin/env tsx
/**
 * Grant all licensed verticals + high limits for a user's company (default h@gmail.com).
 *
 *   npx tsx scripts/grant-unlimited-license-for-user.ts h@gmail.com
 *   railway ssh --service gates-backend -- npx tsx scripts/grant-unlimited-license-for-user.ts h@gmail.com
 */
import { PrismaClient } from '@prisma/client';
import { LICENSE_MODULE_CODES } from '../src/modules/platform/types/license-modules';
import { licenseSubscriptionService } from '../src/modules/platform/services/license-subscription.service';

const prisma = new PrismaClient();
const email = (process.argv[2] || 'h@gmail.com').trim().toLowerCase();

async function main() {
  const user = await prisma.user.findFirst({
    where: { email },
    select: { id: true, email: true, companyId: true },
  });
  if (!user?.companyId) {
    throw new Error(`No user with company for email: ${email}`);
  }

  const company = await prisma.company.findUnique({
    where: { id: user.companyId },
    select: { id: true, arabicName: true },
  });

  const row = await licenseSubscriptionService.activate({
    companyId: user.companyId,
    planType: 'LIFETIME',
    status: 'ACTIVE',
    startDate: new Date(),
    expiryDate: null,
    allowedModules: [...LICENSE_MODULE_CODES],
    maxBranches: 9999,
    maxUsers: 9999,
    maxStorageMb: 999_999,
    licenseKey: `unlimited-${email}`,
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        email: user.email,
        companyId: user.companyId,
        companyName: company?.arabicName ?? null,
        subscriptionId: row.id,
        allowedModules: LICENSE_MODULE_CODES,
        maxBranches: row.maxBranches,
        maxUsers: row.maxUsers,
        maxStorageMb: row.maxStorageMb,
      },
      null,
      2
    )
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
