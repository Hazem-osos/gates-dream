# Gates ERP: performance baseline plan

Status: plan only, 27 September 2026. Nothing here has been run, and nothing in the application was changed to write it.

Purpose: measure the current system before any optimization, so every later change can be compared against real numbers. The findings in `ARCHITECTURE_AUDIT.md` are hypotheses until this baseline confirms or rejects them.

## Ground rules

- Measure against a **disposable copy** of the database (a restored production snapshot or a seeded dataset), never against production data for load or concurrency tests.
- Change one variable at a time. Record the git commit, dataset tier, environment size and date with every result.
- Prefer tools already in the repository before adding new ones. Anything new must be dev-only or behind a flag.
- Keep raw results (JSON or CSV) next to a short summary so later runs can be compared automatically.

---

## 1. Environment

| Item | Setting |
|---|---|
| Backend | same build as production (`gates-backend`), `NODE_ENV=production`, one API process, one worker process when queue work is measured |
| Frontend | production build of `gates-web` (`next build` + `next start`) |
| Database | MySQL 9.x, same major version as Railway; record CPU and memory of the database host |
| Redis | enabled, as in production |
| Network | measure API latency from the same region as the API (to isolate server time) and page loads through a throttled browser profile (to see what users feel) |
| Pool | record the effective Prisma pool size (see section 4.5); do not change it during the baseline |

Two environments are useful:

1. **Local or staging lab** with controlled dataset tiers (repeatable, safe for concurrency tests).
2. **Production observation** (read-only): request logs and metrics only, no load generation.

---

## 2. Dataset tiers

Build three company datasets on a disposable database. Start from the existing demo seed (`gates-backend/scripts/seed-hazem-demo-data.ts`, `src/modules/demo/hazem-demo-seed.service.ts`) and scale it with a generator script that posts documents through the real services (so caches, movements and journals are consistent).

| Tier | Journal lines | Invoices (lines) | Inventory movements | Items | Customers / suppliers | Accounts | Cost centers |
|---|---|---|---|---|---|---|---|
| Small | 10,000 | 1,000 (5,000) | 10,000 | 500 | 300 | 300 | 20 |
| Medium | 100,000 | 10,000 (50,000) | 100,000 | 3,000 | 2,000 | 1,200 | 100 |
| Large | 1,000,000 | 100,000 (500,000) | 1,000,000 | 20,000 | 15,000 | 3,000 | 500 |

Notes:

- The medium and large tiers deliberately exceed 1,000 accounts, items and parties, to test the list cap (audit M-01).
- Put at least one "hot" control account (cash or customers) that holds 20% of all lines, to exercise the ledger (audit H-05).
- Spread dates over three fiscal years so date-bounded and unbounded queries behave differently.
- Also record the real production sizes per company (counts only, read-only) so the tiers can be adjusted to reality.

---

## 3. Representative workflows

Each workflow gets a scripted API scenario (for server timings) and, where marked, a browser scenario (for user-perceived timings).

| # | Workflow | API calls to time | Browser scenario |
|---|---|---|---|
| W1 | Login and first screen | `POST /auth/login`, `GET /users/me`, accounting hub requests | yes |
| W2 | Open a new sales invoice | all master-data requests on page load (see `CURRENT_ARCHITECTURE.md` section 3.7) | yes |
| W3 | Save and post a sales invoice (10 lines) | `POST /invoices` or `/inventory/invoices`, `POST .../:id/post` | yes |
| W4 | Save and post a purchase invoice (10 lines) | create and post | no |
| W5 | Post a stock transfer (10 lines) | create, `POST /inventory/transfers/:id/post` | no |
| W6 | Create and post a receipt voucher | `POST /treasury/cash-transactions`, post | no |
| W7 | Edit a posted receipt voucher | `PATCH /treasury/cash-transactions/:id` | no |
| W8 | Trial balance, no filters | `GET /accounting/reports/trial-balance` | yes |
| W9 | Trial balance with cost center and currency filters | same with filters (live journal sum path) | no |
| W10 | Account ledger for the hot account, one year | `GET /accounting/reports/account-statement/:id` | yes |
| W11 | Cost-center ledger, one year | `GET /accounting/reports/cost-center-statement/:id` | no |
| W12 | Aged receivables | aging endpoint | no |
| W13 | Accounting dashboard | `/analytics/executive-kpis`, `/executive/overview`, `/analytics/aging`, journal list | yes |
| W14 | Chart of accounts | `GET /accounting/accounts/tree` | yes |
| W15 | Inventory: live stock and item movement report | inventory report endpoints | no |
| W16 | Monthly financial performance and cost-center profitability | `/accounting/reports/monthly-performance`, `/accounting/reports/cost-center-profitability` | yes |

