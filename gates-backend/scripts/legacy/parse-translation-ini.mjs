#!/usr/bin/env node
/**
 * parse-translation-ini.mjs — Delphi parity matrix, Phase 0.
 *
 * Reads `MainProgram/Translation/*.ini` (287 files) — the legacy runtime
 * multi-language override table, keyed by control name, giving each control
 * its Arabic/English/Turkish caption(s). This is the authoritative caption
 * source (more reliable than a form's static `.dfm` Caption/Hint, which is
 * only the *design-time default* — these `.ini` files are what a real
 * install with `LangCode <> 1` actually renders).
 *
 * Format, per file (filename == the form's `formName`, e.g. `FrmBP.ini` for
 * `TFrmBP`):
 *   [ControlName]
 *   ControlClassName=TStringField
 *   Caption1_0_0=<Arabic, Windows-1256 bytes>
 *   Caption2_0_0=<English>
 *   Caption3_0_0=<Turkish, Windows-1254 bytes>
 *   ...
 * Grid controls repeat `Caption{lang}_0_{colIndex}` once per column instead
 * of a single `_0_0` pair.
 *
 * Usage:
 *   node scripts/legacy/parse-translation-ini.mjs [--src <MainProgram/Translation>] [--out <docs/parity/legacy-translations.json>]
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
const SRC_DIR = path.resolve(args.src || path.join(REPO_ROOT, 'MainProgram/Translation'));
const OUT_PATH = path.resolve(args.out || path.join(REPO_ROOT, 'docs/parity/legacy-translations.json'));

// LangCode 1 = Arabic (Windows-1256), 2 = English (ASCII, codepage-agnostic),
// 3 = Turkish (Windows-1254) per untgeneral.pas language switching convention.
const LANG_DECODERS = {
  1: new TextDecoder('windows-1256'),
  2: new TextDecoder('windows-1252'),
  3: new TextDecoder('windows-1254'),
};
const LANG_KEYS = { 1: 'ar', 2: 'en', 3: 'tr' };

function decodeCaptionValue(latin1Value, lang) {
  const decoder = LANG_DECODERS[lang] ?? LANG_DECODERS[2];
  return decoder.decode(Buffer.from(latin1Value, 'latin1'));
}

function parseOneFile(fullPath) {
  // The file bytes are Windows code-page text, not UTF-8 — read as latin1
  // (1 byte = 1 char passthrough) and re-decode each value with the
  // per-language Windows code page above.
  const text = fs.readFileSync(fullPath, 'latin1');
  const lines = text.split(/\r\n|\r|\n/);

  const controls = {};
  let current = null;
  const CAPTION_RE = /^Caption([123])_(\d+)_(\d+)=(.*)$/;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line === '') continue;
    const sectionMatch = line.match(/^\[(.+)\]$/);
    if (sectionMatch) {
      current = { controlClassName: null, byCell: {} };
      controls[sectionMatch[1]] = current;
      continue;
    }
    if (!current) continue;
    const classMatch = line.match(/^ControlClassName=(.*)$/);
    if (classMatch) {
      current.controlClassName = classMatch[1].trim();
      continue;
    }
    const capMatch = line.match(CAPTION_RE);
    if (capMatch) {
      const [, langStr, row, col] = capMatch;
      const lang = Number(langStr);
      const cellKey = `${row}_${col}`;
      const cell = current.byCell[cellKey] ?? { row: Number(row), col: Number(col) };
      cell[LANG_KEYS[lang] ?? `lang${lang}`] = decodeCaptionValue(capMatch[4], lang);
      current.byCell[cellKey] = cell;
    }
  }

  // Flatten: simple controls have a single 0_0 cell -> { ar, en, tr } directly;
  // grid controls have multiple cells -> an ordered `columns` array.
  const flatControls = {};
  for (const [name, data] of Object.entries(controls)) {
    const cells = Object.values(data.byCell).sort((a, b) => a.row - b.row || a.col - b.col);
    if (cells.length <= 1) {
      const cell = cells[0] ?? {};
      flatControls[name] = {
        controlClassName: data.controlClassName,
        ar: cell.ar ?? null,
        en: cell.en ?? null,
        tr: cell.tr ?? null,
      };
    } else {
      flatControls[name] = {
        controlClassName: data.controlClassName,
        columns: cells.map((c) => ({ row: c.row, col: c.col, ar: c.ar ?? null, en: c.en ?? null, tr: c.tr ?? null })),
      };
    }
  }
  return flatControls;
}

function main() {
  if (!fs.existsSync(SRC_DIR)) {
    console.error(`Source directory not found: ${SRC_DIR}`);
    process.exit(1);
  }
  const files = fs
    .readdirSync(SRC_DIR)
    .filter((f) => f.toLowerCase().endsWith('.ini'))
    .sort();

  const byForm = {};
  let totalControls = 0;
  let withArabic = 0;
  let withEnglish = 0;
  let failed = 0;

  for (const file of files) {
    const formName = file.replace(/\.ini$/i, '');
    try {
      const controls = parseOneFile(path.join(SRC_DIR, file));
      byForm[formName] = controls;
      for (const c of Object.values(controls)) {
        totalControls++;
        const hasAr = c.ar || (c.columns ?? []).some((col) => col.ar);
        const hasEn = c.en || (c.columns ?? []).some((col) => col.en);
        if (hasAr) withArabic++;
        if (hasEn) withEnglish++;
      }
    } catch (err) {
      failed++;
      console.error(`  FAILED ${file}: ${err.message}`);
    }
  }

  const result = {
    generatedAt: new Date().toISOString(),
    sourceDir: SRC_DIR,
    totalFiles: files.length,
    failed,
    stats: {
      totalControls,
      withArabicCaption: withArabic,
      withEnglishCaption: withEnglish,
    },
    forms: byForm,
  };

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(result, null, 2));

  console.log(`Translation files: ${files.length} (failed=${failed})`);
  console.log(`Total controls indexed: ${totalControls}`);
  console.log(`  with Arabic caption: ${withArabic}`);
  console.log(`  with English caption: ${withEnglish}`);
  console.log(`Output: ${OUT_PATH}`);
}

main();
