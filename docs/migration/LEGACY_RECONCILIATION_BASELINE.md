# Legacy Reconciliation Baseline

**Company:** `0001` | **Verdict:** **PASS** (accounting TB) / **PARTIAL** (inventory — no ItemStore)

## Accounting — CONFIRMED_FROM_DB

| Metric | Value |
|--------|------:|
| Posted journal headers | **229** |
| Draft (non-deleted, not Post) | **6** |
| Deleted headers | **3** |
| Posted **debit base** (Σ DebitValue×Change) | **62,869,333.38** |
| Posted **credit base** | **62,869,333.38** |
| **Difference** | **0.00** |
| Unbalanced posted vouchers (>0.01) | **0** |

Posted filter: `Status='Post'`, `Deleted<>'T'`, lines joined on CompanyCode+BranchCode+YearID+GLNum.

### Posted GL by type (top)

| Type | Posted headers |
|------|---------------:|
| SV01 | 63 |
| PI01 | 32 |
| BR02 | 26 |
| GL01 | 14 |
| BP02 | 14 |
| … | (24 types total) |

## AR/AP / parties (indicative)

| Entity | Rows |
|--------|-----:|
| Customer | 6 |
| Supplier | 1 |
| Account (COA) | 136 |

Party ledger parity requires account mapping for the 70 GL-only codes before AR/AP sign-off.

## Treasury

| CashTrxHeader | 60 |

## Commercial

| Metric | Value |
|--------|------:|
| Invoice headers total | 158 |
| Posted | **128** |
| Unpost | 7 |
| NULL status | 23 |
| With `GLNum` | 133 |
| Posted with `GLNum` | **126** |

## Inventory — CONFIRMED_FROM_DB

| Metric | Value |
|--------|------:|
| ItemStore rows | **0** |
| StoreTransHeader (type ST01) | 17 |
| StoreTransDetail lines | 48 |
| Sum of line `Qty` (movements) | **-42** |
| ItemCost rows | 62 |
| ItemsFirstTime | **0** |

**ItemStore vs movements:** N/A — cache empty. Quantity truth = **reconstruct from `StoreTrans*` (+ invoice stock via `PostInvoice` when `AffectStore`)**.

## Cutover acceptance (future)

New tenant must match:

- TB debits/credits = **62,869,333.38** each (posted scope above)
- **229** posted JE headers / **4,267** lines (or explicit policy excluding drafts)
- Stock: movement-derived qty per item×store for **5** warehouses, **32** items
