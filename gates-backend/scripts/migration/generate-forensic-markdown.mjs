#!/usr/bin/env node
/** Build docs/migration forensic reports from audit-out JSON (after successful restore). */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const auditDir = path.join(repoRoot, 'scripts/migration/legacy-local-restore/audit-out');
const docsDir = path.join(repoRoot, 'docs/migration');

function readJson(name) {
  const p = path.join(auditDir, name);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function blockedDoc(title, reason) {
  return `# ${title}\n\n**Status:** BLOCKED — ${reason}\n\n**Restore:** Run \`scripts/migration/legacy-local-restore/restore-and-audit.sh\` after placing \`DataBase21-5-2026.bak\`.\n`;
}

function main() {
  const identity = readJson('forensic-metadata_identity.json');
  if (!identity || identity.error) {
    const reason = 'Backup not restored or audit JSON missing.';
    for (const f of [
      'LEGACY_RESTORED_DB_METADATA.md',
      'LEGACY_REAL_DATA_PROFILE.md',
      'LEGACY_RECONCILIATION_BASELINE.md',
      'LEGACY_POSTING_PIPELINES.md',
    ]) {
      fs.writeFileSync(path.join(docsDir, f), blockedDoc(f.replace('.md', ''), reason));
    }
    console.log('Wrote BLOCKED stubs (no audit-out data).');
    return;
  }

  const rowcounts = readJson('forensic-rowcounts_all.json');
  const rows = rowcounts?.rows?.[0] ?? rowcounts?.rows ?? [];
  const list = Array.isArray(rows) ? rows : rowcounts?.recordset ?? [];

  let md = '# Legacy Real Data Profile\n\n**CONFIRMED_FROM_DB**\n\n';
  if (Array.isArray(list) && list.length) {
    const top50 = list.slice(0, 50);
    md += '## Top 50 tables by row count\n\n| Table | Rows |\n|-------|-----:|\n';
    for (const r of top50) {
      md += `| ${r.schema_name ?? 'dbo'}.${r.table_name} | ${r.row_count} |\n`;
    }
  }
  fs.writeFileSync(path.join(docsDir, 'LEGACY_REAL_DATA_PROFILE.md'), md);
  console.log('Updated LEGACY_REAL_DATA_PROFILE.md');
}

main();
