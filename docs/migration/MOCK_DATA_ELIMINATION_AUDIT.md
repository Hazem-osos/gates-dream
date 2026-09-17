# Mock Data Elimination Audit (gates-web / gates-backend)



**Last updated:** 2026-08-19 (ERP UI standard Phase 0 + Waves 1–3)

**Related:** [Full-system audit & remediation blueprint](../AUDIT_FULL_SYSTEM_REMEDIATION.md) (2026-08-19).

**Scope:** Static placeholders (`25,4456`), `staticRows` API fallbacks, unwired grids, stub backend services.



## Completed in this sprint



| File | Change |

|------|--------|

| `gates-web/lib/invoices/computeInvoiceFinancialSummary.ts` | Live M5-aligned totals from line items |

| `gates-web/components/inventory/InvoiceFinancialSummary.tsx` | Shared الملخص المالي UI |

| `gates-web/app/inventory/operations/sales-invoice/page.tsx` | Financial summary from form lines |

| `gates-web/components/erp/*` | Shared ERP document shell (header, form card, bottom split, journal preview) |

| `gates-web/app/inventory/operations/final-purchase-invoice/page.tsx` | M5 purchase invoice — ERP layout, no mock footer tabs |

| `gates-web/app/inventory/operations/sales-returns/page.tsx`, `purchase-returns/page.tsx` | Live M5 return invoices + ERP chrome |

| `gates-web/app/inventory/operations/issue/page.tsx`, `receipt/page.tsx`, `transfer/page.tsx` | Stock docs — ERP header/list collapse + GL bottom split |

| `gates-web/app/accounting/operations/journal-entry/page.tsx` | Keyboard grid + balance helper on new line + bottom split |

| `gates-web/app/accounting/operations/treasury/cash-receipt/page.tsx`, `cash-payment/page.tsx` | `POST /treasury/cash-transactions` + open invoice allocation grid |

| `gates-web/app/accounting/operations/treasury/cheques/page.tsx` | Cheque lifecycle wired to `/treasury/cheques/*` |

| `gates-web/components/electronic-invoices/EtaSubmissionHub.tsx` | ETA queue from `GET /invoices` + batch submit hook |

| `gates-web/app/pos/point-of-sale/page.tsx` | Secondary shift tabs — placeholder demo rows removed (live totals only) |

| `gates-web/app/inventory/operations/price-quote/page.tsx` | Line tables from `quoteLines` + items API |

| `gates-web/app/inventory/operations/purchase-order/page.tsx` | Line tables from `orderLines` + items API |

| `gates-web/app/inventory/operations/stocktaking/page.tsx` | Live `stocktakingLines` + totals |

| `gates-web/app/inventory/operations/assembly/page.tsx` | Live `assemblyLines` table |

| `gates-web/app/inventory/operations/disassembly/page.tsx` | Live `disassemblyLines` table |

| `gates-web/lib/inventory/itemDisplay.ts`, `invoiceLineTableCells.ts` | Shared line table cells |

| `gates-web/app/inventory/creations/price-lists/page.tsx` | Grid from `GET /inventory/price-lists/:id` |

| `gates-web/app/inventory/creations/item-card/page.tsx` | `GET /inventory/items/:id` for units/prices; empty states on WIP tabs |

| `gates-web/app/inventory/creations/representatives-commissions-*.tsx` | Tier state / empty states (no fake rows) |

| `gates-web/app/extracts/operations/extract-payment/page.tsx` | `GET /extracts/payments` + live totals |

| `gates-web/app/extracts/operations/manpower-log/page.tsx` | `GET /extracts/manpower-logs` by project |

| `gates-web/app/inventory/reports/*/preview/page.tsx` (profit/aging) | Removed `staticRows`; skeleton + empty state |

| `gates-web/components/report/ReportPreviewFromRegistry.tsx` | `TableSkeleton` + `EmptyState` |

| `gates-web/app/hr/settings/page.tsx` | Neutral defaults instead of `25,4456` |

