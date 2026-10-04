# POS remediation plan

Phase 1 (1.1–1.5), Phase 2 (cashier workflow), Phase 3 (returns, drawer movements, counted close), Phase 4A (production safety), and Phase 4B (retail controls) are implemented in code and are not deployed. Phases 5–7 below are not.

Phase 2 adds `PosPayment` (`20260930190000_pos_payments_and_hold`), server hold on a DRAFT (`heldAt`), catalog search, and server prices. The three tender columns stay and are filled from the payment lines so older readers keep working. `totalCashSales` is still maintained, but it is not the close source of truth. Change is stored on the payment row and is not added to that total or to the cash journal debit.

Phase 3 adds `pos_cash_movements` and `pos_shift_closes` (`20260930200000_pos_returns_drawer_close`) and `PosOrderLine.originalLineId`. Close locks the session and stores:

```
expectedCash = openingCash + cashSales - cashRefunds + cashIn - cashOut
variance = countedCash - expectedCash
```

`customer.balance` remains a cache of CREDIT movements. The AR journal is the source of truth. Payment methods stay strings; there is still no payment-method master.

A separate committed `POSTING` status was not added. The DRAFT→POSTED claim is the first write inside the same transaction as stock and the journal, so a rollback leaves the order DRAFT. A second successful call returns the posted order and does not post again. That is the idempotent result; it is not a 400.

`20260930180000_pos_one_open_shift` aborts before it changes `pos_shifts` when two OPEN rows share a terminal. Prisma cannot run a stored procedure, so the abort is an insert into `pos_shift_open_preflight` (unique on company and terminal). A duplicate key fails the migration and leaves `pos_shifts` unchanged. The read-only listing is `scripts/pos-open-shift-preflight.ts`. Do not auto-close those rows.

Phase 4A answers `POST /api/v1/pos/sales`, `POST /sales/:id/cancel`, `GET /sales`, `GET /sales/:id`, `POST /sales/:id/print-receipt`, and `POST /inventory/update-real-time` with 410. The handlers do not call invoice or stock services. `getDailyPOSReport` still reads posted `PosOrder`. Historical sales invoices are not deleted and are not listed as POS sales.

Bindings:

- `PosOrder` is the only financial document for a cashier sale. Do not insert `Invoice`.
- Shared engines stay in place: `journalPostingService`, `stockMovementService` (only through the costing service), `inventoryCostingService`, `computeLineAmounts`, treasury/safe resolution, customers, warehouses, price lists.
- `PosShift` remains the operational session.
- ETA `submitPosReceipt` / `buildFromPosOrder` stays separate from B2B complete-sign.
- Phase 1 did not delete `/api/v1/pos/sales` or `update-real-time`. Phase 4A retires those handlers with 410 and leaves shared invoice and stock services in place for the rest of Gates.
- `InventoryMovement` remains stock truth.

## Invariants Phase 1 must make true

### 1. A POS order posts financially at most once

`postOrder` may commit `status = POSTED` once per successful call. A second overlapping or retried call while that commit holds sees the row already claimed and writes no journal, no stock, and no shift increments.

A later unpost (already claimed) may return the row to `DRAFT` and clear `journalEntryId`. A later post is a new financial posting, not a second copy of the first. That cycle already exists and must keep working.

### 2. Stock for a POS order posts at most once

The ledger rows for a given committed post are exactly one movement per line, written inside the same transaction as the status claim. A second post attempt does not insert another `POS-SALE` / `POS-RETURN` set.

Unpost adds reversal movements. Repost adds a new set. Those are new postings, not duplicates of an in-flight one. Do not add a unique key on `(sourceType, sourceNumber)` that would forbid that cycle. `InventoryMovement` has no such unique today (`schema.prisma` `InventoryMovement`).

### 3. The journal for a POS order posts at most once

The active entry is the row whose `activeSourceKey` equals `companyId|POS|orderNumber|sourceYearId` (`journal-posting.service.ts` `buildActiveSourceKey`). Unique on `JournalEntry.activeSourceKey`. Reversal sets the key NULL so a legitimate repost can take it.

The status claim is the primary guard. The unique key is the backstop when a journal line is actually inserted. A zero-amount order that inserts no journal must still be claimed, or two requests can both increment shift totals.

