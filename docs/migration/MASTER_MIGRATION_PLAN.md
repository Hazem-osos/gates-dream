# Master Migration Plan

Canonical execution plan for Legacy Gates SQL Server → New Gates ERP (MySQL/Prisma).

---

## Phase 0 — Discovery (schema)

| Item | Status |
|------|--------|
| Legacy artifact inventory | Done (`erp/`) |
| Legacy catalog + business logic | Done (schema-level) |
| New catalog + tenant rules | Done |
| Mapping + dependency graph | Done (42 mapped; 527 deferred) |
| Accounting/inventory/history specs | Done (theoretical) |

## Phase 0.5 — Real DB forensic audit

| Item | Status |
|------|--------|
| Restore Agro2 backup | **Done** (`LegacyForensic`, READ_ONLY) |
| Metadata / counts / TB / quality | **Done** — see `LEGACY_*` docs + `audit-out/` |
| Procedure bodies | **Done** — `audit-out/proc_*.sql` |
| Reconciliation baseline | **PASS** (TB); inventory **PARTIAL** (no ItemStore) |

**Caveat:** This evidence is from a **small single-company** training DB (~32k rows), not a large production tenant. Re-run `run-forensic-sqlcmd.sh` on production BACPAC before cutover.

**Phase 1 (engine framework)** may start; **production cutover** still requires production audit + 4 owner decisions.

---

## Phase 1 — Core framework

| Scope | Work | Tests | Acceptance | Risk |
|-------|------|-------|------------|------|
| `MigrationJob` table + states | **Done** — `20261004140000_migration_engine_core` | Unit (partial) | Create job without business writes | Low |
| Persisted `MigrationIdMap` | **Done** | Unit (partial) | Resume mapping | Medium |
| `MigrationContext` enforcement | **Done** | Unit | Missing company fails | High if wrong |
| Checkpoint + resume | **Done** (per entity cursor) | Integration pending | Kill and resume | Medium |
| Dry-run = real pipeline | **Done** (`written: 0` on business tables) | Unit (partial) | Pilot dry-run on Agro2 | Medium |
| FOUNDATION stage pilot | **Done** (branch, FY, currency, CC, warehouse, unit) | E2E pending | Idempotent 2nd run | Medium |
| COA stage (`COA`) | **Done** | Unit + pilot | Dry-run Account Δ=0; GL readiness report | High for posted GL |
| Account resolver (legacy) | Superseded by COA classifier | Unit | Posted GL-only = 2 on Forensic | — |

**Depends:** Phase 0 sign-off.  
**Runbook:** `MIGRATION_RUNBOOK.md`. **Report:** `PHASE1_IMPLEMENTATION_REPORT.md`.

**Principle:** Engine imports legacy data into the canonical new ERP schema per `targetCompanyId`. Normal ERP services stay migration-agnostic; complexity stays in `migration-engine/`.

---

## Phase 2 — Chart of accounts (COA)

| Scope | Legacy `Account` + deterministic GL-only leaves; GL readiness + TB mapping preview |
| Work | `stages/coa.stage.ts`, `COA_MIGRATION_SPEC.md` |
| Tests | `coa-migration.spec.ts` + forensic integration |
| Acceptance | Masters idempotent; every posted GL code resolved or explicitly blocked |
| Risk | High (GL blocker: ambiguous POS code on Forensic) |
| Report | `PHASE2_COA_REPORT.md` |

---

## Phase 3 — Customer / Supplier parties

| Scope | `Customer`, `Supplier`, categories; COA-linked `mainAccountId` |
| Work | `stages/parties.stage.ts`, `PARTIES_MIGRATION_SPEC.md` |
| Tests | `parties-migration.spec.ts` |
| Acceptance | Dry-run Δ=0; idempotent maps; no balance import from `Mozana` |
| Report | `PHASE3_PARTIES_REPORT.md` |

## Phase 4 — Parties & inventory masters (renumbered)

| Scope | Customer, supplier, warehouse, item, units, price lists (optional) |
| Work | SPLIT account creation; branch on warehouse |
| Acceptance | FK integrity; no orphan mainAccount |
| Risk | AR/AP account mapping |

---

## Phase 4 — Opening inventory & cost

| Scope | `ItemsFirstTime*`, cutover snapshot, `ItemCostHistory` |
| Work | Align Phase B with `OpeningStock` service — **single path** |
| Acceptance | Stock recon harness PASS |
| Risk | **HIGH** — duplicate opening |

---

## Phase 5 — Accounting history

| Scope | `GLTrxHeader/Detail` |
| Work | Phase C hardening; branch adopt; unposted policy |
| Acceptance | TB recon PASS all years |
| Risk | **HIGH** |

---

## Phase 6 — Commercial read-only

| Scope | Invoices (+ lines), optional store docs |
| Work | Import without orchestrator; lock unpost |
| Acceptance | No TB drift; UI search works |
| Risk | **HIGH** if posting not guarded |

---

## Phase 7 — Treasury & cheques

| Scope | `CashTrx*`, `CKTrx*` |
| Work | Phase D |
| Acceptance | Cash GL accounts match |
| Risk | HIGH |

---

## Phase 8 — Validation & reconciliation

| Scope | `recon:migration` + SQL audit pack on legacy |
| Work | Per-year windows; AR/AP spot checks |
| Acceptance | PASS with tolerance 0.01 |
| Risk | Low |

---

## Phase 9 — Admin UI

| Scope | Job wizard per architecture doc |
| Work | Internal admin module |
| Acceptance | Operator can dry-run without CLI |
| Risk | Medium |

---

## Phase 10 — Pilot migration

| Scope | **One** real legacy company |
| Work | Restore BACPAC; freeze legacy; run phases 2–8 |
| Acceptance | Signed recon JSON + smoke `test:waves` |
| Risk | **HIGH**

---

## Phase 11 — Production hardening

| Scope | Performance, parallel jobs, rollback drills, observability |
| Acceptance | Million-row customer dry-run completes |
| Risk | Medium |

---

## Minimum safe first migration scope

**Include:**

- Target company + branches + open fiscal year(s) needed for reporting
- Currencies (base + used codes)
- Full COA + cost centers
- Customers & suppliers with AR/AP accounts
- Items, units, warehouses
- Opening stock snapshot at cutover (opening stock document + movements)
- **All posted GL** history (or opening-only GL if owner chooses OPENING_ONLY — not recommended for “usable finance”)
- Reconciliation PASS

**Deliberately wait:**

- HR/payroll (149 tables)
- Schools, real estate, cars, manufacturing depth
- Live user password migration
- Full invoice operational posting / treasury unless Phase 7 complete
- E-invoicing replay

---

## First implementation phase after discovery

**Phase 1 — Core framework** (job provenance, persisted id map, checkpoint, dry-run report, strict `MigrationContext`).

**Parallel prerequisite:** Restore `DataBase21-5-2026.bak` (or pilot BACPAC) for quality SQL + owner decisions.

---

## Implementation phase count

**12** phases (0–11).
