# POS current state audit

Inspection date: 2026-09-30. Phase 1 correctness, Phase 2 cashier workflow, and Phase 3 returns, drawer movements, and counted close are in the code. Phase 4A production safety and Phase 4B retail controls are in the code and are not deployed. Manager-approval tolerance for a variance is not. The bullets below are the Phase 2 inspection; payment methods, reprint, discount, and reports are described in `POS_REMEDIATION_PLAN.md` Phase 4B.

Phase 2, as shipped:

- Sell screen: `/pos/point-of-sale` searches `GET /api/v1/pos/catalog` (24 cards, cursor), categories, barcode wedge, cart quantity, hold chips, and a payment sheet.
- Prices: `resolvePosLines` uses the customer price list, item tier, and discount-percentage offers. The HTTP create/update path ignores a client price unless `pos` or `invoice` `override_tier_price` is granted. `computePosCartTotals` is not used by the sell screen.
- Hold: `PosOrder.heldAt` on a DRAFT. Hold does not post stock or a journal. Resume clears `heldAt`.
- Payments: `pos_payments`. `amount` is the journal figure. Cash `tenderedAmount` and `changeAmount` are audit only. Methods: CASH, CARD, BANK, WALLET, CREDIT. Legacy `cashAmount` / `cardAmount` / `creditAmount` are still written.
- Opening cash is the amount the cashier enters when the session is opened.
- Receipt: `GET /pos/orders/:id/receipt` for a POSTED order, printed through the existing thermal helpers.
- Migration: `20260930190000_pos_payments_and_hold`. It does not rewrite historical tender columns.

Approved decisions, treated as binding for later implementation:

- `PosOrder` is the authoritative POS financial document.
- A POS sale must not also create a `SalesInvoice`.
- Shared accounting, inventory, tax, pricing, customer, and warehouse engines stay authoritative.
- `PosShift` stays the operational session. A named shift template is a separate label and does not replace the session.
- ETA POS receipts stay separate from B2B electronic-invoice signing.
- `POST /api/v1/pos/sales` is legacy and must not be deleted until callers are proven absent.
- `InventoryMovement` is inventory truth. `ItemQuantity` and `ItemWarehouseBalance` are caches.

## 1. Current architecture

Gates mounts two POS backends.

The cashier that ships in the web app uses the Wave 2 path:

`/pos/point-of-sale` → `POST /api/v1/pos/orders` → `POST /api/v1/pos/orders/:id/post`

`postOrder` in `gates-backend/src/modules/pos/services/pos-order-posting.service.ts` writes one `JournalEntry` per order (`sourceType = POS`) and one `InventoryMovement` per line (`POS-SALE` or `POS-RETURN`). It does not call `invoice-posting-orchestrator.ts` and does not insert an `Invoice`.

Shift close in `gates-backend/src/modules/pos/services/pos-shift.service.ts` is drawer reconciliation only. Revenue, VAT, COGS, inventory, and tender are already in the ledger. A variance journal (`entryType = POS-Z`, `sourceType = POS-VARIANCE`) is created only when declared cash differs from system cash.

The legacy path is still mounted and is not redirected:

`gates-backend/src/modules/pos/routes/pos.routes.ts` → `POSService.createPOSSale` creates a sales invoice, posts it through the invoice orchestrator, then collects payment. List, get, cancel, print, and real-time stock still read or mutate `Invoice`. The daily report and the hub no longer do. They read posted `PosOrder` rows.

ETA receipts are a third, separate consumer of `PosOrder`: `eInvoiceSubmissionService.submitPosReceipt` and `eInvoicePayloadBuilderService.buildFromPosOrder`, queued from `POST .../submit-receipt/:posOrderId`. `EInvoiceDocument.posOrderId` links them. This is not the B2B sign-and-send flow.

`docs/migration/modules/M6-POS.md` now matches per-order posting. Shift close is cash variance only.

## 2. Database models

Defined in `gates-backend/prisma/schema.prisma` around lines 7870–7997. Statuses are strings, not enums. Migrations that touch these tables: `20250816190000_wave2_m6_pos` (tables, almost no foreign keys), `20260821050000_phase4_pos_order_journal` (`journalEntryId`, `discountPercent`), and `20260930180000_pos_one_open_shift` (`openTerminalKey`).

### PosTerminal (`pos_terminals`)

