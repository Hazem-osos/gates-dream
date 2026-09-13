#!/usr/bin/env node
/**
 * scan-pas.mjs — Delphi parity matrix, Phase 0.
 *
 * Mechanically scans every `.pas` unit (692 files) for the signals the
 * parity matrix needs, without attempting a real Pascal parse:
 *
 *   - tables referenced via `Insert Into` / `From` / `Update ... Set` /
 *     `Delete From`, extracted from the unit's *string literals* (SQL is
 *     always built as Pascal string constants here, so this is where the
 *     real SQL lives — not in the surrounding code).
 *   - `general_functions.*` call sites (the shared business-logic helper
 *     library almost every screen depends on).
 *   - message codes: `FillFixedText(n)` / `ShowLangMessage(n)`.
 *   - `.rtm` ReportBuilder template references.
 *   - procedure/function declarations, split into event handlers
 *     (`TFrmX.Button1Click`, `FormCreate`, `...Click/Change/Exit/...`) vs
 *     plain business-logic routines.
 *
 * A single character-level tokenizer pass per file both (a) extracts every
 * string literal and (b) produces a "codeOnly" version of the source with
 * comments and string bodies blanked out (newlines preserved, so line
 * numbers stay accurate) for safe keyword/identifier regex scanning that
 * can't accidentally match inside a comment or a string.
 *
 * Usage:
 *   node scripts/legacy/scan-pas.mjs [--src <MainProgram dir>] [--out <docs/parity/pas dir>] [--schema <docs/parity/legacy-database-schema.json>] [--limit N]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../../');

function parseArgs(argv) {
  const out = { src: null, out: null, schema: null, limit: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--src') out.src = argv[++i];
    else if (argv[i] === '--out') out.out = argv[++i];
    else if (argv[i] === '--schema') out.schema = argv[++i];
    else if (argv[i] === '--limit') out.limit = Number(argv[++i]);
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const SRC_DIR = path.resolve(args.src || path.join(REPO_ROOT, 'MainProgram'));
const OUT_DIR = path.resolve(args.out || path.join(REPO_ROOT, 'docs/parity/pas'));
const SCHEMA_PATH = path.resolve(args.schema || path.join(REPO_ROOT, 'docs/parity/legacy-database-schema.json'));
const INDEX_PATH = path.join(path.dirname(OUT_DIR), 'pas-index.json');

// ---------------------------------------------------------------------------
// Tokenizer: single O(n) pass distinguishing string / `{...}` comment /
// `(*...*)` comment / `//` comment / code, so every downstream regex only
// ever sees what it's actually looking for.
// ---------------------------------------------------------------------------
function tokenize(text) {
  const literals = [];
  const codeOnlyChars = new Array(text.length);
  let mode = 'code'; // code | string | brace | paren-star | line
  let literalBuf = '';
  let literalStartLine = 1;
  let line = 1;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const isNewline = c === '\n';

    if (mode === 'code') {
      if (c === "'") {
        mode = 'string';
        literalBuf = '';
        literalStartLine = line;
        codeOnlyChars[i] = ' ';
      } else if (c === '{') {
        mode = 'brace';
        codeOnlyChars[i] = ' ';
      } else if (c === '(' && text[i + 1] === '*') {
        mode = 'paren-star';
        codeOnlyChars[i] = ' ';
        codeOnlyChars[i + 1] = ' ';
        i++;
      } else if (c === '/' && text[i + 1] === '/') {
        mode = 'line';
        codeOnlyChars[i] = ' ';
        codeOnlyChars[i + 1] = ' ';
        i++;
      } else {
        codeOnlyChars[i] = c;
      }
    } else if (mode === 'string') {
      if (c === "'") {
        if (text[i + 1] === "'") {
          literalBuf += "'";
          codeOnlyChars[i] = ' ';
          codeOnlyChars[i + 1] = ' ';
          i++;
        } else {
          mode = 'code';
          literals.push({ text: literalBuf, line: literalStartLine });
          codeOnlyChars[i] = ' ';
        }
      } else {
        literalBuf += c;
        codeOnlyChars[i] = isNewline ? '\n' : ' ';
      }
    } else if (mode === 'line') {
      codeOnlyChars[i] = isNewline ? '\n' : ' ';
      if (isNewline) mode = 'code';
    } else if (mode === 'brace') {
      if (c === '}') {
        mode = 'code';
        codeOnlyChars[i] = ' ';
      } else {
        codeOnlyChars[i] = isNewline ? '\n' : ' ';
      }
    } else if (mode === 'paren-star') {
      if (c === '*' && text[i + 1] === ')') {
        mode = 'code';
        codeOnlyChars[i] = ' ';
        codeOnlyChars[i + 1] = ' ';
        i++;
      } else {
        codeOnlyChars[i] = isNewline ? '\n' : ' ';
      }
    }

    if (isNewline) line++;
  }
  if (mode === 'string') literals.push({ text: literalBuf, line: literalStartLine });

  return { literals, codeOnly: codeOnlyChars.join('') };
}

// ---------------------------------------------------------------------------
// Table references, mined from the concatenated string-literal corpus.
// ---------------------------------------------------------------------------
const TABLE_PATTERNS = [
  { op: 'insert', re: /\bInsert\s+Into\s+(?:dbo\.)?([A-Za-z_]\w*)/gi },
  { op: 'update', re: /\bUpdate\s+(?:dbo\.)?([A-Za-z_]\w*)\s+Set\b/gi },
  { op: 'delete', re: /\bDelete\s+From\s+(?:dbo\.)?([A-Za-z_]\w*)/gi },
  { op: 'select', re: /\bFrom\s+(?:dbo\.)?([A-Za-z_]\w*)/gi },
  { op: 'join', re: /\bJoin\s+(?:dbo\.)?([A-Za-z_]\w*)/gi },
];

const SQL_KEYWORD_BLOCKLIST = new Set([
  'select',
  'where',
  'dbo',
  'top',
  'distinct',
  'as',
  'set',
  'values',
  'order',
  'group',
]);

function extractTableReferences(sqlCorpus) {
  const byTable = new Map();
  for (const { op, re } of TABLE_PATTERNS) {
    for (const m of sqlCorpus.matchAll(re)) {
      const name = m[1];
      if (SQL_KEYWORD_BLOCKLIST.has(name.toLowerCase())) continue;
      const entry = byTable.get(name) ?? { table: name, ops: new Set() };
      entry.ops.add(op === 'select' || op === 'join' ? 'select' : op);
      byTable.set(name, entry);
    }
  }
  return [...byTable.values()]
    .map((e) => ({ table: e.table, ops: [...e.ops].sort() }))
    .sort((a, b) => a.table.localeCompare(b.table));
}

// ---------------------------------------------------------------------------
// general_functions.* call sites, message codes, .rtm templates — all safe
// to scan on codeOnly (call sites) or the literal corpus (.rtm paths).
// ---------------------------------------------------------------------------
function extractGeneralFunctionCalls(codeOnly) {
  const re = /\bgeneral_functions\.(\w+)/gi;
  const byName = new Map();
  for (const m of codeOnly.matchAll(re)) {
    const name = m[1];
    byName.set(name, (byName.get(name) ?? 0) + 1);
  }
  return [...byName.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

function extractMessageCodes(codeOnly) {
  const re = /\b(FillFixedText|ShowLangMessage)\s*\(\s*(\d+)/gi;
  const out = { FillFixedText: new Set(), ShowLangMessage: new Set() };
  for (const m of codeOnly.matchAll(re)) {
    const key = m[1][0].toUpperCase() === 'F' ? 'FillFixedText' : 'ShowLangMessage';
    out[key].add(Number(m[2]));
  }
  return {
    FillFixedText: [...out.FillFixedText].sort((a, b) => a - b),
    ShowLangMessage: [...out.ShowLangMessage].sort((a, b) => a - b),
  };
}

function extractReportTemplates(literals) {
  const re = /([\w\-]+\.rtm)/gi;
  const names = new Set();
  for (const lit of literals) {
    for (const m of lit.text.matchAll(re)) {
      names.add(m[1].split(/[\\/]/).pop());
    }
  }
  return [...names].sort();
}

// ---------------------------------------------------------------------------
// Procedure/function declarations, classified as event handler vs business
// logic by name convention (Delphi has no explicit marker — this is a
// heuristic, not a semantic analysis).
// ---------------------------------------------------------------------------
const EVENT_HANDLER_NAME_RE =
  /(?:^Form|^N\d+|Click$|DblClick$|Change$|Changing$|Enter$|Exit$|^Create$|Create$|Destroy$|Show$|^Close$|Close$|CloseQuery$|KeyPress$|KeyDown$|KeyUp$|MouseDown$|MouseUp$|MouseMove$|GetText$|SetText$|DrawCell$|Paint$|Timer$|Scroll$|Resize$|Activate$|Deactivate$|Select$|Selected$|ButtonClick$|CellClick$|CellDblClick$|BeforePost$|AfterPost$|BeforeInsert$|AfterInsert$|BeforeDelete$|AfterDelete$|BeforeOpen$|AfterOpen$|Validate$|Drop$|StartDock$|EndDock$|Collapse$|Expand$|Checked$|CellButtonClick$)/i;

function extractProcedures(codeOnly) {
  const lines = codeOnly.split('\n');
  const DECL_RE = /^\s*(procedure|function)\s+([\w.]+)/i;
  const procs = [];
  for (let idx = 0; idx < lines.length; idx++) {
    const m = lines[idx].match(DECL_RE);
    if (!m) continue;
    const kind = m[1].toLowerCase();
    const fullName = m[2];
    const dotIdx = fullName.lastIndexOf('.');
    const isMethod = dotIdx !== -1;
    const className = isMethod ? fullName.slice(0, dotIdx) : null;
    const methodName = isMethod ? fullName.slice(dotIdx + 1) : fullName;
    const category = EVENT_HANDLER_NAME_RE.test(methodName) ? 'event-handler' : 'business-logic';
    procs.push({
      line: idx + 1,
      kind,
      fullName,
      className,
      methodName,
      category,
    });
  }
  return procs;
}

function loadKnownTables() {
  if (!fs.existsSync(SCHEMA_PATH)) return new Set();
  try {
    const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8'));
    return new Set((schema.tables ?? []).map((t) => t.tableName.toLowerCase()));
  } catch {
    return new Set();
  }
}

function scanOneFile(fullPath, relPath, knownTables) {
  const text = fs.readFileSync(fullPath, 'latin1');
  const { literals, codeOnly } = tokenize(text);
  const sqlCorpus = literals.map((l) => l.text).join(' \n ');

  const tables = extractTableReferences(sqlCorpus).map((t) => ({
    ...t,
    known: knownTables.has(t.table.toLowerCase()),
  }));
  const generalFunctionCalls = extractGeneralFunctionCalls(codeOnly);
  const messageCodes = extractMessageCodes(codeOnly);
  const reportTemplates = extractReportTemplates(literals);
  const procedures = extractProcedures(codeOnly);

  const eventHandlerCount = procedures.filter((p) => p.category === 'event-handler').length;
  const businessLogicCount = procedures.length - eventHandlerCount;

  return {
    file: relPath,
    unitName: path.basename(relPath, path.extname(relPath)),
    tables,
    generalFunctionCalls,
    messageCodes,
    reportTemplates,
    procedures,
    stats: {
      totalLines: text.split(/\r\n|\r|\n/).length,
      literalCount: literals.length,
      tableCount: tables.length,
      knownTableCount: tables.filter((t) => t.known).length,
      unknownTableCount: tables.filter((t) => !t.known).length,
      generalFunctionCallSiteCount: generalFunctionCalls.reduce((s, f) => s + f.count, 0),
      distinctGeneralFunctionCount: generalFunctionCalls.length,
      reportTemplateCount: reportTemplates.length,
      procedureCount: procedures.length,
      eventHandlerCount,
      businessLogicCount,
    },
  };
}

function main() {
  if (!fs.existsSync(SRC_DIR)) {
    console.error(`Source directory not found: ${SRC_DIR}`);
    process.exit(1);
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const knownTables = loadKnownTables();
  if (knownTables.size === 0) {
    console.warn(`Warning: no known-table cross-reference loaded from ${SCHEMA_PATH} — run parse-database-ini.mjs first for higher-precision output.`);
  }

  const pasFiles = fs
    .readdirSync(SRC_DIR, { recursive: true })
    .filter((f) => typeof f === 'string' && f.toLowerCase().endsWith('.pas'))
    .sort();

  const limited = args.limit ? pasFiles.slice(0, args.limit) : pasFiles;
  console.log(`Found ${pasFiles.length} .pas files under ${SRC_DIR}${args.limit ? ` (processing first ${limited.length})` : ''}`);

  const index = [];
  let ok = 0;
  let failed = 0;
  const startedAt = Date.now();

  for (const [fileIdx, relPath] of limited.entries()) {
    const fullPath = path.join(SRC_DIR, relPath);
    const t0 = Date.now();
    try {
      const result = scanOneFile(fullPath, relPath.replace(/\\/g, '/'), knownTables);
      const dt = Date.now() - t0;
      if (dt > 800) console.log(`  [${fileIdx + 1}/${limited.length}] ${relPath} — ${dt}ms`);
      else if ((fileIdx + 1) % 100 === 0) console.log(`  [${fileIdx + 1}/${limited.length}] ...`);

      const outName = relPath.replace(/\\/g, '/').replace(/\.pas$/i, '.json').replace(/\//g, '__');
      const outPath = path.join(OUT_DIR, outName);
      fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
      index.push({
        file: result.file,
        outFile: path.relative(path.dirname(OUT_DIR), outPath).replace(/\\/g, '/'),
        unitName: result.unitName,
        ...result.stats,
      });
      ok++;
    } catch (err) {
      failed++;
      index.push({ file: relPath.replace(/\\/g, '/'), outFile: null, unitName: null, error: String(err?.message ?? err) });
      console.error(`  FAILED ${relPath}: ${err.message}`);
    }
  }

  fs.writeFileSync(
    INDEX_PATH,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        sourceDir: SRC_DIR,
        totalFiles: pasFiles.length,
        processedFiles: limited.length,
        ok,
        failed,
        units: index,
      },
      null,
      2
    )
  );

  const elapsedS = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(`Done in ${elapsedS}s — ok=${ok} failed=${failed}`);
  console.log(`Index: ${INDEX_PATH}`);
  console.log(`Per-unit JSON: ${OUT_DIR}`);
}

main();
