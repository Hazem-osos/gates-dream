import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { email: { equals: 'b@gmail.com' } },
        { email: { contains: 'b@gmail' } },
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
  for (const user of users) {
    const company = await prisma.company.findUnique({
      where: { id: user.companyId },
      select: { arabicName: true, englishName: true },
    });
    const counts = {
      users: await prisma.user.count({ where: { companyId: user.companyId } }),
      invoices: await prisma.invoice.count({ where: { companyId: user.companyId } }),
      journals: await prisma.journalEntry.count({ where: { companyId: user.companyId } }),
      items: await prisma.item.count({ where: { companyId: user.companyId } }),
      customers: await prisma.customer.count({ where: { companyId: user.companyId } }),
      accounts: await prisma.account.count({ where: { companyId: user.companyId } }),
    };
    console.log('COMPANY', JSON.stringify(company), 'COUNTS', JSON.stringify(counts));
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
