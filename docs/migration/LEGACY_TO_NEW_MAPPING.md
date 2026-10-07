# Legacy → New Entity Mapping

**Authority:** `docs/migration/01-table-mapping.csv` (569 legacy tables), existing `PrismaDataTransformer`, phase scripts.

**Classification legend:** DIRECT_MAP | TRANSFORM | SPLIT | MERGE | CALCULATE | GENERATE | REFERENCE_ONLY | IGNORE | UNMAPPED | BLOCKED_NEEDS_BUSINESS_DECISION

---

## 1. Summary counts (from CSV + engineering classification)

| Status in CSV | Count | Engine class |
|---------------|------:|--------------|
| `mapped` | 42 | Mostly DIRECT_MAP or TRANSFORM |
| `missing` | 254 | UNMAPPED |
| `missing_hr` | 149 | UNMAPPED (module M9) |
| `missing_school` | 29 | UNMAPPED (M10) |
| `legacy_optional` | 78 | IGNORE or REFERENCE_ONLY |
| `ignore` | 10 | IGNORE |
| `missing_detail_pattern` | 5 | TRANSFORM when header mapped |
| `missing_header_pattern` | 2 | TRANSFORM |

**Mapped entities (42)** — expanded below.

---

## 2. Mapped entities (evidence-based)

| OLD | NEW | TYPE | DEPENDENCIES | CONFIDENCE |
|-----|-----|------|--------------|------------|
| `Company` | `Company` | TRANSFORM | — | HIGH |
| `Branch` | `Branch` | DIRECT_MAP | Company | HIGH |
| `Year` | `Period` | TRANSFORM | Company | HIGH |
| `CompanySetting` | `CompanySettings` | TRANSFORM | Company | MEDIUM |
| `Account` | `Account` | TRANSFORM | Company | HIGH |
| `CostCenter` | `CostCenter` | DIRECT_MAP | Company | HIGH |
| `Currency` | `Currency` | TRANSFORM | Company | MEDIUM |
| `CurrencyHistory` | `Currency` / rate rows | TRANSFORM | Currency | MEDIUM |
| `Customer` | `Customer` + `Account` | SPLIT | Account (AR) | HIGH |
| `Supplier` | `Supplier` + `Account` | SPLIT | Account (AP) | HIGH |
| `Store` | `Warehouse` | DIRECT_MAP | Branch? | HIGH |
| `Item` | `Item` | TRANSFORM | Company | HIGH |
| `ItemUnit` | `ItemUnit` | DIRECT_MAP | Item | HIGH |
| `ItemStore` | `ItemQuantity` / balances | TRANSFORM + **CALCULATE** | Item, Warehouse | MEDIUM |
| `ItemCost` | `ItemCostHistory` | TRANSFORM | Item | MEDIUM |
| `ItemsFirstTimeH/D` | `OpeningStock` / `OpeningStockLine` | TRANSFORM | WH, Item | MEDIUM |
| `GLTrxHeader` | `JournalEntry` | TRANSFORM | Branch, Period | HIGH |
| `GLTrxDetail` | `JournalEntryLine` | TRANSFORM | JE, Account, CC | HIGH |
| `InvoiceTrxHeader` | `Invoice` | TRANSFORM | Party, WH, Period | MEDIUM |
| `InvoiceTrxDetail` | `InvoiceLine` | TRANSFORM | Invoice, Item, Unit | MEDIUM |
| `StoreTransHeader/Detail` | `Transfer` / `TransferLine` | TRANSFORM | WH, Item | MEDIUM |
| `StoreCheckHeader/Detail` | `Stocktaking` / `StocktakingLine` | TRANSFORM | WH, Item | LOW (not in ETL) |
| `Person` / `Seller` / `Distributor` / `Driver` | `Delegate` / etc. | TRANSFORM | Company | MEDIUM |
| `UserDefinition` | `User` | TRANSFORM | **BLOCKED** — auth/password | LOW |
| `AdvancedRights` | `UserAdvancedPermission` | TRANSFORM | User | LOW |
| `GroupDefinition` | `UserGroup` | TRANSFORM | Company | LOW |
| `HREmployeeH` | `Employee` | TRANSFORM | HR module | MEDIUM |
| `Contractor` | `Contractor` | DIRECT_MAP | Company | MEDIUM |
| `AbsProjectH` | `Project` | TRANSFORM | Contracting | MEDIUM |
| `PriceListH/D` | `PriceList` / `ItemPrice` | TRANSFORM | Item | MEDIUM |
| `ItemOfferH` | `ItemOffer` | TRANSFORM | Item | LOW |
| `EInvoiceSettings` | `ElectronicInvoice` | TRANSFORM | Company | LOW |
| `InternalSettings` | `SystemSetting` | MERGE? | Company | LOW |
| `LangMessages` | `Translation` | TRANSFORM | — | LOW |
| `Trace` | `ActivityLog` | TRANSFORM | — | LOW |
| `City` | `City` | DIRECT_MAP | — | MEDIUM |

---

## 3. High-risk UNMAPPED (must plan before cutover)

