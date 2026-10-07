# Gates ERP — Accounting Logic Matrices (read-only audit)

Companion to `ACCOUNTING_LOGIC_COMPLETE.md`. **CURRENT GATES BEHAVIOR** only.

---

## A. Document accounting matrix (selected + pattern for others)

| Document | Stock | Customer | Supplier | Typical debit | Typical credit | Tax | FX | CC | Journal path | Post atomic? | Unpost | Concurrency | Notes |
|----------|-------|----------|----------|---------------|----------------|-----|----|----|--------------|--------------|--------|-------------|-------|
| Sales invoice (M5) | − qty / COGS | AR ↑ (credit sale) | — | AR/Cash, COGS | Sales, VAT, Inventory | VAT output, WHT | Header/line rates; settlement FXDIFF | Per txn settings | `autoGlPostingService.commitInTx` + orchestrator | **Yes** (1 tx) | Stock reverse + `cascadeSourceJournalInTx` | `invoice.updateMany` version claim | GL can be skipped via settings |
| Purchase invoice | + qty | — | AP ↑ | Inventory, VAT in | AP/Cash, WHT | VAT input | Same | Same | `commitInTx` PI | **Yes** | Same | Same | MAC recalc after unpost (async path) |
| Sale/purchase return | Opposite sign | Opposite | Opposite | SR/PR builders | Opposite revenue/inv | Reverses tax lines | Same | Same | `commitInTx` | **Yes** | Cascade | Claim | |
| Treasury receipt | — | AR ↓ (if customer) | — | Cash/Bank | AR/Revenue/etc. | Rare | Voucher rate | Optional | `treasury-posting` → `commitInTx` CR | **Yes** | Cascade | Row lock on cash tx | |
| Treasury payment | — | — | AP ↓ | AP/Expense | Cash/Bank | WHT on some | Same | Optional | `commitInTx` CP | **Yes** | Cascade | Same | Overdraft check on pay |
| Cash transaction (master) | — | Via lines | Via lines | Leg-dependent | Leg-dependent | — | `exchangeRate` on row | — | Linked to treasury post | With treasury | `cancel` → cascade | — | |
| Manual journal | — | Optional partner | Optional partner | User | User | — | Per line | Per line | `createAndPostInTx` / draft then post | Own tx | `unpostJournalEntry` manual only | `version` on draft edit | Sourced JEs blocked |
| POS order | − | AR ↑ + **cache bump** | — | Cash/Card/AR, COGS | Sales, Inv | Simplified | Usually EGP | Rare | Direct `createAndPostInTx` | **Yes** | `reverseJournalEntryInTx` | POS claim patterns | Different from SI |
| Goods issue (GI) | − | — | — | Expense | Inventory | — | — | — | `stock-movement-gl` | **Yes** with stock | Cascade | `claimDocumentPost` | PERPETUAL: GL required (guard) |
| Goods receipt (GR) | + | — | — | Inventory | Adjustment acct | — | — | — | stock-gl | **Yes** | Cascade | Claim | PERIODIC may skip GL |
| Transfer | −/+ | — | — | Dest inv | Src inv | — | — | CC mirror optional | stock-gl | **Yes** | Cascade | Claim | Zero value → no JE |
| Stocktaking / adjustment | ± | — | — | Inv / exp | Exp / inv | — | — | — | stock-gl | **Yes** | Cascade | Claim | |
| Opening stock | + at create | — | — | Item accounts | Offset adj | — | — | — | `opening-stock.service` | GL tx separate from qty at create | Cascade | — | Qty at create; GL at post |
| Opening balance JE | — | Lines | Lines | OB lines | Equity/offset | — | — | — | `opening-balance` slot | Single company OB | Unpost rules | Company row lock | One OB journal per company |
| Commercial paper issue | — | Party paper acct | Party | Paper / bank | Party | — | — | — | `commercial-paper-posting` | **Mostly yes** | `unpostPaper` / reverse | Paper status | Multiple JE types per lifecycle |
| Cheque collect/bounce | — | AR/AP | — | Lifecycle-specific | Lifecycle-specific | — | — | — | `cheque-lifecycle` + auto-gl CK* | Tx-bound | Reverse helpers | Status guards | Parallel to securities |
| Invoice settlement | — | Alloc refresh | Alloc refresh | Cash | AR/AP | — | **FXDIFF** JE | — | `createAndPostInTx` | With parent post or follow-up | Teardown on unpost | Allocation rows | |
| Payroll / HR | — | — | — | Expense | Payable/cash | — | — | CC optional | `payroll-posting` | Module tx | Reverse helpers | — | |
| Manufacturing order | ± WIP | — | — | WIP / inv | Inv / WIP | — | — | — | `manufacturing-costing` | **Yes** | Reverse | — | |
| Landed cost | + value | — | AP? | Inventory | Capitalize sources | — | — | — | `landed-cost.service` | **Yes** | Reverse | — | |
| Year-end close | — | — | — | P&L close | Retained earnings | — | — | — | `year-end-closing` | **Yes** | Reverse | FY closed flag | |
| Counterparty offset | Net AR/AP | ↓ | ↓ | Offset pattern | Offset pattern | — | — | — | `counterparty-offset` | **Yes** | — | — | Uses cached balance in UI |

