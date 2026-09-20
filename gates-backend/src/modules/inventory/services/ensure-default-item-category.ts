import { Prisma } from '@prisma/client';

export const UNGROUPED_ITEM_CATEGORY_CODE = 'UNG';
export const UNGROUPED_ITEM_CATEGORY_NAME = 'بدون مجموعة';

/** Catch-all group for items created without a chosen category. */
export async function ensureDefaultUngroupedCategory(
  companyId: string,
  client: Prisma.TransactionClient
) {
  const existing = await client.itemCategory.findFirst({
    where: {
      companyId,
      OR: [{ code: UNGROUPED_ITEM_CATEGORY_CODE }, { arabicName: UNGROUPED_ITEM_CATEGORY_NAME }],
    },
    orderBy: { createdAt: 'asc' },
  });
  if (existing) {
    if (!existing.isActive) {
      return client.itemCategory.update({
        where: { id: existing.id },
        data: { isActive: true },
      });
    }
    return existing;
  }

  try {
    return await client.itemCategory.create({
      data: {
        companyId,
        code: UNGROUPED_ITEM_CATEGORY_CODE,
        arabicName: UNGROUPED_ITEM_CATEGORY_NAME,
        englishName: 'Ungrouped',
        isActive: true,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const raced = await client.itemCategory.findFirst({
        where: {
          companyId,
          OR: [{ code: UNGROUPED_ITEM_CATEGORY_CODE }, { arabicName: UNGROUPED_ITEM_CATEGORY_NAME }],
        },
      });
      if (raced) return raced;
    }
    throw error;
  }
}
