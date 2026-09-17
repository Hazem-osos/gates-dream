# Draft autosave coverage

Persisted **client state** only. Next.js App Router `children` must never be cached or remounted.

CREATE drafts use:

`gates:draft:${documentType}:${companyId}:new`

or with variant:

`gates:draft:${documentType}:${variantId}:${companyId}:new`

Same browser session: auto-restore on return. Other session: Restore / Discard banner. Company IDs never share keys.

## FULLY PROTECTED (CREATE)

| Screen | `documentType` / variant | Snapshot includes |
|---|---|---|
| Sales invoice | `sales-invoice` | Header form (customer, dates, warehouse, currency, FX, cost center, delegate/seller, payment, safe/advance, description, source, development fee) + lines (qty, units, prices, discounts, taxes, notes) + extras + payment splits + installments + internal notes + tax flag + conditions + customerSeed |
| Purchase invoice | `purchase-invoice` | Supplier header + lines + freight + supplier discount + payment splits + installments + internal notes + tax flag |
| Journal entry | `journal-entry` | Header + lines + cyclic + header FX override + source |
| Sales order | `sales-order` | Header + commercial lines |
| Price quote | `price-quote` | Header + commercial lines |
| Treasury voucher | `voucher` + `CASH_DISBURSEMENT` / `CASH_RECEIPT` / `BANK_DEBIT_ADVICE` / `BANK_CREDIT_ADVICE` | Header + lines + credit lines + default cost center + invoice allocations |
| Treasury order | `treasury-order` + variant | Header + lines + invoice allocations |

## PARTIALLY PROTECTED

| Screen | Gap |
|---|---|
| Opening stock | Separate hook `gates_opening_stock_draft_${companyId}_${fiscalYearId}`. Lines only. Not `useDraftAutosave`. |
| All FULLY PROTECTED screens in **EDIT** | Draft disabled once a document id is in the URL. Unsaved edits are lost on tab switch. |

### EDIT mode — future design (not enabled)

Key: `gates:draft:${documentType}:${companyId}:edit:${documentId}`

Do **not** auto-apply over server data. Required later:

- Compare draft `savedAt` / document `version` with the loaded record
- If another user posted or saved a newer version, show a conflict banner — never silent overwrite
- Clear the edit draft on successful save, post, cancel, or discard
- Ignore drafts whose companyId does not match

Current risk: open saved document → type → switch GATES tab → return → server record only.

## NOT PROTECTED

- Sales returns
- Purchase returns
- Purchase orders
- Inventory receipt / issue
- Warehouse transfers
- Assembly / disassembly
- Stocktaking
- Inventory adjustments / other additions-discounts
- Accounting opening balance
- Cheques / cheque portfolio
- Commercial papers (securities receipt & payment, bulk)
- Cost-center / account movement
- Contracting extracts & related ops
- Real-estate reservation / closure
- Manufacturing operation
- Invoice installments standalone page
- Master cards (customer, supplier, item, warehouse, …)

Coverage for those screens is a later pass after this infrastructure stays stable.