*Extend same columns for: contracting extracts, LG/LC, real estate contracts, schools tuition, tax declarations, POS shift EOD, securities renewal, subcontract billing — all use `createAndPostInTx` or `commitInTx` with module-specific builders.*

---

## B. Source-of-truth matrix

| Concept | Authoritative source | Cached / derived | Write path | Read paths | Rebuild? | Drift risk |
|---------|---------------------|------------------|------------|------------|----------|------------|
| GL account balance (current) | Sum posted `journal_entry_lines.debitBase − creditBase` | `account_period_balances` monthly aggregates | `applyPostedJournalBalancesInTx` on post/unpost | TB default cache; GL live when filtered | `rebuildCompanyBalances` in `ledger-balance.service` | **MEDIUM** if cache stale |
| GL as-of date | Journal lines ≤ date, posted, not cancelled | Period balances for month buckets | Same | Account statement SQL | Rebuild | **LOW** if filters consistent |
| Customer balance (card) | **Not authoritative** | `customers.balance` | Ledger apply + POS manual increment | Customer list, credit check | `party-balance-reconciliation` detect only | **MEDIUM–HIGH** |
| Customer balance (ledger) | JE lines on party GL account + `partnerId` | `partner_running_balances` | `applyPostedJournalBalancesInTx` | Reconciliation service | Rebuild partner rows | **MEDIUM** |
| Supplier balance (card) | **Not authoritative** | `suppliers.balance` | Ledger apply | Supplier list | Reconciliation | **MEDIUM** |
| Safe / bank balance | JE on linked GL + card column | Safe/bank `balance` fields | Treasury post + ledger | Safe reports | Partial | **MEDIUM** |
| Invoice outstanding | `invoice` paid/remaining fields + allocations | Derived from settlements | `invoice-balance.service` | AR/AP reports | Refresh helpers | **MEDIUM** on partial pay |
| Inventory quantity | `item_warehouse_balances` / movements | `item_quantities` | Stock services | Inventory reports | Reconcile helpers | Separate audit |
| Inventory GL value | JE (perpetual) | — | stock-gl | Inventory GL recon service | Manual | **HIGH** if GL skipped (periodic) |
| Cost center P&L | `journal_entry_lines.costCenterId` | `CostCenterMovement` (partial) | Post + CC transfer rewrite | CC ledger reports | No auto sync | **LOW–MEDIUM** |
| FX historical rate | `exchangeRate` on JE header/lines at post | — | `rateForSave` at write | Reports use stored base | N/A | **LOW** if rate persisted |
| Fiscal year state | `FiscalYear` / `FiscalPeriod` / `Period` | — | `fiscalYearService` | Middleware + post | — | Enforced at JE post |

---

## C. Account resolution matrix (summary)

| Event | Account(s) | Resolution priority (first hit wins) | Fallback | Post if missing? | Documents |
|-------|------------|----------------------------------------|----------|------------------|-----------|
| AR (credit sale) | Customer control | Customer `mainAccountId` / auto sub-ledger | `accountDefinitions.arAccount*` via `glAccountResolver` | **No** (422) | SI, POS credit |
| AP (credit purchase) | Supplier control | Supplier account / defs `apAccount*` | — | **No** | PI |
| Sales revenue | Revenue | Item `salesAccountId` → category default → company `salesAccount*` | — | **No** | SI (per-line resolver), POS (single) |
| COGS | COGS + Inventory | Item `cogsAccountId` / warehouse `inventoryAccountId` (perpetual) → defs | — | **No** if COGS>0 | SI, POS |
| VAT output | Tax payable | Tax code mapping → `vatOutputAccount*` | — | **No** if tax>0 | SI |
| VAT input | Tax recoverable | `vatInputAccount*` | vat output alias | **No** if tax>0 | PI |
| Cash tender | Cash safe GL | Safe `accountId` | `cashAccount*` defs | **No** | CR, POS cash |
| Bank tender | Bank GL | Bank account link | `bankAccount*` defs | **No** | CR/CP |
| Stock issue expense | Expense | `stockIssueExpenseAccount*` + warehouse | — | PERPETUAL **No**; PERIODIC skip | GI |
| Stock inventory | Inventory | Warehouse `inventoryAccountId` → item → defs | — | PERPETUAL **No** | All stock docs |
| WHT | Withholding | `withholdingTaxAccount*` | — | **No** if WHT>0 | PI, some SI |
| FX gain/loss | FX P&L | `fxGainAccount*` / `fxLossAccount*` / shared `exchangeGainLossAccountId` | — | **No** on FXDIFF post | Settlement |
| Rounding | Rounding | `roundingAccount*` | — | Context-dependent | Auto-GL balance trim |
| Cheque portfolio | Paper accounts | Securities + `returnedCheques*` / `chequesUnderCollection*` | — | Paper-specific | SEC*, CK* |