---

## 4. Metrics

### 4.1 Per request (server)
- Latency p50, p95, p99 and max (from the load tool and from `pino-http` response time).
- Status code distribution, including 408 (timeout) and 409 (conflict).
- Response size in bytes.
- Number of database queries and total database time per request (section 5.1).
- Slowest query per request, with its SQL shape.

### 4.2 Per page (browser)
- Number of API requests on load, how many run in parallel versus after another finishes (waterfall depth), total bytes, time to interactive, and long tasks on the main thread (report filtering, large dropdowns).

### 4.3 Process
- CPU and memory (RSS, heap) of the API and worker processes.
- Event-loop delay (p99), sampled with Node's `perf_hooks.monitorEventLoopDelay`.
- Garbage collection pauses for large report responses.

### 4.4 Database
- Queries per second, slow queries (threshold 200 ms for the lab), rows examined versus rows returned.
- Lock waits and deadlocks (`SHOW ENGINE INNODB STATUS`, `performance_schema.data_lock_waits`).
- Buffer pool hit rate and temporary tables on disk for report queries.

### 4.5 Connections
- Effective Prisma pool size per process (Prisma metrics or count of connections per client host).
- `Threads_connected` and `Max_used_connections` during each test (the API already polls `Threads_connected` every 60 s in production).
- Pool wait time: requests waiting for a connection show up as long gaps before the first query.

### 4.6 Errors and throughput
- Error rate per workflow, including unmapped 500s (audit M-06).
- Maximum sustainable throughput (requests per second) at which p95 stays under an agreed target, per workflow.

---

## 5. Tooling

### 5.1 Query count and time per request
- The backend already binds each request to an AsyncLocalStorage context (`shared/database/tenant-context.ts`) and has a query monitor (`shared/database/query-monitor.ts`).
- The monitor listens to `prisma.$on('query')`, but the client is configured with plain string log levels, so query events are probably not emitted (audit M-12). For the lab, enable event-based query logging behind an environment flag (for example `log: [{ emit: 'event', level: 'query' }]`), and in the event handler add the duration to a per-request counter stored in the existing AsyncLocalStorage context. Log `queryCount` and `queryMs` with the request log line.
- Keep this flag off in production until log volume is understood.

### 5.2 Load and latency
- **autocannon** (Node, easy to script next to the backend) or **k6** (richer scenarios and thresholds). Either works; pick one and keep scenarios in version control.
- Use a real JWT for a test user in the lab company, plus the `X-Company-Id`, `X-Branch-Id`, `X-Fiscal-Year-Id` headers the frontend sends.
- Warm up for 30 s, then measure for 2 to 5 minutes per step; step concurrency 1, 5, 10, 25, 50.

### 5.3 Tracing
- OpenTelemetry is already wired (`shared/monitoring/tracing.ts`); enable with `ENABLE_TRACING=true` in the lab and send spans to a local collector (Jaeger or Grafana Tempo via docker-compose) to see where time goes inside a request.

### 5.4 Metrics
- The API exposes `/metrics` in Prometheus format from an in-memory collector. Scrape it with the sample `monitoring/prometheus.yml` in the lab; add a local Grafana only if dashboards are needed. Remember the collector is per process and resets on restart.

