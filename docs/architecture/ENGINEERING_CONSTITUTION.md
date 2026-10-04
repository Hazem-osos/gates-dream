# Gates ERP engineering constitution

Status: adopted 27 September 2026. Applies to every change made to Gates by people or AI agents.

This is the working contract for changing Gates without breaking it. It is derived from how the system actually works (`CURRENT_ARCHITECTURE.md`) and from the failure modes found in the discovery audit (`ARCHITECTURE_AUDIT.md`). Where a rule mentions an audit ID (for example H-01), read that finding for the evidence.

The short, always-loaded versions of these rules live in `.cursor/rules/`. When a rule file and this document disagree, this document wins and the rule file should be corrected.

---

## 1. Core engineering principles

- Preserve existing business behavior unless the task explicitly changes it. Inputs, outputs, numbers, permissions and screens stay the same by default.
- Prefer small, incremental changes over broad rewrites.
- Understand the affected workflow before editing: read the route, the service, and the tables it touches.
- Accounting and inventory correctness has priority over code cleanliness.
- Never introduce a new architectural pattern merely because it looks cleaner.
- Reuse existing Gates patterns before creating new abstractions. Most problems (posting, locking, numbering, tenancy, caching, queues) already have a canonical implementation listed in this document.
- Measure before large optimizations (section 20).
- Database correctness must not depend only on frontend behavior. Buttons, disabled states and client validation are convenience, not protection.
- Concurrency must be considered for every business mutation: assume two requests can arrive at the same time.

---

## 2. Existing architecture that must be respected

| Layer | What Gates uses | Where |
|---|---|---|
| Frontend | Next.js 15 (App Router, mostly client pages), React 19, TanStack Query 5, react-hook-form + zod | `gates-web/` |
| Frontend data access | `apiClient` + `useApiQuery` / `useApiMutation` / `useInvalidateQuery`, query keys in `queryKeys` | `gates-web/lib/api/client.ts`, `gates-web/lib/hooks/useApi.ts`, `gates-web/lib/query/query-keys.ts` |
| Backend | Express 4; **route handler -> service -> Prisma** | `gates-backend/src/modules/<module>/{routes,services,schemas}` |
| Cross-cutting backend | `authorize`, `validate` (zod), `setTenantContext`, `errorHandler` / `AppError`, `asyncHandler` | `gates-backend/src/shared/middleware/` |
| Database | MySQL through Prisma 5, one schema file | `gates-backend/prisma/schema.prisma` |
| Shared Prisma client | one client with the tenant-scoping extension | `gates-backend/src/shared/database/prisma.ts` |
| Background work | BullMQ queues and processors in a worker process (same codebase, `GATES_RUN_WORKERS`) | `gates-backend/src/workers/` |
| Cache / sessions / rate limits | Redis (optional, degrade gracefully) | `gates-backend/src/shared/cache/` |
| Hosting | Railway: `gates-web`, `gates-backend`, `gates-workers`, MySQL, Redis | `railway.json` per app |

Do not introduce repositories, controllers-everywhere, microservices, GraphQL for new features, another ORM, another database, another state-management library, or another queue system unless a task explicitly requires and approves it.

---

## 3. Change workflow

For any non-trivial feature or modification, do a short impact analysis before coding. Identify:

- affected frontend pages and components
- affected endpoints (method and path; remember two routers share `/api/v1/accounting/reports`, audit L-01)
- affected services and shared helpers
- affected Prisma models and whether each has `companyId`
- the source of truth for the data (journal lines, `InventoryMovement`, a document table) and which caches depend on it
- the existing canonical pattern for this kind of change (sections 6 to 11)
- the transaction boundary
- concurrency risks (double click, retry after timeout, two users)
- tenant isolation (direct `companyId` or verified parent)
- permissions (`authorize({ resource, action })`) and validation (`validate`)
- expected query pattern and data growth
- pagination implications (including the global GET limit, section 5)
- cache implications (section 15)
- tests affected or needed

For high-risk changes (posting, reversal, numbering, balances, stock, cost, tenancy, schema), write the plan first and get agreement before implementing.

