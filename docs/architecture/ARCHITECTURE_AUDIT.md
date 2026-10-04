# Gates ERP: architecture audit

Status: discovery snapshot, 27 September 2026. Read-only. No code, schema, migration or configuration was changed.

Companion documents: `CURRENT_ARCHITECTURE.md` (how the system works) and `PERFORMANCE_BASELINE_PLAN.md` (how to measure before changing anything).

## How to read this audit

- **Severity reflects Gates business risk**, not style. A finding is HIGH when it can realistically produce wrong accounting or stock numbers, lose data, or take a core workflow down as data grows. Nothing is CRITICAL: no exploitable cross-company path and no routine (non-concurrent, non-admin) data-corruption path was confirmed.
- **Verification label** on each finding:
  - *Confirmed in code*: re-read directly during this audit.
  - *Static review*: reported with file and line evidence by the read-only exploration pass and consistent with the confirmed findings, but not re-read line by line. Re-check before acting.
- Every finding lists: module, files and functions, verification, evidence, current behavior, why it matters, correctness / performance / concurrency / security risk, safest remediation, regression risk, and tests required before changing it.
- Line numbers drift. Search for the named function if a line has moved.
- Remediations are the safest known direction, not approved work.

## Summary

| ID | Severity | Title |
|---|---|---|
| H-01 | HIGH | Stock transfers (and adjustments without a GL entry) can be posted twice by concurrent requests |
| H-02 | HIGH | Renumber tool rewrites numbers of posted documents with no transaction |
| H-03 | HIGH | Editing a posted cash voucher is split across two transactions |
| H-04 | HIGH | Database migrations run automatically on API boot, with a hard-coded rollback resolve |
| H-05 | HIGH | Account and cost-center ledgers are unbounded, use a per-row subquery, and run under the 30 s default timeout |
| H-06 | HIGH | Trial balance can rebuild all company balances inside a report request, under a 30 s transaction limit |
| H-07 | HIGH | Company-wide bulk operations run synchronously inside HTTP requests |
| M-01 | MEDIUM | Global GET limit middleware silently caps list sizes (account pickers ask for 20,000, get at most 1,000) |
| M-02 | MEDIUM | Request timeout answers 408 while the work continues; no idempotency keys |
| M-03 | MEDIUM | `activeSourceKey` for stock documents is built from a non-unique, user-entered serial |
| M-04 | MEDIUM | Missing uniqueness constraints on several document numbers and codes |
| M-05 | MEDIUM | `journal_entry_lines` has no company, date or cost-center index |
| M-06 | MEDIUM | Deadlock and serialization errors (P2034) are not mapped or retried |
| M-07 | MEDIUM | Credit checks read cached party balances; two party caches can drift; cache precision is 2 decimals |
| M-08 | MEDIUM | Several reports load whole datasets or loop queries per row, then paginate in memory |
| M-09 | MEDIUM | Inventory cost side paths: POS and manufacturing bypass the costing service; purchase-unpost cost replay runs after commit |
| M-10 | MEDIUM | Tenant-scoping model list is stale (5 company-owned models are not covered by the Prisma extension) |
| M-11 | MEDIUM | Database pool size is not set explicitly; the configured value is only logged |
| M-12 | MEDIUM | Slow-query monitor is probably inactive (Prisma query events are not enabled) |
| M-13 | MEDIUM | External HTTP calls (OpenAI, Meta WhatsApp, ETA) have no timeouts |
| M-14 | MEDIUM | Frontend loads large master-data lists and filters whole reports in memory |
| L-01 | LOW | Two routers share `/api/v1/accounting/reports` with different timeouts |
| L-02 | LOW | Overlapping API stacks for the same resources |
| L-03 | LOW | Some document numbers are allocated outside the business transaction |
| L-04 | LOW | Route-level catch blocks bypass the central error mapping |
| L-05 | LOW | Backend liveness check depends on the database |
| L-06 | LOW | Chart of accounts prefetch uses a different URL than the page |
| L-07 | LOW | Integrity-check queue connects to Redis at import time |
| I-01 | INFO | Manual journal unposting flips a posted entry back to draft (controlled exception) |
| I-02 | INFO | Dead or retired code that would be unsafe if revived |
| I-03 | INFO | Delete-cancelled and post-all are disabled; their route still carries a skipped password check |
| I-04 | INFO | zod 3 on the backend, zod 4 on the frontend |
| I-05 | INFO | No error tracking service; metrics are hand-written |
| I-06 | INFO | Mixed decimal scales for money and quantities |

---

## CRITICAL

None. The two areas that would justify CRITICAL were checked:

- **Cross-company access**: company comes from the JWT; a mismatching `X-Company-Id` header is rejected; the Prisma extension adds `companyId` to queries on 193 models; sampled child-row updates and deletes (`itemUnit`, `itemQuantity`, invoice lines, HR lookups) check the parent's company first. No exploitable path was found. M-10 records a gap in the defense-in-depth layer.
- **Routine corruption**: the confirmed corruption paths need concurrency (H-01), an admin tool (H-02), or a crash between two transactions (H-03).

---

## HIGH

### H-01: Stock transfers (and adjustments without a GL entry) can be posted twice

