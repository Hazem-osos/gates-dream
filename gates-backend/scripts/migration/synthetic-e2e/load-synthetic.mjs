// Creates GatesSyntheticLegacy on the LOCAL test SQL Server and fills it with synthetic data.
// Usage: node load-synthetic.mjs <schema.sql> <saPasswordFile>
// Refuses anything but 127.0.0.1,14333.
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../../../package.json', import.meta.url));
const mssql = require('mssql');

const HOST = '127.0.0.1';
const PORT = 14333;
const DB = 'GatesSyntheticLegacy';
const pw = fs.readFileSync(process.argv[3], 'utf8').trim();
const base = { server: HOST, port: PORT, user: 'sa', password: pw, options: { encrypt: true, trustServerCertificate: true } };

const admin = await mssql.connect({ ...base, database: 'master' });
const host = (await admin.request().query('SELECT @@SERVERNAME AS s')).recordset[0].s;
console.log('server', host);
await admin.request().query(`IF DB_ID('${DB}') IS NOT NULL BEGIN ALTER DATABASE [${DB}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [${DB}]; END; CREATE DATABASE [${DB}];`);
await admin.close();

const pool = await new mssql.ConnectionPool({ ...base, database: DB, requestTimeout: 120000 }).connect();
for (const stmt of fs.readFileSync(process.argv[2], 'utf8').split(/\nGO\n/)) {
  if (stmt.trim()) await pool.request().batch(stmt);
}

const CC = '0001';
const q = (v) => (v == null ? 'NULL' : typeof v === 'number' ? String(v) : `N'${String(v).replace(/'/g, "''")}'`);
async function insert(table, rows) {
  if (!rows.length) return;
  const cols = Object.keys(rows[0]);
  for (let i = 0; i < rows.length; i += 200) {
    const chunk = rows.slice(i, i + 200);
    await pool.request().batch(
      `INSERT INTO dbo.[${table}] (${cols.map((c) => `[${c}]`).join(',')}) VALUES ` +
        chunk.map((r) => `(${cols.map((c) => q(r[c])).join(',')})`).join(',')
    );
  }
}

await insert('Branch', [
  { CompanyCode: CC, BranchCode: '01', BranchNameA: 'الفرع الرئيسي', BranchNameE: 'Main', City: 'Cairo' },
  { CompanyCode: CC, BranchCode: '02', BranchNameA: 'فرع الإسكندرية', BranchNameE: 'Alex', City: 'Alexandria' },
]);
await insert('Year', [
  { CompanyCode: CC, BranchCode: '01', YearCode: '2025', YearNameA: '2025', FromDate: '2025-01-01', ToDate: '2025-12-31', Status: 'Close' },
  { CompanyCode: CC, BranchCode: '01', YearCode: '2026', YearNameA: '2026', FromDate: '2026-01-01', ToDate: '2026-12-31', Status: 'Open' },
]);
await insert('Currency', [
  { CompanyCode: CC, CurrencyCode: 'EGP', CurrencyNameA: 'جنيه مصري', CurrencyNameE: 'EGP', Change: 1 },
  { CompanyCode: CC, CurrencyCode: 'USD', CurrencyNameA: 'دولار أمريكي', CurrencyNameE: 'USD', Change: 48 },
]);
await insert('CostCenter', [
  { CompanyCode: CC, CCenterCode: 'CC01', CCenterNameA: 'الإدارة' },
  { CompanyCode: CC, CCenterCode: 'CC02', CCenterNameA: 'المبيعات' },
]);
await insert('Store', [
  { CompanyCode: CC, StoreCode: 'ST01', ParentStore: '', FullPath: 'ST01', StoreLevel: 1, StoreNameA: 'المخزن الرئيسي', StoreNameE: 'Main store', StoreStatus: 'A', HasChild: 'F', Deleted: 'F', StoreAccountCode: '1010301' },
  { CompanyCode: CC, StoreCode: 'ST02', ParentStore: '', FullPath: 'ST02', StoreLevel: 1, StoreNameA: 'مخزن الإسكندرية', StoreNameE: 'Alex store', StoreStatus: 'A', HasChild: 'F', Deleted: 'F', StoreAccountCode: '1010301' },
]);
await insert('CompanySetting', [
  { CompanyCode: CC, BranchCode: '01', Name: 'SyntheticMarker', Value: 'GatesSyntheticLegacy' },
]);

