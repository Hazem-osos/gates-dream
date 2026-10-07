# Gates ERP — Accounting Risk Register (read-only audit)

**Legend:** CONFIRMED = traced in code; SUSPECTED = plausible without runtime proof.

---

## CRITICAL

| ID | Title | Behavior | Why it matters | Modules | Evidence | Scenario | Status |
|----|-------|----------|----------------|---------|----------|----------|--------|
| C1 | Stock posted without GL (periodic / skip paths) | `runStockGlPostingOptional` still used when inventory system is PERIODIC; missing accounts log warn and commit stock | Warehouse valuation ≠ GL inventory | Inventory GI/GR/… | `stock-gl-posting-guard.ts`, store services | Post GI with no expense account on periodic company | CONFIRMED (periodic); PERPETUAL now blocks |
| C2 | Invoice posted with stock but GL disabled | Orchestrator can skip `createGl` while executing stock loop in same tx | Revenue/COGS missing while qty moves | Sales/Purchase invoices | `invoice-posting-orchestrator.ts` `createGl` / settings | `notCreateGL` or txn setting | CONFIRMED |
| C3 | Trial balance cache vs live divergence | Default TB reads `account_period_balances`; filters force live path | Same account total differs by report screen | Financial reports | `financial-report.service.ts` `usesLiveJournalSum` | TB with branch filter vs without | CONFIRMED |

---

## HIGH

| ID | Title | Behavior | Why it matters | Modules | Evidence | Scenario | Status |
|----|-------|----------|----------------|---------|----------|----------|--------|
| H1 | Party card cache vs partner ledger | POS/treasury/cheque JEs use `skipCardColumns` + partner-line card sync; UI credit reads `partner_running_balances` | Legacy cache may drift until heal/resync | POS, Treasury, AR | `party-ledger-balance.service.ts`, `treasury-posting.service.ts`, `cheque-lifecycle.service.ts` | Credit workspace / voucher post vs كشف الحساب | MITIGATED |
| H2 | Dual cheque / commercial paper engines | `commercial-paper-posting.service` and `cheque-lifecycle.service` both post CK/SEC journals; cheque lifecycle now mirrors paper card sync | Inconsistent lifecycle if mixed APIs | Treasury, Securities | Both import `commitInTx` with `skipCardColumns` | Same paper via different UIs | CONFIRMED (card sync aligned on cheque path) |
| H3 | Opening stock qty before GL | Quantities applied at **create**; GL at **post** may have been skipped historically | Inventory exists without OB JE | Opening stock | `opening-stock.service.ts` create vs post | Create OB stock, post without accounts | CONFIRMED |
| H4 | Sourced JE unpost in-place (no contra) | `unpostSourceJournalInTx` / `reverseJournalEntryInTx` invert caches, `isPosted=false`; voucher kept for audit. POS void was creating `POS-VOID` contra — **fixed** | Auditors see same voucher # unposted/ملغي, not a second JE | All sourced docs, POS | `journal-posting.service.ts`, `pos-order-posting.service.ts` | Unpost invoice or void POS — zero `reversalOfJournalEntryId` children | STANDARD (Gates policy) |
| H5 | Legacy inventory `invoice.service` path | Parallel post/unpost still calls cascade GL | Two invoice stacks if old API used | Inventory invoices | `inventory/services/invoice.service.ts` | Legacy route vs M5 | CONFIRMED |
| H6 | Commercial paper unpost cache gap | Was: cascade unpost skipped ambiguous account-level card reversal; party lines had `partnerId` but cards were not synced on unpost/cancel. **Mitigated:** post/unpost/cancel use `skipCardColumns` + `syncCommercialPaperJournalCardCachesInTx` (partner lines + treasury card pass) | Party/paper balance drift | Securities | `commercial-paper-posting.service.ts`, `ledger-balance.service.ts` | Unpost/cancel issue or collect on shared AR | MITIGATED |
| H7 | Allocation + double settlement | Settlement teardown on unpost; concurrent pay needs claim | Over-application to invoice | AR, Treasury | `invoice-settlement.service`, integration tests exist | Two tabs pay same invoice | MOSTLY PROTECTED — verify runtime |