- **Module**: Inventory (transfers, inventory adjustments, other adjustments)
- **Files / functions**: `gates-backend/src/modules/inventory/services/transfer.service.ts` `postTransfer` (about lines 493-608); `adjustment.service.ts` `postAdjustment` (about 408-510); `other-adjustment.service.ts` `postOtherAdjustment` (about 348+). Reference pattern: `modules/inventory/utils/claim-document-post.ts` `claimDocumentPost`, used by receipts, issues, stocktaking, assembly and disassembly.
- **Verification**: Confirmed in code.
- **Evidence**: `postTransfer` reads the transfer, checks `if (transfer.isPosted) throw` before the transaction, then inside `prisma.$transaction` posts both stock legs per line and finally runs `tx.transfer.update({ where: { id }, data: { isPosted: true } })` with no condition on `isPosted`. Adjustments follow the same shape.
- **Current behavior**: two requests that both pass the pre-check (double click, retry after a timeout, two users) each run the full transaction. Row locks on stock serialize them, but the second transaction never re-checks `isPosted`. Partial protection exists only when the document also produces a GL entry: `createAndPostInTx` claims the unique `activeSourceKey`, so the second transaction fails with P2002 and rolls back. Transfers produce a GL entry only when source and destination use different inventory accounts or cost centers (`stock-movement-gl.service.ts` `postTransferValueGlInTx` returns early otherwise), so most transfers are unprotected; adjustments are unprotected when their value is zero or no GL context is present. POS orders were also checked and are protected in practice, because every order with amounts posts a journal entry with an `activeSourceKey`.
- **Why it matters**: a double-posted transfer moves the quantity twice (source down twice, destination up twice) and writes two sets of `InventoryMovement` rows for the same document. Stock, valuation and every downstream report become wrong, and unposting reverses only one set.
- **Correctness risk**: High. **Performance risk**: None. **Concurrency risk**: High. **Security risk**: None.
- **Safest remediation**: call `claimDocumentPost((args) => tx.transfer.updateMany(args), id, companyId)` as the first statement inside the transaction (and `claimDocumentUnpost` for unpost), exactly as receipts and issues already do; same for adjustments and other adjustments. Keep the pre-check for its friendly message.
- **Regression risk**: Low. The pattern is already in production for five document types.
- **Tests required first**: a concurrency test that fires two `postTransfer` calls in parallel against a real MySQL database and asserts one success, one "already posted" error, one set of movements and correct balances; the same for adjustments; an unpost-then-repost test.

### H-02: Renumber tool rewrites numbers of posted documents with no transaction

- **Module**: Database tools (settings page "renumber financial operations")
- **Files / functions**: `gates-backend/src/modules/database-tools/services/renumber-operations.service.ts` `renumberOperations`; route `POST /api/v1/database-tools/renumber-operations` in `database-backup.routes.ts` (about 282-316); page `gates-web/app/accounting-settings/database-tools/renumber-financial-operations/page.tsx`.
- **Verification**: Confirmed in code.
- **Evidence**: the service loads every journal entry, invoice, treasury receipt or payment in the company for the date range (`findMany` without `take`), then loops `await prisma.<model>.update({ where: { id }, data: { voucherNumber | invoiceNumber } })` one row at a time, outside any transaction. It does not filter by posted state, branch, fiscal year or invoice type.
- **Current behavior**: posted invoices get new numbers in date order starting from `startNumber`. The invoice unique key is `(companyId, branchId, fiscalYearId, invoiceType, invoiceNumber)`, so an update can collide with a row that has not been renumbered yet; the loop then stops with P2002, leaving some documents renumbered and others not. The request runs under the 30 s default timeout, and a timeout answers 408 while the loop keeps going.
- **Why it matters**: invoice numbers are legal document numbers. They may already be printed, sent to customers, or submitted to the tax authority, and journal entries keep the original number in `sourceNumber` and `activeSourceKey`. A partial run leaves numbering inconsistent with no way to undo it.
- **Correctness risk**: High. **Performance risk**: High on large companies. **Concurrency risk**: Medium (runs while users create documents). **Security risk**: Low (admin-only, `database-tool:edit`).
- **Safest remediation**: decide product policy first (probably: never renumber posted or submitted documents). The safest containment matches what was already done for delete-cancelled and post-all: disable the endpoint with a clear message until a transactional, draft-only version is designed.
- **Regression risk**: Low for disabling (admin tool); any redesign needs product sign-off.
- **Tests required first**: a test documenting current behavior on a fixture with posted invoices (collision and partial state), then tests for the chosen policy.

### H-03: Editing a posted cash voucher is split across two transactions

- **Module**: Treasury (receipt and payment vouchers)
- **Files / functions**: `gates-backend/src/modules/treasury/routes/cash-transaction.routes.ts` `PATCH /:id` (about 160-200); `cashTransactionService.update`; `treasury-posting.service.ts` `rewritePostedCashJournal`.
- **Verification**: Confirmed in code.
- **Evidence**: the route calls `cashTransactionService.update(..., { allowPosted: true })` (own transaction), then `treasuryPostingService.rewritePostedCashJournal(ctx, existing.id, existing)` (second transaction that reverses the old journal, posts a new one, and moves safe, bank and party balances).
- **Current behavior**: if the second step fails (validation, overdraft check, closed period, lock timeout, process restart), the voucher header and lines already hold the new values while the journal, safe or bank balance and party balance still reflect the old values.
- **Why it matters**: the voucher and the ledger disagree with no automatic repair; the treasury report and the GL show different amounts.
- **Correctness risk**: High (on failure). **Performance risk**: Low. **Concurrency risk**: Medium. **Security risk**: None.
- **Safest remediation**: run the update and the journal rewrite in one transaction (update in-transaction, then the existing rewrite body with the same `tx`), and run the rewrite's validations before writing.
- **Regression risk**: Medium. Posted-edit behavior is recent and covered by one unit test.
- **Tests required first**: an integration test that edits a posted voucher and forces the rewrite to fail (for example an overdraft), asserting the voucher is unchanged; the existing `accounting-round2-rewrite.spec.ts` must keep passing.

### H-04: Database migrations run automatically on API boot, with a hard-coded rollback resolve

