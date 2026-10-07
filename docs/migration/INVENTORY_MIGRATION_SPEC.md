# Inventory Migration Specification

**Risk level:** HIGH  
**Legacy:** `Item`, `ItemStore` (cache), `ItemCost`, `ItemsFirstTime*`, `StoreTrans*`, invoice lines with `AffectStore`, mobile balance queries over movements.  
**New:** `InventoryMovement` + `item_warehouse_balances` / `adjust-stock-in-tx`, opening stock service, strict negative stock options.

---

## 1. Legacy quantity truth

| Source | Role | Confidence |
|--------|------|------------|
| `ItemStore.Qty` | Denormalized cache; catalog says may be stale | MEDIUM |
| `ItemsFirstTimeD` | Opening qty/cost per store | MEDIUM |
| `StoreTransDetail` | Transfers/issues/receipts | HIGH (structure) |
| `InvoiceTrxDetail` | Issues/receipts when `AffectStore` | MEDIUM |
| `GetAllItemsInStore*` SP | Aggregated read path | LOW (no body) |

**Principle:** Do not COPY `ItemStore` alone into new `quantityOnHand` without validating against movement reconstruction.

---

## 2. New quantity truth

| Layer | Mechanism |
|-------|-----------|
| Movements | `InventoryMovement` rows (signed qty, cost, doc ref) |
| Warehouse balance | `item_warehouse_balances` updated in posting transactions |
| Item-level aggregate | Derived / synced (`warehouse-quantity-sync`, `item-stock-summary`) |
| Opening | `OpeningStock` post → movements + GL slices (`opening-stock-valuation.ts`) |

**Invariant:** Posting paths enforce company + warehouse scope; negative stock may be blocked (`strict-inventory.ts`).

---

## 3. Migration strategies

### S1 — Opening snapshot + optional history

1. Masters: Item, Warehouse, Units.
2. **Cutover date** quantity & average cost per item×warehouse:
   - Prefer `ItemsFirstTime*` + net movements if extractable.
   - Else `ItemStore` with **WARNING** in report.
3. Create `OpeningStock` (or equivalent) **once** per warehouse — posts movements.
4. Historical `StoreTrans*` / invoice stock lines: **READ_ONLY** or movement replay — **OWNER_DECISION**.

### S2 — Full movement replay

1. Import all stock-affecting docs in chronological order.
2. Recompute MAC/avg cost as new ERP would.

**Pros:** Matches operational history.  
**Cons:** Expensive; must match legacy costing rules (`AdjustItemsCost`, invoice cost fields).

### S3 — Opening only (pilot)

Same as S1 without historical store docs.

**Recommendation for first migration:** **S3** with reconciliation to legacy `ItemStore` at cutover; add S2 per customer after costing rules verified.

---

## 4. Cost migration

| Legacy | New |
|--------|-----|
| `ItemCost` time series | `ItemCostHistory` |
| Line `CostPrice` on invoices | Historical reference only if not reposting |
| Warehouse MAC | `item_warehouse_balances.averageCost` |

**Reconciliation (existing harness):**

- Latest `ItemCost` per item vs latest `ItemCostHistory`.
- Σ qty × unit cost (legacy vs new).

---

## 5. Special features

| Feature | Legacy tables | New | Status |
|---------|---------------|-----|--------|
| Color/size | `ItemColorSize` | Item variants? | UNMAPPED |
| Serial numbers | `SerialNums` columns | Serial tracking? | BLOCKED |
| Batches/expiry | Line `ExpDate` | Verify schema | MEDIUM |
| Reservations | — | `ItemReservation` | No legacy equivalent in index |

---

## 6. Reconciliation checklist

| Check | Legacy | New |
|-------|--------|-----|
| Qty per item×store | `ItemStore` or computed | Warehouse balance / movements sum |
| Total items in stock | Distinct items with qty ≠ 0 | Same definition documented |
| Inventory valuation | qty × latest cost | Same |
| Negative qty | Flag rows | Strict mode may reject — **OWNER_DECISION** |
| Transfer pairs | `StoreTransHeader` | `Transfer` posted status |

---

## 7. ETL gaps

- Phase B touches `ItemStore`, `ItemCost` — verify alignment with `OpeningStock` path (may duplicate).
- `StoreTrans*`, `StoreCheck*` mapped in CSV but **not** in phase scripts.
- Invoice stock posting must stay disabled for historical import.

**Confidence:** **MEDIUM** for opening snapshot; **LOW** for full replay without SP bodies.
