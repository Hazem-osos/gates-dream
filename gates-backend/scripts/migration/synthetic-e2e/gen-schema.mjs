// Builds CREATE TABLE DDL for a synthetic legacy Gates database from erp/erp_schema.txt.
// Usage: node gen-schema.mjs <erp_schema.txt> > schema.sql
import fs from 'node:fs';

const TABLES = [
  'Branch', 'Year', 'CostCenter', 'Store', 'Currency', 'Account', 'Customer', 'Supplier',
  'GLTrxHeader', 'GLTrxDetail', 'BalanceAccountsH', 'BalanceAccountsD',
  'InvoiceTrxHeader', 'InvoiceTrxDetail', 'Item', 'ItemUnit', 'ItemStore',
  'CashTrxHeader', 'CashTrxDetail', 'CashTrxotherDetail', 'CKTrxDetail', 'CKTrxDetailSub', 
  'CompanySetting', 'CurrencyHistory', 'ItemCost',
  'PKTrxDetail', 'PKTrxDetailSub', 'StoreCheckHeader', 'StoreCheckDetail', 'BankBoxRights',
  'StoreTransHeader', 'StoreTransDetail', 'StoreCollHeader', 'StoreCollDetail', 'StoreAdjustHeader', 'StoreAdjustDetail',
];

const TYPE = {
  char: 'VARCHAR(100)',
  nchar: 'NVARCHAR(100)',
  nvarchar: 'NVARCHAR(400)',
  decimal: 'DECIMAL(19,6)',
  numeric: 'DECIMAL(19,6)',
  datetime: 'DATETIME',
  int: 'INT',
  bit: 'BIT',
  float: 'FLOAT',
  image: 'VARBINARY(MAX)',
};

const text = fs.readFileSync(process.argv[2], 'utf8');
const cols = new Map();
for (const m of text.matchAll(/^([A-Za-z_0-9]+)\.([A-Za-z_0-9]+) \(([a-z ]+)\)/gm)) {
  const [, t, c, ty] = m;
  if (!TABLES.includes(t)) continue;
  if (!cols.has(t)) cols.set(t, []);
  const list = cols.get(t);
  if (!list.some((x) => x.name.toLowerCase() === c.toLowerCase())) list.push({ name: c, type: ty.trim() });
}

const out = [];
for (const t of TABLES) {
  const list = cols.get(t);
  if (!list) {
    out.push(`-- ${t}: not in erp_schema.txt; minimal shell`);
    out.push(`CREATE TABLE dbo.[${t}] (CompanyCode VARCHAR(100) NOT NULL);`);
    continue;
  }
  const defs = list.map((c) => {
    const notNull = c.name === 'CompanyCode' ? ' NOT NULL' : ' NULL';
    return `  [${c.name}] ${TYPE[c.type] ?? 'NVARCHAR(400)'}${notNull}`;
  });
  out.push(`CREATE TABLE dbo.[${t}] (\n${defs.join(',\n')}\n);`);
}
process.stdout.write(out.join('\nGO\n') + '\nGO\n');
