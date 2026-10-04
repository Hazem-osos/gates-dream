# Gates ERP — Correctness and Concurrency Audit

Status: read-only audit, 2026-09-27. No production code, tests, schema, migrations or configuration were changed to produce it.
Companion documents: `ARCHITECTURE_AUDIT.md` (H-/M-/L-/I- findings), `CURRENT_ARCHITECTURE.md`, `ENGINEERING_CONSTITUTION.md`.
Findings in this document use the prefix **CC-** so they cannot be confused with the architecture audit IDs.

---

## 0. How to read this document

- **Verification status**
  - **Verified** — the failure sequence was traced line by line in the current code by the author of this document.
  - **Verified (mechanism)** — the guard placement and the missing database protection were confirmed in code; the full end-to-end sequence was reasoned, not executed.
  - **Reported** — found by a read-only explorer pass; the mechanism is consistent with verified findings but was not independently re-read line by line. These must be re-confirmed before remediation.
- **Severity** measures business-correctness risk, not the absence of a lock:
  - **HIGH** — realistic sequence (double-click, retry, two users) that silently corrupts money, stock or a legal document, with no automatic detection.
  - **MEDIUM** — realistic sequence that corrupts a derived cache (repairable by a rebuild), or corrupts source data but needs an unusual interleaving.
  - **LOW** — fail-closed (the loser gets an error and nothing is corrupted), cosmetic numbering problems, or very narrow windows.
  - **INFORMATIONAL** — pattern worth knowing; no current realistic corruption.
- **Isolation assumptions** — MySQL/InnoDB REPEATABLE READ. Plain reads inside a transaction are snapshot reads (snapshot fixed at the first plain read). `UPDATE`, `updateMany`, `upsert` and `SELECT … FOR UPDATE` are current reads that see the latest committed row and take row locks. Reads before `prisma.$transaction` see whatever was committed at that instant and protect nothing.

### Scope inspected

| Area | Mutation flows inspected |
|---|---|
| Accounting (journals, reversals, periods, year-end, opening balances, recurring, offsets, securities, commercial paper) | 21 |
| Treasury (cash vouchers, cheques, bank, reconciliation, overdraft) | 28 |
| Inventory (stock documents, costing, opening stock, assembly, landed cost, manufacturing, recalculation) | 18 |
| Sales / purchasing (invoices, POS, settlements, returns, conversions, credit limit, approvals, ETA) | 20 |
| **Mutation flows total** | **87** |
| Document-numbering mechanisms (separately classified in §5) | 44 |

---

## 1. Verification of N-01, N-02, N-03

### N-01 — `item_cost_history.serial` allocated with `MAX(serial)+1` → **CONFIRMED** (see CC-20, LOW)

- `item-cost.service.ts` allocates the serial with `aggregate({ _max: { serial } }) + 1` in three places (~220, ~299, ~416). There is no lock on the item's history rows.
- The schema has `@@unique([companyId, itemId, serial])`, so a collision cannot persist: the second insert gets `P2002` (or a deadlock) and the whole parent posting transaction rolls back (`inventory-costing.service.ts` ~145–170 has no try/catch around `upsertCostSnapshotInTx`).
- Trigger: two postings of the **same item** that commit concurrently (same or different warehouses). Under REPEATABLE READ the `_max` read does not see the other transaction's uncommitted row.
- The serial is only an ordering tie-breaker (`orderBy` ~96); it has no business meaning. Outcome is **fail-closed**: a user sees an error and a retry succeeds. No corruption.
- Related but separate: the snapshot upsert is keyed on the user-entered source number, which is not unique for stock documents (architecture audit M-03). Two documents sharing a serial can overwrite each other's cost snapshot. That is a data-model issue, not a concurrency issue.

### N-02 — Posted cash-voucher edit racing with unpost → **CONFIRMED** (see CC-01, HIGH)

- After the H-03 fix, the edit is one transaction (`treasuryPostingService.updatePostedCashTransaction` → `cashTransactionService.updateInTx` + `rewritePostedCashJournalInTx`). But the decision to take the "rewrite posted voucher" branch, and the `previous` snapshot it uses, are read **before** that transaction (`cash-transaction.routes.ts` PATCH `/:id`).
- `unpostCashTransactionInTx` (~686–757) sets `isPosted = false` **without bumping `version`** and keeps `journalEntryId`.
- If an unpost commits between the route's read and the edit transaction, the edit's `version` check still passes, and the rewrite then reverses `previous` balances a second time, "reverses" an already-reversed journal (the idempotent helper returns the existing reversal instead of failing), posts a new journal and re-applies balances — while the voucher row says **unposted**.
- The opposite order (edit commits first, then unpost) is safe: unpost re-reads the row inside its transaction, and a duplicate reversal is blocked by `JournalEntry.reversalOfJournalEntryId @unique`.

