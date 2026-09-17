# Accounting Engine Audit — gates-backend

**Date:** 2025-08-17  
**Scope:** M0–M23 posting orchestrators, M16/M17 reports, M22 year-end, Wave 3 verticals (recognition review).  
**Phase 1:** Integrity fixes implemented in codebase; Phase 2 epics documented below.

## Severity legend

- **P0** — Wrong GL / unbalanced statements
- **P1** — Standards gap or operational risk with workaround
- **P2** — Tech debt / performance

---

## A. Double-entry and 4-decimal precision (M1)

| ID | Sev | Finding | Phase 1 status |
|----|-----|---------|----------------|
| M1-01 | P0 | `debitBase`/`creditBase` persisted without explicit 4dp round; validation used float sums | **Fixed** — `money.util.ts`, `journal-posting.service.ts` `buildLineRows` |
| M1-02 | P1 | `createAndPostInTx` could post when `SaveUnbalanced` enabled | **Fixed** — auto-post always requires balance |
| M1-03 | P1 | No XOR rule on manual journal lines | **Fixed** — Zod line refine + `validateJournalLineSides` |
| M1-04 | P2 | `GlPostingViolation` / budget stop not enforced | Phase 2 |
| M1-05 | P2 | Legacy `reports.service.ts` still mounted for export/GL routes | BS/IS legacy handlers return **410**; M16 router takes precedence |

**Key files:** `src/shared/utils/money.util.ts`, `src/modules/accounting/services/journal-posting.service.ts`, `src/modules/accounting/schemas/journal-entry.schema.ts`

---

## B. Perpetual inventory and COGS (M4/M5)

| ID | Sev | Finding | Phase 1 status |
|----|-----|---------|----------------|
| M5-01 | P0 | `SALE_RETURN` did not accumulate/post COGS reversal | **Fixed** — `invoice-posting-orchestrator.ts` |
| M5-02 | P0 | `PURCHASE_RETURN` accumulated COGS but never posted COGS JE | **Fixed** — PR `_COGS` entry |
| M5-03 | P1 | Moving-average reads outside invoice `$transaction` | **Fixed** — `calculateMovingAverage(..., tx)` |
| M5-04 | P1 | Concurrent posts could race on `ItemQuantity` | **Fixed** — `FOR UPDATE` lock in `stock-movement.service.ts` |
| M5-05 | P2 | Sale return COGS at current average, not original SI line cost | Phase 2 optional |

**Tests:** `scripts/test-wave1-invoices.ts` (SR/PR scenarios), `scripts/test-item-cost-formula.ts`

---

## C. Treasury, cheques, FX (M2)

| ID | Sev | Finding | Phase 1 status |
|----|-----|---------|----------------|
| M2-01 | P1 | Cheque lifecycle JEs conceptually correct; accounts from `company_settings` | Documented; `test-wave1-treasury.ts` |
| M2-02 | P1 | No FX rate on treasury/cheque posting (base = face @ 1) | Phase 2 — realized/unrealized FX |
| M2-03 | P1 | Bounce: no bank charge line / JE link on `Cheque` | Phase 2 |

---

## D. Wave 3 revenue recognition

| ID | Sev | Finding | Phase 1 status |
|----|-----|---------|----------------|
| W3-01 | P1 | M12: deferral at contract + recognition at handover | Matches point-in-time policy |
| W3-02 | P1 | M11: extract revenue per post (not IFRS 15 POC) | Phase 2 |
| W3-03 | P0 | Subcontractor extract JE ignored penalty/material in expense debit | **Fixed** — expense = gross − penalty − material |
| W3-04 | P1 | M8 WIP / M9 accrual-disbursement present; Egyptian tax tables / remittance JEs missing | Phase 2 |

---

## E. Financial reports and year-end (M16/M22)

| ID | Sev | Finding | Phase 1 status |
|----|-----|---------|----------------|
| M16-01 | P1 | Balance sheet YTD profit used UTC calendar year | **Fixed** — fiscal year covering `asOfDate` |
| M16-02 | P1 | Legacy BS/IS duplicated M16 | Legacy routes **410 Gone** |
| M17-01 | P1 | Executive KPIs summed `debit`/`credit` not base | **Fixed** — `debitBase`/`creditBase` |
| M22-01 | P1 | Year-end pre-close ignored unposted cash transactions | **Fixed** — `year-end-closing.service.ts` |

**Canonical reports:** `financial-report.service.ts` (SQL on `debitBase`/`creditBase`).

---

## F. Performance and concurrency

| ID | Sev | Finding | Phase 1 status |
|----|-----|---------|----------------|
| PERF-01 | P1 | Invoice post without quantity row lock | **Fixed** |
| PERF-02 | P2 | M16 TB/P&L already SQL-aggregated | OK |

---

## Automated verification

| Command | Purpose |
|---------|---------|
| `npm run test:item-cost` | Moving average formula |
| `npm run test:wave1-invoices` | PI/SI/SR/PR + COGS |
| `npm run test:accounting-invariants` | All posted JEs balanced + TB + BS equation |
| `npm test -- accounting-money` | Unit tests for `money.util` |
| `npm run test:waves` | Full gate including invariants |

---

## Phase 2 epics (not in Phase 1)

1. Treasury **realized/unrealized FX** and balancing lines  
2. **IFRS 15 POC** for contracting (contract asset/liability)  
3. M12 penalties, reservations, financing split, maintenance release  
4. M9 progressive tax and **SI/tax remittance** postings  
5. `GlPostingViolation` / budget stop on post  
6. Link **sale return COGS** to original invoice line cost  

---

## Posting hub (reference)

All module orchestrators call `journalPostingService.createAndPostInTx` inside domain transactions. Inventory posts use `stockMovementService.postMovementInTx` + `itemCostService.applyMovingAverageInTx`. Reports and year-end close read **posted** `journal_entry_lines.debitBase` / `creditBase`.
