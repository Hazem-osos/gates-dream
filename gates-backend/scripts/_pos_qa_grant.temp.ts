import prisma from '../src/shared/database/prisma';

const companyId = '00000000-0000-0000-0000-000000000001';
const ids = ['2b7fb8ea-5a62-47bb-b488-cac832de3689', 'ae589913-05ce-4167-98a3-7cbe80eb10df'];
for (const userId of ids) {
  const existing = await prisma.userPermission.findFirst({
    where: { userId, companyId, resource: 'branch', action: 'view' },
  });
  if (!existing) {
    await prisma.userPermission.create({
      data: { userId, companyId, resource: 'branch', action: 'view', allow: true },
    });
  }
}
console.log('ok');
await prisma.$disconnect();
