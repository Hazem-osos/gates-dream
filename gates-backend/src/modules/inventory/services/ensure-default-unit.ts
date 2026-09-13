import type { Prisma } from '@prisma/client';

/** Default sell/stock unit every tenant needs — created with company basics and COA seed. */
export async function ensureDefaultPieceUnit(
  companyId: string,
  client: Prisma.TransactionClient
) {
  const existing = await client.unit.findFirst({
    where: { companyId, OR: [{ code: 'PCS' }, { arabicName: 'قطعة' }] },
  });
  if (existing) {
    if (!existing.code) {
      return client.unit.update({
        where: { id: existing.id },
        data: { code: 'PCS', isActive: true },
      });
    }
    if (!existing.isActive) {
      return client.unit.update({
        where: { id: existing.id },
        data: { isActive: true },
      });
    }
    return existing;
  }

  return client.unit.create({
    data: {
      companyId,
      code: 'PCS',
      arabicName: 'قطعة',
      englishName: 'Piece',
      isActive: true,
    },
  });
}
