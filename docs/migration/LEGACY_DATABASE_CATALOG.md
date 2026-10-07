# Legacy Database Catalog (SQL Server ERP)

**Status:** Phase 1 discovery (read-only).  
**Source artifacts:** `erp/` folder — not live database introspection unless noted.

---

## 1. Artifact inventory (`erp/`)

| File | Type | What it tells us |
|------|------|------------------|
| `README.md` | Index | Legacy = **Microsoft SQL Server** (Delphi desktop + mobile clients). **Not** MySQL/Prisma. |
| `SQL_SERVER_ERP_GUIDE.md` | Guide | Connection model, mobile vs desktop, key tables, relationship narrative. |
| `ERP_TABLES_INDEX.md` | Index | **570 tables**, column counts only (fast lookup). |
| `ERP_FULL_TABLES_CATALOG.md` | Catalog | Per-table purpose (AR), mobile usage, **inferred** relationships, full column lists for all 570 tables. |
| `erp_schema.txt` | Schema dump | `Table.Column (type)` lines (~7,881 lines). Authoritative for **column names and types**; no PK/FK DDL. |
| `erp_procedures.txt` | Procedure list | **15** named stored procedures in dump; mobile may call additional (commented). **No procedure bodies** in repo. |
| `migrate-to-railway.md` | Ops | `.bak` → Railway SQL Server; tenant name mapping (`GatesImprove` / `SolarMasterDB`); warns stub DBs. |

**Not in `erp/` but relevant:** `DataBase21-5-2026.bak` at repo root (~29 MB SQL Server backup) — tables **not** readable without `RESTORE` on SQL Server.

**Missing from artifacts (count = 0 in repo):** SQL `CREATE TABLE` scripts, **views**, **triggers**, **function** definitions, **stored procedure bodies**, sample row dumps (except `gates-backend/scripts/migration/fixtures/sample/`).

---

## 2. Legacy tenancy and document keys

### Company scoping — CONFIRMED

Nearly all operational tables include `CompanyCode` (`char`). Legacy is **single-database, multi-company** via `CompanyCode`, not separate databases per customer (except deployment choice).

### Composite document keys — STRONG_INFERENCE

Headers/lines repeat:

`CompanyCode` + `BranchCode` + `YearID` + document number + often `Type`

Examples (from `ERP_FULL_TABLES_CATALOG.md` + ETL):

| Entity | Key columns | PK in DDL |
|--------|-------------|-----------|
| `GLTrxHeader` / `GLTrxDetail` | `GlNum` / `GLNum`, `DetailNum` | UNKNOWN (no DDL) |
| `InvoiceTrxHeader` / `InvoiceTrxDetail` | `InvoiceNum`, `Type`, line `Serial`/`GridNum` | UNKNOWN |
| `CashTrxHeader` / `CashTrxDetail` | `CashNum`, `Type` | UNKNOWN |
| `StoreTransHeader` / `StoreTransDetail` | `StoreTransCode`, `Type` | UNKNOWN |
| `Item` | `ItemCode` (+ `CompanyCode`) | UNKNOWN |
| `ItemStore` | `ItemCode`, `StoreCode` | UNKNOWN |
| `Account` | `AccountCode` | UNKNOWN |

**Migration implication:** Natural keys for idempotency must mirror ETL (`docs/migration/03-etl-pipeline.md`), not assumed surrogate `Id` columns where present (`InvoiceTrxHeader.Id` is sync metadata, not proven PK).

### Delphi boolean / status — CONFIRMED (application docs)

- Flags: `T` / `F` (`Deleted`, `Balanced`, etc.) — see `PrismaDataTransformer` and `M1-AccountingGL.md`.
- GL posted filter: `Status = 'Post'` and `Deleted <> 'T'` (reconciliation harness).

---

## 3. Module map (570 tables)

Tables are tagged in `docs/migration/01-table-mapping.csv` with `module_id` (M0–M22). Summary:

