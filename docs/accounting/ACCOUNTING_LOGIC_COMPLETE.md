# Gates ERP — Complete Accounting Module Logic (reverse-engineering audit)

**Mode:** READ-ONLY documentation of **CURRENT GATES BEHAVIOR**.  
**Audience:** Reviewers validating accounting correctness.  
**Codebase:** `gates-web` (Next.js) + `gates-backend` (Express/Prisma/MySQL), October 2026.  
**Matrices / diagrams / risks:** See sibling files in `docs/accounting/`.

---

## 1. Module map

### 1.1 Major submodules (backend)

| Area | Path (approx.) | Role |
|------|----------------|------|
| Core GL | `modules/accounting/services/journal-posting.service.ts`, `journal-entry.service.ts` | Create/post/unpost JEs, balance apply |
| Ledger cache | `ledger-balance.service.ts` | `account_period_balances`, partner running, card columns |
| Auto-GL | `auto-gl-posting.service.ts`, `auto-gl-line-builders.ts` | Document-family JE builders + idempotent commit |
| COA | `account.service.ts`, `coa-seeder.service.ts` | Chart hierarchy, CRUD, movement counts |
| Parties | `customer.service.ts`, `supplier.service.ts`, `party-ledger-account.service.ts` | Masters + sub-ledger accounts |
| Treasury (accounting routes) | `treasury-receipt/payment.service.ts` | Voucher documents (thin) |
| Treasury (posting) | `modules/treasury/services/treasury-posting.service.ts`, `cash-transaction.service.ts` | CR/CP posting engine |
| Commercial paper | `commercial-paper-posting.service.ts`, `commercial-paper.service.ts` | Securities lifecycle JEs |
| Cheques (alt) | `cheque-lifecycle.service.ts` | CK collect/bounce/endorse auto-gl |
| Reports | `financial-report.service.ts`, `reports.service.ts` | TB, GL, P&L, BS, review balance |
| Cost centers | `cost-center.service.ts`, `cost-center-movement.service.ts` | Hierarchy + line rewrite transfers |
| Opening | `opening-balance.service.ts`, routes | Company opening JE slot |
| Settings | `settings/accounting-settings.*`, `account-definition-map.ts` | Default accounts JSON + columns |
| FX utils | `utils/company-fx-rate.ts` | Rate persistence on JE |
| Reconciliation | `party-balance-reconciliation.service.ts`, `reconciliation.service.ts` | Diagnostics |
| Period / FY | `period.service.ts` + `platform/services/fiscal-year.service.ts` | Locks |

### 1.2 External modules posting into accounting

Invoices (`invoice-posting-orchestrator`), inventory stock GL (`stock-movement-gl.service`), POS (`pos-order-posting.service`), HR payroll, manufacturing, contracting, trade LC/LG, real estate, schools, taxes, landed cost, year-end closing, counterparty offset, database-tools (dangerous).

### 1.3 Approximate scale

| Artifact | Count (approx.) |
|----------|-----------------|
| Backend `modules/accounting` TypeScript lines | ~38,400 |
| Backend accounting route files | 31 (+ settings routes) |
| Frontend `app/accounting` pages | ~130 |
| Services under `modules/accounting` | ~145 files |
| Production files calling `createAndPostInTx` | ~31 |
| Distinct integration files using auto-GL / direct JE post | ~36 |
| **Direct `journalEntry.create` in app code** | **1** (`journal-posting.service.ts`) |

### 1.4 Frontend

Accounting UI under `gates-web/app/accounting/`: chart of accounts, journal entries, opening balance, treasury operations, securities/cheques, party cards, cost centers, account movement transfer, extensive `account-reports/*` (TB, GL, P&L, aged AR/AP, cash flow previews, etc.).

---

## 2. Chart of accounts (CURRENT)

**Model:** `Account` in Prisma — `companyId`, `parentId`, `code`, `arabicName`, `accountKind` (`HEADER` | `POSTING`), `accountNature`, `statementType`, `isActive`, soft delete `deletedAt`.

**Hierarchy:** Tree via `parentId`. **POSTING accounts cannot have children** once they have movements unless promoted to HEADER (`account.service.ts` `createAccount`, `updateAccount`).

**Code generation:** Seeder/templates (`coa-seeder.service`, `default-coa.seed.ts`); manual codes allowed on create.