Do not add ceremony to trivial changes: copy text, styling, labels and purely visual layout need no impact analysis.

---

## 4. Database access rules

- **No accidental unbounded reads** from growing transactional tables: `journal_entries`, `journal_entry_lines`, `invoices`, `invoice_lines`, `inventory_movements`, `cash_transactions`, stock document lines, activity logs. Every read is bounded by date range, a page, or an explicit aggregate. (Audit H-05, M-08.)
- **No database query inside a loop** when a set-based or batched query can do the same work (`findMany` with `in`, `groupBy`, `createMany`, one raw aggregate). Loops over a small, fixed set (for example the lines of one document inside its posting transaction) are fine. (Audit H-02, M-08: per-bank-per-month queries, per-party aggregates, per-row updates.)
- **Do not load a large dataset only to paginate, filter or sort it** in Node or in the browser. Push `WHERE`, `ORDER BY`, `LIMIT` and `GROUP BY` into the query.
- Use `select` when large relations or columns are not needed; avoid deep `include` trees on list endpoints.
- Before adding an index, read the existing `@@index` / `@@unique` entries of the model. New indexes must match a real, measured access pattern; capture `EXPLAIN` or `EXPLAIN ANALYZE` for the query being optimized. No speculative indexes.
- Respect existing foreign keys and unique constraints; they are part of the business rules.
- Business uniqueness should be enforced by the database where appropriate (unique constraints with the correct scope), not only by application checks. Adding a constraint to existing data requires a duplicate check first (audit M-04).
- Raw SQL uses tagged templates (`Prisma.sql`, `Prisma.join`) with bound parameters. `Prisma.raw` only for fixed identifiers you control; never with user input. Remember raw SQL bypasses the tenant extension: include `companyId` explicitly (see `journalEntryFilterSql` in `financial-report.service.ts`).

There is no rule of the form "every endpoint must use at most N queries". Judge query counts by data growth and measurements.

---

## 5. Pagination and search

- Lists that can grow must not rely on downloading the whole dataset.
- **Audit M-01 lesson**: the global middleware `defaultQueryLimits` (`gates-backend/src/shared/middleware/query-limits.middleware.ts`, mounted on `/api/v1`) rewrites every GET `limit`: missing becomes 50, anything above 1000 becomes 1000. A frontend asking for 20,000 rows receives at most 1,000, silently. Do not "fix" truncation by raising the global cap.
- New pickers and dropdowns must be designed for datasets larger than 1,000 records: server-side search with a small page. The canonical example is `ItemSelect` (`gates-web/app/components/form/ItemSelect.tsx`), which calls `useItemsQuery(PICKER_PAGE_SIZE, search)` with `PICKER_PAGE_SIZE = 30` (`gates-web/lib/hooks/useMasterDataQueries.ts`) and loads the selected record by id.
- Server list endpoints accept `page` / `limit` (or `skip`) and return totals; use `clampPageSize` (`gates-backend/src/shared/pagination.ts`) or the existing per-service clamp.
- When pagination is added to a report that carries running balances or totals, the balance must be carried correctly across pages (section 22).

---

## 6. Transaction rules

- A business operation that must succeed or fail as one unit uses **one** `prisma.$transaction(async (tx) => ...)`. Examples: document posting; unposting and reversal; editing a posted financial document; inventory posting; the balance and cache updates that belong to a posting.
- Do not split dependent business state across independent transactions. Audit H-03: editing a posted cash voucher saves the voucher in one transaction and rewrites its journal in another; a failure between them leaves voucher and ledger disagreeing. New code must not repeat this.
- Use the existing in-transaction variants and pass the same `tx` through: `createAndPostInTx`, `reverseJournalEntryInTx`, `cascadeSourceJournalInTx` (`journal-posting.service.ts`); `autoGlPostingService.commitInTx`; `documentSequenceService.nextNumberInTx` / `nextNumberForFamilyInTx` / `nextGlNumberInTx`; `stockMovementService.postMovementInTx`; `inventoryCostingService.applyInboundMovement` / `applyOutboundMovement` / `reverseInboundInTx`; `applyPostedJournalBalancesInTx` (`ledger-balance.service.ts`).
- Allocate document numbers inside the same transaction that creates the document (audit L-03).
- Never hold a transaction open while calling a slow external service (OpenAI, Meta, ETA, SMTP, n8n). Do external work before (prepare) or after (enqueue a job) the transaction.
- Keep transaction scope sufficient for correctness and no larger: read-only preparation (account resolution, validation that does not need locks) can happen before the transaction; checks that protect against races must happen inside it.
- The global interactive-transaction defaults are `maxWait` 15 s and `timeout` 30 s (`shared/database/prisma.ts`). If an operation legitimately needs longer, it probably belongs in a background job (section 16).
- Not every write needs an explicit transaction: a single-row update or a single Prisma call is already atomic.

