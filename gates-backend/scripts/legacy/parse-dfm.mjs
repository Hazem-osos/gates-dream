#!/usr/bin/env node
/**
 * parse-dfm.mjs — Delphi parity matrix, Phase 0.
 *
 * Mechanically parses every `.dfm` form/datamodule under `MainProgram/` into
 * a compact JSON control tree, capturing exactly what the parity matrix
 * needs and nothing else (full property dumps would be gigabytes and mostly
 * noise — cosmetic Font/Color/Left/Top properties are dropped on purpose):
 *
 *   - control tree (name, class, parent/child nesting)
 *   - Caption / Hint (the latter is almost always the Arabic label — legacy
 *     UI convention puts the Arabic hint on the English-captioned control)
 *   - DataField / DataSource bindings
 *   - TUniQuery (and other *Query classes) SQL.Strings + their field defs
 *     (TStringField/TWideStringField/... children: FieldName, DisplayLabel,
 *     Size, Origin, DisplayWidth)
 *   - TDataSource -> DataSet linkage
 *   - Grid ColumnHeaders.Strings (TAdvStringGrid and friends)
 *   - TPageControl / TTabSheet structure
 *
 * Usage:
 *   node scripts/legacy/parse-dfm.mjs [--src <MainProgram dir>] [--out <docs/parity/dfm dir>] [--limit N]
 *
 * Output:
 *   docs/parity/dfm/<UnitName>.json   — one curated tree per form
 *   docs/parity/dfm-index.json        — summary/stats across all forms (fed to build-parity-matrix.mjs)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../../');

function parseArgs(argv) {
  const out = { src: null, out: null, limit: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--src') out.src = argv[++i];
    else if (argv[i] === '--out') out.out = argv[++i];
    else if (argv[i] === '--limit') out.limit = Number(argv[++i]);
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const SRC_DIR = path.resolve(args.src || path.join(REPO_ROOT, 'MainProgram'));
const OUT_DIR = path.resolve(args.out || path.join(REPO_ROOT, 'docs/parity/dfm'));
const INDEX_PATH = path.join(path.dirname(OUT_DIR), 'dfm-index.json');

// ---------------------------------------------------------------------------
// Pascal literal decoding: `'text'` (with '' -> ' escape) and `#NNN` char
// codes, freely concatenated with whitespace/`+`/newlines between tokens
// (which carry no meaning and are stripped).
// ---------------------------------------------------------------------------
const TOKEN_RE = /'((?:[^']|'')*)'|#(\d+)/g;

function decodePascalLiteral(raw) {
  let result = '';
  let matched = false;
  for (const m of raw.matchAll(TOKEN_RE)) {
    matched = true;
    if (m[1] !== undefined) {
      result += m[1].replace(/''/g, "'");
    } else if (m[2] !== undefined) {
      result += String.fromCharCode(Number(m[2]));
    }
  }
  return matched ? result : null;
}

/**
 * Incrementally folds one line's delta into a running balance-tracker (avoids
 * O(n^2) rescans on huge multi-line values). Once inside a `{...}` binary
 * blob (Picture.Data / Glyph.Data hex streams — can be tens of thousands of
 * lines for embedded icons) we stop scanning line content entirely and only
 * look for the closing `}` at start-of-line, since hex digits can never be
 * confused with our other delimiters but scanning every character of a
 * multi-MB icon stream line-by-line is wasted work.
 */
function foldBalance(state, text) {
  if (state.inBlob) {
    if (text.trimEnd().endsWith('}')) state.inBlob = false;
    return;
  }
  let { paren, bracket, angle, inStr } = state;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === "'") {
      if (inStr && text[i + 1] === "'") {
        i++;
        continue;
      }
      inStr = !inStr;
      continue;
    }
    if (inStr) continue;
    if (c === '{') {
      state.paren = paren;
      state.bracket = bracket;
      state.angle = angle;
      state.inStr = inStr;
      // A blob only closes on its own `}` line; bail out of char-scanning now.
      state.inBlob = !text.trimEnd().endsWith('}');
      return;
    }
    if (c === '(') paren++;
    else if (c === ')') paren--;
    else if (c === '[') bracket++;
    else if (c === ']') bracket--;
    else if (c === '<') angle++;
    else if (c === '>') angle--;
  }
  state.paren = paren;
  state.bracket = bracket;
  state.angle = angle;
  state.inStr = inStr;
}

function balanceIsClosed(state) {
  return state.paren <= 0 && state.bracket <= 0 && state.angle <= 0 && !state.inStr && !state.inBlob;
}

function endsWithContinuation(text) {
  const t = text.trimEnd();
  return t.endsWith('+');
}

