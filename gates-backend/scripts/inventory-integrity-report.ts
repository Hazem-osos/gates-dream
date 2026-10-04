/**
 * Read-only stock integrity report.
 * Compares ItemWarehouseBalance, ItemQuantity, InventoryMovement, warehouse cost,
 * and inventory-account GL. Never writes, never repairs.
 *
 * Run: npm run report:inventory-integrity
 * Optional: COMPANY_ID=<uuid>
 */
import { Prisma, PrismaClient } from '@prisma/client';
import { env } from '../src/shared/config/env';
import {
  classifyInventoryTriple,
  classifyValuationGap,
  inventoryTripleKey,
  type InventoryMismatchClass,
} from '../src/modules/inventory/services/inventory-integrity';

const prisma = new PrismaClient({ datasources: { db: { url: env.DATABASE_URL } } });

type QtyRow = {
  companyId: string;
  itemId: string;
  warehouseId: string;
  qty: unknown;
  averageCost?: unknown;
};

function num(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'object' && value !== null && 'toNumber' in value) {
    return (value as { toNumber: () => number }).toNumber();
  }
  return Number(value) || 0;
}

async function main() {
  const rawCompany = process.env.COMPANY_ID?.trim() ?? '';
  const companyFilter = /^[0-9a-f-]{36}$/i.test(rawCompany) ? rawCompany : '';
  const companySql = companyFilter ? Prisma.sql`AND companyId = ${companyFilter}` : Prisma.empty;
  const companyWhere = companyFilter ? Prisma.sql`WHERE w.companyId = ${companyFilter}` : Prisma.empty;
  const historyWhere = companyFilter ? Prisma.sql`WHERE h.companyId = ${companyFilter}` : Prisma.empty;
  const glWhere = companyFilter ? Prisma.sql`AND a.companyId = ${companyFilter}` : Prisma.empty;

  const [balances, quantities, movements, nullDupes, histories] = await Promise.all([
    prisma.$queryRaw<QtyRow[]>`
      SELECT companyId, itemId, warehouseId, quantityOnHand AS qty, averageCost
      FROM item_warehouse_balances
      WHERE 1=1 ${companySql}
    `,
    prisma.$queryRaw<QtyRow[]>`
      SELECT w.companyId AS companyId, iq.itemId AS itemId, iq.warehouseId AS warehouseId,
             SUM(iq.quantity) AS qty
      FROM item_quantities iq
      INNER JOIN warehouses w ON w.id = iq.warehouseId
      INNER JOIN items i ON i.id = iq.itemId AND i.companyId = w.companyId
      ${companyWhere}
      GROUP BY w.companyId, iq.itemId, iq.warehouseId
    `,
    prisma.$queryRaw<QtyRow[]>`
      SELECT companyId, itemId, warehouseId, SUM(quantityDelta) AS qty
      FROM inventory_movements
      WHERE 1=1 ${companySql}
      GROUP BY companyId, itemId, warehouseId
    `,
    prisma.$queryRaw<QtyRow[]>`
      SELECT w.companyId AS companyId, iq.itemId AS itemId, iq.warehouseId AS warehouseId,
             COUNT(*) AS qty
      FROM item_quantities iq
      INNER JOIN warehouses w ON w.id = iq.warehouseId
      INNER JOIN items i ON i.id = iq.itemId AND i.companyId = w.companyId
      WHERE iq.locationId IS NULL ${companyFilter ? Prisma.sql`AND w.companyId = ${companyFilter}` : Prisma.empty}
      GROUP BY w.companyId, iq.itemId, iq.warehouseId
      HAVING COUNT(*) > 1
    `,
    prisma.$queryRaw<Array<{ companyId: string; itemId: string; cost: unknown }>>`
      SELECT h.companyId, h.itemId, h.cost
      FROM item_cost_history h
      INNER JOIN (
        SELECT companyId, itemId, MAX(serial) AS serial
        FROM item_cost_history
        GROUP BY companyId, itemId
      ) latest ON latest.companyId = h.companyId AND latest.itemId = h.itemId AND latest.serial = h.serial
      ${historyWhere}
    `,
  ]);

  const qtyByKey = new Map<string, number>();
  for (const row of quantities) qtyByKey.set(inventoryTripleKey(row.companyId, row.itemId, row.warehouseId), num(row.qty));
  const moveByKey = new Map<string, number>();
  for (const row of movements) moveByKey.set(inventoryTripleKey(row.companyId, row.itemId, row.warehouseId), num(row.qty));
  const nullDupByKey = new Map<string, number>();
  for (const row of nullDupes) nullDupByKey.set(inventoryTripleKey(row.companyId, row.itemId, row.warehouseId), num(row.qty));
  const balanceByKey = new Map<string, QtyRow>();
  for (const row of balances) balanceByKey.set(inventoryTripleKey(row.companyId, row.itemId, row.warehouseId), row);

  const keys = new Set<string>([...balanceByKey.keys(), ...qtyByKey.keys(), ...moveByKey.keys(), ...nullDupByKey.keys()]);
  const counts: Record<string, number> = {};
  const samples: Array<{ key: string; classes: InventoryMismatchClass[]; locationQty: number; warehouseOnHand: number; movementQty: number }> = [];

  for (const id of keys) {
    const [companyId, itemId, warehouseId] = id.split('|');
    const balance = balanceByKey.get(id);
    const classes = classifyInventoryTriple({
      companyId,
      itemId,
      warehouseId,
      locationQty: qtyByKey.get(id) ?? 0,
      warehouseOnHand: balance ? num(balance.qty) : 0,
      movementQty: moveByKey.get(id) ?? 0,
      nullLocationRowCount: nullDupByKey.get(id) ?? 0,
      warehouseAverageCost: balance ? num(balance.averageCost) : null,
    });
    for (const klass of classes) counts[klass] = (counts[klass] ?? 0) + 1;
    if (!classes.includes('IN_SYNC') && samples.length < 40) {
      samples.push({
        key: id,
        classes,
        locationQty: qtyByKey.get(id) ?? 0,
        warehouseOnHand: balance ? num(balance.qty) : 0,
        movementQty: moveByKey.get(id) ?? 0,
      });
    }
  }

  const gl = await prisma.$queryRaw<Array<{ companyId: string; net: unknown }>>`
    SELECT a.companyId AS companyId, SUM(l.debitBase - l.creditBase) AS net
    FROM journal_entry_lines l
    INNER JOIN journal_entries e ON e.id = l.journalEntryId
    INNER JOIN accounts a ON a.id = l.accountId
    INNER JOIN warehouses w ON w.inventoryAccountId = a.id AND w.companyId = a.companyId
    WHERE e.isPosted = 1 AND e.isCancelled = 0 AND e.deletedAt IS NULL
    ${glWhere}
    GROUP BY a.companyId
  `;
  const valuation = await prisma.$queryRaw<Array<{ companyId: string; value: unknown }>>`
    SELECT companyId, SUM(quantityOnHand * averageCost) AS value
    FROM item_warehouse_balances
    WHERE quantityOnHand > 0 ${companySql}
    GROUP BY companyId
  `;
  const glByCompany = new Map(gl.map((row) => [row.companyId, num(row.net)]));
  const valuationGap = valuation.map((row) => {
    const stockValue = num(row.value);
    const glNet = glByCompany.get(row.companyId) ?? 0;
    return {
      companyId: row.companyId,
      stockValue,
      glNet,
      classification: classifyValuationGap(stockValue, glNet),
      note: 'Informational only. GL is not rewritten to match stock, and stock is not rewritten to match GL.',
    };
  });

  console.log(
    JSON.stringify(
      {
        readOnly: true,
        repairsApplied: false,
        companyId: companyFilter || 'all',
        triples: keys.size,
        classCounts: counts,
        samples,
        costHistoryRows: histories.length,
        valuationGap,
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
