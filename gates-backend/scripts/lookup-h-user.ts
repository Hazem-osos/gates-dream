import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { email: { equals: 'h@gmail.com' } },
        { email: { equals: 'hazem@gmail.com' } },
        { email: { contains: 'h@gmail' } },
        { username: { in: ['h', 'hazem'] } },
      ],
    },
    select: {
      id: true,
      email: true,
      username: true,
      companyId: true,
      isActive: true,
      firstName: true,
      lastName: true,
    },
  });
  console.log('MATCHES', JSON.stringify(users, null, 2));

  const all = await prisma.user.findMany({
    select: { email: true, username: true, companyId: true },
    orderBy: { email: 'asc' },
  });
  console.log('ALL_USERS', all.length);
  for (const u of all) {
    console.log(` - ${u.email} | ${u.username} | ${u.companyId}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