/**
 * Reads a (possibly multi-line) property value starting at `lines[startIdx]`
 * (the remainder of the `Key = ...` line). Returns { raw, nextIdx }.
 * Uses an incremental balance tracker so huge multi-hundred-line SQL blocks
 * (common in the biggest legacy forms) stay O(n) instead of O(n^2).
 */
// Some grids are configured with RowCount = 100000 and dump one RowHeights/
// ColWidths list entry per line, so this needs real headroom — it's a
// defensive circuit-breaker against genuinely malformed input, not a
// practical limit.
const MAX_CONTINUATION_LINES = 500000;
function readValueLines(firstChunk, lines, startIdx) {
  const state = { paren: 0, bracket: 0, angle: 0, inStr: false, inBlob: false };
  foldBalance(state, firstChunk);
  const parts = [firstChunk];
  let idx = startIdx;
  let guard = 0;
  // `Key =` with the actual value starting entirely on the next line is legal
  // (seen for long Template.FileName / OnGetText script blobs) — a blank
  // first chunk must not look "already balanced and done" and terminate the
  // read before any real content was consumed.
  let hasContent = firstChunk.trim() !== '';
  while (
    (!balanceIsClosed(state) || endsWithContinuation(parts[parts.length - 1]) || !hasContent) &&
    idx < lines.length &&
    guard < MAX_CONTINUATION_LINES
  ) {
    const next = lines[idx];
    foldBalance(state, next);
    parts.push(next);
    if (next.trim() !== '') hasContent = true;
    idx++;
    guard++;
  }
  return { raw: parts.join('\n'), nextIdx: idx };
}

/** Splits the inner text of a `(...)` TStrings-style list into logical elements (grouped by trailing `+`). */
function splitListElements(inner) {
  const rawLines = inner.split('\n');
  const elements = [];
  let current = [];
  for (const line of rawLines) {
    const trimmed = line.trim();
    if (trimmed === '') continue;
    current.push(trimmed);
    if (!trimmed.endsWith('+')) {
      elements.push(current.join(' '));
      current = [];
    }
  }
  if (current.length) elements.push(current.join(' '));
  return elements;
}

function classifyAndDecodeValue(raw) {
  const trimmed = raw.trim();
  if (trimmed.startsWith('{')) {
    // Binary blob (Picture.Data / Glyph.Data hex stream) — never curated, but
    // handled defensively in case a whitelisted key ever carries one.
    return { kind: 'binary-blob', value: `[${raw.length} raw chars omitted]` };
  }
  if (trimmed.startsWith('(')) {
    const inner = trimmed.slice(1, trimmed.length - (trimmed.endsWith(')') ? 1 : 0));
    const elements = splitListElements(inner);
    const decoded = elements.map((el) => decodePascalLiteral(el) ?? el.trim());
    return { kind: 'list', value: decoded };
  }
  if (trimmed.startsWith('[')) {
    const inner = trimmed.slice(1, trimmed.length - (trimmed.endsWith(']') ? 1 : 0));
    const items = inner
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    return { kind: 'set', value: items };
  }
  if (trimmed.startsWith('<')) {
    // Collection editor sub-items (e.g. Panels = <item ... end>). We don't need
    // deep parsing here — capture only whether it's empty or not.
    return { kind: 'collection-raw', value: trimmed === '<>' ? [] : ['[collection omitted]'] };
  }
  const decoded = decodePascalLiteral(trimmed);
  if (decoded !== null) return { kind: 'string', value: decoded };
  return { kind: 'scalar', value: trimmed };
}

// ---------------------------------------------------------------------------
// Curated property whitelist per node — everything else (Left/Top/Color/Font/
// Anchors/...) is intentionally dropped to keep output size sane.
// ---------------------------------------------------------------------------
const CURATED_KEYS = new Set([
  'Caption',
  'Hint',
  'DataField',
  'DataSource',
  'DataSet',
  'Connection',
  'SQL.Strings',
  'CommandText.Strings',
  'ColumnHeaders.Strings',
  'FieldName',
  'DisplayLabel',
  'Size',
  'Origin',
  'DisplayWidth',
  'Calculated',
  'ReadOnly',
  'TabCaption',
  'ActivePage',
  'OnClick',
  'OnCreate',
  'OnShow',
]);

const FIELD_CLASS_RE = /Field$/;
const QUERY_CLASS_RE = /Query$/;
const GRID_CLASS_RE = /Grid$/;
const TABSHEET_CLASS_RE = /^TTabSheet$/;
const PAGECONTROL_CLASS_RE = /^T(Adv)?PageControl$/;

