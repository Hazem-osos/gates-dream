# Migration strategies (ratified — Agro2 evidence)

## Historical: **B) READ-ONLY documents + GL/inventory truth**

| Evidence | Implication |
|----------|-------------|
| 126/128 posted invoices have `GLNum` | Invoice history can reference imported JE |
| `PostInvoice` body ~59 KB | Re-post would duplicate GL/stock |
| 17 store transactions already materialized | Do not replay post for historical `StoreTrans*` |

## Accounting: **Import full posted GL + COA fix-up**

| Import | Source |
|--------|--------|
| COA | `Account` + **GENERATE** missing codes from distinct `GLTrxDetail.AccountNo` |
| Posted journals | All **229** posted headers + lines |
| Drafts | **6** — owner: import as UnPost or skip (recommend skip for cutover TB) |
| Opening | **1** `BalanceAccounts` + **1** GL type `BG01` — **dedup** before double-counting |
| Customer/supplier balances | Derive from GL, not caches |

## Inventory: **Movement + cost snapshot (no ItemStore)**

| Quantity | `StoreTransDetail` (+ invoice effects already in history if replay skipped) |
| Cost | `ItemCost` (62 rows) |
| Opening | No `ItemsFirstTime`; optional single opening movement at cutover from computed qty |

## Proof

TB **62,869,333.38** / **62,869,333.38**; movement sum qty **-42** across 48 lines.
