# GL Pipeline, Posting Logic & Financial Invariants Audit

**Scope:** `gates-backend` (source of truth) + `gates-web` (UX wiring).  
**Date:** 2026-08-18  
**Method:** Code trace of posting orchestrators, `journal-posting.service.ts`, inventory cost/stock, treasury/cheques, tax periods, and `financial-report.service.ts`.

This document describes **what the code does today**, not target ERP policy. Gaps are called out explicitly.

---

## Architecture overview

| Layer | Primary modules |
|--------|------------------|
| Manual / document GL | `journal-posting.service.ts` → `journal-entry.service.ts` |
| Sales / purchase invoices | `invoice-m5.service.ts` (draft totals) → `invoice-posting-orchestrator.ts` (stock + GL) |
| Invoice cash settlement | `invoice-settlement.service.ts` → `treasury-posting.service.ts` |
| Treasury cash/bank | `treasury-posting.service.ts`, `cash-transaction.service.ts` |
| Cheques | `cheque-lifecycle.service.ts` |
| POS | `pos-order-posting.service.ts` (stock + shift stats; **no GL**) |
| Inventory qty only | `stock-movement.service.ts`, `transfer.service.ts`, `stocktaking.service.ts`, `opening-stock.service.ts` |
| Financial statements | `financial-report.service.ts` (SQL on posted `journal_entry_lines`) |
| Legacy review balance | `reports.service.getReviewBalance` (used by `/accounting/reports/accounts-balance`) |

**Posting context:** Invoice/treasury/cheque routes use `tenantAndFiscalContextMiddleware` + `requirePostingContext` where mounted. Requires `X-Branch-Id`, `X-Fiscal-Year-Id`, open fiscal year (`fiscalYearService.assertOpenById` / `assertOpenForDate`), and for invoices also `taxPeriodService.assertOpenForDocumentDate`.

---

## 1. Automated journal entry generation (posting matrix)

### Account resolution order (invoices)

`invoice-account-resolver.service.ts`:

| Role | Resolution order |
|------|------------------|
| AR / AP (party) | Customer/supplier `mainAccountId` → `accountId` → company `accountDefinitions` keys (`arAccount`, `apAccount`, …) |
| Inventory | First line item `mainAccountId` → `inventoryAccount` / `stockAccount` in settings |
| Revenue | Company settings only (`salesRevenueAccount`, …) |
| COGS | Company settings (`cogsAccount`, …) |
| Output VAT | Optional settings (`vatOutputAccount`) — line omitted if missing or tax = 0 |
| Input VAT | Optional settings (`vatInputAccount`) |
| WHT payable | Optional settings (`withholdingTaxAccount`) |

All codes resolved to UUID via `resolveAccountId` (id or COA code).

Treasury (`treasury-account-resolver.service.ts`): Safe/bank **master** `glAccountId` first, else company default cash/bank keys. Cheque portfolio accounts from `accountDefinitions` only.

---

### 1.1 Sales invoice (`SALE`) — `invoice-posting-orchestrator.post`

**When:** `POST /invoices/:id/post` after draft save. Single DB transaction: stock → moving average (N/A on sale) → GL.

**Header amounts** (from invoice row, computed at save in `invoice-m5.service.ts`):

- `merchandise = totalAmount - discountAmount` (line discounts rolled into header)
- `tax = taxAmount` (sum of line taxes; **not** hard-coded 14%)
- `net = netAmount` (merchandise + tax; WHT stored separately)
- `wht = withholdingTaxAmount` (default 0)

**Stock (perpetual qty):** For each line, `quantityDelta = -baseQuantity`. COGS unit cost = `itemCostService.getCostsAsOf(companyId, itemIds, invoice.date)` (latest `itemCostHistory` at or before date). **Method: moving average history, not FIFO/FIFO layers or standard cost** (except purchase updates average — see COGS section).

**Revenue JE** (`entryType: SALE`, `sourceType: SI`):

| Leg | Debit | Credit | Account |
|-----|-------|--------|---------|
| Customer | `net` | 0 | Party (AR) |
| Revenue | 0 | `merchandise` | Sales revenue |
| Output VAT | 0 | `tax` | VAT output (if tax > 0 and account configured) |

**COGS JE** (separate entry, `entryType: SALE_COGS`, `sourceType: SI-COGS`) if `cogs > 0`:

