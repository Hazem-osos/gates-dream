# M6 — Point of Sale (Wave 2)

## Architecture

| Component | Role |
|-----------|------|
| **PosTerminal** | Branch warehouse, safe, bank account for card tenders |
| **PosShift** | Open/close drawer; aggregates tenders, merch, VAT, COGS |
| **PosOrder / PosOrderLine** | Ticket; stock posted per sale; GL deferred to Z-close |
| **PosOrderPostingService** | Stock (M4), shift totals, credit customer balance |
| **PosShiftService.closeShift** | Z-report + consolidated `POS-Z` journal entry |

## Shift close GL (Z-report)

- Dr Safe — net cash sales (excludes opening float)
- Dr Bank — card sales
- Dr AR — credit sales
- Dr COGS / Cr Inventory
- Cr Revenue + Cr Output VAT
- Cash shortage/surplus accounts when declared ≠ system drawer

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
