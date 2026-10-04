#!/usr/bin/env node
/**
 * Read-only legacy SQL Server forensic audit.
 * Requires LEGACY_FORENSIC_URL or LEGACY_MSSQL_URL (read-only login recommended).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../..');

function parseArgs() {
  const out = { outDir: path.join(repoRoot, 'scripts/migration/legacy-local-restore/audit-out') };
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--out=')) out.outDir = path.resolve(arg.slice(6));
  }
  return out;
}

function parseSections(sqlText) {
  const sections = new Map();
  let current = 'default';
  let buf = [];
  for (const line of sqlText.split('\n')) {
    const m = line.match(/^-- @@SECTION (\w+)/);
    if (m) {
      if (buf.length) sections.set(current, buf.join('\n'));
      current = m[1];
      buf = [];
      continue;
    }
    buf.push(line);
  }
  if (buf.length) sections.set(current, buf.join('\n'));
  return sections;
}

async function loadMssql() {
  try {
    return await import('mssql');
  } catch {
    console.error('Install mssql: npm install mssql');
    process.exit(1);
  }
}

function connectionStringToConfig(url) {
  if (!url.includes('://')) {
    return url;
  }
  const u = new URL(url.replace(/^sqlserver:/, 'http:'));
  const database = u.searchParams.get('database') ?? u.pathname.replace(/^\//, '');
  const encrypt = u.searchParams.get('encrypt') !== 'false';
  return {
    server: u.hostname,
    port: u.port ? Number(u.port) : 1433,
    database,
    user: u.searchParams.get('user') ?? u.username,
    password: u.searchParams.get('password') ?? u.password,
    options: { encrypt, trustServerCertificate: true },
  };
}

async function runSection(pool, name, sql) {
  const trimmed = sql.trim();
  if (!trimmed) return { name, rows: [], error: 'empty' };
  try {
    const result = await pool.request().query(trimmed);
    const rows = result.recordsets?.length > 1 ? result.recordsets : result.recordset ?? [];
    return { name, rows };
  } catch (e) {
    return { name, error: String(e.message ?? e) };
  }
}

async function extractProcedureForensics(pool, outDir) {
  const q = `
    SELECT o.name, o.type_desc, m.definition
    FROM sys.objects o
    JOIN sys.sql_modules m ON m.object_id = o.object_id
    WHERE o.type = 'P'
      AND (
        m.definition LIKE '%Post%'
        OR m.definition LIKE '%Invoice%'
        OR m.definition LIKE '%Store%'
        OR m.definition LIKE '%GLTrx%'
        OR m.definition LIKE '%Cash%'
        OR m.definition LIKE '%ItemStore%'
        OR m.definition LIKE '%Adjust%'
      )
    ORDER BY o.name;
  `;
  const { recordset } = await pool.request().query(q);
  const summaries = [];
  for (const row of recordset) {
    const def = row.definition ?? '';
    const tables = [...def.matchAll(/\b(?:FROM|JOIN|INTO|UPDATE)\s+dbo\.(\w+)/gi)].map((m) => m[1]);
    const uniqueTables = [...new Set(tables)].sort();
    summaries.push({
      name: row.name,
      type: row.type_desc,
      defLength: def.length,
      tablesReferenced: uniqueTables,
      writes: uniqueTables.filter((t) =>
        new RegExp(`(INSERT|UPDATE|DELETE)\\s+[^;]*\\b${t}\\b`, 'i').test(def)
      ),
      reads: uniqueTables,
    });
  }
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'forensic-procedures.json'), JSON.stringify(summaries, null, 2));
  fs.writeFileSync(
    path.join(outDir, 'forensic-procedure-bodies.sql'),
    recordset.map((r) => `-- ${r.name}\n${r.definition}\nGO\n`).join('\n')
  );
  return summaries;
}

async function main() {
  const { outDir } = parseArgs();
  const url = process.env.LEGACY_FORENSIC_URL ?? process.env.LEGACY_MSSQL_URL;
  if (!url) {
    console.error('BLOCKED: Set LEGACY_FORENSIC_URL or LEGACY_MSSQL_URL');
    process.exit(2);
  }

  const mssql = await loadMssql();
  const config = connectionStringToConfig(url);
  const pool = await mssql.default.connect(config);

  const sqlPath = path.join(__dirname, 'legacy-forensic-audit.sql');
  const sections = parseSections(fs.readFileSync(sqlPath, 'utf8'));
  fs.mkdirSync(outDir, { recursive: true });

  const results = {};
  for (const [name, sql] of sections) {
    results[name] = await runSection(pool, name, sql);
    fs.writeFileSync(path.join(outDir, `forensic-${name}.json`), JSON.stringify(results[name], null, 2));
    console.log(`Section ${name}: ${results[name].error ? 'ERROR' : 'ok'}`);
  }

  const procedures = await extractProcedureForensics(pool, outDir);
  console.log(`Procedure forensics: ${procedures.length} procedures`);

  fs.writeFileSync(path.join(outDir, 'forensic-summary.json'), JSON.stringify({ at: new Date().toISOString(), results: Object.keys(results) }, null, 2));

  await pool.close();
  console.log(`Wrote audit JSON to ${outDir}`);
  console.log('Regenerate markdown: npm run legacy:forensic-report');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
