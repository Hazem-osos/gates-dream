# M15 / M23 — Trade (LC & Bank Guarantees)

## Scope

| Module | Implementation |
|--------|----------------|
| **M15 LC** | `LetterOfCreditService`: open (WIP Dr / AP Cr), expense accumulation (WIP Dr / Bank Cr), clearance with proportional landed cost → inventory GL + M4 stock & moving average |
| **M23 LG** | `LetterOfGuaranteeService` on `GuaranteeLetter` (wave2 table): issue (cover + commission), extend, release (reverse cover), confiscate |

Legacy `documentary_credits` / `letters_of_guarantee` CRUD under `/api/v1/import-export` is unchanged.

## Schema (`20250816210000_wave2_m15_m23_trade`)

- **`TradeSettings`** — default GL account codes per company
- **`LetterOfCredit`** — `OPEN` → `CLOSED`, opening/clearing JE ids
- **`LcExpense`** — customs, freight, etc. with own JE
- **`LcReceiptLine`** — landed unit cost audit trail
- **`GuaranteeLetter`** — M23 lifecycle (`ACTIVE` \| `EXTENDED` \| `RELEASED` \| `CONFISCATED`)

## API (`/api/v1/trade`)

| Method | Path |
|--------|------|
| POST | `/letters-of-credit` — open LC |
| POST | `/letters-of-credit/:id/expenses` |
| POST | `/letters-of-credit/:id/clear` — body `{ lines: [...] }` |
| GET | `/letters-of-credit/:id` |
| POST | `/letters-of-guarantee` — issue |
| POST | `/letters-of-guarantee/:id/release` |
| POST | `/letters-of-guarantee/:id/extend` |
| POST | `/letters-of-guarantee/:id/confiscate` |
| GET | `/letters-of-guarantee/:id` |

Requires `X-Fiscal-Year-Id` and branch context for posting routes.

## Test

```bash
npm run test:wave1-invoices   # once, fixtures
npm run test:wave2-trade
```

## GL defaults (overridable via `TradeSettings` / `accountDefinitions`)

| Code | Role |
|------|------|
| 1400 | Open LC WIP |
| 1300 | Inventory |
| 1410 | LG cash cover |
| 5200 | Bank commission expense |
| 1110 | Bank current (via `BankAccount.glAccountId`) |
