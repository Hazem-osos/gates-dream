import prisma from '../../../shared/database/prisma';

export async function searchPosPostingAccounts(companyId: string, search: string, limit = 20) {
  const take = Math.min(Math.max(limit, 1), 50);
  const term = search.trim();
  return prisma.account.findMany({
    where: {
      companyId,
      deletedAt: null,
      isActive: true,
      accountKind: 'POSTING',
      children: { none: { deletedAt: null } },
      ...(term
        ? {
            OR: [
              { arabicName: { contains: term } },
              { englishName: { contains: term } },
              { code: { contains: term } },
            ],
          }
        : {}),
    },
    select: { id: true, code: true, arabicName: true, accountType: true },
    orderBy: [{ code: 'asc' }],
    take,
  });
}
