# Phase 3 — Customer / Supplier migration

## Scope

- Legacy `Customer`, `Supplier` (+ categories when present) → GATES `Customer`, `Supplier`, `CustomerCategory`, `SupplierCategory`.
- Links `mainAccountId` / `accountId` to **existing** COA `Account` rows (Phase 2). No new COA leaves for parties unless already in COA.
- **No** invoices, posted GL, opening journals, or `Mozana` balance import (`CACHE` only).

## LegacyForensic profile (`0001`)

| Entity | Table | Rows |
|--------|-------|-----:|
| Customers | `dbo.Customer` | 6 |
| Suppliers | `dbo.Supplier` | 1 |
| Customer categories | `dbo.CustomerCategory` | 0 (no `CompanyCode`) |
| Supplier categories | — | — |

Business keys: `CompanyCode` + `CustomerCode` / `SupplierCode`.  
Party GL codes: `AccountCode` (14-char analytical leaves); all 6 customer + 1 supplier codes exist in `dbo.Account`.

## Field mapping (representative)

| Legacy | GATES Customer |
|--------|----------------|
| `CustomerCode` | `code`, `serial` |
| `CustomerNameA` / `E` | `arabicName` / `englishName` |
| `AccountCode` | `mainAccountId`, `accountId` (resolve via COA) |
| `Phone1/2`, `Mobile`, `Fax` | contact fields |
| `Email` | `email` (validated; invalid → null) |
| `Site` | `website` |
| `Address`, `Street`, `City` | address fields |
| `CurrencyCode` | `currencyCode` |
| `TradeNum` | `taxAuthority`, `taxData` |
| `CustomerCase` `L` | `how=local`, active |
| `Mozana` | **not imported** (`balance` stays 0) |

Supplier mapping mirrors with `SupplierNameA/E`, `SupplierCode`, etc.

## Account relationship classes

| Class | Meaning |
|-------|---------|
| `EXACT_COA_ACCOUNT` | Target POSTING account with same `code` |
| `SHARED_CONTROL_ACCOUNT` | Resolved HEADER — invalid for party leaf |
| `MISSING_ACCOUNT` | Code not in target COA |
| `DERIVED_SAFE_ACCOUNT` | Reserved for future COA-derived leaves |
| `AMBIGUOUS_ACCOUNT` | Multiple/conflicting targets |

## Stage

- Name: **`PARTIES`**
- Depends: **`FOUNDATION`**, **`COA`**
- CLI: `dry-run-parties`, `run-parties`, `reconcile-parties`
- Id map keys: `{ companyCode, customerCode }`, `{ companyCode, supplierCode }`

## Post-party GL check

Re-runs COA GL readiness and documents party evidence for `102060101003` **without** auto-resolving.
