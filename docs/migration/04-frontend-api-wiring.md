# Phase 4: Frontend API Wiring (`gates-web`)

This document summarizes how the existing Gates web UI talks to the Wave 0–4 REST API in `gates-backend`. No new screens were added; work focused on the API client, tenant context, payload alignment, and report routing.

---

## 1. Tenant bootstrap & storage

| Piece | Path | Role |
|--------|------|------|
| Storage | `gates-web/lib/tenant/tenant-context-storage.ts` | Reads/writes `gates_tenant_company_id`, `gates_tenant_branch_id`, `gates_tenant_fiscal_year_id` in `localStorage`. |
| Bootstrap | `gates-web/lib/providers/TenantBootstrap.tsx` | After login, if IDs are missing: `GET /companies` (first active), `GET /company/branches`, `GET /company/fiscal-years` (open year covering today, else first open). |
| Provider wiring | `gates-web/lib/providers/QueryProvider.tsx` | Wraps app with `TenantBootstrap` + `GlobalApiErrorToast`. |

**Manual override:** set the three keys in DevTools → Application → Local Storage, or call `setTenantContext({ companyId, branchId, fiscalYearId })` from the console (after importing in a debug snippet).

---

## 2. Multi-tenant headers

All requests from `gates-web/lib/api/client.ts` attach (when present in storage):

| Header | Backend middleware |
|--------|-------------------|
| `X-Company-Id` | `tenant-fiscal-context.middleware.ts` — must match JWT company if both set |
| `X-Branch-Id` | Validated against company branches |
| `X-Fiscal-Year-Id` | Resolved via `fiscalYearService`; **mutating** requests call `assertOpenById` (closed FY → 422) |

Base URL: `NEXT_PUBLIC_API_URL` or dev same-origin `/api/v1` (proxied in `next.config.ts` to `BACKEND_PROXY_TARGET`, default `http://127.0.0.1:3001`).

Auth: `Authorization: Bearer …` from `localStorage` / cookie; CSRF header on non-GET when `XSRF-TOKEN` cookie exists.

### Global error UX

- `lib/api/api-error-notify.ts` + `components/GlobalApiErrorToast.tsx`
- **403** — unlicensed module / inactive subscription (Arabic toast)
- **422** — fiscal year closed (Arabic toast)

Hooks: `useApiMutation` broadcasts the same cases when pages do not define `onError`.

---

## 3. Endpoint mapping (UI → API)

Paths below are relative to `/api/v1`. The client uses paths without the prefix (e.g. `/accounting/journal-entries`).

### M1 — GL & journals

| UI | Client path | Notes |
|----|-------------|--------|
| Journal entry | `POST /accounting/journal-entries` | Body: `currencyCode`, `lines[].lineOrder`, balanced debits/credits |
| | `POST /accounting/journal-entries/:id/post` | Requires open FY header |
| | `POST /accounting/journal-entries/:id/unpost` | |
| Chart / account pickers | `GET /accounting/accounts` | Unchanged |

### M5 — Invoices

| UI | Client path | Notes |
|----|-------------|--------|
| Sales / purchase invoice (list, get, create, post) | `/invoices` | Query: `invoiceKind` = `SALE` \| `PURCHASE` |
| Create body | `lib/invoices/mapFormToM5Invoice.ts` | Maps form lines to M5 schema (`unitId`, `lineOrder`, `price`, …) |
| Update / delete / payment | `/invoices/:id` (PUT/PATCH/DELETE) | Legacy `/inventory/invoices` mutations delegate to M5 |

**Requirements:** `X-Branch-Id` + `X-Fiscal-Year-Id` for **post**; items must have units for `unitId` on lines.

### M2 — Treasury

| UI | Client path | Notes |
|----|-------------|--------|
| Receipt / payment voucher | `POST /treasury/cash-transactions` | `transactionKind`: `RECEIPT` \| `PAYMENT` |
| Post / unpost | `POST /treasury/cash-transactions/:id/post` \| `unpost` | |
| Payload | First distribution line → `offsetAccountId`; `safeId`, `amount`, `currencyCode` |

### M16 — Financial reports

Registry: `lib/reportPreview/resolveReportEndpoint.ts` + `components/report/ReportPreviewFromRegistry.tsx`.

| UI report route | API |
|-----------------|-----|
| `…/balances/review-balance` | `GET /accounting/reports/trial-balance` |
| `…/analysis/income-statement` | `GET /accounting/reports/income-statement` |
| `…/credit/financial-position-statement` | `GET /accounting/reports/balance-sheet` |
| `…/books/general-ledger` (+ `accountId` query) | `GET /accounting/reports/account-statement/:accountId` |

Query mapping: UI `fromDate` / `toDate` → `startDate` / `endDate`; trial balance uses `toDate` as `endDate` and year-start as `startDate` when only end date is set.

### M3 — Parties (customer card)

| Field | API |
|-------|-----|
| `creditLimit`, `customerCategoryId` | `POST /accounting/customers` |
| Categories | `GET /accounting/customer-categories` |

### M4 — Item cost

| UI | API |
|----|-----|
| Item card (after save) | `GET /inventory/items/:id/cost-as-of?date=` via `lib/hooks/useItemCostAsOf.ts` |

---

## 4. Manual test checklist

- [ ] Log in; confirm tenant bootstrap (Network tab shows `X-Company-Id`, `X-Branch-Id`, `X-Fiscal-Year-Id` on POST).
- [ ] Create balanced journal → save → post (open FY).
- [ ] Sales invoice: create with item that has units → post.
- [ ] Receipt voucher: line with account + safe → save → post.
- [ ] Trial balance preview: `accounting/account-reports/balances/review-balance` → معاينة with date range.
- [ ] Customer card: save with credit limit + category.
- [ ] Trigger closed FY or unlicensed route → global Arabic toast.

---

## 5. Local dev commands

**Backend** (from repo root):

```bash
cd gates-backend
cp .env.example .env   # if needed: DATABASE_URL, JWT, FRONTEND_URL=http://localhost:3000
npm install
npx prisma migrate deploy
npm run dev            # default http://127.0.0.1:3001
```

**Frontend:**

```bash
cd gates-web
npm install
# Optional: NEXT_PUBLIC_API_URL=http://127.0.0.1:3001/api/v1
# Default dev uses http://localhost:3000/api/v1 via Next rewrite
npm run dev            # http://localhost:3000
```

**Lint (Phase 4–scoped paths):**

```bash
cd gates-web
npm run lint
```

---

## 6. Related backend additions (Phase 4)

- `GET /api/v1/company/fiscal-years` — fiscal year list for bootstrap.
- Customer schema: `creditLimit`, `customerCategoryId`.