**Move:** No dedicated `moveAccount`; parent change via update with cycle guard `assertNoAccountCycle`. **Delete** blocked if children, JE lines exist, or non-zero posted balance map; message references account movement transfer UI («نقل حركة حساب»).

**Example (conceptual):**

```
1 Assets (HEADER)
  11 Cash (HEADER)
    1101 Main Cash (POSTING) ← movements post here
```

**INTERNAL on move:** Updating `parentId` recalculates tree for reporting (`build-account-hierarchy.ts`); codes are **not** auto-rewritten for all descendants in one atomic cascade (verify per UI flow — **UNKNOWN** for bulk code propagation).

**Duplicate codes:** Enforced per company on create/update (`account.service.ts`).

**System accounts:** `system-account-map.ts`, `legacy-account-slots.ts` seed FX, rounding, retained earnings codes.

**Branch scoping:** Accounts are company-scoped; JEs may carry `branchId`.

---

## 3. Journal entry — source of truth

### 3.1 What determines an account balance?

**CURRENT GATES BEHAVIOR (authoritative):**

For GL and live reports:

```text
Balance(account) ≈ Σ (debitBase − creditBase)
  over journal_entry_lines
  join journal_entries
  where companyId = ?
    and isPosted = true
    and isCancelled = false
    and deletedAt is null
    [and date <= asOf if historical]
```

Implemented in `financial-report.service.ts` (`getTrialBalanceFromJournalLines`, account ledger SQL) and reconciliation helpers.

**Cached fast path:** `account_period_balances` stores monthly debit/credit aggregates per account, updated by `applyPostedJournalBalancesInTx` (`ledger-balance.service.ts`). Default trial balance uses cache **unless** filters require live sums (`usesLiveJournalSum`).

### 3.2 Field authority

| Field | Role |
|-------|------|
| `debit` / `credit` | Document/line currency amounts |
| `debitBase` / `creditBase` | **Authoritative for GL** (EGP or company base) |
| `exchangeRate` | Frozen at post on line/header |
| `currencyCode` | Header + optional per-line |
| `sourceType`, `sourceNumber`, `sourceYearId`, `sourceId` | Traceability + idempotency |
| `activeSourceKey` | Unique while posted — prevents double active JE per source |
| `partnerId` / `partnerType` | Sub-ledger analytics on shared AR/AP accounts |
| `costCenterId` | Analytic dimension |
| `isPosted`, `isCancelled`, `deletedAt` | Inclusion filters |
| `customer.balance` | **Cache** — not authoritative |

---

## 4. Journal lifecycle (CURRENT)

| Action | What happens |
|--------|----------------|
| **Draft create** | `journalEntry` + lines; no balance apply |
| **Post (manual)** | `postJournalEntry` — own transaction; validates balance; applies caches |
| **Post (sourced)** | `createAndPostInTx` inside document transaction |
| **Edit draft** | Lines replaced; `version` optimistic lock |
| **Edit posted manual** | **Blocked** — must unpost first (`journal-entry.service.ts`) |
| **Edit posted sourced** | **Blocked** via `isSourcedJournalEntry` — mutate source document |
| **Unpost sourced** | `unpostSourceJournalInTx`: invert caches, `isPosted=false`, clear `activeSourceKey` — **JE rows remain** |
| **Unpost manual** | `unpostJournalEntry` — same invert pattern |
| **Cancel** | `isCancelled=true`; cascade paths invert if posted |
| **Delete** | Draft only (`journal-entry.service.ts`); posted must unpost/cancel |
| **Reverse / unpost (sourced)** | `reverseJournalEntryInTx` → **in-place** `unpostSourceJournalInTx` (no new contra JE). Legacy DB rows may still have `reversalOfJournalEntryId` children; `cascade` cleans them. **Do not** book swapped-debit contra rows on void/unpost (POS void uses same rule). |

**Posted entry disappearing from history?** **No** for normal unpost — entry stays with `isPosted=false`. Soft-delete hides draft/cancelled rows.

**Numeric example (unpost):** Posted Dr Cash 1,000 / Cr AR 1,000 → unpost inverts period balances by −1,000/+1,000 on those accounts; JE still visible as unposted.

---

## 5. Double-entry invariant

**Validation layers:**

