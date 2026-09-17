# M4 — Inventory Master & Stock Operations

## 1. Module Overview & Legacy Source Analysis

### Domain scope

Item master (units, categories, colors/sizes, barcodes), warehouse/store chart, stock quantities by store, **moving-average cost** history, opening stock, transfers, stocktaking, receipts/issues/adjustments, assemblies, expire dates, serials, and warehouse reports. Feeds M5 invoices and M8 manufacturing.

### Key Delphi files

| Area | Units |
|------|--------|
| Items | [untItem.pas](../../../MainProgram/untItem.pas), [untChartOfItems.pas](../../../MainProgram/untChartOfItems.pas), [untItemGroupCard.pas](../../../MainProgram/untItemGroupCard.pas), [Untitemcat.pas](../../../MainProgram/Untitemcat.pas) |
| Stores | [untChartOfStores.pas](../../../MainProgram/untChartOfStores.pas), [untStoreCard.pas](../../../MainProgram/untStoreCard.pas) |
| Movements | [UntStoreTrans.pas](../../../MainProgram/UntStoreTrans.pas), [UntStoreAdd.pas](../../../MainProgram/UntStoreAdd.pas), [UntStoreCheck.pas](../../../MainProgram/UntStoreCheck.pas), [UntStoreColl.pas](../../../MainProgram/UntStoreColl.pas), [UntStoreDist.pas](../../../MainProgram/UntStoreDist.pas) |
| Opening | [UntItemsFirstTime.pas](../../../MainProgram/UntItemsFirstTime.pas) |
| Expiry / serial | [UntExpireDate.pas](../../../MainProgram/UntExpireDate.pas), [untItemSerials.pas](../../../MainProgram/untItemSerials.pas) |
| Pricing | [untPriceList.pas](../../../MainProgram/untPriceList.pas), [untItemOffer.pas](../../../MainProgram/untItemOffer.pas) |
| Kernel costing | [untgeneral.pas GetItemCost](../../../MainProgram/untgeneral.pas) ~7791–7934 |
| Reports | [UntSTRep.pas](../../../MainProgram/UntSTRep.pas), many `UntST*Rep.pas` |

### Underlying database tables

| Table | Maps to (target) |
|-------|------------------|
| `Item`, `ItemUnit`, `ItemDetail`, `Itemcat`, `ItemColor`, `ItemSize`, `ItemColorSize` | Item master |
| `Store` | `Warehouse` |
| `ItemStore` | `ItemQuantity` |
| `ItemCost` | **New `ItemCostHistory`** |
| `ItemsFirstTimeH/D` | `OpeningStock` / lines |
| `StoreTransHeader/Detail` | `Transfer` |
| `StoreCheckHeader/Detail` | `Stocktaking` |
| `StoreAdjustHeader/Detail` | `Adjustment` / receipts/issues |
| `AllWarehousingTrans`, `AllWarehousingTrans1` | Consolidated movement view (reporting) |
| `ExpireDateHistory`, `ExpireDateHistoryCheck` | Expiry batches |
| `ItemSerials` | `SerialNumber` |
| `PriceListH/D`, `ItemOfferH/D` | Price lists & offers |
| `InvoiceTrxHeader/Detail` | M5 (stock-affecting invoices) |

---

## 2. Business Logic, Formulas & Accounting Rules

### Core operations & flows

1. **Item CRUD:** Units of measure, default store, tax flags, cost method company setting, min/max qty.
2. **Warehouse CRUD:** Store types (`StoreType`, e.g. `'D'` default in costing query), deleted flag.
3. **Opening stock:** `ItemsFirstTime` posts quantities and costs into stores + seeds `ItemCost`.
4. **Transfer / adjust / stocktake:** Update `ItemStore` qty; may trigger GL via M1 (company dependent).
5. **Invoice-driven cost (purchase/sales):** `GetItemCost` called from invoice posting when store affected.

### Moving average cost (`GetItemCost`)

**Inputs:** `ItemCode`, `InvoiceDate`, `ItemCount`, `ItemPrice`, `SourceNum`, `SourceYearId`, `SourceType`, `Change` (currency factor).

**Algorithm (legacy):**

1. Load prior cost row for same source (if repost) → `SaveDateTime`.
2. Find **last cost** for item where `SaveDateTime <=` transaction datetime → `OldCost` (else 0).
3. `OldItemCount = GetAllItemsCount(ItemCode, InvoiceDate)` (company-wide qty before this line).
4. **Purchase invoice special:** If `SourceType` starts with `PI` and `ItemPrice=0`, add pay-count qty from invoice lines with non-zero price to `OldItemCount`.
5. Compute **NewCost:**
   - If `OldItemCount + ItemCount <= 0` → `NewCost = ItemPrice * Change`
   - Else if weighted average `< 0` → `NewCost = ItemPrice * Change`
   - Else →  
     `NewCost = ((OldItemCount * OldCost) + (ItemCount * ItemPrice * Change)) / (OldItemCount + ItemCount)`
6. Insert new `ItemCost` row with monotonic `Serial` (8-digit), storing source keys and `SaveDateTime`.

**Latest cost lookup (reporting SQL in untgeneral ~11597):**

Subquery: max `Serial` per `ItemCode` from `ItemCost` → join for `ItemCost` value; inventory value = `Sum(Qty * ItemCost)`.

### Accounting & journal entry generation

Inventory modules may post COGS/inventory GL on:

- Issues/adjustments (accounts from company settings).
- Invoice posting (M5)—not in M4 forms alone.

Document account pairs during M5/M22 posting rules import.

