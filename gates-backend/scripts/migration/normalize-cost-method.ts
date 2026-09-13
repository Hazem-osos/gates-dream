/**
 * C8 fix — one-off data normalization.
 *
 * The costing engine (item-cost.service.ts) has only ever computed a
 * moving average; 'fifo' and 'lifo' were accepted by the API/UI but had
 * zero effect on how COGS or inventory value was actually calculated.
 * Any tenant that previously "chose" fifo/lifo was being lied to — their
 * inventory was averaged the whole time. This script makes the stored
 * setting match reality so reports/UI stop claiming an unimplemented
 * costing method is in effect.
 *
 * Read-only by default; pass --apply to write the changes.
 *
 * Run: tsx scripts/migration/normalize-cost-method.ts [--apply]
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');

async function main() {
  const stray = await prisma.companySettings.findMany({
    where: { costMethod: { in: ['fifo', 'lifo'] } },
    select: { companyId: true, costMethod: true },
  });

  if (stray.length === 0) {
    console.log('No companies have a stray fifo/lifo costMethod setting. Nothing to do.');
    return;
  }

  console.log(`Found ${stray.length} company(ies) with an unimplemented costMethod:`);
  for (const row of stray) {
    console.log(`  - ${row.companyId}: ${row.costMethod} -> average`);
  }

  if (!APPLY) {
    console.log('\nDry run only — re-run with --apply to write these changes.');
    return;
  }

  const result = await prisma.companySettings.updateMany({
    where: { costMethod: { in: ['fifo', 'lifo'] } },
    data: { costMethod: 'average' },
  });
  console.log(`\nUpdated ${result.count} company setting row(s) to costMethod='average'.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
