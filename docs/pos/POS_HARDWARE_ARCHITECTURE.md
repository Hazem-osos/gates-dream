# POS hardware architecture

Business posting does not call a vendor SDK.

| Device | Adapter | Behavior |
| --- | --- | --- |
| Barcode scanner | Keyboard wedge | Characters land in the sell screen. Weighted labels are decoded by company rules |
| Receipt printer | Existing canvas, browser print, and ESC/POS | Sale, return, and void receipts use persisted totals |
| Cash drawer | `drawerPulse()` ESC/POS bytes | Sent only through a printer that already accepts those bytes |
| Customer display | `BroadcastChannel` `gates-pos-display` | `/pos/customer-display` shows the quoted cart. It does not post |
| Scale | `ScaleAdapter` | The browser adapter is unavailable. A desktop bridge would return a quantity into the same price pipeline |
| Payment terminal | `PaymentTerminalAdapter` | Manual mode does not mark a card approved. `captureMode = TERMINAL` posts only after `APPROVED` and a provider reference |

No scale driver and no card-network driver ship in the browser.
