# Gates ERP — Remediation Board

Status index for architecture and correctness remediation. Snapshot: 2026-09-27, branch `main`, HEAD `45fd5be` (2026-09-23), one worktree, nothing staged, nothing committed since HEAD.

This board does not repeat the audits. Each ID links to its full description:

- `H-`, `M-`, `L-`, `I-`: [ARCHITECTURE_AUDIT.md](ARCHITECTURE_AUDIT.md)
- `CC-`, `INF-`: [CORRECTNESS_CONCURRENCY_AUDIT.md](CORRECTNESS_CONCURRENCY_AUDIT.md)
- `CC-22`…`CC-29`: discovered during the first remediation wave; described in §4 of this board.
- Per-path working-tree classification: [WORKTREE_INVENTORY_2026-09-27.md](WORKTREE_INVENTORY_2026-09-27.md)

Update this board whenever a finding changes status. Never mark a row DEPLOYED without evidence (deploy log, commit SHA running in production).

---

## 1. Legend

**Status**: `OPEN` · `REPORTED — NEEDS RECHECK` · `CONFIRMED` · `FIXED — LOCAL` · `FIXED — COMMITTED` · `DEPLOYED` · `BLOCKED` · `ACCEPTED RISK`. `CONFIRMED` and `REPORTED — NEEDS RECHECK` rows are both open.

**Verification** (`Verif`):
- `R`: reproduced on real MySQL, before and after the fix.
- `C`: confirmed in code.
- `M`: mechanism verified in code; sequence reasoned, not executed.
- `P`: partly confirmed.
- `S`: static/explorer report, not re-read line by line.

**Test**:
- `MY`: real-MySQL regression/concurrency test exists and passes locally.
- `DS`: deterministic test designed in the audit, not written.
- `—`: none.

**Remediation**: `DONE-L` (fixed in the working tree) · `NS` (not started).
**Commit**: `UC` (uncommitted) · `—` (nothing to commit).
**Deploy**: `ND` (not deployed) · `—` (nothing to deploy).

**Failure class** (from the correctness audit):
- A: duplicate execution
- B: lost update
- C: check-then-act
- D: numbering
- E: post/edit/unpost state race
- F: split transaction
- G: cache divergence
- H: timeout/retry
- I: other

Non-concurrency classes: `Perf`, `Ops`, `Schema`, `Tenancy`, `API`, `Obs` (observability), `Logic`, `FE` (frontend).

## 2. Totals

| Source | Findings | FIXED — LOCAL | CONFIRMED (open) | REPORTED — NEEDS RECHECK (open) | DEPLOYED |
|---|---|---|---|---|---|
| Architecture audit (H/M/L/I) | 34 | 2 | 23 | 9 | 0 |
| Correctness audit (CC-01…21, INF-1…7) | 28 | 3 | 16 | 9 | 0 |
| New in wave 1 (CC-22…29) | 8 | 0 | 0 | 8 | 0 |
| **Total** | **70** | **5** | **39** | **26** | **0** |

Open (not fixed): **65**. Committed: **0**. Deployed: **0**. Accepted risk: **0** (none has been formally accepted by an owner). Blocked: **0**.

---

## 3. Board

### 3.1 Architecture audit

| ID | Title | Sev | Module | Class | Status | Verif | Test | Remed. | Commit | Deploy | Notes / dependencies |
|---|---|---|---|---|---|---|---|---|---|---|---|
| [H-01][h01] | Stock transfer / adjustment double post | HIGH | Inventory | A | **FIXED — LOCAL** | R | MY | DONE-L | UC | ND | See §5. Depends on the **untracked** `inventory/utils/claim-document-post.ts` (unknown owner) and the modified `inventory-costing.service.ts`. |
| [H-02][h02] | Renumber tool rewrites posted numbers, no tx | HIGH | DB tools | F | CONFIRMED | C | — | NS | — | — | Legal numbers; containment = disable endpoint. Queue P1. |
| [H-03][h03] | Posted cash-voucher edit split over two tx | HIGH | Treasury | F | **FIXED — LOCAL** | R | MY | DONE-L | UC | ND | See §5. Race with unpost remains: CC-01. |
| [H-04][h04] | Migrations run on API boot + hard-coded resolve | HIGH | Deploy | Ops | CONFIRMED | C | — | NS | — | — | **Gate for the next deploy**: 8 untracked migrations would run at boot (§8 T-13). |
| [H-05][h05] | Unbounded account / cost-center ledgers, 30 s | HIGH | Acct reports | Perf | CONFIRMED | C | — | NS | — | — | Measure first (baseline plan). |
| [H-06][h06] | Trial balance rebuilds balances in request | HIGH | Acct reports | Perf / G | CONFIRMED | C | — | NS | — | — | Pairs with CC-16. |
| [H-07][h07] | Company-wide bulk ops inside HTTP | HIGH | Ops tools | Perf | CONFIRMED | P | — | NS | — | — | Fix average cost path pairs with CC-10. |
| [M-01][m01] | Global GET limit caps lists silently | MED | Platform | API | CONFIRMED | C | — | NS | — | — | |
| [M-02][m02] | 408 while work continues; no idempotency keys | MED | Platform | H | CONFIRMED | C | — | NS | — | — | Same root as CC-14. |
| [M-03][m03] | Stock-doc `activeSourceKey` from non-unique serial | MED | Inventory GL | D / Schema | CONFIRMED | C | — | NS | — | — | Can block posting / overwrite cost snapshot; pairs with CC-19. |
| [M-04][m04] | Missing uniques on numbers / codes | MED | Schema | Schema | CONFIRMED | C | — | NS | — | — | Same fix as CC-19 (data clean-up first). |
| [M-05][m05] | `journal_entry_lines` missing indexes | MED | Accounting | Perf | CONFIRMED | C | — | NS | — | — | |
| [M-06][m06] | P2034 deadlock / serialization not mapped or retried | MED | Platform | I | CONFIRMED | P | — | NS | — | — | Extend to P2028 (CC-29) and CC-18. |
| [M-07][m07] | Credit checks on cached balances; 2-dp cache | MED | Parties | C / Schema | REPORTED — NEEDS RECHECK | P | — | NS | — | — | Precision confirmed in schema; see CC-17. |
| [M-08][m08] | Reports load whole datasets / per-row queries | MED | Reports | Perf | REPORTED — NEEDS RECHECK | S | — | NS | — | — | |
| [M-09][m09] | Inventory cost side paths (POS, mfg, unpost replay) | MED | Costing | Logic | CONFIRMED | P | — | NS | — | — | POS path confirmed; see INF-3, INF-4. |
| [M-10][m10] | Tenant-scoping model list stale | MED | Tenancy | Tenancy | CONFIRMED | C | — | NS | — | — | Defense-in-depth gap only. |
| [M-11][m11] | DB pool size not set explicitly | MED | Platform | Perf | CONFIRMED | C | — | NS | — | — | |
| [M-12][m12] | Slow-query monitor probably inactive | MED | Observability | Obs | CONFIRMED | C | — | NS | — | — | Runtime effect unconfirmed. |
| [M-13][m13] | External HTTP calls without timeouts | MED | AI / WA / ETA | Ops | REPORTED — NEEDS RECHECK | S | — | NS | — | — | |
| [M-14][m14] | Frontend loads large lists, filters in memory | MED | Frontend | FE / Perf | REPORTED — NEEDS RECHECK | S | — | NS | — | — | |
| [L-01][l01] | Two routers on `/accounting/reports` | LOW | Routing | API | CONFIRMED | C | — | NS | — | — | |
| [L-02][l02] | Overlapping API stacks | LOW | API | API | CONFIRMED | P | — | NS | — | — | Confirmed during CC-06: legacy `/api/v1/inventory/invoices` is still mounted beside M5 `/api/v1/invoices`; gates-web uses only M5. |
| [L-03][l03] | Numbers allocated outside business tx | LOW | Numbering | D / F | CONFIRMED | P | — | NS | — | — | **Duplicate of CC-21** (track there). |
| [L-04][l04] | Route catch blocks bypass error mapping | LOW | Routes | API | CONFIRMED | P | — | NS | — | — | Invoice routes map non-`AppError` to 500 (seen in CC-02 / CC-06). |
| [L-05][l05] | Liveness check depends on DB | LOW | Deploy | Ops | REPORTED — NEEDS RECHECK | S | — | NS | — | — | |
| [L-06][l06] | COA prefetch URL mismatch | LOW | Frontend | FE | REPORTED — NEEDS RECHECK | S | — | NS | — | — | |
| [L-07][l07] | Integrity queue connects to Redis at import | LOW | Jobs | Ops | REPORTED — NEEDS RECHECK | S | — | NS | — | — | |
| [I-01][i01] | Manual journal unpost flips posted → draft | INFO | Accounting | E | CONFIRMED | C | — | NS | — | — | Controlled exception; candidate for ACCEPTED RISK (owner decision needed). Pairs with CC-08. |
| [I-02][i02] | Dead code unsafe if revived | INFO | Various | I | CONFIRMED | C | — | NS | — | — | |
| [I-03][i03] | Delete-cancelled / post-all disabled | INFO | Ops tools | Ops | CONFIRMED | C | — | NS | — | — | |
| [I-04][i04] | zod 3 backend / zod 4 frontend | INFO | Validation | I | REPORTED — NEEDS RECHECK | S | — | NS | — | — | |
| [I-05][i05] | No error tracking; hand-written metrics | INFO | Observability | Obs | REPORTED — NEEDS RECHECK | S | — | NS | — | — | |
| [I-06][i06] | Mixed decimal scales | INFO | Schema | Schema | CONFIRMED | C | — | NS | — | — | |