**Proposed deterministic test** (disposable MySQL, same harness as `posted-cash-voucher-edit-atomicity.test.ts`):
1. Fixture: posted receipt of 1000 on a safe.
2. `jest.spyOn(treasuryPostingService, 'resolveTreasuryPostingContext')` (or the posting-mode resolver) so that during the PATCH it awaits a barrier promise **after** the route has loaded `existing`.
3. Start `PATCH /:id` (amount 1000→1200, correct `expectedVersion`); wait until the spy is hit.
4. Call `unpostCashTransaction` directly and await it.
5. Release the barrier; await the PATCH.
6. Assert: PATCH returns 409/422; voucher `isPosted=false`; no un-reversed journal for the voucher; safe balance, supplier/customer balance and period balances equal the pre-post snapshot.
Today step 6 fails (the response is 200 and balances are double-reversed and re-applied).

### N-03 — Concurrent treasury payments overdraw a safe/bank → **CONFIRMED, NARROWER THAN REPORTED** (see CC-09, MEDIUM)

- `treasury-overdraft.ts` reads the fund balance with the global `prisma` client (outside the posting transaction) as `SUM(debitBase − creditBase)` over posted journal lines. It takes no lock.
- In the common path (`postCashTransactionInTx` with automatic GL numbering) `allocateGlNumInTx` runs **before** the check and takes `SELECT … FOR UPDATE` on the `document_sequences` row for company + branch (+ fiscal year unless continuous). That incidentally serialises payments of the **same branch**, so the second payment's check sees the first one's committed journal.
- It is still exposed when:
  - a safe/bank is shared by payments posted from **different branches** (different sequence rows);
  - the company uses the **manual GL numbering** policy (no sequence lock);
  - the **posted-voucher edit** increases the amount (the check runs before any sequence lock);
  - the **create** path's pre-check (`cash-transaction.service.ts` ~195) and settlement/other payment paths where the check precedes the lock.
- Impact: the fund can go negative despite `preventCashOverdraft`. The ledger stays internally consistent (both payments are real, balanced journals); what breaks is a business policy. Hence MEDIUM, not HIGH.

---

## 2. Findings

### CC-01 — Posted cash-voucher edit racing with unpost (N-02)
- **Severity**: HIGH · **Class**: E (posting/edit/unpost state race)
- **Module / files**: Treasury — `treasury/routes/cash-transaction.routes.ts` (PATCH `/:id`), `treasury-posting.service.ts` `updatePostedCashTransaction`, `rewritePostedCashJournalInTx`, `unpostCashTransactionInTx`; `cash-transaction.service.ts` `updateInTx`.
- **Verification**: Verified.
- **Invariant**: a voucher's journal and balance effects exist exactly when `isPosted = true`.
- **Current protection**: optimistic `version` on the edit; out-of-transaction `isPosted` read decides the branch; reversal unique blocks a *concurrent* double reversal.
- **Sequence**: see N-02 above.
- **Resulting corruption**: voucher shows unposted, but a new posted journal exists and safe/party/period balances carry the new amount minus an extra reversal of the old amount. Silent.
- **DB protection**: `reversalOfJournalEntryId @unique` present but bypassed (the helper returns the existing reversal); no conditional predicate on `isPosted` in the edit write; unpost does not bump `version`.
- **Deterministic test**: see N-02.
- **Remediation direction**: make unpost bump `version`, and have `updateInTx` (posted branch) write with `where: { id, version, isPosted: true }`; re-read `previous` inside the transaction.
- **Regression risk**: low — touches only the posted-edit path added in H-03.

### CC-02 — Invoice unpost: out-of-transaction guard plus idempotent reversal double-reverses stock and party balances
- **Severity**: HIGH · **Class**: A (duplicate execution) / E
- **Module / files**: Sales & purchasing — `invoices/services/invoice-posting-orchestrator.ts` `unpost` (~1205–1395); `journal-posting.service.ts` `cascadeSourceJournalInTx`, `reverseJournalEntryInTx`.
- **Verification**: Verified.
- **Invariant**: an invoice's stock movements, party balance, settlements and journals are reversed exactly once per post.
- **Current protection**: `isPosted` checked with the global client **before** `prisma.$transaction` (~1216). Inside the transaction nothing re-checks `isPosted` and the final `tx.invoice.update` is unconditional. The only incidental guard is the reversal unique on the journal.
- **Sequence** (double-click / retry):
  1. Request A and request B both read the invoice: `isPosted = true`.
  2. A's transaction runs: tears down settlements, reverses stock, `cascadeSourceJournalInTx` creates the journal reversal, sets `isPosted = false`, commits.
  3. B's transaction starts after A's commit (B spent time on fiscal-year and permission reads). Its snapshot shows the reversal already exists, so `cascadeSourceJournalInTx` **skips** the journal and raises no conflict.
  4. B reverses stock again (a second `*-UNPOST` inventory movement), reverses party balance again, and sets `isPosted = false`. Commit succeeds.
  - When A and B overlap fully, B fails on the reversal unique and rolls back — so only the "B starts after A commits" interleaving corrupts, which is exactly what a double-click with ~200 ms spacing produces.
  - If the company flag `GLUnPost` is off, there is no journal step at all and both interleavings corrupt.