`sourceYearId` today is taken from the request fiscal year inside `postOrder` and is not stored on `PosOrder`. After the claim, a second request cannot post even if it sends a different year header. Do not "fix" idempotency by changing the key format in Phase 1.

### 4. A terminal has one OPEN operational session

For a `(companyId, terminalId)` there is at most one `PosShift` with `status = OPEN`. `openShift` and `reopenShift` both have to fail the second writer. Close remains a single transition away from `OPEN`.

### 5. Client totals are never authoritative

Persisted `totalAmount`, `discountAmount`, `taxAmount`, `netAmount`, line `discountAmount`, line `taxAmount`, and line `lineTotal` are only the output of `calcLineTotals` / `computeLineAmounts`. The create schema already has no header total fields. Keep it that way.

Inputs that remain client-supplied in Phase 1: `quantity`, `price`, `discountPercent`, `discountAmount`, `taxPercent`, and the tender columns. Price-list authority is not Phase 1. `computeLineAmounts` already rejects a `discountAmount` that disagrees with `discountPercent` beyond its tolerance, and it derives tax from `taxPercent`.

The cashier must print and confirm the `netAmount` returned by create, not `computePosCartTotals`. Tender amounts must be checked against the net that will be stored.

Header columns are `Decimal(15,2)`. `calcLineTotals` rounds to 4dp and then Prisma/MySQL stores 2dp. Validate tenders against the 2dp value that will be written, so a 4dp net cannot pass validation and then be stored as a different cash figure. Do not widen those columns in Phase 1.

### 6. POS costing uses the same inventory costing rules as the rest of Gates

A sale consumes stock through `inventoryCostingService.applyOutboundMovement`. A return puts stock back through `inventoryCostingService.applyInboundMovement`, using the original line `unitCost` when `originalOrderId` links a line, otherwise the same fallback invoice sale-returns use (`inheritCurrentCost` when original cost is missing). Unpost of a sale puts quantity back with `applyInboundMovement` at the `unitCost` stored on the POS line, matching invoice sale unpost (`invoice-posting-orchestrator.ts` around the `unitCostAtIssue` inbound). Unpost of a return uses `reverseInboundInTx` at that same stored cost.

`applyOutboundMovement` and `applyInboundMovement` already call `stockMovementService.postMovementInTx` when `postStock !== false` (`inventory-costing.service.ts`). Phase 1 replaces the direct `getCostAsOf` + `postMovementInTx` pair. It must not call both. Movement type strings stay `POS-SALE`, `POS-RETURN`, `POS-SALE-REVERSAL`, and `POS-RETURN-REVERSAL` so existing POS tests and the ETA receipt path can still recognize them. The costing service does not require the movement type to be `SALE` for the MAC math.

Set `sourceDocumentId` to `PosOrder.id` on those movements. The column already exists. No new stock table.

Do not replay or revalue historical POS movements. New posts and new unposts only.

### 7. Reports that claim to show POS activity read PosOrder

`getDailyPOSReport` and the hub list currently query `Invoice` (`pos.service.ts`, `app/pos/page.tsx`). Wave 2 sales never show up.

Phase 1 points the daily report and the hub at posted `PosOrder` rows. It does not delete the invoice endpoints. Historical `/pos/sales` documents stay on sales-invoice reports. They are ordinary sales invoices, with no marker that distinguishes them from a non-POS counter invoice, so Phase 1 must not invent a backfill into `PosOrder` and must not union every sales invoice into the POS report (that would mix non-POS invoices and could double-count if both ever existed).

## Phase 1 — ordered work

Ship in this order. 1.3 depends on 1.1. 1.5 depends on 1.3 and 1.4 so the report's COGS and totals match what was posted. 1.2 is independent and may be coded in parallel, but it merges before 1.5.

### 1.1 Claim `postOrder` inside the transaction

