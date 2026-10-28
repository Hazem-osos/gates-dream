/**
 * Gates ERP — read-heavy load test (k6). Phase 0 baseline of the performance plan.
 *
 * NEVER point this at production. It refuses Railway production hosts on its own.
 * Use a staging copy with production-sized data (`npm run fixtures:prod-like`).
 *
 *   k6 run -e BASE_URL=https://<staging-host> -e USERNAME=<test user> -e PASSWORD=<test pass> \
 *          perf/k6/erp-read-mix.js
 *
 *   Optional: -e PEAK_VUS=1000 (default 500) -e ACCOUNT_ID=<uuid for the ledger step>
 *
 * Writes (posting invoices, vouchers) are deliberately not included: they need a CSRF
 * token and create real documents. Add them only against a disposable database.
 */
import http from 'k6/http';
import { check, group, sleep } from 'k6';

const BASE_URL = (__ENV.BASE_URL || 'http://localhost:3001').replace(/\/$/, '');
const PEAK_VUS = Number(__ENV.PEAK_VUS || 500);

if (/production|rlwy\.net|gates-backend-production|gates-web-production/i.test(BASE_URL)) {
  throw new Error(`Refusing to load-test a production host: ${BASE_URL}`);
}

export const options = {
  scenarios: {
    office_day: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: Math.round(PEAK_VUS * 0.2) },
        { duration: '5m', target: PEAK_VUS },
        { duration: '10m', target: PEAK_VUS },
        { duration: '2m', target: 0 },
      ],
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.005'],
    'http_req_duration{kind:list}': ['p(95)<500'],
    'http_req_duration{kind:lookup}': ['p(95)<300'],
    'http_req_duration{kind:report}': ['p(95)<5000'],
  },
};

export function setup() {
  const res = http.post(
    `${BASE_URL}/api/v1/auth/login`,
    JSON.stringify({ username: __ENV.USERNAME, password: __ENV.PASSWORD }),
    { headers: { 'Content-Type': 'application/json' } }
  );
  check(res, { 'login ok': (r) => r.status === 200 });
  const body = res.json();
  const token =
    (body && body.data && body.data.token && body.data.token.accessToken) ||
    (body && body.token && body.token.accessToken) ||
    (body && body.accessToken);
  if (!token) throw new Error(`Login failed (${res.status}): ${res.body}`);
  return { token };
}

function get(path, token, kind) {
  const res = http.get(`${BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}`, 'Accept-Encoding': 'br, gzip' },
    tags: { kind, name: path.split('?')[0] },
  });
  check(res, { [`${kind} 2xx/304`]: (r) => (r.status >= 200 && r.status < 300) || r.status === 304 });
  return res;
}

/** Real users read a screen, then act: 3–10 s between actions. */
function think() {
  sleep(3 + Math.random() * 7);
}

export default function (data) {
  const t = data.token;
  const roll = Math.random();

  if (roll < 0.35) {
    group('open invoice list', () => {
      get('/api/v1/invoices?page=1&limit=50', t, 'list');
    });
  } else if (roll < 0.6) {
    group('item picker search', () => {
      const q = ['a', 'م', 'ب', '1', 'ص'][Math.floor(Math.random() * 5)];
      get(`/api/v1/inventory/items?search=${encodeURIComponent(q)}&limit=30`, t, 'lookup');
    });
  } else if (roll < 0.75) {
    group('customer list', () => {
      get('/api/v1/accounting/customers?page=1&limit=50', t, 'list');
    });
  } else if (roll < 0.85) {
    group('journal entries', () => {
      get('/api/v1/accounting/journal-entries?page=1&limit=50', t, 'list');
    });
  } else if (roll < 0.95) {
    group('profile + branches', () => {
      get('/api/v1/users/me', t, 'lookup');
      get('/api/v1/company/branches', t, 'lookup');
    });
  } else {
    group('trial balance / ledger', () => {
      if (__ENV.ACCOUNT_ID) {
        get(`/api/v1/accounting/reports/account-statement?accountId=${__ENV.ACCOUNT_ID}`, t, 'report');
      } else {
        get('/api/v1/accounting/reports/trial-balance', t, 'report');
      }
    });
  }

  think();
}