- **Module**: Deployment
- **Files / functions**: `gates-backend/scripts/railway-start.mjs` (about lines 56-71); `gates-backend/railway.json` start command.
- **Verification**: Confirmed in code.
- **Evidence**: when `GATES_RUN_WORKERS` is not set, the script runs `npx prisma migrate deploy`; if it fails, it runs `npx prisma migrate resolve --rolled-back 20260924170000_whatsapp_embedded_signup` and runs `migrate deploy` again.
- **Current behavior**: every API start applies pending migrations against production. The rollback resolve is applied whatever migration actually failed.
- **Why it matters**: a failing migration blocks the API from starting (health check fails, deploy fails), and a partially applied migration can be marked rolled back and re-run on top of the partial state. If the API is ever scaled to more than one instance, instances race to migrate.
- **Correctness risk**: Medium (schema drift). **Performance risk**: Low (slower boots). **Concurrency risk**: Medium with multiple instances. **Security risk**: None. **Availability risk**: High during deploys.
- **Safest remediation**: confirm in production that `20260924170000_whatsapp_embedded_signup` is applied, remove the hard-coded resolve, and move `migrate deploy` to an explicit pre-deploy step (Railway pre-deploy command or a one-off job) so a failure stops the deploy instead of the running service.
- **Regression risk**: Low if done as a deployment change with a rehearsal on a copy of the database.
- **Tests required first**: a staging deploy rehearsal that applies all pending migrations to a production snapshot; `prisma migrate status` must be clean.

### H-05: Account and cost-center ledgers are unbounded and run under the 30 s default timeout

- **Module**: Accounting reports (account ledger and cost-center ledger)
- **Files / functions**: `gates-backend/src/modules/accounting/services/financial-report.service.ts` `getAccountStatement` (about 608-815) and `getCostCenterStatement` (about 825-1030); routes in `financial-reports.routes.ts`; mount at `app.ts:575` (no `reportRequestTimeout`, unlike `app.ts:597`).
- **Verification**: Confirmed in code.
- **Evidence**: the account tree is loaded for the company, then one raw SQL query returns every matching journal line for the account subtree and date range with no `LIMIT`, and each row computes a counterpart list with a correlated `GROUP_CONCAT` subquery over the other lines of the same entry. Subtotals and footers are added in memory.
- **Current behavior**: the whole ledger is built and returned in one response; the browser then filters and sorts it in memory.
- **Why it matters**: control accounts (cash, bank, customers, sales) accumulate tens of thousands of lines per year. The query cost grows with lines times lines per entry, memory grows with the result, and the request hits the 30 s timeout. The 408 does not stop the query.
- **Correctness risk**: Low. **Performance risk**: High. **Concurrency risk**: Low. **Security risk**: None (company-scoped).
- **Safest remediation**: measure first (baseline plan). Candidate steps in order of safety: apply the 60 s report timeout to the financial-reports mount; replace the correlated subquery with a pre-aggregated join per entry; add server-side pagination with the opening balance carried per page while keeping the current response shape for the first page.
- **Regression risk**: Medium. The ledger footer and subtotal logic was just changed; any pagination must keep running balances correct across pages.
- **Tests required first**: golden-output tests for a fixture ledger (lines, subtotals, opening and closing rows, running balance), including a parent account with children and a cost-center filter.

### H-06: Trial balance can rebuild all company balances inside a report request

- **Module**: Accounting reports (trial balance)
- **Files / functions**: `financial-report.service.ts` `getTrialBalanceFromPeriodBalances` (about 407-424); `ledger-balance.service.ts` `rebuildCompanyBalances` (about 262-377).
- **Verification**: Confirmed in code (trigger and call); the per-row write loop is from static review.
- **Evidence**: every unfiltered trial balance first runs two counts (period-balance rows, and all posted journal entries of the company). If the summary table is empty and posted entries exist, it runs `prisma.$transaction((tx) => rebuildCompanyBalances(tx, companyId))`, which deletes the company's period and partner rows, groups all posted lines, and writes the results back one row at a time. The transaction uses the global 30 s timeout.
- **Current behavior**: normally the summary table exists and only the two counts run. After a restore, a data migration or a manual wipe, the first trial balance triggers the rebuild inside the user's request.
- **Why it matters**: on a large ledger the rebuild cannot finish in 30 s, so it rolls back and every later trial balance tries again, each time holding locks on the balance tables that posting also updates. The unconditional count of all posted journal entries also runs on every request.
- **Correctness risk**: Low (rollback keeps data consistent). **Performance risk**: High in the trigger case, Medium for the per-request count. **Concurrency risk**: Medium (lock contention with posting). **Security risk**: None.
- **Safest remediation**: move the rebuild to an explicit admin action or background job and return a clear "balances are being rebuilt" message; replace the full count with an existence check.
- **Regression risk**: Low.
- **Tests required first**: a test that an empty summary table plus posted entries yields correct trial balance numbers after the rebuild job; the existing trial balance tests.

### H-07: Company-wide bulk operations run synchronously inside HTTP requests

- **Module**: Operations management, database tools, company backup, onboarding
- **Files / functions**:
  - `operations-management.service.ts` `fixAverageCost` -> `inventory-costing.service.ts` `recalculateItemCostHistory` (per-item transactions with a 120 s timeout). Confirmed in code.
  - `renumber-operations.service.ts` (see H-02). Confirmed in code.
  - `company/services/tenant-backup.service.ts` `exportPlainJson` (unbounded `findMany` on invoices, all invoice lines, cash transactions, items). Static review.
  - `database-tools/services/export-import.service.ts` `exportData` (unbounded `findMany` per table). Static review.
  - `onboarding/services/data-import.service.ts` `importExcel` (row-by-row creates, up to 500 rows, in one transaction). Static review.
- **Verification**: mixed, as marked per file.
- **Evidence**: each runs from its route handler with no queue; the routers are mounted without an extended timeout.
- **Current behavior**: each runs inside the request under the 30 s default timeout. BullMQ exists (`report-export`, `reports`, `pdf-generation` queues) but these operations do not use it.
- **Why it matters**: large companies exceed the timeout; the user sees 408 while the work continues or is cut off, and long transactions hold row locks that block posting (fix average cost locks stock rows per item).
- **Correctness risk**: Medium (partial runs for non-transactional loops). **Performance risk**: High. **Concurrency risk**: Medium. **Security risk**: Low (memory exhaustion from a single export request).
- **Safest remediation**: move each to a BullMQ job with progress and a result download, one operation at a time, keeping the same inputs and outputs.
- **Regression risk**: Medium (UI must poll for job status).
- **Tests required first**: behavior tests for each operation on a small fixture (current outputs), then job-based equivalents.