- **Resulting corruption**: duplicate inventory movements (source-of-truth ledger), stock quantity and cost wrong, customer/supplier balance wrong by one invoice total, settlement teardown applied twice. For PURCHASE, the post-commit `recalculateItemCostHistory` then rebuilds cost from the corrupted movement ledger. Silent.
- **DB protection**: missing — no conditional state transition on `invoice`.
- **Deterministic test**: spy on `companySettingService.getFlag` or the fiscal-year lookup inside `unpost` to hold request B before its transaction; run request A to completion; release B. Assert B gets 400/409, exactly one `*-UNPOST` movement per line, and item quantity and party balance equal the pre-post values.
- **Remediation direction**: first statement inside the transaction: `updateMany({ where: { id, companyId, isPosted: true }, data: { isPosted: false, … } })` and throw on `count === 0` — the invoice counterpart of `claimDocumentUnpost` (H-01 pattern).
- **Regression risk**: low–medium — unpost also feeds the repost/edit flows; the claim must not break "unpost then edit".

### CC-03 — POS order unpost: same stale-guard pattern
- **Severity**: HIGH · **Class**: A / E
- **Module / files**: POS — `pos/services/pos-order-posting.service.ts` `unpostOrder` (~382–470).
- **Verification**: Verified (mechanism).
- **Invariant**: a POS order's stock, safe/bank, shift totals and customer balance are reversed once.
- **Current protection**: `order.status !== 'POSTED'` checked before the transaction; final `tx.posOrder.update` to `DRAFT` is unconditional; `reverseJournalEntryInTx` returns an existing reversal instead of failing.
- **Sequence**: as CC-02. Request B's transaction begins after A commits → `reverseJournalEntryInTx` returns A's reversal → B posts reversing stock movements, decrements safe/bank and shift totals and customer balance again.
- **Resulting corruption**: cash drawer (safe) and shift totals short by one order, stock over-restored, customer balance wrong. Silent; visible only at shift close as an unexplained difference.
- **DB protection**: missing.
- **Deterministic test**: hold B via a spy on the shift/order lookup before `$transaction`; complete A; release B; assert rejection and single reversal.
- **Remediation direction**: conditional `updateMany({ where: { id, status: 'POSTED' } })` claim first in the transaction.
- **Regression risk**: low.

### CC-04 — Invoice settlement over-allocation (double-click on "settle")
- **Severity**: HIGH · **Class**: C (check-then-act) / A
- **Module / files**: `invoices/services/invoice-settlement.service.ts` settle (~252–354).
- **Verification**: Verified (mechanism).
- **Invariant**: `paidAmount ≤ netAmount`; each settlement corresponds to exactly one intended receipt/payment.
- **Current protection**: outstanding amount computed from a global-client read **before** `prisma.$transaction` (~274); no lock, no conditional update on `paidAmount`.
- **Sequence**: two settle requests for the full outstanding amount arrive together (double-click, or cashier + collector). Both read outstanding = 1000, both pass, both create a posted cash voucher and increment `paidAmount`.
- **Resulting corruption**: two real receipts (safe/bank and party balance moved twice), `paidAmount = 2 × net`. The duplicate voucher is visible in lists, so it is detectable, but nothing flags it.
- **DB protection**: missing (no `CHECK paidAmount <= netAmount`, no conditional increment).
- **Deterministic test**: two concurrent calls with a barrier after the outstanding check (spy on the first in-transaction helper); assert exactly one succeeds and `paidAmount ≤ netAmount`.
- **Remediation direction**: inside the transaction, `updateMany({ where: { id, paidAmount: { lte: net − amount } }, data: { paidAmount: { increment: amount } } })` and throw on `count === 0`, or `SELECT … FOR UPDATE` the invoice first.
- **Regression risk**: low.

### CC-05 — Commercial-paper collect can post twice
- **Severity**: HIGH · **Class**: A
- **Module / files**: `accounting/services/commercial-paper-posting.service.ts` `collectPaper` (~643–715).
- **Verification**: Verified (mechanism).
- **Invariant**: a paper moves ISSUED → COLLECTED once, with one collection journal.
- **Current protection**: `paperCase !== ISSUED` checked before the transaction; the journal is created with `claimActiveSourceKey: false`, so the `activeSourceKey` unique does not apply; the state update is unconditional.
- **Sequence**: double-click on "collect". Both requests see ISSUED; both transactions create a collection journal (debit bank, credit notes receivable) and set COLLECTED.
- **Resulting corruption**: bank and notes-receivable balances moved twice; two posted journals for one paper. Silent.
- **DB protection**: missing.
- **Deterministic test**: two concurrent collects with a barrier after the pre-check; assert one journal and one state change.
- **Remediation direction**: conditional `updateMany({ where: { id, paperCase: ISSUED } })` claim first in the transaction.
- **Regression risk**: low.

