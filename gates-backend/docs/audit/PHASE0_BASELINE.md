# Phase 0 — Safety Net & Corruption Baseline

Generated while implementing the ERP audit remediation roadmap
(`.cursor/plans/erp_accounting_audit_50d74b77.plan.md`). This file is the
"before" measurement Phase 0 exists to produce; later phases should be
validated against it.

## What was built

| Script | Purpose | Command |
| --- | --- | --- |
| `scripts/test-gl-invariants.ts` | Regression suite: every posted JE balances at 4dp; post→unpost restores the exact pre-post party balance (catches C2); post→unpost→post is idempotent; at most one *posted* JE per source document. Runs against a disposable fixture company — never real data. | `npm run test:gl-invariants` |
| `scripts/recon/gl-reconciliation.ts` | Read-only, per real company: trial balance debit vs credit; AR control account(s) vs open-invoice `remainingAmount` vs `Customer.balance`; same for AP; cash/bank GL vs `Safe`+`BankAccount`; inventory GL vs `Σ qty × latest average cost`. | `npm run recon:gl` |
| `scripts/recon/quantify-corruption.ts` | Read-only: duplicate account codes, duplicate invoice numbers, WHT invoices stuck unable to post, unbalanced posted JEs, sources with >1 posted JE, and SALE_RETURN lines whose resulting average cost matches the return's *selling* price (direct evidence of C1). | `npm run recon:corruption` |

None of these scripts write to real tenant data. `test-gl-invariants.ts` only
ever touches a dedicated fixture company (`00000000-0000-0000-0000-0000000000f0`).

## Baseline results (run against the live dev database, 8 companies)

### `test:gl-invariants`

**1 known failure, by design** — it locks in a real bug so Phase 3 has a test
to turn green:

> SALE invoice with WHT posts successfully — CURRENTLY BROKEN: withholding
> tax is subtracted twice (once inside `invoiceM5Service.create`'s
> `netAmount`, again in the orchestrator's `arDebit`/`apDelta`), so the
> journal entry is permanently unbalanced whenever `withholdingTaxAmount > 0`.

This is **more severe than the plan's C2 description** (silent AR/AP drift):
in the current code, `Invoice.netAmount` is already stored *net of WHT*
(`invoice-m5.service.ts`), so `invoice-posting-orchestrator.ts` subtracting
`wht` a second time makes the resulting journal entry fail
`validateDoubleEntryBalance` and the whole `post()` transaction rolls back.
**A SALE or PURCHASE invoice with withholding tax can never be posted at
all** with the current code. Confirmed empirically: of the exactly 1 real
invoice in the live database with `withholdingTaxAmount > 0`, 0 are posted.

Fix (Phase 3, item 17 — `computePartyDelta`): the AR/AP debit/credit should
use `totals.net` as-is (it is already net of WHT); the extra `- wht` must be
removed from both the journal-line construction and the customer/supplier
balance increment on `post()`. `unpost()` already does not subtract `wht`
again, so this single change also makes post/unpost symmetric.

Everything else in the suite passes today, including the balanced-entry
invariant for ordinary invoices and the post→unpost→post round trip. It also
surfaces (as an informational warning, not a hard failure) that re-posting an
invoice after unposting creates a **brand-new** journal entry rather than
reactivating or reversing the original — direct evidence of C9/C11 (reversal
is a status flag, not a contra entry).

### `recon:gl` (real companies, condensed)

| Company | Trial balance | AR (GL vs Customer.balance) | AP (GL vs Supplier.balance) | Cash/Bank | Inventory |
| --- | --- | --- | --- | --- | --- |
| sherkty | balanced | GL 4,150,602 vs subledger 0 → **diff 4,150,602** | GL 2,410,112 vs subledger 1,140 → **diff 2,408,972** | GL 3,076,590 vs subledger 205,528 → **diff 2,871,062** | GL 33,906,625 vs stock ledger 122,480 → **diff 33,784,145** |
| Prod-like Migration Co | balanced | GL 561,957 vs 0 → **diff 561,957** | GL -130,264 vs 0 → **diff -130,264** | GL 0 vs 0 → ✓ | GL 0 vs 1,440,047 → **diff -1,440,047** |
| Gates Trading & Contracting | balanced | GL 153,420 vs 409,920 → **diff -256,500** | GL 449,860 vs 63,860 → **diff 386,000** | GL 535,200 vs 35,200 → **diff 500,000** | GL 371,660 vs 1,508,800 → **diff -1,137,140** |
| Migration Sample Co | balanced | ✓ | ✓ | ✓ | GL 0 vs 2,550 → diff -2,550 |
| Ahmed Journey Test Co | balanced | ✓ | ✓ | ✓ | ✓ |
| 2× Provision Test Co (empty) | balanced (0) | ✓ | ✓ | ✓ | ✓ |

Every company's posted-line trial balance is internally consistent
(`Σdebit == Σcredit`, confirming `validateDoubleEntryBalance` is doing its
job at the individual-entry level). The drift is entirely in the
**subledger-vs-control-account** dimension — exactly what H7 (denormalized
party/safe/bank balances with many independent writers) and C3 (stocktaking/
adjustment/transfer/assembly never touch the GL) predict. This is the
quantified "before" picture Phase 1–3 fixes must move toward zero.

### `recon:corruption`

- **Duplicate account codes:** 0 (no real duplicates found yet, but no
  `@@unique` constraint exists to prevent future ones — see Phase 1 item 4).
- **Duplicate invoice numbers:** 2 found, both under the shared automated-test
  fixture company (`...0001`) reused by `test:wave1-invoices` across repeated
  runs — test-harness noise, not real tenant corruption, but it confirms the
  detector works and that nothing today prevents this in real tenants either.
- **WHT invoices stuck unposted:** 1 / 1 (see above).
- **Unbalanced posted journal entries:** 0 / 756 checked.
- **Sources with >1 posted JE:** 42, all under the shared test-fixture
  company (letters of credit/guarantee amendments and repeated wave-test
  runs legitimately/illegitimately create several JEs per source there).
  Real tenants show none yet, but nothing prevents it (H2 — no uniqueness on
  the JE source triple).
- **Poisoned average-cost candidates (C1):** **1 confirmed on real tenant
  data.** Company `Gates Trading & Contracting`, return `HAZEM-SR-001`: the
  item's average cost after the return is posted becomes exactly `7200`,
  identical to the return line's selling price — direct, empirical proof of
  C1 (`applyMovingAverageInTx({ itemPrice: linePrice })` on `SALE_RETURN`
  feeding the sale price into the cost average).

## How to use this baseline

- Re-run `npm run recon:gl` and `npm run recon:corruption` after each later
  phase lands, and confirm the diffs shrink (they will not hit exactly zero
  until Phase 2/3 data-remediation jobs run against the corrupted items/
  parties identified above — see plan §"Notes on sequencing").
- Re-run `npm run test:gl-invariants` after Phase 3 lands; the WHT failure
  above must flip to a pass, and no other assertion may regress.