1. Frontend: journal forms validate debit=credit (Zod schemas in `accounting.schema.ts`).
2. Backend: `validateJournalLineSides`, `validateDoubleEntryBalance` (`money.util.ts`, `journal-posting.service.ts`) — tolerance `amountsEqualAt4`.
3. Auto-GL: `assertJournalBalanced` before commit.
4. Database: **no** DB constraint enforcing balance; relies on application.

**Can unbalanced post?** **Only** if `allowUnbalanced` true — opening balance draft path (`isOpeningBalanceDraft`).

**Integrations:** Should not bypass if they use `createAndPostInTx`; **RISK** if raw Prisma or tools update without validation (`approve-documents.service.ts`).

**Rounding:** `roundTo4` / Decimal(18,4) on lines; rounding account in defs for auto-GL trim.

---

## 6. Posting atomicity (major documents)

| Document | Single DB transaction? | Can business post without JE? |
|----------|------------------------|-------------------------------|
| Sales/Purchase invoice (orchestrator) | **Yes** | **Yes** if GL disabled; stock still runs |
| Treasury voucher | **Yes** | If auto-post off / rights |
| Manual JE | Post transaction | N/A |
| Stock GI/GR (perpetual) | **Yes** | **No** — GL failure rolls back (current guard) |
| Stock (periodic) | **Yes** | **Yes** — GL optional skip |
| POS order | **Yes** | Config-dependent |
| Commercial paper step | Per method — mostly **Yes** | Status-dependent |
| Opening stock | Qty at create **outside** post GL tx | GL optional on periodic |

**Failure A (invoice):** If GL throws after stock in same tx → **whole tx rolls back** (stock not committed).  
**Failure B (retry):** `activeSourceKey` + invoice `updateMany` claim reduces double post; client retry may get 409/conflict — **MOSTLY PROTECTED** (runtime test advised).

---

## 7. Account balance calculation paths

Documented in matrix **§E** (`ACCOUNTING_LOGIC_MATRIX.md`). Key point: **two trial balance engines** (cache vs live) can disagree when cache stale or filters differ — **not automatically a bug**.

---

## 8. Customer accounting (CURRENT)

**True balance (ledger):** Sum of posted JE activity on customer's GL account(s) with `partnerId=CUSTOMER` plus lines hitting dedicated sub-ledger account from `customer-ledger-account.service`.

**`customer.balance`:** Cache updated via `applyPostedJournalBalancesInTx` account-linked cards (invoices defer this) or `applyPartnerCardBalancesFromLinesInTx` when lines carry `partnerId` (POS). **Ledger truth:** posted JE lines + `partner_running_balances`; use reconciliation/resync if drift (`party-balance-reconciliation.service.ts`).

**Flows:**

- Opening: company opening JE or party opening lines
- Credit sale: Dr AR (net+tax), Cr sales, Cr VAT; COGS Dr/Cr inventory if perpetual
- Receipt: Dr Cash, Cr AR (treasury CR)
- Return: SR builder reverses signs
- Settlement: allocations + `refreshInvoiceBalance`; FXDIFF if rates differ
- Unpost: settlements torn down, stock reversed, JEs cascaded unposted

**Worked example (simplified SI builder — `buildSalesInvoiceLines`):**

Credit sale net 1,000 + VAT 140, COGS 600:

```text
Dr AR (party)     1,140
  Cr Sales        1,000
  Cr VAT output     140
Dr COGS             600
  Cr Inventory      600
```

*Actual accounts = resolved IDs; amounts rounded to 4 decimals; invoice orchestrator may group lines differently.*

---

## 9. Supplier accounting

Symmetric to customer with AP credit nature on card delta (`linkedCardColumnDelta` supplier branch). Purchase: Dr Inventory, Dr VAT, Cr AP; WHT Cr line if applicable (`buildPurchaseInvoiceLines`).

---

## 10. Cash and banks (CURRENT)

**Receipt (customer pays 1,000 cash):** `buildTreasuryReceiptLines`:

```text
Dr Treasury (cash/bank GL)  1,000
  Cr AR (or revenue)        1,000
```

**Payment:** Dr counterpart (AP/expense), Cr treasury (`buildTreasuryPaymentLines`).

Safes/banks link to GL accounts; treasury posting updates card balances after JE.

---

## 11. Transfers cash↔bank

Handled as treasury payments/receipts or internal transfer documents (treasury module). **Same-account protection** and overdraft on payments in `treasury-posting.service.ts`. FX on voucher uses row `exchangeRate`.

