# M1 — Accounting Foundation & General Ledger

## 1. Module Overview & Legacy Source Analysis

### Domain scope

Chart of accounts, cost centers, currencies and rates, opening balance batches, manual general journal (GL), journal inquiry/filter, account cards, balance sheet tooling, GL import, and the **central double-entry store** (`GLTrxHeader` / `GLTrxDetail`) referenced by cash, invoices, and payroll.

### Key Delphi files

| Area | Units |
|------|--------|
| COA / CC | [untChartOfAccounts.pas](../../../../MainProgram/untChartOfAccounts.pas), [untChartOfCCenters.pas](../../../../MainProgram/untChartOfCCenters.pas), [untAccountCard.pas](../../../../MainProgram/untAccountCard.pas), [untCCenterCard.pas](../../../../MainProgram/untCCenterCard.pas) |
| GL UI | [UntGL.pas](../../../../MainProgram/UntGL.pas), [UntGLFilter.pas](../../../../MainProgram/UntGLFilter.pas), [untGLOptions.pas](../../../../MainProgram/untGLOptions.pas) |
| Currency / year | [untCurrency.pas](../../../../MainProgram/untCurrency.pas), [untYear.pas](../../../../MainProgram/untYear.pas) |
| Opening balances | [UntBalanceAccounts.pas](../../../../MainProgram/UntBalanceAccounts.pas) |
| Import | [UntImportGL.pas](../../../../MainProgram/UntImportGL.pas), [UntImportCCenter.pas](../../../../MainProgram/UntImportCCenter.pas) |
| Reports | [UntGLRep.pas](../../../../MainProgram/UntGLRep.pas), [UntDBRep.pas](../../../../MainProgram/UntDBRep.pas), [UntIncomeStatement.pas](../../../../MainProgram/UntIncomeStatement.pas) |
| Kernel | [untgeneral.pas](../../../../MainProgram/untgeneral.pas) (GLNum, balances, bulk post SQL) |

### Underlying database tables

| Table | Purpose |
|-------|---------|
| `Account` | Chart of accounts |
| `AccountCardDist` | Account distribution cards |
| `CostCenter` | Cost center tree |
| `Currency`, `CurrencyHistory` | Currencies and historical rates |
| `GLTrxHeader`, `GLTrxDetail` | Journal header/lines |
| `GLTrxHeaderTemp` | Staging |
| `GLTransVio`, `CCTransVio` | Posting violations / warnings |
| `BalanceAccountsH`, `BalanceAccountsD` | Opening balance documents |
| `NotAllowedAccount` | Block list |
| `IncomeStatementAccounts`, `PivotCostCenter` | Reporting configuration |
| `Etemad`, `MainEtemad*` | Authorization / main approval chains |

See [DataBase.ini `[Account]`, `[GLTrxHeader]`, `[GLTrxDetail]`](../../../../MainProgram/DataBase.ini) for column types (`decimal(18,0)` levels, `nvarchar` names, etc.).

---

## 2. Business Logic, Formulas & Accounting Rules

### Core operations & flows

**Manual journal (`UntGL`):**

1. User enters header (date, descriptions, type) and grid lines (account, CC, debit, credit, currency **Change** factor).
2. **CalTotals** runs before save.
3. **SaveBtnClick:** validate license cap → optional save warning → Hijri date required → **CalTotals** → balance flag → **GetPeriod** → assign **GLNum** (auto or manual, continuous vs per-year) → DELETE+INSERT `GLTrxDetail` → INSERT/UPDATE `GLTrxHeader` with `Status='UnPost'`, `Balanced='T'|'F'`.
4. **Post:** `Status='Post'` on header; trace logged; approval gate `MyApproval.ApprovalNow='T'`.
5. **UnPost:** reverses status to `UnPost` if company allows `GLUnPost`.
6. **Delete:** soft `Deleted='T'` on header when document open.

**Source documents:** Other modules create GL rows with same `GLNum` and link via header fields `Type`, `SourceNum`, `YearId` (cash updates in `untgeneral` ~10004+).

### Calculations & math

**Line totals with currency (CalTotals):**

For each detail row `a` with account populated (column 14 non-empty):

- Default empty debit/credit cells to `0`.
- `DebitValue += DebitCell * ChangeCell`
- `CreditValue += CreditCell * ChangeCell`

Display (rounded to 4 decimals):

```text
TotalDebit  = RoundTo(DebitValue, -4)
TotalCredit = RoundTo(CreditValue, -4)
Difference  = RoundTo(DebitValue - CreditValue, -4)
```

**Balance rule on save:**