- Defect: `postOrder` loads the order, throws if `status === POSTED'`, then opens a transaction that writes stock, journal, shift totals, and only then sets `POSTED` (`pos-order-posting.service.ts` lines 147–157 and 339–348). Two callers can pass the outer check. Unpost already does `updateMany` where `status = POSTED` and aborts when `count !== 1`.
- Files: `pos-order-posting.service.ts` `postOrder`. Model: `PosOrder.status`, `journalEntryId`. No schema change.
- Invariant: 1, 2, and 3.
- Transaction: one `prisma.$transaction`. First statement: `updateMany` where `{ id, companyId, status: 'DRAFT' }` setting `status: 'POSTED'`, `postedAt`, `postedBy`. If `count !== 1`, throw `ORDER_ALREADY_COMPLETED` (400) and commit nothing. Then stock, journal, shift increments, and the final update of `journalEntryId` only. If a later statement throws, the whole transaction rolls back, including the claim.
- Concurrency: the `DRAFT → POSTED` update locks the row. The waiter then sees `count = 0`. Do not use a committed intermediate status. `activeSourceKey` stays as the journal backstop. Do not add a movement unique key.
- Accounting: a lost race posts zero extra journals. A won race still posts one balanced `POS-SALE` or `POS-RETURN` entry. Repost after a successful unpost still posts one new active entry because unpost returns the row to `DRAFT` and the reversal clears `activeSourceKey`.
- Inventory: the loser writes zero movements. The winner writes one movement per line (after 1.3, via the costing service).
- Migration: none. In-flight drafts stay `DRAFT`. Already posted rows stay `POSTED`.
- Tests: extend `pos-order-unpost-concurrency.test.ts` (or a sibling that uses the same test database) with two concurrent `postOrder` calls; assert one `POSTED` row, one journal with that `activeSourceKey`, one movement per line. Assert the existing unpost-then-repost cycle still yields one active journal. Assert a second post after the first commit returns 400 and does not add a movement.
- Rollout: low. Behavior of a single post stays the same. Failed double-clicks start returning 400 instead of a 500 from the journal unique key or a double movement if the key was skipped.

### 1.2 One OPEN session per terminal

- Defect: `openShift` selects `status = OPEN` then inserts (`pos-shift.service.ts` lines 25–47), not in one transaction, with only `@@index([companyId, terminalId, status])`. `reopenShift` sets `OPEN` with no check for another open row (lines 240–266).
- Files: `pos-shift.service.ts` `openShift`, `reopenShift`, `closeShift`. Model: `PosShift`. Schema: `gates-backend/prisma/schema.prisma`.
- Invariant: 4.
- Schema: add nullable `openTerminalKey String?`. Application writes `terminalId` while status is `OPEN` and `null` when status is `CLOSED`. `@@unique([companyId, openTerminalKey])`. MySQL unique indexes allow many NULLs, so closed sessions do not collide. `status` is already `VarChar(10)`; do not add `CLOSING` in Phase 1.
- Transaction: `openShift` insert sets `openTerminalKey = terminalId` inside the same statement. On unique violation, throw a stable `SESSION_ALREADY_OPEN` (400), not a raw Prisma error. `reopenShift`, in the same transaction as the variance reversal, sets `openTerminalKey = terminalId` only as the update that also sets `OPEN`. Unique violation aborts the reopen and therefore the reversal. `closeShift` sets `openTerminalKey = null` in the same update that sets `CLOSED`. Also change that close update to `updateMany` where `status = OPEN` and abort if `count !== 1`, so two zero-variance closes cannot both succeed.
- Concurrency: the unique index is the lock. The pre-check may stay as a friendly error, but it is not the guarantee.
- Accounting: none on open. Reopen still reverses `POS-VARIANCE` only if the unique update succeeds. A failed reopen must not leave the variance journal reversed.
- Inventory: none.
- Migration / backfill: before the unique index, run a read-only check for more than one `OPEN` row per `(companyId, terminalId)`. If any exist, stop the migration and list the terminal ids. Do not auto-close one of them. If clean, backfill `openTerminalKey = terminalId` where `status = OPEN`, and `NULL` otherwise, then add the unique index. Deploy the writer in the same release as the backfill.
- Tests: two concurrent `openShift` on one terminal → one row, one `SESSION_ALREADY_OPEN`. `reopenShift` while another `OPEN` exists on that terminal → 400 and the closed shift still `CLOSED` with its variance journal still active. Close twice → second call 400.
- Rollout: medium if production already has duplicate `OPEN` shifts. The pre-check is mandatory. Cashiers then cannot open a second session; they resume the existing one (current `getOpenShiftForTerminal`).

