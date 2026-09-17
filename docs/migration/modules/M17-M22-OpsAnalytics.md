# M17 Executive Analytics & M22 Batch Operations / Year-End Close

Wave 4 operational governance: AR/AP aging, executive KPIs, bulk post/unpost, and fiscal year-end closing (legacy `untPostAll.pas`, `UntYearClose.pas`).

## Schema

- `FiscalYear`: `status` (`Open` | `Close`), `closedAt`, `closedBy`, `closingJournalEntryId`
- `CompanySettings.retainedEarningsAccountId` — target equity account for net income/loss (fallback account code `3900`)

Migration: `20250816270000_wave4_m17_m22_ops_analytics`

## M17 — Services & API

| Endpoint | Description |
|----------|-------------|
| `GET /api/v1/analytics/aging` | `companyId`, optional `branchId`, `asOfDate`, `partyType=CUSTOMER\|SUPPLIER` |
| `GET /api/v1/analytics/executive-kpis` | Monthly sales/purchase trend, cash+bank liquidity, top customers/products, unposted counts |

**Aging:** Posted invoices with `remainingAmount > 0`; buckets from **invoice date** vs `asOfDate` (0–30, 31–60, 61–90, 90+). Credit limit flag for customers/suppliers.

**Implementation:** `src/modules/analytics/services/executive-analytics.service.ts`

## M22 — Services & API

| Endpoint | Description |
|----------|-------------|
| `POST /api/v1/operations/batch-post` | Date range + `documentType` (`JOURNAL_ENTRY`, `INVOICE`, `TREASURY`; `POS_SHIFT` stub 501) |
| `POST /api/v1/operations/batch-unpost` | Same filters; chunked processing with per-item error summary |
| `POST /api/v1/operations/fiscal-years/:id/close` | Validate all posted + balanced TB; P&L closing JE; lock FY |

**Batch:** Chunk size 25; optional `fiscalYearId` triggers open-FY guard. Journal eligibility: post = `isPosted=false` & `postingStatus=UnPost`; unpost = posted + `Post`.

**Year-end close:** Aggregates posted GL in FY; debits revenue and credits expense/COGS to zero; net to retained earnings; sets `FiscalYear.status=Close`. Closed periods reject new documents via `fiscalYearService.assertOpenForDate`.

**Implementation:**

- `src/modules/operations/services/batch-operations.service.ts`
- `src/modules/operations/services/year-end-closing.service.ts`

## Integration test

```bash
npm run test:wave4-ops-analytics
```

Covers aging buckets, batch JE post/unpost, year-end close (P&L zero, retained earnings, closed-FY write block), and KPI smoke check.

## Notes

- Invoice **due date** is not modeled yet; aging uses issue date until M5 payment terms land.
- Re-open a closed fiscal year is out of scope (Delphi parity: manual reversal only).