| Module | Theme | Approx. tables (CSV) | New ERP coverage |
|--------|--------|----------------------|------------------|
| M0 | Platform (company, branch, year, users, rights) | Core | Partially mapped |
| M1 | GL, COA, opening balances | Core | Partial ETL + services |
| M2 | Treasury (cash, cheques) | Large | Mostly unmapped |
| M3 | Customers, suppliers, persons | Core | Phase A masters |
| M4 | Inventory, stores, transfers, stocktake | Core | Partial |
| M6 | POS | Some | New POS module (separate model) |
| M7 | Taxes | Some | New tax engine |
| M8 | Manufacturing | Many | New manufacturing |
| M9 | HR / payroll | **149** `missing_hr` in CSV | New HR |
| M10 | Schools | **29** `missing_school` | Niche |
| M11 | Contracting / projects | Many | Partial (`Project`, `Contractor`) |
| M12 | Real estate | Many | Limited in new ERP |
| M14–M16 | E-invoicing, trade, reports | Mixed | Partial |
| M17–M22 | Audit, analytics, archive | Mixed | Partial |

**Full alphabetical list:** `erp/ERP_TABLES_INDEX.md` (570 rows).  
**Per-table narrative + columns:** `erp/ERP_FULL_TABLES_CATALOG.md`.

---

## 4. Migration-critical tables (deep catalog)

Below: evidence-backed fields. Relationships marked **CONFIRMED** only when stated in catalog/ETL/module docs; else **STRONG_INFERENCE** or **UNKNOWN**.

### M0 — `Company`

| Attribute | Value |
|-----------|--------|
| **Purpose** | Legal entity / tenant root in legacy DB |
| **PK** | UNKNOWN — likely `CompanyCode` |
| **Scope** | `CompanyCode` on children |
| **Important columns** | `CompanyNameA`, `CompanyNameE`, phones, address (see `erp_schema.txt`) |
| **New target** | `Company` (`legacyCompanyCode`) — **CONFIRMED** (ETL) |
| **Money/Qty** | — |

### M0 — `Branch`

| **Purpose** | Operating branch |
| **PK** | UNKNOWN — `CompanyCode` + `BranchCode` (**STRONG_INFERENCE**) |
| **FKs** | `CompanyCode` → `Company` (**STRONG_INFERENCE**) |
| **New target** | `Branch` (`legacyBranchCode`) |

### M0 — `Year`

| **Purpose** | Fiscal year |
| **PK** | `CompanyCode` + `YearCode` / `YearID` (**STRONG_INFERENCE**) |
| **Dates** | `FromDate`, `ToDate`, `Status` |
| **New target** | `Period` (`legacyYearId`) |

### M0 — `CompanySetting`

| **Purpose** | GL numbering, posting rules, feature flags |
| **New target** | `CompanySettings` (**mapped** in CSV) |
| **Migration relevance** | GL serial mode, unpost allowed — affects **GENERATE** defaults |

### M1 — `Account`

| **Purpose** | Chart of accounts |
| **PK** | `CompanyCode` + `AccountCode` (**STRONG_INFERENCE**) |
| **Important** | `AccountType`, `AccountSide`, `CurrencyCode`, `Deleted` (retired, not erased) |
| **Money** | Balances are **derived** from posted `GLTrxDetail`, not stored on row |
| **New target** | `Account` |

### M1 — `CostCenter`

| **Purpose** | Cost center tree |
| **New target** | `CostCenter` |

### M1 — `Currency`, `CurrencyHistory`

| **Purpose** | Currency master + historical rates |
| **New target** | `Currency` (+ rate history pattern in new schema — verify model fields in Prisma) |
| **Note** | CSV maps both to `Currency` — needs **TRANSFORM** / child table in new system |

### M1 — `GLTrxHeader`

| **Purpose** | Journal voucher header |
| **PK** | `CompanyCode`, `BranchCode`, `YearID`, `GlNum` (**STRONG_INFERENCE**) |
| **Status** | `Status` (`Post` / `UnPost`), `Deleted`, `Balanced` |
| **Dates** | `Date`, `DateH` (Hijri) |
| **Currency** | `CurrencyCode`, line-level `Change` on details |
| **Links** | `Type`, `SourceNum`, `UserCode` |
| **Referenced by** | Cash, invoices, store docs via `GLNum` (**STRONG_INFERENCE**) |
| **New target** | `JournalEntry` (`legacyGlNum`, `postingStatus`, `isPosted`) |

### M1 — `GLTrxDetail`

| **Purpose** | Journal lines (debit/credit in document currency × `Change`) |
| **PK** | + `DetailNum` (**STRONG_INFERENCE**) |
| **FKs** | Header via `GLNum` key (**CONFIRMED** catalog); `AccountNo` → `Account` (**STRONG_INFERENCE**) |
| **Money** | `DebitValue`, `CreditValue`, `Change`, tax fields |
| **New target** | `JournalEntryLine` (`debit`, `credit`, `debitBase`, `creditBase`) |

