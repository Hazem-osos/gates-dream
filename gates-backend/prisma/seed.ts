import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const prisma = new PrismaClient();

const COMPANY_ID = '00000000-0000-0000-0000-000000000001';

async function main() {
  // L5 fix (Item 41): this used to hash a fixed 'ChangeMe!1' literal — every
  // environment seeded from this script (including any accidentally run
  // against a shared/staging box) got the exact same committed
  // owner@example.com credential. SEED_OWNER_PASSWORD lets an operator pin
  // one explicitly; otherwise a random password is generated per run and
  // printed once so it isn't silently lost, and running against production
  // requires an explicit opt-in.
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_PROD_SEED !== 'true') {
    throw new Error(
      'Refusing to run prisma/seed.ts with NODE_ENV=production. Set ALLOW_PROD_SEED=true to override.'
    );
  }

  const company = await prisma.company.upsert({
    where: { id: COMPANY_ID },
    update: {},
    create: {
      id: COMPANY_ID,
      arabicName: 'شركة افتراضية',
      englishName: 'Default Company',
      isActive: true,
    },
  });

  const ownerPassword =
    process.env.SEED_OWNER_PASSWORD || crypto.randomBytes(9).toString('base64url');
  if (!process.env.SEED_OWNER_PASSWORD) {
    console.warn(
      `Generated random password for owner@example.com (set SEED_OWNER_PASSWORD to pin one): ${ownerPassword}`
    );
  }
  const passwordHash = await bcrypt.hash(ownerPassword, 10);

  const owner = await prisma.user.upsert({
    where: { email: 'owner@example.com' },
    update: {},
    create: {
      companyId: company.id,
      email: 'owner@example.com',
      username: 'owner',
      passwordHash,
    },
  });

  // Grant-all rows: required once API_AUTH_MODE=enforce, since a locally-issued
  // JWT carries no Keycloak roles and `authorize()` would otherwise deny everything.
  for (const action of ['view', 'edit', 'delete', 'approve', 'post']) {
    const existing = await prisma.userPermission.findFirst({
      where: { userId: owner.id, companyId: company.id, resource: '*', action },
      select: { id: true },
    });
    if (existing) {
      await prisma.userPermission.update({
        where: { id: existing.id },
        data: { allow: true },
      });
      continue;
    }
    await prisma.userPermission.create({
      data: {
        userId: owner.id,
        companyId: company.id,
        resource: '*',
        action,
        allow: true,
      },
    });
  }

  const period = await prisma.period.upsert({
    where: {
      companyId_code: { companyId: company.id, code: '2025-01' },
    },
    update: {},
    create: {
      companyId: company.id,
      code: '2025-01',
      name: 'يناير 2025',
      startDate: new Date('2025-01-01T00:00:00Z'),
      endDate: new Date('2025-01-31T23:59:59Z'),
      isActive: true,
      isClosed: false,
    },
  });

  for (let m = 1; m <= 12; m++) {
    const code = `2025-${String(m).padStart(2, '0')}`;
    const startDate = new Date(Date.UTC(2025, m - 1, 1, 0, 0, 0));
    const endDate = new Date(Date.UTC(2025, m, 0, 23, 59, 59));
    await prisma.period.upsert({
      where: { companyId_code: { companyId: company.id, code } },
      update: {},
      create: {
        companyId: company.id,
        code,
        name: code,
        startDate,
        endDate,
        isActive: true,
        isClosed: false,
      },
    });
  }

  const accounts: { code: string; arabicName: string; accountType: string }[] = [
    { code: '1000', arabicName: 'الصندوق', accountType: 'asset' },
    { code: '1100', arabicName: 'البنك', accountType: 'asset' },
    { code: '2000', arabicName: 'الموردون', accountType: 'liability' },
    { code: '3000', arabicName: 'حقوق الملكية', accountType: 'equity' },
    { code: '4000', arabicName: 'الإيرادات', accountType: 'revenue' },
    { code: '5000', arabicName: 'المصروفات', accountType: 'expense' },
  ];

  for (const a of accounts) {
    const existing = await prisma.account.findFirst({
      where: { companyId: company.id, code: a.code },
    });
    if (existing) continue;
    await prisma.account.create({
      data: {
        companyId: company.id,
        code: a.code,
        arabicName: a.arabicName,
        accountType: a.accountType,
        isActive: true,
      },
    });
  }

  await prisma.safe
    .create({
      data: {
        companyId: company.id,
        arabicName: 'خزينة رئيسية',
        currencyCode: 'SAR',
      },
    })
    .catch(() => {});

  await prisma.bank
    .create({
      data: {
        companyId: company.id,
        arabicName: 'بنك رئيسي',
      },
    })
    .catch(() => {});

  const currencies = [
    { code: 'SAR', arabicName: 'ريال سعودي', englishName: 'Saudi Riyal' },
    { code: 'USD', arabicName: 'دولار أمريكي', englishName: 'US Dollar' },
    { code: 'EUR', arabicName: 'يورو', englishName: 'Euro' },
    { code: 'AED', arabicName: 'درهم إماراتي', englishName: 'UAE Dirham' },
  ];

  for (const c of currencies) {
    await prisma.currency.upsert({
      where: { companyId_code: { companyId: company.id, code: c.code } },
      update: { arabicName: c.arabicName, englishName: c.englishName },
      create: {
        companyId: company.id,
        code: c.code,
        arabicName: c.arabicName,
        englishName: c.englishName,
        isActive: true,
      },
    });
  }

  console.log('Seed completed:', { companyId: company.id, periodId: period.id });
}

main().finally(async () => {
  await prisma.$disconnect();
});
