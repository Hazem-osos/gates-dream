/**
 * Fresh empty tenant + admin login for a@gmail.com (standard COA/branch, no demo catalog).
 *
 *   DATABASE_URL=... NODE_ENV=production npx tsx scripts/restore-a-empty-tenant.ts
 *
 * Run after wipe-entire-database.ts (DB must have no users).
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { tenantProvisioningService } from '../src/modules/accounting/services/tenant-provisioning.service.js';
import { licenseSubscriptionService } from '../src/modules/platform/services/license-subscription.service.js';
import { LICENSE_MODULE_CODES } from '../src/modules/platform/types/license-modules.js';

const prisma = new PrismaClient();

const EMAIL = 'a@gmail.com';
const USERNAME = 'a';
const PASSWORD = process.env.RESTORE_A_PASSWORD || '12345';

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
    throw new Error(`${EMAIL} already exists — run wipe-entire-database.ts first`);
  }

  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  const company = await prisma.company.create({
    data: {
      arabicName: 'شركة افتراضية',
      englishName: 'Default Company',
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
      firstName: 'Admin',
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

  console.log(
    JSON.stringify(
      {
        ok: true,
        email: EMAIL,
        username: USERNAME,
        temporaryPassword: PASSWORD,
        companyId: company.id,
        userId: user.id,
        provision,
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
