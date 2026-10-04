# M6 — Point of Sale (Wave 2)

## Architecture

| Component | Role |
|-----------|------|
| **PosTerminal** | Branch warehouse, safe, bank account for card tenders |
| **PosShift** | Open/close drawer; aggregates tenders, merch, VAT, COGS |
| **PosOrder / PosOrderLine** | Authoritative POS financial document. Each posted order has its own journal. It does not create a sales invoice. |
| **PosOrderPostingService** | Claims DRAFT→POSTED in the posting transaction, then inventory costing (which writes the stock movement), COGS, and the journal |
| **PosShiftService.closeShift** | Drawer reconciliation only. A `POS-VARIANCE` journal is written when counted cash differs. Revenue is not deferred to Z-close. |
| **PosShift.openTerminalKey** | Set to the terminal id only while OPEN. Unique per company so a terminal has one open session. |

## Order post GL (immediate)

- Dr Safe / Bank / AR — tender columns
- Dr COGS / Cr Inventory — amount from `inventoryCostingService`, one movement per line
- Cr Revenue + Cr Output VAT
- Shift close does not repeat those legs. It only posts cash shortage or surplus when declared cash differs from `openingCash + totalCashSales`.

## API

- `GET/POST /api/v1/pos/terminals`, `GET …/items/lookup?barcode=`
- `POST /api/v1/pos/shifts/open`, `GET …/:id`, `POST …/:id/close`
- `POST /api/v1/pos/orders`, `POST …/:id/post`

Headers: `X-Branch-Id`, `X-Fiscal-Year-Id` (same as M5/M2).

## Test

```bash
npm run test:wave2-pos
```

## Follow-ups

- Receipt printing, offline queue, split tender UI
- Link POS return to original ticket enforcement
- Per-terminal `BankBoxRights` integration
