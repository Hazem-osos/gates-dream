# Gates ERP — Inventory / Warehouses module (complete logic, read-only)

**Audit date:** 2026-10-01  
**Scope:** Current `gates-web` + `gates-backend` + Prisma schema as in repo.  
**Rule:** Describes what the code **does**, not what it should do. Inconsistencies are called out explicitly.

Companion files: `INVENTORY_FLOW_MAP.md` (diagrams), `INVENTORY_LOGIC_MATRIX.md` (tables).

---

## 2. Inventory module map (actual Gates structure)

```
INVENTORY (gates-web: /inventory/*, API: /api/v1/inventory/*)
├── Master data (creations + guide)
│   ├── Items, item card, categories/groups, units, barcodes
│   ├── Stores (warehouses), locations
│   ├── Customers, suppliers, price lists, pricing policies
│   ├── Order limits, item offers, clothing matrix, representatives commissions
│   └── Customer contracts
├── Operations (transactions)
│   ├── Sales / purchase invoices & returns, sales order, purchase order
│   ├── Opening stock, receipt, issue, transfer, adjustment, other additions/discounts
│   ├── Stocktaking, item reservation, assembly/disassembly, landed cost
│   └── Invoice installments, price quotes
├── Settings
│   └── Per-document transaction settings (/inventory/settings/transactions/[documentType])
├── Reports (large set — mostly invoice/stock/party analytics)
└── Promotions (partial)
```

| Area | Arabic (typical UI) | Internal | Frontend route | Backend mount | Main models | Purpose |
|------|---------------------|----------|----------------|----------------|-------------|---------|
| Items | الأصناف / بطاقة صنف | `Item` | `/inventory/creations/items`, `item-card` | `/api/v1/inventory/items` | `items`, `item_units`, `item_prices` | SKU master, pricing, flags |
| Categories | مجموعات/فئات | `ItemCategory` | `creations/item-groups`, `categories` | `item-categories` | `item_categories` | Grouping + GL defaults |
| Warehouses | المخازن | `Warehouse` | `creations/stores` | `warehouses` | `warehouses`, `locations` | Storage + GL accounts |
| Sales invoice | فاتورة مبيعات | `Invoice` SALE | `operations/sales-invoice` | `invoices` (+ orchestrator) | `invoices`, `invoice_lines` | Sell + stock out + AR |
| Purchase invoice | فاتورة مشتريات | `Invoice` PURCHASE | `operations/final-purchase-invoice` | same | same | Buy + stock in + AP |
| Opening stock | أرصدة أول المدة | `OpeningStock` | `operations/opening-stock` | `opening-stock` | `opening_stocks`, lines | Initial qty/cost |
| Receipt | إذن إضافة | `Receipt` | `operations/receipt` | `receipts` | `receipts`, lines | Non-invoice stock IN |
| Issue | إذن صرف | `Issue` | `operations/issue` | `issues` | `issues`, lines | Non-invoice stock OUT |
| Transfer | تحويل مخزني | `Transfer` | `operations/transfer` | `transfers` | `transfers`, lines | WH A → WH B |
| Adjustment | تسوية كميات | `Adjustment` | `operations/adjustment` | `adjustments` | `adjustments`, lines | Qty correction |
| Stocktaking | جرد | `Stocktaking` | `operations/stocktaking` | `stocktaking` | `stocktakings`, lines | Count vs book |
| POS | (module `/pos`) | `PosOrder` | POS app routes | `/api/v1/pos/*` | `pos_orders`, lines | Retail sale/return |
| Manufacturing | (module `/manufacturing`) | `ProductionOrder` | manufacturing UI | manufacturing routes | BOM, production | Consume raw, produce FG |
| Reports | تقارير المخزون/المبيعات | various | `/inventory/reports/*` | `inventory/reports` | movements, invoices | Analytics |

**Also mounted:** legacy alias `/api/v1/items` → same item routes (`app.ts`).

**Page count:** **125** Next.js `page.tsx` files under `gates-web/app/inventory/` (includes previews and duplicates like `opening-stock` at two paths).

