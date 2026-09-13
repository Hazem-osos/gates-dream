#!/usr/bin/env node
/**
 * parse-database-ini.mjs — Delphi parity matrix, Phase 0.
 *
 * Parses `MainProgram/DataBase.ini` — the authoritative legacy schema
 * inventory (569 tables x columns x SQL types), used at design time to
 * generate table definitions across the app. It carries no PK/FK/index
 * data (that lives only in the live SQL Server catalog), so this is a
 * columns-and-types inventory, not a full constraint model.
 *
 * Format:
 *   [Tables]
 *   Table1=AbsBasicUnit
 *   Table2=AbsGeneralItemDetails
 *   ...
 *   [Account]
 *   ColumnName1=AccountCode
 *   ColumnType1=nvarchar(20)
 *   ...
 *   ColumnCount=19
 *   TableName=Account
 *   [AccountCardDist]
 *   ...
 *
 * Usage:
 *   node scripts/legacy/parse-database-ini.mjs [--src <MainProgram/DataBase.ini>] [--out <docs/parity/legacy-database-schema.json>]
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
const SRC_PATH = path.resolve(args.src || path.join(REPO_ROOT, 'MainProgram/DataBase.ini'));
const OUT_PATH = path.resolve(args.out || path.join(REPO_ROOT, 'docs/parity/legacy-database-schema.json'));

function parseIniSections(text) {
  const lines = text.split(/\r\n|\r|\n/);
  const sections = [];
  let current = null;
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith(';')) continue;
    const sectionMatch = line.match(/^\[(.+)\]$/);
    if (sectionMatch) {
      current = { name: sectionMatch[1], entries: [] };
      sections.push(current);
      continue;
    }
    const kvMatch = line.match(/^([^=]+)=(.*)$/);
    if (kvMatch && current) {
      current.entries.push([kvMatch[1].trim(), kvMatch[2].trim()]);
    }
  }
  return sections;
}

/** Splits a SQL type token like `decimal(18,4)` into { baseType, args }. */
function splitSqlType(raw) {
  const m = raw.match(/^([A-Za-z_][\w ]*)\s*(?:\((.*)\))?$/);
  if (!m) return { baseType: raw, args: null };
  return { baseType: m[1].trim(), args: m[2] ?? null };
}

function main() {
  if (!fs.existsSync(SRC_PATH)) {
    console.error(`Source file not found: ${SRC_PATH}`);
    process.exit(1);
  }
  const text = fs.readFileSync(SRC_PATH, 'latin1');
  const sections = parseIniSections(text);

  // The [Tables] section also carries a `TableCount=569` trailer entry
  // (same pattern as `ColumnCount`/`TableName` trailers on each table's own
  // section) — only `TableN=` keys are actual table-name declarations.
  const tablesSection = sections.find((s) => s.name === 'Tables');
  const declaredTableNames = tablesSection
    ? tablesSection.entries.filter(([k]) => /^Table\d+$/.test(k)).map(([, v]) => v)
    : [];
  const tablesSectionTrailerCount = tablesSection?.entries.find(([k]) => k === 'TableCount')?.[1] ?? null;

  const tableSections = sections.filter((s) => s.name !== 'Tables');

  const tables = [];
  const issues = [];

  for (const section of tableSections) {
    const byIndex = new Map(); // index -> { name, type }
    let columnCount = null;
    let tableNameProp = null;

    for (const [key, value] of section.entries) {
      const nameMatch = key.match(/^ColumnName(\d+)$/);
      const typeMatch = key.match(/^ColumnType(\d+)$/);
      if (nameMatch) {
        const idx = Number(nameMatch[1]);
        const entry = byIndex.get(idx) ?? {};
        entry.name = value;
        byIndex.set(idx, entry);
      } else if (typeMatch) {
        const idx = Number(typeMatch[1]);
        const entry = byIndex.get(idx) ?? {};
        entry.type = value;
        byIndex.set(idx, entry);
      } else if (key === 'ColumnCount') {
        columnCount = Number(value);
      } else if (key === 'TableName') {
        tableNameProp = value;
      }
    }

    const columns = [...byIndex.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([idx, entry]) => {
        const { baseType, args } = entry.type ? splitSqlType(entry.type) : { baseType: null, args: null };
        return {
          index: idx,
          columnName: entry.name ?? null,
          sqlType: entry.type ?? null,
          baseType,
          typeArgs: args,
        };
      });

    const missingName = columns.filter((c) => !c.columnName);
    const missingType = columns.filter((c) => !c.sqlType);
    if (missingName.length || missingType.length || (columnCount !== null && columnCount !== columns.length)) {
      issues.push({
        table: tableNameProp ?? section.name,
        missingNameCount: missingName.length,
        missingTypeCount: missingType.length,
        declaredColumnCount: columnCount,
        actualColumnCount: columns.length,
      });
    }

    tables.push({
      tableName: tableNameProp ?? section.name,
      sectionName: section.name,
      declaredColumnCount: columnCount,
      columns,
    });
  }

  const tableNamesFromSections = new Set(tables.map((t) => t.tableName));
  const declaredButMissing = declaredTableNames.filter((n) => !tableNamesFromSections.has(n));
  const sectionsNotDeclared = tables.map((t) => t.tableName).filter((n) => !declaredTableNames.includes(n));

  const result = {
    generatedAt: new Date().toISOString(),
    sourceFile: SRC_PATH,
    stats: {
      declaredTableCount: declaredTableNames.length,
      declaredTableCountTrailer: tablesSectionTrailerCount,
      parsedTableCount: tables.length,
      totalColumns: tables.reduce((sum, t) => sum + t.columns.length, 0),
      declaredButMissingSectionCount: declaredButMissing.length,
      sectionsNotInDeclaredListCount: sectionsNotDeclared.length,
      tablesWithIssuesCount: issues.length,
    },
    declaredButMissingSections: declaredButMissing,
    sectionsNotInDeclaredList: sectionsNotDeclared,
    issues,
    tables,
  };

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(result, null, 2));

  console.log(`Declared tables ([Tables] section): ${declaredTableNames.length}`);
  console.log(`Parsed table sections: ${tables.length}`);
  console.log(`Total columns: ${result.stats.totalColumns}`);
  console.log(`Declared-but-missing sections: ${declaredButMissing.length}`);
  console.log(`Sections not in declared list: ${sectionsNotDeclared.length}`);
  console.log(`Tables with column issues: ${issues.length}`);
  console.log(`Output: ${OUT_PATH}`);
}

main();
