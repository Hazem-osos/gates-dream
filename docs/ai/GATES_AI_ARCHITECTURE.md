# Gates AI Architecture

Conversational CFO and business assistant for Gates ERP.

This document is a **design specification**. It does not authorize production code, schema changes, or a live chat endpoint. Implementation belongs in a later phase; see [GATES_AI_MVP_PLAN.md](./GATES_AI_MVP_PLAN.md).

---

## 1. Role

Gates AI answers questions about **numbers the ERP already computes**: sales, receivables, payables, inventory value, GL statements, party risk, and (when licensed) project profitability.

The model **narrates and cites**. It does **not**:

- generate SQL
- invent journal lines
- recompute VAT, discounts, aging buckets, moving average cost, or P&L
- post, approve, or edit documents

If a figure is not present in a tool result JSON, the assistant must say it does not have that figure.

```
User chat
    → AI gateway (JWT + RBAC)
        → Read-only tool registry
            → Existing report / query services
                → Prisma + tenant extension
```

---

## 2. Placement (future)

When code is added, isolate it under:

```
gates-backend/src/modules/ai/
  routes/          # chat / tool-invoke only
  services/        # registry, executor, prompt policy
  schemas/         # tool argument Zod (no companyId)
  types/           # Auth-bound tool context
```

Do **not** mix AI into invoice posting, GL posting, stock movement, or costing writers. Those stay in `modules/invoices`, `modules/accounting`, and `modules/inventory`.

There is **no** first-party AI/chat module in the repo today (`gates-backend/src` and `gates-web`). Related but out of scope: `modules/automation/` (domain-event workers, not conversation).

---

## 3. Hard rules

| Rule | Enforcement |
|------|-------------|
| No raw SQL from the model | Tools call typed service methods only. Ban `$queryRaw` / `$executeRaw` from the AI module. |
| No LLM accounting math | Aging, tax, discount, COGS, trial balance, cash flow stay inside existing services. The model may format or compare values already returned. |
| `companyId` cannot be forged | Never accept `companyId` / `tenantId` in tool arguments or the user prompt. Inject from `AuthRequest` only. |
| Branch cannot be widened | Requested `branchId` is passed through `branchScopeFilter(permitted, requested)`. |
| Read-only MVP | Registry contains GET-equivalent methods only. No post, save, resync, or export-job enqueue. |
| Posted data preferred | Tools that summarize money should use posted, non-cancelled documents unless the underlying service already documents a different filter (cite that filter in the reply). |

Context injected into every tool call (not from the LLM):

| Field | Source |
|-------|--------|
| `userId` | JWT `sub` → `req.user.sub` |
| `companyId` | JWT `company_id` → `req.companyId` (`tenant_id` is an alias) |
| `branchId` | `X-Branch-Id` or JWT `branch_id` → `req.branchId`, then `UserBranchPermission` |
| `fiscalYearId` | `X-Fiscal-Year-Id` → `req.fiscalYearId` when the wrapped service needs it |
| `permittedBranchIds` | `requestPermittedBranchIds(req)` |

---

## 4. Existing auth and tenancy (do not reinvent)

Login embeds `company_id` from the **database user row**, not from the request body (`gates-backend/src/modules/auth/services/auth.service.ts`).

`authenticate` copies claims onto the request (`gates-backend/src/shared/middleware/auth.middleware.ts`):

- `req.user` = JWT payload (`sub`, `company_id`, `tenant_id`, `branch_id`, roles)
- `req.companyId` = `payload.company_id`
- `req.tenantId` = `payload.tenant_id ?? payload.company_id`
- `req.branchId` = `payload.branch_id`

Global `/api/v1` chain (`gates-backend/src/app.ts`):

1. `apiAuthGate()` → `authenticate`
2. `setTenantContext` — company exists and is active; binds AsyncLocalStorage
3. `enforceBranchScope` — reject query/body `branchId` not in `UserBranchPermission`
4. `licenseRouteGate()` — `TenantSubscription.allowedModules`

`X-Company-Id`, if sent, **must equal** the token company or the request is 403 (`tenant-fiscal-context.middleware.ts`).

Prisma tenant extension (`tenant-scoping.extension.ts`) AND-s `{ companyId }` on tenant-scoped reads and **overwrites** `companyId` on creates. A tool argument or URL that tries another company fails closed.

