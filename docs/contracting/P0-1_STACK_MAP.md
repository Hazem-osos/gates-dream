# P0-1 — Four contracting stacks (internal map)

| Stack | Entities | Create API | Post / GL | Web entry (before P0-1) |
|-------|----------|------------|-----------|-------------------------|
| **Legacy extracts** | `Project`, `ProjectWorkItem`, `Extract`, `ExtractPayment` | `/api/v1/extracts/*` | Extract post disabled; payment optional GL | `/extracts/operations/*` |
| **Wave3 header** | `ClientExtract`, `SubcontractorExtract`, `ProjectSubcontract` | `/contracting/client-extracts`, `/subcontractor-extracts`, `/projects/:id/subcontracts` | Post → JE | API only |
| **Wave3 BOQ extract** | `ProjectBoqItem`, `ContractExtract` | `/contracting/boq`, `/contracting/extracts` | Post/unpost → JE | `/contracting/extracts` |
| **Enterprise** | `ProjectBOQItem`, `ExecutiveMeasurementSheet`, `ClientContract`, `ClientInvoice`, `Subcontract`, `SubcontractInvoice` | `/contracting/technical-office`, `/client-billing`, `/subcontracts` | Finance post → JE | `/contracting/projects/:id/*`, `/subcontracts` |

**P0-1 policy:** New `ContractingProject` rows default `canonicalStack = ENTERPRISE`. Wave3 **mutations** blocked when `ENTERPRISE`. Existing Wave3 usage backfilled to `LEGACY_WAVE3`.