| Leg | Debit | Credit |
|-----|-------|--------|
| COGS | `cogs` | 0 |
| Inventory | 0 | `cogs` |

**Subledger:** `customer.balance += net` (not reduced until treasury settlement).

**Not implemented on post:**

- **Cash sale:** `paymentMethod` does **not** switch AR to cash; always AR until settlement.
- Separate **sales discount** GL account (discount netted into `merchandise`).
- Line-level cost center (header `costCenterId` copied to **every** JE line via `mkLine`).

---

### 1.2 Sales return (`SALE_RETURN`)

Same structure with **`sign = -1`** on all revenue JE amounts (negative debits/credits — reversal by sign, not a new storno document).

Stock: `quantityDelta = +baseQuantity`. COGS JE uses same sign pattern; `runningCogs` uses costs as-of date.

Customer balance: `balance -= net` (sign applied via delta `-totals.net`).

---

### 1.3 Purchase invoice (`PURCHASE`)

**Stock:** `quantityDelta = +baseQuantity`. **Moving average updated** per line via `itemCostService.applyMovingAverageInTx` (purchase price × `exchangeRate`).

**GL JE** (`entryType: PURCHASE`, `sourceType: PI`):

| Leg | Debit | Credit | Notes |
|-----|-------|--------|--------|
| Inventory | `merchandise` | 0 | At net-of-discount merchandise |
| Input VAT | `tax` | 0 | If tax > 0 and input VAT account set |
| Supplier AP | 0 | `net - wht` | |
| WHT | 0 | `wht` | If wht > 0 and WHT account set |

**No COGS JE on purchase.** No landed cost / price variance accounts.

Supplier balance: `+= net`.

---

### 1.4 Purchase return (`PURCHASE_RETURN`)

**Stock:** `-baseQuantity`. COGS computed from `getCostsAsOf` (same as sale issue).

**GL:** Same as purchase with `sign = -1`.

**Additional COGS JE** if `cogs > 0`: Dr COGS / Cr Inventory with `cogsSign = -1` (reversal of cost relief).

Supplier balance: `-= net`.

---

### 1.5 Treasury — receipts & payments (`treasury-posting.service.ts`)

Triggered by posting `CashTransaction` (from treasury receipt/payment or invoice settlement).

**Receipt (`transactionKind: RECEIPT`):**

| Debit | Credit |
|-------|--------|
| Safe or bank GL | Party or `offsetAccountId` |

**Payment (`PAYMENT`):**

| Debit | Credit |
|-------|--------|
| Party or offset | Safe or bank GL |

Party resolution: customer/supplier account from master, else offset account.

**Balances updated:** Safe/bank `balance`; customer (receipt ↓ AR); supplier (receipt ↑ AP). Mirrors subledger, not a formal AR/AP open-item match.

**Bank transfer between safes/banks:** No dedicated “transfer” JE found in `treasury-posting.service.ts`; would require two payments/receipts or manual journal.

---

### 1.6 Invoice settlement (`invoice-settlement.service.ts`)

After invoice is **posted**, partial/full payment:

1. Creates `CashTransaction` (RECEIPT for SALE / PURCHASE_RETURN, PAYMENT for PURCHASE / SALE_RETURN).
2. Calls `treasuryPostingService.postCashTransaction` → GL as above.
3. Recomputes `paidAmount` / `remainingAmount` from posted settlements.

Outstanding check: `netAmount - paidAmount`.

---

### 1.7 Cheque lifecycle (`cheque-lifecycle.service.ts`)

All steps create **posted** JEs via `createAndPostInTx` (`entryType: Cheque`).

| Step | Status transition | Debit | Credit |
|------|-------------------|-------|--------|
| **Inward receive** | `IN_PORTFOLIO` | Cheques under hand | Customer AR |
| **Send to bank** | `SENT_TO_BANK` | Cheques under collection | Cheques under hand |
| **Clear inward** | `CLEARED` | Bank GL | Cheques under collection |
| **Bounce inward** | `BOUNCED` | Customer AR | Cheques under collection |
| **Issue outward** | `ISSUED` | Supplier AP | Notes payable |
| **Clear outward** | `CLEARED` | Notes payable | Bank GL |
| **Cancel outward** | `CANCELLED` | Notes payable | Supplier AP |

