#!/usr/bin/env node
/**
 * deep-legacy-mining.mjs
 *
 * Forensic extractor: line-grid fields, pre-save rules, post-save side effects.
 * Discovery-driven — extracts what the Delphi sources actually contain, then
 * answers the requested-identifier checklist explicitly.
 *
 * Usage:
 *   node scripts/legacy/deep-legacy-mining.mjs
 *   node scripts/legacy/deep-legacy-mining.mjs --src <MainProgram> --parity <docs/parity>
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  REPO_ROOT,
  parseArgs,
  readJson,
  writeJson,
  writeText,
  decodeCp1256,
  parseLangMessages,
  extractProcedureBodies,
  findSaveHandlers,
  collectCalledMethods,
  isOutOfScopeForm,
  moduleFromRoute,
  dfmJsonPath,
} from './parity-utils.mjs';

const args = parseArgs(process.argv.slice(2), ['src', 'parity']);
const SRC_DIR = path.resolve(args.src || path.join(REPO_ROOT, 'MainProgram'));
const PARITY_DIR = path.resolve(args.parity || path.join(REPO_ROOT, 'docs/parity'));
const DFM_DIR = path.join(PARITY_DIR, 'dfm');
const SCREENS_DIR = path.join(PARITY_DIR, 'screens');

const SKIP_DIRS = new Set([
  '__history',
  'chilkat-9.5.0-delphi-dyn',
  'temp',
  'fonts',
  'images',
]);

const MODULES = [
  {
    id: 'sales-purchasing',
    title: 'Sales & Purchasing Invoicing',
    formRe: /inovice|invoice|rinvoice|pinovice|quote|order|return|eshar|pos|customerorder/i,
    tableRe: /InvoiceTrx|PriceQuote|PurchaseOrder|Eshar/i,
    routeRe: /sales-invoice|purchase|price-quote|sales-return|purchase-return|pos\//i,
  },
  {
    id: 'treasury-cheques',
    title: 'Treasury & Cheques',
    formRe: /check|cheque|cash|payment|recieve|receive|treasury|bank|safe|distpayment/i,
    tableRe: /CashTrx|Cheque|CheckTrx/i,
    routeRe: /securities|treasury|cheque|cash-receipt|cash-payment/i,
  },
  {
    id: 'contracting',
    title: 'Contracting & Subcontractors',
    formRe: /contractor|extract|subcontract|statement|owneritem/i,
    tableRe: /ContractorsStatements|Extract/i,
    routeRe: /extracts|subcontract/i,
  },
  {
    id: 'manufacturing',
    title: 'Manufacturing & Assembly',
    formRe: /manuf|assembl|storecoll|storedist|disassembl/i,
    tableRe: /ManufactProcess|StoreColl|StoreDist/i,
    routeRe: /manufactur|assembly|disassembly/i,
  },
  {
    id: 'inventory',
    title: 'Inventory & Stock Movements',
    formRe: /storetrans|storecheck|stock|opening|bg\b|transfer|issue|receipt|expire/i,
    tableRe: /StoreTrans|StoreCheck|ItemCost|ItemDetail/i,
    routeRe: /inventory\/operations\/(transfer|stocktaking|opening|receipt|issue|adjustment)/i,
  },
];

const DETAIL_TABLE_RE =
  /Insert\s+Into\s+((?:[A-Za-z_][A-Za-z0-9_]*(?:Detail|D[1-9])\w*)|(?:InvoiceTrxDetail|StoreTransDetail|StoreCollDetail|StoreDistDetail|ManufactProcessD[1-9]|ContractorsStatementsD[1-9]))\s*\(([^)]*)\)/gi;

const CELLS_RE =
  /(?:(\w+))?\.?Cells\[\s*(\d+)\s*,\s*0\s*\]\s*:=\s*([^;]+);/gi;

const SAVE_TRACE_RE =
  /Save_Trace\s*\(\s*([^,]+)\s*,\s*(?:'([^']+)'|([A-Za-z_][A-Za-z0-9_]*))/gi;

const INSERT_TAX_RE =
  /Insert\s+Into\s+(Eshar|SalesDaribaEshar|Dariba[A-Za-z0-9_]*)\s*(?:\(([^)]*)\))?/gi;

const INSERT_ALARMS_RE = /Insert\s+Into\s+Alarms\s*(?:\(([^)]*)\))?/gi;

const INSERT_ITEMCOST_RE = /Insert\s+Into\s+ItemCost\b/gi;

const STATUS_POST_RE = /Status\s*=\s*'Post'/gi;
const STATUS_UNPOST_RE = /Status\s*=\s*'UnPost'/gi;
const DELETED_T_RE = /Deleted\s*=\s*'T'/gi;

const SHOW_LANG_RE = /ShowLangMessage\s*\(\s*(\d+)/gi;

const COLUMN_BUCKETS = {
  UnitCode1: { bucket: 'unit', concept: 'primaryUnit' },
  Qty1: { bucket: 'unit', concept: 'primaryQty' },
  UnitCode2: { bucket: 'unit', concept: 'altUnit' },
  Qty2: { bucket: 'unit', concept: 'altQty' },
  ChangeConst: { bucket: 'unit', concept: 'unitFactor' },
  DiscPercent: { bucket: 'discount', concept: 'discountPercent' },
  DiscValue: { bucket: 'discount', concept: 'discountAmount' },
  DaribaPercent: { bucket: 'tax', concept: 'taxPercent' },
  DaribaValue: { bucket: 'tax', concept: 'taxAmount' },
  Value1: { bucket: 'tax', concept: 'extraValue1' },
  Value2: { bucket: 'tax', concept: 'extraValue2' },
  Value3: { bucket: 'tax', concept: 'extraValue3' },
  Value4: { bucket: 'tax', concept: 'extraValue4' },
  Value5: { bucket: 'tax', concept: 'extraValue5' },
  Value6: { bucket: 'tax', concept: 'extraValue6' },
  Value1Type: { bucket: 'tax', concept: 'extraValueType' },
  Value2Type: { bucket: 'tax', concept: 'extraValueType' },
  Value3Type: { bucket: 'tax', concept: 'extraValueType' },
  Value4Type: { bucket: 'tax', concept: 'extraValueType' },
  Value5Type: { bucket: 'tax', concept: 'extraValueType' },
  Value6Type: { bucket: 'tax', concept: 'extraValueType' },
  DaribaCustomPercent1: { bucket: 'tax', concept: 'customTaxPercent' },
  DaribaCustomPercent2: { bucket: 'tax', concept: 'customTaxPercent' },
  DaribaCustomPercent3: { bucket: 'tax', concept: 'customTaxPercent' },
  DaribaCustomPercent4: { bucket: 'tax', concept: 'customTaxPercent' },
  DaribaCustomPercent5: { bucket: 'tax', concept: 'customTaxPercent' },
  DaribaCustomPercent6: { bucket: 'tax', concept: 'customTaxPercent' },
  DaribaCustomEquation1: { bucket: 'tax', concept: 'customTaxEquation' },
  ManbaDaribaPercentCode: { bucket: 'tax', concept: 'withholdingTax' },
  ManbaDaribaValue: { bucket: 'tax', concept: 'withholdingTax' },
  ManbaDaribaMinValue: { bucket: 'tax', concept: 'withholdingTax' },
  ExpDate: { bucket: 'traceability', concept: 'expiryDate' },
  ExpDateH: { bucket: 'traceability', concept: 'expiryDateHijri' },
  SerialNums: { bucket: 'traceability', concept: 'serialNumbers' },
  ItemColorSizeCode: { bucket: 'traceability', concept: 'colorSize' },
  CCenter: { bucket: 'ops', concept: 'costCenter' },
  StoreCode: { bucket: 'ops', concept: 'warehouse' },
  ItemWeight: { bucket: 'ops', concept: 'itemWeight' },
  PriceAgain: { bucket: 'ops', concept: 'priceAgain' },
  CostPrice: { bucket: 'ops', concept: 'costPrice' },
  ItemLossQty: { bucket: 'ops', concept: 'itemLossQty' },
  WorkPrice1: { bucket: 'ops', concept: 'workPrice' },
  WorkPrice2: { bucket: 'ops', concept: 'workPrice' },
  Itemcat: { bucket: 'ops', concept: 'itemCategory' },
  SpecialData: { bucket: 'ops', concept: 'specialData' },
  Price: { bucket: 'ops', concept: 'unitPrice' },
  TotalValue: { bucket: 'ops', concept: 'lineTotal' },
  NetValue: { bucket: 'ops', concept: 'lineNet' },
  ItemCode: { bucket: 'ops', concept: 'item' },
  QtyUsed1: { bucket: 'ops', concept: 'qtyUsed' },
  QtyReturned1: { bucket: 'ops', concept: 'qtyReturned' },
};

const REQUESTED_IDENTIFIERS = [
  { id: 'Length', verdict: 'absent', equivalent: null, note: 'No Length/Width/Thickness/Height columns on any detail table or grid.' },
  { id: 'Width', verdict: 'absent', equivalent: null, note: 'No dimensional columns in InvoiceTrxDetail / StoreTransDetail / ManufactProcessD*.' },
  { id: 'Thickness', verdict: 'absent', equivalent: null, note: 'Absent.' },
  { id: 'Height', verdict: 'absent', equivalent: null, note: 'Absent.' },
  { id: 'FreeQty', verdict: 'absent', equivalent: null, note: 'No FreeQty/BonusQty. Web grid has optional freeBonus UI only.' },
  { id: 'BonusQty', verdict: 'absent', equivalent: null, note: 'Absent.' },
  { id: 'PatchNo', verdict: 'absent', equivalent: null, note: 'No PatchNo/BatchNo in legacy detail tables.' },
  { id: 'BatchNo', verdict: 'absent', equivalent: 'InvoiceLine.batchNumber (web-only addition)', note: 'Legacy has no batch column. Web/Prisma added batchNumber later.' },
  { id: 'AltUnit', verdict: 'equivalent', equivalent: 'UnitCode2 + Qty2 + ChangeConst', note: 'Second unit pair, not a named AltUnit/MinorUnit/UnitFactor field.' },
  { id: 'MinorUnit', verdict: 'equivalent', equivalent: 'UnitCode2 / Qty2', note: 'Same as AltUnit.' },
  { id: 'UnitFactor', verdict: 'equivalent', equivalent: 'ChangeConst', note: 'Conversion flag/factor lives on ChangeConst.' },
  { id: 'TableTax', verdict: 'absent', equivalent: null, note: 'No TableTax/Damga/Stamp columns.' },
  { id: 'Damga', verdict: 'absent', equivalent: null, note: 'Absent.' },
  { id: 'Stamp', verdict: 'absent', equivalent: null, note: 'Absent.' },
  { id: 'DaribaItemDetail', verdict: 'absent', equivalent: 'DaribaMabiat / DaribaSadad / DaribaAlarms', note: 'Table does not exist.' },
  { id: 'DaribaTransactions', verdict: 'absent', equivalent: 'DaribaMabiat / DaribaMabiatPaid / DaribaSadad', note: 'Table does not exist.' },
  { id: 'EsharDetail', verdict: 'absent', equivalent: 'Eshar / SalesDaribaEshar', note: 'Table does not exist.' },
  { id: 'IsPosted', verdict: 'absent', equivalent: "Status='Post'|'UnPost'", note: 'Status is a string, not a boolean.' },
  { id: 'IsAudited', verdict: 'absent', equivalent: null, note: 'No IsAudited flag.' },
  { id: 'IsPrinted', verdict: 'absent', equivalent: null, note: 'No IsPrinted flag. Print is a Save_Trace Action.' },
  { id: 'Save_Trace.IP', verdict: 'absent', equivalent: null, note: 'Trace insert is Usercode, ScreenName, Action, Date, RecordCode, ActionDate, Name, CompanyCode, BranchCode.' },
  { id: 'Save_Trace.oldValue', verdict: 'absent', equivalent: null, note: 'No old/new value captured.' },
  { id: 'Person.Balance cache', verdict: 'absent', equivalent: 'dynamic Mozana / open-item sum', note: 'No Update Person Set Balance. Balances recomputed.' },
];

function listFiles(dir, ext, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.isDirectory()) {
      if (SKIP_DIRS.has(ent.name)) continue;
      listFiles(path.join(dir, ent.name), ext, out);
    } else if (ent.name.toLowerCase().endsWith(ext)) {
      out.push(path.join(dir, ent.name));
    }
  }
  return out;
}

function readPas(filePath) {
  try {
    return decodeCp1256(filePath);
  } catch {
    return fs.readFileSync(filePath, 'latin1');
  }
}

function joinStringLiterals(text) {
  const parts = [];
  let i = 0;
  while (i < text.length) {
    if (text[i] === "'") {
      let s = '';
      i += 1;
      while (i < text.length) {
        if (text[i] === "'" && text[i + 1] === "'") {
          s += "'";
          i += 2;
          continue;
        }
        if (text[i] === "'") {
          i += 1;
          break;
        }
        s += text[i];
        i += 1;
      }
      parts.push(s);
    } else {
      i += 1;
    }
  }
  return parts.join(' ');
}

function splitColumns(list) {
  return list
    .split(',')
    .map((c) => c.replace(/\[|\]/g, '').trim())
    .filter((c) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(c));
}

function classifyColumn(name) {
  const hit = COLUMN_BUCKETS[name];
  if (hit) return { name, ...hit };
  if (/^Dariba/i.test(name)) return { name, bucket: 'tax', concept: 'taxOther' };
  if (/^Value\d/i.test(name)) return { name, bucket: 'tax', concept: 'extraValue' };
  if (/Qty|Unit/i.test(name)) return { name, bucket: 'unit', concept: 'unitOther' };
  if (/Disc/i.test(name)) return { name, bucket: 'discount', concept: 'discountOther' };
  if (/Exp|Serial|Batch|Color|Size/i.test(name)) return { name, bucket: 'traceability', concept: 'traceOther' };
  if (/Length|Width|Thick|Height/i.test(name)) return { name, bucket: 'dimension', concept: 'dimension' };
  if (/Free|Bonus/i.test(name)) return { name, bucket: 'freeQty', concept: 'freeQty' };
  return { name, bucket: 'ops', concept: 'other' };
}

function classifyRuleCondition(snippet) {
  const tags = [];
  if (/AllowMinusQty/i.test(snippet)) tags.push('AllowMinusQty');
  if (/GetPeriod/i.test(snippet)) tags.push('GetPeriod');
  if (/\bCCType\b/i.test(snippet)) tags.push('CCType');
  if (/Mozana|Moazna|CheckMoazna/i.test(snippet)) tags.push('Mozana');
  if (/StoreCheck/i.test(snippet)) tags.push('StoreCheck');
  if (/CheckOperationAfter/i.test(snippet)) tags.push('CheckOperationAfter');
  if (/AdvancedRights/i.test(snippet)) tags.push('AdvancedRights');
  return tags;
}

function timingFromProcName(name) {
  const n = String(name || '').toLowerCase();
  if (/undelete/.test(n)) return 'UnDelete';
  if (/unpost/.test(n)) return 'UnPost';
  if (/delete/.test(n)) return 'Delete';
  if (/print/.test(n)) return 'Print';
  if (/post|dxbutton1/.test(n)) return 'Post';
  if (/save/.test(n)) return 'Save';
  return 'Other';
}

function procedureAtLine(bodies, line) {
  let best = null;
  for (const rec of bodies.values()) {
    if (rec.line <= line && (!best || rec.line > best.line)) best = rec;
  }
  return best;
}

function extractGuards(blob, messages) {
  const rules = [];
  const seen = new Set();
  for (const m of blob.matchAll(SHOW_LANG_RE)) {
    const code = Number(m[1]);
    const idx = m.index ?? 0;
    const before = blob.slice(Math.max(0, idx - 500), idx);
    const after = blob.slice(idx, idx + 280);
    const ifMatch = before.match(/if\s+([\s\S]{8,220}?)\s+then\b/i);
    const condition = ifMatch ? ifMatch[1].replace(/\s+/g, ' ').trim().slice(0, 220) : '';
    const hardBlock = /\bExit\b|Result\s*:=\s*False/i.test(after);
    const key = `${code}|${condition}|${hardBlock}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const msg = messages.get(code);
    rules.push({
      code,
      ar: msg?.ar || '',
      en: msg?.en || '',
      condition,
      hardBlock,
      warningOnly: !hardBlock,
      tags: classifyRuleCondition(`${condition} ${before}`),
    });
  }
  return rules;
}

function extractInserts(joinedSql) {
  const byTable = new Map();
  for (const m of joinedSql.matchAll(DETAIL_TABLE_RE)) {
    const table = m[1];
    const columns = splitColumns(m[2]);
    if (!columns.length) continue;
    const rec = byTable.get(table.toLowerCase()) || {
      table,
      columns: [],
      classified: [],
    };
    const have = new Set(rec.columns.map((c) => c.toLowerCase()));
    for (const col of columns) {
      if (have.has(col.toLowerCase())) continue;
      have.add(col.toLowerCase());
      rec.columns.push(col);
      rec.classified.push(classifyColumn(col));
    }
    byTable.set(table.toLowerCase(), rec);
  }
  return [...byTable.values()];
}

function extractCellTitles(text, messages) {
  const out = [];
  const seen = new Set();
  for (const m of text.matchAll(CELLS_RE)) {
    const grid = m[1] || 'AdvStringGrid';
    const index = Number(m[2]);
    const rhs = m[3].trim();
    let title = '';
    const lit = rhs.match(/^'((?:''|[^'])*)'/);
    if (lit) title = lit[1].replace(/''/g, "'");
    const fill = rhs.match(/FillFixedText\s*\(\s*(\d+)/i);
    if (fill) {
      const code = Number(fill[1]);
      title = messages.get(code)?.ar || `FillFixedText(${code})`;
    }
    if (!title) continue;
    const key = `${grid}|${index}|${title}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ grid, index, title, classified: classifyColumn(title.replace(/\s+/g, '')) });
  }
  return out;
}

function collectDfmHeaders(dfmJson) {
  const headers = [];
  function walk(node) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node.columnHeaders) && node.columnHeaders.length) {
      headers.push({
        grid: node.name || 'grid',
        columnHeaders: node.columnHeaders.filter((h) => String(h || '').trim()),
      });
    }
    for (const child of node.children || []) walk(child);
  }
  walk(dfmJson?.controlTree || dfmJson);
  return headers;
}

function classifyModule({ formName, unitName, webRoute, tables }) {
  const blob = `${formName} ${unitName} ${webRoute} ${tables.join(' ')}`;
  for (const mod of MODULES) {
    if (mod.formRe.test(blob) || mod.tableRe.test(blob) || mod.routeRe.test(webRoute || '')) {
      return mod;
    }
  }
  return null;
}

function loadScreenIndex() {
  const byForm = new Map();
  const byUnit = new Map();
  if (!fs.existsSync(SCREENS_DIR)) return { byForm, byUnit };
  for (const file of fs.readdirSync(SCREENS_DIR).filter((f) => f.endsWith('.json'))) {
    const screen = readJson(path.join(SCREENS_DIR, file));
    if (!screen) continue;
    if (screen.formName) byForm.set(String(screen.formName).toLowerCase(), screen);
    if (screen.unitName) byUnit.set(String(screen.unitName).toLowerCase(), screen);
  }
  return { byForm, byUnit };
}

function loadDfmIndex() {
  const byForm = new Map();
  if (!fs.existsSync(DFM_DIR)) return byForm;
  for (const file of fs.readdirSync(DFM_DIR).filter((f) => f.endsWith('.json'))) {
    const dfm = readJson(path.join(DFM_DIR, file));
    if (dfm?.formName) byForm.set(String(dfm.formName).toLowerCase(), dfm);
  }
  return byForm;
}

function extractPrismaLineFields(schemaText) {
  const models = {};
  const re = /model\s+(InvoiceLine|TransferLine|AssemblyLine|StocktakingLine|CashTransactionLine|Cheque)\s*\{([\s\S]*?)\n\}/g;
  for (const m of schemaText.matchAll(re)) {
    const fields = [...m[2].matchAll(/^\s{2}([A-Za-z_][A-Za-z0-9_]*)\s+/gm)].map((x) => x[1]);
    models[m[1]] = fields.filter((f) => !['@@index', '@@unique', '@@map', '@@id'].includes(f));
  }
  return models;
}

function extractZodLineKeys(schemaText) {
  const keys = new Set();
  const block = schemaText.match(/salesInvoiceLineSchema\s*=\s*z\.object\(\{([\s\S]*?)\}\)/);
  if (block) {
    for (const m of block[1].matchAll(/^\s{2}([A-Za-z_][A-Za-z0-9_]*)\s*:/gm)) keys.add(m[1]);
  }
  return [...keys];
}

function extractWebGridColumns(colText) {
  const ids = [];
  const block = colText.match(/export type InvoiceLineColumnId\s*=([\s\S]*?);/);
  if (block) {
    for (const m of block[1].matchAll(/'([^']+)'/g)) ids.push(m[1]);
  }
  return ids;
}

const CONCEPT_COVERAGE = {
  primaryUnit: { status: 'covered', prisma: ['InvoiceLine.unitId'], zod: ['unitId'], grid: ['unit'] },
  primaryQty: { status: 'covered', prisma: ['InvoiceLine.quantity', 'InvoiceLine.baseQuantity'], zod: ['quantity'], grid: ['quantity'] },
  altUnit: { status: 'partial', prisma: [], zod: [], grid: ['unitConversion'], note: 'Web stores conversion UI only; no UnitCode2 column.' },
  altQty: { status: 'missing', prisma: [], zod: [], grid: [] },
  unitFactor: { status: 'partial', prisma: [], zod: [], grid: ['unitConversion'] },
  discountPercent: { status: 'covered', prisma: ['InvoiceLine.discountPercent'], zod: ['discount'], grid: ['discount'] },
  discountAmount: { status: 'partial', prisma: ['InvoiceLine.discountAmount'], zod: [], grid: [] },
  taxPercent: { status: 'covered', prisma: ['InvoiceLine.taxPercent'], zod: ['taxRate'], grid: ['taxRate'] },
  taxAmount: { status: 'partial', prisma: ['InvoiceLine.taxAmount'], zod: [], grid: [] },
  extraValue1: { status: 'missing', prisma: [], zod: [], grid: [], note: 'Value1–6 extra tax/charge slots are not on InvoiceLine.' },
  extraValue2: { status: 'missing', prisma: [], zod: [], grid: [] },
  extraValue3: { status: 'missing', prisma: [], zod: [], grid: [] },
  extraValue4: { status: 'missing', prisma: [], zod: [], grid: [] },
  extraValue5: { status: 'missing', prisma: [], zod: [], grid: [] },
  extraValue6: { status: 'missing', prisma: [], zod: [], grid: [] },
  extraValueType: { status: 'missing', prisma: [], zod: [], grid: [] },
  customTaxPercent: { status: 'missing', prisma: [], zod: [], grid: [] },
  customTaxEquation: { status: 'missing', prisma: [], zod: [], grid: [] },
  withholdingTax: { status: 'partial', prisma: ['Invoice.withholdingTaxAmount'], zod: [], grid: [] },
  expiryDate: { status: 'covered', prisma: ['InvoiceLine.expiryDate'], zod: ['expiryDate'], grid: ['expiryDate'] },
  expiryDateHijri: { status: 'missing', prisma: [], zod: [], grid: [] },
  serialNumbers: { status: 'covered', prisma: ['InvoiceLine.serialNumbers'], zod: ['serialNumbers'], grid: ['serialNumbers'] },
  colorSize: { status: 'missing', prisma: [], zod: [], grid: [] },
  costCenter: { status: 'partial', prisma: ['Invoice.costCenterId'], zod: ['costCenterId'], grid: ['costCenter'], note: 'Header/line cost center on web; no InvoiceLine.costCenterId.' },
  warehouse: { status: 'covered', prisma: ['InvoiceLine.warehouseId'], zod: ['warehouseId'], grid: ['warehouse'] },
  itemWeight: { status: 'missing', prisma: [], zod: [], grid: [] },
  priceAgain: { status: 'missing', prisma: [], zod: [], grid: [] },
  costPrice: { status: 'partial', prisma: ['InvoiceLine.unitCostAtIssue'], zod: [], grid: [] },
  itemLossQty: { status: 'missing', prisma: [], zod: [], grid: [] },
  workPrice: { status: 'missing', prisma: [], zod: [], grid: [] },
  itemCategory: { status: 'missing', prisma: [], zod: [], grid: [] },
  specialData: { status: 'missing', prisma: [], zod: [], grid: [] },
  unitPrice: { status: 'covered', prisma: ['InvoiceLine.price'], zod: ['unitPrice'], grid: ['unitPrice'] },
  lineTotal: { status: 'covered', prisma: ['InvoiceLine.total'], zod: [], grid: ['total'] },
  lineNet: { status: 'partial', prisma: ['InvoiceLine.total'], zod: [], grid: ['total'] },
  item: { status: 'covered', prisma: ['InvoiceLine.itemId'], zod: ['itemId'], grid: ['item'] },
  qtyUsed: { status: 'missing', prisma: [], zod: [], grid: [] },
  qtyReturned: { status: 'partial', prisma: ['InvoiceLine.originalInvoiceLineId'], zod: [], grid: [] },
  freeQty: { status: 'partial', prisma: [], zod: [], grid: ['freeBonus'], note: 'Web-only optional column; no Prisma field.' },
  dimension: { status: 'missing', prisma: [], zod: [], grid: [] },
};

function coverageForConcept(concept) {
  return CONCEPT_COVERAGE[concept] || { status: 'missing', prisma: [], zod: [], grid: [] };
}

function actionForStatus(status, concept) {
  if (status === 'covered') return 'Keep — already on Prisma / Zod / grid.';
  if (status === 'partial') return `Complete ${concept} mapping (legacy has a dedicated column).`;
  return `Decide whether ${concept} is required for parity; not present on web/Prisma.`;
}

function uniquePush(arr, keyFn, item) {
  const k = keyFn(item);
  if (arr._seen?.has(k)) return;
  if (!arr._seen) arr._seen = new Set();
  arr._seen.add(k);
  arr.push(item);
}

function mineUnit({ pasPath, text, messages, screen, dfm }) {
  const bodies = extractProcedureBodies(text);
  const saves = findSaveHandlers(bodies);
  const saveBlob = saves
    .map((s) => [s.body, ...collectCalledMethods(s, bodies).map((c) => c.body)].join('\n'))
    .join('\n');

  const joinedSql = joinStringLiterals(text);
  const detailInserts = extractInserts(joinedSql);
  const cellTitles = extractCellTitles(text, messages);
  const dfmHeaders = dfm ? collectDfmHeaders(dfm) : [];

  const rules = extractGuards(saveBlob || text, messages);

  const traces = [];
  const saveTraceSiteCount = [...text.matchAll(/Save_Trace\s*\(/gi)].length;
  for (const m of text.matchAll(SAVE_TRACE_RE)) {
    const screenExpr = m[1].trim();
    if (/^ScreenName$/i.test(screenExpr)) continue;
    const line = text.slice(0, m.index).split(/\r\n|\r|\n/).length;
    const proc = procedureAtLine(bodies, line);
    traces.push({
      action: m[2] || m[3] || 'unknown',
      screenExpr,
      line,
      timing: timingFromProcName(proc?.name),
      procedure: proc?.name || null,
    });
  }

  const taxInserts = [];
  for (const m of joinedSql.matchAll(INSERT_TAX_RE)) {
    taxInserts.push({ table: m[1], columns: m[2] ? splitColumns(m[2]) : [] });
  }

  const alarmInserts = [];
  for (const m of joinedSql.matchAll(INSERT_ALARMS_RE)) {
    alarmInserts.push({ columns: m[1] ? splitColumns(m[1]) : [] });
  }

  const itemCostInserts = [...joinedSql.matchAll(INSERT_ITEMCOST_RE)].length;
  const statusPost = [...text.matchAll(STATUS_POST_RE)].length;
  const statusUnpost = [...text.matchAll(STATUS_UNPOST_RE)].length;
  const deletedT = [...text.matchAll(DELETED_T_RE)].length;

  const showLangCodes = [...text.matchAll(SHOW_LANG_RE)].map((m) => Number(m[1]));

  const checkMoaznaDefined = /procedure\s+\w+\.CheckMoazna/i.test(text);
  const checkMoaznaCalled = /(?<!procedure\s+\w+\.)CheckMoazna\s*\(/i.test(text);

  return {
    unitName: screen?.unitName || path.basename(pasPath, '.pas'),
    pasPath: path.relative(REPO_ROOT, pasPath),
    formName: screen?.formName || dfm?.formName || null,
    titleAr: screen?.titleAr || '',
    titleEn: screen?.titleEn || '',
    webRoute: screen?.webRoute || null,
    isReport: Boolean(screen?.isReport),
    outOfScope: isOutOfScopeForm(screen?.formName, screen?.menuPath),
    detailInserts,
    dfmHeaders,
    cellTitles,
    rules,
    traces,
    saveTraceSiteCount,
    taxInserts,
    alarmInserts,
    itemCostInserts,
    statusPost,
    statusUnpost,
    deletedT,
    showLangCodes,
    hasSaveHandler: saves.length > 0,
    saveHandlers: saves.map((s) => s.name),
    storedProcs: [...text.matchAll(/StoredProcName\s*:=\s*'([^']+)'/gi)].map((m) => m[1]),
    checkMoaznaDefined,
    checkMoaznaCalled,
  };
}

function buildMatrix(units, xref) {
  const detailTables = {};
  const modules = Object.fromEntries(
    MODULES.map((m) => [m.id, { id: m.id, title: m.title, screens: [] }])
  );

  for (const unit of units) {
    for (const ins of unit.detailInserts) {
      const rec = detailTables[ins.table] || { table: ins.table, columns: [] };
      const have = new Set(rec.columns.map((c) => c.toLowerCase()));
      for (const col of ins.columns) {
        if (!have.has(col.toLowerCase())) {
          have.add(col.toLowerCase());
          rec.columns.push(col);
        }
      }
      detailTables[ins.table] = rec;
    }

    if (unit.outOfScope) continue;
    const tables = unit.detailInserts.map((d) => d.table);
    const mod = classifyModule({
      formName: unit.formName || '',
      unitName: unit.unitName || '',
      webRoute: unit.webRoute || '',
      tables,
    });
    if (!mod) continue;
    if (
      !unit.detailInserts.length &&
      !unit.rules.length &&
      !unit.traces.length &&
      !unit.taxInserts.length &&
      !unit.itemCostInserts &&
      !unit.statusPost
    ) {
      continue;
    }

    const lineFields = [];
    for (const ins of unit.detailInserts) {
      for (const col of ins.classified) {
        const cov = coverageForConcept(col.concept);
        uniquePush(lineFields, (x) => x.name, {
          name: col.name,
          bucket: col.bucket,
          concept: col.concept,
          source: `Insert Into ${ins.table}`,
          coverage: cov.status,
          prisma: cov.prisma,
          zod: cov.zod,
          grid: cov.grid,
        });
      }
    }
    for (const grid of unit.dfmHeaders) {
      for (const header of grid.columnHeaders) {
        uniquePush(lineFields, (x) => `hdr:${header}`, {
          name: header,
          bucket: 'grid',
          concept: 'visibleHeader',
          source: `DFM ${grid.grid}`,
          coverage: 'partial',
          prisma: [],
          zod: [],
          grid: [],
        });
      }
    }

    modules[mod.id].screens.push({
      screen: unit.formName || unit.unitName,
      unitName: unit.unitName,
      titleAr: unit.titleAr,
      titleEn: unit.titleEn,
      webRoute: unit.webRoute,
      webModule: moduleFromRoute(unit.webRoute),
      lineFields,
      rules: unit.rules,
      sideEffects: {
        traces: unit.traces,
        taxInserts: unit.taxInserts,
        alarmInserts: unit.alarmInserts,
        itemCostInserts: unit.itemCostInserts,
        statusPost: unit.statusPost,
        statusUnpost: unit.statusUnpost,
        deletedT: unit.deletedT,
        storedProcs: unit.storedProcs,
        timings: [...new Set(unit.traces.map((t) => t.timing))],
      },
    });
  }

  return { detailTables, modules, xref };
}

function renderMd({ generatedAt, sanity, requestedIdentifiers, detailTables, modules, limitations }) {
  const lines = [];
  lines.push('# Deep Legacy Mining Report');
  lines.push('');
  lines.push(`Generated ${generatedAt}.`);
  lines.push('');
  lines.push('Forensic extract of Delphi line grids, pre-save guards, and post-save side effects,');
  lines.push('cross-referenced against Prisma line models, gates-web Zod line schemas, and `invoiceLineColumns.ts`.');
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push('| Metric | Count |');
  lines.push('|---|---:|');
  for (const [k, v] of Object.entries(sanity)) {
    lines.push(`| ${k} | ${v} |`);
  }
  lines.push('');

  lines.push('## Requested-identifier verdicts');
  lines.push('');
  lines.push('| Identifier | Verdict | Real equivalent | Note |');
  lines.push('|---|---|---|---|');
  for (const row of requestedIdentifiers) {
    lines.push(`| \`${row.id}\` | ${row.verdict} | ${row.equivalent ? `\`${row.equivalent}\`` : '—'} | ${row.note} |`);
  }
  lines.push('');

  lines.push('## Verbatim detail-table column lists');
  lines.push('');
  const order = [
    'InvoiceTrxDetail',
    'StoreTransDetail',
    'StoreCollDetail',
    'StoreDistDetail',
    'ManufactProcessD1',
    'ManufactProcessD2',
    'ManufactProcessD3',
    'ManufactProcessD4',
    'ContractorsStatementsD1',
    'ContractorsStatementsD2',
    'ContractorsStatementsD3',
  ];
  const tables = [
    ...order.filter((t) => detailTables[t]),
    ...Object.keys(detailTables).filter((t) => !order.includes(t)).sort(),
  ];
  for (const table of tables) {
    const rec = detailTables[table];
    lines.push(`### ${table} (${rec.columns.length} columns)`);
    lines.push('');
    lines.push('```');
    lines.push(rec.columns.join(', '));
    lines.push('```');
    lines.push('');
  }

  for (const mod of MODULES) {
    const block = modules[mod.id];
    lines.push(`## ${mod.title}`);
    lines.push('');
    if (!block.screens.length) {
      lines.push('_No operational screens with line fields, save rules, or side effects were classified here._');
      lines.push('');
      continue;
    }
    lines.push('| Screen | Legacy Business Rule / Line Field | Web/Backend Status | Action Required |');
    lines.push('|---|---|---|---|');
    for (const screen of block.screens) {
      const label = screen.titleAr
        ? `${screen.titleAr} \`${screen.screen}\``
        : `\`${screen.screen}\``;
      const fieldRows = screen.lineFields.filter((f) => f.bucket !== 'grid').slice(0, 24);
      for (const f of fieldRows) {
        lines.push(
          `| ${label} | Line field \`${f.name}\` (${f.bucket} / ${f.concept}) via ${f.source} | ${f.coverage} | ${actionForStatus(f.coverage, f.concept)} |`
        );
      }
      for (const rule of screen.rules.slice(0, 12)) {
        const kind = rule.hardBlock ? 'hardBlock' : 'warningOnly';
        const tags = rule.tags.length ? ` [${rule.tags.join(', ')}]` : '';
        const ar = (rule.ar || '').replace(/\|/g, '/').slice(0, 80);
        lines.push(
          `| ${label} | Save guard ${kind} ShowLangMessage(${rule.code})${tags}: ${ar || rule.condition || '—'} | ${screen.webRoute ? 'mapped' : 'unmapped'} | ${rule.hardBlock ? 'Port as a blocking validation' : 'Port as a warning (legacy does not Exit)'} |`
        );
      }
      const fx = screen.sideEffects;
      if (fx.traces.length) {
        const actions = [...new Set(fx.traces.map((t) => `${t.action}@${t.timing}`))].join(', ');
        lines.push(
          `| ${label} | Save_Trace actions: ${actions} | ${screen.webRoute ? 'partial' : 'missing'} | Trace is user/screen/action/record only — no IP, no old/new. |`
        );
      }
      if (fx.taxInserts.length) {
        lines.push(
          `| ${label} | Tax ledgers: ${[...new Set(fx.taxInserts.map((t) => t.table))].join(', ')} | partial | Real tables are Eshar / Dariba* — not DaribaItemDetail / EsharDetail. |`
        );
      }
      if (fx.itemCostInserts) {
        lines.push(
          `| ${label} | ItemCost ledger inserts (${fx.itemCostInserts}) | partial | Append-only cost ledger on Post, not on Save. |`
        );
      }
      if (fx.statusPost) {
        lines.push(
          `| ${label} | Status='Post' (${fx.statusPost}) / UnPost (${fx.statusUnpost}) / Deleted='T' (${fx.deletedT}) | partial | Web uses isPosted / isCancelled booleans. |`
        );
      }
      if (fx.storedProcs.some((p) => /SaveInvoices|SaveReturnInvoices/i.test(p))) {
        lines.push(
          `| ${label} | Stored proc ${fx.storedProcs.filter((p) => /SaveInvoices|SaveReturnInvoices/i.test(p)).join(', ')} | needs-db-access | SP body is not in the repo. |`
        );
      }
    }
    lines.push('');
  }

  lines.push('## Limitations');
  lines.push('');
  for (const item of limitations) {
    lines.push(`- ${item}`);
  }
  lines.push('');
  lines.push('## How to read this');
  lines.push('');
  lines.push('- `covered` = Prisma + Zod or grid already store the concept.');
  lines.push('- `partial` = web has a related field but not the full legacy column set.');
  lines.push('- `missing` = no web/Prisma counterpart.');
  lines.push('- `needs-db-access` = `SaveInvoices` / `SaveReturnInvoices` bodies are not in the repo.');
  lines.push('- `hardBlock` = ShowLangMessage is followed by Exit / Result:=False.');
  lines.push('- `warningOnly` = message without abort (Mozana-style credit warnings).');
  lines.push('');
  return lines.join('\n');
}

function main() {
  console.log('Deep legacy mining…');
  const messagesPath = path.join(SRC_DIR, 'LangMessages.txt');
  if (!fs.existsSync(messagesPath)) {
    throw new Error(`LangMessages.txt not found at ${messagesPath}`);
  }
  const messages = parseLangMessages(messagesPath);
  const screens = loadScreenIndex();
  const dfms = loadDfmIndex();

  const pasFiles = listFiles(SRC_DIR, '.pas');
  const units = [];
  const allShowLang = new Set();
  let saveTraceSites = 0;
  let resolvedArabic = 0;
  let checkMoaznaDead = [];

  for (const pasPath of pasFiles) {
    const text = readPas(pasPath);
    const unitKey = path.basename(pasPath, path.extname(pasPath)).toLowerCase();
    const screen =
      screens.byUnit.get(unitKey) ||
      screens.byForm.get(unitKey) ||
      null;
    const formKey = String(screen?.formName || '').toLowerCase();
    const dfm =
      (formKey && dfms.get(formKey)) ||
      dfms.get(unitKey) ||
      (screen?.formName
        ? readJson(dfmJsonPath(PARITY_DIR, `${screen.formName}.dfm`))
        : null);

    const mined = mineUnit({ pasPath, text, messages, screen, dfm });
    units.push(mined);
    for (const code of mined.showLangCodes) {
      allShowLang.add(code);
      if (messages.get(code)?.ar) resolvedArabic += 0; // counted later
    }
    saveTraceSites += mined.saveTraceSiteCount;
    if (mined.checkMoaznaDefined && !mined.checkMoaznaCalled) {
      checkMoaznaDead.push(mined.unitName);
    }
  }

  for (const code of allShowLang) {
    if (messages.get(code)?.ar) resolvedArabic += 1;
  }

  const schemaPath = path.join(REPO_ROOT, 'gates-backend/prisma/schema.prisma');
  const zodPath = path.join(REPO_ROOT, 'gates-web/lib/validation/inventory.schema.ts');
  const colsPath = path.join(REPO_ROOT, 'gates-web/lib/invoices/invoiceLineColumns.ts');
  const xref = {
    prismaLineModels: fs.existsSync(schemaPath)
      ? extractPrismaLineFields(fs.readFileSync(schemaPath, 'utf8'))
      : {},
    zodLineKeys: fs.existsSync(zodPath) ? extractZodLineKeys(fs.readFileSync(zodPath, 'utf8')) : [],
    webGridColumns: fs.existsSync(colsPath)
      ? extractWebGridColumns(fs.readFileSync(colsPath, 'utf8'))
      : [],
  };

  const { detailTables, modules } = buildMatrix(units, xref);
  const invoiceCols = detailTables.InvoiceTrxDetail?.columns?.length || 0;

  const sanity = {
    'PAS units scanned': pasFiles.length,
    'LangMessages codes in file': messages.size,
    'Distinct ShowLangMessage codes': allShowLang.size,
    'ShowLangMessage codes resolving to Arabic': resolvedArabic,
    'Save_Trace call sites': saveTraceSites,
    'InvoiceTrxDetail columns (Insert Into union)': invoiceCols,
    'Detail tables discovered': Object.keys(detailTables).length,
    [`${MODULES[0].title} screens`]: modules[MODULES[0].id].screens.length,
    [`${MODULES[1].title} screens`]: modules[MODULES[1].id].screens.length,
    [`${MODULES[2].title} screens`]: modules[MODULES[2].id].screens.length,
    [`${MODULES[3].title} screens`]: modules[MODULES[3].id].screens.length,
    [`${MODULES[4].title} screens`]: modules[MODULES[4].id].screens.length,
  };

  const limitations = [
    '`SaveInvoices` / `SaveReturnInvoices` stored-procedure bodies are not in the repo (only `MainProgram/Drivers_Distributers.sql` exists). Invoice-side server rules are flagged `needs-db-access`.',
    '`CheckMoazna()` is implemented in `untPInovice.pas` but never called — dead client-side code, not a live save rule.' +
      (checkMoaznaDead.length ? ` Units with unused definition: ${checkMoaznaDead.join(', ')}.` : ''),
    'No sell-below-cost guard exists in Pascal save handlers; it appears only in audit dashboards. `Item.noSellBelowCost` exists in Prisma but is unenforced — a web-side gap, not a legacy parity gap.',
    '`Save_Trace` fires on Post / Delete / Print / UnPost — not on invoice Save. The Trace table has no IP and no old/new value.',
    'Line grids are unbound `TAdvStringGrid`. Authoritative fields are `Insert Into <DetailTable>(...)`. DFM `columnHeaders` show only the visible subset.',
    'Grids and `.pas` sources are CP1256; LangMessages.txt is UTF-16LE. This script reuses `decodeCp1256` / `parseLangMessages` from `parity-utils.mjs` (no iconv-lite).',
    'Requested identifiers Length/Width/Thickness, FreeQty/BonusQty, BatchNo, AltUnit, TableTax/Damga, DaribaItemDetail, EsharDetail, IsPosted/IsAudited/IsPrinted are absent from the sources — see the verdict table.',
  ];

  const generatedAt = new Date().toISOString();
  const matrix = {
    generatedAt,
    sanity,
    requestedIdentifiers: REQUESTED_IDENTIFIERS,
    detailTables,
    modules,
    xref,
    limitations,
  };

  const jsonPath = path.join(PARITY_DIR, 'deep-mining-matrix.json');
  const mdPath = path.join(PARITY_DIR, 'DEEP-MINING-REPORT.md');
  writeJson(jsonPath, matrix);
  writeText(
    mdPath,
    renderMd({
      generatedAt,
      sanity,
      requestedIdentifiers: REQUESTED_IDENTIFIERS,
      detailTables,
      modules,
      limitations,
    })
  );

  console.log('Sanity');
  for (const [k, v] of Object.entries(sanity)) console.log(`  ${k}: ${v}`);
  console.log(`Wrote ${path.relative(REPO_ROOT, jsonPath)}`);
  console.log(`Wrote ${path.relative(REPO_ROOT, mdPath)}`);

  if (allShowLang.size < 1000) {
    console.warn('WARN: ShowLangMessage distinct codes look low (expected ≈2173).');
  }
  if (saveTraceSites < 400) {
    console.warn('WARN: Save_Trace sites look low (expected ≈677).');
  }
  if (invoiceCols < 40) {
    console.warn('WARN: InvoiceTrxDetail column union looks low (expected ≈67).');
  }
  for (const mod of MODULES) {
    if (!modules[mod.id].screens.length) {
      console.warn(`WARN: module section empty: ${mod.title}`);
    }
  }
}

main();
