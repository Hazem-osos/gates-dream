# M2 — Treasury, Cash & Bank (Cheques Lifecycle)

Wave 1 implementation aligns legacy **CashTrx** / **CKTrx** behaviour with M0/M1 **JournalPostingService** and M3 party balances.

## Schema updates (`20250816170000_wave1_m2_treasury`)

| Model | Purpose |
|--------|---------|
| **CashTransaction** | Unified API header linking `TreasuryReceipt` or `TreasuryPayment` |
| **Cheque** | Inward/outward cheque with status machine + JE links per transition |
| **BankBoxRight** | User × safe/bank `canView` / `canPost` (opt-in enforcement) |
| **Safe.glAccountId** / **BankAccount.glAccountId** | Per-box GL (fallback: `CompanySettings.accountDefinitions`) |
| **TreasuryReceipt/Payment** | `fiscalYearId`, `sourceYearId`, `postedBy` |

### Cheque statuses

**Inward:** `IN_PORTFOLIO` → `SENT_TO_BANK` → `CLEARED` | `BOUNCED`  
**Outward:** `ISSUED` → `CLEARED` | `CANCELLED`

### Account definition keys (JSON)

- `cashAccount`, `bankAccount`, `arAccount` / party masters
- `chequesUnderHandAccount`, `chequesUnderCollectionAccount`, `notesPayableAccount`

## Services

| Service | Responsibility |
|---------|----------------|
| `treasury-posting.service.ts` | Post/unpost cash transactions via `createAndPostInTx`; update safe/bank/party balances |
| `cheque-lifecycle.service.ts` | State transitions + GL for each cheque step |
| `treasury-account-resolver.service.ts` | Resolve GL from masters + `accountDefinitions` |
| `bank-box-rights.service.ts` | Block posting when explicit rights exist and `canPost` is false |
| `cash-transaction.service.ts` | Create/list cash transactions (wraps treasury vouchers) |

## API

- `POST/GET /api/v1/treasury/cash-transactions` — create, list, get
- `POST /api/v1/treasury/cash-transactions/:id/post|unpost`
- `POST /api/v1/treasury/cheques/inward` — receive cheque
- `POST /api/v1/treasury/cheques/inward/:id/send-to-bank|clear|bounce`
- `POST /api/v1/treasury/cheques/outward` — issue cheque
- `POST /api/v1/treasury/cheques/outward/:id/clear|cancel`

Headers: same as M5 (`X-Branch-Id`, `X-Fiscal-Year-Id`, tenant context).

## Integration test

```bash
npm run test:wave1-treasury
```

Covers: cash receipt (party + safe GL), inward cheque receive → deposit → clear.

## Follow-ups (not in Wave 1 slice)

- Delegate legacy `/api/v1/accounting/treasury-receipts/:id/post` to `TreasuryPostingService`
- Multi-line `CashTrxDetail` parity, `DocumentSequence` `CashBP` / `CashNum`
- Invoice settlement (cash/cheque on SI/PI) through shared orchestrator
- Full `BankBoxRights` admin UI + seeding