### Validation rules & edge cases

- Negative stock: company/setting may block or allow (`untRInovice` / store checks—verify in M5).
- **Deleted stores** excluded: `Deleted = 'F'`.
- Repost same invoice: idempotent handling via source keys on `ItemCost` (delete block commented in legacy—Node should upsert by source).
- Expire-date tracked items: separate `ExpireDateHistory` on issue/receipt.
- Serial-tracked items: `ItemSerials` must match qty on issue.

---

## 3. Architecture Modernization & Refactoring Plan

### Legacy smells

- Cost rows inserted without wrapping stock+GL in one transaction.
- Qty aggregate `GetAllItemsCount` potentially expensive; repeated per line.
- Consolidated movement in `AllWarehousingTrans` as duplicate of detail tables.

### Target architecture

```
InventoryItemController / WarehouseController / ...
  → ItemService, WarehouseService
  → StockMovementService (transfer, adjust, stocktake)
  → ItemCostService (moving average — port GetItemCost exactly)
  → StockQueryService (qty as-of date)
```

**`prisma.$transaction`:**

- Apply movement lines + update `ItemQuantity` + insert `ItemCostHistory` + optional GL voucher (M1).

**Cache:** Optional materialized qty by item/store for read; source of truth remains movements.

---

## 4. Target Prisma Models & Data Schema

Existing coverage: `Item`, `Warehouse`, `ItemQuantity`, `Transfer`, `Stocktaking`, `OpeningStock`, etc.

**Add:**

```prisma
model ItemCostHistory {
  id            String   @id @default(uuid())
  companyId     String
  branchId      String
  itemId        String
  serial        Int
  cost          Decimal  @db.Decimal(18, 4)
  effectiveAt   DateTime // SaveDateTime
  documentDate  DateTime
  hijriDate     String?
  sourceType    String
  sourceNumber  String
  sourceYearId  String
  createdAt     DateTime @default(now())
  item          Item     @relation(fields: [itemId], references: [id])
  @@unique([companyId, itemId, serial])
  @@index([companyId, itemId, effectiveAt])
  @@map("item_cost_history")
}

model ItemWarehouseQuantity {
  id          String  @id @default(uuid())
  companyId   String
  warehouseId String
  itemId      String
  quantity    Decimal @db.Decimal(18, 4)
  reservedQty Decimal @default(0) @db.Decimal(18, 4)
  @@unique([companyId, warehouseId, itemId])
  @@map("item_warehouse_quantities")
}

model ExpireDateBatch {
  id          String   @id @default(uuid())
  companyId   String
  itemId      String
  warehouseId String
  batchCode   String
  expiryDate  DateTime
  quantity    Decimal  @db.Decimal(18, 4)
  @@map("expire_date_batches")
}
```

Align `Warehouse.legacyStoreCode` with `Store.StoreCode` for imports.

Use `@db.Decimal(18, 4)` on all qty and cost fields.

---

## 5. API Endpoint Specifications

Existing routes in [app.ts](../../../gates-backend/src/app.ts) (`/inventory/*`). Extensions:

| Method | Route | Purpose | Permission |
|--------|-------|---------|------------|
| GET | `/api/v1/inventory/items/:id/cost-history` | serial cost trail | `inventory.view` |
| GET | `/api/v1/inventory/items/:id/cost-as-of?date=` | OldCost equivalent | `inventory.view` |
| GET | `/api/v1/inventory/items/:id/quantity-as-of?date=` | GetAllItemsCount parity | `inventory.view` |
| POST | `/api/v1/inventory/cost/preview` | simulate GetItemCost | `inventory.cost` |
| CRUD | `/api/v1/inventory/expire-batches` | expiry | `inventory.manage` |
| POST | `/api/v1/inventory/movements/post` | unified post with `$transaction` | `inventory.post` |

Internal (M5): `ItemCostService.applyFromInvoiceLine(dto)` — not public HTTP.

---

## 6. Phased Execution & Unit Testing Strategy

### Checklist

- [ ] Add `ItemCostHistory` migration + import from legacy `ItemCost`.
- [ ] Implement `ItemCostService.calculateMovingAverage` — unit test against Delphi formula vectors.
- [ ] Implement `StockQueryService.getQuantityAsOf` to match `GetAllItemsCount`.
- [ ] Review each inventory route for `$transaction` on post.
- [ ] Map `Store` → `Warehouse`; `ItemStore` → quantities.
- [ ] Port expire/serial validations on issue/receipt endpoints.

### Parity tests

| # | Scenario | Expected |
|---|----------|----------|
| 1 | First receipt 100 @ 10 | cost = 10 |
| 2 | Second receipt 50 @ 12 | cost = (100*10+50*12)/150 = 10.6667 (4 dp) |
| 3 | Sale reducing qty without price change | cost unchanged; qty reduced |
| 4 | PI with zero-price line + priced lines | OldItemCount includes PayCount adjustment |
| 5 | OldItemCount+ItemCount <= 0 | cost = ItemPrice*Change |
| 6 | Weighted avg negative | fallback ItemPrice*Change |
| 7 | Transfer between warehouses | qty +/-; cost unchanged |
| 8 | Stocktake variance | adjustment qty; optional GL stub |

Golden files: export legacy `ItemCost` + `ItemStore` for one item from SQL Server; replay transactions in Node.

---

**Reference implementation:** [GetItemCost in untgeneral.pas lines 7791–7934](../../../MainProgram/untgeneral.pas).

**Wave 0:** Implement costing service and schema before M5 invoice posting.
