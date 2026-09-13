/**
 * Phase 0 — quantify existing data corruption (READ-ONLY, real tenant data).
 *
 *   1. Duplicate account codes per company (C7).
 *   2. Duplicate invoice numbers per company/branch/fiscalYear/invoiceType (C7).
 *   3. Invoices carrying withholding tax, and whether they were ever
 *      successfully posted (proxy for the C2/WHT-double-subtraction bug).
 *   4. Posted journal entries that are not balanced at 4dp (should never
 *      happen given validateDoubleEntryBalance, but checked directly).
 *   5. Multiple *posted* journal entries sharing the same source document
 *      (sourceType/sourceNumber/sourceYearId) — duplicate-posting proxy (H2).
 *   6. "Poisoned" average cost candidates: items whose current average cost
 *      exactly matches (or is implausibly close to) a SALE line's *price*
 *      rather than a PURCHASE line's cost — evidence of C1 (returns valued
 *      at selling price instead of cost).
 *
 * Run: npm run recon:corruption
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function section(title: string) {
  console.log(`\n${'─'.repeat(72)}\n${title}\n${'─'.repeat(72)}`);
}

async function duplicateAccountCodes() {
  section('[1] Duplicate account codes (C7 — no @@unique([companyId, code]))');
  const rows = await prisma.account.groupBy({
    by: ['companyId', 'code'],
    where: { deletedAt: null },
    _count: { _all: true },
    having: { code: { _count: { gt: 1 } } },
  });
  if (rows.length === 0) {
    console.log('  none found');
  } else {
    for (const r of rows) {
      console.log(`  company=${r.companyId} code="${r.code}" occurrences=${r._count._all}`);
    }
  }
  return rows.length;
}

async function duplicateInvoiceNumbers() {
  section('[2] Duplicate invoice numbers per company/branch/fiscalYear/invoiceType (C7)');
  const invoices = await prisma.invoice.findMany({
    where: { invoiceNumber: { not: null } },
    select: { companyId: true, branchId: true, fiscalYearId: true, invoiceType: true, invoiceNumber: true, id: true },
  });
  const groups = new Map<string, string[]>();
  for (const inv of invoices) {
    const key = `${inv.companyId}|${inv.branchId ?? '-'}|${inv.fiscalYearId ?? '-'}|${inv.invoiceType}|${inv.invoiceNumber}`;
    const arr = groups.get(key) ?? [];
    arr.push(inv.id);
    groups.set(key, arr);
  }
  let dupCount = 0;
  for (const [key, ids] of groups) {
    if (ids.length > 1) {
      dupCount++;
      console.log(`  ${key} -> ${ids.length} invoices (ids: ${ids.join(', ')})`);
    }
  }
  if (dupCount === 0) console.log('  none found');
  return dupCount;
}

async function withholdingTaxHealth() {
  section('[3] Withholding-tax invoices — posting health (proxy for WHT double-subtraction bug)');
  const withWht = await prisma.invoice.findMany({
    where: { withholdingTaxAmount: { gt: 0 } },
    select: {
      id: true,
      companyId: true,
      invoiceNumber: true,
      invoiceKind: true,
      isPosted: true,
      netAmount: true,
      withholdingTaxAmount: true,
    },
  });
  console.log(`  Total invoices with withholdingTaxAmount > 0: ${withWht.length}`);
  const posted = withWht.filter((i) => i.isPosted);
  const unposted = withWht.filter((i) => !i.isPosted);
  console.log(`  Posted: ${posted.length}  |  Never posted (stuck as draft): ${unposted.length}`);
  for (const i of unposted) {
    console.log(
      `    STUCK: company=${i.companyId} invoice=${i.invoiceNumber ?? i.id} kind=${i.invoiceKind} ` +
        `net=${i.netAmount} wht=${i.withholdingTaxAmount} — likely cannot post without the Phase 3 fix ` +
        '(WHT is subtracted twice; JE never balances).'
    );
  }
  return { total: withWht.length, stuck: unposted.length };
}

async function unbalancedPostedJournals() {
  section('[4] Posted journal entries not balanced at 4dp (sanity check)');
  const entries = await prisma.journalEntry.findMany({
    where: { isPosted: true, isCancelled: false, deletedAt: null },
    select: { id: true, companyId: true, sourceType: true, sourceNumber: true, lines: { select: { debitBase: true, creditBase: true } } },
  });
  let bad = 0;
  for (const e of entries) {
    const debit = e.lines.reduce((s, l) => s + Number(l.debitBase), 0);
    const credit = e.lines.reduce((s, l) => s + Number(l.creditBase), 0);
    if (Math.abs(debit - credit) > 0.0001) {
      bad++;
      console.log(`  UNBALANCED JE ${e.id} company=${e.companyId} source=${e.sourceType}/${e.sourceNumber} debit=${debit} credit=${credit}`);
    }
  }
  console.log(`  Checked ${entries.length} posted journal entries; ${bad} unbalanced.`);
  return bad;
}

async function duplicatePostedJournalsPerSource() {
  section('[5] Multiple posted journal entries sharing the same source document (H2 proxy)');
  const rows = await prisma.journalEntry.groupBy({
    by: ['companyId', 'sourceType', 'sourceNumber', 'sourceYearId'],
    where: { isPosted: true, isCancelled: false, deletedAt: null, sourceType: { not: null }, sourceNumber: { not: null } },
    _count: { _all: true },
    having: { sourceNumber: { _count: { gt: 1 } } },
  });
  if (rows.length === 0) {
    console.log('  none found');
  } else {
    for (const r of rows) {
      console.log(
        `  company=${r.companyId} source=${r.sourceType}/${r.sourceNumber}/${r.sourceYearId} -> ${r._count._all} posted JEs`
      );
    }
  }
  return rows.length;
}

async function poisonedAverageCostCandidates() {
  section('[6] Poisoned average-cost candidates (C1 — SALE_RETURN re-valued at selling price)');
  // For each SALE_RETURN line, compare the line's unit price against the item
  // cost-history entry recorded around that same document. If the item's cost
  // jumped to (approximately) the return's selling price right after the
  // return posted, that is direct evidence of C1.
  const returns = await prisma.invoice.findMany({
    where: { invoiceKind: 'SALE_RETURN', isPosted: true },
    select: {
      id: true,
      companyId: true,
      invoiceNumber: true,
      date: true,
      lines: { select: { itemId: true, price: true, quantity: true } },
    },
    take: 500,
  });
  let flagged = 0;
  for (const ret of returns) {
    for (const line of ret.lines) {
      const costEntry = await prisma.itemCostHistory.findFirst({
        where: {
          companyId: ret.companyId,
          itemId: line.itemId,
          sourceNumber: ret.invoiceNumber ?? undefined,
        },
        orderBy: { serial: 'desc' },
      });
      if (!costEntry) continue;
      const price = Number(line.price);
      const cost = Number(costEntry.cost);
      if (price > 0 && Math.abs(cost - price) < 0.01) {
        flagged++;
        console.log(
          `  SUSPECT: company=${ret.companyId} return=${ret.invoiceNumber ?? ret.id} item=${line.itemId} ` +
            `resulting average cost (${cost}) == return line selling price (${price})`
        );
      }
    }
  }
  console.log(`  Checked ${returns.length} SALE_RETURN invoices; ${flagged} item/return pairs show cost re-valued at selling price.`);
  return flagged;
}

const TEST_FIXTURE_COMPANY_IDS = new Set([
  '00000000-0000-0000-0000-000000000001', // shared by scripts/test-wave*.ts and test-accounting-invariants.ts
  '00000000-0000-0000-0000-0000000000f0', // scripts/test-gl-invariants.ts
]);

async function main() {
  console.log('Phase 0 — corruption quantification (READ-ONLY)');
  console.log('Run at:', new Date().toISOString());
  console.log(
    '\nNOTE: company 00000000-0000-0000-0000-000000000001 is the shared fixture company reused by ' +
      'npm run test:wave*/test:accounting-invariants/test:gl-invariants; it is repeatedly created, posted, ' +
      'unposted, and only partially cleaned between runs. Findings against that id are test-harness noise, ' +
      'not real tenant corruption. All other company ids below are real seeded/migrated tenant data.'
  );

  const dupCodes = await duplicateAccountCodes();
  const dupInvoiceNumbers = await duplicateInvoiceNumbers();
  const whtHealth = await withholdingTaxHealth();
  const unbalanced = await unbalancedPostedJournals();
  const dupJes = await duplicatePostedJournalsPerSource();
  const poisonedCost = await poisonedAverageCostCandidates();

  section('SUMMARY');
  console.log(`  Duplicate account codes:                        ${dupCodes}`);
  console.log(`  Duplicate invoice numbers:                       ${dupInvoiceNumbers}`);
  console.log(`  WHT invoices stuck unposted:                     ${whtHealth.stuck} / ${whtHealth.total}`);
  console.log(`  Unbalanced posted journal entries:               ${unbalanced}`);
  console.log(`  Sources with >1 posted journal entry:            ${dupJes}`);
  console.log(`  Poisoned average-cost candidates (C1):           ${poisonedCost}`);
  console.log('\nNo data was modified.');
}

main()
  .catch((e) => {
    console.error('Corruption quantification crashed:', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
