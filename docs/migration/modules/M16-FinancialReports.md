# M16 — Financial Statements & GL Reporting (Wave 4)

## Scope

Wave 4 reporting backbone with aggregated SQL (Prisma `$queryRaw`) on `journal_entry_lines.debitBase` / `creditBase`, 4-decimal rounding via `roundTo4`.

| Report | Method | Route |
|--------|--------|-------|
| Trial balance | `getTrialBalance` | `GET /api/v1/accounting/reports/trial-balance` |
| Account statement | `getAccountStatement` | `GET /api/v1/accounting/reports/account-statement/:accountId` |
| Income statement (P&L) | `getIncomeStatement` | `GET /api/v1/accounting/reports/income-statement` |
| Balance sheet | `getBalanceSheet` | `GET /api/v1/accounting/reports/balance-sheet` |
| Cost center summary | `getCostCenterReport` | `GET /api/v1/accounting/reports/cost-center-summary` |

Query params (common): `startDate`, `endDate`, `asOfDate`, `branchId`, `fiscalYearId`, `costCenterId`, `level` (trial balance tree depth hint).

## Classification

Account class derived from `code` prefix and `accountType`:

- `1` / `asset` → ASSET  
- `2` / `liability` → LIABILITY  
- `3` / `equity` → EQUITY  
- `4` / `revenue` → REVENUE  
- `51` → COGS  
- `52` → EXPENSE  

## Verification

- **Trial balance:** `verification.balanced` — Σ ending debit columns = Σ ending credit columns.  
- **Balance sheet:** `verification.equationBalanced` — Assets = Liabilities + Equity (including current-period net income from P&L).

## Files

- `financial-report.service.ts` — core engine  
- `financial-report.util.ts` — classification & TB helpers  
- `financial-reports.routes.ts` — Wave 4 HTTP API (mounted before legacy `reports.routes`)

## Test

```bash
npm run test:wave4-reports
```

Posts opening capital, purchase, sale, expense, and payment; asserts TB balance, cash running balance, P&L math, and balance sheet equation.
