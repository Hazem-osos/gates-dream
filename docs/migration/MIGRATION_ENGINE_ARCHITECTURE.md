# Migration Engine Architecture

Aligns with existing `gates-backend/scripts/migration/*` and extends to production engine + admin UX.

**Phase 1 status:** Core implemented under `gates-backend/src/modules/migration-engine/` with CLI `npm run migration:engine`. Admin UI not started. See `PHASE1_IMPLEMENTATION_REPORT.md` and `MIGRATION_RUNBOOK.md`.

## Product principle (scope)

The migration engine is an **import/conversion tool**: legacy customer database → analyze/map/transform/validate → **canonical new Gates ERP schema** under an explicit `targetCompanyId`. Repeat per customer.

- The engine adapts **old data to the new ERP**.
- The **normal ERP runtime stays migration-agnostic** (no posting guards or legacy hooks in invoice/journal/treasury services).
- Migration metadata lives in `MigrationJob`, `MigrationIdMap`, `MigrationCheckpoint`, `MigrationIssue` — not scattered legacy columns on business models.
- Writers **do not replay** `PostInvoice` / `postJournalEntry` for bulk history; they materialize target rows directly (later phases).

---

## 1. Layers

```
┌─────────────────────────────────────────────────────────┐
│ Admin API / UI (future)                                  │
└───────────────────────────┬─────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────┐
│ Migration Orchestrator (job state machine)               │
│  MigrationJob · MigrationContext · MigrationStage        │
└───────────────────────────┬─────────────────────────────┘
                            │
     ┌──────────────────────┼──────────────────────┐
     │                      │                      │
┌────▼────┐  ┌──────────────▼──────────────┐  ┌───▼────┐
│ Legacy  │  │ Migration Core               │  │ Target │
│ Adapter │  │ Extract→Normalize→Map→     │  │ Writer │
│ (Gates  │  │ Transform→Validate→          │  │(Prisma)│
│  SQL)   │  │ Checkpoint→Report            │  │        │
└────┬────┘  └──────────────┬──────────────┘  └───┬────┘
     │                      │                      │
     └──────────────────────┼──────────────────────┘
                            │
                    ┌───────▼────────┐
                    │ Reconciler     │
                    │ (parity gate)  │
                    └────────────────┘
```

---

## 2. Core types (conceptual)

| Type | Purpose |
|------|---------|
| `MigrationJob` | id, state, targetCompanyId, legacyCompanyCode, startedAt, stats |
| `MigrationContext` | job + prisma + cache + extractor + options (`dryRun`, `phase`) |
| `MigrationStage` | FOUNDATION, PARTIES, INVENTORY_OPENING, GL, COMMERCIAL_READONLY, … |
| `MigrationEntityMap` | Persisted `MigrationIdMap` (sourceEntity, sourceId, targetEntity, targetId, jobId) |
| `MigrationError` | entity, legacy key, message, row snapshot hash |
| `MigrationWarning` | non-blocking (e.g. stale ItemStore used) |
| `MigrationCheckpoint` | stage, last cursor (table, pk), rowsProcessed |
| `MigrationReport` | dry-run or final JSON for sign-off |

---

## 3. Adapters

| Adapter | Responsibility |
|---------|----------------|
| **Legacy Gates SQL Server** | Table batch read, company filter, optional JSON fallback (`LegacyDataExtractor`) |
| **JSON dump** | Offline cutover dumps |
| **Future:** Excel, Odoo, other ERP | New adapter package; same core interfaces |

Legacy-specific transforms live in **adapter transformers** (`PrismaDataTransformer` today), not in orchestrator.

---

## 4. Source adapter interface

```ts
interface LegacySourceAdapter {
  connectReadOnly(): Promise<void>;
  iterateBatches(table: string, opts: ExtractOptions): AsyncIterable<Batch>;
  getTableList(): string[];
  analyze(): Promise<SourceAnalysisReport>; // dry-run inspection
}
```

---

## 5. Target writer

- Uses `runWithoutTenantScoping` + explicit `companyId` on every create.
- Batches: `createMany` where safe; per-document transactions for posting-shaped writes.
- **Never** call live posting services for historical import without `importMode` flag.

---

## 6. Dry run model

Dry run executes: connect → row counts → mapping resolution → transform in memory → validation rules → reconciliation **preview** (aggregates from source only + simulated targets).

**No Prisma writes** (`--dry-run` today).

### Report format (example)

```yaml
jobId: ...
targetCompanyId: ...
legacyCompanyCode: 0001
mode: DRY_RUN
entities:
  Customer:
    ready: 18420
    warnings: 12
    blocked: 2
  Item:
    ready: 31204
    warnings: 0
    blocked: 0
accounting:
  legacyTrialBalanceDebit: 1234567.89
  expectedNewDebit: 1234567.89
  difference: 0.00
inventory:
  legacyStockValue: ...
  expectedNewStockValue: ...
blockedReasons:
  - "2 customers missing AR account mapping"
```

---

## 7. Idempotency / resume

| Mechanism | Use |
|-----------|-----|
| Natural keys + Prisma `@@unique` | Upsert JE, invoice, account |
| `MigrationIdMap` | Surrogate IDs, cross-entity refs |
| `MigrationCheckpoint` | Resume `iterateBatches` cursor per table |
| Idempotency key | `migrationJobId` + `sourceEntity` + canonical legacy key |

Rerun same job id → skip or update same targets; new job id → must not duplicate if unique keys reused.

---

## 8. Rollback

| Phase | Rule |
|-------|------|
| PRE-CUTOVER | Delete all rows with `migrationJobId` (once column exists) OR delete entire target company (cascade) — **destructive** |
| POST-CUTOVER | No bulk delete; corrective journals — **OWNER** |

Until provenance column ships: rollback = delete company per runbook (only if company created for migration).

---

## 9. Performance

- Stream batches (default 500 rows).
- Keyset pagination on legacy PK columns when identified.
- Avoid loading full table into Node.
- Parallel read tables without FK order; write respects dependency graph.
- Transaction size: per batch or per document based on failure blast radius.

---

## 10. Observability

```
Migration Job #X — RUNNING — stage GL_LINES
JournalEntryLine  84000 / 192000  (437/s)  ETA 4m
Warnings: 12  Errors: 0  Current: GLTrxDetail batch 168
```

Structured logs: no credentials; sample row keys only.

---

## 11. Security

- Credentials in env / secret store; ephemeral preferred.
- Read-only legacy login.
- Admin-only API; no migration from tenant user session.

---

## 12. Admin UX state machine

`DRAFT` → `ANALYZING` → `READY_FOR_DRY_RUN` → `DRY_RUNNING` → (`BLOCKED` | `READY`) → `RUNNING` → (`PAUSED` | `FAILED`) → `RECONCILING` → `COMPLETED` | `ROLLED_BACK`

Screens: New Migration → Select Company → Configure Source → Test Connection → Analyze → Mapping review → Dry Run → Validation Report → Approve → Run → Reconcile → Complete.

---

## 13. Relation to current code

| Today | Future |
|-------|--------|
| CLI `migrate-legacy-data.ts` | Worker + job table |
| In-memory `LegacyIdCache` | Persisted `MigrationIdMap` |
| Phases A–D | `MigrationStage` enum |
| `recon:migration` | `Reconciler` service |

**Implement:** NOT in Phase 1.