### CC-06 — Invoice draft edit (or cancel/delete) racing with post
- **Severity**: HIGH · **Class**: E
- **Module / files**: `invoices/services/invoice-m5.service.ts` update (~734–1098, write ~1014); `invoice-posting-orchestrator.ts` post claim (~573).
- **Verification**: Verified.
- **Invariant**: the lines of a posted invoice are exactly the lines that produced its stock movements and journal.
- **Current protection**: the post claim is a correct conditional `updateMany({ isPosted: false, isCancelled: false })`, but it **does not bump `version`**. The edit's final write is `updateMany({ where: { id, companyId, version } })` with no `isPosted: false` predicate. The edit's `isPosted` check is a snapshot/early read.
- **Sequence**: user A opens the draft and saves an edit; user B (poster/approver) posts. B's transaction commits between A's read and A's write. A's `version` still matches, so A overwrites lines, totals and party of an invoice that is now posted.
- **Resulting corruption**: the posted invoice (a tax document; possibly already queued for ETA) no longer matches its journal, stock movements or party balance. Silent. The same shape applies to cancel/delete-draft against post (reported).
- **DB protection**: missing.
- **Deterministic test**: hold the edit after its initial read (spy on a validation helper such as `assertNoOverReturn` or the price resolver), post the invoice, release the edit; assert the edit returns 409 and posted lines are unchanged.
- **Remediation direction**: bump `version` in the post claim and add `isPosted: false` to the edit/cancel/delete write predicates.
- **Regression risk**: low–medium — clients that post and then immediately edit with a cached version will now get 409 (correct behaviour).

### CC-07 — Manual journal draft edit (or cancel/delete) racing with post
- **Severity**: MEDIUM · **Class**: E
- **Module / files**: `accounting/services/journal-posting.service.ts` `updateJournalEntry` (~813–980, write ~944), `postJournalEntry` claim (~1113).
- **Verification**: Verified.
- **Invariant**: a posted journal's lines are the lines whose amounts were applied to period balances.
- **Current protection**: post claim conditional on `isPosted: false` but **no `version` bump**; edit write keyed on `version` only.
- **Sequence**: as CC-06 with a manual journal.
- **Resulting corruption**: journal lines (source of truth) differ from the period-balance deltas applied at post; trial balance from caches diverges from the ledger. Silent, repairable by a balance rebuild once noticed.
- **DB protection**: missing.
- **Deterministic test**: as CC-06 with journals.
- **Remediation direction**: `version: { increment: 1 }` in the post claim; `isPosted: false` in edit/cancel/delete predicates.
- **Regression risk**: low. Severity is MEDIUM rather than HIGH because manual journals are usually authored and posted by the same person, and caches are rebuildable.

### CC-08 — Concurrent manual journal unpost double-inverts period balances
- **Severity**: MEDIUM · **Class**: A / E
- **Module / files**: `journal-posting.service.ts` `unpostJournalEntry` (~1180–1269). (Related to architecture audit I-01.)
- **Verification**: Verified.
- **Invariant**: period balances are inverted once per unpost.
- **Current protection**: `isPosted` re-read **inside** the transaction (snapshot read) — this protects the "second request starts after first commits" case. The final update is unconditional; no reversal row is created, so the reversal unique does not help.
- **Sequence**: two overlapping unpost requests both snapshot-read `isPosted = true`; both call `applyPostedJournalBalancesInTx(invert)`; the second blocks on the balance row lock, then proceeds after the first commits; both set `isPosted = false`.
- **Resulting corruption**: account/cost-center period balances inverted twice (journal lines themselves unchanged). Trial balance and balance-sheet caches wrong until rebuilt.
- **DB protection**: missing.
- **Deterministic test**: barrier inside the transaction after the `isPosted` read (spy on `applyPostedJournalBalancesInTx`) for both requests; assert one fails and balances equal the pre-post state.
- **Remediation direction**: replace the unconditional final update with a conditional `updateMany({ where: { id, isPosted: true } })` executed **first**.
- **Regression risk**: low.

### CC-09 — Treasury overdraft check is not concurrency-safe (N-03)
- **Severity**: MEDIUM · **Class**: C
- **Module / files**: `treasury/services/treasury-overdraft.ts`, `treasury/services/fund-ledger-balance.ts`; callers in `treasury-posting.service.ts`, `cash-transaction.service.ts` (~195), settlement/payment paths.
- **Verification**: Verified.
- **Invariant**: with `preventCashOverdraft` on, a safe/bank never goes below zero.
- **Current protection**: unlocked balance read (global client); same-branch automatic-GL posts are incidentally serialised by the GL sequence lock.
- **Sequence**: safe balance 1000, shared by branches A and B. A payment of 800 from each branch posts concurrently; each reads 1000, both pass, both commit → −600.
- **Resulting corruption**: policy violation; ledger remains balanced.
- **DB protection**: missing (by design the balance is derived).
- **Deterministic test**: two branches, one shared safe; barrier after the overdraft check in both; assert one is rejected.
- **Remediation direction**: `SELECT … FOR UPDATE` on the `safes`/`bank_accounts` row inside the posting transaction before computing the balance.
- **Regression risk**: medium — adds a hot lock per fund; must keep lock order consistent with other posting locks.