**Backend route handlers:** **277** `router.get/post/put/patch/delete` registrations under `gates-backend/src/modules/inventory/` (excluding POS/manufacturing/invoice orchestrator modules that still touch stock).

---

## 3. Screens / pages

### 3.1 How to read this section

- **Save** usually persists document rows with `isPosted=false` (draft).
- **Post** runs service `post*` inside a DB transaction, sets `isPosted=true` via optimistic claim (`claimDocumentPost` or invoice `updateMany` + `version`).
- **Unpost** reverses movements/journals and flips `isPosted=false`.
- **Cancel** sets `isCancelled` (behavior varies by document).
- **Delete** generally only for drafts; posted docs use unpost/cancel.

Detailed file references point to `gates-web/app/inventory/...` pages and matching `*.service.ts` + `*.routes.ts`.

### 3.2 Operations (stock-critical)

#### فاتورة مبيعات — `operations/sales-invoice/page.tsx`

- **Purpose:** Create/edit/post sales invoices; optional settlement (treasury).
- **Reads:** Items, warehouses, customers, transaction settings (`/transaction-settings/SALES_INVOICE`), invoice API.
- **Save:** `invoice.service` — draft lines, no stock.
- **Post:** `invoice-posting-orchestrator.ts` — stock OUT via `inventoryCostingService.applyOutboundMovement` (`COSTING_MOVEMENT.SALE`), COGS + revenue GL, `affectStore` per line/item type.
- **Unpost:** Reverses movements (`stockDelta` negated) and journals.
- **Permissions:** Legacy advanced rights e.g. `PIPost` (sales post flag naming is legacy-inverted in comments).
- **Validation:** Negative stock via `stockMovementService.assertNegativeStockAllowed`; fiscal period; below-cost guard `assertNotSellingBelowCost`.

#### فاتورة مشتريات — `operations/final-purchase-invoice/page.tsx`

- **Post:** Inbound MAC per line `computePurchaseLineNetCost`; updates `lastPurchasePrice` when configured.
- **GL:** Supplier debit, inventory credit, taxes per transaction settings.

#### مردود مبيعات / مشتريات — `sales-returns`, `purchase-returns`

- Return kinds `SALE_RETURN` / `PURCHASE_RETURN`; stock direction inverted vs base sale/purchase.

#### أرصدة أول المدة — `operations/opening-stock/page.tsx`

- **Service:** `opening-stock.service.ts` — post creates inbound movements (`COSTING_MOVEMENT.ADJUSTMENT_POSITIVE` / opening source types), optional GL.
- **Rights:** `FTPost` / `FTUnpost` via `store-document-rights.ts`.

#### إذن إضافة / إذن صرف — `receipt/page.tsx`, `issue/page.tsx`

- **Services:** `receipt.service.ts`, `issue.service.ts`.
- **Post:** `inventoryCostingService` + `stockMovementGlService.postGoodsReceiptGlInTx` / `postGoodsIssueGlInTx`.
- **Accounts:** Offset account on document + warehouse `inventoryAccountId` (`pickInventoryAccount` with perpetual/periodic).

#### تحويل مخزني — `operations/transfer/page.tsx`

- **Service:** `transfer.service.ts` — two legs `TRANSFER_OUT` / `TRANSFER_IN` in one transaction; `lockStockRowsInTx`; branch resolution includes warehouse branch fallback.
- **GL:** `postTransferValueGlInTx` when source/dest inventory accounts differ.

#### جرد — `operations/stocktaking/page.tsx`

- **Service:** `stocktaking.service.ts` — `bookQuantity` vs `actualQuantity`; surplus inbound at specified or last purchase / average cost; shortage outbound at MAC.
- **Rights:** `SCPost` / `SCUnpost`.

#### تسوية — `operations/adjustment/page.tsx`, `other-additions-discounts`

- **Services:** `adjustment.service.ts`, `other-adjustment.service.ts` — same movement/GL patterns as stocktake variance.

#### حجز صنف — `operations/item-reservation/page.tsx`

- **Service:** `item-reservation.service.ts` — adjusts `item_warehouse_balances.reservedQuantity` only (no `inventory_movements`).

