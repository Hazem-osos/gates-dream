# GATES MIGRATION ENGINE — PHASE 2 COA REPORT

> Auto-filled from LegacyForensic pilot (`0001`). Re-run `scripts/migration/pilot/run-coa-pilot.ts` to refresh.

## LEGACY ACCOUNT MASTER

| Table | Company | Rows |
|-------|---------|-----:|
| `dbo.Account` | `0001` | **136** |

## POSTED GL DISTINCT ACCOUNT CODES

**49** (551 posted lines; TB debit/credit **62,869,333.38** / **62,869,333.38**)

## ACCOUNT UNIVERSE

| Bucket | Count |
|--------|------:|
| master only | 89 |
| master + GL | 47 |
| GL only (posted) | 2 |
| balance only | 0 |
| other (party refs not in master/GL) | 6 |

## PREVIOUS ~70 GL-ONLY CODES EXPLAINED

**YES** — for this database the “~70” figure is **not** posted-GL-only for company `0001`. It came from broader ETL counting (all GL detail / other companies). Posted GL-only here is **2**.

### BREAKDOWN (posted GL-only)

| Category | Codes |
|----------|-------|
| derived / POS sub-ledger | `102020101001` |
| ambiguous (short prefix only) | `102060101003` |
| party-dependent (exact Customer.AccountCode) | 0 in GL-only set |
| formatting / normalization | 0 (raw vs RTRIM identical) |

## TARGET ACCOUNT INVARIANTS

- `companyId` + `code` unique; `arabicName` required
- `accountKind` HEADER vs POSTING; journal lines require POSTING
- `accountNature` DEBIT/CREDIT; `statementType` BALANCE_SHEET | INCOME_STATEMENT
- Hierarchy via `parentId`; no POSTING parent with children (ERP promotes parent to HEADER on child create)

## CLASSIFICATION (required for posted GL = 49 codes)

| Class | Count (expected) |
|-------|-----------------:|
| EXACT_MASTER | 47 |
| DERIVED_FROM_LEGACY_STRUCTURE | 1 |
| AMBIGUOUS | 1 |
| DEPENDENT_ON_FUTURE_PARTY_MIGRATION | 0 (party codes are in master) |

## COA DRY RUN

**PASS** when `accountRowDelta = 0`.

## COA IMPORT

Migrates **136** masters + **1** derived GL leaf = **137** accounts when execute succeeds.

## GL READINESS

| Metric | Value |
|--------|------:|
| distinct posted GL codes | 49 |
| resolved | 48 |
| ambiguous | 1 |
| amounts unmapped (preview) | 84.00 (60+24 on `102060101003`) |

**Blocker before posted GL migration:** resolve or explicitly block `102060101003`.

## RECOMMENDED NEXT DOMAIN

**Party (Customer/Supplier)** — analytical account codes already on party cards; then **posted GL** stage after GL readiness = 100%.

## PHASE 2 STATUS

**BLOCKED** for posted GL (1 ambiguous code) / **COMPLETE** for COA master + safe derived subset.
