# Gates ERP — Inventory logic matrices (read-only audit)

Generated from codebase exploration (Oct 2026). Compact reference; narrative detail in `INVENTORY_LOGIC_COMPLETE.md`.

---

## 1. Transaction → quantity effect

| Source | Draft | Post qty effect | Tables touched | Movement row | Reversal |
|--------|-------|-----------------|----------------|--------------|----------|
| Opening stock (`OpeningStock`) | Lines saved only | +qty per line | `inventory_movements`, `item_quantities`, `item_warehouse_balances` | `ADJUSTMENT_POSITIVE` / opening source | Unpost: opposite deltas + `-UNPOST` types |
| Purchase invoice (`Invoice` PURCHASE) | No stock | +`baseQuantity` per line | Same via `inventoryCostingService.applyInboundMovement` | `PURCHASE` | Unpost: negative delta + cost replay |
| Sales invoice (`Invoice` SALE) | No stock | −`baseQuantity` | Same via `applyOutboundMovement` | `SALE` | Unpost reverses |
| Sales return | No stock | +qty (inbound) | Inbound at `unitCostAtIssue` or MAC | `RETURN_SALE` | Unpost reverses |
| Purchase return (`PurchaseReturn`) | No stock | −qty | Outbound MAC | `RETURN_PURCHASE` | Unpost reverses |
| Warehouse receipt (`Receipt`) | No stock | +qty | `postMovementInTx` | `GR` / receipt source | Unpost: `reverseBySourceInTx` |
| Warehouse issue (`Issue`) | No stock | −qty | `postMovementInTx` | `GI` | Unpost reverses |
| Transfer (`Transfer`) | No stock | OUT source, IN dest (2 legs) | Two movements same TX | `TRANSFER_OUT`, `TRANSFER_IN` | Unpost both legs |
| Adjustment (`Adjustment`) | No stock | ± per line | Costing in/out | `ADJUSTMENT_POSITIVE` / `ADJUSTMENT_NEGATIVE` | Unpost reverses |
| Other adjustment (`OtherAdjustment`) | No stock | ± | Same pattern | Custom source types | Unpost reverses |
| Stocktaking (`Stocktaking`) | `bookQuantity` snapshot | `actual − book` per line | Costing in/out | `ADJUSTMENT_*` | Unpost reverses |
| Assembly (`Assembly`) | No stock | Components OUT, finished IN | Transformation GL + movements | `ASSEMBLY_OUT` / `ASSEMBLY_IN` | Unpost reverses |
| Disassembly | No stock | Inverse of assembly | Same family | Disassembly source types | Unpost reverses |
| POS order (`PosOrder` posted) | Hold: no stock | SALE lines −qty | `inventoryCostingService` (same engine) | `SALE` / `POS-RETURN` | Unpost order |
| Production order (manufacturing) | — | Raw −, finished + | `stockMovementService` | Production-specific | Unpost in `production-order.service` |
| Item reservation | Active reserves | `reservedQuantity` only (no on-hand) | `item_warehouse_balances` | No movement | Release/cancel adjusts reserve |
| Landed cost / LC receipt | — | May post stock (trade module) | Via `stockMovementService` | Trade-specific | Per service |
| Demo seed | — | Optional movements | Demo only | `OPENING` | — |
| ~~Manual `POST /inventory/movements/post`~~ (removed) | — | — | — | — | Use store documents only |

**Service item (`Item.isService`):** invoice posting uses `affectStore` / line flags — non-stock lines skip quantity (see `invoice-posting-orchestrator.ts`).

---

## 2. Transaction → cost effect

| Source | Inbound cost basis | Outbound (COGS) basis | Updates `items.averageCost` | `item_cost_history` | Warehouse `averageCost` |
|--------|-------------------|------------------------|----------------------------|----------------------|-------------------------|
| Purchase | `computePurchaseLineNetCost` (net of line/header discount, FX) | — | Yes (MAC) | Yes, per receipt | `persistWarehouseAverage` |
| Sale | — | MAC at sale date (`getCostsAsOf` + outbound) | Qty only on movement | Outbound snapshot on movement | Warehouse MAC unchanged on outbound |
| Sale return | Original line cost or MAC if standalone | Reverses COGS buckets | Inbound may update MAC | Yes | Yes on inbound |
| Purchase return | — | MAC outbound | — | — | — |
| Transfer IN | Cost from OUT leg (value transfer) | — | Global sync | Optional | Dest warehouse |
| Transfer OUT | — | MAC at transfer | — | — | Source warehouse |
| Stocktake surplus | Line `unitPrice` or `lastPurchasePrice` / `averageCost` | — | Inbound MAC | Yes | Yes |
| Stocktake shortage | — | MAC outbound | — | — | — |
| Opening stock | Line `unitPrice` | — | Inbound | Yes | Yes |
| Assembly | Component valuations rolled up | Component outbound MAC | Finished inbound at computed unit | Yes | Yes |

**Method:** Moving weighted average (MAC) at company + warehouse level; replay in `inventory-costing-math.ts` (`replayItemCostHistory`). Not FIFO as primary engine.

---

## 3. Transaction → journal effect (inventory-related)

