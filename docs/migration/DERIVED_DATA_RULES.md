# Derived Data Rules (Old vs New)

Classification: **COPY** | **CALCULATE** | **RECONSTRUCT** | **DEFAULT** | **OWNER_DECISION_REQUIRED** | **IMPOSSIBLE_FROM_AVAILABLE_DATA**

---

## Accounting

| Data | Old | New | Rule | CONF |
|------|-----|-----|------|------|
| Account balance | Derived from posted GL | Same | RECONSTRUCT from imported JE | HIGH |
| `debitBase` / `creditBase` | Implicit (× Change) | Explicit columns | CALCULATE | HIGH |
| Party card balance | Cached on post in legacy? | Card columns + ledger services | RECONSTRUCT via sync job or post pass | MEDIUM |
| `isBalanced` | Header flag | Header flag | COPY | HIGH |
| Fiscal period on doc | `YearID` | `fiscalYearId` UUID | MAP via cache | HIGH |

---

## Inventory

| Data | Old | New | Rule | CONF |
|------|-----|-----|------|------|
| Qty on hand | `ItemStore` / movements | Movements + balances | RECONSTRUCT (prefer movements) | MEDIUM |
| Average cost | `ItemCost` latest | Warehouse MAC | CALCULATE or COPY latest with validation | MEDIUM |
| Available qty | May not exist | onHand − reserved | CALCULATE in new only | HIGH |
| `baseQuantity` on lines | `Qty1` × unit change | `ItemUnit` | CALCULATE | MEDIUM |

---

## Commercial

| Data | Old | New | Rule | CONF |
|------|-----|-----|------|------|
| Header totals | Stored on header | May validate vs lines | COPY + validate | MEDIUM |
| Tax breakdown | `Dariba*` fields | Tax engine lines | TRANSFORM / OWNER | MEDIUM |
| `remainingAmount` | Legacy remaining | Open amount | COPY or RECONSTRUCT from payments | LOW |
| Payment method | `CashType`, `PaidType` | Enum | TRANSFORM | MEDIUM |

---

## Platform

| Data | Old | New | Rule | CONF |
|------|-----|-----|------|------|
| `companyId` | `CompanyCode` | UUID | MAP via MigrationContext | HIGH |
| `branchId` | `BranchCode` | UUID | MAP | HIGH |
| `createdBy` | `UserCode` | User id | DEFAULT `'legacy-import'` or MAP users | OWNER |
| `createdAt` | `SaveDateTime` sometimes | Audit fields | COPY if present else DEFAULT | MEDIUM |
| Document numbers | Legacy per-year | New numbering series | COPY for history; GENERATE for new docs | OWNER |

---

## Posting status

| Data | Old | New | Rule | CONF |
|------|-----|-----|------|------|
| Posted flag | `Status='Post'` | `isPosted` | COPY | HIGH |
| Inventory applied | Implicit | Movement rows exist | RECONSTRUCT or skip if READ_ONLY | MEDIUM |

---

## Impossible / blocked without more data

| Data | Reason |
|------|--------|
| Exact `PostInvoice` account mapping | No SP body |
| Custom per-customer SP behavior | Unknown |
| Live duplicate detection counts | No production dump in repo |
