# M8 — Manufacturing, BOM & Production Costing

## Scope

| Area | Implementation |
|------|----------------|
| **BOM** | `BillOfMaterials` + `BomLine` (scrap %, standard labor/overhead) |
| **Production order** | `DRAFT` → `RELEASED` → `IN_PROGRESS` → `COMPLETED` |
| **Material issue** | M4 stock out + Dr WIP materials / Cr raw inventory |
| **Labor & OH** | Dr WIP labor/OH / Cr overhead absorption |
| **Completion** | FG receipt at batch unit cost + Dr FG / Cr WIP (materials + labor/OH) + M4 moving average |

Legacy inventory **`Assembly`** remains separate from wave3 production orders.

## Schema (`20250816230000_wave3_m8_manufacturing`)

- **`ManufacturingSettings`** — GL codes (1501, 1502, 1310, 1320, 5205 defaults)
- **`ProductionMaterialIssue`** / **`ProductionMaterialIssueLine`**

## API (`/api/v1/manufacturing`)

| Method | Path |
|--------|------|
| POST/GET | `/boms`, GET `/boms/:id` |
| POST | `/orders` |
| POST | `/orders/:id/release` |
| POST | `/orders/:id/issue-materials` |
| POST | `/orders/:id/add-costs` — `{ laborCost, overheadCost }` |
| POST | `/orders/:id/complete` — `{ actualQuantity }` |
| GET | `/orders/:id` |

## Test

```bash
npm run test:wave1-invoices
npm run test:wave3-manufacturing
```

## Follow-ups

- Multi-stage routing / work centers  
- Scrap actual vs standard variance posting  
- Link to legacy `inventory/assemblies` UI  
