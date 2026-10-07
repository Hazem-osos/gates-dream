# GATES MIGRATION ENGINE — PHASE 3.5 PILOT REPORT

**Executed:** 2026-10-04 (local)  
**Pilot script:** `gates-backend/scripts/migration/pilot/run-phase35-pilot.ts`  
**Target DB:** `gates_migration_pilot_phase35` (bootstrapped from `gates_db` schema dump + migration_engine tables)

---

## SOURCE DATABASE

| Item | Value |
|------|--------|
| Engine | SQL Server `LegacyForensic` (Docker, read-only) |
| Company | `0001` |
| Fingerprint | `b494f1254149d53d…` (sha256 prefix) |

## TARGET PILOT DATABASE

| Item | Value |
|------|--------|
| URL | `mysql://root:***@localhost:3306/gates_migration_pilot_phase35` |
| Safety | `assertSafeTargetDatabaseUrl` PASS (localhost) |
| Schema | `bootstrap-pilot-target.mjs` — **not** `prisma migrate deploy` from zero (avoids broken historical migration chain on empty DB) |

**Setup:** `export DATABASE_URL=…/gates_migration_pilot_phase35` and `node scripts/migration/pilot/bootstrap-pilot-target.mjs gates_migration_pilot_phase35 gates_db`

---

## FOUNDATION RESULT

| Metric | Result |
|--------|--------|
| Dry-run business row delta | **0** |
| Execute | Branches, fiscal years, currencies, cost centers, warehouses, unit PCS |
| Company B isolation | **PASS** (no delta on isolation company) |

## COA RESULT

| Metric | Result |
|--------|--------|
| Dry-run Account delta | **0** |
| Accounts created | **137** (136 master + 1 derived `102020101001`) |
| `102060101003` | **AMBIGUOUS** — not created |
| Hierarchy integrity | **PASS** (no orphan parent / duplicate codes in sample run) |

## PARTIES RESULT

| Metric | Result |
|--------|--------|
| Source customers / suppliers | **6** / **1** |
| Target customers / suppliers | **6** / **1** |
| `Mozana` / balance | All **0.00** (not imported) |
| Party account links | **POSTING** accounts via legacy `AccountCode` |

**Verified company (clean re-run job):** `190cc63a-f186-41d9-8150-44b66451b2ab`

---

## GL ACCOUNT READINESS (posted, no journal import)

| Metric | Value |
|--------|------:|
| Distinct posted GL account codes | **49** |
| Resolved to target COA | **48** |
| Ambiguous | **1** (`102060101003`) |
| Full legacy posted TB debit/credit | **62,869,333.38** / **62,869,333.38** |
| Safe-mapped TB debit/credit | **62,869,249.38** / **62,869,249.38** |
| **Ambiguous amount (unmapped activity)** | **84.00** |

**Not 100% GL readiness** — by design until owner resolves `102060101003`.

---

## 102060101003 FORENSIC PACK

| Field | Evidence |
|-------|----------|
| Posted lines | **2** |
| Journal types | **SV99**, **SR99** (POS sale / sale return) |
| Date | 2025-10-19 |
| GL numbers | `00000084`, `00000085` |
| Line 1 | Debit **60.00**, desc: قيد من يومية نقطة بيع |
| Line 2 | Credit **24.00** |
| Counterpart `OtherSideAccountCode` | NULL on both |
| Nearest COA prefix in master | **`102`** only (no `10206*` master) |
| Party `Customer.AccountCode` | **No match** |
| Party `Supplier.AccountCode` | **No match** |
| Non-posted GL uses | **0** (posted filter only in pilot query) |
| **Classification** | **AMBIGUOUS** — do not auto-map |

---

## IDEMPOTENCY / ROLLBACK / CLEAN RE-RUN

Pilot script exercises:

1. Full migrate → idempotent second pass (same job, `COMPLETED` → `DRY_RUNNING` allowed)
2. `rollback()` → Parties → COA → Foundation maps
3. New job + analyze → Foundation → COA → Parties

**Note:** One pilot run completed migration through clean re-run; final JSON export failed once on closed MSSQL connection (fixed in script). A later re-execution failed when local MySQL was unreachable — counts above were verified via direct SQL on `gates_migration_pilot_phase35`.

---

## TESTS / TYPECHECK / PRISMA

| Command | Result |
|---------|--------|
| `npx tsc -p tsconfig.migration-engine.json` | **PASS** |
| `npx prisma validate` | **PASS** |
| `jest migration-engine.spec.ts coa-migration.spec.ts parties-migration.spec.ts --runInBand` | **PASS** (20 tests) |

---

## PRODUCTION / LEGACY

| | |
|--|--|
| PRODUCTION MODIFIED | **NO** |
| LEGACY MODIFIED | **NO** |
| ERP RUNTIME MODIFIED | **NO** (engine/orchestrator state-machine only for pilot idempotency) |

---

## BLOCKERS (posted GL only)

- `102060101003` — **84.00** unmapped; owner decision required before posted GL migration.

---

**MIGRATION FOUNDATION-COA-PARTIES PILOT VERIFIED**