### CC-10 — `recalculateItemCostHistory` overwrites concurrent postings (lost update on stock caches)
- **Severity**: MEDIUM · **Class**: B (lost update) / G
- **Module / files**: `inventory/services/inventory-costing.service.ts` `recalculateItemCostHistory` (~371), `recalculateOneItemInTx` (~393); invoked automatically after every PURCHASE unpost (`invoice-posting-orchestrator.ts` post-commit) and by admin tools.
- **Verification**: Verified (mechanism).
- **Invariant**: `item_warehouse_balances` / `item_quantities` equal the replay of `inventory_movements`.
- **Current protection**: per-item transaction (120 s timeout); movements read with a plain (snapshot) `findMany`; balances written with SET semantics.
- **Sequence**: recalculation of item X reads the movement ledger; a sale of X commits a new movement and its balance update; recalculation then writes its replayed quantity (which excludes the sale) over the balance row.
- **Resulting corruption**: on-hand quantity and average cost cache miss the concurrent movement until the next recalculation. Negative-stock checks and valuation reports use the wrong number. Ledger intact.
- **DB protection**: missing.
- **Deterministic test**: spy on the replay step to pause after the `findMany`; post a sale of the same item; release; assert balance equals ledger replay.
- **Remediation direction**: lock the item's balance rows (`FOR UPDATE`, in canonical order) **before** reading movements inside the recalculation transaction.
- **Regression risk**: medium — long transactions holding hot locks; batch size matters.

### CC-11 — Concurrent returns can exceed the original invoice quantity
- **Severity**: MEDIUM · **Class**: C
- **Module / files**: `invoices/services/invoice-m5-integrity.service.ts` `assertNoOverReturn` (~101–160); callers `invoice-m5.service.ts` ~538, ~962.
- **Verification**: Verified (mechanism).
- **Invariant**: total returned quantity per original line ≤ original quantity.
- **Current protection**: check inside the create/update transaction using plain `findMany` + `groupBy` (snapshot reads, no lock).
- **Sequence**: two users create returns of 10 units against a 10-unit sale at the same time; each sees 0 already returned; both commit.
- **Resulting corruption**: 20 units returned (stock and customer credit inflated once both are posted).
- **DB protection**: missing.
- **Deterministic test**: two concurrent return creates with a barrier after the `groupBy`; assert one fails.
- **Remediation direction**: `SELECT … FOR UPDATE` on the original invoice row at the start of return create/update/post.
- **Regression risk**: low.

### CC-12 — Cheque clear and bounce can both succeed
- **Severity**: MEDIUM · **Class**: E
- **Module / files**: `treasury/services/cheque-lifecycle.service.ts` `clearInwardCheque` (~292), `bounceInwardCheque` (~404) and the other transitions.
- **Verification**: Verified (mechanism).
- **Invariant**: a cheque takes exactly one terminal transition from SENT_TO_BANK.
- **Current protection**: `assertChequeTransition` on a pre-transaction read; the status update is unconditional; clear (`CKC`) and bounce (`CKB`) journals use different source types, so `activeSourceKey` does not collide.
- **Sequence**: one user clears, another bounces the same cheque at the same time; both pass the pre-check; both post journals; last writer sets the status.
- **Resulting corruption**: bank debited by the clear and customer re-charged by the bounce; status shows only one outcome.
- **DB protection**: missing.
- **Deterministic test**: barrier after `assertChequeTransition` in both calls; assert exactly one journal.
- **Remediation direction**: conditional `updateMany({ where: { id, status: <expected> } })` claim first in each transition.
- **Regression risk**: low.

### CC-13 — Other reversal flows with the stale-guard + idempotent-reversal pattern
- **Severity**: MEDIUM · **Class**: A / E
- **Module / files**: counterparty offset reverse (`counterparty-offset.service.ts`), securities renewal unpost (`securities-renewal.service.ts`), commercial-paper unpost (`commercial-paper-posting.service.ts`), opening-stock unpost followed by cancel (`opening-stock.service.ts`).
- **Verification**: Reported (the shared mechanism is verified in CC-02/CC-03).
- **Invariant**: party/stock effects reversed once.
- **Sequence**: pre-transaction state check; second request's transaction starts after the first commits; `reverseJournalEntryInTx` returns the existing reversal; party-balance (or stock) side effects are applied again. For opening stock, "unpost" then "cancel" is reported to reverse quantities a second time even sequentially.
- **Resulting corruption**: party balances (or opening quantities) wrong by one document.
- **DB protection**: missing.
- **Deterministic test**: same barrier technique as CC-02.
- **Remediation direction**: same conditional claim pattern; additionally make `reverseJournalEntryInTx`'s "already reversed" branch return a flag that callers treat as "stop, do not apply side effects".
- **Regression risk**: low per flow.

### CC-14 — Create-then-post split transactions duplicate documents on timeout/retry
- **Severity**: MEDIUM · **Class**: F (split transaction) / H (timeout/retry)
- **Module / files**: `treasury/routes/cash-transaction.routes.ts` (~113: create, then `postCashTransaction` in a second transaction); invoice create-and-post paths (reported). Related to architecture audit M-02.
- **Verification**: Verified for cash vouchers; Reported for invoices.
- **Invariant**: one user action creates one document.
- **Sequence**: create commits; post is slow; the 408 request timeout fires; the client retries the whole "save and post"; a second draft (and a second posted voucher) is created. Or post fails validation and leaves an orphan draft the user does not know exists.
- **Resulting corruption**: duplicate posted vouchers (safe/party moved twice) or orphan drafts.
- **DB protection**: missing (no idempotency key).
- **Deterministic test**: force `postCashTransaction` to reject after create; assert no draft remains (or that the response returns the draft id).
- **Remediation direction**: run create + post in one transaction via existing `*InTx` methods; add an idempotency key for save-and-post endpoints.
- **Regression risk**: medium.