FGAC: `authorize({ resource, action })` (`authorize.middleware.ts`) loads `UserPermission` for `(userId, companyId)` via cache, then falls back to JWT role templates. Catalog: `permission-definitions.service.ts`.

Actions in use: `view`, `edit`, `delete`, `approve`, `post`, `print`, `override_tier_price`.

Analytics and executive HTTP routes already guard with `authorize({ resource: 'report', action: 'view' })`.

---

## 5. First 20 read-only tools

Each tool is a **thin wrapper** around a method that already exists. Do not add a second aging algorithm, a second P&L, or ad-hoc Prisma `groupBy` in the AI module.

`companyId` is listed under **Injected**, never under **LLM args**.

### 5.1 Executive / daily

| # | Tool | Service | Method | File | HTTP today | LLM args | Injected |
|---|------|---------|--------|------|------------|----------|----------|
| 1 | `getExecutiveOverview` | `ExecutiveDashboardService` | `getOverview` | `modules/analytics/services/executive-dashboard.service.ts` | `GET /api/v1/executive/overview` | — | `companyId`, `branchId?` |
| 2 | `getExecutiveKpis` | `ExecutiveAnalyticsService` | `getExecutiveKpis` | `modules/analytics/services/executive-analytics.service.ts` | `GET /api/v1/analytics/executive-kpis` | `months?` (default 6) | `companyId`, `branchId?` |
| 3 | `getDailyDigest` | `DailyDigestService` | `getDailyDigest` | `modules/analytics/services/daily-digest.service.ts` | `GET /api/v1/analytics/daily-digest` | `date?` | `companyId`, `branchId?` |
| 4 | `getRiskFeed` | `ExecutiveDashboardService` | `getRiskFeed` | same as #1 | `GET /api/v1/executive/risk-feed` | — | `companyId`, `branchId?` |

`getExecutiveKpis` already returns sales trend, liquidity, **top 5 customers**, top products, and a net P&L proxy. Use those fields; do not re-sum invoices in the model.

### 5.2 Sales and parties

| # | Tool | Service | Method | File | HTTP today | LLM args | Injected |
|---|------|---------|--------|------|------------|----------|----------|
| 5 | `getSalesSummary` | `InventoryReportsService` | `getSalesReport` | `modules/inventory/services/reports.service.ts` | `GET /api/v1/inventory/reports/sales` | `fromDate?`, `toDate?`, `warehouseId?`, `customerId?`, `delegateId?`, `unpaidOnly?` | `companyId`, `branchId?` |
| 6 | `getTopCustomers` | `ExecutiveAnalyticsService` | `getExecutiveKpis` → `topCustomers` | same as #2 | same as #2 | `months?` | `companyId`, `branchId?` |
| 7 | `getPartyQuickSummary` | `PartyQuickSummaryService` | `getSummary` | `modules/accounting/services/party-quick-summary.service.ts` | `GET /api/v1/parties/:id/quick-summary` | `partyId`, `partyType?` (`CUSTOMER` \| `SUPPLIER`) | `companyId` |
| 8 | `getCustomerFrequentItems` | `CustomerInsightsService` | `getFrequentItems` | `modules/inventory/services/customer-insights.service.ts` | `GET /api/v1/customers/:id/frequent-items` | `customerId` | `companyId` |

`getTopCustomers` is **not** a new aggregate. It is a named view of `getExecutiveKpis().topCustomers` so the model can ask for ranking without pulling the full KPI payload when the executor can project the field.

### 5.3 Receivables and payables

| # | Tool | Service | Method | File | HTTP today | LLM args | Injected |
|---|------|---------|--------|------|------------|----------|----------|
| 9 | `getAgedReceivables` | `AgedOpenItemsService` | `getAgedReceivables` | `modules/accounting/services/aged-open-items.service.ts` | `GET /api/v1/accounting/reports/aged-receivables` | `asOfDate`, `customerId?` | `companyId`, `branchId?` |
| 10 | `getAgedPayables` | `AgedOpenItemsService` | `getAgedPayables` | same | `GET /api/v1/accounting/reports/aged-payables` | `asOfDate`, `supplierId?` | `companyId`, `branchId?` |
| 11 | `getOverdueReceivables` | `InventoryReportsService` | `getOverduePaymentsReport` | `modules/inventory/services/reports.service.ts` | `GET /api/v1/inventory/reports/overdue-payments` | `customerId?`, `supplierId?` | `companyId` |