Company, branch, warehouse, safe, optional bank account, optional default customer, name, optional `deviceCode`, `isActive`. Unique `(companyId, deviceCode)`. Nullable `deviceCode` does not prevent two unnamed terminals. There is no receipt template, allowed payment-method list, or price-list field. No update/deactivate route.

### PosShift (`pos_shifts`) — operational session

Company, branch, fiscal year, terminal, `userId` (string, no `User` relation), optional `shiftNumber`, status default `OPEN`, `openedAt`, `closedAt`, `openingCash`, `closingCashDeclared`, `closingCashSystem`, `cashVariance`, running totals (`totalCashSales`, `totalCardSales`, `totalCreditSales`, `totalMerchandise`, `totalTaxAmount`, `totalCogs`), optional `endOfDayJournalEntryId`.

`openTerminalKey` is the terminal id while `OPEN` and null when `CLOSED`, with a unique index on `(companyId, openTerminalKey)`. `status` is `VarChar(10)` (`OPEN` / `CLOSED` in code). There is no `CLOSING` state and no shift-template table.

### PosOrder (`pos_orders`)

Company, shift, client-supplied `orderNumber` unique per company, `orderType` `SALE` or `RETURN`, optional `originalOrderId`, status `DRAFT` or `POSTED` (`VOID` is named in types and never set), optional customer, `barcodeRef`, header money at `Decimal(15,2)`, tender columns `cashAmount` / `cardAmount` / `creditAmount`, `paymentMethod`, currency, `journalEntryId`, `postedAt`, `postedBy`. Relation `eInvoiceDocuments`. No `invoiceId`.

### PosOrderLine (`pos_order_lines`)

Item, unit, quantity `Decimal(15,4)`, price `Decimal(15,4)`, `discountPercent`, `discountAmount`, `taxPercent`, `taxAmount`, `lineTotal`, `unitCost`, `lineOrder`. No `companyId`. Not in the tenant-scoped model list; the parent order is.

`PosOrderLine.originalLineId` links a return line to the sold line. `PosCashMovement` (`pos_cash_movements`) is CASH_IN or CASH_OUT: company, session, terminal, amount, type, reason, user, timestamp, contra account, safe, and journal. `PosShiftClose` (`pos_shift_closes`) stores the counted-close snapshot, including terminal name, cashier, payment breakdown, expected cash, counted cash, and variance. `reopenedAt` marks a snapshot that was undone; the row is kept. There is still no shift template, idempotency-key column, or offline outbox. `PosPayment` remains the tender subledger.

## 3. Pages

| Route | File | Role |
| --- | --- | --- |
| `/pos` | `gates-web/app/pos/page.tsx` | Hub. Last 50 posted `PosOrder` rows from `GET /pos/orders`. Not in the sidebar. |
| `/pos/point-of-sale` | `gates-web/app/pos/point-of-sale/page.tsx` | Cashier. Cart, catalog, barcode, tender modal, in-memory hold, shift close via `window.prompt`. |
| `/pos/daily` | `gates-web/app/pos/daily/page.tsx` | Daily report filters. |
| `/pos/daily/preview` | `gates-web/app/pos/daily/preview/page.tsx` | Report viewer. |

Sidebar links cashier and daily only (`app/components/Sidebar.tsx`).

Shared UI: `gates-web/components/pos/PosTenderModal.tsx`, `gates-web/lib/hooks/usePosSession.ts`, `gates-web/lib/pos/computePosCartTotals.ts`.

## 4. APIs

Mounted in `gates-backend/src/app.ts`.

Wave 2 (`authenticate` + tenant/fiscal context, so `X-Branch-Id` and `X-Fiscal-Year-Id`):

| Method | Path | Permission | Behavior |
| --- | --- | --- | --- |
| GET | `/api/v1/pos/terminals` | `pos` `view` | List active terminals |
| POST | `/api/v1/pos/terminals` | `pos` `edit` | Create |
| GET | `/api/v1/pos/terminals/items/lookup` | `pos` `view` | Barcode lookup |
| POST | `/api/v1/pos/shifts/open` | `pos` `edit` | Open session |
| GET | `/api/v1/pos/shifts/open` | `pos` `view` | Open session + Z-report |
| GET | `/api/v1/pos/shifts/:id` | `pos` `view` | One session + Z-report |
| POST | `/api/v1/pos/shifts/:id/close` | `pos` `edit` | Declare cash, optional variance JE |
| POST | `/api/v1/pos/shifts/:id/reopen` | `pos` `edit` | Reverse variance JE, set `OPEN` |
| POST | `/api/v1/pos/orders` | `pos` `edit` | Create `DRAFT` |
| POST | `/api/v1/pos/orders/:id/post` | `pos` `post` | Stock + journal |
| POST | `/api/v1/pos/orders/:id/unpost` | `pos` `post` | Reverse, blocked if shift closed |

