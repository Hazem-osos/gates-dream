# POS requirements matrix

Status values: `EXISTS_AND_CORRECT`, `EXISTS_BUT_INCOMPLETE`, `EXISTS_BUT_ARCHITECTURALLY_WRONG`, `MISSING`, `EXISTS_ELSEWHERE_REUSE`, `LEGACY_CONFLICT`.

Bindings: `PosOrder` is the financial document; no second sales invoice; `PosShift` is the session; ETA receipts stay off the B2B signing flow; `/api/v1/pos/sales` is not deleted here; `InventoryMovement` is stock truth.

| # | Requirement | Status | Where it lives / what is wrong |
| --- | --- | --- | --- |
| 1 | Register → session → cashier → orders → payments → close → GL and stock | `EXISTS_AND_CORRECT` | Phase 3 closes from persisted payments and cash movements and stores `PosShiftClose`. One journal per order. Variance is a separate journal. |
| 2 | Named shift templates (Morning/Evening), not hard-coded times | `MISSING` | `PosShift.shiftNumber` is an optional label on the session. No template model. Do not rename `PosShift`. |
| 3 | No sale without an open session; explicit lifecycle; no double open/close/post | `EXISTS_AND_CORRECT` | Post, return, cash movement, and close lock the session row. A closed session rejects new operations. Repeat close with the same count returns the snapshot. Status is still only `OPEN`/`CLOSED`. |
| 4 | Opening: device, shift, opening cash, resume existing session | `EXISTS_BUT_INCOMPLETE` | The cashier sends the entered opening cash when no session is open, and resumes an existing OPEN session. No shift template. |
| 5 | Fast sell screen: category, cards, search, barcode, pay, next customer | `EXISTS_AND_CORRECT` | `/pos/point-of-sale` loads 24 catalog cards from the server, with category filters, search, barcode, and a payment sheet. |
| 6 | Products respect company, branch, warehouse, price list, tax, stock policy, units | `EXISTS_BUT_INCOMPLETE` | Catalog and quote use company items, the terminal warehouse, the customer price list or tier, and item/category tax. No POS category allow-list. Negative stock still follows company settings. |
| 7 | Barcode adds or increments; unknown code is non-blocking | `EXISTS_AND_CORRECT` | Window keydown wedge calls `GET /pos/catalog/barcode`. A known code increments the cart. An unknown code sets an error and does not block the screen. |
| 7a | Unit barcode, serial, batch, weighted barcode | `MISSING` | `Item.barcode` only. `ItemUnit` has no barcode. No weighted parser. Do not invent serial/batch for POS. |
| 8 | Cart qty, unit, price, discounts, tax, remove; server enforces | `EXISTS_AND_CORRECT` | The sell screen edits quantity and removes lines. Price, discount, and tax are resolved on the server. A manual discount needs `pos` `discount`. A manual price needs `override_tier_price`. Without the flag the API returns 403. |
| 9 | Default cash customer, search, price list, credit | `EXISTS_BUT_INCOMPLETE` | Terminal `defaultCustomerId` is selected automatically. Search is `GET /pos/catalog/customers`. Price list and tier drive the unit price. Credit above a non-null `creditLimit` is rejected. There is no separate credit subsystem. |
| 10 | Price lists stay in the pricing engine | `EXISTS_AND_CORRECT` | POS uses `ItemPrice`, `PriceList.priceMode`, and the item tier columns. It does not store a second price engine. |
| 11 | Hold order on the server with lines, customer, discounts | `EXISTS_AND_CORRECT` | Hold sets `heldAt` on a DRAFT and keeps lines, customer, notes, and server prices. Refresh reloads `GET /pos/orders/held`. No stock or journal. |
| 12 | Switch several open/held orders without extra browser tabs | `EXISTS_AND_CORRECT` | Held orders for the open session are chips on the sell screen. Resume loads that draft into the cart. |
| 13 | Configurable payment methods, not hard-coded | `EXISTS_AND_CORRECT` | `pos_payment_methods` stores code, name, settlement, active state, safe or bank, and optional branch or terminal. No rows means the built-in codes still post. A disabled method is rejected. Posted `method` and `methodLabel` are not rewritten. CREDIT stays on the customer AR path. |
| 14 | Split payment with total, paid, remaining, change | `EXISTS_AND_CORRECT` | Any number of payment lines. The server rejects the post unless the sum of `amount` equals the 2dp net. |
| 15 | Cash tender and change; change is not revenue | `EXISTS_AND_CORRECT` | Cash stores tendered and change. The journal cash debit and `totalCashSales` use `amount` only. |
| 16 | Partial or credit sale only for a real customer | `EXISTS_BUT_INCOMPLETE` | CREDIT requires a customer and is rejected when it exceeds a non-null credit limit. There is no aging or approval workflow. |
| 17 | Cash in / cash out with reason, user, GL | `EXISTS_AND_CORRECT` | `PosCashMovement` posts `POS-CASH-IN` or `POS-CASH-OUT` between the safe GL and a chart contra account. It does not create a sale. |
| 18 | Full and partial return; cap quantity; reverse stock, revenue, tax, COGS, tender | `EXISTS_AND_CORRECT` | `POST /pos/orders/returns` links `originalOrderId` and `originalLineId`. Posted return quantity cannot exceed the sold quantity. Costing uses the original unit cost. |
| 19 | Return after the original session is closed, without rewriting that session | `EXISTS_AND_CORRECT` | The return is a new `PosOrder` on the current open session. The original order and its close snapshot stay unchanged. |
| 20 | Distinguish line delete, cancel hold, void, and refund | `MISSING` | Line delete is local. No void. Posted rows are not deleted, which is correct, but there is no audited void either. |
| 21 | Close shows expected vs counted cash | `EXISTS_AND_CORRECT` | `/pos/session` shows the server equation and stores counted cash on `PosShiftClose`. |
| 22 | Shortage and overage accounts; no silent force to expected | `EXISTS_AND_CORRECT` | Variance JE only when non-zero; missing accounts 422. Manager-approval tolerance is still Phase 4. |
| 23 | Hand cash to treasury or another employee | `EXISTS_ELSEWHERE_REUSE` | `Safe` is on the terminal. No session handover document. Do not build a second treasury. |
| 24 | Session summary before and after close | `EXISTS_AND_CORRECT` | Reconciliation returns the live equation. After close, reports read `PosShiftClose` where `reopenedAt` is null. |
| 25 | One accounting mode with traceability | `EXISTS_AND_CORRECT` | Mode A: one journal per `PosOrder`. Shift close does not re-post revenue. Do not add aggregated session posting in Phase 1. |
| 26 | Revenue, VAT, tender, inventory, COGS, discounts, returns, differences | `EXISTS_AND_CORRECT` | Sale and return journals stay on the order. Cash in/out and variance are their own journals. Return COGS uses the original line unit cost. |
| 27 | Stock issue and return through the inventory engine; warehouse from the session | `EXISTS_AND_CORRECT` | Warehouse is the terminal's. Phase 1 posts through `inventoryCostingService` only, which writes the one ledger movement. |
| 28 | Batched stock on the sell screen; caches are not truth | `EXISTS_AND_CORRECT` | Catalog stock is one `itemWarehouseBalance` read for the page. Posting still uses inventory costing, not that cache. |
| 29 | Tax from the Gates tax math; inclusive/exclusive; return reverses tax | `EXISTS_ELSEWHERE_REUSE` | Server: `computeLineAmounts` (tax on net after line discount, exclusive). UI recomputes with raw floats. No inclusive POS price mode. Return tax is the flipped VAT line. |
| 30 | ETA electronic receipt identity, separate from B2B e-invoice | `EXISTS_BUT_INCOMPLETE` | `submitPosReceipt`, `buildFromPosOrder`, `EInvoiceDocument.posOrderId`. Do not merge with complete-sign. Receipt compliance is not a Phase 1 blocker. |
| 31 | Thermal receipt: company, items, tax, payments, change, reprint | `EXISTS_AND_CORRECT` | The first copy is on the post response, including a return titled إيصال مرتجع. A later `GET /pos/orders/:id/receipt` requires `pos` `reprint` and writes an audit row. |
| 32 | Hardware ports: scanner, printer, drawer, display, scale, terminal | `EXISTS_ELSEWHERE_REUSE` | Keyboard scanner works. Printer drivers exist for invoices only. No drawer/display/scale/EFT port on POS. |
| 33 | Offline cache, outbox, idempotent sync, visible status | `MISSING` | Design later. No fake offline in Phase 1. |
| 34 | Cashier identity and fine permissions | `EXISTS_BUT_INCOMPLETE` | Session stores `userId`. Permissions are `pos` view/edit/post only. |
| 35 | Manager override for discount, price, void, variance | `EXISTS_BUT_INCOMPLETE` | Discount and price override are separate POS permissions and are audited. Void is still unpost or a linked return. Variance has no manager-approval tolerance. |
| 36 | Branch overrides: customer, price list, methods, stock policy, variance accounts | `EXISTS_BUT_INCOMPLETE` | Terminal stores branch, warehouse, safe, bank, default customer. Other policies are company account definitions only. |
| 37 | Session, sales, profit, and payment reports with ERP filters | `EXISTS_BUT_INCOMPLETE` | Daily report and hub read posted `PosOrder`. Historical sales invoices are not unioned. Product/cashier/hour reports are still missing. |
| 38 | Audit events for open, close, sale, hold, pay, return, override, reprint | `EXISTS_AND_CORRECT` | POS calls `documentAuditService` after the financial transaction for open, post, hold, resume, discount, price override, unpost, return, cash in/out, close, reopen, and reprint. Catalog search is not audited. |
| 39 | Transactions, unique constraints, idempotency for double pay, double sync, double return, refresh | `EXISTS_BUT_INCOMPLETE` | Post, return quantity, and close are serialized with row locks. Offline sync is still absent. |
| 40 | Fast screen without loading the ERP; barcode index; batched stock | `EXISTS_BUT_INCOMPLETE` | Page loads up to 1000 items, 1000 customers, 200 groups. |
| 41 | Company and branch enforced on the server | `EXISTS_AND_CORRECT` | `companyId` on terminal, shift, and order queries. Post warehouse is the terminal's. Lines inherit the order. Do not trust a client `companyId`. |
| 42 | Restaurant mode kept out of retail POS | `MISSING` | No floor, table, or kitchen models. Real-estate `floor` fields are unrelated. |
| 43 | Desktop and touch first | `EXISTS_BUT_INCOMPLETE` | One desktop cashier page. No separate tablet layout. |
| 44 | Cashier always sees branch, device, session, cashier, customer, total, online state | `EXISTS_BUT_INCOMPLETE` | Shift badge and warehouse select exist. No offline indicator because the screen is online-only. F2/F4/F9 exist. |
| 45 | Stable error codes, not a generic Arabic validation string | `MISSING` | `AppError` English/Arabic sentences. No `SESSION_ALREADY_OPEN`, `ORDER_ALREADY_COMPLETED`, and the rest of the requested code list. |
| 46 | Tests for money and stock paths | `EXISTS_AND_CORRECT` | Phase 1, Phase 2, and Phase 3 MySQL tests cover post, payments, returns, drawer math, shortage/overage, and close races. |
| 47 | Minimum model, reuse tables, no second invoice | `EXISTS_AND_CORRECT` | Decision: keep `PosOrder` / `PosOrderLine` / `PosShift` / `PosTerminal`. Future `PosPayment` is specified in the remediation plan and is not part of Phase 1. |
| 48 | Single source of truth per financial fact | `EXISTS_BUT_INCOMPLETE` | Current POS reports read posted `PosOrder`. Legacy `/pos/sales` still creates an `Invoice` if called. Those historical invoices cannot be separated from ordinary sales invoices. |
| 49 | Phased delivery | `MISSING` | This matrix does not implement phases. Sequence is in `POS_REMEDIATION_PLAN.md`. |
| 50 | Do not rebuild accounting, inventory, sales, customers, tax, price lists, warehouses | `EXISTS_AND_CORRECT` | POS stock and COGS go through `inventoryCostingService`. That service writes the inventory movement. POS does not call `postMovementInTx` again. Line money uses `computeLineAmounts`, then 2dp. |