Aging buckets live in `AgedOpenItemsService` (GL-reconciled). `ExecutiveAnalyticsService.getAgingReport` already wraps that service — do not add a third aging path.

### 5.4 Financial statements

| # | Tool | Service | Method | File | HTTP today | LLM args | Injected |
|---|------|---------|--------|------|------------|----------|----------|
| 12 | `getTrialBalance` | `FinancialReportService` | `getTrialBalance` | `modules/accounting/services/financial-report.service.ts` | `GET /api/v1/accounting/reports/trial-balance` | `startDate`, `endDate`, `level?`, `costCenterId?`, `fiscalYearId?` | `companyId`, `branchId?` |
| 13 | `getIncomeStatement` | `FinancialReportService` | `getIncomeStatement` | same | `GET /api/v1/accounting/reports/income-statement` | `startDate`, `endDate` | `companyId` |
| 14 | `getBalanceSheet` | `FinancialReportService` | `getBalanceSheet` | same | `GET /api/v1/accounting/reports/balance-sheet` | `asOfDate` | `companyId` |
| 15 | `getCashFlowStatement` | `FinancialReportService` | `getCashFlowStatement` | same | `GET /api/v1/accounting/reports/cash-flow` | `startDate`, `endDate`, `page?`, `limit?` | `companyId` |
| 16 | `getAccountStatement` | `FinancialReportService` | `getAccountStatement` | same | `GET /api/v1/accounting/reports/account-statement/:accountId` | `accountId`, `startDate`, `endDate`, `costCenterId?` | `companyId`, `branchId?` |

These methods already prefer pre-aggregated `AccountPeriodBalance` where possible and fall back to posted `JournalEntry` / `JournalEntryLine`.

### 5.5 Inventory

| # | Tool | Service | Method | File | HTTP today | LLM args | Injected |
|---|------|---------|--------|------|------------|----------|----------|
| 17 | `getInventoryValuation` | `InventoryReportsService` | `getInventoryReport` | `modules/inventory/services/reports.service.ts` | `GET /api/v1/inventory/reports/inventory` | `warehouseId?`, `itemId?` | `companyId` |
| 18 | `getInventoryGlReconciliation` | `InventoryGlReconciliationService` | `getReconciliation` | `modules/accounting/services/inventory-gl-reconciliation.service.ts` | `GET /api/v1/accounting/reports/inventory-gl-reconciliation` | `warehouseId?` | `companyId` |
| 19 | `getItemStockBalance` | `StockQueryService` | `getWarehouseItemBalance` | `modules/inventory/services/stock-query.service.ts` | `GET /api/v1/inventory/items/:id/stock-balance` | `itemId`, `warehouseId` | `companyId` |
| 20 | `getItemCostAsOf` | `ItemCostService` | `getCostAsOf` | `modules/inventory/services/item-cost.service.ts` | `GET /api/v1/inventory/items/:id/cost-as-of` | `itemId`, `asOf` | `companyId` |

`getInventoryValuation` is the stock snapshot (qty × cost as the report already defines). `getInventoryGlReconciliation` is the **tie-out** to GL inventory control accounts — use it when the user asks “does stock match the ledger?”.

### 5.6 Contracting (license-gated)

| # | Tool | Service | Method | File | HTTP today | LLM args | Injected |
|---|------|---------|--------|------|------------|----------|----------|
| — | `getProjectProfitability` | `ContractingDashboardService` | `getSummary` | `modules/contracting/dashboard/contracting-dashboard.service.ts` | `GET /api/v1/contracting/dashboard/summary` | — | `companyId` |

Counted inside the 15–20 window as tool **#21 only if** the company license includes contracting; otherwise the registry hides it. Portfolio EV/AC/CV, CPI/SPI, extract pipeline — already computed by that dashboard. Prefer modern `ContractingProject` / `ClientInvoice` / `SubcontractInvoice` over legacy `Project` / `Extract`.

**Practical MVP set without contracting:** tools 1–20 above (20). **With contracting licensed:** add `getProjectProfitability` (21) still within a “first wave” of read tools.

---

## 6. Tools that must never be registered

