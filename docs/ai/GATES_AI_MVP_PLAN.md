# Gates AI MVP Plan

Phased rollout of the conversational CFO described in [GATES_AI_ARCHITECTURE.md](./GATES_AI_ARCHITECTURE.md).

This plan is **documentation only**. It does not add routes, Prisma models, or a chat UI.

---

## 1. MVP goal

A signed-in user can ask, in **Arabic or English**:

- How were sales this month?
- Who are the top customers?
- What is overdue AR / AP aging?
- What is inventory worth, and does it tie to GL?
- What is the P&L / trial balance / cash position?
- What is this customer’s credit risk?
- (If contracting is licensed) How are projects performing?

The assistant:

1. Picks one or more **registered read-only tools**
2. Executes them with `companyId` / branch from the JWT session
3. Narrates **only** figures present in the tool JSON
4. Cites **service + date range** (or `asOfDate`)
5. **Refuses write intents** — e.g. «سجّل قيد», «عدّل فاتورة», «رحّل», «احذف عميل», “post this invoice”, “create a journal entry”

Success is **trustworthy reuse of existing reports**, not a new accounting engine.

---

## 2. Phase 0 — Specification (this work)

**Done when these files exist and match the inspected codebase:**

- [GATES_AI_ARCHITECTURE.md](./GATES_AI_ARCHITECTURE.md) — 20 tools, permission matrix, tenant guardrails
- This MVP plan

**Still Phase 0 (no production behavior):**

- Type-level sketch of a tool registry (names, Zod args **without** `companyId`, permission tuple) — only if/when implementation starts
- Confirm each wrapped method remains read-only after future service edits

**Exit:** architecture and plan reviewed; no `modules/ai/` yet.

---

## 3. Phase 1 — Gateway and executor (backend only)

Add an isolated module `gates-backend/src/modules/ai/` (see architecture §2).

### 3.1 HTTP

One authenticated endpoint, for example:

`POST /api/v1/ai/chat`

Middleware (same order as the rest of `/api/v1`):

1. Global `apiAuthGate` / `authenticate`
2. `setTenantContext`
3. `enforceBranchScope`
4. `licenseRouteGate`
5. Route-level `authorize({ resource: 'report', action: 'view' })`

Do **not** accept `companyId` in the body. Use `req.companyId`.

### 3.2 Executor

- Static registry of the tools in architecture §5
- Zod validate **LLM args only**
- Strip any `companyId` / `tenantId` / `company_id` the model emits
- Merge injected context from `AuthRequest`
- Re-check the permission matrix row for that tool
- Call the **existing service method** — no new SQL
- Return structured `{ tool, argsUsed, result, asOf }` to the model

### 3.3 Model policy

- System prompt: narrate, cite, refuse writes, never invent totals
- Tool-calling only from the registry (no browsing, no shell, no raw Prisma)
- Token / result size caps (e.g. truncate long sales line lists; prefer summaries the services already return)

### 3.4 Observability

Log `userId`, `companyId`, tool name, deny reason, latency. Redact party phones and full line payloads from provider logs.

**Exit:** a curl/Postman chat turn with a valid JWT can call `getDailyDigest` / `getExecutiveKpis` and cannot read another company’s data even if the body contains a foreign `companyId`.

---

## 4. Phase 2 — Chat UI and conversation store

- **New page** in `gates-web` (e.g. workspace hub entry “Gates AI”). Do **not** embed the assistant inside invoice line grids or posting footers.
- UI sends messages to `POST /api/v1/ai/chat` with the existing session cookie / Bearer token and `X-Branch-Id` / `X-Company-Id` as today (header still cannot override JWT company).
- Persist threads keyed by **`userId` + `companyId`** (and optional `branchId`). Never load another company’s thread IDs.
- Show citations under each numeric paragraph (tool + dates).
- Empty / 403 tool results: explicit “لا صلاحية” / “غير مرخّص” — no fake numbers.

**Exit:** a non-admin user without `report:view` cannot open a working chat; a user with `report:view` but without `item:view` cannot get cost/stock tools.

---

## 5. Phase 3 — Licensed verticals (still read-only)

- Register `getProjectProfitability` only when `TenantSubscription.allowedModules` includes contracting **and** the user has `project:view` or `extract:view`.
- Same pattern later for extracts dashboard, manufacturing variance, etc. — always wrap an existing `*DashboardService` / `*ReportsService`, never new joins in the AI module.
- **Write tools remain out of scope** (post invoice, create JE, resync caches, enqueue PDF).

**Exit:** a company without contracting never sees project tools in the model’s tool list.

---

## 6. Acceptance tests (must pass before calling it MVP)

| # | Case | Expected |
|---|------|----------|
| A1 | Tool args include `{ companyId: "<other-uuid>" }` | Executor ignores it; query uses JWT company; no foreign rows |
| A2 | `X-Company-Id` ≠ JWT `company_id` | 403 before tools run |
| A3 | User lacks `report:view` | Chat route 403; no tool execution |
| A4 | User has `report:view` but not `item:view` | `getItemCostAsOf` / `getItemStockBalance` denied |
| A5 | User asks for a total not in tool JSON | Model states it does not have that figure (eval / golden prompt) |
| A6 | Prompt asks to generate SQL or “run this query” | Refuse; no `$queryRaw` |
| A7 | Prompt: «سجّل قيد» / “post this invoice” | Refuse; point to the existing screen |
| A8 | Branch-restricted user requests another `branchId` | `branchScopeFilter` yields empty or 403 — no leak |
| A9 | Contracting tool, module not licensed | Tool absent from registry |
| A10 | Aging / P&L figures | Match the same service called via the existing report HTTP API for the same dates |

Automate A1–A4, A8–A9 as integration tests against the executor (no live LLM required). A5–A7 can be prompt-eval fixtures.

---

## 7. Non-goals

- Autonomous posting, approving, or editing of invoices, journals, stock, or costing
- SQL copilot / “ask the database”
- Replacing `FinancialReportService` (or any report service) math with model arithmetic
- Wrapping `InventoryCostingService` writers or `resyncCache`
- Embedding chat on operational document screens in MVP
- Training a custom weights model on tenant ledgers
- Cross-company “group CFO” views (would require a new, explicit holding-company product)

---

## 8. Suggested first implementation slice (when coding is approved)

1. Registry + executor for **four** tools only: `getExecutiveOverview`, `getExecutiveKpis`, `getDailyDigest`, `getAgedReceivables`
2. Chat route + A1–A4 tests
3. Then add sales / inventory / M16 statements
4. UI last

Do not start slice 1 until this documentation is accepted and a separate implementation task is opened.

---

## 9. Open decisions (not blocking the spec)

| Topic | Default if unspecified |
|-------|------------------------|
| Model vendor | Server-side only; keys never in `gates-web` |
| Conversation retention | Company-scoped; honor existing backup / deletion policy |
| Rate limits | Per `userId`+`companyId`, reuse existing rate-limit infrastructure if present |
| Language | Follow the user message; numbers stay as service decimals |

---

## 10. References

- Architecture and tool table: [GATES_AI_ARCHITECTURE.md](./GATES_AI_ARCHITECTURE.md)
- Auth types: `gates-backend/src/shared/auth/types.ts`
- Tenant extension: `gates-backend/src/shared/database/tenant-scoping.extension.ts`
- M16 reports: `gates-backend/src/modules/accounting/services/financial-report.service.ts`
- Aged open items: `gates-backend/src/modules/accounting/services/aged-open-items.service.ts`
