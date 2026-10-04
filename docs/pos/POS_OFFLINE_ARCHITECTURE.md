# POS offline architecture

The browser keeps a durable outbox in IndexedDB (`gates-pos-offline` / `outbox`), not in `localStorage`. Each queued sale has a `clientRequestId`. `POST /api/v1/pos/orders/sync` creates and posts the order with server pricing. The same key returns the existing order and does not post twice.

## Safe offline

- Remember the request until the network returns.
- Retry the same key.

## Not safe offline, so the server still decides

- Stock on hand and serial or batch availability.
- Credit limit.
- Whether the session is still open.
- Price, tax, discount, and gift totals.
- Provider card approval.

The sell screen writes a failed checkout into the outbox only when both `PosSettings.offlineEnabled` and `PosTerminal.offlineEnabled` are on, and the failure is connectivity or a 5xx response. A 4xx validation, stock, credit, permission, or card rejection is shown and is not queued. The cashier sees انتظار المزامنة and the cart stays. A retry uses the same `clientRequestId`. A later business rejection is kept as a conflict and is not deleted. The flags do not bypass the server checks.
