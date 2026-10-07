/**
 * Recreate b@gmail.com + empty company shell (standard COA/branch/warehouse, no demo catalog).
 *
 *   DATABASE_URL=... NODE_ENV=production npx tsx scripts/restore-b-empty-tenant.ts
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { tenantProvisioningService } from '../src/modules/accounting/services/tenant-provisioning.service.js';
import { licenseSubscriptionService } from '../src/modules/platform/services/license-subscription.service.js';
import { LICENSE_MODULE_CODES } from '../src/modules/platform/types/license-modules.js';

const prisma = new PrismaClient();

const EMAIL = 'b@gmail.com';
const USERNAME = 'b';
const PASSWORD = process.env.RESTORE_B_PASSWORD || '12345';

async function grantAdmin(userId: string, companyId: string) {
  const actions: Array<'view' | 'edit' | 'delete' | 'approve' | 'post'> = [
    'view',
    'edit',
    'delete',
    'approve',
    'post',
  ];
  for (const action of actions) {
    const existing = await prisma.userPermission.findFirst({
      where: { userId, resource: '*', action, module: null, branchId: null },
    });
    if (existing) {
      await prisma.userPermission.update({
        where: { id: existing.id },
        data: { allow: true, companyId },
      });
    } else {
      await prisma.userPermission.create({
        data: { userId, companyId, resource: '*', action, allow: true },
      });
    }
  }
}

async function main() {
  const existing = await prisma.user.findUnique({ where: { email: EMAIL } });
  if (existing) {
    throw new Error(`${EMAIL} already exists — run wipe only, do not restore`);
  }

  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  const company = await prisma.company.create({
    data: {
      arabicName: 'شركة الباء',
      englishName: 'Company B',
      isActive: true,
      isOnboarded: true,
      onboardedAt: new Date(),
    },
  });

  const provision = await tenantProvisioningService.provisionStandardTenant(company.id);
  if (!provision.branchId) {
    throw new Error('Tenant provisioning did not return branchId');
  }

  const user = await prisma.user.create({
    data: {
      companyId: company.id,
      email: EMAIL,
      username: USERNAME,
      passwordHash,
      firstName: 'Company B',
      isActive: true,
      preferredLanguage: 'ar',
    },
  });

  await grantAdmin(user.id, company.id);

  const branches = await prisma.branch.findMany({
    where: { companyId: company.id },
    select: { id: true },
  });
  for (const branch of branches) {
    await prisma.userBranchPermission.create({
      data: { userId: user.id, branchId: branch.id, companyId: company.id },
    });
  }

  await licenseSubscriptionService.activate({
    companyId: company.id,
    planType: 'LIFETIME',
    status: 'ACTIVE',
    startDate: new Date(),
    expiryDate: null,
    allowedModules: [...LICENSE_MODULE_CODES],
    maxBranches: 9999,
    maxUsers: 9999,
    maxStorageMb: 999_999,
    licenseKey: `unlimited-${EMAIL}`,
  });

  const counts = {
    items: await prisma.item.count({ where: { companyId: company.id } }),
    invoices: await prisma.invoice.count({ where: { companyId: company.id } }),
    journals: await prisma.journalEntry.count({ where: { companyId: company.id } }),
    accounts: await prisma.account.count({ where: { companyId: company.id } }),
  };

  console.log(
    JSON.stringify(
      {
        ok: true,
        email: EMAIL,
        username: USERNAME,
        companyId: company.id,
        userId: user.id,
        temporaryPassword: PASSWORD,
        provision,
        counts,
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