---

## MEDIUM

### M-01: Global GET limit middleware silently caps list sizes

- **Module**: Platform middleware, all list endpoints; frontend pickers
- **Files / functions**: `gates-backend/src/shared/middleware/query-limits.middleware.ts` (`defaultQueryLimits`, mounted on `/api/v1` at `app.ts:296`); `modules/accounting/services/account.service.ts` `listAccounts` (allows up to 50,000); `gates-web/lib/hooks/useMasterDataQueries.ts` `ACCOUNT_PICKER_PAGE_SIZE = 20_000`.
- **Verification**: Confirmed in code.
- **Evidence**: for every GET, the middleware rewrites `req.query.limit` to 50 when absent and to 1000 when larger, before routes and `validate` run.
- **Current behavior**: the account picker asks for 20,000 accounts and receives at most 1,000; other pickers asking for 1,000 are at the cap. Endpoints that treat a missing `limit` as "service default" (for example report defaults of 100 or 1,000) receive 50 when the caller omits it.
- **Why it matters**: companies with more than 1,000 posting accounts, items or delegates may see incomplete dropdowns with no error, and choose from a partial list.
- **Correctness risk**: Medium (silent truncation). **Performance risk**: None (protective). **Concurrency risk**: None. **Security risk**: None (protective, limits payload size).
- **Safest remediation**: measure real master-data sizes per company; switch large pickers to server-side search (the item picker already searches with limit 30) rather than raising the cap.
- **Regression risk**: Medium (many screens rely on the current sizes).
- **Tests required first**: an API test showing the effective limit for `/accounting/accounts?limit=20000`; UI checks for pickers with more than 1,000 entries.

### M-02: Request timeout answers 408 while the work continues; no idempotency keys

- **Module**: Platform middleware, all mutations
- **Files / functions**: `shared/middleware/request-timeout.middleware.ts`; `shared/database/prisma.ts` (transaction `timeout` 30 s); frontend `lib/api/client.ts` (30 s timeout, no mutation retries).
- **Verification**: Confirmed in code.
- **Evidence**: the timeout handler writes `408 Request timeout` but has no way to cancel the handler or its transaction. There is no `Idempotency-Key` handling anywhere in the backend.
- **Current behavior**: a slow post can return 408 to the user and still commit afterwards. The user naturally clicks again.
- **Why it matters**: repeated creates produce duplicate drafts or, for endpoints that create and auto-post in one call (for example cash vouchers in AUTO mode), duplicate posted documents. Posting of existing documents is protected for invoices, receipts, issues and journals; see H-01 for the gaps.
- **Correctness risk**: Medium. **Performance risk**: None. **Concurrency risk**: Medium. **Security risk**: None.
- **Safest remediation**: accept an optional `Idempotency-Key` on create-and-post endpoints (store key and result per company), and make the HTTP timeout longer than the transaction timeout on mutation routes.
- **Regression risk**: Low (optional header).
- **Tests required first**: a test that repeats a create-and-post call with the same key and gets one document.

### M-03: `activeSourceKey` for stock documents uses a non-unique, user-entered serial

- **Module**: Inventory GL posting
- **Files / functions**: `stock-movement-gl.service.ts` (adjustment, transfer, receipt, issue and stocktaking GL: `sourceNumber: serial ?? id.slice(0, 8)`); `journal-posting.service.ts` `buildActiveSourceKey` and `createAndPostInTx` (`claimActiveSourceKey` defaults to true).
- **Verification**: Confirmed in code.
- **Evidence**: `activeSourceKey = companyId|sourceType|sourceNumber|sourceYearId`, unique across the table. Stock document serials have no uniqueness constraint (M-04).
- **Current behavior**: two different documents of the same type with the same serial in the same year cannot both hold a posted GL entry; the second post fails with a unique-constraint error (409) and rolls back.
- **Why it matters**: users who reuse serials (for example per warehouse) get a confusing "already exists" failure on a legitimate document.
- **Correctness risk**: Low (fails closed). **Performance risk**: None. **Concurrency risk**: None. **Security risk**: None.
- **Safest remediation**: decide whether stock serials must be unique per company, type and year (then enforce it at save) or base the source key on the document id.
- **Regression risk**: Medium (changing keys affects idempotency of existing posted entries).
- **Tests required first**: a test posting two adjustments with the same serial.

### M-04: Missing uniqueness constraints on document numbers and codes

- **Module**: Schema
- **Files / functions**: `gates-backend/prisma/schema.prisma`: `JournalEntry.voucherNumber` (index only), `Item.serial` (index only), stock document `serial` fields (receipts, issues, transfers, adjustments, stocktaking: no unique), `Customer.code` and `Supplier.code` (index `(companyId, code)` only), `CashTransaction.voucherNumber` (no unique; the linked treasury receipt or payment row has `(companyId, voucherNumber)` unique).
- **Verification**: Confirmed in code.
- **Evidence**: model blocks list `@@index` but no `@@unique` for these fields.
- **Current behavior**: duplicates are prevented only by application logic (sequences for invoices and vouchers) or not at all (client-supplied serials and codes).
- **Why it matters**: duplicate item or party codes break lookups and imports; duplicate stock serials interact with M-03.
- **Correctness risk**: Medium. **Performance risk**: None. **Concurrency risk**: Low (two users can save the same code at once). **Security risk**: None.
- **Safest remediation**: measure existing duplicates per company first; add constraints only after cleaning data and agreeing on scope (company, branch, fiscal year, type).
- **Regression risk**: High if added without cleanup (the migration fails at boot, see H-04).
- **Tests required first**: duplicate-detection queries on a production snapshot.