### CC-15 — Year-end / period close check-then-act against concurrent posting
- **Severity**: MEDIUM · **Class**: C
- **Module / files**: `accounting/services/period.service.ts`, year-end closing service (reported).
- **Verification**: Reported.
- **Invariant**: no journal is posted into a period after it is closed; closing entries include every posted line.
- **Sequence**: closing computes balances and marks the period closed while a posting (which checked "period open" before its transaction) commits into that period.
- **Resulting corruption**: a posted journal in a closed period not included in closing entries; retained earnings off by that amount.
- **DB protection**: missing (period open check is an application pre-check).
- **Deterministic test**: barrier in the posting after the open-period check; close the period; release; assert the posting is rejected.
- **Remediation direction**: lock the period/fiscal-year row `FOR SHARE` in postings and `FOR UPDATE` in close.
- **Regression risk**: medium (adds a lock to every posting).

### CC-16 — Balance rebuild runs concurrently with posting
- **Severity**: MEDIUM · **Class**: G / B
- **Module / files**: `rebuildCompanyBalances` (accounting), `resyncCache` paths; triggered from reports (architecture audit H-06) and admin tools.
- **Verification**: Reported (H-06 verified the trigger; the lost-update interleaving is by construction).
- **Invariant**: period-balance caches equal the ledger.
- **Sequence**: rebuild deletes/recomputes caches from a snapshot; a concurrent post increments a cache row; rebuild's write overwrites the increment.
- **Resulting corruption**: cache missing the concurrent journal until the next rebuild.
- **Remediation direction**: move rebuild out of request paths (H-06) and take a company-level advisory lock (`GET_LOCK`) shared with posting, or rebuild into a shadow table and swap.
- **Regression risk**: medium.

### CC-17 — Credit-limit check-then-act
- **Severity**: LOW · **Class**: C
- **Module / files**: `party-credit.service.ts` and invoice/POS posting callers. Related to M-07.
- **Verification**: Reported.
- **Sequence**: two invoices for the same customer post together; each sees headroom; both pass; limit exceeded.
- **Resulting corruption**: policy breach only; ledger correct.
- **Remediation direction**: `FOR UPDATE` on the customer row before the credit check.
- **Regression risk**: low.

### CC-18 — Lock-order inversion between `item_quantities` and `item_warehouse_balances`
- **Severity**: LOW · **Class**: I
- **Module / files**: `inventory-costing.service.ts` `readCostSnapshot` (IQ then IWB) vs `stock-movement.service.ts` `postMovementInTx` (IWB then IQ); some multi-line documents do not use `sortForStockLocking`.
- **Verification**: Verified (mechanism).
- **Sequence**: two postings touching the same item/warehouse enter the two helpers in opposite order → deadlock → one transaction is rolled back.
- **Resulting corruption**: none (fail-closed); user-visible error, amplified because P2034 is not mapped or retried (M-06).
- **Remediation direction**: single lock order (IWB then IQ, sorted) in all helpers.
- **Regression risk**: low.

### CC-19 — Duplicate serials from `count()+1` / `MAX+1` without a unique constraint
- **Severity**: LOW · **Class**: D
- **Module / files**: `assembly.service.ts` ~135, `disassembly.service.ts` ~135 (`count()+1`), `opening-stock.service.ts` `nextOpeningSerial` ~87–103, customer/supplier `nextNumericCode`, item/delegate/warehouse code suggestion.
- **Verification**: Verified (assembly/disassembly/opening stock); Reported (codes).
- **Sequence**: two concurrent creates both compute `ASM-2026-0007`; both insert. `count()+1` also repeats a number **without concurrency** once any row in the year has been deleted.
- **Resulting corruption**: duplicate human-facing numbers; for stock documents the second GL post then fails on `activeSourceKey` (M-03) — fail-closed but blocks posting.
- **DB protection**: missing (M-04).
- **Remediation direction**: allocate through `documentSequenceService.nextNumberInTx` and add composite uniques after de-duplicating existing data.
- **Regression risk**: medium (data clean-up required before uniques).

### CC-20 — `item_cost_history.serial` collision (N-01)
- **Severity**: LOW · **Class**: D
- **Verification**: Verified. Details in §1.
- **Resulting corruption**: none; the posting fails and can be retried.
- **Remediation direction**: order by `(transactionDate, createdAt, id)` and drop the serial allocation, or allocate under a lock on the item row.
- **Regression risk**: low.

### CC-21 — Numbers allocated outside the business transaction leave gaps
- **Severity**: LOW · **Class**: F / D
- **Module / files**: `journal-posting.service.ts` `createJournalEntry` ~309 (`nextGlNumber`), payroll, POS shift, tuition, unit contract, tax declaration, LC/LG, manufacturing, contracting, subcontract, real-estate posting; securities receipt/payment/renewal (`nextNumberForFamily`). Same as architecture audit L-03, now enumerated.
- **Verification**: Verified (journal); Reported (others).
- **Sequence**: sequence transaction commits number N; the business transaction fails; N is never used.
- **Resulting corruption**: gaps in GL/voucher numbering (an audit/tax presentation issue); no duplicates because uniques exist.
- **Remediation direction**: switch to the `*InTx` variants inside the existing business transaction.
- **Regression risk**: low.

