/**
 * DANGER: Deletes ALL application data. Keeps _prisma_migrations only.
 *
 *   CONFIRM_WIPE_ALL=yes DATABASE_URL=... npx tsx scripts/wipe-entire-database.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  if (process.env.CONFIRM_WIPE_ALL !== 'yes') {
    throw new Error('Set CONFIRM_WIPE_ALL=yes to run full database wipe');
  }

  const tables = await prisma.$queryRaw<Array<{ TABLE_NAME: string }>>`
    SELECT TABLE_NAME
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_TYPE = 'BASE TABLE'
      AND TABLE_NAME != '_prisma_migrations'
    ORDER BY TABLE_NAME
  `;

  await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 0');
  for (const { TABLE_NAME } of tables) {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE \`${TABLE_NAME}\``);
  }
  await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1');

  console.log(JSON.stringify({ ok: true, truncatedTables: tables.length }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    try {
      await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1');
    } catch {
      // ignore
    }
    await prisma.$disconnect();
  });