### M-05: `journal_entry_lines` has no company, date or cost-center index

- **Module**: Accounting data access
- **Files / functions**: `schema.prisma` model `JournalEntryLine` (indexes on `journalEntryId`, `accountId`, `(accountId, journalEntryId)`, `partnerId`, `invoiceId`).
- **Verification**: Confirmed in code.
- **Evidence**: no index contains `costCenterId`; the table has no `companyId` or date column, so company and date filters come from the joined `journal_entries` row.
- **Current behavior**: ledgers, live trial balance sums, cost-center reports and monthly reports join lines to `journal_entries` to filter by company, date and posting state; cost-center filters on lines have no index.
- **Why it matters**: as lines grow, account-based queries scan all lines of an account across all years before the date filter applies; cost-center reports scan broadly.
- **Correctness risk**: None. **Performance risk**: Medium to High. **Concurrency risk**: None. **Security risk**: None.
- **Safest remediation**: capture `EXPLAIN ANALYZE` for the slowest report queries first; then consider composite indexes (for example on `costCenterId` with `accountId`), added in a planned migration.
- **Regression risk**: Low functionally; index builds slow large tables during migration.
- **Tests required first**: query plans and timings from the baseline plan.

### M-06: Deadlock and serialization errors (P2034) are not mapped or retried

- **Module**: Platform error handling, posting paths
- **Files / functions**: `shared/middleware/error-handler.ts` `handlePrismaError` (maps P2002, P2025, P2003, P2014 only); retries exist only in `document-sequence.service.ts`.
- **Verification**: Confirmed in code (mapping); retry scope from static review.
- **Evidence**: no `P2034` case in the handler.
- **Current behavior**: a deadlock during posting (several lock orders coexist: stock rows, sequences, balance tables) returns a generic 500.
- **Why it matters**: users see "unexpected error" on busy days and may retry blindly (M-02).
- **Correctness risk**: Low (the transaction rolls back). **Performance risk**: None. **Concurrency risk**: Medium. **Security risk**: None.
- **Safest remediation**: map P2034 to 409 with a "please retry" message; optionally retry whole posting transactions a bounded number of times.
- **Regression risk**: Low.
- **Tests required first**: a unit test for the mapping; a concurrency test that provokes a deadlock.

### M-07: Credit checks read cached party balances; two party caches; 2-decimal cache precision

- **Module**: Accounting (customers, suppliers)
- **Files / functions**: `party-credit.service.ts` `checkCustomerCredit` and `checkSupplierCredit`; `ledger-balance.service.ts` (`partner_running_balances`); `party-balance-reconciliation.service.ts`; schema fields `Customer.balance` and `Supplier.balance` (`DECIMAL(15,2)`).
- **Verification**: Static review (credit checks and caches); confirmed in schema (precision).
- **Evidence**: credit checks read `customers.balance` / `suppliers.balance`; `partner_running_balances` is maintained separately from journal lines with `DECIMAL(18,4)`; a reconciliation service compares and resyncs them.
- **Current behavior**: two caches represent party balances with different sources and precision; decisions use the 2-decimal cache.
- **Why it matters**: if a cache drifts (a missed update path, rounding at 2 decimals on 4-decimal amounts), credit limits allow or block sales incorrectly, and the customer card disagrees with the ledger.
- **Correctness risk**: Medium. **Performance risk**: None. **Concurrency risk**: Low (updates are atomic increments). **Security risk**: None.
- **Safest remediation**: run the existing reconciliation per company to measure drift before deciding whether credit checks should use `partner_running_balances` or a live sum.
- **Regression risk**: Medium.
- **Tests required first**: reconciliation run on a production snapshot; credit check tests.

### M-08: Several reports load whole datasets or loop queries per row

- **Module**: Accounting, inventory and analytics reports
- **Files / functions** (static review): `accounting/services/reports.service.ts` `getBankMonthlyStatement` (queries per bank per month), `getOperationsAnalysis` (all entries with lines, then slice), `getDailyJournal` (up to 2,000 entries with deep includes, plus full chart and cost-center loads), `getMonthlyReviewBalance` (all accounts joined to all lines); `aged-open-items.service.ts` (all open invoices and all parties); `party-balance-reconciliation.service.ts` (one aggregate per party); `inventory/services/reports.service.ts` `getMonthlySalesForItemsReport`, `getSlowMovingReport`, item profit, as-of stock (whole `groupBy`, then slice); `analytics/services/executive-dashboard.service.ts` `buildOverview` (a month of invoice lines, six months of journal lines).
- **Verification**: Static review.
- **Evidence**: `findMany` or raw aggregations without `take`/`LIMIT`, followed by `.slice` for the page, or `await` inside nested loops.
- **Current behavior**: cost grows with company history rather than with the page shown.
- **Why it matters**: these endpoints are the first to exceed timeouts and to spike database load.
- **Correctness risk**: Low. **Performance risk**: Medium to High. **Concurrency risk**: Low. **Security risk**: None.
- **Safest remediation**: prioritize by measured latency (baseline plan); push grouping and pagination into SQL one report at a time.
- **Regression risk**: Medium per report.
- **Tests required first**: golden outputs for each report on a fixture.

### M-09: Inventory cost side paths