Customer/supplier **balance** adjusted on receive/issue/bounce/cancel; bank balance on clear.

**Not implemented:** Return bounced cheque to portfolio (“under hand”) as a separate step; inward bounce stops at `BOUNCED`. No partial cheque amount splits in service layer.

---

### 1.8 Pure inventory operations (no GL in current code)

| Document | Post behavior |
|----------|----------------|
| **Transfer** (`transfer.service.ts`) | Updates `item_quantities` source/dest; optional `costCenterMovement` **non-GL** record; **no journal** |
| **Opening stock** (`opening-stock.service.ts`) | `isPosted` flag only in one path; unpost adjusts quantities — **no GL** in reviewed post method |
| **Stocktaking** (`stocktaking.service.ts`) | Adjusts quantities to actual; **no GL** |
| **Wave0 movement API** (`stock-movement.service.postMovement`) | Qty + movement audit; used by invoices, POS, manufacturing |

**Goods issue / receipt** as standalone warehouse documents: quantity via movement/transfer patterns above; **no** automatic Dr Expense / Cr Inventory journal.

---

### 1.9 POS (`pos-order-posting.service.ts`)

On `postOrder`:

- Stock movement (out for sale, in for return) with COGS cost as-of **today**.
- Updates `posShift` aggregates (`totalCashSales`, `totalCardSales`, `totalCreditSales`, `totalMerchandise`, `totalTaxAmount`, `totalCogs`).
- Customer `balance` if credit tender > 0.

**Does not call `journalPostingService`.** POS sales are **not** in GL unless replicated elsewhere (e.g. future shift closing journal).

---

## 2. COGS & inventory valuation

| Topic | Implementation |
|--------|----------------|
| **System** | Perpetual inventory quantities (`item_quantities`, `stock_movement` records) |
| **Cost method** | **Moving average** on purchase (`item-cost.service.ts`, Delphi `GetItemCost` port) |
| **COGS at sale** | `getCostsAsOf` → latest `itemCostHistory.cost` × `baseQuantity` |
| **FIFO / standard** | **Not implemented** |
| **Periodic inventory** | **Not implemented** (no period-end COGS adjustment JE) |
| **Purchase return COGS** | Uses same as-of cost × qty (second COGS JE) |

Negative stock: blocked unless `companySettings.allowNegativeBalance` or legacy flag `AllowNegativeStore` (`stock-movement.service.ts`).

---

## 3. Tax handling (VAT & WHT)

| Tax | Behavior |
|-----|----------|
| **VAT rate** | Per-line `taxPercent` or `taxAmount` at save; **no** automatic 14% |
| **Output VAT (sales)** | Cr `vatOutputAccount` when header `taxAmount > 0` and account configured |
| **Input VAT (purchase)** | Dr `vatInputAccount` when tax > 0 and configured |
| **WHT (أ.ت.ص)** | Header `withholdingTaxAmount`; purchase Cr WHT / reduces AP credit; **sales invoice orchestrator does not accrue WHT on AR** (field exists on schema but purchase-side AP split is the main wired path) |
| **Tax period lock** | `taxPeriodService.assertOpenForDocumentDate` — blocks post if document date in **CLOSED** `taxPeriod` |
| **Fiscal year** | `fiscalYear.status === 'Close'` blocks via `assertOpenForDate` / `assertOpenById` |

`isSalesTaxInvoice` on invoice is stored but **not** read in `invoice-posting-orchestrator` (tax amounts come from lines/header only).

---

## 4. General ledger & posting engine rules

### 4.1 Double-entry invariant

**Application layer** (`journal-posting.service.ts`):

- Each line: debit **xor** credit non-zero (`validateJournalLineSides`).
- Balance: `sum(debit × rate) === sum(credit × rate)` at **4 decimal places** (`amountsEqualAt4`, `sumBaseLines`).
- Manual create: optional `SaveUnbalanced` company flag allows saving draft unbalanced entries; **post** requires balanced.
- Invoice/treasury automated entries: `allowUnbalanced: false`.

**Database:** No CHECK constraint enforcing balance on `journal_entries`; invariant is **transaction + service**.

Persisted fields: `debitBase`, `creditBase` per line; header `isBalanced`.

### 4.2 Immutability & audit

