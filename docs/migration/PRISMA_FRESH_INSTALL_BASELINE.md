# Prisma fresh-install baseline repair

## Problem

`20251119005824_create_all_tables` was timestamped **after** wave migrations such as
`20250816120000_wave0_m0_m1_platform_gl`, which alter core tables (`api_keys`, `branches`, …).
An empty MySQL database therefore failed `prisma migrate deploy` at wave0 with missing tables.

## Forward-compatible fix (local / new environments)

1. **`20250815120000_prisma_baseline_schema`** — same bootstrap as the historical
   `create_all_tables` script, with `CREATE TABLE IF NOT EXISTS` guards, ordered **before** wave0.
2. **`20251119005824_create_all_tables`** — no-op marker migration for history alignment on
   fresh installs that already received the baseline.

## Production / Railway (not modified in Phase 1.1)

Environments that **already applied** the original `20251119005824_create_all_tables` body have a
**checksum mismatch** if that file is edited. Before deploying this change to a long-lived DB,
follow Prisma’s [migration repair](https://www.prisma.io/docs/guides/migrate/production-troubleshooting)
procedure (update `_prisma_migrations.checksum` or mark the no-op as applied) — **only during a
planned maintenance window**, not as part of migration engine pilot work.

## Verify locally

```bash
node scripts/migration/pilot/create-fresh-mysql-db.mjs gates_migration_pilot_fresh
DATABASE_URL='mysql://…/gates_migration_pilot_fresh' npx prisma migrate deploy
```

Must reach `20261004140000_migration_engine_core` without errors.
