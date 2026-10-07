# GATES MIGRATION ENGINE — PHASE 3 PARTIES REPORT

## LEGACY CUSTOMER MASTER

`dbo.Customer` — **6** rows (`0001`), key `CustomerCode`.

## LEGACY SUPPLIER MASTER

`dbo.Supplier` — **1** row, key `SupplierCode`.

## PARTY SOURCE PROFILE

- Categories: `CustomerCategory` **0** rows globally; no supplier category table.
- Contacts: Phone1/2, Mobile, Fax, Email, Site, Address.
- Tax: `TradeNum` on customer (sparse).
- `Mozana`: **CACHE** — not imported to `Customer.balance` / `Supplier.balance`.
- No `Deleted` column on customer; `CustomerCase=L` treated as active/local.

## CUSTOMER CLASSIFICATION (expected after COA)

| Class | Count |
|-------|------:|
| SAFE | 6 |
| Other | 0 |

## SUPPLIER CLASSIFICATION

| Class | Count |
|-------|------:|
| SAFE | 1 |

## ACCOUNT RELATIONSHIP ANALYSIS

All party `AccountCode` values match COA master posting accounts → **EXACT_COA_ACCOUNT** after Phase 2 import.

## CUSTOMER/SUPPLIER OVERLAPS

Both use code `00000001` — allowed (separate entities).

## OPENING BALANCE FINDINGS

`Mozana` present; classified **CACHE**. No opening journals in Phase 3.

## TARGET PARTY INVARIANTS

`arabicName` required; `mainAccountId` must reference company-scoped POSTING `Account`; `balance` default 0.

## PILOT

Run `npx tsx scripts/migration/pilot/run-parties-pilot.ts` with `MIGRATION_PILOT_DATABASE_URL` + `LEGACY_FORENSIC_URL`.

**NOT RUN** in CI agent environment (MySQL credentials unavailable).

## 102060101003 FINDING

Party masters **do not** explain this code. No `Customer.AccountCode` / `Supplier.AccountCode` match; not a 14-digit party leaf. **STILL_AMBIGUOUS** — GL readiness remains **48/49**.

## PHASE 3 PARTIES READY

(Implementation complete; pilot E2E pending local DB.)
