/**
 * READ-ONLY reconciliation report.
 *
 * Measures data drift introduced by the bugs fixed in the P1 accounting/inventory
 * audit (unpost not reversing MAC, commercial-paper cancel not reversing party
 * balance, etc.).  This script never writes to the database.
 *
 * Run locally:
 *   npx tsx scripts/reconciliation-report.ts [companyId]
 *
 * Run on Railway:
 *   railway ssh --service gates-backend --environment production -- \
 *     npx tsx scripts/reconciliation-report.ts [companyId]
 *
 * Outputs a JSON report to stdout.  Never exposes secrets or writes data.
 */

import prisma from '../src/shared/database/prisma';
import { replayItemCostHistory } from '../src/modules/inventory/services/inventory-costing-math';

const TARGET_COMPANY = process.argv[2] ?? null;

function round4(n: number) {
  return Math.round(n * 10_000) / 10_000;
}

function toNum(v: unknown) {
  const n = Number(v);
  return isFinite(n) ? n : 0;
}

// ─── 1. Inventory cost drift ─────────────────────────────────────────────────

async function checkItemCostDrift(companyId: string) {
  const balances = await prisma.itemWarehouseBalance.findMany({
    where: { companyId },
    select: {
      itemId: true,
      warehouseId: true,
      averageCost: true,
      item: { select: { arabicName: true, code: true } },
      warehouse: { select: { arabicName: true } },
    },
  });

  const itemIds = [...new Set(balances.map((b) => b.itemId))];
  const driftRows: Array<{
    itemId: string;
    itemName: string;
    warehouseId: string;
    warehouseName: string;
    storedCost: number;
    replayedCost: number;
    drift: number;
  }> = [];

  for (const itemId of itemIds) {
    const movements = await prisma.inventoryMovement.findMany({
      where: { companyId, itemId },
      orderBy: [{ documentDate: 'asc' }, { effectiveAt: 'asc' }, { createdAt: 'asc' }],
      select: {
        warehouseId: true,
        quantityDelta: true,
        unitCost: true,
        movementType: true,
      },
    });

    if (movements.length === 0) continue;

    const replay = replayItemCostHistory(
      movements.map((m) => ({
        warehouseId: m.warehouseId,
        quantityDelta: toNum(m.quantityDelta),
        unitCost: toNum(m.unitCost),
        movementType: m.movementType ?? '',
      }))
    );

    const itemBalances = balances.filter((b) => b.itemId === itemId);
    for (const bal of itemBalances) {
      const replayedState = replay.warehouses[bal.warehouseId];
      const replayedCost = replayedState ? round4(replayedState.averageCost) : 0;
      const storedCost = round4(toNum(bal.averageCost));
      const drift = round4(Math.abs(replayedCost - storedCost));
      if (drift > 0.01) {
        driftRows.push({
          itemId,
          itemName: bal.item?.arabicName ?? '?',
          warehouseId: bal.warehouseId,
          warehouseName: bal.warehouse?.arabicName ?? '?',
          storedCost,
          replayedCost,
          drift,
        });
      }
    }
  }

  driftRows.sort((a, b) => b.drift - a.drift);
  return driftRows;
}

// ─── 2. Party balance drift ───────────────────────────────────────────────────

async function checkCustomerBalanceDrift(companyId: string) {
  // Compute AR balance from posted, non-cancelled journal lines via customer's
  // mainAccountId or accountId.
  const customers = await prisma.customer.findMany({
    where: { companyId },
    select: {
      id: true,
      arabicName: true,
      code: true,
      balance: true,
      mainAccountId: true,
      accountId: true,
    },
  });

  const driftRows: Array<{
    customerId: string;
    customerName: string;
    cachedBalance: number;
    ledgerBalance: number;
    drift: number;
  }> = [];

  for (const cust of customers) {
    const acctId = cust.mainAccountId ?? cust.accountId;
    if (!acctId) continue;

    const agg = await prisma.journalEntryLine.aggregate({
      where: {
        accountId: acctId,
        journalEntry: {
          companyId,
          isPosted: true,
          isCancelled: false,
          deletedAt: null,
        },
      },
      _sum: { debit: true, credit: true },
    });

    const ledgerBalance = round4(toNum(agg._sum.debit) - toNum(agg._sum.credit));
    const cachedBalance = round4(toNum(cust.balance));
    const drift = round4(Math.abs(ledgerBalance - cachedBalance));
    if (drift > 0.01) {
      driftRows.push({
        customerId: cust.id,
        customerName: cust.arabicName,
        cachedBalance,
        ledgerBalance,
        drift,
      });
    }
  }

  driftRows.sort((a, b) => b.drift - a.drift);
  return driftRows;
}