| State | Edit lines | Delete | Reverse |
|-------|------------|--------|---------|
| Draft JE (`postingStatus: UnPost`) | Yes | Soft delete path in `journal-entry.service` | N/A |
| Posted JE | **No** update | **No** | **Unpost** sets `isPosted=false`, `postingStatus: UnPost` — **not** a reversing entry |
| Approved JE | Unpost **blocked** | — | — |

Invoice unpost (`invoice-posting-orchestrator.unpost`): reverses stock, removes cost history for purchases, unposts linked JEs if `GLUnPost` flag true, flips party balances — **no storno JE**.

Company flags: `GLPost`, `GLUnPost`, `SaveUnbalanced`, serial scopes `SerialGL` / `SerialAutomaticGL`.

### 4.3 Fiscal years & periods

- Document date must fall in an **open** fiscal year covering the date (`fiscalYearService.assertOpenForDate`).
- Header `fiscalYearId` must match date-derived year if both provided.
- Mutating API requests with `X-Fiscal-Year-Id` assert year open (`tenant-fiscal-context.middleware.ts`).
- Cross-year: prevented by date ↔ fiscal year resolution, not by automatic year-end closing journal in this path.

### 4.4 Foreign currency

- Invoice/treasury JE: header `exchangeRate` (default 1); lines store `debit`/`credit` in document currency and `debitBase`/`creditBase = amount × rate`.
- Trial balance / statements aggregate **`debitBase` / `creditBase`**.
- **No** realized/unrealized FX revaluation service found on settlement or period-end.

---

## 5. Financial statements & ledger computation

### 5.1 Trial balance (`financial-report.service.getTrialBalance`)

- **On-the-fly SQL** over `journal_entry_lines` ⋈ `journal_entries` ⋈ `accounts`.
- Filters: `isPosted = true`, not cancelled, not deleted; optional branch, fiscal year, **cost center on lines**.
- Opening: sum(`debitBase - creditBase`) for `je.date < startDate`.
- Period: sum debits/credits in `[startDate, endDate]`.
- Closing columns via `splitTrialBalanceColumns`.
- Returns `verification.balanced` on ending debits vs credits.

**No** materialized balance snapshot table for TB.

### 5.2 Income statement

- `aggregateByAccountClass`: sums `creditBase - debitBase` by account, classifies via `classifyAccount(code, accountType)` (`financial-report.util.ts`):
  - Code prefixes: `1` asset, `2` liability, `3` equity, `4` revenue, `51` COGS, `52/53/61/62` expense, etc.
- Revenue − COGS = gross profit; − expenses = **net profit** (no separate other income/tax line in service).

### 5.3 Balance sheet

- Same aggregation **as of** `asOfDate`.
- Adds **current period net income** from income statement (year start → as of) into equity.
- `verification.equationBalanced`: assets vs liabilities + equity (+ OTHER).

### 5.4 Cost centers

- Optional `costCenterId` on **journal lines** (invoice posting copies invoice header to all lines).
- `getCostCenterReport`: groups posted lines by cost center (debit/credit/net).
- TB/IS/BS can filter one cost center; **no** allocation engine splitting one JE across multiple centers.

### 5.5 Legacy vs M16 reports

- **M16:** `/api/v1/accounting/reports/trial-balance`, `income-statement`, `balance-sheet` → `financialReportService`.
- **Legacy:** `/accounting/reports/accounts-balance`, `review-balance` → `reportsService.getReviewBalance` (frontend accounts-balance preview uses this path).

---

## 6. Draft invoice invariants (`invoice-m5-integrity.service.ts`)

Before save/update on drafts:

- At least one line; positive qty/baseQty; non-negative price.
- Outbound kinds (`SALE`, `PURCHASE_RETURN`): negative stock check per line.
- `SALE`: customer credit limit (`partyCreditService`) unless `CreditWarningOnly`.

Posted invoice edit blocked in `invoice-m5.service` (must unpost first).

---

## 7. gates-web UX vs backend (accountant friction)

