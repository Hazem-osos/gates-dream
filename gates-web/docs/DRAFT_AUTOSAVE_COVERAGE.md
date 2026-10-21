# Draft autosave coverage

Persisted **client state** only. Next.js App Router `children` must never be cached or remounted.

CREATE drafts use (per **user** + company + screen):

`gates:draft:${documentType}:${companyId}:${userId}:new`

or with variant:

`gates:draft:${documentType}:${variantId}:${companyId}:${userId}:new`

One draft per user per screen; new edits overwrite the stored payload. **تجاهل** records that snapshot so the banner does not reappear until a newer draft is saved. Legacy keys without `userId` migrate on first read.

Standard wiring: `useDraftAutosave` + `PageDraftRestoreGate`. Master cards: `useMasterCardCreateDraft` + `MasterCardDraftRestoreGate`.

## Operational documents

| Area | `documentType` (examples) |
|---|---|
| Sales / purchase invoice | `sales-invoice`, `purchase-invoice` |
| Returns | `sales-return`, `purchase-return` |
| Purchase order | `purchase-order` |
| Stock | `stock-receipt`, `stock-issue`, `stock-transfer`, `stock-assembly`, `stock-disassembly`, `stocktaking`, `stock-other-adjustment` |
| Opening stock | `opening-stock` (+ fiscal year `variantId`) |
| Item reservation | `item-reservation` |
| Journal / opening balance | `journal-entry`, `opening-balance` |
| Treasury | `voucher` + variant, `treasury-order` + variant |
| Securities | `securities-receipt`, `securities-payment`, batch types in `BatchReceiptCreateForm` |
| Cheques | `cheque-inward`, `cheque-outward` |
| Movements | `account-movement-transfer`, `cost-center-movement-transfer` |
| Manufacturing | `manufacturing-operation`, `manufacturing-bom-model`, `manufacturing-work-order` (CREATE via production-planning) |
| Commercial | `sales-order`, `price-quote`, `item-offer` |
| Other additions/discounts type | `other-additions-discount-type` |
| Invoice installments tracker | `invoice-installments-tracker` (filters) |
| Real estate | `real-estate-reservation`, `real-estate-closure` |

## Master cards

| Area | `documentType` |
|---|---|
| Accounting cards | `customer-card`, `supplier-card`, `account-card`, `bank-account-card`, `safe-card`, `cost-center-card`, `delegate-card`, `delegate-group-card`, `driver-card`, `distributor-card`, `customer-group-card`, `supplier-group-card` |
| Inventory creations | `item-card`, `warehouse-card`, `item-group-card`, `color-size-matrix`, `price-list-card`, `order-limit-items`, `customer-contract`, `representatives-commission-*` |

Shared components: `DelegateKindCardPage`, `PartyGroupCardPage`.

## EDIT mode gap (all screens)

When a saved document id is in the URL, CREATE draft is disabled. Unsaved edits on an opened document are not persisted until EDIT-mode drafts are designed (`:edit:${documentId}` + version conflict rules).

## Skipped (no CREATE form on route)

| Route | Reason |
|---|---|
| `manufacturing/operations/work-order` | Redirect to production planning |
| `inventory/creations/customers`, `suppliers`, `items`, `categories`, `pricing-policies` | Redirect aliases |
| `accounting/operations/account-movement` | Redirect to transfer tools |
| `accounting/cards/staff` | Launcher dialog only |
| List-only / report pages | No unsaved editor state |

## Removed legacy

- `useOpeningStockDraft` / `OpeningStockDraftBanner` → `useDraftAutosave` (`opening-stock`).