- **Module**: Inventory costing
- **Files / functions**: `pos/services/pos-order-posting.service.ts` `postOrder` (uses `stockMovementService.postMovementInTx` and `itemCostService.getCostAsOf`, not `inventoryCostingService`); manufacturing material issue (same pattern); `invoice-posting-orchestrator.ts` unpost (runs `recalculateItemCostHistory` for purchases after the main transaction commits).
- **Verification**: POS path confirmed in code; manufacturing and unpost replay from static review.
- **Evidence**: POS posts each line as a raw movement with a looked-up unit cost; no call to the average-cost service.
- **Current behavior**: outbound movements at the current average leave the average unchanged, so POS sales are mostly consistent; POS returns come back in without recomputing the average. After a purchase unpost there is a window where quantities are reversed but average costs are not yet repaired, and if the replay fails the costs stay stale.
- **Why it matters**: valuation and COGS drift from the movement ledger until someone runs "fix average cost".
- **Correctness risk**: Medium. **Performance risk**: Low. **Concurrency risk**: Low. **Security risk**: None.
- **Safest remediation**: measure drift on a snapshot (compare cached average cost with a replay); route POS returns through `applyInboundMovement`.
- **Regression risk**: Medium.
- **Tests required first**: costing tests for POS sale and return sequences.

### M-10: Tenant-scoping model list is stale

- **Module**: Platform tenancy
- **Files / functions**: `shared/database/tenant-scoped-models.generated.ts` (193 models); generator `scripts/generate-tenant-scoped-models.mjs`.
- **Verification**: Confirmed by comparing the list with the schema.
- **Evidence**: five models with `companyId` are missing from the list: `InvoiceLineSource`, `HrLookup`, `HrAttendanceRecord`, `CompanyEmailConfig`, `WhatsappOutboundMessage`.
- **Current behavior**: these rely only on per-query filters. Sampled paths (`hr-lookup.routes.ts`, `company-email.service.ts`) filter by company correctly.
- **Why it matters**: the second safety layer silently does not cover new models; nothing fails when the generator is not re-run.
- **Correctness risk**: None today. **Performance risk**: None. **Concurrency risk**: None. **Security risk**: Medium (defense in depth).
- **Safest remediation**: re-run the generator and add a CI check that fails when the list and schema differ.
- **Regression risk**: Low (the extension only narrows queries); verify admin or cross-company jobs on these models use `runWithoutTenantScoping`.
- **Tests required first**: a unit test asserting every model with `companyId` is in the list.

### M-11: Database pool size is not set explicitly

- **Module**: Platform database
- **Files / functions**: `shared/database/prisma.ts` `getConnectionPoolConfig` and the `PrismaClient` constructor.
- **Verification**: Confirmed in code.
- **Evidence**: the configured limit (default 20 in production) is logged and used for monitoring only; `DATABASE_URL` is passed to Prisma unchanged.
- **Current behavior**: without `connection_limit` in the URL, Prisma uses CPUs x 2 + 1 per process; the API and worker processes each have their own pool.
- **Why it matters**: the real pool depends on the CPU count the container reports. Too small serializes posting under load; too large can exhaust MySQL connections.
- **Correctness risk**: None. **Performance risk**: Medium. **Concurrency risk**: Medium (pool waits look like lock timeouts). **Security risk**: None.
- **Safest remediation**: measure the effective pool (`Threads_connected` under load, Prisma metrics) before setting `connection_limit` explicitly per service.
- **Regression risk**: Low once measured.
- **Tests required first**: the connection measurements in the baseline plan.

### M-12: Slow-query monitor is probably inactive

- **Module**: Observability
- **Files / functions**: `shared/database/query-monitor.ts` (`prisma.$on('query')`, 1,000 ms threshold); `shared/database/prisma.ts` (`log: ['error']` in production, `['query', 'error', 'warn']` in development).
- **Verification**: Confirmed in code; the runtime effect needs confirmation.
- **Evidence**: Prisma delivers `query` events to `$on` only when logging is configured with `{ emit: 'event', level: 'query' }`; the client uses plain string levels.
- **Current behavior**: slow queries are probably never reported.
- **Why it matters**: there is likely no slow-query signal in production, so performance work has no baseline.
- **Correctness risk**: None. **Performance risk**: Indirect (problems go unseen). **Concurrency risk**: None. **Security risk**: None.
- **Safest remediation**: confirm by searching production logs for the monitor's slow-query warning; if absent, enable event-based query logging behind a flag with sampling.
- **Regression risk**: Low (log volume).
- **Tests required first**: a local check that the monitor fires for a deliberately slow query.

### M-13: External HTTP calls have no timeouts

- **Module**: AI, WhatsApp, e-invoicing
- **Files / functions**: `ai/providers/openai.provider.ts` `postChatCompletions`; `whatsapp/meta-cloud.provider.ts`; `electronic-invoices/services/live-eta.client.ts`.
- **Verification**: Static review.
- **Evidence**: bare `fetch` calls with no `AbortSignal`; the n8n dispatch and inventory webhook clients, by contrast, abort after about 10 s.
- **Current behavior**: a hung provider holds the request or worker slot until the server-side timeout (AI 180 s) or indefinitely in workers.
- **Why it matters**: for ETA and WhatsApp, a lost response followed by a retry can duplicate a submission or message.
- **Correctness risk**: Medium (ETA duplicates). **Performance risk**: Medium (stuck slots). **Concurrency risk**: Low. **Security risk**: None.
- **Safest remediation**: add `AbortSignal.timeout` per call; keep the existing idempotency on automation sends.
- **Regression risk**: Low.
- **Tests required first**: unit tests with a stalled mock provider.

### M-14: Frontend loads large master-data lists and filters whole reports in memory

- **Module**: Frontend
- **Files / functions**: `app/inventory/operations/sales-invoice/page.tsx` (items 1,000, delegates 1,000 per role x3), `final-purchase-invoice/page.tsx`, `app/accounting/cards/customer/page.tsx` (accounts 1,000, delegates 1,000, suppliers 500), `lib/hooks/useMasterDataQueries.ts`; `components/report/UniversalReportView.tsx` (in-memory filter and sort of all rows).
- **Verification**: Static review.
- **Evidence**: `useApiQuery` calls with large `limit` values on page mount; `filteredRows` in `UniversalReportView` filters and sorts the full row array.
- **Current behavior**: invoice and card pages issue many parallel large requests on open; big reports are filtered and sorted in the browser.
- **Why it matters**: invoice screens are the most used screens; large loads slow first paint on weak connections, and big reports freeze the tab. With M-01, lists may also be incomplete.
- **Correctness risk**: Medium (through M-01). **Performance risk**: Medium. **Concurrency risk**: None. **Security risk**: None.
- **Safest remediation**: measure page request waterfalls (baseline plan), then move large pickers to server search.
- **Regression risk**: Medium (UX).
- **Tests required first**: Playwright traces for the invoice and customer pages.

