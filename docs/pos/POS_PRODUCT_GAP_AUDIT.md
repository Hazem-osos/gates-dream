# POS product gap audit

Inspection date: 2026-09-30. Source of truth for the findings below is the code after Phases 1–3.

Phase 4A (production safety only) is in the code and is not deployed. It closes the six must-fix blockers: legacy POS financial writes return 410, unpost and reopen are separate permissions, counted cash is typed by the cashier, the session belongs to a named terminal, the return and close screens show loading, empty, error, refund, and variance states, and missing shortage or surplus accounts are shown before close.

Phase 4B (retail controls) is in the code and is not deployed. A later completion pass adds posted void (`VOIDED`, not unpost and not a return), credit collection against receivables, gift-quantity offers, variance tolerance, approval requests, weighted barcode rules, extra unit barcodes, and serial/lot rows when a line names them. The A and B notes below stay as the inspection record. The completion status is in `POS_FINAL_IMPLEMENTATION.md`.

The cashier path is `PosTerminal` → `PosShift` → `PosOrder` / `PosPayment` → `inventoryCostingService` and one journal per order. Close uses `PosCashMovement` and an immutable `PosShiftClose`. Return posting rejects an unlinked line. That path was covered by disposable MySQL tests in Phases 1–3. The original inspection read those pages and did not click them. Phase 4A then fixed the defects in the page code. A logged-in browser pass of `/pos/returns` and `/pos/session` was not completed: the local web and API servers were not running.

Target: a Daftra-style retail register. One fast sell screen, a real drawer, a counted close, and a return that points at the original receipt. Gates accounting, inventory, customers, price lists, and safes stay the engines. Do not build a second one.

## A. Must fix before production

### A1. Legacy sale still posts a sales invoice

- Current: `POST /api/v1/pos/sales` calls `posService.createPOSSale`, which creates a sales `Invoice`, posts it, and collects payment. It does not create a `PosOrder`. Permission is `pos` `edit`. The cashier page does not call it. The route is still mounted in `gates-backend/src/app.ts`.
- Desired: a cashier credential cannot create a financial sale except through `PosOrder`.
- Evidence: `gates-backend/src/modules/pos/services/pos.service.ts` `createPOSSale` (invoice create, `postInvoice`, `collectPayment`). Route: `gates-backend/src/modules/pos/routes/pos.routes.ts` `POST /sales`.
- Severity: a posted invoice and a posted `PosOrder` can both move stock and the ledger for the same shop. Reports that read only `PosOrder` will miss the invoice.
- Recommendation: reject `POST /sales` and `POST /sales/:id/cancel` with a clear gone response. Do not redirect them onto `PosOrder`. Leave historical invoice rows in place.

### A2. Legacy cancel can return any posted sales invoice

- Current: `POST /api/v1/pos/sales/:id/cancel` loads the invoice and, if it is a posted sale, creates a return invoice. It does not check that the invoice came from POS.
- Desired: POS cancel does not reach ordinary sales invoices. A PosOrder return stays on `POST /pos/orders/returns`.
- Evidence: `pos.service.ts` `cancelPOSSale`. Route: `pos.routes.ts` `POST /sales/:id/cancel`, `pos` `edit`.
- Severity: any user who can edit POS can return a normal sales invoice and bypass the sales-return screen.
- Recommendation: same as A1. Turn the write off. Do not map it to `createReturn`.

### A3. Real-time stock route bypasses the sale

- Current: `POST /api/v1/pos/inventory/update-real-time` posts an inventory movement with `sourceType` `POS` and `sourceNumber` `RT`. No `PosOrder`, no sale journal, no session lock. Permission is `pos` `edit`.
- Desired: stock for a sale or return moves only inside `postOrder` / `unpostOrder` through `inventoryCostingService`.
- Evidence: `pos.service.ts` `updateInventoryRealTime`. Route: `pos.routes.ts` `POST /inventory/update-real-time`.
- Severity: on-hand can change with no matching revenue, COGS, or drawer figure. Repeated calls share `sourceNumber` `RT`, so they are not idempotent.
- Recommendation: reject the route. Do not keep a “quantity tweak” API on the cashier permission.

### A4. Unpost and reopen use the same rights as selling

