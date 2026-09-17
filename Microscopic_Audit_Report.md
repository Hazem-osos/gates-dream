# Microscopic Audit Report — `gates-web` & `gates-backend`

**Generated:** 2026-04-11  
**Methodology:** Automated repository scans (`rg`/glob) plus targeted file reads. This is an **evidence-based diagnostic**, not a formal proof that every line of ~3900-line Prisma schema was compared to every form field. Items below are **real findings** with paths and line numbers from the scan date.

---

## How to read this document

- Each `[ ]` is a discrete remediation task.
- **Path** is relative to the workspace root (`gates web/`).
- **Fix:** one technical sentence.

---

## 1. Cross-cutting — API client, env, typing

- [ ] `gates-web/lib/api/client.ts` (line **12**, `API_BASE_URL`) — Remove or gate the hardcoded fallback `http://localhost:3001/api/v1` behind `NEXT_PUBLIC_API_URL` being required in production builds so production cannot silently point at dev.
- [ ] `gates-web/app/inventory/reports/sales-returns-reports/preview/page.tsx` (line **1**, `@ts-nocheck`) — Remove `@ts-nocheck` and fix underlying TypeScript errors so unsafe patterns surface at compile time.
- [ ] `gates-web/app/inventory/reports/purchase-returns-reports/preview/page.tsx` (line **1**, `@ts-nocheck`) — Same: eliminate `@ts-nocheck` and resolve types.
- [ ] `gates-web/app/inventory/reports/purchase-reports/preview/page.tsx` (line **1**, `@ts-nocheck`) — Same.
- [ ] `gates-web/app/inventory/reports/monthly-sales-for-items/page.tsx` (line **1**, `@ts-nocheck`) — Same.
- [ ] `gates-web/app/inventory/reports/customer-balances/page.tsx` (line **1**, `@ts-nocheck`) — Same.
- [ ] `gates-web/app/inventory/creations/order-limit-items/page.tsx` (line **1**, `@ts-nocheck`) — Same.
- [ ] `gates-web/app/electronic-invoices/creations/import-tax-invoices/page.tsx` (line **1**, `@ts-nocheck`) — Same.
- [ ] `gates-web/app/electronic-invoices/creations/customer-card/page.tsx` (line **1**, `@ts-nocheck`) — Same.
- [ ] `gates-web/app/components/CollectPaymentModal.tsx` (line **12**, `console.log('CollectPaymentModal render'...)`) — Delete or replace with structured logging behind `NODE_ENV === 'development'` only.
- [ ] `gates-web/app/components/ui/QuickReviewItem.tsx` (line **27**, `console.log('Toggle clicked!`...)`) — Same: remove debug logging from production UI path.

---

## 2. Navigation & dead-end links

- [ ] `gates-web/app/components/Sidebar.tsx` (lines **459**, **549**, `href="#"`) — Replace hash links with real routes or `button type="button"` + handler so keyboard/SEO/accessibility behavior is correct.
- [ ] `gates-web/app/accounting/cards/customer/page.tsx` (lines **657**, **660**, `<a href="#">`) — Wire to actual customer ledger / detail routes or disable with tooltip until implemented.
- [ ] `gates-web/app/inventory/reports/stock-profit-reports/preview/page.tsx` (line **176**, `<a href="#" ...>عرض الشروط</a>` without `onClick`) — Add the same `onClick` + `preventDefault` pattern used in sibling preview pages so the conditions panel toggles.
- [ ] `gates-web/app/inventory/reports/receivables-aging/preview/page.tsx` (line **152**, `href="#"` for عرض الشروط) — Same toggle wiring as other previews.
- [ ] `gates-web/app/inventory/reports/overdue-payments/preview/page.tsx` (line **108**) — Same.
- [ ] `gates-web/app/inventory/reports/items-profit-reports/preview/page.tsx` (line **156**) — Same.
- [ ] `gates-web/app/inventory/reports/invoices-profit-reports/preview/page.tsx` (line **160**) — Same.
- [ ] `gates-web/app/inventory/reports/customer-receivables/preview/page.tsx` (line **158**) — Same.

---

## 3. Empty / stub handlers & placeholders

- [ ] `gates-web/app/extracts/operations/projects/page.tsx` (lines **56–59**, `handleSave` body empty + comment “placeholder”) — Implement save by calling `projectMutation.mutate` with `ProjectHeader` form values or remove the button until the contract is defined.
- [ ] `gates-web/app/accounting-settings/create-user-groups/page.tsx` (line **1303**, `ActionButtons onSave={() => {}}`) — Wire save for the active subsection (permissions / track-users) or hide `ActionButtons` when no backend contract exists.
- [ ] `gates-web/app/inventory/guide/items/import/page.tsx` (line **259**, `onSave={() => {}}`) — Connect to the real import API (`useApiMutation` to the documented import endpoint) or show a disabled state with explanation.
- [ ] `gates-web/app/inventory/operations/purchase-returns/page.tsx` (line **549**, `onClick={() => {}}` “تحميل دفعة مقدمة”) — Implement handler (API + modal) or remove the button.

---

## 4. `console.log` instead of persistence (frontend)

### 4.1 Schools — constructions

- [ ] `gates-web/app/schools/constructions/partner-data/page.tsx` (line **62**, `handleSave` → `console.log`) — Replace with `useApiMutation` to the correct schools/partners endpoint once exposed, or to a company-settings JSON blob with schema validation.
- [ ] `gates-web/app/schools/constructions/employee-data/page.tsx` (line **71**) — Same: wire to HR/employee or schools API per domain model.
- [ ] `gates-web/app/schools/constructions/educational-expenses/page.tsx` (line **49**) — Wire save to backend.
- [ ] `gates-web/app/schools/constructions/define-religions/page.tsx` (line **31**) — Wire to `GET/POST` (or reuse HR `religion` routes if that is the canonical table).
- [ ] `gates-web/app/schools/constructions/define-nationalities/page.tsx` (line **31**) — Wire to HR `nationality` CRUD or add schools-scoped endpoints.
- [ ] `gates-web/app/schools/constructions/collector-data/page.tsx` (line **68**) — Wire to Collector API (see §8.2 — backend gap).
- [ ] `gates-web/app/schools/constructions/bus-course-definition/page.tsx` (line **51**) — Wire to backend entity.
- [ ] `gates-web/app/schools/constructions/book-expenses/page.tsx` (line **92**) — Wire to backend.
- [ ] `gates-web/app/schools/constructions/activity-expenses/page.tsx` (line **92**) — Wire to backend.
- [ ] `gates-web/app/schools/constructions/academic-years-detail/page.tsx` (line **32**) — Wire to `Stage`/`Semester` or dedicated academic-year API.
- [ ] `gates-web/app/schools/constructions/sibling-discount-definition/page.tsx` (line **47**) — Wire to backend.
- [ ] `gates-web/app/schools/constructions/payment-method-definition/page.tsx` (line **87**) — Wire to backend.

### 4.2 Schools — operations

- [ ] `gates-web/app/schools/operations/student-expenses-refund/page.tsx` (line **61**) — Replace `console.log` with `POST /api/v1/schools/students/.../expenses-refund` (or actual route from `student.routes.ts`).
- [ ] `gates-web/app/schools/operations/opening-balance-students/page.tsx` (lines **93**, **97**) — Replace with list + save mutations matching backend contract.
- [ ] `gates-web/app/schools/operations/student-transfer/page.tsx` (lines **152**, **156**) — Replace with API calls to student transfer endpoint.

### 4.3 Taxes module

- [ ] `gates-web/app/taxes/creations/tax-periods/page.tsx` (lines **38**, **43**) — Wire save/cancel to `taxes` REST routes.
- [ ] `gates-web/app/taxes/creations/withholding-tax-rates/page.tsx` (lines **37**, **41**) — Same.
- [ ] `gates-web/app/taxes/creations/tax-authorities/page.tsx` (lines **38**, **42**) — Same.
- [ ] `gates-web/app/taxes/creations/supplier-tax-card/page.tsx` (lines **46**, **50**) — Same.
- [ ] `gates-web/app/taxes/operations/withholding-notification/page.tsx` (lines **64**, **68**, **80**) — Replace debug logs with mutations + user-visible toasts.
- [ ] `gates-web/app/taxes/operations/withholding-tax-payment/page.tsx` (lines **103–135**, multiple `console.log`) — Implement each toolbar action (cancel/add/edit/delete/preview/email/save) via API.
- [ ] `gates-web/app/taxes/operations/vat-declaration/page.tsx` (lines **47–83**, multiple `console.log`) — Same for VAT declaration lifecycle.

### 4.4 Inventory / accounting UI actions

- [ ] `gates-web/app/inventory/operations/final-purchase-invoice/page.tsx` (lines **747**, **761**, **775**, **793**, payment toolbar `console.log`) — Wire buttons to treasury/payment modals and posting endpoints used elsewhere in inventory.
- [ ] `gates-web/app/inventory/operations/sales-invoice/page.tsx` (lines **812**, **826**, **840**, **858**) — Same for sales collection/posting actions.
- [ ] `gates-web/app/accounting/operations/securities/payment/page.tsx` (line **221**, `console.log('تحصيل')`) — Call the actual collect/posting handler.
- [ ] `gates-web/app/accounting/operations/securities/reciept/page.tsx` (line **255**) — Same.
- [ ] `gates-web/app/accounting/operations/treasury/receipt-voucher/page.tsx` (lines **219**, **225**, **231**, **352**, `onClick={() => console.log(...)}`) — Replace with navigation/modals/filter state wired to APIs.
- [ ] `gates-web/app/accounting/operations/treasury/payment-voucher/page.tsx` (lines **219**, **225**, **231**, **352**) — Same as receipt voucher.
- [ ] `gates-web/app/accounting/operations/journal-entry/page.tsx` (lines **378**, **385**, **392**, **522**, `console.log`) — Same pattern: real handlers for approval status, recurring entry, filter, Hijri picker.

### 4.5 Real estate

- [ ] `gates-web/app/real-estate-investment/reports/customer/page.tsx` (lines **420–902**, extensive `console.log` in mode switching and buttons) — Replace with state transitions that already exist (preview/reservation/closure) without console noise, and surface API errors via toasts.

---

## 5. Mock / hardcoded data tables (UI not API-driven)

- [ ] `gates-web/app/hr/transaction-tracking/page.tsx` (line **38**, `MOCK_TRANSACTIONS = Array.from({ length: 7 }, ...)`) — Replace with `useApiQuery` against an audit/transaction endpoint (or remove page from navigation until API exists).
- [ ] `gates-web/app/extracts/operations/projects/page.tsx` (line **18**, `buildings = Array.from({ length: 6 })`; lines **281**, **381**, **504** grid rows from `Array.from({ length: 8 })`) — Load buildings/rows from `/extracts/projects/...` responses instead of empty shells.
- [ ] `gates-web/app/extracts/operations/projects/agenda-items/page.tsx` (lines **144**, **214**, **251**, `Array.from({ length: 6 })`) — Bind rows to API data.
- [ ] `gates-web/app/extracts/operations/projects/make-extract/page.tsx` (lines **269**, **325**, `length: 8`) — Same.
- [ ] `gates-web/app/extracts/operations/projects/maqaysa/page.tsx` (line **79**, `length: 7`) — Same.

---

## 6. `useBackendReachability` usage

**Finding:** `useBackendReachability` appears on **many** `page.tsx` files (health/ping pattern). It is **not** inherently a bug; it becomes a problem only when it is the sole “integration” on a page that otherwise uses static data.

**Instruction:** For each module’s hub pages, verify the page also calls `useApiQuery`/`useApiMutation` for primary data; if not, track that page under §5 or §4.

*(No per-file line list here — count was high; grep `useBackendReachability` in `gates-web/app/**/page.tsx` for a full list.)*

---

## 7. Error handling — frontend

**Pattern:** Most data access uses React Query (`useApiQuery` / `useApiMutation`), which centralizes errors; **silent** issues often arise when:

1. `onError` is omitted on mutations, and no global query cache handler shows a toast.
2. `console.log` swallows user expectation of feedback (see §4).

**Actionable items:**

- [ ] Audit all `useApiMutation(` usages without `onError` in `gates-web` — Add `onError` + `ErrorToast` or a shared `mutationDefaults` wrapper (search `useApiMutation` and filter files missing `onError`).

**Direct `apiClient` usage (bypasses react-query error UI unless manually handled):**

- [ ] `gates-web/app/accounting-settings/company-settings/financial-position-settings/page.tsx` (function around line **73**, `apiClient.put`) — Ensure `saveMutation` surfaces `ApiError.message` in `onError` (already partially done; verify all branches).
- [ ] `gates-web/app/accounting-settings/company-settings/income-statement-settings/page.tsx` (line **71**) — Same.
- [ ] `gates-web/app/accounting-settings/company-settings/accounting-settings/page.tsx` (line **72**) — Same.
- [ ] `gates-web/app/accounting-settings/company-data/page.tsx` (line **135**, `await apiClient.put`) — Wrap in try/catch or use `useMutation` with `onError` so failures never disappear silently.

---

## 8. Backend — routes vs Prisma models (gaps)

### 8.1 Schools: `Collector` model without module routes

- [ ] `gates-backend/prisma/schema.prisma` (lines **2942–2957**, `model Collector`) — Implement `gates-backend/src/modules/schools/routes/collector.routes.ts` (or nest under `student.routes`) with list/create/update/delete and register in `gates-backend/src/app.ts`, then wire `gates-web/app/schools/constructions/collector-data/page.tsx`.

### 8.2 CRUD coverage snapshot (manual)

| Area | Backend routes present (representative) | Frontend risk |
|------|----------------------------------------|----------------|
| Students | `schools/routes/student.routes.ts` | Constructions screens still `console.log` (§4.1). |
| HR employees | `hr/routes/employee.routes.ts` | Many HR pages exist; cross-check each against full CRUD. |
| Inventory invoices | `inventory/routes/invoice.routes.ts` | Large operation pages — verify DELETE/cancel parity per workflow. |
| Taxes | `taxes/routes/*.ts` | Tax **UI** still mostly `console.log` (§4.3). |

- [ ] Run an automated **route inventory** (`rg "router\\.(get|post|put|patch|delete)" gates-backend/src/modules`) vs **sidebar menu** entries in `gates-web/app/components/*Sidebar.tsx` — Any menu href without a matching backend prefix should be flagged in a future pass.

---

## 9. Database schema vs UI parity (sample: `Student`)

**Prisma `Student`** (`gates-backend/prisma/schema.prisma` lines **2853–2882**) includes: `fatherName`, `motherName`, multi-generation name fields, `currencyCode`, `stageId`, `semesterId`, `paymentType`, `enrollment`, `isFinished`, etc.

- [ ] `gates-web` student create/edit forms — Field-level audit required: ensure every **required** Prisma field (`studentName`, `companyId` via tenant) is sent; optional genealogy fields either appear in UI or are intentionally defaulted server-side.

*(Full model-by-model parity would duplicate thousands of lines; treat as ongoing QA checklist per entity.)*

---

## 10. Backend — error responses

**Observation:** Typical Express routes in this codebase use `try/catch` + JSON `{ status: 'error', message }`. 

- [ ] Spot-check any `// @ts-nocheck` route files in `gates-backend` — Ensure `next(err)` or unified error middleware is used so raw stack traces never leak in production.

*(No specific file flagged without another grep pass on `router.use` error handlers.)*

---

## 11. Duplicate / confusing school settings routes

- [ ] `gates-web/app/schools/settings/page.tsx` — Uses `/schools/settings` (company `advancedSettings.schoolSettings`).
- [ ] `gates-web/app/schools/constructions/school-settings/page.tsx` (lines **3–13**, stub text only “صفحة إعدادات المدارس العامة”, no API) — Delete this route, or redirect with `next/navigation` `redirect('/schools/settings')`, or replace with the same wired component as `schools/settings/page.tsx` to avoid two UIs for the same concept.

---

## 12. Manufacturing / POS / sensors

- [ ] `gates-backend/src/modules/manufacturing/routes/sensors.routes.ts` — Confirm `gates-web/app/manufacturing/**` pages call these endpoints (grep `useApiQuery`/`/manufacturing` in manufacturing pages).

---

## Appendix A — Scan commands (reproduce)

```bash
rg "console\.log\(" gates-web --glob "*.{ts,tsx}"
rg "<a href=\"#\"" gates-web/app --glob "*.tsx"
rg "onSave=\{\(\) => \{\}\}" gates-web/app --glob "*.tsx"
rg "@ts-nocheck" gates-web --glob "*.tsx"
rg "Array\.from\(\{ length" gates-web/app --glob "*.tsx"
```

---

## Appendix B — Explicit non-goals of this pass

- Did not execute runtime E2E against a live database.
- Did not enumerate all **437** `page.tsx` files one-by-one (sample-based coverage).
- Did not diff every Prisma model against every form.

---

*End of report.*
