# Phase 3 — Legacy Data Migration ETL

CLI-driven, idempotent import from legacy SQL Server or JSON table dumps into Prisma/MySQL, aligned with [01-table-mapping.csv](./01-table-mapping.csv).

## Architecture

```
Legacy source (MSSQL or JSON dumps)
        ↓
LegacyDataExtractor  — batch reads (500 rows), optional company filter
        ↓
PrismaDataTransformer — Delphi T/F, dates, decimals, GL 8-digit padding
        ↓
Phase runners A → B → C — upsert via legacy natural keys + LegacyIdCache
        ↓
MySQL (Prisma)
```

| Phase | Scope | Legacy tables (initial) |
|-------|--------|-------------------------|
| **A** | Masters | `Company`, `Branch`, `Year`, `Account`, `CostCenter`, `Customer`, `Supplier`, `Store`, `Item` |
| **B** | Openings | `ItemStore`, `ItemCost` |
| **C** | Transactions | `GLTrxHeader`, `GLTrxDetail`, `InvoiceTrxHeader`, `InvoiceTrxDetail`, `CashTrxHeader` |

Failed rows append to [migration-errors.log](./migration-errors.log) without stopping the batch.

## CLI

```bash
cd gates-backend

# JSON sample fixtures (default path: scripts/migration/fixtures/sample)
npm run migrate:legacy -- --phase=ALL --company=MIG1

# Dry run
npm run migrate:legacy -- --dry-run --phase=A

# SQL Server (requires: npm install mssql)
export LEGACY_MSSQL_URL="Server=...;Database=...;User Id=...;Password=...;Encrypt=true"
export LEGACY_DATA_PATH=/optional/override/for/json/fallback
npm run migrate:legacy -- --phase=C --company=0001 --limit=1000 --batch-size=500
```

### Flags

| Flag | Description |
|------|-------------|
| `--dry-run` | Transform + cache only, no Prisma writes |
| `--phase=A\|B\|C\|ALL` | Dependency-ordered slice |
| `--company=<code>` | Filter `CompanyCode` |
| `--limit=<n>` | Cap rows per table (JSON/SQL) |
| `--batch-size=<n>` | Chunk size (default 500) |
| `--data-path=<dir>` | Directory of `<TableName>.json` arrays |

## Idempotency keys

| Entity | Lookup |
|--------|--------|
| Company | `legacyCompanyCode` |
| Branch | `companyId` + `legacyBranchCode` |
| Fiscal year | `companyId` + `legacyYearId` (`Year.YearCode`) |
| Account | `companyId` + `code` |
| Journal | `companyId` + `branchId` + `fiscalYearId` + `legacyGlNum` (8-digit) |
| Invoice | `companyId` + `invoiceNumber` + `sourceYearId` |
| Item cost history | `companyId` + `itemId` + source composite |

## Code layout

- `scripts/migration/migrate-legacy-data.ts` — entrypoint
- `scripts/migration/LegacyDataExtractor.ts` — JSON + optional MSSQL
- `scripts/migration/PrismaDataTransformer.ts` — field mapping
- `scripts/migration/phases/phase-a-masters.ts` … `phase-c-transactions.ts`
- `scripts/migration/fixtures/sample/` — golden sample for CI

## Verification

```bash
npm run test:migration-pipeline
```

Runs full `ALL` phase twice on sample data and asserts counts + journal idempotency.

## Next increments

- Extend Phase A: `Person`, `Distributor`, `PersonItemPrice`, `CompanySetting`
- **Phase D** (`--phase=D`): `Person` upsert when present in extract; `CKTrxHeader` detected (cheque lines planned)
- Phase C: `CKTrx*` → `Cheque`, treasury detail lines
- Parallel company workers, checkpoint table, validation report vs legacy totals