---

## LOW

### L-01: Two routers share `/api/v1/accounting/reports`

- **Module**: Accounting reports routing
- **Files / functions**: `app.ts:575` (`financial-reports.routes.ts`, 30 s default timeout) and `app.ts:597` (`reports.routes.ts`, 60 s report timeout).
- **Verification**: Confirmed in code.
- **Evidence**: two `app.use('/api/v1/accounting/reports', ...)` mounts.
- **Current behavior**: for duplicate paths the first router wins; the heavier statements (ledger, trial balance) get the shorter timeout.
- **Why it matters**: behavior depends on mount order; fixes can land in the router that never serves the path.
- **Correctness risk**: Low. **Performance risk**: Low (see H-05). **Concurrency risk**: None. **Security risk**: None.
- **Safest remediation**: document path ownership; add a test that lists duplicate paths across the two routers.
- **Regression risk**: Low.
- **Tests required first**: route inventory test.

### L-02: Overlapping API stacks for the same resources

- **Module**: API surface
- **Files / functions**: `/api/v1/inventory/invoices` and `/api/v1/invoices` (both create and post invoices); `/api/v1/inventory/items` and `/api/v1/items` (same router); `/permissions` and `/rbac/permissions`; accounting `treasury-receipts` / `treasury-payments` and module `treasury/cash-transactions`.
- **Verification**: Static review.
- **Evidence**: separate `app.use` mounts in `app.ts` (about 456-467, 534-535, 594).
- **Current behavior**: different screens may call different stacks for the same resource.
- **Why it matters**: fixes applied to one path can miss the other.
- **Correctness risk**: Low to Medium. **Performance risk**: None. **Concurrency risk**: None. **Security risk**: Low (two authorization surfaces).
- **Safest remediation**: map which UI uses which path before consolidating.
- **Regression risk**: Medium.
- **Tests required first**: API contract tests for both paths.

### L-03: Some document numbers are allocated outside the business transaction

- **Module**: Accounting numbering
- **Files / functions**: `journal-posting.service.ts` `createJournalEntry` (`nextGlNumber` before the create transaction); `securities-receipt.service.ts` create (`nextNumberForFamily` before the create transaction).
- **Verification**: Static review.
- **Evidence**: numbering calls precede `prisma.$transaction` in both functions.
- **Current behavior**: a failed create consumes a number; duplicates are still prevented by the sequence row lock.
- **Why it matters**: gaps in voucher numbering can raise audit questions.
- **Correctness risk**: Low. **Performance risk**: None. **Concurrency risk**: Low. **Security risk**: None.
- **Safest remediation**: use the `InTx` variants inside the create transaction.
- **Regression risk**: Low.
- **Tests required first**: a create-failure test asserting no number is consumed.

### L-04: Route-level catch blocks bypass the central error mapping