#### تجميع / تفكيك — `assembly`, `disassembly`

- **Services:** `assembly.service.ts`, `disassembly.service.ts` — component OUT, finished IN; `postInventoryTransformationGlInTx`.

#### أوامر شراء / عروض أسعار / عروض أصناف

- Purchase order / price quote / item offers — mostly **non-posting** or pre-invoice; stock hits on purchase **invoice** post unless LC/trade path posts separately.

### 3.3 Master data (no stock movement on save)

| Page route | Backend | On create |
|------------|---------|-----------|
| `creations/items`, `item-card` | `item.service.ts` | `Item` row; **no** auto `ItemWarehouseBalance` for all warehouses |
| `creations/stores` | `warehouse.service.ts` | `Warehouse`; existing items **not** auto-seeded with balances |
| `creations/categories` | `item-category` routes | Category tree |
| `guide/locations` | `location.service.ts` | Locations under warehouse |

**Item card** reads balances via APIs using `item_warehouse_balances` / quantities (`item.service.ts` balance queries).

### 3.4 Reports

Each report page under `inventory/reports/*` calls `GET /api/v1/inventory/reports/...` (see `reports.routes.ts`). Preview routes reuse same APIs with print layout.

**Representative stock reports:**

- **جرد الأصناف** `inventory-reports` → `getInventoryCountReport` / `inventory-count-report.ts` — live vs historical quantity paths (`usesLiveWarehouseBalances`).
- **حركة صنف** `item-movement-reports` → `item-movement-report.ts` → `inventory_movements`.
- **أرصدة أصناف** `item-balances` → warehouse balances aggregation.
- **تقييم المخزون** `valuation` → value from qty × cost fields.

Invoice-centric reports (sales, purchases, profit, analytical) read **posted invoices** primarily; stock quantity may be derived from movements for analytical views (`reports.service.ts`).

### 3.5 Settings

- **`/inventory/settings/transactions/[documentType]`** — `TransactionSettingsScreen`; drives GL slots, cost center side, inventory behavior per document type (stored in `TransactionSettings` model, used by invoice orchestrator and resolvers).

---

## 4. Source of truth for stock quantity

### 4.1 Direct answer

Gates uses **(D) a combination**:

1. **`item_warehouse_balances.quantityOnHand`** — primary for **current warehouse-level** on-hand (`stock-query.service.ts` comment: “Instant on-hand reads from `item_warehouse_balances`”).
2. **`item_quantities`** — **location-level** split (and row locks in `stockMovementService`); when `locationId` is null at warehouse level, balance table is authoritative for aggregates.
3. **`inventory_movements`** — **append-only ledger**; sum of `quantityDelta` with `effectiveAt <= asOf` is authoritative for **historical as-of** company quantity (`getCompanyItemQuantityAsOf`).

All three are updated together in **`stockMovementService.postMovementInTx`** (single transaction). That is the intended invariant.

### 4.2 Table

| Concept | Current source | Updated by | Used by | Auth vs cache | Risk |
|---------|----------------|------------|---------|---------------|------|
| Warehouse on-hand | `item_warehouse_balances` | `adjustStockInTx` in same TX as movement | Posting, negative stock (no loc), dashboards | Authoritative live | Bypassing `postMovementInTx` causes drift |
| Location on-hand | `item_quantities` | `postMovementInTx` | Location stock, locks | Authoritative live | Must stay equal to sum of locs per WH |
| Historical qty | Σ `inventory_movements` | Every post | Cost engine `getCompanyItemQuantityAsOfInTx`, reports | Authoritative as-of | Live balance ≠ movement sum if repair not run |
| Reserved / available | `item_warehouse_balances.reservedQuantity` | `item-reservation.service` | Available = on-hand − reserved | Authoritative | Reports must subtract reserve (fixed paths in `inventory-count-report`) |
| Item card `beginningBalance` | `items.beginningBalance` | Manual card | Display/legacy | **Not** live stock | Misinterpretation |
| `items.averageCost` | Denormalized MAC | `inventoryCostingService.syncItemValuation` | UI, stocktake fallback cost | Cached snapshot | Can lag until next movement |