Not exposed: order list/get, draft update, hold, void, `postReturn` (service method only).

Legacy (`authenticate` + tenant only):

| Method | Path | Behavior |
| --- | --- | --- |
| POST/GET | `/api/v1/pos/sales` | Create/list posted sales invoices |
| GET | `/api/v1/pos/sales/:id` | Invoice |
| POST | `/api/v1/pos/sales/:id/cancel` | Cancel invoice |
| GET | `/api/v1/pos/daily-report` | Posted `PosOrder` rows for a local day. Historical invoices are not included. |
| POST | `/api/v1/pos/sales/:id/print-receipt` | HTML stub |
| POST | `/api/v1/pos/inventory/update-real-time` | Ad hoc stock delta, `sourceNumber = RT`, no order and no costing |

`pos.schema.ts` marks `/pos/sales` as the deprecated invoice route. The cashier, hub, and daily report do not call it.

## 5. Accounting flow

`PosAccountResolverService.resolveForShiftClose` resolves cash from the terminal safe, optional bank, and company account definitions for revenue, VAT output, COGS, inventory, AR, shortage, and surplus. The same resolver is used for every order post, not only shift close.

On sale post the journal debits cash, bank, and/or AR and COGS; it credits revenue, VAT, and inventory. Returns flip the sign. `journalPostingService.createAndPostInTx` sets `activeSourceKey = companyId|POS|orderNumber|sourceYearId`. `sourceYearId` comes from the request fiscal year, not from a column on the order. `JournalEntry.activeSourceKey` is unique, and NULLs do not collide, so a reversal can clear the slot and a later repost can take it again.

Shift aggregates are incremented in the same transaction as informational Z-report numbers. They do not post revenue.

Close posts shortage (Dr shortage, Cr cash) or surplus (Dr cash, Cr surplus) only when `abs(variance) > 0.0001` and the matching account exists. Zero variance writes no journal. Reopen reverses that journal if present.

Legacy `/pos/sales` posts through the invoice orchestrator and settlement. That is a second financial document and must not be used for new cashier sales.

## 6. Inventory flow

Warehouse on a Wave 2 post is `order.shift.terminal.warehouseId`. The client warehouse picker selects which terminal to use; the post does not trust a warehouse id on the order body.

`postOrder` calls `inventoryCostingService.applyOutboundMovement` for a sale and `applyInboundMovement` for a return. Those methods already write the inventory movement. POS does not call `postMovementInTx` again. COGS is the costing `totalValuation`. Unpost of a sale uses `applyInboundMovement` at the stored line `unitCost`. Unpost of a return uses `reverseInboundInTx`.

`POST /pos/inventory/update-real-time` is a third writer. It is outside the order.

Quantity caches are updated inside `postMovementInTx`. They are not a source of truth.

## 7. Payment flow

No payment-line table. Create requires `cashAmount + cardAmount + creditAmount` to match server `netAmount` within `0.0001`, and the method enum (`CASH`, `CARD`, `CREDIT`, `SPLIT`) must agree with which columns are non-zero.

There is no tendered-cash field, no change, no payment-method master, and no link to treasury receipt documents. Cash hits the safe GL. Card hits the terminal bank GL. Credit hits AR with `partnerId` when a customer is present. Customer credit limits are not checked. The terminal `defaultCustomerId` is not applied by the cashier; the screen falls back to `customers[0]`.

The UI tender modal computes change locally and does not send `tenderPaid`. A dead `SPLIT` branch splits 50/50. `submitPosWave2Order` sends one full-net amount on cash, card, or credit.

## 8. Session, shift template, device

`PosTerminal` is the device/register. `PosShift` is the open/closed operational session, not a named Morning/Evening template. No template model exists.

`openTerminalKey` allows one OPEN session per terminal. The cashier enters opening cash. Close is `/pos/session`: the server computes expected cash, the cashier enters the count, and the screen confirms the snapshot before the session is closed.