---

## 7. Concurrency rules

Every mutation of shared business state must be safe when two requests run at the same time: posting, unposting, stock changes, moving average cost, document numbering, payments, balances and status transitions.

**Never rely on "read, check, then transaction".** A check done before the transaction (or inside it without a condition on the write) does not stop a second request that passed the same check. Audit H-01: `postTransfer` checks `isPosted` before its transaction and sets it unconditionally at the end, so two simultaneous posts both move stock.

Reuse the canonical Gates mechanisms:

| Problem | Canonical implementation |
|---|---|
| Claim a document for posting / unposting | `claimDocumentPost` / `claimDocumentUnpost` (`gates-backend/src/modules/inventory/utils/claim-document-post.ts`): conditional `updateMany` on `isPosted`, count must be 1, first statement inside the transaction, called as `claimDocumentPost((args) => tx.receipt.updateMany(args), id, companyId)`. Used by receipts, issues, stocktaking, assembly, disassembly. |
| Claim an invoice for posting | `invoicePostingOrchestrator.post` (`modules/invoices/services/invoice-posting-orchestrator.ts`): `tx.invoice.updateMany({ where: { id, companyId, isPosted: false, isCancelled: false } })` |
| Claim a manual journal for posting | `journalPostingService.postJournalEntry`: conditional `updateMany` on `isPosted: false` |
| One active posted journal per source document | `activeSourceKey` (unique), set by `createAndPostInTx` (`claimActiveSourceKey` defaults to true) |
| Document numbers | `documentSequenceService` (`modules/platform/services/document-sequence.service.ts`): sequence row locked `FOR UPDATE`, retries on conflicts in the standalone variants |
| Stock and cost rows | `stockMovementService.lockStockRowsInTx` / `postMovementInTx`, `adjustStockInTx` (`SELECT ... FOR UPDATE`, atomic `INSERT ... ON DUPLICATE KEY UPDATE`), lines sorted with `sortForStockLocking` (`modules/inventory/utils/stock-lock-order.util.ts`) |
| Balance caches | atomic `increment` / `decrement` or `INSERT ... ON DUPLICATE KEY UPDATE` (never read-compute-write) |
| Draft edits | optimistic `version` checks: `assertExpectedVersion`, `assertUpdateCount` (`gates-backend/src/shared/concurrency/optimistic-lock.ts`) |

Do not invent a new locking mechanism when one of these solves the problem. When locking several rows, keep the existing lock order to avoid deadlocks.

---

## 8. Idempotency and duplicate submission

- Posting and other irreversible or high-impact actions must tolerate double clicks, browser retries, retries after a slow response or timeout, and two users acting at once.
- A disabled button in the frontend is not concurrency protection.
- Prefer database-backed atomic claims (section 7) and unique business keys (`activeSourceKey`, unique document numbers).
- Create-and-post endpoints (for example cash vouchers that auto-post) can create duplicates when a client retries after a timeout (audit M-02). New endpoints of this kind should accept an idempotency key or be designed so a retry is detected.
- When integrating external systems (ETA submissions, WhatsApp messages, email), use explicit idempotency keys where the provider or the automation layer supports them (the automation email and WhatsApp handlers already claim sends).
- Source keys must be built from values that are unique for the document. Audit M-03: stock GL entries use a user-entered, non-unique `serial` in `activeSourceKey`, so two documents with the same serial block each other.