## Source of truth

| Fact | Authoritative store | Not authoritative |
| --- | --- | --- |
| POS sale document | `PosOrder` + lines | `Invoice` created by `/pos/sales` |
| Posted GL for that sale | `JournalEntry` where `journalEntryId` is set and `activeSourceKey` is `companyId\|POS\|orderNumber\|sourceYearId` | Shift aggregate columns |
| Cash variance | `PosShiftClose` plus the `POS-VARIANCE` journal when variance is not zero | Forcing declared = expected, or recomputing an old close from current master data |
| Drawer expected cash | Opening cash, cash `PosPayment.amount`, and `PosCashMovement` | `totalCashSales`, tendered cash, or change |
| On-hand and COGS | `InventoryMovement` written by `inventoryCostingService` | `ItemQuantity`, `ItemWarehouseBalance`, catalog on-hand |
| Line tax and discount | `computeLineAmounts` after server price resolution | A client `taxAmount` or a second POS formula |
| Unit price | Customer price list, else item tier, else an override permitted by `override_tier_price` | A client price on the cashier request |
| Tender | `PosPayment.amount` summed to the net. Legacy columns are a projection. | Tendered cash, change, or a client total |
| Customer balance | AR journal. `customer.balance` is a CREDIT cache updated on post, unpost, and return | Treating `customer.balance` as the ledger |
| Session close | `PosShiftClose` where `reopenedAt` is null | Recomputing a closed session from current prices, customers, or accounts |
| ETA receipt | `EInvoiceDocument.posOrderId` | B2B invoice signing session |

## Legacy conflict to leave in place

`/api/v1/pos/sales`, `/pos/sales/:id/cancel`, `/pos/daily-report`, `/pos/inventory/update-real-time`, and the hub's `GET /pos/sales` are the invoice POS. Phase 1 may change the daily report's data source only as specified in the remediation plan. It must not drop these routes.