| `gates-backend` (prior) | Branch/FY context auto-resolve for stale tenant headers |

| `gates-web/lib/formatMoney.ts` | Shared `formatMoneyAr` (replaces demo amounts) |

| `gates-web/lib/electronic-invoices/electronicInvoiceCreationUtils.ts` | List → table mappers for إرسال/استيراد |

| `gates-web/app/electronic-invoices/creations/*` | Draft/submitted invoice lists from API |

| `gates-web/app/pos/daily/page.tsx` | `GET /pos/daily-report` in preview modal |

| `gates-web/app/pos/point-of-sale/page.tsx` | Cart line state, computed totals, `POST /pos/sales` |

| `gates-web/app/inventory/reports/cost-center-item-movement/` | Commissions / opening-stock wired (prior) |

| `gates-web/app/extracts/reports/*.tsx` | Extract report APIs |

| `gates-web/app/taxes/operations/vat-declaration/page.tsx` | Tax periods + declaration generate |

| `gates-web/app/pos/point-of-sale/page.tsx` | Wave-2 shift/orders when terminal exists; live daily/shift totals; legacy `/pos/sales` fallback |

| `gates-web/lib/hooks/usePosSession.ts` | Terminals, open shift, order post helper |

| `gates-web/app/manufacturing/creations/manufacturing-stages/page.tsx` | `GET /manufacturing/boms` |

| `gates-web/app/manufacturing/creations/manufacturing-plan/page.tsx` | `GET /manufacturing/orders` |

| `gates-web/app/extracts/operations/general-extract-items/page.tsx` | `GET /extracts/work-items` |

| `gates-web/app/extracts/operations/detailed-extract-items/page.tsx` | `GET /extracts/work-items` |

| `gates-web/app/extracts/operations/project-measurement-definition/page.tsx` | `GET /extracts/measurement-definitions` |

| `gates-backend` | `RealEstateReservation` model + service; `GET /real-estate/properties`; `GET /manufacturing/orders`; extract list APIs; `GET /pos/shifts/open` |

## Already live (no mock in critical path)



- **Trial balance / income statement / balance sheet previews** — `ReportPreviewFromRegistry` → `GET /accounting/reports/*`

- **Accounts balance / P&L previews** — registry → backend routes

- **HR employee data** — `GET /hr/employees`, departments, mutations

- **Most tax/schools report previews** — registry → backend routes



## Remaining (lower priority / vertical WIP)



- `gates-web/app/extracts/operations/*` (general/detailed items, project measurement) — static `tableData` until CRUD UX is built

- `manufacturing/creations/*` — static `tableData` grids

- `electronic-invoices/creations/item-card` — form defaults still demo-shaped

- Commission policy POST routes — backend may not exist yet; UI sends tier payloads when save is used

- Real-estate placeholder services (backend stubs in `real-estate/services/*`)

- Preview skeletons using `Array.from` for loading (intentional, not business mock data)



## Backend stubs (intentional / vertical WIP)



- `real-estate`: reservation, closure, followup — placeholder IDs

- `manufacturing/reports.service.ts` — some placeholder capacity/cost fields

- `electronic-invoices`: ETA client mock when `ETA_SIGNING_PROVIDER=mock` (dev only)



## Verification commands



```bash

cd gates-web && npx tsc --noEmit && npm run lint

cd gates-backend && npx tsc --noEmit && npm run lint

```



## Detection patterns for future sweeps



```bash

rg "25,4456|27,4456|staticRows|mockData|DUMMY_" gates-web/app gates-web/components gates-web/lib

rg "Array\.from\(\{ length:" gates-web/app --glob "*.tsx"

rg "placeholder-id|Listing .* \(placeholder\)" gates-backend/src

```



**Sweep status (2026-08-18):** Medium-priority inventory/extract creation & ops grids cleared. Residual demo amounts mainly in POS secondary UI, manufacturing, and a few extract definition screens.

