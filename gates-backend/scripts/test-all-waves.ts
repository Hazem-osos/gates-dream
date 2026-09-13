/**
 * Runs every wave smoke script + the ETL pipeline check in dependency order and
 * prints one pass/fail table. Used as the pre-deploy gate.
 * Run: npm run test:waves
 */
import { spawn } from 'child_process';

type Suite = { name: string; script: string };

const SUITES: Suite[] = [
  { name: 'Foundation parity', script: 'scripts/test-foundation-parity.ts' },
  { name: 'Wave0 GL (M0/M1)', script: 'scripts/test-wave0-gl.ts' },
  { name: 'Wave0 Item cost (M4)', script: 'scripts/test-item-cost-formula.ts' },
  { name: 'Wave1 Invoices (M5)', script: 'scripts/test-wave1-invoices.ts' },
  { name: 'Accounting invariants', script: 'scripts/test-accounting-invariants.ts' },
  { name: 'Wave1 Treasury (M2)', script: 'scripts/test-wave1-treasury.ts' },
  { name: 'Wave1 Taxes (M7)', script: 'scripts/test-wave1-taxes.ts' },
  { name: 'Wave2 POS (M6)', script: 'scripts/test-wave2-pos.ts' },
  { name: 'Wave2 E-invoice (M14)', script: 'scripts/test-wave2-einvoice.ts' },
  { name: 'Wave2 Trade LC/LG (M15/M23)', script: 'scripts/test-wave2-trade.ts' },
  { name: 'Wave3 Manufacturing (M8)', script: 'scripts/test-wave3-manufacturing.ts' },
  { name: 'Wave3 Payroll (M9)', script: 'scripts/test-wave3-payroll.ts' },
  { name: 'Wave3 Schools (M10)', script: 'scripts/test-wave3-schools.ts' },
  { name: 'Wave3 Contracting (M11/M13)', script: 'scripts/test-wave3-contracting.ts' },
  { name: 'Wave3 Real estate (M12)', script: 'scripts/test-wave3-real-estate.ts' },
  // Runs after every vertical seeded its fixtures: drives the same engines over HTTP with auth,
  // license and tenant/fiscal headers, which is the path the UI actually takes.
  { name: 'Wave3 Verticals over HTTP', script: 'scripts/test-wave3-http.ts' },
  { name: 'Wave4 Reports (M16)', script: 'scripts/test-wave4-reports.ts' },
  { name: 'Wave4 Ops + analytics (M17/M22)', script: 'scripts/test-wave4-ops-analytics.ts' },
  { name: 'Wave4 Archive + license (M20/M21)', script: 'scripts/test-wave4-archive-license.ts' },
  { name: 'Phase3 ETL pipeline', script: 'scripts/test-migration-pipeline.ts' },
  { name: 'Phase3 ETL reconciliation', script: 'scripts/test-migration-recon.ts' },
];

function runSuite(suite: Suite): Promise<{ suite: Suite; code: number; ms: number }> {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const child = spawn('npx', ['tsx', suite.script], {
      stdio: 'inherit',
      env: process.env,
    });
    child.on('close', (code) =>
      resolve({ suite, code: code ?? 1, ms: Date.now() - startedAt })
    );
  });
}

async function main() {
  const only = process.argv.slice(2).filter((a) => !a.startsWith('-'));
  const selected = only.length
    ? SUITES.filter((s) => only.some((o) => s.script.includes(o) || s.name.includes(o)))
    : SUITES;

  if (selected.length === 0) {
    console.error(`No suites matched: ${only.join(', ')}`);
    process.exit(2);
  }

  const results: Array<{ suite: Suite; code: number; ms: number }> = [];
  for (const suite of selected) {
    console.log(`\n${'='.repeat(70)}\n▶ ${suite.name}\n${'='.repeat(70)}`);
    results.push(await runSuite(suite));
  }

  console.log(`\n${'='.repeat(70)}\nSUMMARY\n${'='.repeat(70)}`);
  for (const r of results) {
    const status = r.code === 0 ? 'PASS' : `FAIL(${r.code})`;
    console.log(`${status.padEnd(9)} ${r.suite.name} — ${(r.ms / 1000).toFixed(1)}s`);
  }

  const failed = results.filter((r) => r.code !== 0);
  console.log(`\n${results.length - failed.length}/${results.length} suites passed`);
  process.exit(failed.length === 0 ? 0 : 1);
}

void main();
