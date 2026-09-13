#!/usr/bin/env node
/**
 * build-parity-matrix.mjs — Delphi parity matrix, Phase 0 (final join step).
 *
 * Joins every artifact the earlier scripts produced with `Business.dpr`
 * (the authoritative compiled-unit registry — 692 `.pas` files exist on
 * disk, but only the ~650 actually `uses`d by Business.dpr are live; the
 * rest are dead/orphaned leftovers, which this script flags rather than
 * silently ignores) plus the target-side web inventory, and emits:
 *
 *   - docs/parity/legacy-parity-matrix.json — full structured join, one
 *     entry per legacy unit, plus orphan lists and menu-linkage results.
 *   - docs/parity/legacy-parity-matrix.csv  — flat one-row-per-unit sheet
 *     with `web_route` / `parity_status` / `notes` columns left BLANK for
 *     human review, per the plan.
 *   - docs/parity/review-queue.md — everything the mechanical join could
 *     not resolve with high confidence.
 *
 * Prerequisite: run parse-dfm.mjs, parse-database-ini.mjs,
 * parse-menu-tree.mjs, parse-translation-ini.mjs and scan-pas.mjs first.
 *
 * Usage:
 *   node scripts/legacy/build-parity-matrix.mjs [--src <MainProgram dir>] [--parity <docs/parity dir>] [--web <gates-web dir>] [--migration <docs/migration dir>]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../../');

function parseArgs(argv) {
  const out = { src: null, parity: null, web: null, migration: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--src') out.src = argv[++i];
    else if (argv[i] === '--parity') out.parity = argv[++i];
    else if (argv[i] === '--web') out.web = argv[++i];
    else if (argv[i] === '--migration') out.migration = argv[++i];
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const SRC_DIR = path.resolve(args.src || path.join(REPO_ROOT, 'MainProgram'));
const PARITY_DIR = path.resolve(args.parity || path.join(REPO_ROOT, 'docs/parity'));
const WEB_DIR = path.resolve(args.web || path.join(REPO_ROOT, 'gates-web'));
const MIGRATION_DIR = path.resolve(args.migration || path.join(REPO_ROOT, 'docs/migration'));

function readJson(p, fallback = null) {
  if (!fs.existsSync(p)) return fallback;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

// ---------------------------------------------------------------------------
// 1. Business.dpr — authoritative unit/form registry.
// ---------------------------------------------------------------------------
function parseBusinessDpr(dprPath) {
  const text = fs.readFileSync(dprPath, 'latin1');
  // `UnitName in 'Rel\Path.pas' {FormName[: TClassName]},` or no `{...}` at all.
  const RE = /(\w+)\s+in\s+'([^']+)'(?:\s*\{([^:}]+)(?::\s*([^}]+))?\})?\s*,/g;
  const units = [];
  for (const m of text.matchAll(RE)) {
    const [, unitName, relPathBackslash, formName, formClass] = m;
    units.push({
      unitName,
      relPath: relPathBackslash.replace(/\\/g, '/'),
      formName: formName ? formName.trim() : null,
      formClass: formClass ? formClass.trim() : null,
    });
  }
  return units;
}

// ---------------------------------------------------------------------------
// 2/3. Cross-reference pas-index.json / dfm-index.json by relative path.
// ---------------------------------------------------------------------------
function indexByRelPath(indexEntries, relPathKey) {
  const map = new Map();
  for (const entry of indexEntries) {
    map.set(entry[relPathKey].toLowerCase(), entry);
  }
  return map;
}

function loadPerUnitJson(outFile) {
  if (!outFile) return null;
  const full = path.join(PARITY_DIR, outFile);
  if (!fs.existsSync(full)) return null;
  return JSON.parse(fs.readFileSync(full, 'utf8'));
}

// ---------------------------------------------------------------------------
// 4. Menu -> form linkage: scan UntMain.pas for each event handler named by
// the menu tree, extract its body, and guess the target form class from
// `TFrmXxx` / `FrmXxx.ShowModal` / `Application.CreateForm(TFrmXxx, ...)`
// identifiers inside it. Best-effort — low-confidence results are flagged.
// ---------------------------------------------------------------------------
function extractProcedureBodies(pasText) {
  const lines = pasText.split(/\r\n|\r|\n/);
  // Track EVERY declaration (dotted method or standalone routine) as a body
  // boundary — otherwise a standalone helper procedure sandwiched between two
  // menu-click handlers gets silently absorbed into the preceding handler's
  // "body", contaminating its form-class guess with unrelated identifiers.
  const METHOD_DECL_RE = /^\s*(procedure|function)\s+(\w+)\.(\w+)/i;
  const ANY_DECL_RE = /^\s*(procedure|function)\s+(\w+)/i;
  const bodies = new Map(); // methodName -> body text
  const starts = []; // { line, methodName: string|null }
  for (let i = 0; i < lines.length; i++) {
    const methodMatch = lines[i].match(METHOD_DECL_RE);
    if (methodMatch) {
      starts.push({ line: i, methodName: methodMatch[3] });
      continue;
    }
    if (ANY_DECL_RE.test(lines[i])) starts.push({ line: i, methodName: null });
  }
  for (let i = 0; i < starts.length; i++) {
    if (!starts[i].methodName) continue;
    const start = starts[i].line;
    const end = i + 1 < starts.length ? starts[i + 1].line : lines.length;
    bodies.set(starts[i].methodName, lines.slice(start, end).join('\n'));
  }
  return bodies;
}

function resolveMenuFormLinks(untMainPasPath, menuTree, dprUnitsByFormClass) {
  if (!fs.existsSync(untMainPasPath) || !menuTree) return [];
  const text = fs.readFileSync(untMainPasPath, 'latin1');
  const bodies = extractProcedureBodies(text);

  // Delphi identifiers are case-insensitive and this codebase is inconsistent
  // about it (`TFrmMain` vs `TfrmYear`) — match loosely, key lookups by
  // lower-cased class name.
  const FORM_CLASS_RE = /\bT(frm\w+)\b/gi;
  const results = [];

  function walk(item) {
    if (item.onClickHandler) {
      const body = bodies.get(item.onClickHandler);
      let resolvedFormClass = null;
      let candidateCount = 0;
      if (body) {
        const counts = new Map();
        for (const m of body.matchAll(FORM_CLASS_RE)) {
          const cls = `T${m[1]}`;
          // The main form never navigates to itself — a menu handler
          // referencing TFrmMain is almost always an ambient self-reference,
          // not the screen it opens.
          if (cls.toLowerCase() === 'tfrmmain') continue;
          counts.set(cls, (counts.get(cls) ?? 0) + 1);
        }
        candidateCount = counts.size;
        if (counts.size > 0) {
          resolvedFormClass = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
        }
      }
      results.push({
        menuItemName: item.menuItemName,
        captionEn: item.captionEn,
        hintAr: item.hintAr,
        onClickHandler: item.onClickHandler,
        handlerFound: !!body,
        resolvedFormClass,
        resolvedUnit: resolvedFormClass ? dprUnitsByFormClass.get(resolvedFormClass.toLowerCase())?.unitName ?? null : null,
        candidateFormClassCount: candidateCount,
        confidence: !body ? 'no-handler' : !resolvedFormClass ? 'unresolved' : candidateCount === 1 ? 'high' : 'medium',
      });
    }
    for (const child of item.children ?? []) walk(child);
  }

  for (const mainMenu of menuTree.mainMenus ?? []) {
    for (const item of mainMenu.items) walk(item);
  }
  return results;
}

// ---------------------------------------------------------------------------
// 5. docs/migration/01-table-mapping.csv
// ---------------------------------------------------------------------------
function parseTableMappingCsv(csvPath) {
  const text = fs.readFileSync(csvPath, 'utf8');
  const lines = text.split(/\r\n|\r|\n/).filter(Boolean);
  const [header, ...rows] = lines;
  const cols = header.split(',');
  const byTable = new Map();
  for (const row of rows) {
    const fields = row.split(',');
    const rec = {};
    cols.forEach((c, i) => (rec[c] = fields[i] ?? ''));
    byTable.set(rec.legacy_table.toLowerCase(), rec);
  }
  return byTable;
}

// ---------------------------------------------------------------------------
// 6. gates-web routes (page.tsx files) + report inventory.
// ---------------------------------------------------------------------------
function listWebRoutes(webAppDir) {
  const pages = fs
    .readdirSync(webAppDir, { recursive: true })
    .filter((f) => typeof f === 'string' && /page\.(tsx|ts|jsx|js)$/.test(f));
  return pages
    .map((p) => {
      const normalized = p.replace(/\\/g, '/').replace(/\/page\.(tsx|ts|jsx|js)$/, '').replace(/page\.(tsx|ts|jsx|js)$/, '');
      return '/' + normalized;
    })
    .sort();
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function main() {
  console.log('Loading source artifacts...');
  const dprUnits = parseBusinessDpr(path.join(SRC_DIR, 'Business.dpr'));
  console.log(`  Business.dpr units: ${dprUnits.length}`);

  const dfmIndex = readJson(path.join(PARITY_DIR, 'dfm-index.json'), { forms: [] });
  const pasIndexData = readJson(path.join(PARITY_DIR, 'pas-index.json'), { units: [] });
  const menuTree = readJson(path.join(PARITY_DIR, 'menu-tree.json'));
  const translations = readJson(path.join(PARITY_DIR, 'legacy-translations.json'));
  const dbSchema = readJson(path.join(PARITY_DIR, 'legacy-database-schema.json'));
  const tableMappingCsvPath = path.join(MIGRATION_DIR, '01-table-mapping.csv');
  const tableMapping = fs.existsSync(tableMappingCsvPath) ? parseTableMappingCsv(tableMappingCsvPath) : new Map();
  const reportInventory = readJson(path.join(WEB_DIR, 'lib/reports/report-inventory.json'), { entries: [] });
  const webRoutes = fs.existsSync(path.join(WEB_DIR, 'app')) ? listWebRoutes(path.join(WEB_DIR, 'app')) : [];

  console.log(`  dfm forms indexed: ${dfmIndex.forms?.length ?? 0}`);
  console.log(`  pas units indexed: ${pasIndexData.units?.length ?? 0}`);
  console.log(`  menu items: ${menuTree?.stats?.totalMenuItems ?? 0}`);
  console.log(`  translation forms: ${Object.keys(translations?.forms ?? {}).length}`);
  console.log(`  legacy tables (DataBase.ini): ${dbSchema?.tables?.length ?? 0}`);
  console.log(`  table-mapping.csv rows: ${tableMapping.size}`);
  console.log(`  gates-web report inventory entries: ${reportInventory.entries?.length ?? 0}`);
  console.log(`  gates-web page routes: ${webRoutes.length}`);

  const pasByRelPath = indexByRelPath(pasIndexData.units ?? [], 'file');
  const dfmByRelPath = indexByRelPath(dfmIndex.forms ?? [], 'file');

  // Delphi identifiers are case-insensitive — key by lower-cased class name.
  const dprUnitsByFormClass = new Map();
  for (const u of dprUnits) if (u.formClass) dprUnitsByFormClass.set(u.formClass.toLowerCase(), u);
  // Also index bare formName (no explicit class annotation in dpr — the class
  // is then implicitly `T<FormName>`).
  for (const u of dprUnits) {
    if (u.formName && !u.formClass) dprUnitsByFormClass.set(`T${u.formName}`.toLowerCase(), u);
  }

  console.log('Resolving menu -> form links via UntMain.pas...');
  const menuLinks = resolveMenuFormLinks(path.join(SRC_DIR, 'UntMain.pas'), menuTree, dprUnitsByFormClass);
  const menuLinksByUnit = new Map();
  for (const link of menuLinks) {
    if (link.resolvedUnit) {
      const arr = menuLinksByUnit.get(link.resolvedUnit) ?? [];
      arr.push(link);
      menuLinksByUnit.set(link.resolvedUnit, arr);
    }
  }
  console.log(
    `  menu items with resolved form: ${menuLinks.filter((l) => l.resolvedFormClass).length}/${menuLinks.length} (high confidence: ${
      menuLinks.filter((l) => l.confidence === 'high').length
    })`
  );

  console.log('Joining rows...');
  const rows = [];
  const derivedFormNameRelPathSeen = new Set();

  for (const dprUnit of dprUnits) {
    const relPathLower = dprUnit.relPath.toLowerCase();
    const pasSummary = pasByRelPath.get(relPathLower) ?? null;
    const dfmRelPath = dprUnit.relPath.replace(/\.pas$/i, '.dfm');
    const dfmSummary = dfmByRelPath.get(dfmRelPath.toLowerCase()) ?? null;
    derivedFormNameRelPathSeen.add(dfmRelPath.toLowerCase());

    let pasDetail = null;
    if (pasSummary?.outFile) pasDetail = loadPerUnitJson(pasSummary.outFile);

    const tableRefs = pasDetail?.tables ?? [];
    const mappedTableCount = tableRefs.filter((t) => {
      const rec = tableMapping.get(t.table.toLowerCase());
      return rec && rec.mapping_status === 'mapped';
    }).length;

    const translationForm = dprUnit.formName ? translations?.forms?.[dprUnit.formName] ?? null : null;

    const menuLinks_ = menuLinksByUnit.get(dprUnit.unitName) ?? [];

    let confidence = 'high';
    const notes = [];
    if (!pasSummary) {
      confidence = 'low';
      notes.push('pas-file-not-found-on-disk');
    }
    if (dprUnit.formName && !dfmSummary) {
      confidence = confidence === 'high' ? 'medium' : confidence;
      notes.push('dfm-not-found-for-declared-form');
    }
    if (dfmSummary && dfmSummary.confidence !== 'high') {
      confidence = confidence === 'high' ? dfmSummary.confidence : confidence;
      notes.push(`dfm-parse-confidence-${dfmSummary.confidence}`);
    }
    if (pasSummary && pasSummary.unknownTableCount > 3) {
      notes.push(`${pasSummary.unknownTableCount}-unresolved-table-references`);
    }

    rows.push({
      unitName: dprUnit.unitName,
      pasPath: dprUnit.relPath,
      formName: dprUnit.formName,
      formClass: dprUnit.formClass ?? (dprUnit.formName ? `T${dprUnit.formName}` : null),
      hasForm: !!dprUnit.formName,
      dfm: dfmSummary
        ? {
            file: dfmSummary.file,
            confidence: dfmSummary.confidence,
            objectCount: dfmSummary.objectCount,
            queryCount: dfmSummary.queryCount,
            gridWithColumnsCount: dfmSummary.columnGridCount,
            pageControlCount: dfmSummary.pageControlCount,
            bindingCount: dfmSummary.bindingCount,
          }
        : null,
      pas: pasSummary
        ? {
            totalLines: pasSummary.totalLines,
            tableCount: pasSummary.tableCount,
            knownTableCount: pasSummary.knownTableCount,
            unknownTableCount: pasSummary.unknownTableCount,
            generalFunctionCallSiteCount: pasSummary.generalFunctionCallSiteCount,
            reportTemplateCount: pasSummary.reportTemplateCount,
            procedureCount: pasSummary.procedureCount,
            eventHandlerCount: pasSummary.eventHandlerCount,
            businessLogicCount: pasSummary.businessLogicCount,
          }
        : null,
      tables: tableRefs.map((t) => t.table),
      tablesMappedCount: mappedTableCount,
      tablesTotalCount: tableRefs.length,
      reportTemplates: pasDetail?.reportTemplates ?? [],
      captionAr: translationForm ? Object.values(translationForm).find((c) => c.ar)?.ar ?? null : null,
      menuLinks: menuLinks_.map((l) => ({ menuItemName: l.menuItemName, captionEn: l.captionEn, hintAr: l.hintAr, confidence: l.confidence })),
      extractionConfidence: confidence,
      notes: notes.join(';'),
      // Left for human review, per the plan.
      web_route: '',
      parity_status: '',
      review_notes: '',
    });
  }

  // Orphans: files that exist on disk but Business.dpr never references them.
  const dprRelPathSet = new Set(dprUnits.map((u) => u.relPath.toLowerCase()));
  const dprDfmRelPathSet = new Set(
    dprUnits.filter((u) => u.formName).map((u) => u.relPath.replace(/\.pas$/i, '.dfm').toLowerCase())
  );
  const orphanPasFiles = (pasIndexData.units ?? []).filter((u) => !dprRelPathSet.has(u.file.toLowerCase())).map((u) => u.file);
  const orphanDfmFiles = (dfmIndex.forms ?? []).filter((f) => !dprDfmRelPathSet.has(f.file.toLowerCase())).map((f) => f.file);

  const unresolvedMenuLinks = menuLinks.filter((l) => l.confidence === 'no-handler' || l.confidence === 'unresolved');

  const lowConfidenceRows = rows.filter((r) => r.extractionConfidence !== 'high');

  const stats = {
    totalDprUnits: dprUnits.length,
    unitsWithForm: rows.filter((r) => r.hasForm).length,
    unitsWithDfmMatched: rows.filter((r) => r.dfm).length,
    unitsWithPasMatched: rows.filter((r) => r.pas).length,
    orphanPasFileCount: orphanPasFiles.length,
    orphanDfmFileCount: orphanDfmFiles.length,
    menuItemsTotal: menuLinks.length,
    menuItemsResolvedHighConfidence: menuLinks.filter((l) => l.confidence === 'high').length,
    menuItemsUnresolved: unresolvedMenuLinks.length,
    lowOrMediumConfidenceUnitCount: lowConfidenceRows.length,
    declaredLegacyTableCount: dbSchema?.tables?.length ?? 0,
    tableMappingCsvRowCount: tableMapping.size,
    tableMappingMappedCount: [...tableMapping.values()].filter((r) => r.mapping_status === 'mapped').length,
    webRouteCount: webRoutes.length,
    reportInventoryCount: reportInventory.entries?.length ?? 0,
  };

  const matrix = {
    generatedAt: new Date().toISOString(),
    stats,
    rows,
    orphanPasFiles,
    orphanDfmFiles,
    menuLinks,
    webRoutes,
    reportInventorySample: (reportInventory.entries ?? []).slice(0, 0), // full list lives in gates-web already; not duplicated here
  };

  fs.mkdirSync(PARITY_DIR, { recursive: true });
  fs.writeFileSync(path.join(PARITY_DIR, 'legacy-parity-matrix.json'), JSON.stringify(matrix, null, 2));

  // --- CSV ---
  const csvCols = [
    'unit_name',
    'pas_path',
    'form_name',
    'form_class',
    'has_dfm',
    'dfm_confidence',
    'table_count',
    'unknown_table_count',
    'tables_mapped_count',
    'general_function_call_count',
    'report_template_count',
    'procedure_count',
    'event_handler_count',
    'business_logic_count',
    'menu_caption_ar',
    'menu_caption_en',
    'extraction_confidence',
    'notes',
    'web_route',
    'parity_status',
    'review_notes',
  ];
  const csvEscape = (v) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csvLines = [csvCols.join(',')];
  for (const r of rows) {
    const menuLink = r.menuLinks[0];
    csvLines.push(
      [
        r.unitName,
        r.pasPath,
        r.formName ?? '',
        r.formClass ?? '',
        r.dfm ? 'yes' : 'no',
        r.dfm?.confidence ?? '',
        r.tablesTotalCount,
        r.pas?.unknownTableCount ?? 0,
        r.tablesMappedCount,
        r.pas?.generalFunctionCallSiteCount ?? 0,
        r.reportTemplates.length,
        r.pas?.procedureCount ?? 0,
        r.pas?.eventHandlerCount ?? 0,
        r.pas?.businessLogicCount ?? 0,
        menuLink?.hintAr ?? '',
        menuLink?.captionEn ?? '',
        r.extractionConfidence,
        r.notes,
        r.web_route,
        r.parity_status,
        r.review_notes,
      ]
        .map(csvEscape)
        .join(',')
    );
  }
  fs.writeFileSync(path.join(PARITY_DIR, 'legacy-parity-matrix.csv'), csvLines.join('\n') + '\n');

  // --- review-queue.md ---
  const md = [];
  md.push('# Legacy Parity Matrix — Review Queue');
  md.push('');
  md.push(`Generated ${matrix.generatedAt}. Everything here fell below high mechanical-extraction confidence and needs a human pass.`);
  md.push('');
  md.push('## Summary');
  md.push('');
  for (const [k, v] of Object.entries(stats)) md.push(`- **${k}**: ${v}`);
  md.push('');

  md.push('## Units with orphaned/dead .pas files (on disk, not referenced by Business.dpr)');
  md.push('');
  md.push('These are almost certainly dead code / superseded duplicates (e.g. an old top-level copy superseded by a subfolder rewrite) — verify before treating as in-scope.');
  md.push('');
  for (const f of orphanPasFiles) md.push(`- \`${f}\``);
  md.push('');

  md.push('## Orphaned .dfm files (on disk, not referenced by Business.dpr as a compiled form)');
  md.push('');
  for (const f of orphanDfmFiles) md.push(`- \`${f}\``);
  md.push('');

  md.push('## Menu items with unresolved target form');
  md.push('');
  md.push('| Menu Item | Caption (EN) | Hint (AR) | Handler | Issue |');
  md.push('|---|---|---|---|---|');
  for (const l of unresolvedMenuLinks) {
    md.push(`| ${l.menuItemName} | ${l.captionEn ?? ''} | ${l.hintAr ?? ''} | ${l.onClickHandler ?? '(none)'} | ${l.confidence} |`);
  }
  md.push('');

  md.push('## Units below high extraction confidence');
  md.push('');
  md.push('| Unit | Form | DFM confidence | Notes |');
  md.push('|---|---|---|---|');
  for (const r of lowConfidenceRows) {
    md.push(`| ${r.unitName} | ${r.formName ?? ''} | ${r.dfm?.confidence ?? 'n/a'} | ${r.notes} |`);
  }
  md.push('');

  md.push('## Units with a meaningful number of unresolved table references (>3)');
  md.push('');
  md.push('| Unit | Unknown tables |');
  md.push('|---|---|');
  for (const r of rows.filter((r) => (r.pas?.unknownTableCount ?? 0) > 3)) {
    md.push(`| ${r.unitName} | ${r.pas.unknownTableCount} |`);
  }
  md.push('');

  fs.writeFileSync(path.join(PARITY_DIR, 'review-queue.md'), md.join('\n'));

  console.log('');
  console.log('=== Summary ===');
  for (const [k, v] of Object.entries(stats)) console.log(`  ${k}: ${v}`);
  console.log('');
  console.log(`Output: ${path.join(PARITY_DIR, 'legacy-parity-matrix.json')}`);
  console.log(`Output: ${path.join(PARITY_DIR, 'legacy-parity-matrix.csv')}`);
  console.log(`Output: ${path.join(PARITY_DIR, 'review-queue.md')}`);
}

main();
