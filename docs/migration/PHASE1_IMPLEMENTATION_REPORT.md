# Phase 1 Implementation Report

**Scope:** Migration engine core + FOUNDATION pilot (not COA/GL/invoices/inventory).

## Architecture correction (2026-10-04)

- **Removed** Phase 1.1 wiring of `MigrationProvenanceService` into invoice/journal/treasury post/unpost — not required for importing foundation masters; ERP runtime remains migration-agnostic.
- **Kept** provenance/id map inside `src/modules/migration-engine/` for job isolation, rollback, and future historical import stages.
- **Added** `source-profile.ts` for capability detection (ItemStore row counts, GL/inventory table presence) without hardcoding Agro2.

## Delivered

- Prisma: `MigrationJob`, `MigrationIdMap`, `MigrationCheckpoint`, `MigrationIssue` (`20261004140000_migration_engine_core`).
- Module: orchestrator, state machine, adapter, FOUNDATION stage, CLI, target safety, rollback, checkpoint/id map.
- Legacy script guard: Phase B ItemStore blocked when `MIGRATION_ENGINE_ENABLED=true`.

## Operational proof (Phase 1 completion) — 2026-10-04 local

| Gate | Status |
|------|--------|
| Disposable target | **PASS** — `bootstrap-pilot-target.mjs` (schema clone from `gates_db` + engine tables SQL) |
| LegacyForensic live pilot | **PASS** — `npm run migration:pilot:run` (dry-run business delta 0, idempotency 0, Company B delta 0, rollback 14 entities) |
| Fresh `prisma migrate deploy` from empty | **PRE-EXISTING REPOSITORY DEBT** — see `PRISMA_FRESH_INSTALL_BASELINE.md` |
| Migration module `tsc -p tsconfig.migration-engine.json` | **PASS** |
| Integration tests (with `LEGACY_FORENSIC_URL` + pilot DB) | **4/4** + unit **9/9** |

## Phase 2 (not started)

COA, posted GL reconciliation, parties, items, movements-derived inventory, read-only commercial history — all via engine writers, not ERP posting replay.
