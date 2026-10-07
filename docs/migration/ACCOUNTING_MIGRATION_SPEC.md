# Accounting Migration Specification

**Risk level:** HIGH  
**Legacy truth:** Posted `GLTrxHeader` + `GLTrxDetail` with `Status='Post'`, `Deleted<>'T'`; amounts scaled by line `Change`.  
**New truth:** `JournalEntry` (`isPosted`, `isCancelled`) + `JournalEntryLine` (`debitBase`, `creditBase`).

---

## 1. Legacy representation

| Concept | Legacy | Notes |
|---------|--------|-------|
| COA | `Account` | Hierarchical codes, `AccountSide`, currency per account |
| Journals | `GLTrxHeader/Detail` | 8-digit `GlNum`, types link to source modules |
| Opening | `BalanceAccountsH/D` | Separate opening docs — may overlap GL type opening |
| AR/AP | Customer/supplier **accounts** on invoices + GL | Not a separate subledger table |
| Draft | `Status='UnPost'` | Excluded from balance SQL in M1 doc |
| Cancel | `Deleted='T'` on header | Mapped to `isCancelled` in transformer |
| Multi-currency | `CurrencyCode` + `Change` on lines | Base = amount × Change |
| Cost center | `CCenterCode` on lines | Optional |

---

## 2. New representation

| Concept | New | Invariants |
|---------|-----|------------|
| COA | `Account` | Unique per `companyId` + `code` |
| JE | `JournalEntry` | Unique `legacyGlNum` scope |
| Lines | `JournalEntryLine` | Posted reports use `debitBase`/`creditBase` |
| Party balance | Derived from GL + open docs | `party-ledger-balance.service`, card caches on post |

**Do not** import Delphi cached balances on customer row if GL is source of truth.

---

## 3. Recommended migration paths

### Path A — GL-first (matches current Phase C)

1. Import all `GLTrxHeader/Detail` (posted and unposted per policy).
2. Import invoices **without** re-posting GL (link by `GLNum` field on invoice if needed for inquiry only).
3. Reconcile trial balance from JE lines only.

**Pros:** Single source for TB/AR/AP accounts.  
**Cons:** Invoice detail in new UI may not match stock/AR sub-ledger if invoices omitted.

### Path B — Subledger-first

1. Import invoices/cash with posting orchestrator disabled.
2. Generate missing JE from legacy `GLNum` only where not created by invoice import.

**Pros:** Operational document history.  
**Cons:** High duplicate risk if orchestrator runs.

### Path C — Opening-only cutover

1. Migrate COA + **opening JE** as of cutover date (from TB or `BalanceAccounts*`).
2. No historical GL.

**Pros:** Smallest risk.  
**Cons:** No historical drill-down in new ERP.

**Recommendation:** **Path A** for first pilot with Phase C ETL + reconciliation harness; invoices as **READ_ONLY_HISTORY** or import after GL with `isPosted` synced from legacy without calling `journal-posting.service` (see `HISTORICAL_DOCUMENT_STRATEGY.md`).

---

## 4. Opening balances

| Source | Treatment |
|--------|-----------|
| `BalanceAccountsH/D` | TRANSFORM to balanced `JournalEntry` OR merge into opening batch — **must not** duplicate existing opening-type `GLTrx` |
| Legacy opening `GLTrx` type | Import as normal JE with `legacyGlNum` |
| Account without history | `GENERATE` zero lines only if in opening batch |

**Reconciliation:** Per-account opening = sum(posted lines before cutover date).

---

## 5. Reconciliation requirements (mandatory)

From `06-migration-reconciliation.md` (implement for every cutover):

| Check | Legacy | New | Tolerance |
|-------|--------|-----|-----------|
| Trial balance | Σ posted GL lines × Change by account | Σ `debitBase`/`creditBase` by account | 0.01 currency |
| TB report cross-check | — | `financialReportService.getTrialBalance` | 0.01 |
| Total debits = credits | Legacy dump | JE lines | 0.01 |
| AR control account | GL balance on AR accounts | Customer cards / party ledger | TBD per account mapping |
| AP | Same for AP | Supplier | TBD |
| Cash/bank | GL cash accounts | Treasury balances | After treasury migration |
| Opening | Opening batch + GL | Period balances | Owner-defined date |

**Unposted legacy vouchers:** Excluded from both sides in harness — document policy if business needs drafts migrated.

---

## 6. Fields: COPY vs CALCULATE

| Field | Rule |
|-------|------|
| `debit`, `credit` | COPY from legacy |
| `debitBase`, `creditBase` | CALCULATE `× exchangeRate` (must match legacy Change) |
| `isPosted` | COPY from `Status` |
| `isBalanced` | COPY; reject posted if false unless owner waives |
| Party card caches | GENERATE via posting service pass or rebuild job — not COPY from legacy |

---

## 7. Confidence & gaps

| Item | Confidence |
|------|------------|
| JE header/line mapping | HIGH (transformer exists) |
| Opening batch vs GL | LOW — needs sample data |
| Treasury/cheque GL | LOW — unmapped |
| Tax lines (`Dariba*` on GL) | MEDIUM — map to tax accounts |

**Blocks engine:** Restored DB + trial balance sign-off on pilot company.