async function checkSupplierBalanceDrift(companyId: string) {
  const suppliers = await prisma.supplier.findMany({
    where: { companyId },
    select: {
      id: true,
      arabicName: true,
      code: true,
      balance: true,
      mainAccountId: true,
      accountId: true,
    },
  });

  const driftRows: Array<{
    supplierId: string;
    supplierName: string;
    cachedBalance: number;
    ledgerBalance: number;
    drift: number;
  }> = [];

  for (const sup of suppliers) {
    const acctId = sup.mainAccountId ?? sup.accountId;
    if (!acctId) continue;

    const agg = await prisma.journalEntryLine.aggregate({
      where: {
        accountId: acctId,
        journalEntry: {
          companyId,
          isPosted: true,
          isCancelled: false,
          deletedAt: null,
        },
      },
      _sum: { debit: true, credit: true },
    });

    // Supplier accounts are credit-normal: AP = credit - debit
    const ledgerBalance = round4(toNum(agg._sum.credit) - toNum(agg._sum.debit));
    const cachedBalance = round4(toNum(sup.balance));
    const drift = round4(Math.abs(ledgerBalance - cachedBalance));
    if (drift > 0.01) {
      driftRows.push({
        supplierId: sup.id,
        supplierName: sup.arabicName,
        cachedBalance,
        ledgerBalance,
        drift,
      });
    }
  }

  driftRows.sort((a, b) => b.drift - a.drift);
  return driftRows;
}

// ─── 3. Unbalanced journal entries ───────────────────────────────────────────

async function checkUnbalancedEntries(companyId: string) {
  const entries = await prisma.$queryRawUnsafe<
    Array<{ id: string; debitTotal: number; creditTotal: number; drift: number }>
  >(`
    SELECT
      je.id,
      ROUND(SUM(COALESCE(jel.debit, 0)), 4)  AS debitTotal,
      ROUND(SUM(COALESCE(jel.credit, 0)), 4) AS creditTotal,
      ABS(ROUND(SUM(COALESCE(jel.debit, 0)), 4) - ROUND(SUM(COALESCE(jel.credit, 0)), 4)) AS drift
    FROM journal_entries je
    JOIN journal_entry_lines jel ON jel.journalEntryId = je.id
    WHERE je.companyId = ?
      AND je.isPosted = 1
      AND je.isCancelled = 0
      AND je.deletedAt IS NULL
    GROUP BY je.id
    HAVING drift > 0.0001
    ORDER BY drift DESC
    LIMIT 50
  `, companyId);

  return entries.map((e) => ({
    journalEntryId: e.id,
    debitTotal: toNum(e.debitTotal),
    creditTotal: toNum(e.creditTotal),
    drift: toNum(e.drift),
  }));
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const companies = TARGET_COMPANY
    ? [{ id: TARGET_COMPANY, arabicName: TARGET_COMPANY }]
    : await prisma.company.findMany({
        where: { deletedAt: null },
        select: { id: true, arabicName: true },
      });

  const report: Record<string, unknown> = {
    generatedAt: new Date().toISOString(),
    companies: [],
  };

  for (const co of companies) {
    process.stderr.write(`Checking ${co.arabicName} (${co.id})…\n`);

    const [itemCostDrift, customerDrift, supplierDrift, unbalancedJEs] = await Promise.all([
      checkItemCostDrift(co.id),
      checkCustomerBalanceDrift(co.id),
      checkSupplierBalanceDrift(co.id),
      checkUnbalancedEntries(co.id),
    ]);

    (report.companies as unknown[]).push({
      companyId: co.id,
      companyName: co.arabicName,
      summary: {
        itemsWithCostDrift: itemCostDrift.length,
        customersWithBalanceDrift: customerDrift.length,
        suppliersWithBalanceDrift: supplierDrift.length,
        unbalancedPostedJournalEntries: unbalancedJEs.length,
      },
      details: {
        itemCostDrift: itemCostDrift.slice(0, 20),
        customerBalanceDrift: customerDrift.slice(0, 20),
        supplierBalanceDrift: supplierDrift.slice(0, 20),
        unbalancedJournalEntries: unbalancedJEs.slice(0, 20),
      },
    });
  }

  console.log(JSON.stringify(report, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