| Area | UI behavior | Backend reality | Gap |
|------|-------------|-----------------|-----|
| **Sales invoice** | Line `taxRate` as %; toggle “فاتورة ضريبية”; financial summary computed client-side | Post uses header `taxAmount`; orchestrator ignores toggle | UI toggle does not zero tax on post unless lines have 0% |
| **Cash vs credit** | `paymentMethod` cash/credit | Post always AR; cash needs **settlement** treasury flow | Cash sale still hits AR until payment recorded |
| **WHT** | Summary shows `withholdingTaxAmount` from saved invoice | Purchase AP split wired; sales WHT not in revenue JE | Sales WHT mostly display-only |
| **Settlement** | Partial payments via `/invoices/:id/settlements` + safes API | Treasury GL + paidAmount refresh | Good path when user discovers it |
| **Settlement / GL grid** | Static `Array.from(3)` rows on sales/purchase pages | Real data on journal links after post | Mock table rows |
| **Multi tax rates** | Per-line `taxRate` supported in form | Rolled to header sum | OK if lines differ |
| **Split payment lines** | Single settlement amount per API call | One cash transaction per settle request | Multiple tenders = multiple settle calls |
| **Cheques** | Separate treasury UI (if present) | Full lifecycle in API | Depends on screen wiring |
| **POS** | Large mock grids in `point-of-sale/page.tsx` | Post updates stock only | No GL visibility for accountants |
| **Reports** | Registry previews → live SQL for M16; accounts-balance preview live | Two report stacks (M16 vs legacy) | Users must know which report route |
| **Fiscal/tax context** | Tenant headers from bootstrap | Required on post | Was brittle with stale branch/FY (partially fixed) |

**100% automated:** Invoice line totals, stock qty, moving average on purchase, COGS from cost history, AR/AP balance bumps, VAT lines when accounts exist, cheque state JEs, TB/IS/BS from posted GL.

**Manual / separate steps:** Post invoice, record settlement, configure `accountDefinitions`, assign customer/supplier GL accounts, open fiscal/tax periods, manual journals for transfers/issues without GL.

---

## 8. Known gaps vs typical Egyptian ERP expectations

1. No GL for warehouse transfer / issue / receipt / stocktaking (qty only).
2. POS not integrated into GL.
3. Invoice unpost **flips flags** on original JEs rather than storno entries.
4. No dedicated sales discount / prompt payment discount accounts.
5. No FIFO / standard cost; no landed cost.
6. No FX revaluation.
7. Sales cash not auto-clearing AR on post.
8. Real-estate / some vertical services still placeholder at API level (out of invoice core but affects group reporting).

---

## 9. Key file index

```
gates-backend/src/modules/invoices/services/invoice-posting-orchestrator.ts
gates-backend/src/modules/invoices/services/invoice-account-resolver.service.ts
gates-backend/src/modules/invoices/services/invoice-m5.service.ts
gates-backend/src/modules/invoices/services/invoice-m5-integrity.service.ts
gates-backend/src/modules/invoices/services/invoice-settlement.service.ts
gates-backend/src/modules/accounting/services/journal-posting.service.ts
gates-backend/src/modules/accounting/services/financial-report.service.ts
gates-backend/src/modules/accounting/services/financial-report.util.ts
gates-backend/src/modules/inventory/services/item-cost.service.ts
gates-backend/src/modules/inventory/services/stock-movement.service.ts
gates-backend/src/modules/treasury/services/treasury-posting.service.ts
gates-backend/src/modules/treasury/services/cheque-lifecycle.service.ts
gates-backend/src/modules/taxes/services/tax-period.service.ts
gates-backend/src/modules/pos/services/pos-order-posting.service.ts
gates-backend/src/shared/middleware/tenant-fiscal-context.middleware.ts
gates-web/lib/invoices/computeInvoiceFinancialSummary.ts  (UI-only totals)
gates-web/app/inventory/operations/sales-invoice/page.tsx   (post/settle UX)
```

---

## 10. Suggested review checklist (standards alignment)

- [ ] Confirm COA mapping in `companySettings.accountDefinitions` for every tenant.
- [ ] Decide policy for cash sales (auto-settlement vs AR + manual receipt).
- [ ] Align UI tax toggle with posting or remove misleading control.
- [ ] Plan GL for inventory documents or document “qty-only” scope.
- [ ] POS end-of-day GL journal design.
- [ ] Storno vs unpost policy for audited environments.
- [ ] Single report API path (deprecate legacy `getReviewBalance` or alias to M16).

This audit should be updated when posting orchestrators change.
