# Legacy Posting Pipelines

**Evidence:** **CONFIRMED_FROM_DB** — `sys.sql_modules` bodies in `audit-out/proc_*.sql`.

## Invoice → post (sales/purchase)

```
InvoiceTrxHeader / InvoiceTrxDetail  (SaveInvoices — unposted save)
        ↓
PostInvoice (@CompanyCode, @BranchCode, @YearId, @Type, @InvoiceNum)
        ↓
Reads: InvoiceTrxHeader (StoreCode, GLNum, AffectStore, amounts, …)
       InvoiceTrxDetail + Item (lines, qty, ItemStoreCode)
       GLTrxHeader / GLTrxDetail + Account (validation; Status='Post', Performed='T')
        ↓
Writes: (dynamic SQL in procedure —) GLTrx*, store movements, ItemStore/cost updates,
        header Status/GLNum linkage, ItemCost, StoreTrans* when affecting store
```

**Conditions observed in `PostInvoice`:**

- Posted GL checks use `H.Deleted='F'`, `H.Status='Post'`, **`H.Performed='T'`** (column not in static catalog snippet — **CONFIRMED_FROM_DB**).
- Line cursor over `InvoiceTrxDetail` with `@ItemStoreCode`, `@AffectStore`, costing variables (`OldCost`, `NewCost`, …).

**Do not EXEC** on migration host.

## Save path (no stock/GL post)

`SaveInvoices` / `SaveReturnInvoices` — large procedures; validate stores, read `StoreTransHeader/Detail` for move qty checks, persist invoice tables only.

## Payment

`SavePayment` / `ReturnSavePayment` — treasury; bodies exported (~42 KB).

## Inventory read

`GetAllItemsInStore` — catalog balances (fallback when `ItemStore` empty).

## Cost

`AdjustItemsCost` — updates cost history.

## Store transfer

No `PostStoreTrans` in this DB (mobile-only per catalog). **17** `StoreTransHeader` rows type **ST01** already present as data.

## Historical correlation (this DB)

| Check | Result |
|-------|--------|
| Posted invoices with `GLNum` | **126 / 128** posted |
| Sample keys | Invoice `2861` → GL `00000001` (type PI01) |

Imported history: **link invoice.GLNum → JournalEntry.legacyGlNum**; do not re-run `PostInvoice`.

## Procedures deployed (14)

`AdjustItemsCost`, `create_Eshar_Credit`, `GetAllItemsCount*`, `GetAllItemsInStore`, `GetLogSQLText`, `PostInvoice`, `Return_*`, `SaveInvoices`, `SavePayment`, `SaveReturnInvoices`, `UpdateNothing`.