- Current: `POST /pos/orders/:id/unpost` needs `pos` `post`, the same right required to sell. It reverses stock, the journal, shift totals, and the credit cache while the session is open. No reason is stored. The cashier screen has no unpost button. `POST /pos/shifts/:id/reopen` needs `pos` `edit`. It unposts the variance journal, marks `PosShiftClose.reopenedAt`, and opens the session again. The session screen has no reopen button.
- Desired: void, unpost, and reopen are a manager right, with a reason, separate from routine selling and from cash-in.
- Evidence: `pos-order.routes.ts` `POST /:id/unpost`. `pos-shift.routes.ts` `POST /:id/reopen`. Permission list: `permission-definitions.service.ts` resource `pos` actions `view`, `edit`, `post`, `override_tier_price`. `pos-order-posting.service.ts` `unpostOrder`. `pos-shift.service.ts` `reopenShift`.
- Severity: anyone who can sell can reverse a posted ticket. Anyone who can edit POS can undo a shortage journal. The accounting of a single unpost is tested. The missing control is who is allowed to call it.
- Recommendation: add `pos` actions for unpost and reopen, and do not grant them to the cashier role. Keep the existing reversal implementation.

### A5. Counted close is prefilled with the expected amount

- Current: the session page loads reconciliation and copies `expectedCash` into the counted-cash field. One click then closes. The server equation is correct if the counted figure is real. Payment breakdown is returned and not shown. There is no separate confirm step.
- Desired: the cashier types the count. Expected cash is visible and is not the default of the input. Close shows the variance and asks to confirm. Shortage still blocks when the account is missing.
- Evidence: `gates-web/app/pos/session/page.tsx` `loadPreview` sets `counted` from `equation.expectedCash`, then `closeSession` posts that value. Equation fields are rendered. `paymentBreakdown` is not.
- Severity: a normal close records variance 0 without a count, so shortage and overage never happen.
- Recommendation: start the count empty. Require an explicit number. Show the breakdown already on `GET /pos/shifts/:id/reconciliation` before posting the close.

### A6. The register is chosen by warehouse, not by terminal

- Current: `usePosSession` lists terminals and uses the first whose `warehouseId` matches the warehouse picker. There is no terminal picker. Two registers in one warehouse share the wrong drawer, safe, and opening cash. Terminal create exists (`POST /pos/terminals`). There is no update or deactivate route and no settings screen.
- Desired: the cashier selects the named register. Opening cash, the safe, and the bank belong to that register.
- Evidence: `gates-web/lib/hooks/usePosSession.ts` `matchedTerminal`. `pos-terminal.service.ts` has `create` and `list` only. `createPosTerminalSchema` stores branch, warehouse, safe, optional bank, optional default customer, name, optional device code.
- Severity: the second register’s sales hit the first register’s session.
- Recommendation: persist the last terminal on this browser and show its name. Add a small terminal maintenance screen on the existing `PosTerminal` model. Do not add a second device table.

## B. Important product gaps

### B1. No cashier discount or price override on the sell screen

- Current: the cart sends item, unit, and quantity only. The server price list, tier, and discount-percentage offer set the price. `override_tier_price` on `pos` or `invoice` lets the API trust a client price and discount. The sell screen never sends them. Gift and extra-quantity offers are not applied. `resolvePosLines` keeps only `how === 'discount-percentage'`.
- Desired: a permitted cashier can discount a line or override a price, and that action is visible. Other offers stay in the existing offer engine.
- Evidence: `point-of-sale/page.tsx` `linePayload`. `pos-pricing.service.ts` offer filter and `trustClientPrice`. `pos-order.routes.ts` `canOverridePosPrice`.
- Reason: Daftra selling includes a line discount. The engine exists. The screen does not use it.
- Recommendation: add discount entry that posts `discountPercent` only when `override_tier_price` is granted. Extend offer application through `itemOfferService`, not a new promotion engine.

### B2. A cart line cannot represent a posted void

- Current: the trash icon removes a cart line before pay. That does not touch stock. After pay, the only reversal is `unpost` (A4) or a linked return. `VOID` is a type name and is never set.
- Desired: before pay, line delete stays local. After pay, a manager void is an unpost or a full return, with a reason.
- Evidence: `point-of-sale/page.tsx` trash button filters the cart. `pos.types.ts` `PosOrderStatus` includes `VOID`. No assignment in the posting service.
- Recommendation: do not add a third document type. Use unpost for an open-session mistake and `createReturn` for a later refund.

### B3. Receipt reprint has no separate right

