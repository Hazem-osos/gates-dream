# Migration Engine Runbook (Phase 1 — local only)

**Do not** run against Railway/production MySQL or customer live SQL Server.

## Prerequisites

1. **Legacy source (read-only):** `LegacyForensic` on local SQL Server (see `scripts/migration/legacy-local-restore/`).
2. **Target:** disposable local MySQL (`DATABASE_URL` must be localhost / `127.0.0.1` / `*.local`).
3. **Enable engine:** `export MIGRATION_ENGINE_ENABLED=true`
4. **Legacy URL:** `export LEGACY_FORENSIC_URL='Server=127.0.0.1,14333;Database=LegacyForensic;User Id=sa;Password=...;Encrypt=false;TrustServerCertificate=true'`
5. **Schema:** apply `prisma/migrations/20261004140000_migration_engine_core` on local DB (or `prisma migrate deploy` after resolving any failed prior migrations).
6. **Optional:** `npm install mssql --ignore-engines` (Node 23 may require `--ignore-engines`).

## Disposable target company

Create or pick a **local-only** `Company` row. Phase 1 binds legacy `CompanyCode=0001` via `legacyCompanyCode` on that company (no auto-create of company).

## CLI (`gates-backend`)

```bash
cd gates-backend
export MIGRATION_ENGINE_ENABLED=true
export LEGACY_FORENSIC_URL='...'
export DATABASE_URL='mysql://...@127.0.0.1:3306/gates_dev'

npm run migration:engine -- create-job <targetCompanyId> 0001
npm run migration:engine -- analyze <jobId>
npm run migration:engine -- dry-run <jobId>
npm run migration:engine -- run-foundation <jobId>    # only if dry-run has zero BLOCKER issues
npm run migration:engine -- run-foundation <jobId>    # second run — idempotency check
npm run migration:engine -- rollback <jobId>

# Full foundation pilot (analyze → dry-run → import ×2 → rollback + company B isolation)
export MIGRATION_ENGINE_ENABLED=true
export LEGACY_FORENSIC_URL='Server=127.0.0.1,14333;Database=LegacyForensic;...'
npm run migration:pilot:run
```

## Dry-run semantics

- Runs the same extract → transform → validate path as execute.
- **Business tables:** zero writes (`written: 0` in stage report).
- **Migration metadata:** checkpoints may update; issues recorded during `analyze`.
- **Id maps:** not written during dry-run (simulation counts only).

## Safety guards

| Guard | Behavior |
|-------|----------|
| `MIGRATION_ENGINE_ENABLED` | Must be `true` or engine refuses |
| `assertSafeTargetDatabaseUrl` | Blocks Railway hosts and non-local URLs |
| `blockLegacyPhaseBItemStore` | Legacy Phase B refuses when engine enabled (ItemStore not stock truth) |
| Source fingerprint | Job stores fingerprint at create; mismatch should stop resume (orchestrator validates on run) |
| Job lock | Second concurrent `run-foundation` rejected |

## Reconciliation baseline (Agro2 pilot)

Stored on job `reconciliationBaseline` JSON at create (not global):

- Posted journals: 229  
- Base debit/credit: 62,869,333.38  
- Difference: 0.00  

Used in future GL stage; not asserted in FOUNDATION-only pilot.

## Rollback

`rollback` deletes only rows recorded in `migration_id_maps` with `CREATED_BY_MIGRATION` for that job (foundation entities). Never `DELETE WHERE companyId = X`.

## Legacy scripts

`npm run migrate:legacy` remains for fixtures/offline JSON. With `MIGRATION_ENGINE_ENABLED=true`, target URL is still guarded; prefer `migration:engine` for cutover-shaped work.
