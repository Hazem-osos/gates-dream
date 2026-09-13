/**
 * One-off: create a demo login for the app owner (osama@gmail.com / 12345)
 * attached to the rich demo company (Gates Trading & Contracting), with the
 * same full admin permissions as hazem@gmail.com.
 *
 * Run: npx tsx scripts/create-osama-demo-user.ts
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const DEMO_COMPANY_ID = 'f3469e16-629a-43b0-a6cc-5302fd4cca10'; // Gates Trading & Contracting
const EMAIL = 'osama@gmail.com';
const USERNAME = 'osama';
const PASSWORD = '12345';

async function main() {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  const user = await prisma.user.upsert({
    where: { email: EMAIL },
    create: {
      companyId: DEMO_COMPANY_ID,
      email: EMAIL,
      username: USERNAME,
      passwordHash,
      firstName: 'Osama',
      lastName: null,
      isActive: true,
      preferredLanguage: 'ar',
    },
    update: {
      passwordHash,
      companyId: DEMO_COMPANY_ID,
      isActive: true,
    },
  });

  const actions: Array<'view' | 'edit' | 'delete' | 'approve' | 'post'> = [
    'view',
    'edit',
    'delete',
    'approve',
    'post',
  ];

  for (const action of actions) {
    const existing = await prisma.userPermission.findFirst({
      where: { userId: user.id, resource: '*', action, module: null, branchId: null },
    });
    if (existing) {
      await prisma.userPermission.update({
        where: { id: existing.id },
        data: { allow: true, companyId: DEMO_COMPANY_ID },
      });
    } else {
      await prisma.userPermission.create({
        data: { userId: user.id, companyId: DEMO_COMPANY_ID, resource: '*', action, allow: true },
      });
    }
  }

  // Branch access — data queries are branch-scoped, so grant every branch
  // of the demo company (mirrors hazem@gmail.com's access).
  const branches = await prisma.branch.findMany({
    where: { companyId: DEMO_COMPANY_ID },
    select: { id: true },
  });
  for (const branch of branches) {
    await prisma.userBranchPermission.upsert({
      where: { userId_branchId: { userId: user.id, branchId: branch.id } },
      create: { userId: user.id, branchId: branch.id, companyId: DEMO_COMPANY_ID },
      update: {},
    });
  }

  console.log(
    JSON.stringify(
      { userId: user.id, email: user.email, companyId: user.companyId, branches: branches.map((b) => b.id) },
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
  .finally(() => prisma.$disconnect());