### 1.3 Costing service, one movement

- Defect: `postOrder` uses `itemCostService.getCostAsOf` and `stockMovementService.postMovementInTx` (`pos-order-posting.service.ts` lines 179–202). Unpost posts a reversal the same way (lines 398–412) and passes `sourceYearId: undefined`. Invoice sales use `applyOutboundMovement` / `applyInboundMovement` (`invoice-posting-orchestrator.ts`). M-09. Those costing methods already call `postMovementInTx`.
- Files: `pos-order-posting.service.ts` `postOrder` and `unpostOrder`. Do not fork `inventory-costing.service.ts` unless a missing argument is required; prefer the existing methods. Do not change manufacturing in this item.
- Invariant: 6, and 2 once 1.1 has landed.
- Schema: none. Pass `sourceDocumentId: order.id`.
- Transaction: same transaction as 1.1, after the claim. Per line, in a stable lock order (warehouse id, item id), call exactly one costing method. Persist returned `unitCost` on `PosOrderLine.unitCost`. COGS for the journal is the sum of `totalValuation` from those calls, not `qty * getCostAsOf`.
- Sale post: `applyOutboundMovement` with `movementType: 'POS-SALE'`, negative stock rules left to the service (`allowNegativeStock` unset so current stock-movement policy applies).
- Return post: `applyInboundMovement` with `movementType: 'POS-RETURN'`. If `originalOrderId` is set, unit cost is the original line's `unitCost` matched by `itemId` + `unitId` (if two original lines match, sum is not allowed: reject the return in Phase 1 with a clear error rather than guessing). If no original, `inheritCurrentCost: true` and `updateLastPurchasePrice: false`, same as a standalone invoice sale return.
- Sale unpost: `applyInboundMovement` at `Number(line.unitCost)`, `movementType: 'POS-SALE-REVERSAL'`, `updateLastPurchasePrice: false`.
- Return unpost: `reverseInboundInTx` at `Number(line.unitCost)`, `movementType: 'POS-RETURN-REVERSAL'`.
- Do not also call `postMovementInTx` in POS.
- Accounting: COGS and inventory journal amounts change to the costing service valuation. Revenue and tender math do not change. Historical journals are not rewritten.
- Inventory: one ledger row per line per successful post or unpost. Quantity caches move only inside that `postMovementInTx`. MAC follows the costing service.
- Migration: none. No backfill of old `POS-SALE` costs.
- Tests: one sale posts one movement per line and `unitCost` equals `applyOutboundMovement`'s `unitCost` for a known purchase-then-sale fixture (same warehouse). A return linked to that order uses the sale line `unitCost`, not a later average. Concurrent post still yields one movement (covers 1.1 + 1.3). Unpost then repost does not leave the on-hand quantity doubled. Assert `postMovementInTx` is not invoked a second time beside the costing call (spy or movement count).
- Rollout: medium for new sales only. COGS on new POS tickets can move relative to yesterday's POS tickets. Say that in the release note. Do not run `recalculateItemCostHistory` over old POS documents in this phase.

### 1.4 Server totals on the wire and on the receipt

- Defect: `createOrder` already recomputes lines and checks tenders against 4dp `netAmount`, then stores header money in `Decimal(15,2)`. The page (`point-of-sale/page.tsx` `handleSave` / print, `computePosCartTotals.ts`, `usePosSession.ts` `submitPosWave2Order`) sends tender amounts and prints `net` from the local helper. That helper uses raw JS floats, prefers `discountAmount` whenever it is `> 0`, and does not round to 4dp. `computeLineAmounts` prefers `discountPercent` when present and derives tax from the rate.
- Files: `pos-order-posting.service.ts` `calcLineTotals` and `validateTenders`; `pos.schema.ts` `createPosOrderSchema` (do not add header totals); `usePosSession.ts`; `app/pos/point-of-sale/page.tsx`; `computePosCartTotals.ts`.
- Invariant: 5.
- Schema: none.
- Transaction: unchanged create transaction. Before `validateTenders`, round header `totalAmount`, `discountAmount`, `taxAmount`, and `netAmount` to 2dp with the same half-away-from-zero rule MySQL will apply to `Decimal(15,2)`, and validate the tender sum against that 2dp net. Persist those 2dp figures. Line `price` and `quantity` stay 4dp.
- API: `POST /orders` response already returns the stored order. `submitPosWave2Order` must read `netAmount`, `taxAmount`, and line totals from that response. If the absolute difference between the UI net and `netAmount` is greater than `0.01`, do not post and do not print; show the server figures. Single-method tenders sent to create must be the server net, not the local net. The print HTML must use the response.
- Accounting / inventory: none beyond posting the 2dp net that was validated. No journal formula change.
- Migration: none. Existing posted orders stay at whatever 2dp values they already have.
- Tests: unit test `calcLineTotals` where 4dp net would round to a different 2dp value; tender equal to the 4dp figure and not the 2dp figure is 422; tender equal to the 2dp figure is stored. A create request cannot set `netAmount` (schema). Frontend test or a small pure test that the payload builder uses the create response net. Keep `computeLineAmounts` tests as the math source; do not add a second golden formula in the page.
- Rollout: low. Tickets that previously failed with "Payment split must equal order net amount" because of float drift should start succeeding when the client sends the server net. Receipts change to the posted amount.

