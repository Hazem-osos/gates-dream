// Drives the migration wizard's API against the LOCAL backend (port 4055) only.
// Usage: node e2e.mjs <step> [jobId]
//   steps: login | source | job | run:<mode> | job-status | issues | mapping | coverage | recon
import fs from 'node:fs';
import path from 'node:path';

const DIR = path.dirname(new URL(import.meta.url).pathname);
const SCRATCH = process.env.GATES_E2E_WORK ?? path.join(process.env.HOME ?? '.', '.gates-migration-e2e');
const BASE = 'http://127.0.0.1:4055/api/v1';
const ME = `${BASE}/migration-engine`;
const OUT = path.join(SCRATCH, 'e2e-out');
fs.mkdirSync(OUT, { recursive: true });

const [step, arg] = process.argv.slice(2);
const tokenFile = path.join(SCRATCH, 'e2e.token');

async function call(method, url, body) {
  const token = fs.existsSync(tokenFile) ? fs.readFileSync(tokenFile, 'utf8').trim() : '';
  const res = await fetch(url, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30 * 60 * 1000),
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text.slice(0, 2000) }; }
  return { status: res.status, json };
}

function save(name, data) {
  fs.writeFileSync(path.join(OUT, `${name}.json`), JSON.stringify(data, null, 2));
}

function brief(v, n = 1500) {
  const s = JSON.stringify(v);
  return s.length > n ? `${s.slice(0, n)}…(${s.length} chars)` : s;
}

if (step === 'login') {
  const password = fs.readFileSync(path.join(SCRATCH, 'owner.pw'), 'utf8').trim();
  const r = await call('POST', `${BASE}/auth/login`, { username: 'owner', password });
  const d = r.json?.data ?? r.json;
  const token = d?.token ?? d?.accessToken ?? d?.tokens?.accessToken;
  if (!token) { console.log('LOGIN FAILED', r.status, brief(r.json, 600)); process.exit(1); }
  fs.writeFileSync(tokenFile, token, { mode: 0o600 });
  console.log('login ok', r.status);
} else if (step === 'source') {
  const password = fs.readFileSync(path.join(SCRATCH, 'reader.pw'), 'utf8').trim();
  const put = await call('PUT', `${ME}/source/remote`, {
    host: '127.0.0.1', port: 14333, database: 'GatesSyntheticLegacy', user: 'gates_mig_reader',
    password, encrypt: true, trustServerCertificate: true,
  });
  console.log('PUT source', put.status, brief(put.json, 600));
  const test = await call('POST', `${ME}/source/remote/test`);
  console.log('TEST source', test.status, brief(test.json, 800));
  save('source-test', test);
} else if (step === 'job') {
  const r = await call('POST', `${ME}/jobs`, { legacyCompanyCode: '0001', sourceMode: 'REMOTE_SQL_SERVER' });
  console.log('create job', r.status, brief(r.json, 1200));
  save('job-create', r);
} else if (step?.startsWith('run:')) {
  const mode = step.slice(4);
  const t0 = Date.now();
  const body = { mode, ...(mode === 'execute' || mode === 'import' || mode === 'auto' ? { confirmTargetWrite: true } : {}) };
  const r = await call('POST', `${ME}/jobs/${arg}/run`, body);
  console.log(`run ${mode}`, r.status, `${((Date.now() - t0) / 1000).toFixed(1)}s`, brief(r.json, 3000));
  save(`run-${mode}`, r);
} else if (step === 'job-status') {
  const r = await call('GET', `${ME}/jobs/${arg}`);
  save('job', r);
  console.log(r.status, brief(r.json, 3000));
} else if (step === 'issues') {
  const r = await call('GET', `${ME}/jobs/${arg}/issues?limit=500`);
  save('issues', r);
  const items = r.json?.data?.items ?? r.json?.data ?? r.json?.items ?? [];
  console.log(r.status, 'count', Array.isArray(items) ? items.length : '?');
  if (Array.isArray(items)) {
    const by = {};
    for (const i of items) {
      const k = `${i.severity}|${i.stage}|${i.category}`;
      if (!by[k]) by[k] = { n: 0, sample: `${i.sourceKey ?? ''}: ${String(i.description ?? '').slice(0, 160)}` };
      by[k].n += 1;
    }
    console.log(by);
    for (const i of items.filter((x) => /BLOCKER|ERROR/i.test(x.severity)).slice(0, 15)) {
      console.log('-', i.severity, i.stage, i.code ?? i.issueCode, String(i.message ?? '').slice(0, 220));
    }
  } else console.log(brief(r.json, 2000));
} else if (step === 'mapping') {
  const r = await call('GET', `${ME}/jobs/${arg}/mapping/accounts`);
  save('mapping', r);
  console.log(r.status, brief(r.json, 2500));
} else if (step === 'coverage') {
  const r = await call('GET', `${ME}/jobs/${arg}/coverage`);
  save('coverage', r);
  console.log(r.status, brief(r.json, 2500));
} else if (step === 'recon') {
  const r = await call('GET', `${ME}/jobs/${arg}/reports/reconciliation`);
  save('recon', r);
  console.log(r.status, brief(r.json, 4000));
} else {
  console.log('unknown step');
  process.exit(2);
}