Full key list: `gl-account-resolver.service.ts` + `account-definition-map.ts` + `invoice-account-resolver.service.ts` + `treasury-account-resolver.service.ts`.

---

## D. Journal lifecycle matrix

| State | `isPosted` | `postingStatus` | `activeSourceKey` | Lines mutable? | Affects GL cache? | User-visible |
|-------|------------|-----------------|-------------------|----------------|-------------------|--------------|
| Draft | false | UnPost | null | Yes (manual only) | No | Yes |
| Posted | true | Post | set if sourced | No (block edit API) | Yes | Yes |
| Unposted (sourced) | false | UnPost | null | Same JE id, re-postable | Inverted then re-applied on repost | Yes |
| Cancelled | — | — | null | No | Inverted if was posted | Yes |
| Soft-deleted | — | — | — | No | — | Hidden (`deletedAt`) |
| Reversal row | varies | — | — | — | Contra applied | `reversalOfJournalEntryId` |

---

## E. Report source matrix

| Report | Primary source | Posted filter | Date field | Base currency | Opening logic | Divergence notes |
|--------|----------------|---------------|------------|---------------|---------------|------------------|
| Trial balance (default) | `account_period_balances` | Posted implied in cache | Period month | `debit`/`credit` base in cache | Prior periods in same table | Switches to **live JE** when branch/CC/FY/unposted filters |
| Trial balance (live) | `journal_entry_lines` join | `isPosted`, `!isCancelled`, `!deletedAt` | `journal_entries.date` | `debitBase`/`creditBase` | Running from lines | Authoritative |
| General ledger / account stmt | JE lines SQL | Same | Entry date | Base columns | Opening from prior lines | Consistent with live TB |
| Monthly review balance | JE `groupBy` | Optional unposted flag | Entry date | Base | — | Always line-based |
| Review balance wrapper | Delegates to TB | Inherits | Inherits | Inherits | Inherits | FY param → live path |
| P&L / balance sheet | `financial-report.service` account classification | Posted JE | Range on `date` | Base | OB JE types | Uses account `statementType` |
| Customer statement | JE lines + allocations | Posted | — | Base | Opening OB | May differ from `customer.balance` |
| Aged receivables | Open invoices + dates | Document + posted inv | Due dates | — | — | Document-driven aging |
| Party reconciliation | Compare cache vs JE | Posted | — | Base | — | Diagnostic only |

---

## F. Invariant classification (evidence pointers)

| ID | Status | Evidence |
|----|--------|----------|
| A — Balanced posted JE | **MOSTLY PROTECTED** | `validateDoubleEntryBalance` in `journal-posting.service.ts`; opening draft exception |
| B — Account balance = lines | **MOSTLY PROTECTED** | Live reports; cache requires rebuild |
| C — Posted doc has required JE | **PARTIALLY PROTECTED** | `notCreateGL`, periodic stock skip, POS without GL flag |
| D — Unposted excluded from GL | **PROVEN** | Filters on `isPosted` / `isCancelled` |
| E — Party cache reconciles | **PARTIALLY PROTECTED** | Reconciliation service; POS direct balance update |
| F — Historical FX immutable | **MOSTLY PROTECTED** | Rates stored on lines; rate table changes don't rewrite JEs |
| G — POSTING accounts only | **MOSTLY PROTECTED** | `glAccountResolver` + account service rules |
| H — Tenant isolation | **MOSTLY PROTECTED** | `companyId` on JE; audit for rare `update` without company |
| I — CC totals | **PARTIALLY PROTECTED** | Line-based; movement table auxiliary |
| J — Idempotent post | **MOSTLY PROTECTED** | `activeSourceKey` unique; `updateMany` claims |
