/**
 * One-off dev bootstrap: company + user hazem@gmail.com
 * Run: npx tsx scripts/dev-bootstrap-hazem.ts
 * Password: set DEV_BOOTSTRAP_PASSWORD, or a random one is generated and printed.
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const prisma = new PrismaClient();

// L5 fix (Item 41): refuse to run against a production database — this
// script grants `resource: '*'` (every action) to a well-known email.
if (process.env.NODE_ENV === 'production') {
  console.error('Refusing to run dev-bootstrap-hazem.ts with NODE_ENV=production.');
  process.exit(1);
}

const EMAIL = 'hazem@gmail.com';
const USERNAME = 'hazem';
// L5 fix (Item 41): was a hardcoded '12345' committed credential.
const PASSWORD = process.env.DEV_BOOTSTRAP_PASSWORD || crypto.randomBytes(9).toString('base64url');

async function grantAll(userId: string, companyId: string) {
  for (const action of ['view', 'edit', 'delete', 'approve', 'post'] as const) {
    const existing = await prisma.userPermission.findFirst({
      where: { userId, companyId, resource: '*', action },
    });
    if (existing) {
      await prisma.userPermission.update({
        where: { id: existing.id },
        data: { allow: true },
      });
    } else {
      await prisma.userPermission.create({
        data: { userId, companyId, resource: '*', action, allow: true },
      });
    }
  }
}

async function main() {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  let company = await prisma.company.findFirst({
    where: { englishName: 'Hazem Test Co' },
  });

  if (!company) {
    company = await prisma.company.create({
      data: {
        arabicName: 'شركة حازم للاختبار',
        englishName: 'Hazem Test Co',
        contactEmail: EMAIL,
        phone1: '01000000000',
        isActive: true,
      },
    });
    console.log('Created company:', company.id);
  } else {
    console.log('Using existing company:', company.id);
  }

  await prisma.companySettings.upsert({
    where: { companyId: company.id },
    create: { companyId: company.id, defaultCurrency: 'EGP' },
    update: { defaultCurrency: 'EGP' },
  });

  let branch = await prisma.branch.findFirst({
    where: { companyId: company.id },
  });
  if (!branch) {
    branch = await prisma.branch.create({
      data: {
        companyId: company.id,
        arabicName: 'الفرع الرئيسي',
        branchNumber: '1',
      },
    });
    console.log('Created branch:', branch.id);
  }

  const user = await prisma.user.upsert({
    where: { email: EMAIL },
    update: {
      passwordHash,
      companyId: company.id,
      isActive: true,
      firstName: 'Hazem',
    },
    create: {
      companyId: company.id,
      email: EMAIL,
      username: USERNAME,
      passwordHash,
      firstName: 'Hazem',
      preferredLanguage: 'ar',
      isActive: true,
    },
  });

  await grantAll(user.id, company.id);

  await prisma.userBranchPermission.upsert({
    where: { userId_branchId: { userId: user.id, branchId: branch.id } },
    create: { userId: user.id, branchId: branch.id, companyId: company.id },
    update: {},
  });

  console.log('\n--- Ready to test ---');
  console.log('Login URL: http://localhost:3000/login');
  console.log('Email or username:', EMAIL, ' / ', USERNAME);
  console.log('Password:', PASSWORD);
  console.log('Company ID (X-Company-Id):', company.id);
  console.log('Branch ID (X-Branch-Id):', branch.id);
  console.log('\nEnsure backend .env has KEYCLOAK_ENABLED=false and JWT_DEV_SECRET set.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