### Informational

- **INF-1 — `reverseJournalEntryInTx` idempotency hides duplicate unposts.** Its "already reversed → return existing" branch is the common root of CC-01, CC-02, CC-03 and CC-13. Concurrent duplicates are rescued by `reversalOfJournalEntryId @unique`, but the "second transaction starts after first commit" interleaving is not. Any new unpost flow must claim its own state first.
- **INF-2 — Cash-voucher unpost is safe only because it re-reads `isPosted` inside the transaction.** Keep that shape.
- **INF-3 — Landed-cost unpost reported to reverse using current on-hand quantity** rather than the quantity at application time. Correctness logic, not concurrency; verify under M-09.
- **INF-4 — Manufacturing finished-goods warehouse moving-average cost reported as skipped** on some paths. Extends M-09.
- **INF-5 — Approval workflow state stored as a JSON column** is read–modify–written; concurrent approvals can lose one approver's step (reported).
- **INF-6 — ETA POS receipt hash reported unstable** across retries (field ordering), which could produce duplicate submissions.
- **INF-7 — `JournalEntry.voucherNumber`, `PurchaseOrder.orderNumber`, `PriceQuote.quoteNumber`, `PosShift.shiftNumber`, `Employee.serial`** accept client-supplied duplicates (no unique). Display/reference numbers only.

---

## 3. Verified-safe flows (for contrast)

| Flow | Why it is safe |
|---|---|
| Invoice post | Conditional claim `updateMany({ isPosted: false, isCancelled: false })` first in the transaction (`invoice-posting-orchestrator.ts` ~573). |
| Stock transfer / adjustment / other adjustment post and unpost | `claimDocumentPost` / `claimDocumentUnpost` first in the transaction (H-01 fix, with integration test). |
| Receipt / issue post | `activeSourceKey` unique on the GL entry plus claim. |
| Manual journal post | Conditional `updateMany({ isPosted: false })` (~1113); loser gets 409. |
| Cash voucher post | Row re-read in the transaction; `if (row.isPosted) return row`; `activeSourceKey` unique on the journal. |
| Cash voucher unpost | `isPosted` re-read inside the transaction; duplicate reversal blocked by `reversalOfJournalEntryId @unique`. |
| Posted cash-voucher edit atomicity | Single transaction since H-03 (race with unpost remains: CC-01). |
| Journal reversal (concurrent duplicates) | `reversalOfJournalEntryId @unique` → P2002 → rollback. |
| GL number allocation in-transaction | `nextGlNumberInTx` → `SELECT … FOR UPDATE` on `document_sequences` + `@@unique([companyId, branchId, fiscalYearId, legacyGlNum])`. |
| Invoice and cash-voucher numbering | `nextNumberForFamilyInTx` / `nextNumberInTx` inside the create transaction + document uniques. |
| Account / party / fund balance caches on post | Atomic `increment` and `INSERT … ON DUPLICATE KEY UPDATE` (no read–modify–write). |

---

## 4. Application pre-check vs database-enforced invariant

| Invariant | Enforced by the database? | Mechanism / gap |
|---|---|---|
| A source document has at most one active GL entry | **Yes** | `JournalEntry.activeSourceKey @unique` — except paths using `claimActiveSourceKey: false` (commercial paper collect, reversals by design). |
| A journal is reversed at most once | **Yes** | `reversalOfJournalEntryId @unique`. |
| GL numbers unique per company/branch/year | **Yes** | Composite unique on `legacyGlNum`. |
| Invoice numbers unique | **Yes** | Composite unique incl. `invoiceType`. |
| Treasury voucher numbers unique | **Yes** | `@@unique([companyId, voucherNumber])`. |
| `item_cost_history` serial unique | **Yes** | `@@unique([companyId, itemId, serial])` (makes N-01 fail-closed). |
| Document posted once | **Conditional** | Only where a conditional `updateMany` claim exists (invoice post, journal post, H-01 documents). Elsewhere a pre-check only. |
| Document unposted once | **No** (most flows) | Pre-check only for invoice, POS, paper, offsets, renewals; manual journal unpost has an in-transaction snapshot check only. |
| Posted document is immutable | **No** | Edit writes are keyed on `version` without `isPosted: false`; posts do not bump `version` (CC-06, CC-07). |
| `paidAmount ≤ netAmount` | **No** | Pre-check before the transaction (CC-04). |
| Returned quantity ≤ original | **No** | Snapshot check, no lock (CC-11). |
| Fund balance ≥ 0 when overdraft is prevented | **No** | Unlocked derived read (CC-09). |
| Credit limit | **No** | Cached balance read, no lock (CC-17, M-07). |
| Stock quantity ≥ 0 when negative stock is disallowed | **Yes, in practice** | Checked after `FOR UPDATE` on balance rows inside the posting transaction. |
| Balance caches = ledger | **No** | Maintained by atomic increments; can be overwritten by rebuild/recalculate (CC-10, CC-16). |
| Period closed ⇒ no postings | **No** | Pre-check (CC-15). |
| Stock document serials, party/item codes unique | **No** | M-04; CC-19. |