| OLD | NEW (intended) | TYPE | BLOCKER |
|-----|----------------|------|---------|
| `CashTrxHeader/Detail` | Treasury cash docs | TRANSFORM | No phase C writer |
| `CKTrx*` | `Cheque` | TRANSFORM | Phase D stub |
| `BalanceAccountsH/D` | Opening JE | TRANSFORM | Double-count vs GL |
| `AllWarehousingTrans*` | `InventoryMovement` | RECONSTRUCT | No ETL |
| `ManufactProcess*` | Production orders | TRANSFORM | Module gap |
| 149 HR tables | HR payroll | UNMAPPED | Product scope |

---

## 4. Field-level samples (mapped entities)

### `Account.AccountCode` → `Account.code`

| OLD | NEW | TRANSFORM | REQUIRED | LOSSY | CONF |
|-----|-----|-----------|----------|-------|------|
| `AccountCode` | `code` | trim | yes | no | HIGH |
| `AccountNameA` | `arabicName` | trim | yes | no | HIGH |
| `Deleted` | `isActive` | `!Deleted` | yes | semantic | HIGH |
| — | `companyId` | `targetCompanyId` | yes | — | HIGH |

### `GLTrxDetail` → `JournalEntryLine`

| OLD | NEW | TRANSFORM | REQUIRED | LOSSY | CONF |
|-----|-----|-----------|----------|-------|------|
| `DebitValue` | `debit` | decimal | yes | no | HIGH |
| `CreditValue` | `credit` | decimal | yes | no | HIGH |
| `Change` | `exchangeRate` | decimal | yes | no | HIGH |
| (calc) | `debitBase` | `debit * rate` | yes | rounding | HIGH |
| `AccountNo` | `accountId` | id map | yes | no | HIGH |
| `CCenterCode` | `costCenterId` | id map | no | no | MEDIUM |

### `InvoiceTrxHeader` → `Invoice`

| OLD | NEW | TRANSFORM | REQUIRED | LOSSY | CONF |
|-----|-----|-----------|----------|-------|------|
| `InvoiceNum` | `invoiceNumber` | trim | yes | no | HIGH |
| `Type` | `invoiceKind` | map enum | yes | maybe | MEDIUM |
| `Status` | `isPosted` | `Post` | yes | no | HIGH |
| `SupplierAccountCode` | `customerId`/`supplierId` | resolve party | yes | no | MEDIUM |
| `TotalAmount` | `totalAmount` | decimal | yes | if ≠ sum lines | MEDIUM |
| — | `companyId` | context | yes | — | HIGH |

**Full column lists:** use `erp_schema.txt` + transformer for each entity; do not guess unmapped columns.

---

## 5. ID mapping requirement

| Entity | Preserve legacy code? | UUID map |
|--------|----------------------|----------|
| Company | `legacyCompanyCode` on row | optional |
| Branch, Year, Account, Item, … | legacy *Code fields | `LegacyIdCache` in memory; persist as `MigrationIdMap` |
| GL | `legacyGlNum` | required |
| Invoice | `invoiceNumber` + `sourceYearId` | required |

---

## 6. Validation & reconciliation

| Entity | Check |
|--------|-------|
| GL | Trial balance debit=credit; per-account vs legacy posted SQL |
| Stock | Qty by item×warehouse; valuation |
| Invoice | Header net vs lines; posted flag vs GL link |

---

## 7. Risks

- **Double GL** if branch resolution fails (known bug class — fixed in phase C adopt logic).
- **Double stock** if invoices migrated as postable + GL + movements.
- **CSV maps `ItemStore` → `ItemQuantity`** but new system may use warehouse balances — reconcile both paths.

**Overall mapping confidence:** **MEDIUM** (42 entities); **LOW** for remaining 527 tables.

---

## Phase 0.5 — validation against real DB (Agro2)

| Classification | Count | Examples |
|----------------|------:|----------|
| **CONFIRMED** | **38** | Company, Branch, Year, Account*, Customer, Supplier, Item, Store, GLTrx*, InvoiceTrx*, CashTrxHeader, StoreTrans*, ItemUnit, ItemCost |
| **NEEDS_CHANGE** | **3** | `ItemStore`→`ItemQuantity` (0 rows — use movements); `GLTrxHeader` (+`Performed`); invoice NULL status |
| **STILL_UNCERTAIN** | **1** | `CurrencyHistory`→`Currency` (0 rows in this DB) |
| **WRONG** | **0** | |

\*Account master incomplete vs GL line accounts — import rule must **GENERATE** missing accounts from GL distinct codes.

### Additional migration-relevant tables (data-driven)

| Table | Rows | Why |
|-------|-----:|-----|
| `InvoiceTrxDistCash` | 129 | Payment distribution on invoices |
| `InvoiceTrxCashs` | 49 | Invoice cash lines |
| `ItemCost` | 62 | Valuation |
| `BalanceAccountsH/D` | 1/1 | Opening batch |
| `GLTransVio` / `CCTransVio` | views | Optional validation only |

**After audit:** Reclassify each row using table row counts, FK presence, and column null rates. Pay special attention to:

- `ItemStore` → `ItemQuantity` vs warehouse balance model
- `CurrencyHistory` → `Currency`
- `InvoiceTrxHeader` field names vs `PrismaDataTransformer` (`TotalValue` vs `TotalAmount`)

**Additional tables (pending discovery):** Run FK graph + procedure table references post-restore; update §3 High-risk UNMAPPED.