| Method / route | Why |
|----------------|-----|
| `InventoryCostingService.applyInboundMovement` / `applyOutboundMovement` / `recalculateItemCostHistory` | Writes stock cost |
| `PartyBalanceReconciliationService.resyncCache` | Write (`report:edit`) |
| `POST /api/v1/accounting/reports/generate` | Enqueues export jobs |
| `InvoiceM5Service.create` / `update` / `post` | Documents and GL |
| `AccountMovementService.transferAccountMovement` | Posts a reclassification JE |
| Any `refreshInvoiceBalanceInTx` | Write-side balance refresh |
| Prisma `$queryRaw` / `$executeRaw` from prompts | SQL injection + tenant bypass risk |

Legacy `ReportsService` (`modules/accounting/services/reports.service.ts`) is **deprecated for new UI**. Do not wrap its Node-side aggregations when an M16 `FinancialReportService` or `AgedOpenItemsService` method exists. `GET .../credit-aging` is superseded by `getAgedReceivables` / `getAgedPayables`.

---

## 7. Permission matrix

Deny-closed: **every** column that applies must pass. Missing grant = tool not offered and not executable.

| Tool | `report:view` | Domain `view` | Branch scope | `allowedModules` |
|------|---------------|---------------|--------------|------------------|
| `getExecutiveOverview` | required | — | yes | core |
| `getExecutiveKpis` | required | — | yes | core |
| `getDailyDigest` | required | — | yes | core |
| `getRiskFeed` | required | — | yes | core |
| `getSalesSummary` | required | `invoice:view` recommended | yes | inventory |
| `getTopCustomers` | required | `customer:view` recommended | yes | inventory |
| `getPartyQuickSummary` | — | `customer:view` **or** `supplier:view` matching `partyType` | — | core |
| `getCustomerFrequentItems` | — | `customer:view` | — | inventory |
| `getAgedReceivables` | required | `customer:view` recommended | yes | accounting |
| `getAgedPayables` | required | `supplier:view` recommended | yes | accounting |
| `getOverdueReceivables` | required | `customer:view` / `supplier:view` when filtered | — | inventory |
| `getTrialBalance` | required | `journal-entry:view` recommended | yes | accounting |
| `getIncomeStatement` | required | `journal-entry:view` recommended | — | accounting |
| `getBalanceSheet` | required | `journal-entry:view` recommended | — | accounting |
| `getCashFlowStatement` | required | `journal-entry:view` recommended | — | accounting |
| `getAccountStatement` | required | `journal-entry:view` + account in company chart | yes | accounting |
| `getInventoryValuation` | required | `item:view` or `item-quantity:view` | — | inventory |
| `getInventoryGlReconciliation` | required | `item:view` recommended | — | inventory + accounting |
| `getItemStockBalance` | — | `item:view` **or** `item-quantity:view` | warehouse → branch | inventory |
| `getItemCostAsOf` | — | `item:view` | — | inventory |
| `getProjectProfitability` | — | `project:view` **or** `extract:view` | — | contracting |

**Never expose to the assistant:**

- `report:edit` (cache resync)
- `invoice:post` / `invoice:edit` / `invoice:approve`
- `journal-entry:post`
- `override_tier_price`

Gateway itself: `authenticate` → `setTenantContext` → `authorize({ resource: 'report', action: 'view' })` for the chat session. Per-tool checks in the table still run inside the executor so a user who can open chat cannot call `getItemCostAsOf` without `item:view`.

Admin (`resource: '*'`) follows existing FGAC grant-all behavior.

---

## 8. Multi-tenant guardrails

1. **JWT is the only company source.** Login signs `company_id` from `User.companyId`. Tool Zod schemas omit `companyId`, `tenantId`, and `company_id`. If the model emits them, the executor **strips** them.
2. **Header cannot escalate.** `X-Company-Id` mismatch → 403 before tools run.
3. **Prisma ALS.** `setTenantContext` binds `companyId`; the tenant extension AND-s every scoped read. Even a buggy wrapper that forgets `where.companyId` returns empty, not another tenant.
4. **Branch.** `enforceBranchScope` on explicit IDs; list/summary tools pass `branchScopeFilter(permitted, requested)` the same way `InvoiceM5Service.list` does.
5. **Party and item IDs** in LLM args are treated as **in-tenant** identifiers. Services already `findFirst({ id, companyId })`. Cross-tenant UUIDs resolve to not-found, not 200 with foreign data.
6. **License.** `licenseRouteGate` / `TenantSubscription.allowedModules` hide contracting and unused verticals.
7. **Audit log.** Persist `userId`, `companyId`, tool name, argument **keys** (not full party PII), latency, and deny reason. Do not dump invoice lines or phone numbers into model-provider logs.
8. **Prompt isolation.** System prompt includes company name from the JWT-bound company row only. Never concatenate another company’s report JSON into the same turn.