- Current: after pay, the sell screen loads `GET /pos/orders/:id/receipt` and can browser-print or use the existing Bluetooth thermal helper. Any `pos` `view` user can read that receipt. There is no reprint log.
- Desired: reprint is allowed and recorded. The thermal helpers already in `gates-web/lib/printer` stay.
- Evidence: `point-of-sale/page.tsx` checkout then `printThermalViaBrowser`. `pos-order.routes.ts` `GET /:id/receipt` uses `view`.
- Recommendation: log reprint on the existing audit service when a posted receipt is printed again. Do not add a printer SDK.

### B4. Payment methods and the drawer account are fixed strings

- Current: methods are `CASH`, `CARD`, `BANK`, `WALLET`, `CREDIT`. Cash uses the terminal safe. Card, bank, and wallet use the terminal bank. The payment sheet cannot pick another safe or bank. There is no payment-method master.
- Desired: later, a branch can enable methods and point them at an existing safe or bank account.
- Evidence: `pos.schema.ts` `posPaymentSchema`. `pos-payment.service.ts` `preparePosPayments`. `point-of-sale/page.tsx` method list.
- Recommendation: keep the string methods for the first shop. A later master should reference `Safe` and `BankAccount`, not a new treasury.

### B5. Return screen is a single tender and does not print

- Current: `/pos/returns` searches by receipt number, edits quantities, and posts one of cash, card, or credit. The server replaces that single payment amount with the return net. Split refund is not on the screen. Success only shows “تم المرتجع”. No receipt. The browser was not used to click this page.
- Desired: show remaining quantity, the refund total from the server, and print the return receipt. Split refund can wait if one tender is enough for go-live.
- Evidence: `gates-web/app/pos/returns/page.tsx`. `pos-order.routes.ts` `POST /returns` overwrites a one-line payment.
- Recommendation: after post, open the same receipt endpoint used by the sell screen. Keep quantity enforcement on the server.

### B6. Cash in/out asks for an account from the first 30 chart rows

- Current: the session page loads `GET /accounting/accounts?limit=30` and posts `contraAccountId`. The service resolves that id through `invoiceAccountResolverService`. A chart larger than 30 rows hides the owner’s drawing or expense account. The browser was not used to click this page.
- Desired: search the chart the way other Gates documents do.
- Evidence: `session/page.tsx` `useApiQuery` on `/accounting/accounts`. `pos-cash-movement.service.ts` `record`.
- Recommendation: use the existing account picker. Do not invent a cash-movement account list.

### B7. Customer credit is a tender, not a credit workspace

- Current: credit requires a customer and is rejected above a non-null credit limit. `customer.balance` moves as a cache. The AR journal is the ledger. The sell screen can search customers and uses the terminal default customer. No aging, no approval, no statement on the register.
- Desired: the cashier sees the customer and the limit. Aging stays on the existing customer reports.
- Evidence: `pos-payment.service.ts` credit branch. `point-of-sale/page.tsx` customer search.
- Recommendation: show limit and balance from the customer already loaded. Do not add a POS credit module.

### B8. Session reports stop at the close snapshot

- Current: the hub and daily page read posted `PosOrder`. Reconciliation returns the live equation and the latest unreopened `PosShiftClose`. The session page shows the equation, not payments, cashier name, or times, until after close. There is no product, cashier, or hour report. `buildZReport` still summarizes shift columns.
- Desired: a closed session is read from `PosShiftClose`. Product and cashier reports can come later from `PosOrder` lines.
- Evidence: `pos.service.ts` `getDailyPOSReport` / `listPostedPosOrders`. `session/page.tsx`. `pos-shift.service.ts` `buildZReport` and `reconciliation`.
- Recommendation: render the snapshot fields that are already stored. Do not recompute a closed session from current prices.

### B9. No POS audit trail

- Current: post, unpost, hold, cash movement, close, and reopen do not call `document-audit.service.ts`. Security middleware logs HTTP events, not the business action.
- Desired: those actions are audit rows on the existing audit service.
- Evidence: no `document-audit` or `documentAudit` use under `gates-backend/src/modules/pos`.
- Recommendation: call the existing audit helper at the end of each committed action. Do not add a POS log table.

### B10. Dead or duplicate client paths

- Current: `submitPosWave2Order` posts a client price and the legacy tender columns and has no caller. `PosTenderModal` and `computePosCartTotals` have no caller. The sell screen quotes the server. Barcode on the sell screen is `GET /pos/catalog/barcode`. `GET /pos/terminals/items/lookup` is a second barcode lookup and is not used by the page. `GET /pos/sales` lists posted sales invoices of every origin and presents them as POS sales.
- Desired: one sell submit path and one barcode lookup. Legacy reads must not look like the live register.
- Evidence: `usePosSession.ts` `submitPosWave2Order`. `components/pos/PosTenderModal.tsx`. `lib/pos/computePosCartTotals.ts`. `pos-terminal.routes.ts` `GET /items/lookup`. `pos.service.ts` `listPOSSales` filters `invoiceType: 'sales'` and `isPosted: true` only.
- Recommendation: leave the functions unused until a delete pass. Do not point the hub at `GET /pos/sales`.