- If `Trim(TotalDebit) <> Trim(TotalCredit)`:
  - If setting `SaveUnbalanced='T'` → save with `Balanced='F'`.
  - Else abort (message 2186).

**Account balance lookup (posted only):**

From [UntGL.pas](../../../../MainProgram/UntGL.pas) ~4508:

```sql
ISNULL((SELECT Sum((D.DebitValue - D.CreditValue) * Change) AS TotalValue
        FROM GLTrxHeader H, GLTrxDetail D
        WHERE ... account match ...
          AND H.Status = 'Post'), 0) AS BalanceValue
```

**GL number generation (`CreateGlNumSpecial`):**

- Read serial mode from `CompanySetting` (continuous `C` vs per `YearId`).
- Next GLNum = `RIGHT('00000000' + CONVERT(varchar(8), ISNULL(MAX(CAST(GLNum AS decimal(18,0))),0)+1), 8)` scoped by company + branch (+ year if not continuous).

**Node journal service (current):**

[journal-entry.service.ts](../../../gates-backend/src/modules/accounting/services/journal-entry.service.ts) validates `|debitSum - creditSum| <= 0.01` and min 2 lines—align tolerance with `RoundTo(..., -4)` (0.0001) for parity.

### Accounting & journal entry generation

| Event | Debit | Credit | Notes |
|-------|-------|--------|-------|
| Manual GL line entry | `DebitValue` on account | `CreditValue` on account | Per line; CC optional |
| Post | No new lines | — | `Status` flip; balances include posted only |
| Cash/invoice integration | Module-specific | Module-specific | Same `GLTrxDetail` table |

**Cost centers:** Lines may require CC when account flagged in COA; violations stored in `CCTransVio` / `GLTransVio` (verify on post in legacy).

**Tax on GL lines:** `UntGL` supports `DaribaPercentCode` on details—links to M7.

### Validation rules & edge cases

- Fiscal year closed → cannot save (2189).
- Period invalid → 2188.
- Post enabled only when: `Status=UnPost`, `Balanced=T`, header `Status=Open`, `GLPost=T`, same branch, not deleted, approved.
- UnPost when `Status=Post`, `GLUnPost=T`, same conditions.
- **AutoPost:** If `AutoPost='T'` and approval count zero, save triggers post automatically (~1953).
- Accounts in `NotAllowedAccount` blocked on save (queries ~1893+).
- **Eshar** integration: `create_Eshar_Debit` adds tax notification lines on certain operations.

---

## 3. Architecture Modernization & Refactoring Plan

### Legacy smells

- Save = DELETE all details + re-INSERT (loss of line identity; race without transaction).
- String-built SQL with company/branch embedded.
- Balance checks split between UI (`CalTotals`) and ad hoc SQL.
- Posted vs unposted mixed in same tables (status flag).

### Target architecture

```
JournalEntryController
  → JournalEntryService (CRUD, validate balance, period)
  → JournalPostingService (post/unpost, violations, activity log)
  → GlLegacyMapper (GLTrxHeader ↔ JournalEntry field map)
  → NumberSequenceService (M0)
  → FiscalPeriodService (M0)
```

**`prisma.$transaction` boundaries:**

1. Create/update draft entry + lines.
2. Post: update status + write `CostCenterMovement` / account sub-ledgers if used + violation rows.
3. UnPost: reverse status + optional movement reversal.

Use **Zod** schemas mirroring max lengths from `DataBase.ini` (e.g. account code nvarchar(20)).

---

## 4. Target Prisma Models & Data Schema

Evolve existing models:

