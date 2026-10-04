/**
 * Wipe operational data for hazem@gmail.com's company.
 * Keeps the login user(s), company, settings, branches, and permissions.
 *
 * Run: npx tsx scripts/wipe-hazem-company-data.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TARGET_EMAIL = process.env.WIPE_USER_EMAIL;
if (!TARGET_EMAIL) {
  throw new Error('Set WIPE_USER_EMAIL before running this script.');
}

const KEEP_TABLES = new Set([
  'companies',
  'users',
  'company_settings',
  'branches',
  'user_permissions',
  'user_advanced_permissions',
  'user_branch_permissions',
  'user_groups',
  'user_group_members',
]);

type ColRow = { TABLE_NAME: string };
type FkRow = {
  TABLE_NAME: string;
  COLUMN_NAME: string;
  REFERENCED_TABLE_NAME: string;
  REFERENCED_COLUMN_NAME: string;
};

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: TARGET_EMAIL },
    select: { id: true, email: true, username: true, companyId: true },
  });
  if (!user) {
    throw new Error(`User not found: ${TARGET_EMAIL}`);
  }

  const companyUsers = await prisma.user.findMany({
    where: { companyId: user.companyId },
    select: { email: true, username: true },
  });

  const company = await prisma.company.findUnique({
    where: { id: user.companyId },
    select: { id: true, arabicName: true, englishName: true },
  });

  console.log('Target user:', user.email, user.username);
  console.log('Company:', company?.arabicName, company?.englishName, user.companyId);
  console.log(
    'Users kept on company:',
    companyUsers.map((u) => u.email).join(', '),
  );

  const tables = await prisma.$queryRaw<ColRow[]>`
    SELECT TABLE_NAME
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND COLUMN_NAME = 'companyId'
    ORDER BY TABLE_NAME
  `;

  const fks = await prisma.$queryRaw<FkRow[]>`
    SELECT TABLE_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
    FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE()
      AND REFERENCED_TABLE_NAME IS NOT NULL
  `;

  await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 0');

  await prisma.branch.updateMany({
    where: { companyId: user.companyId },
    data: { defaultWarehouseId: null, defaultSafeId: null },
  });
  await prisma.companySettings.updateMany({
    where: { companyId: user.companyId },
    data: { roundingAccountId: null, exchangeGainLossAccountId: null },
  });

  const deleted: Record<string, number> = {};

  for (const { TABLE_NAME } of tables) {
    if (KEEP_TABLES.has(TABLE_NAME)) continue;
    const result = await prisma.$executeRawUnsafe(
      `DELETE FROM \`${TABLE_NAME}\` WHERE \`companyId\` = ?`,
      user.companyId,
    );
    if (result > 0) deleted[TABLE_NAME] = result;
  }

  // Orphan children of wiped parents (tables without companyId).
  const wipedParents = new Set(
    tables.map((t) => t.TABLE_NAME).filter((name) => !KEEP_TABLES.has(name)),
  );
  for (const fk of fks) {
    if (!wipedParents.has(fk.REFERENCED_TABLE_NAME)) continue;
    if (KEEP_TABLES.has(fk.TABLE_NAME)) continue;
    const sql = `DELETE c FROM \`${fk.TABLE_NAME}\` c
      LEFT JOIN \`${fk.REFERENCED_TABLE_NAME}\` p
        ON p.\`${fk.REFERENCED_COLUMN_NAME}\` = c.\`${fk.COLUMN_NAME}\`
      WHERE c.\`${fk.COLUMN_NAME}\` IS NOT NULL AND p.\`${fk.REFERENCED_COLUMN_NAME}\` IS NULL`;
    const result = await prisma.$executeRawUnsafe(sql);
    if (result > 0) {
      deleted[`${fk.TABLE_NAME} (orphans via ${fk.COLUMN_NAME})`] =
        (deleted[`${fk.TABLE_NAME} (orphans via ${fk.COLUMN_NAME})`] || 0) + result;
    }
  }

  await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1');

  const leftoverUser = await prisma.user.findUnique({
    where: { email: user.email },
    select: { id: true, email: true, username: true, isActive: true, companyId: true },
  });
  const leftoverCounts = {
    invoices: await prisma.invoice.count({ where: { companyId: user.companyId } }),
    journals: await prisma.journalEntry.count({ where: { companyId: user.companyId } }),
    cash: await prisma.cashTransaction.count({ where: { companyId: user.companyId } }),
    items: await prisma.item.count({ where: { companyId: user.companyId } }),
    accounts: await prisma.account.count({ where: { companyId: user.companyId } }),
    customers: await prisma.customer.count({ where: { companyId: user.companyId } }),
    users: await prisma.user.count({ where: { companyId: user.companyId } }),
  };

  console.log('Deleted rows:', deleted);
  console.log('Login user still there:', leftoverUser);
  console.log('Leftover operational counts:', leftoverCounts);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1');
    } catch {
      // ignore
    }
    await prisma.$disconnect();
  });