---

## MEDIUM

| ID | Title | Behavior | Why it matters | Modules | Evidence | Scenario | Status |
|----|-------|----------|----------------|---------|----------|----------|--------|
| M1 | `customer.balance` authoritative misuse | Credit/quick summary/POS credit use partner ledger; cache auto-healed on POS credit load; reconciliation resync uses `partner_running_balances` | List/export may still show cache column | AR | `party-credit.service.ts`, `party-quick-summary.service.ts` | Customer picker export balance | PARTIALLY MITIGATED |
| M2 | FX gain only on settlement | `postFxDifferenceInTx` on pay; no global unrealized reval job found | Period-end FX exposure not in GL | Multi-currency | `invoice-settlement.service.ts`; no reval grep | USD invoice unpaid month-end | CONFIRMED |
| M3 | Purchase VAT input falls back to output account keys | Resolver aliases `vatInput` to output keys | Misclassification risk | Purchases | `gl-account-resolver.service.ts` 77–82 | Single VAT account in defs | CONFIRMED |
| M4 | Cost center transfer rewrites history | `transferCostCenterMovement` updates line `costCenterId` | Reports change retroactively | Cost centers | `cost-center-movement.service.ts` | Transfer CC on past month | CONFIRMED (by design) |
| M5 | Posted manual JE edit blocked; sourced uses reuse/replace | Different mutation surfaces | User confusion | GL | `journal-entry.service.ts`, `reuseSourceJournalInTx` | Edit posted manual vs voucher | CONFIRMED |
| M6 | MAC recalc after purchase unpost outside tx | Orchestrator notes post-commit recalc | Cost history lag | Inventory costing | `invoice-posting-orchestrator.ts` unpost tail | Unpost backdated PI | CONFIRMED |
| M7 | Database tools approve-documents | Direct `journalEntry.updateMany` | Ops bypass normal workflow | Admin tools | `approve-documents.service.ts` | Support tool misuse | CONFIRMED |
| M8 | Auto-GL gated on `autoPostGl` + rights | Document posts but no JE if disabled | Operational surprise | Many | `auto-gl-posting.service.ts` `isAutoPostEnabled` | Company flag off | CONFIRMED |

---

## LOW

| ID | Title | Behavior | Modules | Evidence | Status |
|----|-------|----------|---------|----------|--------|
| L1 | Opening balance draft allows unbalanced save | Opening only | `opening-balance.service.ts` `isOpeningBalanceDraft` | CONFIRMED |
| L2 | Float in some frontend money fields | Display only | gates-web forms | SUSPECTED |
| L3 | Hijri date optional parallel to Gregorian | Reporting | JE model | INFO |
| L4 | Legacy `postingStatus` string + `isPosted` bool dual flags | State checks use OR | JE schema | CONFIRMED |
| L5 | Recurring journal separate from posted JE pipeline | Scheduling | `recurring-entries.service.ts` | CONFIRMED |

---

## INFO

| ID | Title | Note |
|----|-------|------|
| I1 | `activeSourceKey` idempotency | Strong pattern for sourced documents |
| I2 | Integration tests for invoice unpost concurrency | `invoice-unpost-concurrency.test.ts` |
| I3 | Party reconciliation H7 diagnostic | No auto-repair |
| I4 | Engineering constitution references | Workspace rules align with JE-as-truth |

---

## Severity counts (this audit pass)

| Severity | Count |
|----------|------:|
| CRITICAL | 3 |
| HIGH | 7 |
| MEDIUM | 8 |
| LOW | 5 |
| INFO | 4 |

*Counts are register rows above, not an exhaustive list of all possible risks in a 38k-line accounting module.*
