#!/usr/bin/env node
/**
 * Shared helpers for the legacy ↔ web parity gap pipeline.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(__dirname, '../../../');

export function parseArgs(argv, keys) {
  const out = Object.fromEntries(keys.map((k) => [k, null]));
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i]?.replace(/^--/, '');
    if (key && Object.prototype.hasOwnProperty.call(out, key)) {
      out[key] = argv[++i];
    }
  }
  return out;
}

export function readJson(p, fallback = null) {
  if (!fs.existsSync(p)) return fallback;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

export function writeJson(p, data) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

export function writeText(p, text) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, text.endsWith('\n') ? text : text + '\n', 'utf8');
}

export function decodeUtf16Le(filePath) {
  const raw = fs.readFileSync(filePath);
  let text = raw.toString('utf16le');
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  return text;
}

export function decodeCp1256(filePath) {
  return new TextDecoder('windows-1256').decode(fs.readFileSync(filePath));
}

export function splitCsvLine(line) {
  const parts = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === ',' && !inQuotes) {
      parts.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  parts.push(cur);
  return parts;
}

export function normalizeArabic(value) {
  if (!value) return '';
  return String(value)
    .normalize('NFC')
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[إأآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[^\u0621-\u064A0-9a-zA-Z]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

export function stripArabicChrome(value) {
  return normalizeArabic(value)
    .replace(/^(شاشه|تعريف|بطاقه|تقرير|قائمه|سند|امر|فاتوره)\s+/, '')
    .trim();
}

export const ORPHAN_UNITS = new Set([
  'blsetting',
  'untspecialrepoptions1',
  'untemployeecontrol',
  'untemployeegroups',
  'untemployeemonthattendance - copy',
  'untemployeeshifts',
  'unthremployeeattendancetrans',
  'unthremployeevacation',
  'unthrgroupsholidays',
  'unthrshifts',
  'iphlpapi',
  'iphelper',
  'untattach',
  'untdatabase',
  'untdatabaserep',
  'untdistpayments',
  'untfollowcustomers',
  'untfollowcustomersalarm',
  'untisyrep',
  'untmenu',
  'untnewexpiredate',
  'untprojectrepoptions3',
  'untprojectrepoptions4',
  'untreplicationsetting',
  'untsendelectronicinvoices1',
  'untstoreadjust',
  'untunitchannel',
  'untunitcustomer',
  'untunitemployee',
  'untunitforothers',
  'untunitforsales',
  'untunitsrepoptions1',
  'untunitsrepoptions2',
  'untunitsrepoptions3',
  'untunitsrepoptions4',
  'untunitsrepoptions5',
  'smbackup',
  'untdelpos',
  'untdriver',
  'unthange',
  'untisyoptions',
  'untnation',
  'untposreturn',
]);

export function isOrphanUnit(unitName) {
  return ORPHAN_UNITS.has(String(unitName || '').toLowerCase());
}

/** Paint-mixing / color POS forms — not core ERP. */
export const COLOR_POS_FORMS = new Set([
  'frmposcolor',
  'frmdelposcolor',
  'frmcolorsizecombination',
  'frmposcolorfinish',
  'frmposreturncolor',
  'frmprintposcolorinvoice',
  'frmcolor',
  'frmhangecolor',
]);

/** License / password / dashboard / help shells — not operational backlog. */
export const OBSOLETE_UTILITY_FORMS = new Set([
  'sm_fmapplisence',
  'frmchangepassward',
  'frmpassward',
  'frmdashboard1',
  'frmdashboard2',
  'frmhelp',
  'frmdisplayhelp',
]);

/**
 * Out-of-scope for the core ERP gap backlog: schools, paint-color POS,
 * and obsolete utility shells.
 */
export function isOutOfScopeForm(formName, menuPath = []) {
  const key = String(formName || '').toLowerCase();
  if (!key) return false;
  if (key.startsWith('frmschool')) return true;
  if (COLOR_POS_FORMS.has(key)) return true;
  if (/pos.*color|color.*pos|delposcolor|hangecolor|printposcolor/i.test(key)) return true;
  if (OBSOLETE_UTILITY_FORMS.has(key)) return true;
  const menu = Array.isArray(menuPath) ? menuPath.join(' ') : String(menuPath || '');
  if (menu.includes('المدارس')) return true;
  return false;
}