---

## 5. Document numbering classification (44 mechanisms)

| Class | Count | Examples |
|---|---|---|
| SAFE | ~12 | `document_sequences` allocator; in-transaction GL numbers; invoice numbers (sequence and document profile); cash vouchers; commercial-paper batch receipts; payroll run period key; UUID identifiers (movements, activity logs, ETA UUID). |
| CONDITIONALLY SAFE | ~16 | `MAX+1` or client-supplied numbers **with** a unique constraint (collision → P2002, retry works): item cost history serial, currency serial, safe/bank codes, account and cost-center codes, cheque numbers, POS order numbers, production orders, contracts, student codes, subcontract and client-invoice numbers, legacy treasury create, counterparty offset (sequence but no unique). |
| UNSAFE | ~16 | Allocated outside the business transaction (gaps: manual journal create and ~12 module posting services, securities receipt/payment/renewal); no unique at all (stock document serials, opening stock, assembly, disassembly, customer/supplier/item/delegate/warehouse codes, employee serial, PO/quote numbers, POS shift number, `JournalEntry.voucherNumber`). |

The canonical correct pattern today is: `documentSequenceService.next*InTx(tx, …)` inside the same `prisma.$transaction` that inserts the document, plus a composite `@@unique` on the number.

---

## 6. Findings by failure class

| Class | Findings |
|---|---|
| A — Duplicate execution | CC-02, CC-03, CC-04, CC-05, CC-08, CC-13 |
| B — Lost update | CC-10, CC-16, INF-5 |
| C — Check-then-act race | CC-04, CC-09, CC-11, CC-15, CC-17 |
| D — Number allocation race | CC-19, CC-20, CC-21 |
| E — Posting/edit/unpost state race | CC-01, CC-02, CC-03, CC-06, CC-07, CC-08, CC-12, CC-13 |
| F — Split transaction | CC-14, CC-21 |
| G — Cache / source-of-truth divergence | CC-10, CC-16 |
| H — Timeout / retry duplication | CC-14, INF-6 |
| I — Other | CC-18, INF-1, INF-3, INF-4 |

Dangerous code shapes observed (§3 of the request):
1. State guard read with the global client before `prisma.$transaction`, followed by an unconditional `update` (CC-02, CC-03, CC-05, CC-12, CC-13).
2. Optimistic `version` check on edits while the competing state transition (post/unpost) does not bump `version` (CC-01, CC-06, CC-07).
3. Idempotent "already done → return" helpers that let callers continue with side effects (INF-1).
4. Aggregate `_max`/`count()` + 1 for numbering (CC-19, CC-20).
5. Snapshot `findMany`/`groupBy` used as a limit check without a lock (CC-10, CC-11).
6. Derived balance reads outside the transaction used for policy checks (CC-09, CC-17).
7. Two separate `$transaction` calls for one user action (CC-14, CC-21).

---

## 7. Remediation order

Ranked by likelihood × financial/stock impact × silence × blast radius, adjusted for ease of a deterministic test and regression risk. Performance is out of scope.

| Rank | Finding | Why here |
|---|---|---|
| 1 | **CC-02** Invoice unpost claim | Highest-volume document; double-click is enough; corrupts the stock ledger and party balances silently; one conditional `updateMany` (H-01 pattern) with a straightforward barrier test. |
| 2 | **CC-03** POS unpost claim | Same fix shape; cash drawer impact; small blast radius. |
| 3 | **CC-01** Posted cash edit vs unpost (N-02) | Silent money corruption; fix is local to the H-03 code; test already designed. |
| 4 | **CC-05** Commercial-paper collect claim | Double-click → double bank posting; tiny change. |
| 5 | **CC-04** Settlement over-allocation | Double-click → two real receipts; conditional increment. |
| 6 | **CC-06** Invoice edit/cancel vs post | Needs two actors but corrupts a tax document; bump `version` on post + `isPosted` predicate. |
| 7 | **CC-12** Cheque cross-transitions | Conditional status claims. |
| 8 | **CC-13** Remaining reversal flows | Re-verify each, then apply the same claim; consider INF-1 helper change. |
| 9 | **CC-07, CC-08** Manual journal edit/unpost | Cache-only corruption, rebuildable. |
| 10 | **CC-11** Over-return lock | Low frequency, clear fix. |
| 11 | **CC-14** Create-and-post in one transaction + idempotency key | Larger change; pairs with M-02. |
| 12 | **CC-10, CC-16** Recalculate/rebuild locking | Requires lock design; pairs with H-06/H-07. |
| 13 | **CC-09, CC-15, CC-17** Policy checks (overdraft, period close, credit) | Add hot-row locks; measure contention first. |
| 14 | **CC-18, CC-19, CC-20, CC-21** Lock order and numbering | Fail-closed or cosmetic; CC-19 needs data clean-up before uniques. |

**Recommended next single finding: CC-02 (invoice unpost claim).**
