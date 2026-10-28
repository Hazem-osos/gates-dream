# Scaling the Gates backend (500–1000 concurrent users)

Status: prepared 2026-10-28, **not deployed**. Everything below is opt-in through
environment variables; with none of them set, a deploy behaves like today except
that the backend runs compiled JavaScript instead of `tsx`.

Deploy only through the release worktree (`.claude/rules/release-worktree.md`).

## What changed in code

| Change | Default | Switch |
|---|---|---|
| `npm run build` now also runs `scripts/build-dist.mjs` (esbuild → `dist/index.js`, `dist/workers/index.js`) | on | — |
| `scripts/railway-start.mjs` runs `node dist/…` when `dist/` exists, else `tsx` | compiled | `GATES_RUNTIME=tsx` forces tsx (rollback, no rebuild) |
| Cluster mode: N API processes in one container, one port, one volume | 1 process | `WEB_CONCURRENCY=N` (API only; workers ignore it) |
| DB pool size actually applied to Prisma | 20 in production | `DB_CONNECTION_LIMIT=N` per process |
| Rate limits counted in Redis across all processes | on when Redis is up | falls back to per-process if Redis is down |
| Password-reset links single-use across processes (Redis `SET NX`) | on when Redis is up | same fallback |
| MQTT subscriber and API cron run only in process 1 | — | — |

Measured locally (warm cache): compiled build ready in 2.7 s vs 3.8 s with tsx
(9.3 s cold); memory about the same (~400 MB per process).

## Why cluster mode and not Railway replicas (yet)

`gates-backend` has a Railway volume. Archive attachments, AI documents and
report files are written to local disk (`storage/`, `reports/`, `exports/`,
`var/migration-packages`). Railway replicas cannot share a volume, and a file
written by one replica would be missing on the others.

Cluster mode gets the same CPU benefit inside one container: every process sees
the same disk. To move to real replicas later:

1. Set `ARCHIVE_STORAGE_PROVIDER=s3|r2|minio` (provider already exists in
   `modules/archive/object-store/`) and copy existing files from the volume to the
   bucket — a data move that needs its own plan and approval.
2. Do the same for AI documents and report/export files (they are local-only today).
3. Remove the volume, then raise replicas.

## Recommended settings (owner applies in Railway)

Size `WEB_CONCURRENCY` to the vCPUs of the `gates-backend` service. Example for a
4 vCPU / 8 GB service:

| Service | Variable | Value | Why |
|---|---|---|---|
| gates-backend | `WEB_CONCURRENCY` | `4` | one process per vCPU |
| gates-backend | `DB_CONNECTION_LIMIT` | `20` | 4 × 20 = 80 connections |
| gates-backend | `GATES_SKIP_PRISMA_MIGRATE` | `1` | run migrations as their own approved step (`docs/deployment/MIGRATIONS.md`) |
| gates-workers | `DB_CONNECTION_LIMIT` | `10` | workers are one process |
| MySQL | start command flag | `--max_connections=200` | 80 + 10 + admin/migration headroom; default is 151 |

Connection budget rule: `WEB_CONCURRENCY × DB_CONNECTION_LIMIT + workers + 20 spare ≤ max_connections`.
The backend now logs `MySQL server connections above 80% of max_connections`
when the real total gets close.

Memory: about 400 MB per process at idle, so 4 processes need about 2 GB before load.
Each process is capped at `--max-old-space-size=1024`.

`gates-web` (Next.js) has no volume, so it can take 2 Railway replicas as-is. It proxies every
`/api/v1` call, so it needs capacity too.

## Rollout order

1. Deploy the release with no new variables. Check the log line `Runtime: node (compiled)`,
   then `/health/live` and `/health`.
2. Set `WEB_CONCURRENCY=2` and redeploy. Check for `Cluster: starting 2 API processes.`,
   the health endpoints, a login, and posting one invoice.
3. Raise to the vCPU count. Watch the connection warning and memory.
4. Run `perf/k6/erp-read-mix.js` against staging (never production) before and after.

## Rollback

- Compiled runtime misbehaves: set `GATES_RUNTIME=tsx` and redeploy (no rebuild needed).
- Cluster mode misbehaves: set `WEB_CONCURRENCY=1`.
- Neither step touches the database.