### 5.5 Database
- Enable `slow_query_log` with `long_query_time = 0.2` and `log_queries_not_using_indexes` in the lab.
- Use `performance_schema` (`events_statements_summary_by_digest`) to rank query shapes by total time.
- Capture `EXPLAIN ANALYZE` for the top 20 query shapes, especially the ledger, trial balance live sum, cost-center reports, aging and inventory reports.

### 5.6 Browser
- Playwright is already configured (`gates-web/playwright.config.ts`). Add baseline scenarios for W1, W2, W3, W8, W10, W13, W14, W16 with tracing on (`trace: 'on'`) to record request waterfalls, and use Chrome DevTools performance profiles for long tasks.
- Run once without throttling and once with a "fast 3G / 4x CPU slowdown" profile.

### 5.7 Production observation (read-only)
- Railway service metrics for CPU, memory and network per service.
- Request logs (`pino-http`): extract latency and status per route for a normal business week.
- Count 408 responses per route: they are the clearest sign of timeouts (audit M-02).

---

## 6. Concurrency tests

Run on the lab database only. Each test records outcomes, final balances and movement counts, and is repeated at least 20 times because races are probabilistic.

| # | Test | Expected today (from code reading) | What to record |
|---|---|---|---|
| C1 | Two parallel `POST /inventory/transfers/:id/post` for the same transfer, with source and destination on the same inventory account | both may succeed (audit H-01) | number of successes, `inventory_movements` rows for the transfer, warehouse quantities |
| C2 | Same as C1 for an inventory adjustment with zero value | both may succeed | same |
| C3 | Two parallel posts of the same sales invoice | one success, one "already posted" | outcomes, journal entries per invoice |
| C4 | Two parallel posts of the same receipt voucher | one success, one conflict (unique `activeSourceKey`) | outcomes, journal entries, safe balance |
| C5 | 50 parallel invoice creates in the same branch and fiscal year | unique, gap-free numbers | duplicates, gaps, P2002 or P2034 errors, latency |
| C6 | 20 parallel sales of the last units of one item (strict negative stock) | exactly the available quantity is sold | oversell count, errors |
| C7 | 10 parallel purchase receipts of the same item | correct moving average cost | final average versus a sequential replay |
| C8 | Posting load (10 users posting invoices) while one user runs W10 (hot account ledger) | posting latency rises, no errors | posting p95 with and without the report |
| C9 | Edit a posted receipt voucher while forcing the journal rewrite to fail | voucher changed, journal unchanged (audit H-03) | voucher, journal and safe balance consistency |

---

## 7. Procedure

1. Record production sizes per company (read-only counts) and adjust the tiers.
2. Build the small tier; run every workflow once to validate the scripts.
3. Run the full workflow set on each tier at concurrency 1 (pure latency), then the load steps for W3, W6, W8, W10, W13.
4. Run the concurrency tests C1 to C9 on the medium tier.
5. Capture database digests and `EXPLAIN ANALYZE` for the slowest shapes.
6. Run the browser scenarios on the medium tier.
7. Write a one-page summary: top 10 slowest routes by p95, top 10 query shapes by total time, pool and connection behavior, which audit findings were confirmed or rejected, and the concurrency test outcomes.
8. Freeze the scripts and dataset generator so every future change can be re-measured the same way.

---

## 8. Outputs

- `baseline/<date>/results/*.json` from the load tool, per workflow and tier.
- `baseline/<date>/db/` slow query log excerpts, digest rankings, query plans.
- `baseline/<date>/browser/` Playwright traces.
- `baseline/<date>/SUMMARY.md` with the tables above filled in and a list of audit findings marked confirmed, rejected or needs more data.

Suggested acceptance targets, to agree before optimizing (examples, not commitments): posting a 10-line invoice p95 under 1.5 s at 10 concurrent users on the medium tier; the hot-account one-year ledger p95 under 5 s on the medium tier; no 408 responses on any workflow at concurrency 1; zero duplicate postings in C1 to C4 after fixes.
