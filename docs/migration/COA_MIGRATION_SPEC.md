# Chart of Accounts (COA) migration — Phase 2

## Scope

- Import legacy `Account` master (+ deterministic GL-only leaves) into target `Account` rows under `targetCompanyId`.
- **Does not** import `GLTrxHeader` / `GLTrxDetail`, parties, inventory, or invoices.
- **Does not** weaken ERP `Account` invariants (`@@unique([companyId, code])`, `accountKind`, `accountNature`, posting eligibility).

## Source detection

`accounting-source-profile.ts` probes `sys.tables` (no customer-name branching):

| Capability | LegacyForensic tables |
|------------|----------------------|
| Account master | `Account` |
| Posted GL | `GLTrxHeader` + `GLTrxDetail` |
| Balance sheet pairing | `BalanceAccountsH` / `BalanceAccountsD` |
| Commercial GL links | `InvoiceTrxHeader` / `InvoiceTrxDetail` |

Posted filter (confirmed baseline): `Status='Post'`, `Deleted<>'T'`, detail join on `CompanyCode+BranchCode+YearID+GLNum`.

## Account universe

Built from:

1. Account master (`CompanyCode`)
2. Distinct `AccountNo` on **posted** GL detail
3. All GL detail (discovery)
4. `BalanceAccountsD` codes
5. `Customer.AccountCode` / `Supplier.AccountCode`

Buckets: `MASTER_ONLY`, `MASTER_AND_GL`, `GL_ONLY` (posted), `BALANCE_ONLY`, `OTHER_REFERENCE_ONLY`.

## Classification

Each code required for posted GL resolves to one of:

`EXACT_MASTER`, `NORMALIZED_MASTER`, `DERIVED_FROM_LEGACY_STRUCTURE`, `DETERMINISTIC_GENERATABLE`, `GENERATED_STRUCTURAL_PARENT`, `DEPENDENT_ON_FUTURE_PARTY_MIGRATION`, `AMBIGUOUS`, `INVALID_SOURCE`, `BLOCKED`.

### LegacyForensic `0001` — “~70 GL-only” explanation

- **ETL doc** (`LEGACY_ETL_VS_REAL_DB.md`) counted GL lines **without** a master row across **all** GL detail (draft + posted) or mixed normalization.
- **Forensic DB (company 0001, posted only):** **49** distinct GL accounts, **47** overlap master, **2** GL-only:
  - `102020101001` — POS sub-ledger under customer control header `102020101`; **DERIVED_FROM_LEGACY_STRUCTURE** (GL line descriptions as name evidence).
  - `102060101003` — POS lines; only short prefix `102` in master → **AMBIGUOUS** (blocker for full GL readiness).

Party cards use 14-digit analytical codes (e.g. `10202010102001`), not the 12-digit POS codes above.

## Transform rules

| Legacy | Target |
|--------|--------|
| `HasChild=T` or `AccountType=C` (with children) | `accountKind=HEADER` |
| `AccountType=D`, `HasChild=F` | `accountKind=POSTING` |
| `AccountSide` D/C | `accountNature` DEBIT/CREDIT |
| `ReportType` P | `statementType=INCOME_STATEMENT` |
| `ReportType` I/M | `statementType=BALANCE_SHEET` |
| `CCType` W/O | cost center required optional/mandatory |
| `Deleted=T` | `isActive=false` (master still migrated — history may reference) |

Insert order: topological on `ParentAccount` (parents before children).

## Engine stage

- Stage name: **`COA`**
- Depends on: **`FOUNDATION`**
- CLI: `dry-run-coa`, `run-coa`, `reconcile-coa`
- `MigrationIdMap` source key: `{ companyCode, accountCode }`

## GL readiness reconciliation

For each posted GL `AccountNo`:

- `RESOLVED_TO_TARGET_ACCOUNT` (must be `accountKind=POSTING` for journal eligibility), or
- explicit `PARTY_DEPENDENT` / `AMBIGUOUS` / `BLOCKED`.

Balance mapping preview sums posted debit/credit through resolved codes only; must match baseline when all codes resolve.

## Rollback

Deletes only `Account` rows with `MigrationIdMap.outcome=CREATED_BY_MIGRATION` for the job (children first). Does not delete native/pre-existing accounts (`ALREADY_MAPPED`).