**CURRENTLY INCONSISTENT:** `itemCostService.getCompanyItemQuantityAsOfInTx` falls back to summing `item_quantities` if movement aggregate is null — two different fallbacks exist between services; normally movements should always exist after first post.

---

## 5. Item logic

### 5.1 Creation

- **Creates:** `items` row (+ optional `item_units`, barcodes via separate APIs).
- **Does not** create `item_warehouse_balances` for every warehouse on create (lazy: first movement INSERT … ON DUPLICATE KEY UPDATE).
- **New warehouse:** does not auto-create balance rows for all items.

### 5.2 Fields (business)

- **Codes:** `serial`, `barcode`, category; uniqueness enforced (migrations for unique name per company).
- **Types:** `isService` (non-stock), `isAssembly`, `clothingItem`, `itemType` string (normal/pack/roll etc.), `inactiveItem` / `isActive`.
- **Limits:** `upperLimit`, `lowerLimit`, `orderLimit`, warehouse-specific lists via `ItemOrderLimitList`.
- **Cost fields:** `averageCost`, `lastPurchasePrice`, `beginningCostPrice` — updated by costing service on inbound.
- **GL:** `salesAccountId`, `cogsAccountId`, `mainAccountId`; category may default accounts on invoices.

### 5.3 Units

- `ItemUnit` with `conversionFactor`, `isBaseUnit`; invoice lines store `baseQuantity` for stock.

---

## 6. Warehouse / store logic

- **Model:** `warehouses` — `code`, `arabicName`, `branchId`, `parentWarehouseId`, `warehouseKind` (`HEADER` vs `POSTING`), `inventoryAccountId`, `costAccountId`, `giftAccountId`, `isActive`.
- **Create:** No bulk item balance initialization.
- **Edit account:** Does not retroactively repost old journals; affects **future** GL resolution via `loadWarehouseGlMap`.
- **Deactivate:** `postMovementInTx` rejects inactive warehouse.
- **HEADER warehouse:** Cannot post if active children exist (`assertWarehouseActive`).
- **Delete:** `warehouse.service` checks movements/balances (counts `inventoryMovement`); blocked when dependencies exist.

---

## 7. Stock movement engine

### 7.1 `InventoryMovement` fields (business meaning)

| Field | Meaning |
|-------|---------|
| `companyId`, `branchId` | Tenant / branch |
| `warehouseId`, `itemId`, `locationId?` | Where |
| `quantityDelta` | Signed change (+ in, − out) |
| `unitCost`, `resultingAverageCost` | Cost snapshot on row |
| `movementType` | e.g. `PURCHASE`, `SALE`, `TRANSFER_IN`, … |
| `sourceType`, `sourceNumber`, `sourceYearId`, `sourceDocumentId` | Trace to document |
| `documentDate`, `effectiveAt` | Dating for ledger ordering / MAC |

### 7.2 Creator matrix

See `INVENTORY_LOGIC_MATRIX.md` §1. Universal path: **`inventoryCostingService`** → **`stockMovementService.postMovementInTx`**.

---

## 8. Receipt / issue

- **Draft:** Header + lines stored; no movement.
- **Post:** Per line inbound/outbound costing; GL pairs inventory with offset account from line/header.
- **Unpost:** `stockMovementGlService.reverseBySourceInTx` + opposite movements.
- **Account selection:** Warehouse perpetual → `warehouse.inventoryAccountId` else item/company (`pickInventoryAccount`); offset from line `accountId` or document default.

---

## 9. Transfer

- **Two movements** (OUT then IN) in **one** DB transaction.
- **Cost:** OUT valued at MAC; IN receives same unit cost (value transfer).
- **GL:** Only if inventory accounts differ between warehouses.
- **Unpost:** Reverses both legs; uses `claimDocumentUnpost`.
- **Concurrency:** `lockStockRowsInTx` on involved item/warehouse pairs.
- **Negative stock:** Enforced on OUT leg unless company allows negative.
- **Partial success:** Transaction rolls back entirely on failure.

---

## 10. Stocktaking