| Document | GL service entry | Typical debit | Typical credit | Account resolution |
|----------|------------------|---------------|----------------|------------------|
| Purchase invoice | `invoice-posting-orchestrator` + `autoGlPostingService` | Inventory / GRNI per settings | Supplier, tax | Item → category → transaction settings → company defaults |
| Sales invoice | Same | Customer, revenue | Inventory relief, COGS, tax | Per-line inventory/COGS/revenue accounts |
| Store receipt | `stockMovementGlService.postGoodsReceiptGlInTx` | Inventory | Offset / party | Warehouse `inventoryAccountId`, line offset |
| Store issue | `postGoodsIssueGlInTx` | Offset | Inventory | Warehouse accounts |
| Transfer (cross-value) | `postTransferValueGlInTx` | Dest inventory | Source inventory | Warehouse pair; skipped if same account |
| Stocktaking | `postStocktakingVarianceGlInTx` | Expense / inventory | Opposite | Company shrinkage + warehouse inventory |
| Adjustment | `postAdjustmentVarianceGlInTx` | Similar to stocktake | — | Document + warehouse |
| Other adjustment | `postOtherAdjustmentGlInTx` | Type-driven | — | Other adjustment types master |
| Opening stock | Opening stock GL in `opening-stock.service` | Inventory | Equity/opening | Warehouse + company |
| Assembly/disassembly | `postInventoryTransformationGlInTx` | Finished / components | Balanced transformation | Warehouse accounts |
| POS | `pos-order-posting.service` journal build | Cash/customer, revenue | Inventory, COGS, VAT | `posAccountResolverService` |

**Periodic inventory:** `getInventorySystem()` → `PERIODIC` uses company-level inventory account only (`inventory-system.ts`).

**GL skip:** `stock-gl-posting-guard.ts` / `runStockGlPostingOptional` — post stock without JE when accounts missing (422/skip flag on some routes).

---

## 4. Transaction → reversal / lifecycle

| Document | Save draft | Post claim | Unpost | Cancel | Delete |
|----------|------------|------------|--------|--------|--------|
| Invoices | `isPosted=false` | `invoice.updateMany` version+`isPosted` | Reverse stock + JE | `isCancelled` | Soft rules per `invoice.service` |
| Receipt/Issue/Transfer/Adj | `isPosted=false` | `claimDocumentPost` | `claimDocumentUnpost` + reverse movements | `isCancelled` | Blocked if posted |
| Opening stock | Same pattern | `claimDocumentPost` | Reverse | Cancel flows | Per service |
| Stocktaking | Same | `claimDocumentPost` | Reverse lines | Cancel | Per service |
| POS order | Draft/hold | Shift + order post | Unpost service | Void/cancel paths | Client idempotency on create |

Posted history: **not deleted** — reversed via opposite movements (`*-UNPOST` movement types) and journal reversal (`reverseBySourceInTx`).

---

## 5. Report → source / formula

| Report (UI path segment) | Backend | Quantity source | Value/cost |
|--------------------------|---------|-----------------|------------|
| `inventory-reports` (جرد أصناف) | `inventory-count-report.ts` / `reports.service` | Live: `item_warehouse_balances`; historical: sum `inventory_movements` + merge reserves | `qty × averageCost` from balance or movement cost |
| `item-balances` | `reports.service` | `item_warehouse_balances` / movements by filter | MAC fields on item/balance |
| `item-movement-reports` | `item-movement-report.ts` | `inventory_movements` | `unitCost`, `resultingAverageCost` |
| `valuation` | reports service | Balances + costs | Warehouse/item valuation |
| `warehouse-pulse` | `warehouse-dashboard.ts` | Live balances | KPI aggregates |
| `stock-transfer-report` | reports | `Transfer` + movements | Transfer value |
| `slow-moving` | reports | Movement dates / balances | Sales velocity |
| `items-exceeding-order-limit` | `order-limit-status.ts` + balances | Live balance vs limits | N/A |
| Sales/purchase profit reports | `invoices-profit-sheet`, item profit | Invoice lines (posted) | COGS from invoice line cost fields |
| Party account with items | `party-item-account.ts` | N/A (AR/AP) | Invoice net on last line |

**Draft data:** Most stock reports default **posted only**; `showUnposted=true` includes unposted invoices where implemented.

---

## 6. Quantity source-of-truth (summary)

| Concept | Authoritative for operations | Used when |
|---------|------------------------------|-----------|
| `item_warehouse_balances.quantityOnHand` | **Yes** (current, warehouse-level) | Posting, negative stock check (no location), most dashboards |
| `item_quantities` | **Yes** (location split) | Location-level stock, locks in `stockMovementService` |
| `inventory_movements` sum | **Yes** (historical as-of) | `getCompanyItemQuantityAsOf`, cost replay, movement reports |
| `items.beginningBalance` | Legacy/card only | Not live stock |
| Invoice line qty | Document only until post | — |

**CURRENTLY INCONSISTENT:** Three coupled stores updated in one TX (`postMovementInTx`); if a path bypasses `stockMovementService`, drift is possible (see risks in main doc).

---

## 7. Permissions (store documents)

| UI document | AdvancedRights family | Keys |
|-------------|----------------------|------|
| Stocktaking | `SCPost` / `SCUnpost` | `store-document-rights.ts` |
| Transfer | `STPost` / `STUnpost` | |
| Adjustment / other adjustment | `SIPost` / `SIUnpost` | |
| Opening stock | `FTPost` / `FTUnpost` | |
| Invoices | `PIPost`/`SVPost` etc. (legacy naming) | `invoice-posting-orchestrator` |

HTTP reports: `authorize({ resource: 'report', action: 'view' })`.