- **Module**: Backend routes
- **Files / functions**: many handlers, for example `operations-management.routes.ts` (the service's 403 becomes 500) and invoice routes.
- **Verification**: Confirmed for operations management; widespread pattern from static review.
- **Evidence**: `catch (error) { res.status(500).json({ message: error.message }) }` instead of `next(error)`.
- **Current behavior**: wrong status codes and raw Prisma messages can reach users.
- **Why it matters**: the frontend cannot distinguish validation, permission and server errors reliably.
- **Correctness risk**: Low. **Performance risk**: None. **Concurrency risk**: None. **Security risk**: Low (raw internal messages).
- **Safest remediation**: pass errors to `next(error)` route by route.
- **Regression risk**: Low.
- **Tests required first**: API tests asserting status codes for common failures.

### L-05: Backend liveness check depends on the database

- **Module**: Deployment and health
- **Files / functions**: `app.ts` health routes, `health-checker.ts` (`/health/live` runs `SELECT 1`); Railway health check path `/health/live`.
- **Verification**: Static review.
- **Evidence**: liveness and readiness both touch the database.
- **Current behavior**: a brief database outage makes the API look dead to the platform.
- **Why it matters**: combined with H-04, a slow migration or database restart can fail a deploy.
- **Correctness risk**: None. **Performance risk**: None. **Concurrency risk**: None. **Security risk**: None. **Availability risk**: Low.
- **Safest remediation**: keep `/health/ready` for the database and make `/health/live` process-only.
- **Regression risk**: Low.
- **Tests required first**: health endpoint tests with the database down.

### L-06: Chart of accounts prefetch uses a different URL than the page

- **Module**: Frontend navigation
- **Files / functions**: `gates-web/lib/navigation/route-prefetch-registry.ts` (prefetches `/accounting/accounts/hierarchy`); `lib/hooks/useChartOfAccounts.ts` (fetches `/accounting/accounts/tree` with `staleTime: 0`).
- **Verification**: Static review.
- **Evidence**: different URLs and query keys for the same screen.
- **Current behavior**: the prefetch is wasted and the page always refetches.
- **Why it matters**: extra load on a heavy endpoint.
- **Correctness risk**: None. **Performance risk**: Low. **Concurrency risk**: None. **Security risk**: None.
- **Safest remediation**: align the URL and key.
- **Regression risk**: Low.
- **Tests required first**: none beyond a manual network check.

### L-07: Integrity-check queue connects to Redis at import time

- **Module**: Background jobs
- **Files / functions**: `gates-backend/src/shared/jobs/integrity-check.job.ts`.
- **Verification**: Static review.
- **Evidence**: `Queue` and `Worker` are constructed at module load, unlike the lazy proxies used by other queues.
- **Current behavior**: importing the module opens Redis connections even where the job is not needed.
- **Why it matters**: extra connections and startup coupling to Redis.
- **Correctness risk**: None. **Performance risk**: Low. **Concurrency risk**: None. **Security risk**: None.
- **Safest remediation**: lazy construction like the other queues.
- **Regression risk**: Low.
- **Tests required first**: worker startup smoke test.

---

## INFORMATIONAL

### I-01: Manual journal unposting flips a posted entry back to draft

- **Module**: Accounting journals
- **Files / functions**: `journal-posting.service.ts` `unpostJournalEntry` (about 1180-1270).
- **Verification**: Confirmed in code.
- **Evidence**: sets `isPosted: false`, `postingStatus: 'UnPost'`, clears `activeSourceKey`, after inverting period, partner and manual party caches.
- **Current behavior**: allowed only for non-sourced, unreversed manual entries, gated by the `GLUnPost` company flag and advanced rights; reversal and year-close entries are refused.
- **Why it matters**: it is a deliberate exception to the reverse-and-repost rule used for document journals; audit trails show the entry changing state rather than a contra entry.
- **Correctness risk**: Low (caches inverted in the same transaction). **Performance risk**: None. **Concurrency risk**: Low. **Security risk**: None.
- **Safest remediation**: none without an accounting decision; keep it documented.
- **Regression risk**: High if changed without product agreement.
- **Tests required first**: existing journal tests; an unpost-edit-repost test.

### I-02: Dead or retired code that would be unsafe if revived

- **Module**: Accounting, inventory, platform
- **Files / functions**: `journal-posting.service.ts` `replacePostedJournalInTx` (rewrites posted lines in place; no callers); `purchase-return.service.ts` `postPurchaseReturn` (changes stock and decrements the supplier balance without any journal entry; its routes return 410); `src/dbReadWrite.ts` and `shared/database/prisma-read.ts` (extra Prisma clients; not imported); `query-optimizer.ts` `optimizeTable` (interpolates a table name into `$executeRawUnsafe`; no route uses it).
- **Verification**: Confirmed in code, except `query-optimizer.ts` (static review).
- **Evidence**: no import or call sites found; purchase-return post and unpost routes answer 410.
- **Current behavior**: not reachable from the API today.
- **Why it matters**: a future change could call them and bypass the posting rules or open raw SQL.
- **Correctness risk**: None today. **Performance risk**: None. **Concurrency risk**: None. **Security risk**: Low (latent).
- **Safest remediation**: remove in a dedicated cleanup change, or mark clearly as retired.
- **Regression risk**: Low.
- **Tests required first**: typecheck and existing suites.

### I-03: Delete-cancelled and post-all are disabled

- **Module**: Operations management
- **Files / functions**: `operations-management.service.ts` `deleteCancelledOperations`, `postAllOperations`; `operations-management.routes.ts` `/delete-cancelled`.
- **Verification**: Confirmed in code.
- **Evidence**: both service methods throw 403; the route still contains "skip password verification" comments and returns 500 for the 403 (L-04).
- **Current behavior**: the operations are unavailable, safely.
- **Why it matters**: if either is ever re-enabled, the password check and the original data-integrity problems must be addressed first.
- **Correctness risk**: None today. **Performance risk**: None. **Concurrency risk**: None. **Security risk**: Low (latent).
- **Safest remediation**: keep disabled; remove the misleading comment when the route is next touched.
- **Regression risk**: None.
- **Tests required first**: none.

### I-04: zod 3 on the backend, zod 4 on the frontend

- **Module**: Validation
- **Files / functions**: `gates-backend/package.json` (`zod ^3.23.8`), `gates-web/package.json` (`zod ^4.3.6`).
- **Verification**: Static review.
- **Evidence**: package manifests.
- **Current behavior**: each app validates independently with its own schemas.
- **Why it matters**: schemas cannot be shared between the apps without adaptation.
- **Correctness risk**: Low (rules can diverge). **Performance risk**: None. **Concurrency risk**: None. **Security risk**: None.
- **Safest remediation**: none needed now; note it for any shared-contract work.
- **Regression risk**: Medium if upgraded broadly.
- **Tests required first**: validation tests on both sides before any upgrade.

### I-05: No error tracking service; metrics are hand-written

- **Module**: Observability
- **Files / functions**: `shared/monitoring/metrics.ts`, `shared/monitoring/tracing.ts`; no Sentry in either app.
- **Verification**: Static review.
- **Evidence**: no error-tracking dependency; `/metrics` is served from an in-memory collector.
- **Current behavior**: errors are visible only in logs; metrics reset on restart and are per process; tracing is opt-in.
- **Why it matters**: production problems are found by users first.
- **Correctness risk**: None. **Performance risk**: None. **Concurrency risk**: None. **Security risk**: None.
- **Safest remediation**: see the baseline plan for measurement tooling; choose error tracking separately.
- **Regression risk**: Low.
- **Tests required first**: none.

### I-06: Mixed decimal scales

- **Module**: Schema
- **Files / functions**: `schema.prisma` money and quantity fields.
- **Verification**: Confirmed in code (sampled fields).
- **Evidence**: money `DECIMAL(18,4)` for journal lines, invoices and costs versus `DECIMAL(15,2)` for party, safe, bank and treasury amounts; quantities `DECIMAL(18,4)` on invoice lines and stock caches versus `DECIMAL(15,3)` on many stock document lines; exchange rates `(18,6)`, `(15,6)`, `(15,4)`.
- **Current behavior**: values round when moving between scales.
- **Why it matters**: small differences accumulate in caches (see M-07) and in quantity conversions.
- **Correctness risk**: Low to Medium. **Performance risk**: None. **Concurrency risk**: None. **Security risk**: None.
- **Safest remediation**: measure drift first; widen columns only with a migration plan.
- **Regression risk**: Medium.
- **Tests required first**: rounding tests on representative amounts.