- **System qty:** `bookQuantity` on line (captured at draft/edit time — not continuously re-read on post).
- **Counted:** `actualQuantity`.
- **Difference:** `actualQuantity - bookQuantity` on post.
- **Shortage (−):** Outbound MAC + GL shrinkage (if GL ctx).
- **Surplus (+):** Inbound at line price or `lastPurchasePrice` / `averageCost`.
- **Omitted lines:** No adjustment (unchanged).
- **Zero count:** If actual 0 and book > 0, full shortage outbound.
- **After count:** Later movements affect live stock; posted count is not auto-reopened.
- **Repeat post:** Blocked if `isPosted` (`claimDocumentPost`).

---

## 11. Adjustments

- **Quantity adjustment (`Adjustment`):** Same as stocktake line logic without count ceremony.
- **Other adjustment (`OtherAdjustment`):** Additional discount/addition types with dedicated GL (`postOtherAdjustmentGlInTx`).
- **Value-only:** No separate “revalue without qty” document found outside MAC replay (`recalculateItemCostHistory` in `inventory-costing.service.ts`).

---

## 12. Costing engine

### 12.1 Method

**Moving weighted average (MAC)** — `inventory-costing-math.ts` documents Delphi parity (`GetItemCost`). **Not FIFO** as primary.

### 12.2 Example (purchase then sale)

Opening: 10 × 100 (via opening stock post → MAC 100).  
Purchase: 10 × 120 → MAC = (10×100 + 10×120)/20 = **110**.  
Sale 5: outbound at **110**; COGS = 550; remaining qty 15 @ 110.

**Functions:**

- Inbound MAC: `computeMovingAverageCost` / `applyInboundToState`
- Outbound: `applyOutboundToState` (COGS = qty × snapshot average)
- Persist: `item_cost_history`, `items.averageCost`, `item_warehouse_balances.averageCost`
- Repair: `replayItemCostHistory` / `recalculateItemCostHistory`

### 12.3 Edge behaviors (actual)

- **Backdated purchase:** `effectiveAt` / `resolveEffectiveAt` can reorder MAC vs later movements; repair tool replays chronologically.
- **Negative stock inbound:** MAC uses inbound cost when existing qty ≤ 0 (`computeMovingAverageCost`).
- **Unpost:** Opposite movement types; cost history may require recalc for consistency.
- **Sale return:** Prefers `unitCostAtIssue` from original line when linked.

---

## 13. Sales → inventory

Trace: `sales-invoice` → `POST /inventory/invoices/:id/post` → `invoice-posting-orchestrator`:

1. Claim post (`isPosted`, `version`).
2. Sort lines for lock order.
3. For each stock line: `resolveInvoiceLineWarehouseId` (line WH or header).
4. `applyOutboundMovement` → movement + balances.
5. Aggregate COGS by inventory/COGS accounts.
6. Build AR/revenue/tax journal.

**Discounts:** Affect revenue/tax, not outbound unit cost (COGS from MAC).  
**Gifts:** Warehouse `giftAccountId` / line flags per resolver (see invoice account resolver).  
**Service lines:** Skip stock when `isService` / `affectStore` false.

---

## 14. Purchases → inventory

- Inbound at **net unit cost** after discounts (`computePurchaseLineNetCost`).
- Taxes do not inflate inventory unit cost unless configured in line math (see purchase line cost helper).
- **Landed cost:** `landed-cost` module can allocate additional costs (separate routes).
- **Payment** on invoice does not change stock (treasury only).

---

## 15. POS → inventory

- **Service:** `pos-order-posting.service.ts` uses `inventoryCostingService` (comments: do not double-call `postMovementInTx`).
- **Hold orders:** No stock movement until post (tests: `pos-phase2-cashier.test.ts`).
- **Idempotency:** `clientRequestId` unique per company on create.
- **Return:** `POS-RETURN` movement type.
- **Offline replay:** Same idempotency key prevents duplicate orders; shift must be open.

**CURRENTLY INCONSISTENT:** POS journal uses `posAccountResolverService` while sales invoice uses invoice transaction settings — accounts may differ for same economic event.

---

## 16. Manufacturing → inventory