function parseDfmText(text, fileName) {
  // Normalize line endings; keep as array for indexed access.
  const lines = text.split(/\r\n|\r|\n/);

  const root = { name: null, class: null, children: [] };
  const stack = [root];
  let i = 0;
  let objectCount = 0;
  const errors = [];

  // `inherited Foo: TBar [3]` — frame-inherited controls carry a bracketed
  // original tab-order index suffix that plain `object` declarations never have.
  const OBJECT_RE = /^\s*(object|inherited|inline)\s+(\S+?)\s*:\s*(\S+?)\s*(?:\[\d+\])?\s*$/;
  const OBJECT_NOCLASS_RE = /^\s*(object|inherited|inline)\s+(\S+)\s*$/;
  const END_RE = /^\s*end\s*$/;
  const PROP_RE = /^\s*([A-Za-z_][\w.]*)\s*=\s*(.*)$/;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed === '') {
      i++;
      continue;
    }

    const objMatch = trimmed.match(OBJECT_RE) || trimmed.match(OBJECT_NOCLASS_RE);
    if (objMatch) {
      const node = {
        name: objMatch[2],
        class: objMatch[3] || 'Unknown',
        props: {},
        children: [],
      };
      objectCount++;
      stack[stack.length - 1].children.push(node);
      stack.push(node);
      i++;
      continue;
    }

    if (END_RE.test(trimmed)) {
      if (stack.length > 1) stack.pop();
      i++;
      continue;
    }

    const propMatch = trimmed.match(PROP_RE);
    if (propMatch) {
      const key = propMatch[1];
      const { raw, nextIdx } = readValueLines(propMatch[2], lines, i + 1);
      i = nextIdx;
      if (CURATED_KEYS.has(key)) {
        const { value } = classifyAndDecodeValue(raw);
        stack[stack.length - 1].props[key] = value;
      }
      continue;
    }

    // Stray/unrecognized line inside a value we didn't classify as continuation
    // (defensive — should be rare given the continuation reader above).
    errors.push({ line: i + 1, text: trimmed.slice(0, 120) });
    i++;
  }

  return { root, objectCount, unclosedDepth: stack.length - 1, errors };
}

function buildCuratedNode(rawNode) {
  const children = rawNode.children.map(buildCuratedNode);
  const node = {
    name: rawNode.name,
    class: rawNode.class,
  };
  const p = rawNode.props;
  if (p.Caption !== undefined) node.caption = p.Caption;
  if (p.Hint !== undefined) node.hint = p.Hint;
  if (p.DataField !== undefined) node.dataField = p.DataField;
  if (p.DataSource !== undefined) node.dataSource = p.DataSource;
  if (p.DataSet !== undefined) node.dataSet = p.DataSet;
  if (p.Connection !== undefined) node.connection = p.Connection;
  if (p.ActivePage !== undefined) node.activePage = p.ActivePage;
  if (p.OnClick !== undefined) node.onClick = p.OnClick;
  if (p.OnCreate !== undefined) node.onCreate = p.OnCreate;
  if (p.OnShow !== undefined) node.onShow = p.OnShow;

  const sql = p['SQL.Strings'] ?? p['CommandText.Strings'];
  if (sql !== undefined) node.sql = Array.isArray(sql) ? sql.join(' ') : String(sql);

  const headers = p['ColumnHeaders.Strings'];
  if (headers !== undefined) node.columnHeaders = headers;

  if (FIELD_CLASS_RE.test(rawNode.class)) {
    node.fieldDef = {
      fieldName: p.FieldName ?? null,
      displayLabel: p.DisplayLabel ?? null,
      size: p.Size ?? null,
      origin: p.Origin ?? null,
      displayWidth: p.DisplayWidth ?? null,
    };
  }

  if (children.length) node.children = children;
  return node;
}

/** Post-order walk collecting flat convenience lists used by the matrix builder. */
function collectSummaries(node, ctx) {
  if (QUERY_CLASS_RE.test(node.class) && node.sql) {
    ctx.queries.push({
      name: node.name,
      class: node.class,
      connection: node.connection ?? null,
      sql: node.sql,
      fields: (node.children ?? [])
        .filter((c) => c.fieldDef)
        .map((c) => ({ name: c.name, class: c.class, ...c.fieldDef })),
    });
  }
  if (node.class === 'TDataSource') {
    ctx.dataSources.push({ name: node.name, dataSet: node.dataSet ?? null });
  }
  if (GRID_CLASS_RE.test(node.class) && node.columnHeaders) {
    ctx.grids.push({ name: node.name, class: node.class, columnHeaders: node.columnHeaders });
  }
  if (PAGECONTROL_CLASS_RE.test(node.class)) {
    ctx.pageControls.push({
      name: node.name,
      activePage: node.activePage ?? null,
      tabs: (node.children ?? [])
        .filter((c) => TABSHEET_CLASS_RE.test(c.class))
        .map((c) => ({ name: c.name, caption: c.caption ?? null, hint: c.hint ?? null })),
    });
  }
  if (node.dataField || node.dataSource) {
    ctx.bindings.push({
      name: node.name,
      class: node.class,
      dataField: node.dataField ?? null,
      dataSource: node.dataSource ?? null,
    });
  }
  for (const child of node.children ?? []) collectSummaries(child, ctx);
}

