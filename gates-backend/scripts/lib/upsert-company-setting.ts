import type { PrismaClient } from '@prisma/client';

/**
 * `CompanySettingEntry`'s unique constraint became `(companyId, branchId, name)`
 * once `CustomersAccount` branch-scoping shipped (foundation-account-slots /
 * foundation-settings-engine) — Prisma's `upsert`/`findUnique` can't target a
 * compound key with a `null` field, so every seeding script needs this
 * `findFirst` + create/update instead of the old `companyId_name` upsert.
 */
export async function upsertCompanySetting(
  prisma: PrismaClient,
  companyId: string,
  name: string,
  value: string
): Promise<void> {
  const existing = await prisma.companySettingEntry.findFirst({
    where: { companyId, branchId: null, name },
    select: { id: true },
  });
  if (existing) {
    await prisma.companySettingEntry.update({ where: { id: existing.id }, data: { value } });
  } else {
    await prisma.companySettingEntry.create({ data: { companyId, branchId: null, name, value } });
  }
}