// Chart of accounts
const acc = (code, parent, level, nameA, hasChild, side, report, type = 'N') => ({
  CompanyCode: CC, AccountCode: code, ParentAccount: parent, FullPath: code, AccountLevel: level,
  AccountNameA: nameA, AccountNameE: nameA, AccountStatus: 'A', AccountType: type, ReportType: report,
  AccountSide: side, CurrencyCode: 'EGP', CCType: 'N', HasChild: hasChild ? 'T' : 'F', Deleted: 'F',
});
await insert('Account', [
  acc('1', '', 1, 'الأصول', true, 'D', 'B'),
  acc('101', '1', 2, 'الأصول المتداولة', true, 'D', 'B'),
  acc('10101', '101', 3, 'النقدية والبنوك', true, 'D', 'B'),
  acc('1010101', '10101', 4, 'الخزينة الرئيسية', false, 'D', 'B'),
  acc('1010102', '10101', 4, 'البنك الأهلي', false, 'D', 'B'),
  acc('10102', '101', 3, 'العملاء', true, 'D', 'B', 'C'),
  acc('10103', '101', 3, 'المخزون', true, 'D', 'B'),
  acc('1010301', '10103', 4, 'مخزون بضاعة', false, 'D', 'B'),
  acc('2', '', 1, 'الخصوم', true, 'C', 'B'),
  acc('201', '2', 2, 'الخصوم المتداولة', true, 'C', 'B'),
  acc('20101', '201', 3, 'الموردون', true, 'C', 'B', 'C'),
  acc('3', '', 1, 'حقوق الملكية', true, 'C', 'B'),
  acc('301', '3', 2, 'رأس المال', true, 'C', 'B'),
  acc('30101', '301', 3, 'رأس المال المدفوع', true, 'C', 'B'),
  acc('3010101', '30101', 4, 'رأس المال', false, 'C', 'B'),
  acc('4', '', 1, 'الإيرادات', true, 'C', 'P'),
  acc('401', '4', 2, 'إيرادات النشاط', true, 'C', 'P'),
  acc('40101', '401', 3, 'المبيعات', true, 'C', 'P'),
  acc('4010101', '40101', 4, 'مبيعات بضاعة', false, 'C', 'P'),
  acc('5', '', 1, 'المصروفات', true, 'D', 'P'),
  acc('501', '5', 2, 'مصروفات إدارية', true, 'D', 'P'),
  acc('50101', '501', 3, 'مصروفات عمومية', true, 'D', 'P'),
  acc('5010101', '50101', 4, 'رواتب', false, 'D', 'P'),
  acc('5010102', '50101', 4, 'إيجار', false, 'D', 'P'),
]);

const customers = Array.from({ length: 30 }, (_, i) => ({
  CompanyCode: CC, CustomerCode: String(i + 1), BranchCode: '01',
  CustomerNameA: `عميل اختبار ${i + 1}`, CustomerNameE: `Test Customer ${i + 1}`,
  AccountCode: `10102${String(i + 1).padStart(5, '0')}`, CurrencyCode: 'EGP', Mobile: `0100000${String(i).padStart(4, '0')}`,
}));
const suppliers = Array.from({ length: 10 }, (_, i) => ({
  CompanyCode: CC, SupplierCode: String(i + 1), BranchCode: '01',
  SupplierNameA: `مورد اختبار ${i + 1}`, SupplierNameE: `Test Supplier ${i + 1}`,
  AccountCode: `20101${String(i + 1).padStart(5, '0')}`, CurrencyCode: 'EGP',
}));
// As in real legacy Gates data, every party has its own leaf in the Account master.
// PARTY_LEAF_IN_MASTER=0 leaves the last 5 customers + 2 suppliers out (exercises party-leaf provisioning).
const leafOut = process.env.PARTY_LEAF_IN_MASTER === '0';
const inMaster = (i, n) => !leafOut || i < n;
await insert('Account', [
  acc('10104', '101', 3, 'أوراق القبض', true, 'D', 'B'),
  acc('1010401', '10104', 4, 'شيكات تحت التحصيل', false, 'D', 'B'),
  acc('20102', '201', 3, 'أوراق الدفع', true, 'C', 'B'),
  acc('2010201', '20102', 4, 'شيكات صادرة', false, 'C', 'B'),
  ...customers.filter((_, i) => inMaster(i, 25)).map((c) => acc(c.AccountCode, '10102', 4, c.CustomerNameA, false, 'D', 'B')),
  ...suppliers.filter((_, i) => inMaster(i, 8)).map((s) => acc(s.AccountCode, '20101', 4, s.SupplierNameA, false, 'C', 'B')),
]);
await insert('Customer', customers);
await insert('Supplier', suppliers);