- **Module:** `production-order.service.ts`, `manufacturing-costing.service.ts`.
- **Post:** Raw materials OUT, finished goods IN via `stockMovementService.postMovementInTx`.
- **BOM:** `BillOfMaterials`, `BomLine`, `ProductionMaterialIssueLine`.
- Uses same movement engine as inventory ops.

---

## 17. Accounting integration

See matrix in `INVENTORY_LOGIC_MATRIX.md` §3.

**Precedence (perpetual):** warehouse inventory account → item inventory account → company default (`pickInventoryAccount`).  
**Periodic:** company inventory account only.

**Transaction settings:** Per `documentType` in `TransactionSettings` — revenue/COGS/inventory slots, cost center allocation (`invoice-posting-orchestrator`, `TransactionSettingsForm` on web).

---

## 18. Post / unpost / cancel / delete

| Document | Draft | Post | Unpost | Cancel | Delete posted |
|----------|-------|------|--------|--------|---------------|
| Invoice | Editable | Stock+GL | Reverse | Cancel flag | No |
| Store docs | Editable | Stock+optional GL | Reverse | Cancel | No |
| POS order | Draft/hold | Stock+GL | Dedicated unpost | Void paths | No |

Mechanism: **reversal movements** + **journal reverse by source**, not hard delete of movements.

---

## 19. Negative stock

- **Config:** `company_settings.allowNegativeBalance`, `preventNegativeStock`, legacy flags `AllowMinusQty`, `AllowNegativeStore` (`stock-movement.service.ts`, `strict-inventory.ts`).
- **Document-level:** `transaction_settings.preventNegativeStock` + `affectStock` → `forceStrictNegativeCheck` on invoice/POS post (and M5 draft via `forceMinusQty`), blocking negative even when the company allows it.
- **Default posture:** Block negative unless explicitly allowed.
- **Enforcement:** Inside transaction **after** `FOR UPDATE` locks on `item_warehouse_balances` / `item_quantities`.
- **Bypass:** `allowNegativeStock: true` on movement input (no production outbound callers).
- **Concurrency:** Two sales of last unit — second should fail 422 when strict (integration tests: `invoice-unpost-concurrency`, `inventory-document-post-concurrency`).

---

## 20. Concurrency / idempotency

| Mutation | Boundary | Lock / claim |
|----------|------------|--------------|
| Invoice post | `prisma.$transaction` | `updateMany` isPosted+version; stock locks ordered |
| Store doc post | `$transaction` | `claimDocumentPost` |
| Movement | `$transaction` | `lockWarehouseBalanceInTx`, `lockItemQuantityInTx` |
| POS create | TX + unique `clientRequestId` | Returns existing order |
| Transfer | Single TX both legs | `lockStockRowsInTx` |

**Risks:** Fire-and-forget automation on low stock does not use TX client (documented in code).

---

## 21. Inventory reports (catalog)

**39** report route handlers in `reports.routes.ts` (includes aliases). Major groups:

- Document: sales, purchases, returns, tax, commissions
- Stock: inventory count, item balances, movement, valuation, transfer, slow-moving, reorder, warehouse compare/pulse
- Party: customer/supplier balances, account statements, party-with-items
- Profit: invoice/item/stock profit sheets

**Calculation rules:** Document reports filter `isPosted` unless `showUnposted`; stock qty per §4; profit uses line `unitCost` / COGS fields on posted invoices.

---

## 22. Where did this number come from?

### Current stock (warehouse, UI item card)

```
UI item card / lookup
  → API item or warehouse dashboard
  → stockQueryService.getWarehouseQuantity / getWarehouseItemBalance
  → item_warehouse_balances.quantityOnHand (or item_quantities if location)
```

### Available stock

```
quantityOnHand - reservedQuantity
  → item_warehouse_balances (reservation service updates reserved only)
```

### Average cost

```
items.averageCost (UI)
  ← inventoryCostingService.syncItemValuation after movements
  ← item_cost_history latest effectiveAt (getCostsAsOf for posting)
```

### COGS on sale

```
invoice post → applyOutboundMovement → unitCost × qty
  → journal COGS lines + invoice line cost fields
```

