# Local end-to-end results — 2026-10-27 / 28

**Scope.** These runs test the **legacy migration engine** (connect → analyze → preview →
dry-run → import → reconcile → re-import → rollback). They do **not** test replaying the app's
historical Prisma migrations: the target schema was built directly from the current
`schema.prisma` (see "Target database"). No production, staging, Railway service or customer
data was used. All data is synthetic.

## Result

Every step ran through the real HTTP API — the same calls the wizard makes, including the
import button (`POST /jobs/:id/run {"mode":"import"}`).

| Step | Result |
|---|---|
| Connect (remote SQL, `db_datareader` login) | PASS |
| Analyze + pre-import checklist | PASS — `READY_FOR_DRY_RUN`, 0 findings on clean data |
| Dry-run (10 stages) | PASS — `READY`, 0 rows written |
| Import | PASS — `COMPLETED` |
| Reconcile | PASS — `COMPLETED / RECONCILED`, `materialPass: true`, 0 blocking reasons |
| Independent source-vs-target check | **16 / 16 checks match** |
| Import run a second time | PASS — row counts in 13 tables unchanged, 16/16 still match |
| Rollback | PASS — every migrated row removed, target back to its pre-import state |

### Independent check (does not use the engine)

`verify.mjs` reads the legacy SQL Server and the target MySQL directly:

| Area | Check |
|---|---|
| GL | posted journals per branch and year; debit and credit per account (49 accounts) |
| Ledger caches | `account_period_balances` per account; each customer / supplier ledger balance (base) vs the legacy balance of its account |
| Parties | every customer and supplier with name and account |
| Items | every item (incl. a deleted one) |
| Invoices | status, net, line count and party of every invoice (posted, draft, cancelled); paid amount; journal link of every posted invoice |
| Cash | amount and line count of every cash / bank voucher |
| Settlement | allocation sum and count per invoice |
| Cheques | count by direction, amount total |
| Inventory | on-hand per item × warehouse vs legacy `ItemStore`; movement-ledger sum vs the same |

### Synthetic legacy database

Built from the real column lists in `erp/erp_schema.txt`, following the conventions in
`erp/SQL_SERVER_ERP_GUIDE.md` (`ItemType` C/D, base unit in `UnitCode2`/`Qty2`, etc.):

- 2 branches, 2 fiscal years (2025 closed, 2026 open), EGP + USD
- chart of accounts with one leaf per party; a variant leaves 7 party leaves **out** of the
  `Account` master (`PARTY_LEAF_IN_MASTER=0`)
- 30 customers, 10 suppliers, 13 items (incl. one deleted) with piece and box units
- 389 posted journals (+ unposted / deleted ones that must not move)
- 56 invoices: purchases, sales, sales returns, purchase returns, one draft, one cancelled,
  one USD sale; numbers deliberately repeat across branches, years and types
- 22 cash / bank vouchers with 22 invoice allocations (incl. two identical lines on one voucher,
  receipts and bank receipts with the same number, one USD receipt, one on-account receipt)
- 4 inward + 2 outward cheques (one paper number used by two banks)
- stock transfers, a stocktake with its adjustment

A **dirty** variant (`DIRTY=1`) adds an unbalanced journal, orphan lines, an invoice for an
unknown item, an undefined unit, an unknown store, a posted invoice without a journal, an
allocation to a missing invoice, a zero cheque and a supplier sharing a customer's account.
Analyze reports each one and the job stops at `BLOCKED`.

## Fixed in the migration engine

### Round 1 (journals)
1. Keyset paging skipped / repeated vouchers, invoices, cash vouchers, cheques, allocations and
   settings (`services/legacy-keyset-cursor.ts`).
2. The SQL Server adapter could read another job's legacy database (shared global pool).
3. Every job carried the pilot customer's baseline numbers.
4. Preview endpoints returned 500.
5. The pilot's owner-approved account override was applied to every customer.
6. `.bak` restore assessment crashed on missing imports.

### Round 2 (all documents, 100% match)
7. **Import button blocked by the shared input filter** (it rejects the word `execute`). The
   wizard now sends `import`; the API maps it to the internal mode. The filter is unchanged.
8. **Dry-run blocked the import.** Later stages could not see what earlier dry-run stages would
   create (journals, items, accounts) and reported them missing. Dry-run now keeps an
   in-memory plan of planned mappings (`MigrationIdMapService.planMapping`); nothing is written.