```prisma
model JournalEntry {
  id              String   @id @default(uuid())
  companyId       String
  branchId        String
  fiscalYearId    String
  legacyGlNum     String   @db.VarChar(8)
  voucherNumber   String?
  entryDate       DateTime
  hijriDate       String?
  descriptionAr   String?
  descriptionEn   String?
  currencyCode    String
  status          String   @default("UnPost") // UnPost | Post
  documentStatus  String   @default("Open")    // Open | ...
  isBalanced      Boolean  @default(true)
  isDeleted       Boolean  @default(false)
  sourceType      String?  // manual GL type / PI / RI / Cash...
  sourceNumber    String?
  sourceYearId    String?
  isPosted        Boolean  @default(false) // derived: status == Post
  isApproved      Boolean  @default(false)
  createdBy       String
  postedAt        DateTime?
  postedBy        String?
  lines           JournalEntryLine[]
  @@unique([companyId, branchId, fiscalYearId, legacyGlNum])
  @@index([companyId, entryDate, status])
  @@map("journal_entries")
}

model JournalEntryLine {
  id              String  @id @default(uuid())
  journalEntryId  String
  lineNumber      Int
  accountId       String
  costCenterId    String?
  descriptionAr   String?
  descriptionEn   String?
  debit           Decimal @db.Decimal(18, 4)
  credit          Decimal @db.Decimal(18, 4)
  exchangeRate    Decimal @default(1) @db.Decimal(18, 6) // legacy Change
  debitBase       Decimal @db.Decimal(18, 4) // debit * rate
  creditBase      Decimal @db.Decimal(18, 4)
  taxPercentCode  String?
  @@map("journal_entry_lines")
}

model OpeningBalanceBatch {
  id           String @id @default(uuid())
  companyId    String
  branchId     String
  fiscalYearId String
  legacyDocNum String?
  lines        OpeningBalanceLine[]
  @@map("opening_balance_batches")
}

model GlPostingViolation {
  id             String @id @default(uuid())
  journalEntryId String
  violationType  String // GL | CC
  accountCode    String?
  costCenterCode String?
  message        String?
  @@map("gl_posting_violations")
}
```

Import path: map `GLTrxHeader.GLNum` → `legacyGlNum`, `DescA/DescE` → descriptions, `Balanced`, `Deleted`, `Type`, `SourceNum`.

---

## 5. API Endpoint Specifications

| Method | Route | Body | Response | Permission |
|--------|-------|------|----------|------------|
| GET | `/api/v1/accounting/accounts` | tree filter | COA | `coa.view` |
| POST | `/api/v1/accounting/accounts` | account DTO | created | `coa.manage` |
| GET | `/api/v1/accounting/cost-centers` | — | CC tree | `cc.view` |
| GET | `/api/v1/accounting/journal-entries` | date, status, glNum | list | `gl.view` |
| POST | `/api/v1/accounting/journal-entries` | header + lines | draft | `gl.create` |
| PUT | `/api/v1/accounting/journal-entries/:id` | lines replace | updated | `gl.edit` |
| POST | `/api/v1/accounting/journal-entries/:id/post` | — | posted | `gl.post` |
| POST | `/api/v1/accounting/journal-entries/:id/unpost` | — | unposted | `gl.unpost` |
| DELETE | `/api/v1/accounting/journal-entries/:id` | soft | deleted | `gl.delete` |
| GET | `/api/v1/accounting/journal-entries/:id/source` | — | source doc link | `gl.view` |
| GET | `/api/v1/accounting/reports/trial-balance` | period | balances | `reports.gl` |
| POST | `/api/v1/accounting/opening-balances` | batch | import | `gl.opening` |

Request headers (M0): `X-Company-Id`, `X-Branch-Id`; body dates drive fiscal year validation.

---

## 6. Phased Execution & Unit Testing Strategy

### Implementation checklist

1. Extend Prisma `JournalEntry` with legacy fields; migration backfill nullable.
2. Implement `CalTotals` equivalent in `JournalBalanceCalculator` (rate × amount, round 4 dp).
3. Port `CreateGlNumSpecial` → `NumberSequenceService` for docType `GL`.
4. Implement post/unpost with same state guards as `Set_FormButtons` / dxButton1/2 logic.
5. Wire `CompanySetting`: `SaveUnbalanced`, `AutoPost`, `GLPost`, `GLUnPost`.
6. Optional: import `BalanceAccountsH/D` → `OpeningBalanceBatch`.
7. Reconcile [0005_posting_rules.sql](../../../gates-backend/prisma/migrations/0005_posting_rules.sql) with legacy account mapping tables.

### Parity tests (penny-level)

| # | Scenario | Assert |
|---|----------|--------|
| 1 | 3-line journal, USD rate 30.5 on one line | Totals match Delphi CalTotals |
| 2 | Unbalanced draft, SaveUnbalanced=F | 422, no row |
| 3 | Unbalanced draft, SaveUnbalanced=T | saved, isBalanced=false, post blocked |
| 4 | Post then trial balance | Matches SQL BalanceValue for account |
| 5 | Closed year date | 422 / legacy 2189 |
| 6 | Continuous serial mode | GL nums monotonic across years within branch |
| 7 | Yearly serial mode | GL nums reset scope per YearId |
| 8 | AutoPost=T, no approval | save → status Post in one transaction |

---

**References:** [UntGL.pas SaveBtnClick ~1457–1953](../../../../MainProgram/UntGL.pas), [CalTotals ~1077–1103](../../../../MainProgram/UntGL.pas), [CreateGlNumSpecial ~5490](../../../../MainProgram/untgeneral.pas).