/** Manual corrections for known false-negative / wrong seed mappings. */
export const KNOWN_ROUTE_OVERRIDES = {
  frmstorecoll: '/inventory/operations/assembly',
  frmstoredist: '/inventory/operations/disassembly',
  frmbg: '/inventory/operations/opening-stock',
  frmgl: '/accounting/operations/journal-entry',
  frmpaymentcheck: '/accounting/operations/securities/payment',
  frmpaymentcheckmany: '/accounting/operations/securities/payment',
  frmrecievecheck: '/accounting/operations/securities/reciept',
  frmreceivecheck: '/accounting/operations/securities/reciept',
  frmrecievecheckmany: '/accounting/operations/securities/reciept',
  frmreceivecheckmany: '/accounting/operations/securities/reciept',
  // Exact live route (requested /importexport/guarantee-letters does not exist).
  frmdaman: '/importexport/accreditations/letters-of-guarantee',
  frmdamansetting: '/importexport/accreditations/letter-of-guarantee-settings',
  // Exact live route (requested /extracts/operations/contractor-payment does not exist).
  frmcontractorpayment: '/extracts/operations/extract-payment',
};

export const INPUT_CLASS_RE =
  /^(Ts?(DB)?(Edit|ComboBox|CheckBox|Memo|RadioButton|RadioGroup|MaskEdit|SpinEdit|DateEdit|LookupComboBox)|T(Edit|ComboBox|CheckBox|Memo|RadioButton|RadioGroup|MaskEdit|SpinEdit|DateTimePicker)|Tfram_(Date_ed|DateH_ed|DBLookup)|TArEn(DB)?Memo|TAdv(Edit|ComboBox)|TsDBLookupComboBox)$/i;

export const CHROME_CLASS_RE =
  /^(Ts?(Label|BitBtn|SpeedButton|Panel|GroupBox|Bevel|Shape|StatusBar|ScrollBox)|T(Label|Button|BitBtn|SpeedButton|Panel|GroupBox|Bevel|Shape|Image)|TAdvGlowButton|Tpp\w+|Tra\w+|TStringField|TWideStringField|TFloatField|TIntegerField|TDateField|TBooleanField|TFMTBCDField|TDataSource|TUniQuery|TQuery)$/i;

export const DATASET_FIELD_CLASS_RE =
  /^(T(String|WideString|Float|Integer|Date|Boolean|Currency|Blob|Memo|Largeint)|TFMTBCD)Field$/i;

export function walkControls(node, out = [], tab = null) {
  if (!node || typeof node !== 'object') return out;
  const cls = node.class || '';
  const nextTab =
    /TabSheet/i.test(cls) || cls === 'TsTabSheet' || cls === 'TTabSheet'
      ? node.caption || node.hint || node.name || tab
      : tab;
  out.push({ ...node, tab: nextTab });
  for (const child of node.children || []) walkControls(child, out, nextTab);
  return out;
}

