/**
 * Read-only check before `20260930180000_pos_one_open_shift`.
 * Prints terminals that already have more than one OPEN PosShift.
 * Does not update or delete rows. Exit 1 when conflicts exist.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const open = await prisma.posShift.findMany({
    where: { status: 'OPEN' },
    select: { id: true, companyId: true, terminalId: true, openedAt: true, userId: true },
    orderBy: [{ companyId: 'asc' }, { terminalId: 'asc' }, { openedAt: 'asc' }],
  });

  const groups = new Map<string, typeof open>();
  for (const row of open) {
    const key = `${row.companyId}|${row.terminalId}`;
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }

  const conflicts = [...groups.values()].filter((rows) => rows.length > 1);
  if (conflicts.length === 0) {
    console.log(`OK: ${open.length} OPEN pos_shifts, no duplicate terminal.`);
    return;
  }

  console.error(`CONFLICT: ${conflicts.length} terminal(s) have more than one OPEN shift.`);
  for (const rows of conflicts) {
    console.error(JSON.stringify(rows, null, 2));
  }
  console.error('Do not auto-close these rows. Keep one OPEN session per terminal, then re-run.');
  process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
