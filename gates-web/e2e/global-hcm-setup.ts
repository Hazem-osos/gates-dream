import type { FullConfig } from '@playwright/test';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const credFile = path.join(__dirname, '.auth', 'e2e-credentials.json');

function loadDatabaseUrlFromBackendEnv() {
  if (process.env.DATABASE_URL?.trim()) return;
  const envPath = path.resolve(__dirname, '../../gates-backend/.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (key === 'DATABASE_URL') process.env.DATABASE_URL = val;
  }
}

async function globalSetup(_config: FullConfig) {
  fs.mkdirSync(path.dirname(credFile), { recursive: true });
  loadDatabaseUrlFromBackendEnv();

  if (process.env.E2E_AUTO_SEED !== '1') {
    return;
  }
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    console.warn('[global-hcm-setup] E2E_AUTO_SEED=1 but DATABASE_URL is missing; skip seed');
    return;
  }
  execSync('npx tsx scripts/seed-e2e-hcm-payroll.ts', {
    cwd: path.resolve(__dirname, '../../gates-backend'),
    env: { ...process.env, E2E_SEED: '1', DATABASE_URL: databaseUrl },
    stdio: 'inherit',
  });
}

export default globalSetup;
