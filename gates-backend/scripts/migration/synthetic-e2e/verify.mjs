// Independent source-vs-target check (does not use the engine). Local disposable DBs only.
// Usage: node verify.mjs <saPasswordFile> <targetCompanyId>
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../../../package.json', import.meta.url));
const mssql = require('mssql');
const pw = fs.readFileSync(process.argv[2], 'utf8').trim();
const CID = process.argv[3];
const CC = '0001';
if (!/^[0-9a-f-]{36}$/.test(CID)) throw new Error('company id');

const src = await new mssql.ConnectionPool({
  server: '127.0.0.1', port: 14333, user: 'sa', password: pw, database: 'GatesSyntheticLegacy',
  options: { encrypt: true, trustServerCertificate: true },
}).connect();
const S = async (sql) => (await src.request().input('cc', CC).query(sql)).recordset;

function T(sql) {
  const out = execFileSync('mysql', ['-h', '127.0.0.1', '-P', '3307', '-uroot', '-plocal_dev_only_not_secret', '--batch', '--raw', 'gates_mig_e2e', '-e', sql.replaceAll('@cid', `'${CID}'`)], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  const [head, ...rows] = out.trim().split('\n');
  if (!head) return [];
  const cols = head.split('\t');
  return rows.map((r) => Object.fromEntries(r.split('\t').map((v, i) => [cols[i], v === 'NULL' ? null : v])));
}

const n2 = (v) => (Math.round(Number(v ?? 0) * 100) / 100).toFixed(2);
const results = [];
function check(area, name, source, target) {
  const ok = JSON.stringify(source) === JSON.stringify(target);
  results.push({ area, name, ok, source, target });
}
function mapCompare(area, name, srcRows, tgtRows, key, val) {
  const a = new Map(srcRows.map((r) => [key(r), val(r)]));
  const b = new Map(tgtRows.map((r) => [key(r), val(r)]));
  const diffs = [];
  for (const k of new Set([...a.keys(), ...b.keys()])) {
    if (a.get(k) !== b.get(k)) diffs.push({ key: k, source: a.get(k) ?? null, target: b.get(k) ?? null });
  }
  results.push({ area, name, ok: diffs.length === 0, source: a.size, target: b.size, diffs: diffs.slice(0, 8), diffCount: diffs.length });
}

const POSTED = `RTRIM(h.Status)='Post' AND RTRIM(ISNULL(h.Deleted,''))<>'T'`;

// ---- GL
const sGl = await S(`SELECT RTRIM(h.BranchCode)+'|'+RTRIM(h.YearID) b, COUNT(*) n FROM dbo.GLTrxHeader h WHERE RTRIM(h.CompanyCode)=@cc AND ${POSTED} GROUP BY h.BranchCode, h.YearID`);
const tGl = T(`SELECT CONCAT(b.legacyBranchCode,'|',f.legacyYearId) b, COUNT(*) n FROM journal_entries j JOIN branches b ON b.id=j.branchId JOIN fiscal_years f ON f.id=j.fiscalYearId WHERE j.companyId=@cid AND j.legacyGlNum IS NOT NULL AND j.isPosted=1 AND j.deletedAt IS NULL GROUP BY b.legacyBranchCode, f.legacyYearId`);
mapCompare('GL', 'posted journals per branch|year', sGl, tGl, (r) => r.b, (r) => String(r.n));
const sBal = await S(`SELECT RTRIM(d.AccountNo) a, SUM(CAST(d.DebitValue AS DECIMAL(19,4))*ISNULL(d.Change,1)) dr, SUM(CAST(d.CreditValue AS DECIMAL(19,4))*ISNULL(d.Change,1)) cr
  FROM dbo.GLTrxDetail d JOIN dbo.GLTrxHeader h ON h.CompanyCode=d.CompanyCode AND h.BranchCode=d.BranchCode AND h.YearID=d.YearID AND h.GlNum=d.GLNum AND h.Type=d.Type
  WHERE RTRIM(d.CompanyCode)=@cc AND ${POSTED} GROUP BY RTRIM(d.AccountNo)`);
const tBal = T(`SELECT a.code a, SUM(l.debitBase) dr, SUM(l.creditBase) cr FROM journal_entry_lines l JOIN journal_entries j ON j.id=l.journalEntryId JOIN accounts a ON a.id=l.accountId
  WHERE j.companyId=@cid AND j.legacyGlNum IS NOT NULL AND j.isPosted=1 AND j.deletedAt IS NULL GROUP BY a.code`);
mapCompare('GL', 'balance per account (debit|credit)', sBal, tBal, (r) => r.a, (r) => `${n2(r.dr)}|${n2(r.cr)}`);

// ---- Ledger caches (what reports read)
const tApb = T(`SELECT a.code a, SUM(p.debitTotal) dr, SUM(p.creditTotal) cr FROM account_period_balances p JOIN accounts a ON a.id=p.accountId WHERE p.companyId=@cid GROUP BY a.code`);
mapCompare('Ledger cache', 'account_period_balances per account (debit|credit)', sBal, tApb, (r) => r.a, (r) => `${n2(r.dr)}|${n2(r.cr)}`);
const sPartyNet = new Map(sBal.map((r) => [r.a, n2(Number(r.dr) - Number(r.cr))]));
const tPartner = T(`SELECT a.code a, SUM(b.netBase) net FROM partner_running_balances b
  LEFT JOIN customers c ON c.id=b.partnerId LEFT JOIN suppliers s ON s.id=b.partnerId
  JOIN accounts a ON a.id=COALESCE(c.accountId, s.accountId) WHERE b.companyId=@cid GROUP BY a.code`);
const partyAccounts = T(`SELECT a.code a FROM customers c JOIN accounts a ON a.id=c.accountId WHERE c.companyId=@cid
  UNION SELECT a.code FROM suppliers s JOIN accounts a ON a.id=s.accountId WHERE s.companyId=@cid`).map((r) => r.a);
mapCompare('Ledger cache', 'customer/supplier ledger balance (base)',
  partyAccounts.filter((a) => sPartyNet.has(a)).map((a) => ({ a, net: sPartyNet.get(a) })),
  tPartner.filter((r) => Number(r.net) !== 0 || sPartyNet.has(r.a)), (r) => r.a, (r) => n2(r.net));

// ---- Parties
const sCust = await S(`SELECT RTRIM(CustomerCode) c, RTRIM(CustomerNameA) n, RTRIM(AccountCode) a FROM dbo.Customer WHERE RTRIM(CompanyCode)=@cc`);
const tCust = T(`SELECT c.code c, c.arabicName n, a.code a FROM customers c LEFT JOIN accounts a ON a.id=c.accountId WHERE c.companyId=@cid`);
mapCompare('Parties', 'customers (name|account)', sCust, tCust, (r) => r.c, (r) => `${r.n}|${r.a}`);
const sSup = await S(`SELECT RTRIM(SupplierCode) c, RTRIM(SupplierNameA) n, RTRIM(AccountCode) a FROM dbo.Supplier WHERE RTRIM(CompanyCode)=@cc`);
const tSup = T(`SELECT s.code c, s.arabicName n, a.code a FROM suppliers s LEFT JOIN accounts a ON a.id=s.accountId WHERE s.companyId=@cid`);
mapCompare('Parties', 'suppliers (name|account)', sSup, tSup, (r) => r.c, (r) => `${r.n}|${r.a}`);

// ---- Items
const sItems = await S(`SELECT RTRIM(ItemCode) c, RTRIM(ItemNameA) n FROM dbo.Item WHERE RTRIM(CompanyCode)=@cc AND RTRIM(ISNULL(HasChild,'F'))<>'T'`);
const tItems = T(`SELECT serial c, arabicName n FROM items WHERE companyId=@cid AND serial IS NOT NULL`);
mapCompare('Items', 'leaf items (name)', sItems, tItems, (r) => r.c, (r) => r.n);

// ---- Invoices
const invKey = (r) => `${r.b}|${r.y}|${r.t}|${r.num}`;
const sInv = await S(`SELECT RTRIM(h.BranchCode) b, RTRIM(h.YearID) y, RTRIM(h.Type) t, RTRIM(h.InvoiceNum) num, CAST(h.NetAmount AS DECIMAL(19,2)) net, CAST(ISNULL(h.PaidAmount,0) AS DECIMAL(19,2)) paid,
   CASE WHEN RTRIM(ISNULL(h.Deleted,''))='T' THEN 'CANCELLED' WHEN RTRIM(h.Status)='Post' THEN 'POSTED' ELSE 'DRAFT' END st,
   (SELECT COUNT(*) FROM dbo.InvoiceTrxDetail d WHERE d.CompanyCode=h.CompanyCode AND d.BranchCode=h.BranchCode AND d.YearID=h.YearID AND d.Type=h.Type AND d.InvoiceNum=h.InvoiceNum) lines,
   RTRIM(h.SupplierAccountCode) party
  FROM dbo.InvoiceTrxHeader h WHERE RTRIM(h.CompanyCode)=@cc`);
const tInv = T(`SELECT b.legacyBranchCode b, i.sourceYearId y, i.moduleCode t, i.invoiceNumber rawnum, i.netAmount net, i.paidAmount paid,
   CASE WHEN i.isCancelled=1 THEN 'CANCELLED' WHEN i.isPosted=1 THEN 'POSTED' ELSE 'DRAFT' END st,
   (SELECT COUNT(*) FROM invoice_lines l WHERE l.invoiceId=i.id) nlines,
   COALESCE(ca.code, sa.code) party, i.journalEntryId je
  FROM invoices i LEFT JOIN branches b ON b.id=i.branchId
  LEFT JOIN customers c ON c.id=i.customerId LEFT JOIN accounts ca ON ca.id=c.accountId
  LEFT JOIN suppliers s ON s.id=i.supplierId LEFT JOIN accounts sa ON sa.id=s.accountId
  WHERE i.companyId=@cid`).map((r) => ({ ...r, num: String(r.rawnum).replace(/^[A-Z]{2}\d{2}-/, '') }));
mapCompare('Invoices', 'invoice status|net|lines|party', sInv, tInv, invKey, (r) => `${r.st}|${n2(r.net)}|${r.lines ?? r.nlines}|${r.party}`);
mapCompare('Invoices', 'invoice paid amount', sInv, tInv, invKey, (r) => n2(r.paid));
check('Invoices', 'posted invoices linked to their journal', sInv.filter((r) => r.st === 'POSTED').length, tInv.filter((r) => r.st === 'POSTED' && r.je).length);

// ---- Cash
const cashKey = (r) => `${r.b}|${r.t}|${r.num}`;
const sCash = await S(`SELECT RTRIM(h.BranchCode) b, RTRIM(h.Type) t, RTRIM(h.CashNum) num, CAST(h.Amount AS DECIMAL(19,2)) amt,
  (SELECT COUNT(*) FROM dbo.CashTrxDetail d WHERE d.CompanyCode=h.CompanyCode AND d.BranchCode=h.BranchCode AND d.YearID=h.YearID AND d.Type=h.Type AND d.CashNum=h.CashNum AND RTRIM(ISNULL(d.Accepted,'T'))<>'F') lines
  FROM dbo.CashTrxHeader h WHERE RTRIM(h.CompanyCode)=@cc AND ${POSTED}`);
const tCash = T(`SELECT b.legacyBranchCode b, je.legacyGlNum gl, c.voucherNumber num, c.amount amt, c.transactionKind k,
  (SELECT COUNT(*) FROM cash_transaction_lines l WHERE l.cashTransactionId=c.id) nlines
  FROM cash_transactions c LEFT JOIN branches b ON b.id=c.branchId LEFT JOIN journal_entries je ON je.id=c.journalEntryId WHERE c.companyId=@cid`);
const sCashByGl = await S(`SELECT RTRIM(h.BranchCode) b, RTRIM(h.GLNum) gl, RTRIM(h.Type) t, RTRIM(h.CashNum) num FROM dbo.CashTrxHeader h WHERE RTRIM(h.CompanyCode)=@cc AND ${POSTED}`);
const glToCash = new Map(sCashByGl.map((r) => [`${r.b}|${r.gl}`, `${r.t}|${r.num}`]));
mapCompare('Cash', 'cash vouchers amount|lines', sCash, tCash.map((r) => {
  const tn = (glToCash.get(`${r.b}|${r.gl}`) ?? `?|${r.num}`).split('|');
  return { ...r, t: tn[0], num: tn[1] };
}), cashKey, (r) => `${n2(r.amt)}|${r.lines ?? r.nlines}`);

// ---- Allocations
const sAl = await S(`SELECT RTRIM(d.BranchCode) b, RTRIM(ISNULL(d.InvoiceYearId, d.YearID)) y, RTRIM(d.InvoiceType) t, RTRIM(d.InvoiceNum) num, SUM(CAST(d.Amount AS DECIMAL(19,2))) amt, COUNT(*) n
  FROM dbo.CashTrxDetail d JOIN dbo.CashTrxHeader h ON h.CompanyCode=d.CompanyCode AND h.BranchCode=d.BranchCode AND h.YearID=d.YearID AND h.Type=d.Type AND h.CashNum=d.CashNum
  WHERE RTRIM(d.CompanyCode)=@cc AND ${POSTED} AND RTRIM(ISNULL(d.InvoiceNum,''))<>'' AND RTRIM(ISNULL(d.Accepted,'T'))<>'F'
  GROUP BY d.BranchCode, ISNULL(d.InvoiceYearId, d.YearID), d.InvoiceType, d.InvoiceNum`);
const tAl = T(`SELECT b.legacyBranchCode b, i.sourceYearId y, i.moduleCode t, i.invoiceNumber rawnum, SUM(p.allocatedAmount) amt, COUNT(*) n
  FROM payment_allocations p JOIN invoices i ON i.id=p.invoiceId LEFT JOIN branches b ON b.id=i.branchId WHERE p.companyId=@cid GROUP BY b.legacyBranchCode, i.sourceYearId, i.moduleCode, i.invoiceNumber`)
  .map((r) => ({ ...r, num: String(r.rawnum).replace(/^[A-Z]{2}\d{2}-/, '') }));
mapCompare('Settlement', 'allocations per invoice (sum|count)', sAl, tAl, invKey, (r) => `${n2(r.amt)}|${r.n}`);

// ---- Cheques
const sCk = await S(`SELECT 'INWARD' dir, RTRIM(BranchCode) b, RTRIM(CKNum) v, RTRIM(IdNum) num, CAST(Amount AS DECIMAL(19,2)) amt FROM dbo.CKTrxDetail WHERE RTRIM(CompanyCode)=@cc
  UNION ALL SELECT 'OUTWARD', RTRIM(BranchCode), RTRIM(PKNum), RTRIM(IdNum), CAST(Amount AS DECIMAL(19,2)) FROM dbo.PKTrxDetail WHERE RTRIM(CompanyCode)=@cc`);
const tCk = T(`SELECT c.direction dir, b.legacyBranchCode b, c.chequeNumber num, c.amount amt FROM cheques c LEFT JOIN branches b ON b.id=c.branchId WHERE c.companyId=@cid`);
check('Cheques', 'cheque count by direction',
  Object.entries(sCk.reduce((a, r) => ({ ...a, [r.dir]: (a[r.dir] ?? 0) + 1 }), {})).sort().join(','),
  Object.entries(tCk.reduce((a, r) => ({ ...a, [r.dir]: (a[r.dir] ?? 0) + 1 }), {})).sort().join(','));
check('Cheques', 'cheque amount total',
  n2(sCk.reduce((a, r) => a + Number(r.amt), 0)), n2(tCk.reduce((a, r) => a + Number(r.amt), 0)));

// ---- Stock (ItemStore = legacy on-hand)
const sStock = await S(`SELECT RTRIM(ItemCode) i, RTRIM(StoreCode) w, CAST(Qty AS DECIMAL(19,4)) q FROM dbo.ItemStore WHERE RTRIM(CompanyCode)=@cc`);
const tStock = T(`SELECT it.serial i, w.legacyStoreCode w, b.quantityOnHand q FROM item_warehouse_balances b JOIN items it ON it.id=b.itemId JOIN warehouses w ON w.id=b.warehouseId WHERE b.companyId=@cid`);
mapCompare('Inventory', 'on-hand qty per item|store', sStock, tStock.filter((r) => Number(r.q) !== 0), (r) => `${r.i}|${r.w}`, (r) => Number(r.q).toFixed(4));
const tMov = T(`SELECT it.serial i, w.legacyStoreCode w, SUM(m.quantityDelta) q FROM inventory_movements m JOIN items it ON it.id=m.itemId JOIN warehouses w ON w.id=m.warehouseId WHERE m.companyId=@cid GROUP BY it.serial, w.legacyStoreCode`);
mapCompare('Inventory', 'movement ledger sum per item|store', sStock, tMov.filter((r) => Number(r.q) !== 0), (r) => `${r.i}|${r.w}`, (r) => Number(r.q).toFixed(4));

await src.close();
const failed = results.filter((r) => !r.ok);
for (const r of results) {
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  [${r.area}] ${r.name}  source=${JSON.stringify(r.source)} target=${JSON.stringify(r.target)}${r.diffCount ? ` diffs=${r.diffCount}` : ''}`);
  if (!r.ok && r.diffs) for (const d of r.diffs) console.log('      ', JSON.stringify(d));
}
console.log(`\n${results.length - failed.length}/${results.length} checks match`);
process.exit(failed.length ? 1 : 0);