```
Tool args from LLM
    → strip companyId / tenantId
    → merge AuthRequest.companyId
    → authorize(resource, action)
    → branchScopeFilter
    → existing service method
    → Prisma (tenant extension)
```

---

## 9. Schema cheat sheet (what tools read)

Prefer posted, non-cancelled rows.

| Domain | Models | Typical filters / measures |
|--------|--------|----------------------------|
| Sales / purchases | `Invoice`, `InvoiceLine` | `companyId`, `branchId?`, `invoiceKind`, `isPosted`, `!isCancelled`, `date` / `dueDate`, `netAmount`, `remainingAmount` |
| AR / AP running | `PartnerRunningBalance` | `companyId`, `partnerId`, `partnerType`, `netBase` |
| Customer / supplier cards | `Customer`, `Supplier` | `companyId`, `creditLimit`, snapshot `balance` (may lag running balance) |
| GL | `JournalEntry`, `JournalEntryLine`, `Account` | `isPosted`, `date`, `debit`/`credit` / base amounts |
| Period GL | `AccountPeriodBalance` | `fiscalYear`, `periodMonth`, `netBalance` — trial balance fast path |
| Inventory qty / value | `ItemWarehouseBalance` | `quantityOnHand` × `averageCost` |
| Stock ledger / cost trail | `InventoryMovement`, `ItemCostHistory` | movement and cost-as-of (via `StockQueryService` / `ItemCostService`) |
| Projects | `ContractingProject`, `ClientInvoice`, `SubcontractInvoice`, `ProjectBOQItem` | revenue `netPayableByClient`, cost `netPayableAmount` — via dashboard, not ad-hoc joins |

Indexes already useful for these reads: invoice kind/posted/date, due date + remaining amount, journal posted date, inventory movement date.

**Dual stacks — do not join the wrong one:**

| Concept | Prefer | Avoid for new tools |
|---------|--------|---------------------|
| Tenant | `Company` | `Tenant` (infra) |
| Project | `ContractingProject` | `Project` |
| Subcontractor | `Subcontractor` + `SubcontractInvoice` | `Contractor` + legacy `Extract` |

---

## 10. Prompt and citation policy

- Reply language follows the user (Arabic or English).
- Every numeric claim cites **tool name + period** (e.g. `getIncomeStatement`, `2026-01-01`–`2026-09-07`).
- If the user asks to record, post, delete, or change a document, refuse and point to the existing screen (`/inventory/operations/sales-invoice`, journal voucher, etc.).
- If a tool returns empty because of permissions or license, say so; do not invent a workaround query.

---

## 11. Related code (read, do not fork)

| Concern | Path |
|---------|------|
| JWT / `AuthRequest` | `gates-backend/src/shared/auth/types.ts` |
| Authenticate | `gates-backend/src/shared/middleware/auth.middleware.ts` |
| Tenant ALS | `gates-backend/src/shared/middleware/tenant.middleware.ts` |
| Authorize | `gates-backend/src/shared/middleware/authorize.middleware.ts` |
| Branch guard | `gates-backend/src/shared/middleware/branch-scope.middleware.ts` |
| Branch filter | `gates-backend/src/shared/auth/branch-scope.ts` |
| Prisma tenant extension | `gates-backend/src/shared/database/tenant-scoping.extension.ts` |
| Permission catalog | `gates-backend/src/modules/users/services/permission-definitions.service.ts` |
| M16 financial reports | `gates-backend/src/modules/accounting/services/financial-report.service.ts` |
| Aged open items | `gates-backend/src/modules/accounting/services/aged-open-items.service.ts` |
| Executive KPIs | `gates-backend/src/modules/analytics/services/executive-analytics.service.ts` |
| Inventory reports | `gates-backend/src/modules/inventory/services/reports.service.ts` |