### Stocktake system qty

```
Captured on StocktakingLine.bookQuantity at line save
  (not re-read from live balance at post time unless UI refreshes)
```

---

## 23. Inventory settings

| Setting | Where stored | Effect |
|---------|--------------|--------|
| `inventorySystem` PERPETUAL/PERIODIC | `company_settings.advancedSettings` | GL account pick (`inventory-system.ts`) |
| Negative stock flags | `company_settings` + legacy `company_setting_entries` | `isStrictInventory` |
| Transaction settings per doc | `transaction_settings` | GL slots, cost center side, locks |
| Store document rights | `advanced_rights` | Post/unpost store docs |
| Default warehouse on item | `items.defaultWarehouseId` | Invoice line default |

Changes affect **future** posts; historical JEs not auto-restated.

---

## 24. Legacy / duplicate paths

| OLD PATH | NEW PATH | Who uses OLD |
|----------|----------|--------------|
| Direct `item_quantities` RMW | `stockMovementService` | Should be none in store docs (H1 fix comments) |
| `itemCostService` Delphi port | `inventoryCostingService` + math | Both exist; orchestrator uses costing service |
| `/api/v1/items` | `/api/v1/inventory/items` | Legacy clients |
| Sum `item_quantities` fallback | Movement sum | `getCompanyItemQuantityAsOfInTx` fallback only |
| Treasury-only voucher reports | CashTransaction | Party reports (fixed in party-item-account for collections) |
| ~~Wave0 `POST /inventory/movements/post`~~ (removed) | Document-wrapped posts | Use GI/GR/invoice/etc. |

---

## 25. Business examples (actual logic)

### Example 1 — Purchase then sale

See §12.2; journals add AP/AR and tax per settings.

### Example 2 — Transfer 3 from A→B (A=10, B=5, MAC 50)

After: A=7, B=8; movements −3 and +3; GL if accounts differ for 3×50.

### Example 3 — Stocktake 10 book, 8 actual

Δ=−2 outbound MAC; GL expense if configured.

### Example 4 — Sale 3, return 1

Return inbound 1 at original issue cost if linked; COGS reversal partial.

### Example 5 — Purchase return

Outbound  at MAC; reduces AP via purchase return posting.

### Example 6 — Concurrent last unit

Second post fails with Arabic 422 when strict inventory.

---

## 26. Business vs technical (summary)

| Feature | Business (AR) | Technical anchor |
|---------|---------------|------------------|
| بيع | يخصم المخزن ويُسجّل تكلفة ومبيعات | `invoice-posting-orchestrator` + `inventoryCostingService` |
| شراء | يزيد المخزن ويُحدّث المتوسط | `applyInboundMovement PURCHASE` |
| تحويل | يقلّ مخزن ويزيد آخر | `transfer.service.ts` two legs |
| جرد | يعدّل الفرق | `stocktaking.service.ts` |
| تكلفة | متوسط متحرك | `inventory-costing-math.ts` |

---

## 27. Documented inconsistencies

1. **Triple quantity store** — must move together; any orphan path is inconsistent.
2. **Book qty on stocktake** — snapshot vs live at post.
3. **POS vs sales invoice** — different account resolvers.
4. **Historical reports** — movement sum vs live `item_warehouse_balances` depending on `toDate` (`usesLiveWarehouseBalances`).
5. **Location vs warehouse totals** — `planUnlocatedQuantitySync` / integrity helpers exist to mitigate drift.

---

## 28. Inventory logic risks (report only)

| Sev | Risk | Evidence | Flow | Consequence |
|-----|------|----------|------|-------------|
| CRITICAL | Quantity triple-store drift if bypass | Comments H1 fixes; only unified path in services | Any future direct SQL | Reports ≠ physical |
| HIGH | Stocktake book qty stale | `bookQuantity` stored at edit | Stocktaking post | Wrong adjustment |
| HIGH | Historical vs live report split | `inventory-count-report.ts` | Inventory reports | Different totals by date filter |
| MEDIUM | MAC after backdated docs | Replay not automatic on every unpost | Purchases/sales | COGS drift until repair |
| MEDIUM | GL skip when accounts missing | `stock-gl-posting-guard` | Store post | Stock without JE |
| MEDIUM | POS vs invoice account mapping | Separate resolvers | Retail vs wholesale | Misclassified accounts |
| LOW | `AllowNegativeStore` legacy unused in Delphi | Comment in stock-movement | Settings | Operator confusion |