Expected drawer cash, computed inside the close lock from posted orders and cash movements:

```
openingCash + cashSales - cashRefunds + cashIn - cashOut
```

`cashSales` and `cashRefunds` are `PosPayment.amount` where method is CASH, split by SALE and RETURN. An order with no payment rows falls back to the legacy tender columns. Change is not in the equation. A session with no sales can still close.

Variance is `counted - expected`. A non-zero variance posts one `POS-VARIANCE` journal (`entryType` `POS-Z`) to the configured shortage or surplus account. Missing configuration blocks the close. Zero variance writes no journal. The same counted amount on an already closed session returns the existing snapshot.

## 9. Returns

`POST /pos/orders/returns` copies price, discount, and tax from the posted sale and stores `originalOrderId` plus `originalLineId`. The original sale is not updated. After the DRAFT→POSTED claim, the original sale row is locked and the sum of posted return quantities for that line is rejected when it exceeds the sold quantity. Stock comes back through `inventoryCostingService.applyInboundMovement` at the original line's stored unit cost. Revenue, tax, COGS, and tender use the existing return sign flip. A return belongs to the current open session, including a session opened after the original sale was closed. `customer.balance` moves with CREDIT only and stays a cache; the AR journal is the ledger. Unlinked RETURN orders that predate this path still post. `VOID` is unused.

Legacy cancel hits the invoice path only.

## 10. Reports

`GET /api/v1/pos/daily-report` and the hub query posted `PosOrder` rows only. Draft and unposted orders are excluded. Historical `/pos/sales` invoices have no POS marker, so they stay on sales-invoice reports and are not guessed into this report.

`GET /pos/shifts/:id/reconciliation` returns the live drawer equation and the latest unreopened `PosShiftClose`. `/pos/session` renders opening cash, sales, returns, payment breakdown, cash in/out, expected cash, counted cash, and shortage or overage. A closed session's historical figures are that snapshot, not a recompute from current prices. Product, cashier, and hour reports are still missing.

## 11. Permissions

`permission-definitions.service.ts` resource `pos`, actions `view`, `edit`, `post`. Routes use `authorize`. There are no actions for discount, price override, return, void, cash in/out, reprint, or cash-difference approval.

`resource-from-path.ts` maps only `/pos/point-of-sale` to `pos`. The cashier page does not hide buttons with `useResourcePermissions`. `/pos` and `/pos/daily` are unmapped, so the client treats them as allowed. Server checks still apply to the APIs those screens call.

## 12. Offline

No service worker, IndexedDB, or outbox. Cart and held tickets die on refresh. `orderNumber` is `POS-${Date.now()}` in the page, unique per company only after insert.

## 13. Hardware

Barcode is a focused text field plus Enter (`findItemByBarcode` / terminal lookup). Lookup matches item barcode, serial string, or id. No unit barcode, lot, or weighted barcode.

Receipt after pay is `printHtml` in the browser. ESC/POS, Bluetooth, and RawBT live under `gates-web/lib/printer/` and `components/printer/ThermalPrintModal.tsx` for invoices. POS does not import them. No cash-drawer kick, customer display, scale, or payment terminal.

## 14. Keep as-is

- Per-order journal at post time, with shift close limited to cash variance.
- `PosOrder` as the financial document. Do not add an invoice insert on this path.
- `computeLineAmounts` for server line math.
- `journalPostingService.createAndPostInTx` and `reverseJournalEntryInTx`.
- Terminal warehouse and safe/bank as the stock and tender GL sources.
- Unpost claim via `updateMany` where `status = POSTED` (extend the same idea to post; do not weaken unpost).
- Separate ETA receipt builder keyed by `posOrderId`.
- Invoice, inventory, tax, price-list, customer, and warehouse modules as the engines POS calls.

## 15. Repair

- `postOrder` claims `DRAFT→POSTED` inside the posting transaction. Closed in Phase 1.
- One OPEN session per terminal via `openTerminalKey`. Closed in Phase 1.
- Costing goes through `inventoryCostingService`. Closed in Phase 1.
- Header money and tender checks use the persisted 2dp scale. Closed in Phase 1.
- The printed receipt uses the server `netAmount` after create. Cart preview math is still `computePosCartTotals`.
- Daily report and hub read posted `PosOrder`. Closed in Phase 1.
- Tender UI does not implement the split/change columns the table already has.
- Hold is memory only.
- `postReturn` is unwired and unbounded.
- Permissions are three coarse actions.
- `update-real-time` can move stock outside an order.