function parseOneFile(fullPath, relPath) {
  const text = fs.readFileSync(fullPath, 'latin1');
  const { root, objectCount, unclosedDepth, errors } = parseDfmText(text, relPath);

  const formNode = root.children[0] ?? null;
  const curated = formNode ? buildCuratedNode(formNode) : null;

  const ctx = { queries: [], dataSources: [], grids: [], pageControls: [], bindings: [] };
  if (curated) collectSummaries(curated, ctx);

  const result = {
    file: relPath,
    formName: formNode?.name ?? null,
    formClass: formNode?.class ?? null,
    controlTree: curated,
    queries: ctx.queries,
    dataSources: ctx.dataSources,
    grids: ctx.grids,
    pageControls: ctx.pageControls,
    dataBindings: ctx.bindings,
    stats: {
      objectCount,
      unclosedDepth,
      strayLineCount: errors.length,
    },
    strayLines: errors.slice(0, 20),
  };

  // Confidence: multi-tier per the plan's honesty requirement (screen ~95%,
  // fields ~85-90%, grid columns ~40-50%).
  let confidence = 'high';
  if (unclosedDepth !== 0 || errors.length > 5) confidence = 'low';
  else if (errors.length > 0) confidence = 'medium';
  result.confidence = confidence;

  return result;
}

function main() {
  if (!fs.existsSync(SRC_DIR)) {
    console.error(`Source directory not found: ${SRC_DIR}`);
    process.exit(1);
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const dfmFiles = fs
    .readdirSync(SRC_DIR, { recursive: true })
    .filter((f) => typeof f === 'string' && f.toLowerCase().endsWith('.dfm'))
    .sort();

  const limited = args.limit ? dfmFiles.slice(0, args.limit) : dfmFiles;

  console.log(`Found ${dfmFiles.length} .dfm files under ${SRC_DIR}${args.limit ? ` (processing first ${limited.length})` : ''}`);

  const index = [];
  let ok = 0;
  let failed = 0;
  const startedAt = Date.now();

  for (const [fileIdx, relPath] of limited.entries()) {
    const fullPath = path.join(SRC_DIR, relPath);
    const t0 = Date.now();
    try {
      const result = parseOneFile(fullPath, relPath.replace(/\\/g, '/'));
      const dt = Date.now() - t0;
      if (dt > 800) console.log(`  [${fileIdx + 1}/${limited.length}] ${relPath} — ${dt}ms (${result.stats.objectCount} objects)`);
      else if ((fileIdx + 1) % 50 === 0) console.log(`  [${fileIdx + 1}/${limited.length}] ...`);
      const outName = relPath.replace(/\\/g, '/').replace(/\.dfm$/i, '.json').replace(/\//g, '__');
      const outPath = path.join(OUT_DIR, outName);
      fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
      index.push({
        file: result.file,
        outFile: path.relative(path.dirname(OUT_DIR), outPath).replace(/\\/g, '/'),
        formName: result.formName,
        formClass: result.formClass,
        confidence: result.confidence,
        objectCount: result.stats.objectCount,
        queryCount: result.queries.length,
        gridCount: result.grids.length,
        columnGridCount: result.grids.filter((g) => g.columnHeaders?.length).length,
        pageControlCount: result.pageControls.length,
        bindingCount: result.dataBindings.length,
        strayLineCount: result.stats.strayLineCount,
      });
      ok++;
    } catch (err) {
      failed++;
      index.push({
        file: relPath.replace(/\\/g, '/'),
        outFile: null,
        formName: null,
        formClass: null,
        confidence: 'error',
        error: String(err && err.message ? err.message : err),
      });
      console.error(`  FAILED ${relPath}: ${err.message}`);
    }
  }

  fs.writeFileSync(
    INDEX_PATH,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        sourceDir: SRC_DIR,
        totalFiles: dfmFiles.length,
        processedFiles: limited.length,
        ok,
        failed,
        forms: index,
      },
      null,
      2
    )
  );

  const elapsedS = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(`Done in ${elapsedS}s — ok=${ok} failed=${failed}`);
  console.log(`Index: ${INDEX_PATH}`);
  console.log(`Per-form JSON: ${OUT_DIR}`);
}

main();