// Journals
const headers = [];
const details = [];
let idNum = 1;
const totals = { debit: 550000, credit: 550000 };
let detailId = 1;
function voucher(branch, num, date, type, lines, status = 'Post', deleted = 'F', opts = {}) {
  const year = opts.year ?? '2026';
  const cur = opts.currency ?? 'EGP';
  const rate = opts.change ?? 1;
  if (type !== 'BG01' && type !== 'GL01' && status === 'Post' && deleted !== 'T') {
    for (const [, d, c] of lines) { totals.debit += d * rate; totals.credit += c * rate; }
  }
  headers.push({
    CompanyCode: CC, BranchCode: branch, YearID: year, GlNum: String(num), DescA: `قيد ${type} ${num}`,
    Type: type, Date: date, Status: status, Deleted: deleted, Balanced: 'T', CurrencyCode: cur, IdNum: idNum++,
  });
  lines.forEach(([account, debit, credit, cc], i) => {
    details.push({
      CompanyCode: CC, BranchCode: branch, YearID: year, GLNum: String(num), DetailNum: i + 1, Type: type,
      AccountNo: account, CCenterCode: cc ?? null, DebitValue: debit, CreditValue: credit,
      DetailDescA: `سطر ${i + 1}`, CurrencyCode: cur, Change: rate, IdNum: detailId++,
    });
  });
}

voucher('01', 1, '2026-01-01', 'BG01', [
  ['1010101', 100000, 0], ['1010102', 400000, 0], ['1010301', 50000, 0], ['3010101', 0, 550000],
]);

function add(branch, num, day, kind, i) {
  const date = `2026-${String(1 + (day % 12)).padStart(2, '0')}-${String(1 + (day % 27)).padStart(2, '0')}`;
  const amt = 100 + ((i * 37) % 900);
  let lines;
  if (kind === 0) lines = [[customers[i % 30].AccountCode, amt, 0, 'CC02'], ['4010101', 0, amt, 'CC02']];
  else if (kind === 1) lines = [['5010101', amt, 0, 'CC01'], ['1010101', 0, amt]];
  else if (kind === 2) lines = [['1010301', amt, 0], [suppliers[i % 10].AccountCode, 0, amt]];
  else lines = [['1010102', amt, 0], [customers[i % 30].AccountCode, 0, amt]];
  voucher(branch, num, date, 'GL01', lines);
  totals.debit += amt;
  totals.credit += amt;
}
for (let n = 2; n <= 261; n += 1) add('01', n, n, n % 4, n);
for (let n = 1; n <= 40; n += 1) add('02', n, n, n % 4, n + 300);
// Not posted / deleted: must be excluded
voucher('01', 262, '2026-06-01', 'GL01', [['5010102', 999, 0], ['1010101', 0, 999]], 'UnPost');
voucher('01', 263, '2026-06-02', 'GL01', [['5010102', 888, 0], ['1010101', 0, 888]], 'UnPost');
voucher('01', 264, '2026-06-03', 'GL01', [['5010102', 777, 0], ['1010101', 0, 777]], 'Post', 'T');

await import(process.env.OPS_FILE ?? new URL('./ops-data.mjs', import.meta.url).href).then((m) => m.buildOps({ insert, voucher, customers, suppliers, totals, CC }));
await insert('GLTrxHeader', headers);
await insert('GLTrxDetail', details);

console.log(JSON.stringify({
  db: DB, customers: customers.length, suppliers: suppliers.length,
  vouchers: headers.length, postedVouchers: headers.filter((h) => h.Status === 'Post' && h.Deleted !== 'T').length,
  lines: details.length, postedDebit: totals.debit, postedCredit: totals.credit,
}));
await pool.close();