### 1.5 Daily report and hub read `PosOrder`

- Defect: `POSService.getDailyPOSReport` (`pos.service.ts` from line 149) and `app/pos/page.tsx` load posted `invoiceType = sales` invoices. The cashier never creates those.
- Files: `pos.service.ts` `getDailyPOSReport`; `app/pos/page.tsx`; report column mapping in `gates-web/lib/reportEngine/reportColumns.ts` if fields are renamed. Do not change sales-invoice reports.
- Invariant: 7.
- Query: posted `PosOrder` for the company whose `postedAt` (fallback `createdAt` only if `postedAt` is null, which should not happen after 1.1) falls on the requested local date, optional warehouse via `shift.terminal.warehouseId`, optional cashier via `shift.userId` or `postedBy` (the invoice report's `sellerId` has no POS column; map the existing filter to `postedBy` and document it on the filter label). Sum `netAmount`, `taxAmount`, `discountAmount`, tender columns, and `unitCost * quantity` from lines. Do not join `Invoice`.
- Schema: none.
- Transaction: read-only.
- Accounting / inventory: no writes. Displayed COGS is the stored line `unitCost` from 1.3 going forward, and the historical `getCostAsOf` value on older rows.
- Migration: none. No backfill of old invoices into `pos_orders`.
- Tests: a posted `PosOrder` appears; a posted sales invoice with no `PosOrder` does not; a `DRAFT` does not; warehouse filter uses the terminal warehouse; another company's order does not.
- Rollout: medium and visible. `/pos/daily` will stop listing historical `/pos/sales` invoices. Those invoices remain in sales reports. Do not union all sales invoices. Call this out in the release note. If the pre-ship check shows the legacy route is still used in production, keep the old invoice query under a clearly named legacy section instead of deleting numbers silently — still do not mix them into the `PosOrder` totals.

## Phase 1 non-goals

No `PosPayment` table, no cash in/out, no new expected-cash formula, no hold API, no return quantity cap, no permission split, no offline, no restaurant, no hardware driver, no deletion of `/api/v1/pos/sales`.

## Future payments (do not implement)

The columns `cashAmount`, `cardAmount`, `creditAmount`, and `paymentMethod` are transitional. They cannot safely represent:

- more than three methods, or a method master
- change (putting tendered cash into `cashAmount` books the change as a sale; putting net into `cashAmount` drops the tender and the change)
- a refund method that differs from the original column
- more than one card or wallet line
- an audit row per capture

`PosPayment` is created by `20260930190000_pos_payments_and_hold`. `method` stays the posted code. Phase 4B adds `pos_payment_methods` plus `settlementType`, `methodLabel`, and `paymentMethodId` (`20260930210000_pos_phase4b_retail`). `amount` is the amount that hits GL. `tenderedAmount` and `changeAmount` are nullable audit fields. `safeId` and `bankAccountId` are nullable. Rows are inserted only after the DRAFT→POSTED claim in the same transaction.

Invariant: `sum(amount) = order.netAmount` for a fully paid sale; `sum(changeAmount)` is not revenue and is not a second credit to sales; the cash GL debit equals the sum of cash `amount`, which already excludes change. The three columns remain a projection of those rows.

## Session close equation (Phase 3)

```
expectedCash
  = openingCash
  + cashSales     # PosPayment.amount, settlement CASH (or method CASH when settlement is null), orderType SALE
  - cashRefunds   # PosPayment.amount, settlement CASH (or method CASH when settlement is null), orderType RETURN
  + cashIn        # PosCashMovement CASH_IN
  - cashOut       # PosCashMovement CASH_OUT
variance = countedCash - expectedCash
```

Orders with no `PosPayment` rows use the legacy tender columns, so a Phase 1 close still matches. `changeAmount` is not in the equation. Shortage debits `cashShortageAccount` or `cashOverShortExpenseAccount` and credits the safe GL. Overage debits the safe GL and credits `cashSurplusAccount` or `miscellaneousIncomeAccount`. A missing account with a non-zero variance returns 422 and leaves the session OPEN. Reopen unposts that journal in place, sets `PosShiftClose.reopenedAt`, and claims CLOSED→OPEN. It does not delete the snapshot. If the terminal already has another OPEN session, the unique key rolls the reopen back and the variance journal stays posted.

## Later phases (not specified to the same depth)

Phase 2 — implemented: cashier screen, server-authoritative price/tax/offers, customer search and terminal default customer, persistent hold, `PosPayment` split and cash change, opening cash, catalog paging, barcode lookup, thermal receipt from the posted order.

Phase 3 — implemented: linked full and partial returns, cash in/out journals, the expected-cash equation, immutable `PosShiftClose`, shortage/overage journals, reopen that keeps the snapshot, and `/pos/returns` plus `/pos/session`. Manager-approval tolerance is not built.

Phase 4A — implemented, not deployed. Legacy POS invoice and stock writes return 410. `pos` `unpost` and `pos` `reopen_shift` are grantable actions; sell `post` and session `edit` do not satisfy them. The close screen starts counted cash empty and confirms the variance before posting. A browser stores the named terminal and opens only that terminal's session. The session and hub show whether shortage and surplus accounts resolve, without creating them.

Phase 4B — implemented, not deployed. Manual line and order discounts require `pos` `discount` and reuse `computeLineAmounts`. An order discount reduces the net and does not change line VAT. Price override requires `override_tier_price` and stores `listPrice`. An HTTP caller that sends a discount or a different price without the flag gets 403. Audit rows use `documentAuditService` after the money transaction commits. Payment methods are company rows with settlement, display name, active state, safe or bank, and optional branch or terminal. A company with no rows still accepts the built-in codes. `GET /pos/reports` reads posted `PosOrder` only. Manager-approval tolerance for a variance is not built.

Phase 5 — the first thermal copy is on the post response. A later reprint is `GET /pos/orders/:id/receipt` and requires `pos` `reprint`. A hardware payment terminal stays manual until a provider reports approval. See `POS_FINAL_IMPLEMENTATION.md`.

Phase 6 — offline design: client-generated idempotency key, outbox, server `Idempotency-Key` on create+post, conflict rules. Not before 1.1.

Phase 7 — restaurant tables, KDS, courses. Separate from retail `PosOrder` flow.

## DO NOT IMPLEMENT YET

- Offline POS, including a local outbox, service worker, or "sync later" button that posts twice.
- Restaurant floors, tables, dine-in, kitchen display, kitchen print, courses, tips, split bills.
- Hardware-specific drivers (drawer kick protocols, scale parsers, EFT terminals, customer displays). Reusing the existing browser thermal helper in a later phase is allowed; a new vendor SDK is not part of Phase 1.
- Weighted barcodes.
- Serial, batch, or expiry tracking invented for POS. If Gates later has a real tracking model, POS calls it.
- Deleting historical `Invoice` rows that came from the old POS, or deleting `GET /pos/daily-report`. Phase 4A only stops the retired routes from mutating or listing those invoices as POS sales.
- A second sales invoice, a second costing implementation, or a second stock ledger for POS.
- Renaming `PosShift` or replacing it with a new session table.
- Merging ETA receipt submission into B2B `complete-sign`.
- Revaluing historical POS movements or rewriting posted journals to the new COGS.
- Implementing `PosPayment` or the future expected-cash equation inside Phase 1.