export function parseLangLabelCaptions(filePath) {
  const text = decodeUtf16Le(filePath);
  const byForm = new Map();
  for (const raw of text.split(/\r\n|\r|\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const parts = splitCsvLine(line);
    if (parts.length < 5) continue;
    const [formName, controlName, controlType, ar, en, idx] = parts;
    if (!formName || !controlName) continue;
    const formKey = formName.toLowerCase();
    if (!byForm.has(formKey)) byForm.set(formKey, new Map());
    const controls = byForm.get(formKey);
    const existing = controls.get(controlName.toLowerCase()) || {
      controlName,
      controlType,
      labels: [],
    };
    existing.labels.push({
      ar: ar || '',
      en: en || '',
      idx: idx === undefined || idx === '' ? null : Number(idx),
    });
    controls.set(controlName.toLowerCase(), existing);
  }
  return byForm;
}

export function parseLangFormTitles(filePath) {
  const text = decodeUtf16Le(filePath);
  const byForm = new Map();
  for (const raw of text.split(/\r\n|\r|\n/)) {
    const line = raw.replace(/^\ufeff/, '').trim();
    if (!line) continue;
    const parts = splitCsvLine(line);
    if (parts.length < 2) continue;
    const formName = parts[0];
    byForm.set(formName.toLowerCase(), {
      formName,
      titleAr: parts[1] || '',
      titleEn: parts[2] || '',
    });
  }
  return byForm;
}

export function parseLangMessages(filePath) {
  const text = decodeUtf16Le(filePath);
  const byCode = new Map();
  for (const raw of text.split(/\r\n|\r|\n/)) {
    const line = raw.replace(/^\ufeff/, '').trim();
    if (!line) continue;
    const parts = splitCsvLine(line);
    const code = Number(parts[0]);
    if (!Number.isFinite(code)) continue;
    const ar = [parts[1], parts[2]].filter(Boolean).join(' ').trim();
    const en = [parts[3], parts[4]].filter(Boolean).join(' ').trim();
    byCode.set(code, { code, ar, en });
  }
  return byCode;
}

export function flattenMenu(menuTree) {
  const out = [];
  function walk(item, pathAr, pathEn) {
    const nextAr = [...pathAr, item.hintAr || item.captionEn || item.menuItemName].filter(Boolean);
    const nextEn = [...pathEn, item.captionEn || item.menuItemName].filter(Boolean);
    out.push({
      menuItemName: item.menuItemName,
      hintAr: item.hintAr || '',
      captionEn: item.captionEn || '',
      onClickHandler: item.onClickHandler || null,
      pathAr: nextAr,
      pathEn: nextEn,
    });
    for (const child of item.children || []) walk(child, nextAr, nextEn);
  }
  for (const main of menuTree?.mainMenus || []) {
    for (const item of main.items || []) walk(item, [], []);
  }
  return out;
}

export function extractProcedureBodies(pasText) {
  const lines = pasText.split(/\r\n|\r|\n/);
  const METHOD_DECL_RE = /^\s*(procedure|function)\s+(\w+)\.(\w+)/i;
  const ANY_DECL_RE = /^\s*(procedure|function)\s+(\w+)/i;
  const bodies = new Map();
  const starts = [];
  for (let i = 0; i < lines.length; i++) {
    const methodMatch = lines[i].match(METHOD_DECL_RE);
    if (methodMatch) {
      starts.push({ line: i, methodName: methodMatch[3], className: methodMatch[2] });
      continue;
    }
    if (ANY_DECL_RE.test(lines[i])) starts.push({ line: i, methodName: null, className: null });
  }
  for (let i = 0; i < starts.length; i++) {
    if (!starts[i].methodName) continue;
    const start = starts[i].line;
    const end = i + 1 < starts.length ? starts[i + 1].line : lines.length;
    const key = starts[i].methodName.toLowerCase();
    bodies.set(key, {
      name: starts[i].methodName,
      className: starts[i].className,
      line: start + 1,
      body: lines.slice(start, end).join('\n'),
    });
  }
  return bodies;
}

export function findSaveHandlers(bodies) {
  const out = [];
  for (const [key, rec] of bodies) {
    if (/(save|post).*(click)|^(save|post)btnclick$|savebtnclick/i.test(key)) {
      out.push(rec);
    }
  }
  return out;
}

export function collectCalledMethods(body, bodies) {
  const called = [];
  const seen = new Set();
  for (const [key, rec] of bodies) {
    if (key === body.name?.toLowerCase()) continue;
    const re = new RegExp(`\\b${rec.name}\\b`, 'i');
    if (re.test(body.body) && !seen.has(key)) {
      seen.add(key);
      called.push(rec);
    }
  }
  return called;
}

export function extractSqlTables(text) {
  const tables = new Map();
  const re = /(?:insert\s+into|update|delete\s+from)\s+([A-Za-z_][A-Za-z0-9_]*)/gi;
  for (const m of text.matchAll(re)) {
    const name = m[1];
    const op = m[0].toLowerCase().startsWith('insert')
      ? 'insert'
      : m[0].toLowerCase().startsWith('update')
        ? 'update'
        : 'delete';
    const rec = tables.get(name.toLowerCase()) || { table: name, ops: new Set() };
    rec.ops.add(op);
    tables.set(name.toLowerCase(), rec);
  }
  return [...tables.values()].map((t) => ({ table: t.table, ops: [...t.ops] }));
}

export function extractStoredProcs(text) {
  const names = new Set();
  for (const m of text.matchAll(/StoredProcName\s*:=\s*'([^']+)'/gi)) names.add(m[1]);
  return [...names];
}

export function detectSaveFlags(text) {
  return {
    autoGl: /GLTrxHeader|GLTrxDetail|Create_GL\b|CreateGlNum/i.test(text),
    stockCost: /ItemCost|ItemDetail|AdjustItemsCost|GetItemCost/i.test(text),
    treasury: /CashTrxHeader|CashTrxDetail/i.test(text),
    tax: /Dariba/i.test(text),
    alarms: /\bAlarms\b|PrepareAlarms/i.test(text),
    autoPost: /AutoPost|dxButton1Click/i.test(text),
    autoPrint: /AutoPrint/i.test(text),
    saveTrace: /Save_Trace/i.test(text),
    needsDbAccess: /StoredProcName\s*:=/i.test(text),
  };
}

export function extractShowLangCodes(text) {
  const codes = new Set();
  for (const m of text.matchAll(/ShowLangMessage\s*\(\s*(\d+)/gi)) codes.add(Number(m[1]));
  return [...codes];
}

export function safeFileSlug(name) {
  return String(name || 'unknown')
    .replace(/[^\w.-]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'unknown';
}

export function dfmJsonPath(parityDir, dfmFile) {
  if (!dfmFile) return null;
  const base = path.basename(dfmFile, '.dfm');
  const dir = path.dirname(dfmFile).replace(/\\/g, '/');
  const candidates = [];
  if (dir && dir !== '.') {
    candidates.push(path.join(parityDir, 'dfm', `${dir.replace(/\//g, '__')}__${base}.json`));
  }
  candidates.push(path.join(parityDir, 'dfm', `${base}.json`));
  return candidates.find((p) => fs.existsSync(p)) || null;
}

export function moduleFromRoute(route) {
  if (!route) return 'unmapped';
  const first = route.replace(/^\//, '').split('/')[0] || 'unmapped';
  return first;
}