### 3.2 Correctness and concurrency audit

| ID | Title | Sev | Module | Class | Status | Verif | Test | Remed. | Commit | Deploy | Notes / dependencies |
|---|---|---|---|---|---|---|---|---|---|---|---|
| [CC-01][cc01] | Posted cash-voucher edit vs unpost | HIGH | Treasury | E | CONFIRMED | C | DS | NS | — | — | = discovery "treasury edit vs unpost". Touches H-03 code. |
| [CC-02][cc02] | Invoice double unpost | HIGH | Invoices | A / E | **FIXED — LOCAL** | R | MY | DONE-L | UC | ND | See §5. |
| [CC-03][cc03] | POS order double unpost | HIGH | POS | A / E | **FIXED — LOCAL** | R | MY | DONE-L | UC | ND | See §5. |
| [CC-04][cc04] | Settlement over-allocation | HIGH | Invoices | C / A | CONFIRMED | M | DS | NS | — | — | Related: CC-27. |
| [CC-05][cc05] | Commercial-paper collect double post | HIGH | Accounting | A | CONFIRMED | M | DS | NS | — | — | |
| [CC-06][cc06] | Invoice draft edit / cancel / delete vs post | HIGH | Invoices | E | **FIXED — LOCAL** | R | MY | DONE-L | UC | ND | See §5. Implemented **without** bumping `version` on post (the audit's suggested direction was superseded). |
| [CC-07][cc07] | Manual journal draft edit vs post | MED | Accounting | E | CONFIRMED | C | DS | NS | — | — | Same shape as CC-06. |
| [CC-08][cc08] | Manual journal double unpost | MED | Accounting | A / E | CONFIRMED | C | DS | NS | — | — | Related: I-01. |
| [CC-09][cc09] | Treasury overdraft check not concurrency-safe | MED | Treasury | C | CONFIRMED | C | DS | NS | — | — | = discovery "treasury overdraft exposure" (N-03). |
| [CC-10][cc10] | Cost recalculation overwrites concurrent postings | MED | Costing | B / G | CONFIRMED | M | DS | NS | — | — | Runs after every PURCHASE unpost; pairs with H-07. |
| [CC-11][cc11] | Concurrent returns exceed original qty | MED | Invoices | C | CONFIRMED | M | DS | NS | — | — | Related: CC-24. |
| [CC-12][cc12] | Cheque clear and bounce both succeed | MED | Treasury | E | CONFIRMED | M | DS | NS | — | — | |
| [CC-13][cc13] | Other reversal flows (offset, renewal, paper unpost, opening stock) | MED | Acct / Inv | A / E | REPORTED — NEEDS RECHECK | S | DS | NS | — | — | Root cause INF-1. Opening stock unpost → cancel reported to double-reverse **sequentially**. |
| [CC-14][cc14] | Create-then-post split tx duplicates on retry | MED | Treasury / Inv | F / H | CONFIRMED | P | DS | NS | — | — | Verified for cash vouchers; same root as M-02. |
| [CC-15][cc15] | Period / year-end close vs concurrent posting | MED | Accounting | C | REPORTED — NEEDS RECHECK | S | DS | NS | — | — | |
| [CC-16][cc16] | Balance rebuild concurrent with posting | MED | Accounting | G / B | REPORTED — NEEDS RECHECK | S | — | NS | — | — | Pairs with H-06. |
| [CC-17][cc17] | Credit-limit check-then-act | LOW | Parties | C | REPORTED — NEEDS RECHECK | S | — | NS | — | — | Pairs with M-07. |
| [CC-18][cc18] | Lock-order inversion IQ / IWB | LOW | Inventory | I | CONFIRMED | M | — | NS | — | — | Fail-closed; see M-06. |
| [CC-19][cc19] | Duplicate serials from `count()+1` / `MAX+1` | LOW | Inventory / masters | D | CONFIRMED | P | — | NS | — | — | = M-04 fix; data clean-up before uniques. |
| [CC-20][cc20] | `item_cost_history.serial` collision (N-01) | LOW | Costing | D | CONFIRMED | C | — | NS | — | — | = discovery "MAX(serial)+1 race". **Observed live** as the incidental failure of overlap-mode losers in the H-01, CC-02 and CC-03 runs (fail-closed). |
| [CC-21][cc21] | Numbers allocated outside business tx (gaps) | LOW | Numbering | F / D | CONFIRMED | P | — | NS | — | — | Absorbs L-03. |
| [INF-1][inf] | Idempotent reversal helper hides duplicate unposts | INFO | Accounting | I | CONFIRMED | C | — | NS | — | — | Root of CC-01/02/03/13. New unpost flows must claim first. |
| [INF-2][inf] | Cash-voucher unpost safe via in-tx re-read | INFO | Treasury | I | CONFIRMED | C | — | — | — | — | Keep this shape. |
| [INF-3][inf] | Landed-cost unpost uses current on-hand | INFO | Costing | Logic | REPORTED — NEEDS RECHECK | S | — | NS | — | — | Under M-09. |
| [INF-4][inf] | Manufacturing FG moving-average skipped | INFO | Manufacturing | Logic | REPORTED — NEEDS RECHECK | S | — | NS | — | — | Under M-09. |
| [INF-5][inf] | Approval JSON read-modify-write loses steps | INFO | Approvals | B | REPORTED — NEEDS RECHECK | S | — | NS | — | — | Related: CC-25 and CC-26. |
| [INF-6][inf] | ETA POS receipt hash unstable across retries | INFO | E-invoice | H | REPORTED — NEEDS RECHECK | S | — | NS | — | — | |
| [INF-7][inf] | Display numbers accept duplicates | INFO | Schema | D | REPORTED — NEEDS RECHECK | S | — | NS | — | — | |

### 3.3 New findings from wave 1 (CC-22…CC-29)

| ID | Title | Sev | Module | Class | Status | Verif | Test | Remed. | Commit | Deploy | Notes / dependencies |
|---|---|---|---|---|---|---|---|---|---|---|---|
| CC-22 | POS order double post | HIGH (candidate) | POS | A | REPORTED — NEEDS RECHECK | M | — | NS | — | — | Harness exists (CC-03 test). Contradicts the ARCHITECTURE_AUDIT H-01 remark that POS is protected by `activeSourceKey`. |
| CC-23 | POS shift close vs order post / unpost; double close | MED (candidate) | POS | C / E | REPORTED — NEEDS RECHECK | M | — | NS | — | — | |
| CC-24 | Legacy `POST /pos/sales/:id/cancel` creates unlinked returns; repeatable | HIGH if reachable | POS / Invoices | A / F | REPORTED — NEEDS RECHECK | S | — | NS | — | — | UI reachability unknown. Related: CC-11, CC-14. |
| CC-25 | Invoice approval / unapprove vs post | MED (candidate) | Invoices / Approvals | C / E | REPORTED — NEEDS RECHECK | M | — | NS | — | — | Approval-control bypass; the ledger itself stays consistent. |
| CC-26 | Approval / workflow state vs draft edit | MED (candidate) | Invoices / Approvals | E / policy | REPORTED — NEEDS RECHECK | M | — | NS | — | — | May be a product-policy question rather than a race. |
| CC-27 | Invoice payment-status refresh vs unpost | MED? | Invoices | B / E | REPORTED — NEEDS RECHECK | S | — | NS | — | — | Interaction not traced. Related: CC-04. |
| CC-28 | Legacy invoice restore is unconditional | LOW | Invoices (legacy) | E | REPORTED — NEEDS RECHECK | M | — | NS | — | — | Route not used by gates-web. Related: L-02. |
| CC-29 | Claim loser can time out (P2028) instead of a clean 400/409 | LOW | Platform | H / I | REPORTED — NEEDS RECHECK | M | — | NS | — | — | Affects every claim-first fix (H-01, CC-02, CC-03, CC-06). Fail-closed. Related: M-06. |

---

## 4. Discoveries during remediation (reconciliation)

| Discovery | Where it was seen | Mapped to | Duplicate? |
|---|---|---|---|
| `item_cost_history` `MAX(serial)+1` race | Overlap-mode losers in H-01 / CC-02 / CC-03 runs died on the serial unique | **CC-20** (N-01) | Existing; now observed on MySQL. |
| Treasury posted-edit vs unpost race | H-03 analysis | **CC-01** (N-02) | Existing. |
| Treasury overdraft concurrency exposure | H-03 analysis | **CC-09** (N-03) | Existing. |
| POS double post | CC-03 phase 7 | **CC-22** | New. |
| POS shift-close race | CC-03 phase 7 | **CC-23** | New. |
| Legacy POS repeated cancel / return | CC-03 phase 7 | **CC-24** | New. Overlaps CC-11/CC-14 in effect, not in mechanism. |
| Invoice approval vs post | CC-06 phase 9 | **CC-25** | New. INF-5 covers approval JSON only. |
| Invoice approval / workflow vs edit | CC-06 phase 9 | **CC-26** | New. |
| Invoice payment status vs unpost | CC-06 phase 9 | **CC-27** | New. CC-04 covers settle vs settle only. |
| Unconditional legacy invoice restore | CC-06 phase 1 | **CC-28** | New. |
| Losing-unpost transaction timeout | CC-02 design review | **CC-29** | New. M-06 covers P2034, not P2028. |

Mechanisms, briefly (enough to re-check; not a substitute for a full audit entry):

- **CC-22**:
  - `pos-order-posting.service.ts` `postOrder` checks `status` before `prisma.$transaction` and has no conditional claim.
  - POS journals get `activeSourceKey = null`, because `persistJournalSourceType` drops `'POS'` (seen as null in the test DB).
  - A double-click on "pay" could therefore double stock, drawer, bank, shift totals, customer balance and the journal.
  - Traced in code and data; not reproduced.
- **CC-23**: shift close reads status and totals before its transaction and sets `CLOSED` unconditionally. Order posts or unposts landing meanwhile make the closing cash figure and variance stale. Two concurrent closes could book the variance twice.
- **CC-24**: for a posted sale, the legacy cancel creates and posts a new return invoice with no link to, or guard on, the original. Repeated or concurrent cancels create multiple returns.
- **CC-25**: `invoicePostingOrchestrator.post` calls `approvalWorkflowService.assertCanPostInvoice` before its transaction. The post claim does not include `workflowStatus`, so an unapprove or reject committed in between does not stop the post.
- **CC-26**: `approval-workflow.service.ts` `updateScoped` writes `{ id, companyId }` unconditionally. `invoiceM5Service.update` neither checks nor resets approval or workflow state, so an approved draft can be edited before posting.
- **CC-27**: `refreshInvoiceBalanceInTx` updates `paidAmount / remainingAmount / paymentStatus` by id only, with no state check. Its interleaving with unpost's settlement teardown was not traced.
- **CC-28**: legacy `invoiceService.restoreInvoice` sets `isCancelled = false` outside any transaction, with no conditional predicate.
- **CC-29**: a claim loser waits on the winner's row lock for the winner's whole transaction. Prisma's interactive-transaction default is 5 s (no explicit timeout on these paths), so a slow winner makes the loser fail with P2028 instead of the friendly 400/409. Nothing is corrupted.

---

## 5. Completed wave 1: FIXED — LOCAL

All five are uncommitted and not deployed. Each was reproduced on real MySQL before the fix and re-run after it, against the disposable database `gates_h01_test` (local MySQL 9.3, port 3306). Every test file skips unless the `DATABASE_URL` database name contains `test`.

| ID | Production files | Protecting test file(s) | Result after fix |
|---|---|---|---|
| H-01 | `gates-backend/src/modules/inventory/services/transfer.service.ts`, `adjustment.service.ts`, `other-adjustment.service.ts` | `gates-backend/src/__tests__/integration/inventory-document-post-concurrency.test.ts` | 9/9 |
| H-03 | `gates-backend/src/modules/treasury/services/cash-transaction.service.ts`, `treasury-posting.service.ts`, `treasury/routes/cash-transaction.routes.ts` | `gates-backend/src/__tests__/integration/posted-cash-voucher-edit-atomicity.test.ts`; unit `gates-backend/src/__tests__/unit/accounting-round2-rewrite.spec.ts` (updated) | 4/4; 1/1 |
| CC-02 | `gates-backend/src/modules/invoices/services/invoice-posting-orchestrator.ts` (unpost claim) | `gates-backend/src/__tests__/integration/invoice-unpost-concurrency.test.ts` | 9/9 |
| CC-03 | `gates-backend/src/modules/pos/services/pos-order-posting.service.ts` | `gates-backend/src/__tests__/integration/pos-order-unpost-concurrency.test.ts` | 5/5 |
| CC-06 | `invoice-posting-orchestrator.ts` (post claim), `gates-backend/src/modules/invoices/services/invoice-m5.service.ts`, `gates-backend/src/modules/inventory/services/invoice.service.ts` (legacy) | `gates-backend/src/__tests__/integration/invoice-draft-mutation-vs-post.test.ts` | 16/16, three consecutive runs |

**Regression suites run after the last fix (CC-06):**
- **Integration, together:** CC-02 + CC-03 + H-01 + H-03, 27/27.
- **Unit specs, all passing:**
  - `accounting-round2-cost-center-subtree`, `accounting-round2-journal`, `accounting-round2-paper-cancel`, `accounting-round2-rewrite`, `accounting-round2`
  - `adjust-stock-in-tx`, `auto-gl-posting`, `automation-sales-invoice-overdue`
  - `commercial-paper-journals`, `commercial-paper-unpost`
  - `inventory-costing.service`, `inventory-integrity`
  - `invoice-below-cost`, `invoice-settlement-policy`, `optimistic-lock`, `sale-invoice-return-policy`, `voucher-fx-totals`
- **Known unrelated failure:** `post-movement-sync.spec.ts`, 1 test (§8 T-07).
- **Deliberately not run:** `optimistic-locking.test.ts`, `unpost-settlement.test.ts`, `phase1-ledger-foundations.test.ts`, `automation-purchase-request.integration.test.ts`. They call `loadEnv({ override: true })` (§8 T-01).
- **`tsc --noEmit`:** the same 10 pre-existing errors in `reports.service.ts` after every fix; none in wave files.

**Caveat that applies to all five:** every test ran against the full dirty working tree, never against HEAD plus the fix alone. The fixes also sit in files with unrelated uncommitted edits (§7). Committed versions must be re-verified (§8 T-12).

---

## 6. Recommended Remediation Queue

Not sorted by severity. The ranking weighs:
- silent money/stock corruption;
- how likely normal use (double-click, retry, two users) triggers it;
- blast radius;
- whether a database invariant is missing;
- whether a deterministic test is practical with the existing harnesses;
- regression risk;
- shared failure class, since the claim-first pattern is now proven on four flows.

Items marked NEEDS RECHECK start with a reproduction; if it fails, stop and re-grade.

### P0 — protect correctness now

1. **CC-22** POS double post (recheck, then fix)
2. **CC-01** Posted cash-voucher edit vs unpost
3. **CC-05** Commercial-paper collect double post
4. **CC-04** Settlement over-allocation
5. **CC-12** Cheque clear vs bounce
6. **CC-13** Remaining reversal flows, with the INF-1 helper decision (recheck each flow)

### P1 — high-risk correctness

7. **H-02** Renumber tool containment (disable until redesigned)
8. **CC-11** Over-return lock
9. **CC-08** Manual journal double unpost
10. **CC-14** + M-02: create-and-post in one transaction; idempotency key
11. **CC-07** Manual journal edit vs post
12. **CC-24** Legacy POS cancel (check reachability first)
13. **CC-25** Invoice approval vs post
14. **CC-23** POS shift close
15. **CC-27** Invoice payment status vs unpost (recheck)
16. **CC-10** + H-07 (fix average cost): recalculation lost update
17. **CC-16** + H-06: rebuild vs posting
18. **M-09** + INF-3 + INF-4: inventory cost side paths
19. **M-03** Stock-document `activeSourceKey` serial

### P2 — integrity / hardening

- **CC-15** period close vs posting
- **CC-09** overdraft lock (measure contention first)
- **CC-17** + M-07 credit-limit lock and cache precision
- **CC-18** single lock order
- **M-06** + CC-29: map and retry P2034 / P2028
- **CC-19** + M-04: sequences and uniques, after data clean-up
- **CC-20** cost-history serial
- **CC-21** / L-03: in-transaction numbering
- **CC-26** approval vs edit (needs a policy decision)
- **CC-28** legacy restore
- **L-02** retire the legacy invoice routes (removes CC-28 and part of CC-24 exposure)
- **M-10** tenancy list
- **L-04** error mapping
- **I-01** (decide ACCEPTED RISK or fix together with CC-08)
- **I-02**, **I-06**, **INF-5**, **INF-6**, **INF-7**

### P3 — performance / scalability

H-05, H-06 (per-request counts), H-07, M-01, M-05, M-08, M-11, M-14, L-01, L-06. Measure first, per `PERFORMANCE_BASELINE_PLAN.md`.

### P4 — operational / deployment / tooling

- **H-04**: migrations on boot, with a hard-coded resolve. **Must be settled before the next deploy.**
- **Deploy process**: production has been deployed with `railway up` from this dirty working tree, so git HEAD does not describe production (§8 T-14).
- M-12, M-13, L-05, L-07, I-03, I-04, I-05.
- Test-environment items §8 T-01…T-16.

### Top 10 open items: why each is placed where it is

1. **CC-22**: the highest-volume cashier action, where one double-click would double stock, cash drawer, bank, shift, customer and journal with no database guard at all (null `activeSourceKey`). The CC-03 harness makes reproduction cheap, so it goes first as recheck-then-fix.
2. **CC-01**: silent money corruption already confirmed in code. The fix is local to the H-03 code that was just tested, the test is designed, and it is the same failure class as CC-06.
3. **CC-05**: a double-click posts the bank collection twice; the fix is one conditional claim with the proven CC-02/CC-03 pattern, the smallest and lowest-risk change here.
4. **CC-04**: a double-click creates two real receipts and `paidAmount > netAmount`, with no database invariant. A conditional increment fixes it with low regression risk.
5. **CC-12**: two users can move both the bank (clear) and the customer (bounce) for one cheque. It needs two actors, so it is slightly less likely than the single-user double-clicks above.
6. **CC-13**: four flows share the INF-1 root, and one (opening-stock unpost then cancel) is reported to corrupt even sequentially. Each flow needs a recheck first, hence after the confirmed items.
7. **H-02**: a single admin run can irreversibly corrupt legal document numbers. Containment by disabling the endpoint is tiny, but normal-use likelihood is low.
8. **CC-11**: over-returns inflate stock and customer credit. Low frequency; a clear lock on the original invoice.
9. **CC-08**: double inversion of period balances is silent. It only affects rebuildable caches, which keeps it below the source-data corruptions.
10. **CC-14**: on slow Railway requests, a retry after a 408 is realistic and duplicates posted vouchers. The fix (single transaction plus idempotency key) is larger, so it follows the one-claim fixes.

---

## 7. Git working-tree forensic inventory (read-only)

### 7.1 Repository state

| Item | Value |
|---|---|
| Branch | `main` |
| HEAD | `45fd5beec3b5979454b8cf325532fe9f157ff824` (2026-09-23 19:08 +0300) "Align invoice, stock, and report screens with the live document flows." |
| Worktrees | 1 (`/Users/hazem/Desktop/gates web`) |
| Staged (`git diff --cached --name-only`) | 0 |
| Modified tracked (`git diff --name-only`) | 823 (`git diff --stat`: 69,611 insertions, 58,016 deletions) |
| Untracked | 123 porcelain entries; 141 files with `-uall` |
| `git status --porcelain` entries | 946 (before this task's two documents) |
| File-level paths classified | 964 (823 modified + 141 untracked) |
| Stash | `stash@{0}: On main: wip-unrelated-before-party-groups-deploy`, left untouched |
| Concurrent writers | While this board was being written (16:39–16:50), another session added 8 paths for an analytical-invoice report: 5 modified (`invoices/routes/analytical-invoice-report.routes.ts`, `invoices/schemas/invoice-source.schema.ts`, `invoices/services/invoice-source.service.ts`, `gates-web/app/components/form/PartySelect.tsx`, `gates-web/app/inventory/reports/sales-returns-reports/page.tsx`) and 3 new (`analytical-invoice-movement.ts`, `analytical-invoice-movement.spec.ts`, `AnalyticalInvoiceSheet.tsx`). They are **not** in the 964-path inventory; treat them as category H. Porcelain entries at the end of this task: 954. |

**Line endings**:
- 398 of the 823 modified files are stored with CRLF in HEAD. In 256 of those, the working copy has been converted to LF, so their diffs are whole-file rewrites (one hunk).
- Converted files in this wave: `invoice-posting-orchestrator.ts`, `invoice-m5.service.ts`, `cash-transaction.service.ts`, `treasury-posting.service.ts`, `cash-transaction.routes.ts`. The origin of the conversion is **unknown**.
- Two modified files differ from HEAD only in line endings: `gates-backend/src/modules/invoices/routes/invoice.routes.ts` and `gates-web/components/inventory/sales-invoice/SalesInvoiceFormHeader.tsx`.

### 7.2 Classification

Ownership was assigned only from evidence:
- the recorded task reports;
- this conversation's recorded file edits;
- diff content.

The earlier before/after `git status` snapshots were lost when `/tmp` was cleared by a reboot at 16:08, so no path is attributed from timing. Several sessions were writing to this tree at the same time; that is recorded in the H-01 and CC-03 reports.

| Cat. | Meaning | Paths | Ownership proven? |
|---|---|---|---|
| A | Architecture documentation / rules | 15 | Yes (this agent) |
| B | H-01 | 4 | Task hunks yes; the files also carry unrelated edits |
| C | H-03 | 5 | Task hunks yes; the files also carry unrelated edits |
| D | CC-02 | 1 test (+ orchestrator, shared) | Yes |
| E | CC-03 | 2 | Yes, exclusively |
| F | CC-06 | 3 (+ orchestrator, shared) | Task hunks yes; the files also carry unrelated edits |
| D+F | CC-02 and CC-06 | 1 (`invoice-posting-orchestrator.ts`) | Task hunks yes; the file also carries unrelated edits |
| G | Known unrelated pre-existing work | 187 | Partly: edited by earlier recorded feature tasks in this conversation (reports, ledger footers, automation, WhatsApp, securities, etc.); other sessions may have co-edited them. Not attributable to a single change. |
| H | Unknown ownership. DO NOT TOUCH. | 733 | No |
| I | Generated / temp artifacts | 4 | No (type only) |
| J | Migration / schema changes | 9 | No. One migration (`20260924180000_securities_receipt_endorsee`) and some `schema.prisma` edits trace to earlier recorded work; the rest are unknown. |
| | **Total** | **964** | Proven 31 · partial 187 · unknown 746 |

Paths in categories A–F, I and J:

- **A** (untracked):
  - `.cursor/rules/00-gates-core.mdc`, `10-backend.mdc`, `20-database.mdc`, `30-transactions-concurrency.mdc`, `40-accounting.mdc`, `50-inventory.mdc`, `60-multitenancy-security.mdc`, `70-frontend.mdc`, `80-performance.mdc`, `90-testing-change-safety.mdc`
  - `docs/architecture/ARCHITECTURE_AUDIT.md`, `CURRENT_ARCHITECTURE.md`, `ENGINEERING_CONSTITUTION.md`, `PERFORMANCE_BASELINE_PLAN.md`, `CORRECTNESS_CONCURRENCY_AUDIT.md`
  - Added by this task: `REMEDIATION_BOARD.md`, `WORKTREE_INVENTORY_2026-09-27.md`.
  - `.cursorignore`, `docs/QA-AR.md` and `docs/STATUS.md` are **H** (not proven).
- **B**:
  - `gates-backend/src/modules/inventory/services/transfer.service.ts` (M), `adjustment.service.ts` (M), `other-adjustment.service.ts` (M)
  - `gates-backend/src/__tests__/integration/inventory-document-post-concurrency.test.ts` (??)
- **C**:
  - `gates-backend/src/modules/treasury/services/cash-transaction.service.ts` (M), `treasury-posting.service.ts` (M), `gates-backend/src/modules/treasury/routes/cash-transaction.routes.ts` (M)
  - `gates-backend/src/__tests__/integration/posted-cash-voucher-edit-atomicity.test.ts` (??)
  - `gates-backend/src/__tests__/unit/accounting-round2-rewrite.spec.ts` (??; created by earlier recorded work, updated by H-03)
- **D**: `gates-backend/src/__tests__/integration/invoice-unpost-concurrency.test.ts` (??)
- **E**: `gates-backend/src/modules/pos/services/pos-order-posting.service.ts` (M), `gates-backend/src/__tests__/integration/pos-order-unpost-concurrency.test.ts` (??)
- **F**: `gates-backend/src/modules/invoices/services/invoice-m5.service.ts` (M), `gates-backend/src/modules/inventory/services/invoice.service.ts` (M), `gates-backend/src/__tests__/integration/invoice-draft-mutation-vs-post.test.ts` (??)
- **D+F**: `gates-backend/src/modules/invoices/services/invoice-posting-orchestrator.ts` (M)
- **I**: `gates-backend/docs/DATABASE-FULL-CATALOG.generated.md`, `database-explorer-index.txt`, `database-explorer.html`, `database-explorer.json` (all ??)
- **J**:
  - `gates-backend/prisma/schema.prisma` (M)
  - Migrations (all ??): `20260923120000_hr_lookups`, `20260924140000_item_quantity_decimal_18_4`, `20260924143000_invoice_line_source_and_combo_item`, `20260924150000_clothing_combo_per_item`, `20260924160000_company_email_config`, `20260924170000_whatsapp_embedded_signup`, `20260924180000_securities_receipt_endorsee`, `20260927150000_company_settings_logo_longtext`

G and H are listed path by path in [WORKTREE_INVENTORY_2026-09-27.md](WORKTREE_INVENTORY_2026-09-27.md). By area:
- **G:** backend src 80, web app 40, web components 33, web lib 32, other 2.
- **H:** backend src 329, web app 209, web components 135, web lib 35, other 25. H includes `package.json`, lockfiles, both `.github` workflows, `eslint.config.mjs`, `middleware.ts` and `next.config`-adjacent configuration.

### 7.3 Hidden dependencies of the wave

- **H-01** calls `claimDocumentPost` / `claimDocumentUnpost` from `gates-backend/src/modules/inventory/utils/claim-document-post.ts`, which is **untracked** (category H). The same helper is used by modified, uncommitted `receipt`, `issue`, `stocktaking`, `assembly` and `disassembly` services. The audit's "verified safe" rows for receipts and issues therefore describe **local, uncommitted** code.
- Several wave tests import modified, uncommitted modules: `inventory-costing.service.ts`, `invoice-posting.types.ts`, `shared/database/prisma.ts`. Whether any test passes on HEAD plus its fix alone is **unproven**.

---

## 7A. Overlap risk (files touched by more than one change)

| File | Known tasks | Unrelated edits already present | Line endings | Whole-file staging safe? | Hunk-level extraction | Verdict |
|---|---|---|---|---|---|---|
| `invoices/services/invoice-posting-orchestrator.ts` | CC-02 (unpost claim), CC-06 (post claim), earlier recorded feature work | Yes: `SALES_ORDER` rights, sales-tax handling, purchase-return costing, domain events, costing-service rewrite of the unpost stock block | HEAD CRLF → working copy LF (one whole-file hunk) | No | Not possible without first separating the line-ending conversion. The CC-02 claim sits in the same unpost block as the unrelated costing rewrite. | **MANUAL RECONCILIATION REQUIRED** |
| `invoices/services/invoice-m5.service.ts` | CC-06 | Yes: item offers, invoice-line source, contract due days, unit validation, and more | CRLF → LF | No | Not possible as is | **MANUAL RECONCILIATION REQUIRED** |
| `inventory/services/invoice.service.ts` (legacy) | CC-06 | Yes: 8 hunks translating "not found" messages to Arabic | LF, unchanged | No (includes the translations) | Feasible: the 5 CC-06 hunks are disjoint and self-contained | Extractable, via a reviewed patch rather than `git add -p` |
| `inventory/services/transfer.service.ts` | H-01, earlier recorded feature work | Yes: posting-branch resolution, same-branch checks, source-type change, unpost-leg rewrite | LF | No | Risky: claim and unrelated branch-sync code share hunks | **MANUAL RECONCILIATION REQUIRED** |
| `inventory/services/adjustment.service.ts` | H-01, earlier recorded feature work | Yes: new `updateAdjustment`, `bookQty == null` fix, Arabic messages | LF | No | Hunks disjoint, but the claims need the untracked helper | Extractable only together with `claim-document-post.ts` |
| `inventory/services/other-adjustment.service.ts` | H-01 | Yes: costing-service rewrite of the post/unpost loop | LF | No | Hunks disjoint, but the claims wrap blocks whose bodies changed, and the H-01 test exercised the new costing path | **MANUAL RECONCILIATION REQUIRED** |
| `treasury/services/cash-transaction.service.ts` | H-03, earlier recorded feature work | Yes: FX-aware overdraft amount, Arabic messages, optional chaining | CRLF → LF | No | Not possible as is | **MANUAL RECONCILIATION REQUIRED** |
| `treasury/services/treasury-posting.service.ts` | H-03, earlier recorded feature work | Yes: `roundTo4` totals, overdraft import, Arabic messages. The `db` transaction-client threading may belong to H-03 (unproven). | CRLF → LF | No | Not possible as is | **MANUAL RECONCILIATION REQUIRED** |
| `treasury/routes/cash-transaction.routes.ts` | H-03 | Yes: error-message edits in 8 hunks | CRLF → LF | No | Not possible as is | **MANUAL RECONCILIATION REQUIRED** |
| `__tests__/unit/accounting-round2-rewrite.spec.ts` | Earlier recorded work (created), H-03 (updated) | Whole file is new, untracked | LF | Yes, with H-03 | n/a | Commit with H-03 |
| `pos/services/pos-order-posting.service.ts` | CC-03 only | None: the file was clean against HEAD before CC-03 | CRLF kept, including the inserted lines | **Yes** | Not needed | Clean |

---

## 7B. Proposed commit plan (not executed)

Nothing below has been run. Do not use `git add .`, `git add -p`, reset, checkout, restore or stash.

**Step 0: verification worktree (proposal).** Create a second worktree from HEAD (for example `git worktree add ../gates-verify 45fd5be`), copy only a candidate commit's files into it, and run that commit's tests there against `gates_h01_test`. This is the only way to prove that a commit works without the rest of the dirty tree.

| # | Commit | Exact files | Whole-file safe? | Hunk extraction needed? | Tests immediately before committing |
|---|---|---|---|---|---|
| 1 | docs: architecture audits, rules, remediation board | the 10 `.cursor/rules/*.mdc`; `docs/architecture/ARCHITECTURE_AUDIT.md`, `CURRENT_ARCHITECTURE.md`, `ENGINEERING_CONSTITUTION.md`, `PERFORMANCE_BASELINE_PLAN.md`, `CORRECTNESS_CONCURRENCY_AUDIT.md`, `REMEDIATION_BOARD.md`, `WORKTREE_INVENTORY_2026-09-27.md` | **Yes**: all untracked, documentation only | No | None (documentation). Confirm no code path is included. |
| 2 | fix(pos): claim POS order unpost (CC-03) | `gates-backend/src/modules/pos/services/pos-order-posting.service.ts`; `gates-backend/src/__tests__/integration/pos-order-unpost-concurrency.test.ts` | **Yes** | No | In the Step 0 worktree: `pos-order-unpost-concurrency.test.ts` (5/5) and `tsc --noEmit`. If the test needs other uncommitted modules, stop: the commit is not self-contained. |
| 3 | fix(invoices): CC-02 + CC-06 invoice state claims | orchestrator, `invoice-m5.service.ts`, legacy `invoice.service.ts`, `invoice-unpost-concurrency.test.ts`, `invoice-draft-mutation-vs-post.test.ts` | No | Yes | **MANUAL RECONCILIATION REQUIRED.** The orchestrator and M5 service mix line-ending conversion and unrelated work with the fixes. Splitting CC-02 from CC-06 inside one line-ending-converted file is high risk; one combined commit is recommended after reconciliation. Run `invoice-unpost-concurrency` (9/9) and `invoice-draft-mutation-vs-post` (16/16) in the Step 0 worktree. |
| 4 | fix(inventory): claim transfer / adjustment posts (H-01) | `transfer.service.ts`, `adjustment.service.ts`, `other-adjustment.service.ts`, `inventory-document-post-concurrency.test.ts`, **plus** `inventory/utils/claim-document-post.ts` (unknown owner) | No | Yes | **MANUAL RECONCILIATION REQUIRED.** Needs a decision on the claim-helper workstream (the helper plus receipt / issue / stocktaking / assembly / disassembly) and on the costing rewrite in `other-adjustment`. Run `inventory-document-post-concurrency` (9/9) and `inventory-costing.service.spec` in Step 0. |
| 5 | fix(treasury): posted voucher edit in one transaction (H-03) | `cash-transaction.service.ts`, `treasury-posting.service.ts`, `cash-transaction.routes.ts`, `posted-cash-voucher-edit-atomicity.test.ts`, `accounting-round2-rewrite.spec.ts` | No | Yes | **MANUAL RECONCILIATION REQUIRED** (line-ending conversion plus unrelated edits). Run `posted-cash-voucher-edit-atomicity` (4/4), `accounting-round2-rewrite.spec`, `voucher-fx-totals.spec` in Step 0. |

**Clean commits possible now:** #1 (documentation). #2 (CC-03) is clean in content but must first pass the Step 0 isolation run. #3–#5 need manual reconciliation by the owners of the unrelated edits before any commit.

Recommended order: #1, then #2, then reconcile and commit #3, then #4 (after the claim-helper decision), then #5. The categories G, H, I and J, and the stash, are out of scope for these commits.

---

## 8. Test-environment issues found in wave 1

| # | Issue | Classification |
|---|---|---|
| T-01 | Four integration tests call `loadEnv({ override: true })`, which replaces `DATABASE_URL` with the `.env` database (local dev `gates_db`): `optimistic-locking.test.ts`, `unpost-settlement.test.ts`, `phase1-ledger-foundations.test.ts`, `automation-purchase-request.integration.test.ts`. | MUST FIX BEFORE CI |
| T-02 | `src/__tests__/setup.ts` calls `loadEnv()`, so an unset `DATABASE_URL` silently falls back to `.env`. Only the five wave tests guard on the database name. | MUST FIX BEFORE CI |
| T-03 | `gates_h01_test` was built by hand: dev schema cloned without data, then `prisma db push` for uncommitted schema changes, with a `sql_mode` adjustment. It is not reproducible from a script. | SHOULD FIX |
| T-04 | The migration chain cannot build an empty database: an early migration assumes a pre-existing `api_keys` baseline, and MySQL 9.3 rejected a TEXT default. CI runs `prisma migrate deploy` on an empty `mysql:8` `test_db`. | MUST FIX BEFORE CI (verify on MySQL 8 first) |
| T-05 | MySQL versions differ: local 9.3, CI `mysql:8`; the production version is not recorded here. | SHOULD FIX (pin CI to production's version) |
| T-06 | 10 pre-existing `tsc` errors in `accounting/services/reports.service.ts`. CI runs `npm run type-check`. The Railway build is `prisma generate` only, so it does not block deploys. | MUST FIX BEFORE CI |
| T-07 | `post-movement-sync.spec.ts` fails one test: its mock returns a row without a Decimal `quantity`. It is unrelated to wave files, and CI's `npm test` would be red. | MUST FIX BEFORE CI |
| T-08 | Prisma interactive transactions default to 5 s; claim losers can get P2028 (CC-29). Recalculation uses 120 s. | SHOULD FIX |
| T-09 | The concurrency tests skip silently unless the database name contains `test`. CI's `test_db` satisfies this, but a misconfigured run would pass green with skips. | SHOULD FIX (fail CI when DB-backed suites skip) |
| T-10 | The unit suite ran out of memory locally without `NODE_OPTIONS=--max-old-space-size=4096`. One multi-file jest run hung for about 56 minutes, while the same files passed one by one. | SHOULD FIX |
| T-11 | ESLint errors pre-exist in wave files: unused `stockMovementService` import in the orchestrator, `@ts-nocheck` in legacy `invoice.service.ts`. CI runs `npm run lint` over all of `src`; the full lint was not run in wave 1. | MUST FIX BEFORE CI (if lint gates CI) |
| T-12 | All five fixes were verified only against the dirty working tree, not HEAD plus fix. | MUST FIX BEFORE DEPLOY (re-verify each commit, §7B Step 0) |
| T-13 | Eight untracked migrations and a modified `schema.prisma` of mostly unknown ownership. H-04 applies pending migrations at API boot, with a hard-coded `--rolled-back` resolve. | MUST FIX BEFORE DEPLOY |
| T-14 | Production has been deployed with `railway up` from the dirty working tree, so production cannot be reproduced from git. | MUST FIX BEFORE DEPLOY (deploy only from a commit) |
| T-15 | The CI workflow `gates-backend/.github/workflows/test.yml` is modified by an unknown session (+31 / −10). | INFORMATIONAL |
| T-16 | The same shell can reach an SSH tunnel on port 3307; `.env` currently points to `localhost:3306`. Any test run must print host/port/database first. | INFORMATIONAL |

---

## 9. Recommended workflow from now on

1. **One coding agent per worktree.** Create a worktree per finding (`git worktree add ../gates-cc05 -b fix/cc-05 <base>`). Never run two Cursor agents that edit code in the same directory; wave 1 shows other sessions writing into the tree mid-task.
2. **One finding per branch and per commit** where practical. Only combine findings when they share one write boundary (as CC-02 and CC-06 now do in the orchestrator).
3. **Clean checkpoint first.** Start each remediation from a commit, not from this dirty tree. Until the current tree is reconciled, branch from HEAD in a new worktree and bring over only the files the fix needs.
4. **Dedicated test database.** Use a scripted, disposable `gates_*_test` database built the same way CI builds its own. Fix T-04 so that is `prisma migrate deploy` on an empty database. Drop and recreate per run when possible.
5. **Integration tests never fall back to dev or prod.** Remove `loadEnv({ override: true })` from tests. In `setup.ts`, refuse to run DB-backed tests unless the database name matches `/test/i` and the host is local or CI. Print host, port and database at the start of every DB run.
6. **Targeted test first, then regression.** Reproduce before fixing (a red test on the old code), fix, rerun the targeted test several times, then run the claim-pattern suites (H-01, CC-02, CC-03, CC-06), the related unit specs, `tsc` and lint on changed files.
7. **Never `git add .` in a dirty shared worktree.** Stage explicit paths only, and only files whose whole diff belongs to the commit. Otherwise reconcile first (§7A).
8. **No migrations from unrelated sessions.** Schema or migration changes need an explicit task, their own commit, and a rehearsal on a production snapshot. Resolve H-04 before the next deploy.
9. **Deploy only committed code.** Record the deployed SHA on this board; that SHA is the evidence required to mark a row DEPLOYED.
10. **Update this board** at the end of every remediation: status, test file, suites run, commit SHA, deploy SHA.

<!-- Link references -->
[h01]: ARCHITECTURE_AUDIT.md#h-01-stock-transfers-and-adjustments-without-a-gl-entry-can-be-posted-twice
[h02]: ARCHITECTURE_AUDIT.md#h-02-renumber-tool-rewrites-numbers-of-posted-documents-with-no-transaction
[h03]: ARCHITECTURE_AUDIT.md#h-03-editing-a-posted-cash-voucher-is-split-across-two-transactions
[h04]: ARCHITECTURE_AUDIT.md#h-04-database-migrations-run-automatically-on-api-boot-with-a-hard-coded-rollback-resolve
[h05]: ARCHITECTURE_AUDIT.md#h-05-account-and-cost-center-ledgers-are-unbounded-and-run-under-the-30-s-default-timeout
[h06]: ARCHITECTURE_AUDIT.md#h-06-trial-balance-can-rebuild-all-company-balances-inside-a-report-request
[h07]: ARCHITECTURE_AUDIT.md#h-07-company-wide-bulk-operations-run-synchronously-inside-http-requests
[m01]: ARCHITECTURE_AUDIT.md#m-01-global-get-limit-middleware-silently-caps-list-sizes
[m02]: ARCHITECTURE_AUDIT.md#m-02-request-timeout-answers-408-while-the-work-continues-no-idempotency-keys
[m03]: ARCHITECTURE_AUDIT.md#m-03-activesourcekey-for-stock-documents-uses-a-non-unique-user-entered-serial
[m04]: ARCHITECTURE_AUDIT.md#m-04-missing-uniqueness-constraints-on-document-numbers-and-codes
[m05]: ARCHITECTURE_AUDIT.md#m-05-journal_entry_lines-has-no-company-date-or-cost-center-index
[m06]: ARCHITECTURE_AUDIT.md#m-06-deadlock-and-serialization-errors-p2034-are-not-mapped-or-retried
[m07]: ARCHITECTURE_AUDIT.md#m-07-credit-checks-read-cached-party-balances-two-party-caches-2-decimal-cache-precision
[m08]: ARCHITECTURE_AUDIT.md#m-08-several-reports-load-whole-datasets-or-loop-queries-per-row
[m09]: ARCHITECTURE_AUDIT.md#m-09-inventory-cost-side-paths
[m10]: ARCHITECTURE_AUDIT.md#m-10-tenant-scoping-model-list-is-stale
[m11]: ARCHITECTURE_AUDIT.md#m-11-database-pool-size-is-not-set-explicitly
[m12]: ARCHITECTURE_AUDIT.md#m-12-slow-query-monitor-is-probably-inactive
[m13]: ARCHITECTURE_AUDIT.md#m-13-external-http-calls-have-no-timeouts
[m14]: ARCHITECTURE_AUDIT.md#m-14-frontend-loads-large-master-data-lists-and-filters-whole-reports-in-memory
[l01]: ARCHITECTURE_AUDIT.md#l-01-two-routers-share-apiv1accountingreports
[l02]: ARCHITECTURE_AUDIT.md#l-02-overlapping-api-stacks-for-the-same-resources
[l03]: ARCHITECTURE_AUDIT.md#l-03-some-document-numbers-are-allocated-outside-the-business-transaction
[l04]: ARCHITECTURE_AUDIT.md#l-04-route-level-catch-blocks-bypass-the-central-error-mapping
[l05]: ARCHITECTURE_AUDIT.md#l-05-backend-liveness-check-depends-on-the-database
[l06]: ARCHITECTURE_AUDIT.md#l-06-chart-of-accounts-prefetch-uses-a-different-url-than-the-page
[l07]: ARCHITECTURE_AUDIT.md#l-07-integrity-check-queue-connects-to-redis-at-import-time
[i01]: ARCHITECTURE_AUDIT.md#i-01-manual-journal-unposting-flips-a-posted-entry-back-to-draft
[i02]: ARCHITECTURE_AUDIT.md#i-02-dead-or-retired-code-that-would-be-unsafe-if-revived
[i03]: ARCHITECTURE_AUDIT.md#i-03-delete-cancelled-and-post-all-are-disabled
[i04]: ARCHITECTURE_AUDIT.md#i-04-zod-3-on-the-backend-zod-4-on-the-frontend
[i05]: ARCHITECTURE_AUDIT.md#i-05-no-error-tracking-service-metrics-are-hand-written
[i06]: ARCHITECTURE_AUDIT.md#i-06-mixed-decimal-scales
[cc01]: CORRECTNESS_CONCURRENCY_AUDIT.md#cc-01--posted-cash-voucher-edit-racing-with-unpost-n-02
[cc02]: CORRECTNESS_CONCURRENCY_AUDIT.md#cc-02--invoice-unpost-out-of-transaction-guard-plus-idempotent-reversal-double-reverses-stock-and-party-balances
[cc03]: CORRECTNESS_CONCURRENCY_AUDIT.md#cc-03--pos-order-unpost-same-stale-guard-pattern
[cc04]: CORRECTNESS_CONCURRENCY_AUDIT.md#cc-04--invoice-settlement-over-allocation-double-click-on-settle
[cc05]: CORRECTNESS_CONCURRENCY_AUDIT.md#cc-05--commercial-paper-collect-can-post-twice
[cc06]: CORRECTNESS_CONCURRENCY_AUDIT.md#cc-06--invoice-draft-edit-or-canceldelete-racing-with-post
[cc07]: CORRECTNESS_CONCURRENCY_AUDIT.md#cc-07--manual-journal-draft-edit-or-canceldelete-racing-with-post
[cc08]: CORRECTNESS_CONCURRENCY_AUDIT.md#cc-08--concurrent-manual-journal-unpost-double-inverts-period-balances
[cc09]: CORRECTNESS_CONCURRENCY_AUDIT.md#cc-09--treasury-overdraft-check-is-not-concurrency-safe-n-03
[cc10]: CORRECTNESS_CONCURRENCY_AUDIT.md#cc-10--recalculateitemcosthistory-overwrites-concurrent-postings-lost-update-on-stock-caches
[cc11]: CORRECTNESS_CONCURRENCY_AUDIT.md#cc-11--concurrent-returns-can-exceed-the-original-invoice-quantity
[cc12]: CORRECTNESS_CONCURRENCY_AUDIT.md#cc-12--cheque-clear-and-bounce-can-both-succeed
[cc13]: CORRECTNESS_CONCURRENCY_AUDIT.md#cc-13--other-reversal-flows-with-the-stale-guard--idempotent-reversal-pattern
[cc14]: CORRECTNESS_CONCURRENCY_AUDIT.md#cc-14--create-then-post-split-transactions-duplicate-documents-on-timeoutretry
[cc15]: CORRECTNESS_CONCURRENCY_AUDIT.md#cc-15--year-end--period-close-check-then-act-against-concurrent-posting
[cc16]: CORRECTNESS_CONCURRENCY_AUDIT.md#cc-16--balance-rebuild-runs-concurrently-with-posting
[cc17]: CORRECTNESS_CONCURRENCY_AUDIT.md#cc-17--credit-limit-check-then-act
[cc18]: CORRECTNESS_CONCURRENCY_AUDIT.md#cc-18--lock-order-inversion-between-item_quantities-and-item_warehouse_balances
[cc19]: CORRECTNESS_CONCURRENCY_AUDIT.md#cc-19--duplicate-serials-from-count1--max1-without-a-unique-constraint
[cc20]: CORRECTNESS_CONCURRENCY_AUDIT.md#cc-20--item_cost_historyserial-collision-n-01
[cc21]: CORRECTNESS_CONCURRENCY_AUDIT.md#cc-21--numbers-allocated-outside-the-business-transaction-leave-gaps
[inf]: CORRECTNESS_CONCURRENCY_AUDIT.md#informational
