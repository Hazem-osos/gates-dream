#!/usr/bin/env node
/**
 * extract-settings-catalog.mjs — Delphi parity matrix, Phase 1 foundation.
 *
 * Extracts the full legacy company-settings catalog:
 *
 *   1. `untcompanyvariables.pas` `Tcompany.set_variables` — every
 *      `CompanySetting` key read at company-load time, together with its
 *      *legacy-exact default* (the value used when the row is absent —
 *      this is the real default, not whatever a Prisma column default
 *      says). Pattern is exactly:
 *        Locate('Name', VarArrayOf(['<Key>']), ...);
 *        if LocateSuccess=false then begin
 *          F<Field> := <default>;
 *          ...
 *        end else begin ...
 *
 *   2. `untSetting.pas` `Save*Settings` procedures — every key any settings
 *      screen writes back, which both confirms the key list from (1) and
 *      surfaces keys that are write-only from a settings dialog (no
 *      load-time default branch), plus which module-suffixed variants
 *      (`SalesDaribaSI01`, `AutoPostBP01`, ...) each proc handles.
 *
 * Neither file is machine-parseable Pascal, so this is regex-based
 * mechanical extraction, same spirit and confidence caveats as the other
 * scripts/legacy/*.mjs tools.
 *
 * Usage:
 *   node scripts/legacy/extract-settings-catalog.mjs [--src <MainProgram dir>] [--out <docs/parity/legacy-settings-catalog.json>]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../../');

function parseArgs(argv) {
  const out = { src: null, out: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--src') out.src = argv[++i];
    else if (argv[i] === '--out') out.out = argv[++i];
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const SRC_DIR = path.resolve(args.src || path.join(REPO_ROOT, 'MainProgram'));
const OUT_PATH = path.resolve(args.out || path.join(REPO_ROOT, 'docs/parity/legacy-settings-catalog.json'));

// ---------------------------------------------------------------------------
// 1. untcompanyvariables.pas — Locate(...)/if LocateSuccess=false/default(s)
// ---------------------------------------------------------------------------
function extractCompanyVariableDefaults(text) {
  // Isolate just the default (LocateSuccess=false) branch body per key — the
  // `else` branch that reads from the DB often has its own nested
  // if/begin/end (e.g. BackupPath trailing-slash normalization), so we only
  // ever capture up to the first `end ... else` boundary.
  const BLOCK_RE =
    /Locate\('Name',\s*VarArrayOf\(\['(\w+)'\]\)[^;]*;\s*if\s+LocateSuccess\s*=\s*false\s+then\s+begin([\s\S]*?)end\s*;?\s*else\b/gi;
  const ASSIGN_RE = /\bF(\w+)\s*:=\s*([^;]+);/g;

  const results = [];
  for (const m of text.matchAll(BLOCK_RE)) {
    const key = m[1];
    const body = m[2];
    const assignments = [];
    for (const am of body.matchAll(ASSIGN_RE)) {
      assignments.push({ field: `F${am[1]}`, defaultExpr: am[2].trim() });
    }
    // The assignment whose field name matches (case-insensitively) the
    // locate key is the "primary" default for this key; the rest are
    // side-effect defaults for related fields set in the same branch.
    const primary = assignments.find((a) => a.field.toLowerCase() === `f${key.toLowerCase()}`) ?? assignments[0] ?? null;
    const secondary = assignments.filter((a) => a !== primary);
    results.push({
      key,
      primaryField: primary?.field ?? null,
      defaultExpr: primary?.defaultExpr ?? null,
      relatedDefaults: secondary,
    });
  }
  return results;
}

// ---------------------------------------------------------------------------
// 2. untSetting.pas — Save*Settings procedures.
// `SQLText := ' Insert Into CompanySetting (CompanyCode,Name,Value,...) ' ...`
// or `Update CompanySetting Set Value = ... Where Name = 'X'` style writes,
// plus module-suffixed keys built via string concatenation with a module
// code parameter (e.g. `'SalesDariba'+ModuleCode`).
// ---------------------------------------------------------------------------
function extractSaveSettingsProcs(text) {
  const lines = text.split(/\r\n|\r|\n/);
  const PROC_RE = /^\s*procedure\s+(\w*Save\w*Settings\w*)\s*\(/i;
  const starts = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(PROC_RE);
    if (m) starts.push({ line: i, name: m[1] });
  }
  // Also capture every proc/function decl (dotted or not) as a boundary so
  // bodies don't bleed into the next unrelated routine.
  const ANY_DECL_RE = /^\s*(procedure|function)\s+/i;
  const boundaries = [];
  for (let i = 0; i < lines.length; i++) if (ANY_DECL_RE.test(lines[i])) boundaries.push(i);

  const procs = [];
  for (const { line, name } of starts) {
    const nextBoundary = boundaries.find((b) => b > line) ?? lines.length;
    const body = lines.slice(line, nextBoundary).join('\n');

    // Every Save*Settings proc takes the module-code suffix as a parameter
    // that is, confusingly, itself named `Name` (e.g.
    // `procedure SaveCashPaymentSettings(Name: string)`), and every key it
    // touches is built as `Name = ''' + 'SerialAutomatic' + Name` (an empty
    // opening literal, then the real key-base literal, then the module-code
    // parameter) — so the real key-base text is the literal immediately
    // followed by `+ Name`.
    const literalKeys = new Set();
    for (const km of body.matchAll(/[Nn]ame\s*=\s*'([A-Za-z_]\w+)'(?!\s*\+)/g)) literalKeys.add(km[1]);
    for (const km of body.matchAll(/'([A-Za-z][A-Za-z_]{2,40})'\s*\+\s*Name\b/g)) {
      literalKeys.add(`${km[1]}{ModuleCode}`);
    }

    const tables = new Set();
    for (const tm of body.matchAll(/\b(?:Insert\s+Into|Update|From)\s+([A-Za-z_]\w*)/gi)) tables.add(tm[1]);

    procs.push({
      procName: name,
      line: line + 1,
      literalKeys: [...literalKeys].sort(),
      tablesTouched: [...tables].sort(),
    });
  }

  // Units declare `procedure Foo(...)` twice — once as an interface forward
  // declaration (no body, so nothing to extract) and once as the real
  // implementation — keep only the richer occurrence per name.
  const byName = new Map();
  for (const p of procs) {
    const existing = byName.get(p.procName);
    if (!existing || p.literalKeys.length + p.tablesTouched.length > existing.literalKeys.length + existing.tablesTouched.length) {
      byName.set(p.procName, p);
    }
  }
  return [...byName.values()].sort((a, b) => a.line - b.line);
}

function main() {
  const companyVarsPath = path.join(SRC_DIR, 'untcompanyvariables.pas');
  const settingPath = path.join(SRC_DIR, 'untSetting.pas');

  if (!fs.existsSync(companyVarsPath) || !fs.existsSync(settingPath)) {
    console.error('Missing untcompanyvariables.pas or untSetting.pas under', SRC_DIR);
    process.exit(1);
  }

  const companyVarsText = fs.readFileSync(companyVarsPath, 'latin1');
  const settingText = fs.readFileSync(settingPath, 'latin1');

  const defaults = extractCompanyVariableDefaults(companyVarsText);
  const saveProcs = extractSaveSettingsProcs(settingText);

  // Cross-reference: keys with a load-time default AND at least one writer
  // proc referencing them (directly, case-insensitively) are "confirmed";
  // keys with only a default (no matching writer found) or only a writer
  // (no load-time default) go in the review queue.
  const allSaveKeys = new Set();
  for (const p of saveProcs) for (const k of p.literalKeys) allSaveKeys.add(k.replace('{ModuleCode}', '').toLowerCase());

  const catalog = defaults.map((d) => ({
    key: d.key,
    scope: 'company', // set_variables always loads per-companycode; module-suffixed variants are handled separately below
    primaryField: d.primaryField,
    defaultExpr: d.defaultExpr,
    relatedDefaults: d.relatedDefaults,
    confirmedByWriter: allSaveKeys.has(d.key.toLowerCase()),
  }));

  const moduleSuffixedKeys = [...new Set(saveProcs.flatMap((p) => p.literalKeys.filter((k) => k.includes('{ModuleCode}'))))].sort();

  const keysWithoutDefault = [...allSaveKeys].filter(
    (k) => !defaults.some((d) => d.key.toLowerCase() === k) && !k.includes('{modulecode}')
  );

  const result = {
    generatedAt: new Date().toISOString(),
    source: {
      companyVariables: 'untcompanyvariables.pas (Tcompany.set_variables)',
      settingsWriters: 'untSetting.pas (Save*Settings procedures)',
    },
    stats: {
      totalKeysWithLoadTimeDefault: catalog.length,
      keysConfirmedByAWriter: catalog.filter((c) => c.confirmedByWriter).length,
      moduleSuffixedKeyPatternCount: moduleSuffixedKeys.length,
      saveSettingsProcCount: saveProcs.length,
      keysWrittenButNoLoadTimeDefaultFound: keysWithoutDefault.length,
    },
    catalog,
    moduleSuffixedKeyPatterns: moduleSuffixedKeys,
    keysWrittenButNoLoadTimeDefaultFound: keysWithoutDefault,
    saveSettingsProcs: saveProcs,
  };

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(result, null, 2));

  console.log(`Keys with load-time default (untcompanyvariables.pas): ${catalog.length}`);
  console.log(`  confirmed by a Save*Settings writer: ${result.stats.keysConfirmedByAWriter}`);
  console.log(`Save*Settings procedures found: ${saveProcs.length}`);
  console.log(`Module-suffixed key patterns (e.g. SalesDariba{ModuleCode}): ${moduleSuffixedKeys.length}`);
  console.log(`Keys written but with no load-time default found: ${keysWithoutDefault.length}`);
  console.log(`Output: ${OUT_PATH}`);
}

main();