---

## 12. Commercial papers / cheques

Lifecycle: issue → (deposit) → collect/clear → bounce/endorse/cancel. JEs via `commercial-paper-posting.service` (`SECP`/`SECR`) and/or `cheque-lifecycle.service` (`CKC`/`CKB`/`CKE` auto-gl).

**Concurrency:** Status fields on paper + transactional posting; **SUSPECTED** double-collect blocked by status — **requires runtime test** per paper type.

---

## 13. Multi-currency (CURRENT)

- Company base currency in settings.
- JE stores `currencyCode`, `exchangeRate`, line FC + `debitBase`/`creditBase`.
- `rateForSave` at post time — **historical JEs keep stored rate** (F invariant mostly protected).
- Settlement: `postFxDifferenceInTx` posts `FXDIFF` entry for realized difference (`invoice-settlement.service.ts`).
- **Unrealized revaluation:** No dedicated GL job found — **UNKNOWN / not implemented** beyond pricing automation unrelated to GL.

**Example storage:** 100 USD @ 50 → line debit 100 USD, `debitBase` 5,000 EGP if rate 50 on both sides.

---

## 14. FX gains/losses

**Realized:** On invoice settlement when `invoiceRate ≠ settlementRate` — separate JE to `fxGain`/`fxLoss` accounts (`treasuryAccountResolverService.resolveFxAccounts`).

**Unrealized:** Not traced in accounting services — document as **CURRENT: no periodic reval GL**.

---

## 15. Cost centers

Posting: `costCenterId` on lines; `enforceCostCenters` may require CC per account rules.

Reporting: primarily **JE lines** (`getCostCenterMovementSummary`).

Transfer tool: **updates historical line CC ids** — retroactive report change.

Stock transfer GL may insert `CostCenterMovement` rows — secondary to lines.

---

## 16. Opening balances

| Type | Representation |
|------|----------------|
| Company GL OB | Single `OPENING_BALANCE` JE per company (`assertSingleOpeningJournal`) |
| Party | Lines on opening JE or dedicated party OB flows |
| Inventory OB | Stock at create + optional GL at post (`sourceType` OB/OPEN) |
| Cash/bank | Opening JE lines / safe setup |

**Double count risk:** If same economic OB entered in both inventory document and GL without coordination — **RISK / operational**.

---

## 17. Fiscal years

`fiscalYearService.assertOpenForDate`: year not closed, not before `lockPostingBeforeDate`, period not closed (`Period` + `FiscalPeriod`). Enforced on **JE post/unpost** and many document services. Middleware `tenant-fiscal-context` for `X-Fiscal-Year-Id`.

Year-end: `year-end-closing.service` posts closing JE; reversal support exists.

**Bypass:** Posting through module that skips `assertOpenForDate` — **audit each module**; most inventory/accounting paths call it.

---

## 18. Period locks

`CompanySettings.lockPostingBeforeDate` + closed periods. APIs that call `createAndPostInTx` inherit checks. **RISK:** Any mutation without fiscal assert — search per new module.

---

## 19–22. Sales, purchases, POS

See matrices and §8. **POS differences:** single JE, simplified accounts, direct `customer.balance` on credit; unpost uses `reverseJournalEntryInTx` not cascade source key pattern identical to SI.

---

## 23. Inventory ↔ accounting

Perpetual: COGS/inventory on SI; stock documents post GI/GR/transfer JEs. **GL skip:** periodic inventory or missing accounts (perpetual now fails). **inventory-gl-reconciliation.service** compares stock value to GL.

---

## 24. Tax accounting

VAT lines on auto-GL builders; WHT on purchase; tax period service on invoice post. Tax accounts from defs / tax code mapping — resolution failures throw on post when tax amount > 0.

---

## 25. Rounding

Prisma `Decimal(18,4)` on money; `roundTo4` in business math; journal uses `amountsEqualAt4` (0.0001 tolerance). Line vs header totals may differ by rounding — auto-GL may use rounding account (**verify per document**).

---

## 26. Manual journals

Post directly; cannot edit posted; cannot delete posted; HEADER accounts rejected at enforce layer; inactive account checks via resolver; fiscal locks apply; sourced entries cannot be edited from manual UI.

---

## 27. Auto-GL / account resolution

