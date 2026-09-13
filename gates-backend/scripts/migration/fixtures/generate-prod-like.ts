#!/usr/bin/env tsx
/**
 * Generates a production-shaped legacy dump so the ETL and the reconciliation harness can be
 * rehearsed at volume before touching a real SQL Server extract.
 *
 * Unlike the hand-written `sample` fixtures this set deliberately includes the cases that break
 * naive loaders: two fiscal years, three branches sharing GlNum sequences, unposted and deleted
 * vouchers, multi-currency entries with an exchange rate, multi-line journals with cost centres,
 * purchase/sale/return invoices, and items whose cost changed several times.
 *
 * Deterministic (fixed seed) so parity numbers are reproducible across runs.
 * Run: npm run fixtures:prod-like [-- --out=<dir>] [--scale=1]
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const COMPANY_CODE = 'PRODLIKE';
const BRANCHES = ['01', '02', '03'];
const YEARS = [
  { code: '20240001', from: '2024-01-01', to: '2024-12-31', status: 'Close' },
  { code: '20250001', from: '2025-01-01', to: '2025-12-31', status: 'Open' },
];
const CURRENCIES = [
  { code: 'EGP', rate: 1 },
  { code: 'USD', rate: 48.75 },
];

/** Mulberry32 — small deterministic PRNG so the dump is byte-stable. */
function makeRandom(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rnd = makeRandom(20260817);

function pick<T>(items: T[]): T {
  return items[Math.floor(rnd() * items.length)];
}

function money(min: number, max: number): number {
  return Math.round((min + rnd() * (max - min)) * 100) / 100;
}

function isoDate(year: string, monthIndex: number, day: number): string {
  const y = Number(year.slice(0, 4));
  return new Date(Date.UTC(y, monthIndex, day, 9, 0, 0)).toISOString();
}

interface Args {
  outDir: string;
  scale: number;
}

function parseArgs(argv: string[]): Args {
  let outDir = path.join(HERE, 'prod-like');
  let scale = 1;
  for (const arg of argv) {
    if (arg.startsWith('--out=')) outDir = arg.split('=')[1] ?? outDir;
    else if (arg.startsWith('--scale=')) scale = Math.max(1, Number(arg.split('=')[1]) || 1);
  }
  return { outDir, scale };
}

function buildMasters(scale: number) {
  const accounts = [
    { code: '1100', name: 'Cash', type: '1' },
    { code: '1110', name: 'Bank', type: '1' },
    { code: '1200', name: 'Accounts Receivable', type: '1' },
    { code: '1300', name: 'Inventory', type: '1' },
    { code: '2100', name: 'Accounts Payable', type: '2' },
    { code: '2200', name: 'VAT Input', type: '2' },
    { code: '2300', name: 'VAT Output', type: '2' },
    { code: '3000', name: 'Capital', type: '3' },
    { code: '4100', name: 'Sales Revenue', type: '4' },
    { code: '4200', name: 'Other Income', type: '4' },
    { code: '5100', name: 'Cost of Goods Sold', type: '5' },
    { code: '5200', name: 'Salaries', type: '5' },
    { code: '5300', name: 'Rent', type: '5' },
    { code: '5400', name: 'Utilities', type: '5' },
    // Retired account: carries history but must import as inactive.
    { code: '5900', name: 'Legacy Suspense', type: '5', deleted: true },
  ];

  const items = Array.from({ length: 12 * scale }, (_, i) => ({
    code: `SKU-${String(i + 1).padStart(4, '0')}`,
    name: `Item ${i + 1}`,
    inactive: i % 11 === 10,
  }));

  const customers = Array.from({ length: 8 * scale }, (_, i) => ({
    code: `C${String(i + 1).padStart(3, '0')}`,
    name: `Customer ${i + 1}`,
    creditLimit: 25_000 + i * 5_000,
  }));

  const suppliers = Array.from({ length: 5 * scale }, (_, i) => ({
    code: `S${String(i + 1).padStart(3, '0')}`,
    name: `Supplier ${i + 1}`,
  }));

  const stores = BRANCHES.map((branch, i) => ({
    branch,
    code: `WH${String(i + 1).padStart(2, '0')}`,
    name: `Warehouse ${i + 1}`,
  }));

  const costCenters = [
    { code: 'CC01', name: 'Administration' },
    { code: 'CC02', name: 'Sales' },
    { code: 'CC03', name: 'Production' },
  ];

  return { accounts, items, customers, suppliers, stores, costCenters };
}

type Masters = ReturnType<typeof buildMasters>;

function buildJournals(masters: Masters, scale: number) {
  const headers: Record<string, unknown>[] = [];
  const details: Record<string, unknown>[] = [];
  const postable = masters.accounts.filter((a) => !a.deleted);

  for (const year of YEARS) {
    for (const branch of BRANCHES) {
      const count = 30 * scale;
      for (let i = 1; i <= count; i++) {
        // GlNum restarts per branch/year, exactly like the Delphi sequence.
        const glNum = String(i);
        const currency = i % 9 === 0 ? CURRENCIES[1] : CURRENCIES[0];
        const deleted = i % 17 === 0;
        const unposted = !deleted && i % 7 === 0;
        const date = isoDate(year.code, i % 12, (i % 27) + 1);

        headers.push({
          CompanyCode: COMPANY_CODE,
          BranchCode: branch,
          YearID: year.code,
          GlNum: glNum,
          Date: date,
          DateH: null,
          DescA: `قيد ${branch}-${year.code}-${glNum}`,
          DescE: `Entry ${branch}-${year.code}-${glNum}`,
          CurrencyCode: currency.code,
          Change: currency.rate,
          Balanced: 'T',
          Status: unposted ? 'UnPost' : 'Post',
          Deleted: deleted ? 'T' : 'F',
          Type: 'GL',
          UserCode: 'legacy',
        });

        // Two or three balanced legs; the third splits the credit side to exercise
        // multi-line rounding.
        const debitAccount = pick(postable);
        let creditAccount = pick(postable);
        while (creditAccount.code === debitAccount.code) creditAccount = pick(postable);
        const amount = money(250, 9_500);
        const split = i % 3 === 0 ? Math.round(amount * 40) / 100 : 0;

        details.push({
          CompanyCode: COMPANY_CODE,
          BranchCode: branch,
          YearID: year.code,
          GlNum: glNum,
          LineNum: 1,
          AccountNo: debitAccount.code,
          CCenterCode: pick(masters.costCenters).code,
          DebitValue: amount,
          CreditValue: 0,
          Change: currency.rate,
        });
        details.push({
          CompanyCode: COMPANY_CODE,
          BranchCode: branch,
          YearID: year.code,
          GlNum: glNum,
          LineNum: 2,
          AccountNo: creditAccount.code,
          CCenterCode: null,
          DebitValue: 0,
          CreditValue: Math.round((amount - split) * 100) / 100,
          Change: currency.rate,
        });
        if (split > 0) {
          details.push({
            CompanyCode: COMPANY_CODE,
            BranchCode: branch,
            YearID: year.code,
            GlNum: glNum,
            LineNum: 3,
            AccountNo: '5900',
            CCenterCode: null,
            DebitValue: 0,
            CreditValue: split,
            Change: currency.rate,
          });
        }
      }
    }
  }

  return { headers, details };
}

function buildInvoices(masters: Masters, scale: number) {
  const headers: Record<string, unknown>[] = [];
  const details: Record<string, unknown>[] = [];
  const trxTypes = ['S', 'P', 'SRET', 'PRET'];
  let invoiceNum = 100_000;

  for (const year of YEARS) {
    const count = 20 * scale;
    for (let i = 0; i < count; i++) {
      invoiceNum += 1;
      const trxType = trxTypes[i % trxTypes.length];
      const isPurchase = trxType.startsWith('P');
      const store = pick(masters.stores);
      const lineCount = 1 + (i % 3);
      let total = 0;

      for (let line = 1; line <= lineCount; line++) {
        const item = pick(masters.items);
        const quantity = 1 + Math.floor(rnd() * 20);
        const price = money(15, 900);
        const lineTotal = Math.round(quantity * price * 100) / 100;
        total = Math.round((total + lineTotal) * 100) / 100;
        details.push({
          CompanyCode: COMPANY_CODE,
          YearID: year.code,
          InvoiceNum: String(invoiceNum),
          LineNum: line,
          ItemCode: item.code,
          Quantity: quantity,
          Price: price,
          TotalValue: lineTotal,
        });
      }

      const tax = Math.round(total * 14) / 100;
      headers.push({
        CompanyCode: COMPANY_CODE,
        BranchCode: store.branch,
        YearID: year.code,
        InvoiceNum: String(invoiceNum),
        TrxType: trxType,
        Date: isoDate(year.code, i % 12, (i % 25) + 2),
        CustomerCode: isPurchase ? null : pick(masters.customers).code,
        SupplierCode: isPurchase ? pick(masters.suppliers).code : null,
        StoreCode: store.code,
        CurrencyCode: 'EGP',
        Change: 1,
        TotalValue: total,
        DiscountValue: 0,
        DaribaValue: tax,
        NetValue: Math.round((total + tax) * 100) / 100,
        RemainingValue: i % 4 === 0 ? 0 : Math.round((total + tax) * 100) / 100,
        Status: i % 9 === 0 ? 'UnPost' : 'Post',
        Deleted: 'F',
        CashType: i % 4 === 0 ? 'C' : null,
      });
    }
  }

  return { headers, details };
}

function buildCash(masters: Masters, scale: number) {
  const rows: Record<string, unknown>[] = [];
  let voucher = 500_000;
  for (const year of YEARS) {
    const count = 15 * scale;
    for (let i = 0; i < count; i++) {
      voucher += 1;
      const isPayment = i % 2 === 1;
      rows.push({
        CompanyCode: COMPANY_CODE,
        BranchCode: pick(BRANCHES),
        YearID: year.code,
        CashNum: String(voucher),
        TrxType: isPayment ? 'PAY' : 'R',
        Date: isoDate(year.code, i % 12, (i % 20) + 3),
        CustomerCode: isPayment ? null : pick(masters.customers).code,
        SupplierCode: isPayment ? pick(masters.suppliers).code : null,
        AccountCode: isPayment ? '1100' : '1110',
        Amount: money(200, 12_000),
        CurrencyCode: 'EGP',
        DescA: isPayment ? 'صرف نقدية' : 'تحصيل نقدية',
        Status: i % 8 === 0 ? 'UnPost' : 'Post',
        Deleted: 'F',
      });
    }
  }
  return rows;
}

function buildOpenings(masters: Masters) {
  const itemStores: Record<string, unknown>[] = [];
  const itemCosts: Record<string, unknown>[] = [];

  for (const item of masters.items) {
    // Same item stocked in several warehouses — quantities must aggregate, not overwrite.
    for (const store of masters.stores) {
      if (rnd() < 0.35) continue;
      itemStores.push({
        CompanyCode: COMPANY_CODE,
        BranchCode: store.branch,
        StoreCode: store.code,
        ItemCode: item.code,
        Quantity: Math.round(rnd() * 500 * 1000) / 1000,
      });
    }

    // Several cost revisions; only the highest serial is the current moving average.
    const revisions = 1 + Math.floor(rnd() * 3);
    let cost = money(10, 400);
    for (let serial = 1; serial <= revisions; serial++) {
      itemCosts.push({
        CompanyCode: COMPANY_CODE,
        BranchCode: BRANCHES[0],
        ItemCode: item.code,
        Serial: serial,
        Cost: cost,
        Date: isoDate(YEARS[0].code, serial, 1),
        SourceType: serial === 1 ? 'OPENING' : 'PI',
        SourceNum: String(serial),
        YearID: YEARS[0].code,
      });
      cost = Math.round(cost * (0.9 + rnd() * 0.35) * 100) / 100;
    }
  }

  return { itemStores, itemCosts };
}

async function main() {
  const { outDir, scale } = parseArgs(process.argv.slice(2));
  await mkdir(outDir, { recursive: true });

  const masters = buildMasters(scale);
  const journals = buildJournals(masters, scale);
  const invoices = buildInvoices(masters, scale);
  const cash = buildCash(masters, scale);
  const openings = buildOpenings(masters);

  const tables: Record<string, unknown[]> = {
    Company: [
      {
        CompanyCode: COMPANY_CODE,
        CompanyNameA: 'شركة الاختبار الإنتاجي',
        CompanyNameE: 'Prod-like Migration Co',
        Telephone1: '0227000000',
        Address: 'Cairo',
      },
    ],
    Branch: BRANCHES.map((code, i) => ({
      CompanyCode: COMPANY_CODE,
      BranchCode: code,
      BranchNameA: `فرع ${i + 1}`,
      BranchNameE: `Branch ${i + 1}`,
    })),
    Year: YEARS.map((y) => ({
      CompanyCode: COMPANY_CODE,
      BranchCode: BRANCHES[0],
      YearCode: y.code,
      YearNameA: `سنة ${y.code.slice(0, 4)}`,
      FromDate: `${y.from}T00:00:00.000Z`,
      ToDate: `${y.to}T23:59:59.000Z`,
      Status: y.status,
    })),
    Account: masters.accounts.map((a) => ({
      CompanyCode: COMPANY_CODE,
      AccountCode: a.code,
      AccountNameA: a.name,
      AccountNameE: a.name,
      AccountType: a.type,
      Deleted: a.deleted ? 'T' : 'F',
    })),
    CostCenter: masters.costCenters.map((c) => ({
      CompanyCode: COMPANY_CODE,
      CCenterCode: c.code,
      CCenterNameA: c.name,
      CCenterNameE: c.name,
    })),
    Customer: masters.customers.map((c) => ({
      CompanyCode: COMPANY_CODE,
      CustomerCode: c.code,
      CustomerNameA: c.name,
      AccountCode: '1200',
      CreditLimit: c.creditLimit,
      Deleted: 'F',
    })),
    Supplier: masters.suppliers.map((s) => ({
      CompanyCode: COMPANY_CODE,
      SupplierCode: s.code,
      SupplierNameA: s.name,
      AccountCode: '2100',
      Deleted: 'F',
    })),
    Store: masters.stores.map((s) => ({
      CompanyCode: COMPANY_CODE,
      BranchCode: s.branch,
      StoreCode: s.code,
      StoreNameA: s.name,
    })),
    Item: masters.items.map((i) => ({
      CompanyCode: COMPANY_CODE,
      ItemCode: i.code,
      ItemNameA: i.name,
      ItemNameE: i.name,
      InactiveItem: i.inactive ? 'T' : 'F',
    })),
    ItemStore: openings.itemStores,
    ItemCost: openings.itemCosts,
    GLTrxHeader: journals.headers,
    GLTrxDetail: journals.details,
    InvoiceTrxHeader: invoices.headers,
    InvoiceTrxDetail: invoices.details,
    CashTrxHeader: cash,
  };

  for (const [table, rows] of Object.entries(tables)) {
    await writeFile(path.join(outDir, `${table}.json`), JSON.stringify(rows, null, 2), 'utf8');
  }

  console.log(`Prod-like legacy dump written to ${outDir}`);
  for (const [table, rows] of Object.entries(tables)) {
    console.log(`  ${table.padEnd(18)} ${rows.length}`);
  }
  console.log(`\nCompany code: ${COMPANY_CODE}`);
  console.log('Next:');
  console.log(`  LEGACY_DATA_PATH=${outDir} npm run migrate:legacy -- --company=${COMPANY_CODE}`);
  console.log(
    `  LEGACY_DATA_PATH=${outDir} npm run recon:migration -- --company=${COMPANY_CODE}`
  );
}

void main();
