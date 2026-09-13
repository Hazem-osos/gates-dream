#!/usr/bin/env node
/**
 * extract-save-behavior.mjs
 *
 * For each legacy unit with a Save*Click handler, extract tables written,
 * stored procs, side-effect flags, and ShowLangMessage validations.
 * Merge the result into docs/parity/screens/<FormName>.json.
 *
 * Usage:
 *   node scripts/legacy/extract-save-behavior.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  REPO_ROOT,
  parseArgs,
  readJson,
  writeJson,
  decodeCp1256,
  parseLangMessages,
  extractProcedureBodies,
  findSaveHandlers,
  collectCalledMethods,
  extractSqlTables,
  extractStoredProcs,
  detectSaveFlags,
  extractShowLangCodes,
  isOrphanUnit,
  safeFileSlug,
} from './parity-utils.mjs';

const args = parseArgs(process.argv.slice(2), ['src', 'parity']);
const SRC_DIR = path.resolve(args.src || path.join(REPO_ROOT, 'MainProgram'));
const PARITY_DIR = path.resolve(args.parity || path.join(REPO_ROOT, 'docs/parity'));
const SCREENS_DIR = path.join(PARITY_DIR, 'screens');

function findPasFile(relPath) {
  const full = path.join(SRC_DIR, relPath);
  if (fs.existsSync(full)) return full;
  const base = path.basename(relPath);
  function walk(dir) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        if (['__history', 'chilkat-9.5.0-delphi-dyn', 'temp', 'fonts', 'images'].includes(ent.name)) continue;
        const hit = walk(p);
        if (hit) return hit;
      } else if (ent.name.toLowerCase() === base.toLowerCase()) {
        return p;
      }
    }
    return null;
  }
  return walk(SRC_DIR);
}

function main() {
  console.log('Extracting post-save behavior...');
  const matrix = readJson(path.join(PARITY_DIR, 'legacy-parity-matrix.json'), { rows: [] });
  const messages = parseLangMessages(path.join(SRC_DIR, 'LangMessages.txt'));
  const byUnit = new Map();

  let unitsWithSave = 0;
  let unitsScanned = 0;

  for (const row of matrix.rows || []) {
    if (isOrphanUnit(row.unitName) || !row.pasPath) continue;
    const pasPath = findPasFile(row.pasPath);
    if (!pasPath) continue;
    unitsScanned++;
    let text;
    try {
      text = decodeCp1256(pasPath);
    } catch {
      text = fs.readFileSync(pasPath, 'latin1');
    }
    const bodies = extractProcedureBodies(text);
    const saves = findSaveHandlers(bodies);
    if (saves.length === 0) {
      byUnit.set(row.unitName.toLowerCase(), {
        hasSaveHandler: false,
        handlers: [],
        tablesWritten: [],
        storedProcs: [],
        flags: {
          autoGl: false,
          stockCost: false,
          treasury: false,
          tax: false,
          alarms: false,
          autoPost: false,
          autoPrint: false,
          saveTrace: false,
          needsDbAccess: false,
        },
        validations: [],
      });
      continue;
    }
    unitsWithSave++;
    const combinedParts = [];
    const handlers = [];
    for (const save of saves) {
      const called = collectCalledMethods(save, bodies);
      const blob = [save.body, ...called.map((c) => c.body)].join('\n');
      combinedParts.push(blob);
      handlers.push({
        name: save.name,
        line: save.line,
        called: called.map((c) => c.name),
      });
    }
    const combined = combinedParts.join('\n');
    const codes = extractShowLangCodes(combined);
    byUnit.set(row.unitName.toLowerCase(), {
      hasSaveHandler: true,
      handlers,
      tablesWritten: extractSqlTables(combined),
      storedProcs: extractStoredProcs(combined),
      flags: detectSaveFlags(combined),
      validations: codes.map((code) => ({
        code,
        ar: messages.get(code)?.ar || '',
        en: messages.get(code)?.en || '',
      })),
    });
  }

  let merged = 0;
  const screenFiles = fs.existsSync(SCREENS_DIR)
    ? fs.readdirSync(SCREENS_DIR).filter((f) => f.endsWith('.json'))
    : [];
  for (const file of screenFiles) {
    const full = path.join(SCREENS_DIR, file);
    const screen = readJson(full);
    const save = byUnit.get(String(screen.unitName || '').toLowerCase()) || {
      hasSaveHandler: false,
      handlers: [],
      tablesWritten: [],
      storedProcs: [],
      flags: {
        autoGl: false,
        stockCost: false,
        treasury: false,
        tax: false,
        alarms: false,
        autoPost: false,
        autoPrint: false,
        saveTrace: false,
        needsDbAccess: false,
      },
      validations: [],
    };
    screen.saveBehavior = save;
    writeJson(full, screen);
    merged++;
  }

  writeJson(path.join(PARITY_DIR, 'save-behavior-index.json'), {
    generatedAt: new Date().toISOString(),
    unitsScanned,
    unitsWithSave,
    screensMerged: merged,
  });

  console.log(`  scanned ${unitsScanned} units, ${unitsWithSave} with Save*Click`);
  console.log(`  merged into ${merged} screen files`);
}

main();