---

## 9. Accounting invariants

These are mandatory.

- **Source of truth**: journal lines of entries that are posted (`isPosted = true`), not cancelled (`isCancelled = false`) and not deleted (`deletedAt IS NULL`), summed in base currency with `debitBase` / `creditBase`.
- **Caches are not truth**: `account_period_balances`, `partner_running_balances`, `customers.balance`, `suppliers.balance`, `safes.balance`, `bank_accounts.balance`. They exist for speed and must be updated in the same transaction as the posting that changes them (`applyPostedJournalBalancesInTx`, document services, `applyManualPartyBalances` for manual journals).
- **Posting path**: documents post through `journalPostingService.createAndPostInTx` (directly or through `autoGlPostingService.commitInTx`), which checks the fiscal period (`fiscalYearService.assertOpenForDate`), balances the entry in base currency (`assertJournalBalanced`, 4-decimal equality), allocates the GL number in the transaction, claims `activeSourceKey`, and updates caches.
- **Corrections**: posted documents are corrected by a dated reversing entry plus a new posted entry (`reverseJournalEntryInTx`, `cascadeSourceJournalInTx`). The original stays posted. Documented exception: manual, non-sourced journals may be unposted by `unpostJournalEntry` when the company flag and advanced rights allow it (audit I-01). Do not add new exceptions without an accounting decision.
- **Do not revive** `replacePostedJournalInTx` (in-place rewrite of posted lines) or the retired `postPurchaseReturn` (changes supplier balance without a journal) (audit I-02).
- **Never silently rewrite historical accounting behavior.** Never change decimal handling (`roundTo4`, `amountsEqualAt4`, `mulToDecimal4`), posting logic, source keys, reversal behavior, fiscal-period checks or balance calculations as a side effect of an unrelated task.
- **Reports must keep their accounting meaning**: same filters (posted, not cancelled, not deleted), same base amounts, same sign conventions. Group accounts and cost centers include their whole subtree when filtering.
- **Document numbers are legal identifiers**: do not renumber posted or submitted documents (audit H-02).
- Accounting correctness outranks refactoring elegance.

---

## 10. Inventory invariants

- `InventoryMovement` is the inventory ledger and the source of movement history. As-of stock and movement reports read it.
- `ItemWarehouseBalance` (quantity, reserved, moving average cost) and `ItemQuantity` (per location) are current-state caches; `Item.averageCost` and `ItemCostHistory` are cost caches and history.
- Costing is moving weighted average. Inbound movements update the average; outbound movements are valued at the current average. Use `inventoryCostingService.applyInboundMovement`, `applyOutboundMovement`, `reverseInboundInTx`; they call `stockMovementService.postMovementInTx`.
- Stock and cost changes must go through the existing locking path (`lockStockRowsInTx`, `postMovementInTx`, `adjustStockInTx`) with lines sorted by `sortForStockLocking`. Negative-stock checks happen after the locks, inside the transaction.
- Posting must be safe under concurrency: claim the document first (`claimDocumentPost`).
- Unposting or reversal must reverse exactly the effects of the original posting: the same movements, quantities and costs, in the same transaction.
- Never write `ItemWarehouseBalance`, `ItemQuantity` or average costs directly as a shortcut around the movement architecture. Repairs use `recalculateItemCostHistory`, not ad-hoc updates.
- Warehouse transfers post both legs in the same transaction at the outbound unit cost.
- Known gaps to keep in mind (do not copy them): POS and manufacturing issues post movements without the costing service, and purchase-invoice unpost repairs cost after its transaction commits (audit M-09).

---

## 11. Multi-tenancy

