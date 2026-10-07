# New Gates ERP Database Catalog (migration-relevant)

**Source of truth:** `gates-backend/prisma/schema.prisma` (309 models), backend **services** that create/post records, `docs/architecture/ENGINEERING_CONSTITUTION.md`.

This document groups models that a legacy migration must populate correctly. It is not an exhaustive data dictionary of all 309 models.

---

## 1. Platform & tenancy

| Model | Purpose | Required fields | companyId | Notes |
|-------|---------|-----------------|-----------|-------|
| `Company` | Tenant root | `arabicName`, `legacyCompanyCode` (for import) | Self | Unique `legacyCompanyCode` |
| `Branch` | Branch | `companyId`, names | **Yes** | `legacyBranchCode` |
| `Period` | Fiscal year | `companyId`, dates, status | **Yes** | `legacyYearId` |
| `CompanySettings` | Feature/config | `companyId` | **Yes** | From `CompanySetting` |
| `User`, `UserGroup`, `UserAdvancedPermission` | Auth | company membership | Mixed | **OWNER_DECISION** for user migration |
| `Currency` | Currency master | company-scoped fields per schema | **Yes** | Rates may be separate rows |

**Invariant:** Migration must set `targetCompanyId` explicitly — no default company (see `TENANT_SCOPING_RULES.md`).

---

## 2. Accounting

| Model | Purpose | Posting | Critical fields |
|-------|---------|---------|-----------------|
| `Account` | COA | N/A | `code`, `accountType`, `accountSide`, `isActive` |
| `CostCenter` | CC tree | N/A | `code` |
| `JournalEntry` | GL header | `isPosted`, `postingStatus`, `isCancelled` | `legacyGlNum`, `branchId`, `fiscalYearId`, `exchangeRate` |
| `JournalEntryLine` | GL lines | With header | `debit`, `credit`, `debitBase`, `creditBase`, `accountId` |
| `AccountPeriodBalance` | Period snapshots | Optional path | Verify usage vs derived ledger |
| `CommercialPaper*`, treasury journals | Cheques, notes | Posting services | High risk — not in phase C |

**Source of truth for GL balances:** Posted, non-cancelled `JournalEntry` + lines (`debitBase`/`creditBase`) — constitution + `ledger-balance.service.ts` patterns.

**Never insert incorrectly:**

- Unbalanced journals marked posted.
- Lines without valid `accountId` in tenant.
- Duplicate `(companyId, branchId, fiscalYearId, legacyGlNum)`.
- `debitBase`/`creditBase` not equal to amount × rate within tolerance.

**Status model:** `postingStatus` / `isPosted`; cancellations via `isCancelled` / `deletedAt` — align with reporting filters used in reconciliation (`06-migration-reconciliation.md`).

---

## 3. Parties

| Model | Purpose | Links |
|-------|---------|-------|
| `Customer` | Customer master | `mainAccountId` → `Account` (AR) |
| `Supplier` | Supplier master | `mainAccountId` → `Account` (AP) |
| `Distributor`, `Delegate`, `Driver` | Sales hierarchy | Optional on invoices |

**Invariant:** Party operational balances should **derive** from GL + open documents, not arbitrary cached fields.

---

## 4. Inventory

| Model | Purpose | Source of truth |
|-------|---------|-----------------|
| `Item` | Item master | `serial` (business code), tree via categories |
| `ItemUnit` | UOM | Per item |
| `Warehouse` | Store | `legacyStoreCode` |
| `ItemQuantity` | Legacy-named aggregate? | Verify vs `item_warehouse_balances` in services |
| `item_warehouse_balances` | Per-warehouse qty/cost | Updated by `adjust-stock-in-tx`, movements |
| `InventoryMovement` | Stock truth | Created by posting receipt/issue/invoice/opening/etc. |
| `OpeningStock` / `OpeningStockLine` | Opening doc | Posts movements + GL slices (new services) |
| `Transfer` / `TransferLine` | Inter-warehouse | Posting pipeline |
| `Stocktaking` | Count adjustments | Posts differences |
| `ItemCostHistory` | Cost trail | Reconciliation target for `ItemCost` |

**Never insert incorrectly:**

- Positive/negative stock that bypasses `InventoryMovement` while ops modules expect movements.
- Opening stock without corresponding movement + valuation rules.
- Warehouse/item from wrong `companyId`.

---

## 5. Commercial documents

| Model | Purpose | Posting risk |
|-------|---------|--------------|
| `Invoice` / `InvoiceLine` | M5 sales/purchase | `invoice-posting-orchestrator` may post GL + stock |
| POS orders | Retail | Separate posting service |

**Invariant:** Migrated historical invoices must not re-trigger posting unless engine uses a **imported / frozen** status (see `HISTORICAL_DOCUMENT_STRATEGY.md`).

---

## 6. Treasury & manufacturing (partial product)

Models exist for cash, cheques, production orders, etc. Legacy `CashTrx*`, `CKTrx*`, `ManufactProcess*` map here — **mostly UNMAPPED** in current ETL.

---

## 7. Audit & legacy keys

Common migration fields on transactional models:

- `legacyGlNum`, `legacyCompanyCode`, `legacyBranchCode`, `legacyStoreCode`, `legacyYearId`
- `createdBy` — ETL uses `'legacy-import'` placeholder

**Future:** `migrationJobId` / provenance column — **not in schema yet** (architecture doc).

---

## 8. Model counts

| Category | Count (approx.) |
|----------|----------------|
| Total Prisma models | **309** |
| Tenant-scoped (auto `companyId` extension) | **~135** (`tenant-scoped-models.generated.ts`) |
| Migration phase A–C touch | **~15** entity types |
| Full parity (570 legacy tables) | Requires domain expansion |

---

## 9. How records are expected to be created (canonical paths)

| Domain | Canonical writer | Migration must |
|--------|------------------|----------------|
| GL | `journal-entry.service`, `journal-posting.service` | Either call same services with `skipPosting` flags or insert equivalent final state |
| Stock | `stock-movement.service`, document services | Opening via `opening-stock.service` pattern |
| Invoice | `invoice-m5.service`, orchestrator | Avoid double post |
| Party balance | GL + allocations | No orphan `mainAccountId` |

**Confidence:** **HIGH** for models touched by existing ETL; **MEDIUM** for full module parity.