### M1 — `BalanceAccountsH` / `BalanceAccountsD`

| **Purpose** | Opening balance entry documents (legacy UI) |
| **New target** | Likely **TRANSFORM** → `JournalEntry` and/or `AccountPeriodBalance` — **OWNER_DECISION** (see `ACCOUNTING_MIGRATION_SPEC.md`) |
| **Status** | UNMAPPED in CSV |

### M3 — `Customer`, `Supplier`

| **Purpose** | Party masters; AR/AP via `mainAccount` / `SupplierAccountCode` on docs |
| **Codes** | `CustomerCode`, `SupplierCode`, `Deleted`, `CreditLimit` |
| **New target** | `Customer`, `Supplier` + linked `Account` (**SPLIT** — see mapping doc) |

### M4 — `Store`

| **Purpose** | Warehouse |
| **New target** | `Warehouse` (`legacyStoreCode`) |

### M4 — `Item`

| **Purpose** | Item tree (`ParentItem`, `ItemType`, group vs detail) |
| **New target** | `Item` (`serial` = legacy `ItemCode`) |

### M4 — `ItemUnit`

| **Purpose** | UOM, barcodes, conversion `Change`, price lists |
| **New target** | `ItemUnit` |

### M4 — `ItemStore`

| **Purpose** | **Cached** qty per store (catalog notes: may be stale) |
| **Columns** | `CompanyCode`, `ItemCode`, `StoreCode`, `Qty` |
| **New target** | CSV maps to `ItemQuantity` — **STRONG_INFERENCE**; new ERP also uses `item_warehouse_balances` / movements (**CALCULATE** path) |

### M4 — `ItemCost`

| **Purpose** | Cost history by source document |
| **New target** | `ItemCostHistory` (reconciliation compares latest row) |

### M4 — `ItemsFirstTimeH` / `ItemsFirstTimeD`

| **Purpose** | Opening stock document (legacy) |
| **New target** | `OpeningStock` / `OpeningStockLine` (**mapped** in CSV) |

### M4 — `StoreTransHeader` / `StoreTransDetail`

| **Purpose** | Stock transfers / store transactions |
| **Status** | `Status`, `Deleted`, `GLNum` |
| **New target** | `Transfer` / `TransferLine` |

### M4 — `StoreCheckHeader` / `StoreCheckDetail`

| **Purpose** | Stocktaking |
| **New target** | `Stocktaking` / `StocktakingLine` |

### M5/M15 — `InvoiceTrxHeader` / `InvoiceTrxDetail`

| **Purpose** | Sales/purchase/return invoices (type-driven) |
| **Key** | `InvoiceNum`, `Type`, `Status`, `AffectStore`, `GLNum`, `SupplierAccountCode`, amounts |
| **Money** | `TotalAmount`, `NetAmount`, `Change`, line `NetValue`, discounts, `DaribaValue` |
| **Qty** | Line `Qty1`/`Qty2`, `StoreCode` per line |
| **New target** | `Invoice` / `InvoiceLine` — **does not** auto-run legacy `PostInvoice` (**HISTORICAL_DOCUMENT_STRATEGY.md**) |

### M2 — `CashTrxHeader` / `CashTrxDetail`

| **Purpose** | Cash receipts/payments |
| **New target** | Treasury / `CashTransaction` family — **UNMAPPED** in phase C (partial transformer fields only) |

### M2 — `CKTrxHeader` / `CKTrxDetail`

| **Purpose** | Cheques |
| **New target** | `Cheque` lifecycle — Phase D stub |

---

## 5. Catalog maintenance rule

For any table **not** expanded above:

1. Read purpose + columns in `ERP_FULL_TABLES_CATALOG.md`.
2. Cross-check columns in `erp_schema.txt`.
3. Classify in `LEGACY_TO_NEW_MAPPING.md` — do not infer FKs from column name alone.

---

## 6. Table count

| Metric | Count |
|--------|------:|
| Legacy tables (index) | **570** |
| Tables with column-level detail in catalog | **570** |
| Tables with deep section in this doc | **~25** (critical path) |

**Confidence:** Column names/types **HIGH** (schema dump). PK/FK constraints **LOW** (no DDL). Business meaning **MEDIUM** (catalog + module docs + partial Delphi references).
