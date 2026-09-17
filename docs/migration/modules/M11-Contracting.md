# M11 / M13 — Contracting & Extracts

## Scope

| Area | Implementation |
|------|----------------|
| **Projects** | `ContractingProject` + `ProjectSubcontract` (owner, contract value, advance/retention %, cost center) |
| **Client extract** | Gross → advance & retention deductions → VAT on net taxable base → WHT → net receivable |
| **Subcontractor extract** | Gross → advance recovery, retention, penalties (optional), WHT → net AP |
| **GL** | Accrual JEs with project **cost center** on revenue / subcontract expense lines |

Legacy **`/api/v1/extracts/*`** (buildings, work items) unchanged.

## Schema (`20250816240000_wave3_m11_m13_contracting`)

- **`ContractingSettings`** — GL codes + default VAT 14% / WHT 1%
- **`ClientExtract`** / **`SubcontractorExtract`**

## Client extract JE

- **Dr** AR (net), retention held (asset), customer advances, WHT asset  
- **Cr** contracting revenue (gross, cost center), output VAT  

## Subcontractor extract JE

- **Dr** project subcontract expense (gross, cost center)  
- **Cr** subcontractor AP (net), retention withheld (liability), subcontractor advances, WHT payable  

## API (`/api/v1/contracting`)

| Method | Path |
|--------|------|
| POST/GET | `/projects`, GET `/projects/:id` |
| POST | `/projects/:id/subcontracts` |
| POST | `/client-extracts`, POST `/client-extracts/:id/post` |
| POST | `/subcontractor-extracts`, POST `/subcontractor-extracts/:id/post` |

## Test

```bash
npm run test:wave1-invoices
npm run test:wave3-contracting
```

## Follow-ups

- Penalty / material deduction GL lines when non-zero  
- Link legacy extract items to wave3 posting  
- Owner extract collection via M2 treasury  
