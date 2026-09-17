# Phase 3b — Migration Reconciliation (Cutover Parity Gate)

The ETL smoke test proves rows land; it does not prove the numbers survived. This harness
compares the legacy dump against what the ETL loaded and produces a pass/fail verdict plus a
JSON report to attach to the cutover sign-off.

```bash
cd gates-backend
npm run recon:migration -- --company=MIG1 --out=/tmp/recon-MIG1.json
```

Exit code is `0` only when every compared figure is within tolerance, so it can gate a deploy.

---

## 1. What is compared

| Section | Legacy side | Migrated side | Tolerance unit |
|---|---|---|---|
| `trial-balance` | `GLTrxDetail` × posted `GLTrxHeader`, grouped by `AccountNo`, amounts × `Change` | `JournalEntryLine.debitBase` / `creditBase` for posted, non-cancelled, non-deleted entries, grouped by `Account.code` | currency |
| `trial-balance` cross-check | — | `financialReportService.getTrialBalance` period totals vs the raw ledger sums | currency |
| `stock` | `ItemStore.Quantity` per `StoreCode` + `ItemCode` | `ItemQuantity.quantity` joined via `Warehouse.legacyStoreCode` and `Item.serial` | quantity |
| `stock` | latest `ItemCost.Cost` per item (highest `Serial`, then latest `Date`) | latest `ItemCostHistory.cost` (latest `effectiveAt`, then `serial`) | currency |
| `stock` | Σ quantity × unit cost | same | currency |

Header selection deliberately mirrors the ETL: `Deleted <> T` and `Status = Post`. Unposted
legacy vouchers are migrated but excluded from both sides, so they can never mask a real gap.

The M16 cross-check matters because the business reads the *report*, not the table: it catches
a report-level regression (filters, base-amount handling) even when the ledger itself is exact.

## 2. Options

| Flag | Default | Purpose |
|---|---|---|
| `--company=` | required | legacy `CompanyCode`; resolved to the tenant via `Company.legacyCompanyCode` |
| `--data-path=` | `scripts/migration/fixtures/sample` | JSON dump directory (`LEGACY_DATA_PATH` also honoured) |
| `--section=` | `all` | `trial-balance` \| `stock` \| `all` |
| `--from=` / `--to=` | full history | restrict both sides to a date window (e.g. one fiscal year) |
| `--tolerance=` | `0.01` | absolute difference accepted per compared figure |
| `--out=` | — | write the full JSON report (all differences, not just the first 50 printed) |

Source selection follows the ETL: when `LEGACY_MSSQL_URL` (or
`LEGACY_MSSQL_CONNECTION_STRING`) is set, both sides read live SQL Server; otherwise JSON
dumps are used. The `mssql` package is an optional peer — `npm install mssql` on the box that
runs the cutover.

## 3. Cutover checklist

1. **Freeze** legacy writes; take a `mysqldump` of the target MySQL schema and a SQL Server backup.
2. **Sanitise + stage** the production dump; point `LEGACY_DATA_PATH` or `LEGACY_MSSQL_URL` at it.
3. **Dry run:** `npm run migrate:legacy -- --company=<CODE> --dry-run` — resolves every foreign
   key without writing; review `docs/migration/migration-errors.log`.
4. **Load:** `npm run migrate:legacy -- --company=<CODE>` (phases A→B→C in order).
5. **Reconcile:** `npm run recon:migration -- --company=<CODE> --out=recon-<CODE>.json`.
   Verdict must be `PASS`. Investigate every difference; do not widen `--tolerance` to get green.
6. **Per-year spot check:** rerun with `--from`/`--to` per fiscal year — a year-level match is
   stronger evidence than a single lifetime total that could hide offsetting errors.
7. **Smoke gate:** `npm run test:waves` (includes this harness against the sample fixtures).
8. **Sign-off:** attach the JSON report and the ETL stats table to the cutover record.

### Interpreting differences

| Symptom | Likely cause |
|---|---|
| One account off by a round amount, both sides balanced | a legacy header whose `Status`/`Deleted` flag differs from what the ETL read |
| Migrated debit *and* credit exactly double the legacy figure | the same legacy voucher imported twice — check for entries sharing `legacyGlNum` where one has an unresolved `branchId` |
| `Legacy dump is itself unbalanced` note | source data problem; fix in the legacy system before cutover |
| Quantity matches but `stockValue` does not | cost history missing for an item (the harness notes how many) or a different latest-cost row won |
| Migrated totals are zero | ETL ran against a different company code, or Phase C never ran |

Re-running the ETL is idempotent, so it is always safe to fix the dump and reload before
reconciling again. Roll back a bad load by deleting the target company (cascades) rather than
patching rows — see `05-production-runbook.md`.

## 4. Rehearsing without a production dump

`npm run fixtures:prod-like` writes a deterministic, production-shaped dump to
`scripts/migration/fixtures/prod-like/` (company code `PRODLIKE`, `--scale=N` to multiply
volume). It intentionally contains the cases that break naive loaders:

- two fiscal years, one closed, one open;
- three branches whose `GlNum` sequences restart, so vouchers collide across branches;
- multi-currency journals where base amounts depend on `Change`;
- unposted and deleted vouchers that must be migrated but excluded from the trial balance;
- multi-line journals with cost centres and a split credit leg;
- sale / purchase / return invoices, partly settled;
- one item stocked in several warehouses and items with repeatedly revised costs;
- a retired (`Deleted=T`) account that still carries posted history.

```bash
export LEGACY_DATA_PATH=$PWD/scripts/migration/fixtures/prod-like
npm run fixtures:prod-like
npm run migrate:legacy -- --company=PRODLIKE
npm run recon:migration -- --company=PRODLIKE
```

Two defects were found this way and fixed:

- Phase C re-imported a journal whose branch had not resolved on an earlier run, doubling the
  trial balance. It now adopts the branch-less row instead of inserting a second one.
- Delphi's `Deleted` account flag was mapped to `deletedAt`, and the M16 trial balance filters
  soft-deleted accounts — so a retired account's posted history silently vanished and the report
  came out unbalanced. Retired accounts now import as `isActive: false` with `deletedAt: null`,
  and the trial balance keeps any account that still carries posted lines.

## 5. Automated coverage

`npm run test:migration-recon` (part of `npm run test:waves`):

1. migrates the sample fixtures and asserts the harness reports `PASS`;
2. perturbs a migrated stock quantity and asserts it reports `FAIL`, proving the gate detects
   drift rather than always passing;
3. generates and loads the prod-like dump, then reconciles it in full, per fiscal year, and
   again after a second ETL run to prove idempotency.
