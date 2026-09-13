#!/usr/bin/env npx tsx
/**
 * Simple API latency benchmark (dev JWT login).
 * Usage: JWT_DEV_SECRET=... npx tsx scripts/bench-api.ts
 */
import jwt from 'jsonwebtoken';

const base = (process.env.BENCH_API_URL ?? 'http://127.0.0.1:3001').replace(/\/$/, '');
const secret = process.env.JWT_DEV_SECRET;
const companyId = process.env.BENCH_COMPANY_ID ?? '';
const userId = process.env.BENCH_USER_ID ?? '';

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx]!;
}

async function loginToken(): Promise<string> {
  if (secret && userId && companyId) {
    return jwt.sign(
      {
        sub: userId,
        email: 'bench@local.dev',
        username: 'bench',
        company_id: companyId,
        tenant_id: companyId,
      },
      secret,
      { expiresIn: '1h' }
    );
  }
  const res = await fetch(`${base}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: process.env.BENCH_USERNAME ?? 'hazem', password: process.env.BENCH_PASSWORD ?? '12345' }),
  });
  if (!res.ok) throw new Error(`Login failed: ${res.status}`);
  const body = (await res.json()) as { token?: string; data?: { token?: string } };
  const token = body.token ?? body.data?.token;
  if (!token) throw new Error('No token in login response');
  return token;
}

async function timedGet(path: string, token: string, headers: Record<string, string> = {}) {
  const start = performance.now();
  const res = await fetch(`${base}${path}`, {
    headers: { Authorization: `Bearer ${token}`, ...headers },
  });
  const ms = performance.now() - start;
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  await res.arrayBuffer();
  return ms;
}

async function benchRoute(name: string, path: string, token: string, headers?: Record<string, string>) {
  const samples: number[] = [];
  for (let i = 0; i < 2; i++) await timedGet(path, token, headers);
  for (let i = 0; i < 10; i++) samples.push(await timedGet(path, token, headers));
  samples.sort((a, b) => a - b);
  return {
    name,
    path,
    p50: Math.round(percentile(samples, 50)),
    p95: Math.round(percentile(samples, 95)),
    samples: samples.map((s) => Math.round(s)),
  };
}

async function main() {
  const token = await loginToken();
  const fiscalYearId = process.env.BENCH_FISCAL_YEAR_ID ?? '';
  const branchId = process.env.BENCH_BRANCH_ID ?? '';
  const headers: Record<string, string> = {};
  if (companyId) headers['X-Company-Id'] = companyId;
  if (branchId) headers['X-Branch-Id'] = branchId;
  if (fiscalYearId) headers['X-Fiscal-Year-Id'] = fiscalYearId;

  const results = await Promise.all([
    benchRoute('executive_kpis', '/api/v1/analytics/executive/kpis?months=6', token, headers),
    benchRoute('invoices_list', '/api/v1/invoices?page=1&limit=50', token, headers),
    benchRoute(
      'trial_balance',
      `/api/v1/accounting/financial-reports/trial-balance?asOfDate=${new Date().toISOString().slice(0, 10)}`,
      token,
      headers
    ),
  ]);

  const out = { at: new Date().toISOString(), base, results };
  console.log(JSON.stringify(out, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