- Tenant isolation is mandatory. The authenticated company context is authoritative: `req.companyId` set by `setTenantContext` (`gates-backend/src/shared/middleware/tenant.middleware.ts`) from the JWT. An `X-Company-Id` header that disagrees with the token is rejected.
- Never trust a client-provided company id (body, query or header) by itself.
- Every company-owned read and write is scoped to the authenticated company, either directly (`where: { id, companyId }`) or through a verified company-owned parent.
- About 80 models have no `companyId` (journal lines, invoice lines, stock document lines, `ItemQuantity`, and others). For those, verify ownership through the parent before update or delete. Canonical example: `item-unit.service.ts` deletes filter on `item: { companyId }`.
- The Prisma tenant extension (`shared/database/tenant-scoping.extension.ts`) is a second layer, not the only one. It covers only models listed in `tenant-scoped-models.generated.ts`, does nothing outside a request context or inside `runWithoutTenantScoping`, and never applies to raw SQL. It currently misses five newer models (audit M-10).
- When adding a company-owned model: add `companyId` with the usual relation and indexes, then regenerate the list with `node gates-backend/scripts/generate-tenant-scoped-models.mjs`.
- Cross-company jobs (schedulers, admin maintenance) must use `runWithoutTenantScoping` deliberately and filter by company explicitly.

---

## 12. Authorization and validation

- Frontend permission checks (`useResourcePermissions`, hidden buttons) are UX only.
- Sensitive actions are authorized on the backend with `authorize({ resource, action })` (`shared/middleware/authorize.middleware.ts`) and, where the module already does, the extra checks: advanced posting rights (`advancedRightsService.assertCanPostFamily`), company flags (`GLPost`, `GLUnPost`), owner-only checks for backups, branch scoping.
- All external input is validated server-side with zod through `validate({ body | query | params })` (`shared/middleware/validate.ts`).
- Do not bypass the central permission model for convenience, and do not add custom permission logic when a resource/action pair fits.
- Destructive or bulk admin tools need explicit authorization and, where the product calls for it, re-authentication. Do not ship a "password check skipped" placeholder (audit I-03).

---

## 13. API design

- There is no maximum number of HTTP requests per page.
- Avoid accidental request waterfalls (request B waiting for A when both could start together) and duplicate requests for the same data under different query keys.
- Use TanStack Query caching correctly (section 14) instead of refetching the same master data on every screen.
- Avoid huge payloads; return what the screen needs.
- Combine tightly coupled page bootstrap data into one endpoint only when it produces a clearer use-case API. Do not create giant "return everything" endpoints.
- Preserve API contracts when optimizing unless a deliberate migration is planned. Several resources already have overlapping endpoints (audit L-02); check which one the UI uses before changing either.

---

## 14. Frontend data rules

- Respect the existing TanStack Query architecture: `useApiQuery`, `useApiMutation`, `useInvalidateQuery` (`gates-web/lib/hooks/useApi.ts`), keys from `queryKeys` and stale times from `staleTimes` (`gates-web/lib/query/query-keys.ts`).
- Use stable query keys; reuse the shared key for the same resource so caches are shared (prefetch and page must use the same URL and key; audit L-06).
- Invalidate the relevant queries after mutations.
- Do not copy server state into global client state (zustand is used sparingly and should stay that way).
- Do not load massive datasets solely for dropdowns or client-side filtering (section 5).
- Large reports should not require the browser to hold full datasets when the server can filter, aggregate or paginate. `UniversalReportView` filters and sorts every row in memory today (audit M-14); do not extend that pattern to reports that can grow without bound.
- Do not optimize request count at the expense of correctness or maintainability.

---

## 15. Caching rules

- Do not cache data to hide a slow query. First find out why the query is slow (section 20).
- For every new cache define: source of truth, cache key, company scope, TTL, invalidation, and the consequence of stale data.
- Financial and inventory correctness must never depend on cached data: posting, balance checks, stock availability and costing read the database inside the transaction.
- Reuse the existing infrastructure: HTTP response cache (`cache.middleware.ts`, keys hashed with company, user, branch and fiscal year), query cache (`query-cache.ts`, tags), tenant metadata cache (`tenant-metadata-cache.ts`, keys with `companyId`), invalidation bus (`gates:cache:invalidate`). Keys must include the company.
- Redis is optional in Gates; code must keep working when it is disabled.

---

## 16. Heavy work and background jobs

