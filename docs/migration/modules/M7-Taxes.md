# M7 — Taxes & Dariba (Wave 1)

## Scope

| Area | Implementation |
|------|----------------|
| **Tax periods** | `TaxPeriod` — OPEN/CLOSED; blocks invoice posting when CLOSED |
| **VAT declaration** | `TaxEngineService` aggregates posted M5 invoices (output/input VAT, WHT) |
| **VAT settlement GL** | `TaxDeclarationPostingService.postVatSettlement` — clears VAT pools, nets to tax authority account |
| **Authority payment** | `payAuthorityViaTreasury` — Dr authority / Cr cash or bank (M2) |
| **Legacy treasury** | Accounting receipt/payment `post|unpost` → `TreasuryPostingService` |

## Schema (`20250816180000_wave1_m7_taxes`)

- `tax_periods` — DaribaPeriod
- `tax_declarations` — totals + `settlementJournalEntryId`, status `DRAFT|FINAL|SETTLED`
- `tax_settlements` — optional treasury payment rows

## Account definitions

Extend `CompanySettings.accountDefinitions`:

- `vatOutputAccount`, `vatInputAccount` (same as M5)
- `taxAuthorityPayableAccount` (net VAT / Form 41 payable)

## API

- `GET/POST /api/v1/taxes/periods`, `POST …/:id/close|reopen`
- `POST /api/v1/taxes/declarations/generate/:taxPeriodId`
- `POST /api/v1/taxes/declarations/:id/settle`
- `POST /api/v1/taxes/declarations/:id/pay-authority`

## Test

```bash
npm run test:wave1-taxes
```

## Follow-ups

- Form 41 WHT report export, e-invoice submission hooks
- Tie `ElectronicInvoice` module to declaration periods
- Multi-branch consolidated declarations
