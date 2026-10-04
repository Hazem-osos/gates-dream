# POS final implementation

Phase 1–4B remain the financial foundation. This pass adds the cancellation, policy, traceability, and admin pieces that can sit on that foundation without a second ledger.

## Implemented

- Posted void is a terminal `VOIDED` state. It is not unpost and it is not a return. Unpost still returns a posted order to `DRAFT` and unposts its journal in place. A return is still a new linked `RETURN` order. Void posts a contra journal (`POS-VOID`), puts the stock back, restores serial/lot rows when the line named them, reverses the customer balance cache for credit, corrects shift aggregates, and keeps the payment rows and the original journal. The shift must still be open. A sale with a posted return cannot be voided until that return is voided. A second void returns the voided order. Permission is `pos` `void`. The receipt title is إيصال إلغاء.
- Company POS policy: variance tolerance, whether a variance above that tolerance needs a different supervisor, a discount percent that needs approval, and flags for price-override and return approval. The counted variance is still posted in full. It is not trimmed to the tolerance.
- Approval requests record requester, approver, reason, action, and session or order. The approver cannot be the requester.
- Credit workspace reads posted credit tenders and collections. A collection debits the safe and credits receivables. `customer.balance` stays a cache.
- Buy-x-get-y (`additional-quantity`) offers from `itemOfferService` become zero-price gift lines. Those lines still move stock and COGS. Percentage offers were already applied.
- Weighted barcodes use company rules (prefix, item slice, value slice, decimals, weight/qty/price). An embedded price that does not match the server price is rejected.
- Extra barcodes live on `item_barcodes` and can point at a unit that is not the base unit.
- Shared `inventory_item_lots` and `inventory_item_serials` are updated only when a POS line names a batch or serial. `serial_numbers` remains document numbering, not item serials.
- Card methods with `captureMode = TERMINAL` do not post unless `captureStatus` is `APPROVED` and a provider reference exists. The default remains `MANUAL`.
- Offline sync uses `clientRequestId`. A repeat with the same key returns the existing order. The sell screen queues a checkout in IndexedDB when the network is down and both offline flags are on.
- Hardware adapters live in `lib/pos/hardware.ts`: keyboard wedge, ESC/POS drawer pulse, an unavailable scale, and a manual card adapter that never invents approval.
- Terminal update can set the receipt footer and offline flag, and cannot disable a terminal that has an open session.
- Admin APIs: `/api/v1/pos/admin/settings`, approvals, open sessions, audit, credit, barcode rules, shift templates. `/pos/settings` edits the variance and discount policy and lists payment methods. `/pos/customer-display` shows the cart broadcast from the sell screen.

## Not a second engine

Pricing, tax, offers, journals, costing, and receivables stay on the existing Gates services.

## Not finished as a full cashier product

Admin screens cover policy, terminals, payment methods, barcode rules, shift templates, open sessions, approvals, audit, and credit collection. Reports add hour, customer, terminal, branch, gifts, void reasons, return reasons, credit, cash movements, and payment capture status. A return posts only with a matching unused approval when that policy is on. Credit collection is idempotent on `clientRequestId`. A physical scale and a card network still need an external bridge or provider.
