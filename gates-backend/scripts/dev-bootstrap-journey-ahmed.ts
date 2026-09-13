/**
 * Fresh customer-journey test user: ahmed@gmail.com
 * Run: npm run seed:journey-ahmed
 * Password: set DEV_BOOTSTRAP_PASSWORD, or a random one is generated and printed.
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const prisma = new PrismaClient();

// L5 fix (Item 41): refuse to run against a production database — this
// script grants `resource: '*'` (every action) to a well-known email.
if (process.env.NODE_ENV === 'production') {
  console.error('Refusing to run dev-bootstrap-journey-ahmed.ts with NODE_ENV=production.');
  process.exit(1);
}

const EMAIL = 'ahmed@gmail.com';
const USERNAME = 'ahmed';
// L5 fix (Item 41): was a hardcoded '12345' committed credential.
const PASSWORD = process.env.DEV_BOOTSTRAP_PASSWORD || crypto.randomBytes(9).toString('base64url');
const COMPANY_EN = 'Ahmed Journey Test Co';

const EMPTY_LAUNCH_CHECKLIST = {
  createdFirstInvoice: false,
  addedFirstCustomer: false,
  createdFirstItem: false,
  recordedFirstReceipt: false,
  dismissed: false,
  companySetupComplete: false,
};

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

async function removeExistingJourneyUser() {
  const existing = await prisma.user.findUnique({ where: { email: EMAIL } });
  if (!existing) return;

  await prisma.userPermission.deleteMany({ where: { userId: existing.id } });
  await prisma.userBranchPermission.deleteMany({ where: { userId: existing.id } });
  await prisma.userAdvancedPermission.deleteMany({ where: { userId: existing.id } });
  await prisma.userGroupMember.deleteMany({ where: { userId: existing.id } });
  await prisma.user.delete({ where: { id: existing.id } });
  console.log('Removed previous user:', EMAIL);
}

async function retirePreviousJourneyCompanies() {
  const previous = await prisma.company.findMany({
    where: { englishName: COMPANY_EN, deletedAt: null },
  });
  for (const co of previous) {
    await prisma.company.update({
      where: { id: co.id },
      data: { deletedAt: new Date(), isActive: false },
    });
    console.log('Retired previous journey company:', co.id);
  }
}

async function main() {
  await removeExistingJourneyUser();
  await retirePreviousJourneyCompanies();

  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  const company = await prisma.company.create({
    data: {
      arabicName: 'شركة أحمد — اختبار الرحلة',
      englishName: COMPANY_EN,
      contactEmail: EMAIL,
      phone1: '01000000001',
      isActive: true,
      isOnboarded: false,
      onboardedAt: null,
      onboardingStep: 1,
      hasCompletedTour: false,
      launchChecklist: EMPTY_LAUNCH_CHECKLIST,
    },
  });
  console.log('Created fresh company:', company.id);

  await prisma.companySettings.create({
    data: {
      companyId: company.id,
      defaultCurrency: 'EGP',
      advancedSettings: {},
    },
  });

  const user = await prisma.user.create({
    data: {
      companyId: company.id,
      email: EMAIL,
      username: USERNAME,
      passwordHash,
      firstName: 'Ahmed',
      lastName: 'Test',
      preferredLanguage: 'ar',
      isActive: true,
    },
  });

  await grantAll(user.id, company.id);

  console.log('\n--- Customer journey test account ---');
  console.log('Login: http://localhost:3000/login');
  console.log('Email or username:', EMAIL, '/', USERNAME);
  console.log('Password:', PASSWORD);
  console.log('Company ID:', company.id);
  console.log('Onboarding: isOnboarded=false → wizard at /onboarding after login');
  console.log('\nTip: clear site localStorage (gates_tenant_*) or use incognito for a clean browser session.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