## 16. Missing

Shift templates, `CLOSING`, cash in/out, payment lines, change, counted-cash snapshot, hold on the server, void with audit, return quantity caps, manager override, offline outbox, POS error codes, restaurant tables. Do not build the deferred list in the remediation plan's "DO NOT IMPLEMENT YET" section as part of the first correctness work.

## 17. Reuse instead of copying

| Need | Existing engine |
| --- | --- |
| Line tax and discount | `invoice-line-math.ts` `computeLineAmounts` |
| GL post/reverse, `activeSourceKey` | `journal-posting.service.ts` |
| Stock ledger and quantity cache update | `stock-movement.service.ts` `postMovementInTx` |
| Moving-average issue/receipt | `inventory-costing.service.ts` `applyOutboundMovement` / `applyInboundMovement` |
| Safe and bank GL | `pos-account-resolver.service.ts` plus treasury resolver |
| Price | `PriceList`, `ItemPrice`, `price-list.service.ts` (not called by POS today) |
| Promotions | `ItemOffer` via sales-document enrichment (not called by POS today) |
| Credit limit | `partyCreditService` on invoice post (not called by POS today) |
| Customers, warehouses, branches | Existing models. No customer barcode column. |
| Thermal print | `gates-web/lib/printer/*` (not used by POS today) |
| Audit | `document-audit.service.ts` (not called by POS today) |
| Posting claim pattern | `claim-document-post.ts` and the POS unpost `updateMany` |

## 18. Correctness and concurrency

1. Closed in Phase 1. `postOrder` claims `DRAFT→POSTED` as the first write of the posting transaction. A second call returns that posted order and writes nothing. `activeSourceKey` is only a journal backstop.
2. Closed in Phase 1. `openTerminalKey` is unique per company while the session is OPEN and null when CLOSED.
3. Closed in Phase 1 for the stored total and the receipt after a successful create. The cashier still previews with `computePosCartTotals`. The server rejects a tender that does not match the 2dp net.
4. Closed in Phase 1. New POS sales take COGS from `inventoryCostingService`. Old POS movements were not revalued.
5. `InventoryMovement` still has no unique source key. The order claim is what stops a double post.
6. Closed in Phase 3 for the drawer equation. Close locks the session, recomputes expected cash, writes `PosShiftClose`, and posts variance only when it is non-zero. Reopen unposts that journal once, keeps the snapshot with `reopenedAt`, and opens the session again. A second close inserts a new snapshot.
7. Closed in Phase 1 for current `PosOrder` sales. Historical `/pos/sales` invoices are still not in this report, because they have no POS marker.
8. `update-real-time` retries share `sourceNumber = RT`.

Phase 1 tests: `pos-phase1-foundation.test.ts`, `pos-money.spec.ts`, `pos-posting-guards.spec.ts`. Phase 2: `pos-phase2-cashier.test.ts`. Phase 3: `pos-drawer.spec.ts` and `pos-phase3-session.test.ts`. Unpost coverage remains `pos-order-unpost-concurrency.test.ts`.

## 19. Target architecture (approved)

Keep the Wave 2 shape.

`PosTerminal` is the register. `PosShift` is the session (`OPEN`, later `CLOSING`, `CLOSED`). `PosShiftTemplate` may name Morning/Evening; it does not replace the session row.

A completed sale is one `PosOrder` in `POSTED`, at most one active `JournalEntry` with `sourceType = POS`, and one costing-backed ledger movement per line. Unpost and a later repost are allowed only through the existing reversal rules while the session is `OPEN`. Historical posted orders are not deleted.

Do not create `Invoice` rows for these sales. Legacy `/pos/sales` stays mounted until nothing calls it. Reports that claim to be POS activity must read `PosOrder`. Invoice reports stay invoice reports.

`PosPayment` is the tender subledger. The three columns on `PosOrder` remain a projection for older readers and for shift totals. Change lives on the payment row, not in those columns.

ETA receipt submission keeps using `buildFromPosOrder`.

## 20. Phase order

See `POS_REMEDIATION_PLAN.md`. Phase 1 is correctness. Phase 2 is the cashier workflow. Phase 3 is counted close, cash in/out, and returns.