9. **Invoices overwrote each other.** Target invoice numbers collided across branches and across
   legacy types sharing one target type (SI01 #1 vs SR01 #1). Numbers stay as in legacy unless
   they collide; then the type is prefixed (`SR01-1`) — `commercial/invoice-number-plan.ts`.
10. **Invoice import crashed on real schemas** — it sorted lines by a `LineNum` column that does
    not exist in `InvoiceTrxDetail`.
11. **Invoices had no customer / supplier.** Legacy stores the party's *account* in
    `SupplierAccountCode`; the engine looked it up as a party *code*, and set both customer and
    supplier. Now resolved by account or code, sales → customer, purchases → supplier
    (`services/migration-party-ref.service.ts`). Same fix for cash vouchers and cheques (an
    outward cheque to supplier 2 was linked to customer 2).
12. **Invoice lines took a random unit.** The unit lookup used a mapping key nothing writes, so
    every line fell back to the item's first unit (boxes recorded as pieces). Lines now use their
    own legacy unit; the priced unit is chosen by which quantity × price gives the line total
    (`commercial/invoice-line-units.ts`).
13. **Draft and cancelled invoices had no lines.** Both paths now share one line importer.
14. **A crash mid-invoice left it half-imported for good** (the header was mapped before its
    lines). The mapping is now written after the lines.
15. **Cash vouchers overwrote each other** (KR01 #1 and BR01 #1 are both receipts). Matching now
    includes branch and journal.
16. **Two identical allocation lines were merged into one**, and reconciliation then called them
    duplicates. Each source line owns its own allocation.
17. **Cheques overwrote each other** when two banks used the same paper number. Collisions are
    qualified with branch/year/voucher (`treasury/cheque-number-plan.ts`).
18. **No items were imported** unless `ItemType = 'D'`; deleted items were dropped although
    history uses them. Every non-group item is now imported (deleted ones inactive).
19. **Sales of type SI01/SI02 never reduced stock** (stock direction knew only SV01/SV03/SV99).
20. **Stocktake applied twice** — the count (`StoreCheck`) and its adjustment (`StoreAdjust`,
    same `StoreCheckCode`) were both applied. The adjustment wins.
21. **Customers whose leaf account is missing from the legacy chart were skipped.** The party
    stage now creates the leaf under its mapped header (never guesses)
    (`services/migration-party-account-provision.service.ts`).
22. **Unknown purchase-return types (PR03…) were imported as purchases.**
23. **Migrated journal lines carried no customer / supplier**, so party statements and balances
    showed nothing. Lines on a party's own account are now tagged.
24. **Ledger caches were never updated** — trial-balance summaries, partner balances and party
    cards ignored the migrated history. After import they are rebuilt from the GL
    (`services/migration-ledger-cache.service.ts`); rollback rebuilds them too.
25. **A running import could not stop as BLOCKED** (it failed instead); **rollback could not
    finish** (`FAILED → ROLLED_BACK` was not allowed) and **ran inside the 30 s HTTP limit**. It
    now runs in the background and records its outcome on the job.
26. The `quarantined` counter counted journals that were later imported.

27. **Next-number counters for store documents were never synced** — the sync read columns that
    do not exist (`StoreTransNum`, `StoreCollNum`; legacy uses `StoreTransCode`, `StoreCollCode`)
    and swallowed the error. Any non-numeric legacy number also aborted a family's sync. Fixed,
    with a warning issue instead of silence (`migration-document-sequence-sync.service.ts`).

Windows connector and `.bak` restore: see `gates-migration-connector/SETUP_AND_TROUBLESHOOTING.md`.

### New safeguards
- **Pre-import checklist** at Analyze (`services/migration-preflight.service.ts`): one pass over
  the legacy data, grouped in Arabic as *must add* (items, units, stores, parties), *must fix*
  (unbalanced journals, posted documents without a journal, allocations to missing invoices,
  unknown document types, shared party accounts) and *can ignore* (orphan lines, zero cheques).
  Shown in the wizard; blocking findings stop the job until fixed.
- **Completeness in reconciliation** (`services/migration-completeness.service.ts`): source rows
  vs migrated rows for parties, journals, invoices, invoice lines, cash vouchers, allocations and
  cheques. Any missing row blocks activation. Also blocking now: party balances that differ from
  the legacy account, stock lines with an unmigrated item / warehouse or an invoice type with no
  stock direction.

Tests: `migration-keyset-paging.integration.spec.ts` (real SQL Server),
`migration-report-query-schema.spec.ts`, `legacy-account-override-relevance.spec.ts`,
`migration-run-mode-schema.spec.ts`, `migration-document-identity.spec.ts`.

## Found outside the migration engine (not changed)

- **`rebuildCompanyBalances` crashed** (`accounting/services/ledger-balance.service.ts`, period
  sort): MySQL returns `YEAR()`/`MONTH()` as BigInt and the sort threw *"Cannot convert a BigInt
  value to a number"*, so the trial balance's cache rebuild failed in the ERP itself. **Fixed
  2026-10-28 with owner approval** (period keys converted to numbers before sorting; regression
  test `src/__tests__/unit/ledger-balance-rebuild-bigint.spec.ts`). The migration uses the shared
  function again.
- **Fresh databases cannot be built from migration history** (an Aug-2025 migration alters
  `api_keys` before it exists; `ApiConnection.accessToken` TEXT default rejected by MySQL).
- **The `gates-migration-staging` Railway project was deleted** on 2026-10-27 13:39 UTC.

## Re-running

The harness lives in `gates-backend/scripts/migration/synthetic-e2e/` (see its README):
`bash prepare.sh && bash full-run.sh`. Last run 2026-10-28: 16/16, idempotent, `COMPLETED`.

## Environment (all local, all disposable)

- Legacy source: SQL Server 2022 in Docker (`gates_mig_synthetic_mssql`, `127.0.0.1:14333`).
- Target: MySQL 9 (`gates_local_dev_mysql`, `127.0.0.1:3307`), database `gates_mig_e2e`,
  recreated for each run and seeded with the demo company.
- Backend: local `tsx src/index.ts` with `MIGRATION_ENGINE_ENABLED=true`,
  `MIGRATION_RUN_INLINE=true`, `REDIS_ENABLED=false`, `MIGRATION_ALLOW_PRODUCTION_TARGET=false`,
  `MIGRATION_CUSTOMER_EXECUTE_ENABLED=true` (only because the target is disposable).

### Target database

`prisma migrate deploy` cannot build an empty database (see above). The schema SQL was
generated with `prisma migrate diff --from-empty --to-schema-datamodel`, the one TEXT default
was rewritten to `DEFAULT ('')` in a scratch copy, and applied to the fresh local database. No
migration or model was changed.

## Not tested

The Windows connector (agent) path, `.bak` upload / restore, pause / resume mid-stage, real
customer data, and large volumes (the synthetic set is ~400 journals; per-row lookups mean a
100k-journal database will take on the order of an hour).

---

## Release readiness review — 2026-10-28

**Recommendation: NO-GO** for a customer import on production. Fit for further rehearsal on a
disposable database.

**Verification run 2026-10-28 (owner-approved, local disposable databases only):**
- Migration-engine unit specs: 238 / 239 pass. The one failure
  (`contracting-party-reconciliation.spec.ts`) needs a `subcontractors` table in the local test
  database and is unrelated. `accounting-migration.spec.ts` got branch / year mappings in its mock
  (the foundation stage always provides them; fix 29 now requires them); assertions unchanged.
- Backend typecheck: 209 errors, same as before, none in the migration engine.
- Clean synthetic rehearsal through the HTTP API: analyze → dry-run → import → reconcile
  (`materialPass`, 0 blockers) → **16 / 16** independent checks → re-import (13 table counts
  unchanged, 16 / 16) → rollback (all migrated rows removed, `itemsNeedingCostRepair: []`).
**Second run 2026-10-28 (owner-approved, local disposable databases only):**
- Dirty rehearsal, three variants of the synthetic source:
  - **A** (`DIRTY=1` + a posted `PO01` invoice): BLOCKED at Analyze, `INVOICE_UNKNOWN_TYPE` PO01
    plus the other expected `DIRTY=1` findings (fix 31).
  - **B** (posted journal in unknown branch `99`): Analyze and dry-run pass; import stops at the
    accounting stage with `JOURNAL_BRANCH_UNMAPPED` (2026|99|00000001), job **BLOCKED**, 0 journals
    written without branch / year (fix 29). The first attempt exposed fix 33 below.
  - **C** (cash voucher KR01 #50 with an "other detail" line on unmapped account 9999999): import
    stops at the treasury stage with `CASH_LINE_ACCOUNT_UNMAPPED` (2026|01|KR01|50|1), job
    **BLOCKED** (fix 28).
- Clean rehearsal repeated after fix 33: 16 / 16, re-import idempotent, 16 / 16; rollback back to the
  empty state (389 journals, 109 movements, 56 invoices, … removed; `itemsNeedingCostRepair: []`).
- Regression tests: new `src/__tests__/unit/migration-readiness-fixes.spec.ts` (fixes 27, 30, 31)
  and two cases in `accounting-migration.spec.ts` (fix 29 / 33: unmapped branch and unmapped year
  each give a BLOCKER, nothing written, `report.blockers = 1`). Both specs 32 / 32 green.
  Typecheck still 209 errors, none in changed files.
- **Not exercised end-to-end:** fix 27's pre-existing-stock case. It is covered by the unit test
  only (mocked Prisma); the synthetic target has no stock before import.
- **Gap found:** Analyze and dry-run do not detect posted journals in a branch / year the
  foundation stage does not migrate. Only import catches it (run B), after foundation, chart of
  accounts and parties are already written. The job stops safely and can be rolled back, but the
  finding belongs in the Analyze checklist. **Closed by fix 34**, confirmed on the synthetic SQL
  Server (third run below).

**Third run 2026-10-28 (owner-approved, local disposable databases only):** the harness was
rebuilt after its temp folder was wiped (replayed from the session transcript; same synthetic
data — 392 vouchers, debit = credit 803,257.50), and the target was rebuilt from the current
schema (398 tables).
- Clean rehearsal: Analyze raises no fix-34 finding; reconcile `materialPass`, 0 blockers,
  trial-balance difference 0.00; **16 / 16**; re-import idempotent, 16 / 16.
- Dirty run B at Analyze only: job **BLOCKED** at Analyze with one finding,
  `GL_BRANCH_OR_YEAR_NOT_MIGRATED` `2026|99 (1 قيد، ناقص: فرع)`; 0 journals written.
- First attempt failed on infrastructure, not on the engine: the local MySQL container was
  OOM-killed (Docker has 4 GB shared with SQL Server). Restarted, then both runs passed.

### Fixed in this round
27. **Rollback wiped stock caches of pre-existing items.** `rollbackInventory` deleted every
    `item_warehouse_balances` and `item_cost_history` row of each touched item, including items
    that had stock before the import. It now rebuilds on-hand from the remaining movements and
    deletes caches only for items left with no movements. Items that keep other movements are
    returned as `itemsNeedingCostRepair`: run the standard cost repair for them
    (`services/migration-rollback.service.ts`).
28. **Cash "other detail" lines with an unmapped account were dropped silently.** Now a
    `CASH_LINE_ACCOUNT_UNMAPPED` BLOCKER, the same as the main detail lines
    (`stages/treasury-historical.stage.ts`).
29. **Posted journals could be imported with no branch / fiscal year** when either was not
    migrated. Now a `JOURNAL_BRANCH_UNMAPPED` / `JOURNAL_YEAR_UNMAPPED` BLOCKER
    (`stages/accounting.stage.ts`). Dry-run does not detect this; import stops on it.
30. **The live app's own database host was not recognised as production.** `mysql.railway.internal`
    matched none of the production patterns; only the `NODE_ENV=production` fallback blocked it.
    Added `railway.internal` (`target-safety.ts`).
31. **Unknown invoice types were guessed.** `mapLegacyInvoiceKind` treated any type starting with
    `P` as a purchase and any starting with `S` as a sale, so e.g. `PO01` / `SO01` would import
    as invoices. Only the SI / SV / PI / SR / PR families are accepted now; everything else is
    `UNKNOWN_INVOICE_TYPE` at Analyze and BLOCKED at import
    (`transforms/commercial-document-transform.ts`).
33. **The accounting stage always reported 0 blockers**, so a job with an open accounting BLOCKER
    ended COMPLETED and the next run failed with "cannot run items in status COMPLETED". The stage
    now returns `countOpenBlockers` like the treasury stage, and the job ends BLOCKED
    (`stages/accounting.stage.ts`). Clean jobs are unaffected: the only other accounting issue
    (`REVERSAL_LINKS_UNAVAILABLE`) is INFO.
34. **Analyze now reports posted journals whose branch or fiscal year will not be migrated.** New
    preflight check `GL_BRANCH_OR_YEAR_NOT_MIGRATED` (BLOCKER, action ADD): posted journals grouped
    by year | branch and compared with exactly what the foundation stage migrates (`Branch.BranchCode`,
    `Year.YearCode ?? Year.YearID`). Samples read e.g. `2026|99 (1 قيد، ناقص: فرع)`. Read-only, legacy
    source only (`services/migration-preflight.service.ts`). The import-time blocker (fix 29) stays
    as the backstop. Unit test in `migration-readiness-fixes.spec.ts`.
32. Docs that presented `MIGRATION_ALLOW_PRODUCTION_TARGET=true` as a standing Railway setting are
    corrected (`CURRENT_ARCHITECTURE.md`, `RAILWAY_DEPLOYMENT.md`, `RAILWAY_MIGRATION_ENV.md`,
    the skill, `.env.example`).

### Supported legacy documents
Chart of accounts and opening balances · branches, years, currencies, cost centres, stores, units ·
customers / suppliers (and missing party leaves) · items (incl. deleted, inactive) · posted
journals · invoices SI/SV (sales), PI (purchases), SR (sales returns), PR (purchase returns),
incl. draft and cancelled shells (PR03-style family variants map to their family; the stock
direction exists only for the listed codes, others are blocked at reconciliation) · cash and bank vouchers with invoice allocations · inward /
outward cheques · stock transfers · stocktake with adjustment · item cost history.

**Unsupported → BLOCKED, never reclassified:** any invoice `Type` outside the SI/SV/PI/SR/PR families (`UNKNOWN_INVOICE_TYPE`,
e.g. PO01, SO01, QT01), posted invoices / cash vouchers without a matching journal, unmapped accounts,
unmapped branches / years. Unposted and deleted journals are skipped by rule; deleted items are
imported inactive. Quotations / orders appear only as source-link metadata on invoices.

### Readiness
| Area | State |
|---|---|
| Fresh database | Historical chain fails on an empty MySQL (wave0 before `create_all_tables`). Manual bootstrap in `PRISMA_FRESH_INSTALL_BASELINE.md`; not yet executed end-to-end. |
| Performance | **Not measured.** Keyset paging is bounded; per-row id-map lookups make ~1 h per 100k journals an estimate only. Runs go to BullMQ workers (inline mode only for local tests); rollback runs in the background. No 100k-row run exists. |
| Resume / idempotency | Re-import verified on the synthetic set (round 2). Pause / resume mid-stage never tested. |
| Rollback | Removes only `CREATED_BY_MIGRATION` id-map rows. Not safe once users post on migrated data (`rollbackItems` deletes all movements of migrated items). Ledger caches rebuilt; inventory average cost needs a cost repair for items with remaining movements. |
| Reconciliation | Content-level: GL per account, party balances, invoice status / net / lines / party, cash, settlement, cheques, stock per item × store. Cash "other detail" lines and cost history are not compared line by line. |

### Customer prerequisites / source pre-import checklist
Read-only SQL login (`db_datareader`) · legacy SQL Server reachable (agent or `.bak`) · Analyze
checklist shows **0 blocking findings** (unbalanced journals, posted documents without journal,
allocations to missing invoices, unknown document types, shared party accounts, missing items /
units / stores / parties) · year-end closed in legacy · no users posting in legacy during import ·
legacy balance / trial-balance reports exported for sign-off.

### Staging prerequisites
`gates-migration-staging` was deleted — recreate a **separate** Railway project (never
`invigorating-exploration`) · new empty MySQL bootstrapped per `PRISMA_FRESH_INSTALL_BASELINE.md` ·
`MIGRATION_ALLOW_PRODUCTION_TARGET` unset · `MIGRATION_CUSTOMER_EXECUTE_ENABLED` limited by
`MIGRATION_INTERNAL_TEST_USER_IDS` · its own `ENCRYPTION_KEY` · copy of customer data only with the
customer's consent.

### Production go / no-go checklist
- [x] Fixes 27–31 run in a clean disposable rehearsal; 16/16 still matches (2026-10-28)
- [x] Dirty rehearsal: unknown invoice type, unknown branch and unmapped cash line all BLOCKED (2026-10-28)
- [ ] Rollback with pre-existing stock run end-to-end (unit test only so far)
- [x] Regression tests added for 27–31 and 33, green (2026-10-28)
- [x] Analyze reports journals in unmigrated branches / years (fix 34, unit-tested 2026-10-28)
- [x] Fix 34 confirmed by an Analyze run on the synthetic SQL Server; no false alarm on clean data (2026-10-28)
- [ ] A ≥100k-journal rehearsal measured (duration, memory, DB connections)
- [ ] Pause / resume mid-stage and worker-restart recovery tested
- [ ] Rehearsal on a copy of the real customer database reconciles (trial balance, parties, stock)
- [ ] **Live production variables checked by the owner:** `MIGRATION_ALLOW_PRODUCTION_TARGET`
      and `MIGRATION_CUSTOMER_EXECUTE_ENABLED` unset (docs claimed the first was set; the engine
      code is live since the 2026-10-27 deploy)
- [ ] Production database backup taken right before the cutover window
- [ ] Owner approval for the cutover; gates opened for the window only and closed afterwards
- [ ] Unsigned Windows agent not shipped to customers (Agent 1)