- Potentially long, company-wide operations should not run synchronously inside normal HTTP requests: large imports, large exports, backups, mass recalculation, large report generation, bulk repair. Audit H-07 lists the current offenders (fix average cost, renumbering, exports, tenant backup, onboarding import).
- Reuse BullMQ: queues through `getAsyncQueue` (`gates-backend/src/workers/queue-manager.ts`) and `workers/queues/*.queue.ts`, processors in `workers/processors/`, job status and artifacts helpers in `workers/lib/`.
- The request enqueues the work and returns a job id or status resource; the UI polls or is notified.
- Jobs must be idempotent or claim their work, carry `companyId` in the payload, and run inside the right tenant context.
- Do not move ordinary, fast CRUD into queues.

---

## 17. External HTTP calls

- Every external call has an explicit timeout (`AbortSignal.timeout(...)` or the client's timeout option). The n8n dispatch and inventory webhook clients already do this; OpenAI, Meta WhatsApp and ETA clients do not yet (audit M-13).
- Decide the retry policy per call. `shared/resilience/retry.ts` and `circuit-breaker.ts` exist; retries of side-effecting calls need an idempotency key or a claim.
- Do not hold a database transaction open while waiting for an external service.
- Retries must never duplicate accounting or inventory effects.

---

## 18. Timeouts

- The request timeout middleware (`shared/middleware/request-timeout.middleware.ts`: 30 s default, 60 s for report mounts that opt in, 180 s for AI) sends a 408 response. **It does not cancel the handler or its transaction.** The work may still commit after the client saw an error.
- Therefore timeout handling is never transaction cancellation, and clients may retry after a timeout.
- High-impact mutations must stay duplicate-safe even when the first request keeps running (sections 7 and 8).
- Heavy report routers must be mounted with the report timeout deliberately; the financial-reports router currently is not (audit H-05, L-01).

---

## 19. Error handling

- Prefer the central `errorHandler` (`shared/middleware/error-handler.ts`): throw `AppError(status, message)` from services, use `asyncHandler` or `next(error)` in routes. Avoid route-level `catch` blocks that turn every error into 500 (audit L-04).
- Known Prisma errors are mapped centrally (P2002 409, P2025 404, P2003 409, P2014 400). P2034 (deadlock or serialization failure) is not mapped yet (audit M-06); handle it as a retryable conflict, never as success.
- Concurrency and deadlock errors must roll back cleanly; never swallow them.
- Do not blindly retry an entire business mutation unless it is proven idempotent (claims and unique keys make a retry safe).
- User-facing messages stay in Arabic, consistent with existing messages.

---

## 20. Performance

- Performance decisions are evidence-driven. For important workflows measure p50 / p95 / p99 latency, query count and query duration, response size, CPU, memory, database connections, lock waits and error rate.
- `PERFORMANCE_BASELINE_PLAN.md` is the canonical measurement plan: dataset tiers, workflows, concurrency tests and tools.
- Do not claim a feature is scalable from code inspection alone.
- Small, obviously safe improvements (adding `select`, bounding an unbounded query that serves a paged screen) do not need a full baseline; large optimizations do (new indexes on big tables, caching layers, pagination of accounting reports, query rewrites of core reports).

---

## 21. Database connections

- Reuse the shared client from `gates-backend/src/shared/database/prisma.ts`. Never instantiate `PrismaClient` per request or per module in application code (scripts and tests may create their own).
- The pool size is currently whatever Prisma derives, because `connection_limit` is only logged, not applied (audit M-11). When changing deployment scale, account for (API instances + worker processes) x pool size against MySQL's connection limit.
- Do not guess pool sizes; measure actual deployment behavior first.

---

## 22. Reports

Reports over growing transactional data need a specific review:

- bounded date ranges and server-side filtering
- pagination or streaming where the result can be large
- aggregation strategy (period-balance summaries versus live journal sums) and when each is correct
- indexes that support the query (read the model's indexes; `journal_entry_lines` has no company, date or cost-center index, audit M-05)
- memory use on the server and in the browser
- timeout behavior (report routers and the 408 behavior, section 18)
- no rebuilds of caches inside a report request (audit H-06)

If pagination is introduced, running balances and accounting totals must remain mathematically correct across pages (opening balance per page, totals over the full range). Do not optimize a report by changing its accounting meaning.

---

## 23. Schema and migrations

- Never modify the Prisma schema casually as part of unrelated work.
- A schema change needs: migration impact review; compatibility with existing data (duplicates before new uniques, nulls before required columns); index and constraint review; deployment impact; rollback and recovery thinking.
- Never use destructive schema changes (drop, narrow, retype) merely to simplify application code.
- Migrations are applied by `prisma migrate deploy` on backend start (`gates-backend/scripts/railway-start.mjs`, audit H-04). A failing migration stops the API from starting, so migrations must be rehearsed against a production-like copy.
- Never resolve a failed production migration as rolled back without verifying which migration failed and the actual database state.

---

## 24. Testing

- For a bug fix, first write or identify a test that demonstrates the bug whenever practical.
- For accounting, inventory and concurrency changes, prefer integration tests against real MySQL (`gates-backend/src/__tests__/integration/`) when mocks cannot reproduce locks, unique constraints or transactions.
- Posting flows should be tested for: normal posting, duplicate and concurrent posting, unposting, reposting, and rollback on failure.
- Keep existing tests passing; do not delete or weaken a test to make a change pass.
- Backend: Jest (`NODE_OPTIONS=--max-old-space-size=4096`, pass file paths, `--forceExit`). Frontend: vitest for `lib/`, Playwright for flows. Backend typecheck needs a large heap (`--max-old-space-size=8192`).

---

## 25. Regression protection

- Every architecture fix preserves existing external behavior unless a change is explicitly approved.
- Before modifying a risky workflow, record its current inputs and outputs (a golden-output test, a fixture, or at minimum a documented example).
- After modifying it, verify the same outputs again.
- Architecture cleanup is not permission to redesign the product.

---

## 26. Observability

- New important workflows should be diagnosable: log key steps with the existing pino logger (`gates-backend/src/shared/logger.ts`), including `companyId` and document ids.
- Reuse OpenTelemetry (`shared/monitoring/tracing.ts`), `/metrics` (`shared/monitoring/metrics.ts`) and the query monitor (`shared/database/query-monitor.ts`, which currently probably receives no events, audit M-12).
- Never log secrets, access tokens, passwords, API credentials (WhatsApp, SMTP, ETA, OpenAI) or full financial payloads.

---

## 27. Security

- Preserve authentication (`apiAuthGate`, JWT), company isolation, authorization, CSRF protection, validation, sanitization and rate limiting as wired in `gates-backend/src/app.ts`.
- Never weaken security middleware to make a feature work. If a new public endpoint is needed (webhooks), follow the existing pattern for the Meta webhook and internal automation endpoints, with their own verification.
- Encrypted credentials (company WhatsApp and email settings) stay encrypted at rest and are never returned to the client.

---

## 28. AI / Cursor working protocol

This section is mandatory for AI agents.

### Before implementation

1. Read the relevant existing implementation (route, service, schema model, page).
2. Search for a similar canonical implementation in Gates (sections 6 to 11).
3. Identify the affected source of truth and the caches that depend on it.
4. Identify the transaction boundary.
5. Check concurrency: what happens if this runs twice at the same time?
6. Check tenant isolation, including child models without `companyId`.
7. Check permissions and validation.
8. Check query growth and pagination (including the global 1,000-row cap).
9. Check the relevant tests.
10. Prefer the minimal change.

### During implementation

- Do not rewrite unrelated code.
- Do not change APIs unless required.
- Do not change business behavior accidentally.
- Reuse existing helpers and services.
- Keep financial and inventory changes atomic.
- Do not introduce N+1 queries or unbounded reads.

### After implementation

Report:

- files changed
- behavior changed intentionally
- database or schema changes
- API changes
- queries and access patterns introduced
- transaction and concurrency handling
- tests run
- build and typecheck results
- remaining risks

If the change affects accounting, inventory, posting, numbering, balances or tenant isolation, state explicitly how correctness is preserved.