Central: `gl-account-resolver.service.ts` + per-domain resolvers (invoice, treasury, subcontract). Full matrix in `ACCOUNTING_LOGIC_MATRIX.md` §C.

---

## 28. Denormalized values

`customer.balance`, `supplier.balance`, safe/bank balances, `account_period_balances`, `partner_running_balances`, invoice `paidAmount`/`remaining`, — all **derived with write-through on post**; rebuild functions exist for some caches; drift detection for parties.

---

## 29–31. Invariants, concurrency, tenancy

See matrix §F. **Concurrency:** `claimDocumentPost`, invoice `version` updateMany, JE `activeSourceKey`, optimistic `version` on drafts, `FOR UPDATE` on company opening journal.

**Tenancy:** JE queries include `companyId`; reviewers should spot-check rare `update({ where: { id }})` without company — journal posting uses company scoped where.

---

## 32–35. Reporting, P&L, BS, historical

**P&L / BS:** `financial-report.service` — account `statementType` + INCOME_STATEMENT vs BALANCE_SHEET classification; journal-driven posted lines in range.

**Historical as-of:** Use journal line sums with date filter — **not** `customer.balance` cache.

**A = L + E:** Not enforced by system constraint — **expected** accounting identity only.

---

## 36. Delete / cascade

JE lines cascade delete with JE. Account delete blocked if lines exist. Customer/supplier soft delete `deletedAt`. FK `onDelete` varies — historical JEs keep `accountId` even if account deactivated.

---

## 37. Legacy paths

- `inventory/services/invoice.service.ts` (legacy invoice post)
- Dual treasury/cheque stacks
- `database-tools` journal updates
- Legacy `postingStatus` strings
- Review balance wrapper deprecated note in `reports.service.ts`

---

## 38. Direct database writes

**Approved engine:** `journal-posting.service.ts` only `journalEntry.create` in production app code (grep). All modules should funnel here.

**Balance writes:** `ledger-balance.service.ts` SQL upserts.

**Suspicious:** `approve-documents.service.ts`, `renumber-operations.service.ts` — admin tooling.

---

## 39. Failure scenarios (CURRENT reasoning)

| Scenario | Behavior |
|----------|----------|
| A: Stock ok, JE fail in same tx | Rollback — no partial |
| B: JE committed, HTTP lost | Retry may hit idempotency/claim — **UNKNOWN** without test |
| C: Double post invoice | Second `updateMany` fails — protected |
| D: Double pay invoice | Allocation logic + tests — **mostly protected** |
| E: FX rate table changes | Old JEs unchanged |
| F: Unpost old doc after later txs | Allowed if rights/fiscal open; stock/MAC side effects reversed per module rules |

---

## 40. Simple examples index

Detailed journal patterns: §8, §10, `auto-gl-line-builders.ts`. POS/cheque/opening/unpost differ — see `ACCOUNTING_FLOW_MAP.md` and risk register.

---

## 41. CURRENT vs RISK

Throughout this doc, **CURRENT** states observed behavior. Items marked **RISK / QUESTION** or **UNKNOWN** need runtime confirmation.

---

## 42. Related deliverables

| File | Contents |
|------|----------|
| `ACCOUNTING_LOGIC_MATRIX.md` | Document, SOT, resolution, lifecycle, report matrices |
| `ACCOUNTING_FLOW_MAP.md` | Mermaid diagrams |
| `ACCOUNTING_RISK_REGISTER.md` | Severity-ranked risks with evidence |

---

## Key file index (quick navigation)

| Topic | File |
|-------|------|
| JE post | `journal-posting.service.ts` |
| Balances | `ledger-balance.service.ts` |
| Auto-GL | `auto-gl-posting.service.ts` |
| Invoice post | `invoice-posting-orchestrator.ts` |
| Treasury | `treasury-posting.service.ts` |
| FX settlement | `invoice-settlement.service.ts` |
| TB | `financial-report.service.ts` |
| COA | `account.service.ts` |
| Fiscal lock | `fiscal-year.service.ts` |
| Party drift | `party-balance-reconciliation.service.ts` |
| Stock GL | `stock-movement-gl.service.ts`, `stock-gl-posting-guard.ts` |
| Schema | `prisma/schema.prisma` (`JournalEntry`, `JournalEntryLine`) |

*End of audit document.*