**Counts:** CRITICAL 1, HIGH 2, MEDIUM 3, LOW 1 (demonstrated in code paths above).

---

## 29. لو عايز تفهم مخازن Gates في 10 دقايق (للمالك)

1. **الصنف** يتسجّل في جدول `items` مع وحدات وأسعار؛ مش بننشئ رصيد في كل مخزن تلقائياً.
2. **رصيد المخزن الحالي** معروض من `item_warehouse_balances` (وممكن تفصيل موقع من `item_quantities`).
3. **يزيد المخزون:** مشتريات، مردود مبيعات، إذن إضافة، جرد زيادة، تحويل وارد، تجميع منتج نهائي، أرصدة أول مدة.
4. **ينقص:** مبيعات، مردود مشتريات، إذن صرف، جرد نقص، تحويل صادر، صرف خام تصنيع، POS.
5. **التكلفة:** متوسط متحرك على مستوى الشركة/المخزن؛ كل حركة بتسجّل في `item_cost_history`.
6. **البيع:** مش بيحرّك المخزن غير لما تضغط **ترحيل**؛ يخصم بالمتوسط ويطلع قيد COGS.
7. **الشراء:** ترحيل يزيد الكمية ويحدّث المتوسط بسعر الصافي بعد الخصم.
8. **التحويل:** حركتين (صادر/وارد) في معاملة واحدة بنفس التكلفة.
9. **الجرد:** الفرق بين المسجّل والفعلي يتحوّل حركة تسوية (+ قيد لو الحسابات مكتملة).
10. **المرتجع:** عكس اتجاه البيع/الشراء مع استرجاع تكلفة أصلية لمردود المبيعات إن كان مربوطاً بفاتورة.
11. **الحسابات:** من إعدادات المعاملة + حسابات المخزن/الصنف؛ مخزون دوري vs مستمر يغيّر أي حساب مخزون يُستخدم.
12. **التقارير:** الرصيد اللحظي من أرصدة المخازن؛ الحركة التاريخية من `inventory_movements`; فواتير مرحّلة للأرباح والمبيعات.

---

## Appendix A — Main Prisma models (inventory-related)

`Item`, `ItemUnit`, `ItemCategory`, `ItemPrice`, `ItemBarcode`, `Warehouse`, `Location`, `ItemQuantity`, `ItemWarehouseBalance`, `ItemReservation`, `InventoryMovement`, `ItemCostHistory`, `OpeningStock`, `Stocktaking`, `Transfer`, `Receipt`, `Issue`, `Adjustment`, `OtherAdjustment`, `Assembly`, `Disassembly`, `PurchaseReturn`, `Invoice`/`InvoiceLine`, `PosOrder`/`PosOrderLine`, `ProductionOrder`, BOM tables, `InventoryItemLot`, `InventoryItemSerial`, `LandedCost*`, `TransactionSettings`.

---

## Appendix B — Key backend files

| Concern | File |
|---------|------|
| Movement write | `stock-movement.service.ts` |
| Balance mutate | `adjust-stock-in-tx.ts` |
| MAC | `inventory-costing.service.ts`, `inventory-costing-math.ts` |
| Invoice stock+GL | `invoice-posting-orchestrator.ts` |
| Store docs | `receipt.service.ts`, `issue.service.ts`, `transfer.service.ts`, `stocktaking.service.ts`, `adjustment.service.ts`, `opening-stock.service.ts` |
| Store GL | `stock-movement-gl.service.ts` |
| Reports | `reports.service.ts`, `inventory-count-report.ts`, `item-movement-report.ts` |
| POS stock | `pos-order-posting.service.ts` |
| Manufacturing | `production-order.service.ts` |

---

*End of read-only inventory logic exploration document.*
