# Legacy Restored Database Metadata

**Phase 0.5:** **CONFIRMED_FROM_DB** (restored locally as `LegacyForensic`, read-only).

## Restore provenance

| Field | Value |
|-------|--------|
| Backup file | `DataBase21-5-2026.bak` (~29 MB) |
| Original DB name | **Agro2** |
| Backup date | 2026-05-21 20:22 UTC |
| DB creation | 2025-08-07 |
| Compatibility | 150 (SQL Server 2019) → upgraded to 2022 container |
| Collation | Arabic_CI_AS |
| Restore target | `LegacyForensic` (Docker `gates-legacy-forensic-mssql`, port 14333) |
| Updateability | **READ_ONLY** after restore |

## Identity vs `erp/` catalog

| Check | Result |
|-------|--------|
| User tables in DB | **569** (`sys.tables`) |
| Tables in `ERP_TABLES_INDEX.md` | **570** |
| Delta | **1** table name in catalog not present (or extra in DB) — treat catalog as superset |
| Column dumps (`erp_schema.txt`) | Match expected Gates ERP shape |
| Procedures in `erp_procedures.txt` | **15** named; DB has **14** (`GetAllItemsInStoreMobile` absent) |

## Constraints (critical finding)

| Object | Count | Note |
|--------|------:|------|
| **PRIMARY KEYS** (`sys.indexes.is_primary_key`) | **0** | No declared SQL PKs — keys are **application composite** |
| **FOREIGN KEYS** | **0** | Relationships are **logical only** |
| UNIQUE constraints | Not bulk-exported; assume per Delphi |
| DEFAULT / CHECK | Not bulk-exported |

**Migration implication:** Idempotency must use **natural keys** (CompanyCode + BranchCode + YearID + doc numbers), not surrogate IDs. `MigrationIdMap` is mandatory.

## Programmability

| Type | Count |
|------|------:|
| Stored procedures | **14** |
| Views | **3** (`GLTransVio`, `CCTransVio`, `PivotCostCenter`) |
| Functions | **18** |
| Triggers | **0** |

**Procedure bodies:** **YES** — exported under `audit-out/proc_*.sql` (e.g. `PostInvoice` ~59 KB).

## Views

All three are reporting/violation helpers — not posting paths.

## PK/FK documentation

Per-table PK columns must be taken from **Delphi/DataBase.ini** and catalog inference until a customer DB declares constraints. This restored DB has **none**.