## C. Optional / advanced

Not required for a first retail register.

- Offline outbox, service worker, or a second post on reconnect. Create and post are not idempotent across a client-generated key.
- Restaurant tables, courses, kitchen display, tips, split bills.
- Serial, batch, expiry, or weighted barcode. Item barcode is a single field. `ItemUnit` has no barcode.
- Hardware payment terminals, cash-drawer kick, customer display, scale. Browser thermal print and a keyboard wedge already exist.
- Named shift templates (morning / evening). `shiftNumber` is an optional label.
- Manager approval bands for a variance tolerance. Non-zero variance already posts or blocks. A tolerance workflow is Phase 4.
- ETA receipt compliance beyond the existing `submitPosReceipt` path. Do not merge it with B2B signing.
- Stable machine error codes. Routes throw sentence errors.

## What is already in place

Do not rebuild these.

| Step | Where it lives |
| --- | --- |
| One open session per terminal | `openTerminalKey` |
| Server price, tax, and percent offers | `resolvePosLines`, `computeLineAmounts` |
| Hold and resume without stock or a journal | `heldAt` on a draft |
| Split tender, cash tender, change | `PosPayment.amount` is the drawer and the journal. Change is audit only |
| Catalog page and barcode | `GET /pos/catalog`, `GET /pos/catalog/barcode` |
| Linked return, quantity cap, original cost | `resolveReturn` inside `postOrder`, before the draft becomes posted |
| Cash in and cash out | `PosCashMovement` and a journal to a real chart account |
| Expected cash | opening + cash sales − cash refunds + cash in − cash out |
| Shortage and overage | configured shortage and surplus accounts, or the close is rejected |
| Closed figures | `PosShiftClose` while `reopenedAt` is null |
| Stock and COGS | `inventoryCostingService` only |

## Legacy and bypass summary

| Route | After Phase 4A | Called by the new UI |
| --- | --- | --- |
| `POST /api/v1/pos/sales` | 410. Does not create an invoice | No |
| `POST /api/v1/pos/sales/:id/cancel` | 410. Does not return an invoice | No |
| `GET /api/v1/pos/sales` and `GET /api/v1/pos/sales/:id` | 410. Does not list sales invoices as POS | No |
| `POST /api/v1/pos/sales/:id/print-receipt` | 410. Receipts come from `GET /pos/orders/:id/receipt` | No |
| `POST /api/v1/pos/inventory/update-real-time` | 410. Does not move stock | No |
| `GET /api/v1/pos/daily-report` | Posted `PosOrder` rows | Daily page |
| `POST /api/v1/pos/orders/:id/unpost` | Requires `pos` `unpost`. Ordinary `post` is 403 | No button |
| `POST /api/v1/pos/shifts/:id/reopen` | Requires `pos` `reopen_shift`. Ordinary `edit` is 403 | No button |

## Production use after migrations

Phase 4A removes the side paths that could post money or stock around `PosOrder`. The supported cashier path is `PosOrder` → posting → inventory costing → journal → `PosPayment`. Close still uses `expected = opening + cash sales − cash refunds + cash in − cash out` and `variance = counted − expected`. A zero variance close does not need the shortage or surplus accounts. A non-zero variance still returns 422 when the matching account is missing, and the hub and session screens say so before the cashier counts.

It is still not ready to hand to a cashier on production until the Phase 1–4B migrations are applied there. None of those migrations are deployed. Phase 4B is local code only (`20260930210000_pos_phase4b_retail`).

After 4B, a cashier with only `view`, `edit`, and `post` cannot discount, override a price, or reprint. Discount uses `pos` `discount`. Price override still uses `pos` or `invoice` `override_tier_price`. Reprint uses `pos` `reprint`. The first customer copy is attached to the post response and does not call the reprint route. A company admin still passes every action through the existing Gates wildcard role.

Still open after 4B: a posted void is still unpost or a linked return (B2), credit is still a tender rather than a workspace (B7), there is no manager approval tolerance for a variance, and section C is unchanged. Gift and extra-quantity offers are still not applied. The sell screen was not clicked in a browser in this pass.
