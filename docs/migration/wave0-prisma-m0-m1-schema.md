# Wave 0 — Prisma schema proposal (M0 + M1)

Review this document before applying changes to [gates-backend/prisma/schema.prisma](../gates-backend/prisma/schema.prisma).

**Design notes**

- **UUID `companyId` / `branchId`** remain the primary FKs for the Node app.
- **Legacy business keys** (`legacyCompanyCode`, `legacyBranchCode`, `legacyYearId`, `legacyGlNum`) support import parity and compound uniqueness matching SQL Server.
- Existing **`Period`** model stays for current APIs; **`FiscalYear`** aligns with legacy `Year.YearId` and open/close posting rules.
- **`CompanySettings`** (wide row) stays; **`CompanySettingEntry`** holds legacy EAV `CompanySetting.Name/Value` rows (`GLPost`, `SerialAutomatic`, `SaveUnbalanced`, …).

---

## M0 — New / updated models

### `Company` (add fields + relations)

```prisma
model Company {
  id                String    @id @default(uuid())
  legacyCompanyCode String?   @db.VarChar(20)
  // ... existing fields ...

  fiscalYears           FiscalYear[]
  fiscalPeriods         FiscalPeriod[]
  companySettingEntries CompanySettingEntry[]
  documentSequences     DocumentSequence[]
  glPostingViolations   GlPostingViolation[]

  @@unique([legacyCompanyCode])
  @@map("companies")
}
```

### `Branch` (add fields + relations)

```prisma
model Branch {
  id               String  @id @default(uuid())
  companyId        String
  legacyBranchCode String? @db.VarChar(20)
  // ... existing fields ...

  journalEntries    JournalEntry[]
  documentSequences DocumentSequence[]

  @@unique([companyId, legacyBranchCode])
  @@map("branches")
}
```

### `CompanySettingEntry` (new)

```prisma
model CompanySettingEntry {
  id        String   @id @default(uuid())
  companyId String
  name      String   @db.VarChar(100)
  value     String   @db.Text
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  company Company @relation(fields: [companyId], references: [id], onDelete: Cascade)

  @@unique([companyId, name])
  @@index([companyId])
  @@map("company_setting_entries")
}
```

### `FiscalYear` (new — legacy `Year`)

```prisma
model FiscalYear {
  id           String   @id @default(uuid())
  companyId    String
  legacyYearId String   @db.VarChar(20)
  arabicName   String?
  englishName  String?
  startDate    DateTime
  endDate      DateTime
  status       String   @default("Open") @db.VarChar(10) // Open | Close
  isActive     Boolean  @default(true)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  company           Company            @relation(fields: [companyId], references: [id], onDelete: Cascade)
  fiscalPeriods     FiscalPeriod[]
  documentSequences DocumentSequence[]
  journalEntries    JournalEntry[]

  @@unique([companyId, legacyYearId])
  @@index([companyId, status])
  @@map("fiscal_years")
}
```

### `FiscalPeriod` (new — optional monthly slices)

```prisma
model FiscalPeriod {
  id           String   @id @default(uuid())
  companyId    String
  fiscalYearId String
  periodNumber Int
  name         String?
  startDate    DateTime
  endDate      DateTime
  isClosed     Boolean  @default(false)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  company    Company    @relation(fields: [companyId], references: [id], onDelete: Cascade)
  fiscalYear FiscalYear @relation(fields: [fiscalYearId], references: [id], onDelete: Cascade)

  @@unique([fiscalYearId, periodNumber])
  @@index([companyId, startDate, endDate])
  @@map("fiscal_periods")
}
```

### `DocumentSequence` (new)

```prisma
model DocumentSequence {
  id           String   @id @default(uuid())
  companyId    String
  branchId     String?
  fiscalYearId String?
  docType      String   @db.VarChar(30) // GL, CashBP, InvoiceRI, …
  scope        String   @default("Y") @db.Char(1) // C = continuous, Y = per year
  lastNumber   Int      @default(0)
  padding      Int      @default(8)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  company    Company     @relation(fields: [companyId], references: [id], onDelete: Cascade)
  branch     Branch?     @relation(fields: [branchId], references: [id], onDelete: Cascade)
  fiscalYear FiscalYear? @relation(fields: [fiscalYearId], references: [id], onDelete: SetNull)

  @@unique([companyId, branchId, fiscalYearId, docType])
  @@index([companyId, docType])
  @@map("document_sequences")
}
```

**Compound key semantics (legacy)**

| Scope | `fiscalYearId` | Matches legacy |
|-------|----------------|----------------|
| `Y` | set | `CreateGlNumSpecial` with `SerialType <> 'C'` — max+1 per branch **and** `YearId` |
| `C` | `null` | continuous GLNum across years for branch |

MySQL unique index treats multiple `NULL`s in `branchId`/`fiscalYearId` distinctly; use sentinel UUIDs only if you need stricter single-row continuous sequences per branch.

---

## M1 — `JournalEntry` / `JournalEntryLine` alignment

### Replace / extend existing models

```prisma
model JournalEntry {
  id              String    @id @default(uuid())
  companyId       String
  branchId        String?
  fiscalYearId    String?

  /// Legacy GLNum — 8-digit zero-padded string
  legacyGlNum     String?   @db.VarChar(8)
  voucherNumber   String?

  date            DateTime
  hijriDate       String?
  descriptionAr   String?   @db.Text
  descriptionEn   String?   @db.Text
  /// Kept for backward compatibility; prefer descriptionAr/descriptionEn
  description     String?

  currencyCode    String    @db.VarChar(10)
  exchangeRate    Decimal   @default(1) @db.Decimal(18, 6)

  /// Legacy Status: UnPost | Post
  postingStatus   String    @default("UnPost") @db.VarChar(10)
  /// Legacy header workflow: Open | …
  documentStatus  String    @default("Open") @db.VarChar(20)
  isBalanced      Boolean   @default(true)
  isPosted        Boolean   @default(false)
  isApproved      Boolean   @default(false)
  isCyclic        Boolean   @default(false)
  isCancelled     Boolean   @default(false)

  /// Source document link (CashTrx, Invoice, manual GL Type, …)
  sourceType      String?   @db.VarChar(20)
  sourceNumber    String?   @db.VarChar(30)
  sourceYearId    String?   @db.VarChar(20)
  entryType       String?   @db.VarChar(20) // manual GL FormType

  postedAt        DateTime?
  postedBy        String?
  deletedAt       DateTime?

  createdBy       String
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  company    Company     @relation(fields: [companyId], references: [id], onDelete: Cascade)
  branch     Branch?     @relation(fields: [branchId], references: [id], onDelete: Restrict)
  fiscalYear FiscalYear? @relation(fields: [fiscalYearId], references: [id], onDelete: Restrict)
  lines      JournalEntryLine[]
  violations GlPostingViolation[]
  treasuryReceipts TreasuryReceipt[]
  treasuryPayments TreasuryPayment[]

  @@unique([companyId, branchId, fiscalYearId, legacyGlNum])
  @@index([companyId, date])
  @@index([companyId, postingStatus])
  @@index([voucherNumber])
  @@map("journal_entries")
}

model JournalEntryLine {
  id             String  @id @default(uuid())
  journalEntryId String
  lineNumber     Int
  accountId      String
  costCenterId   String?
  descriptionAr  String? @db.Text
  descriptionEn  String? @db.Text
  description    String?

  debit          Decimal @default(0) @db.Decimal(18, 4)
  credit         Decimal @default(0) @db.Decimal(18, 4)
  exchangeRate   Decimal @default(1) @db.Decimal(18, 6)
  debitBase      Decimal @default(0) @db.Decimal(18, 4)
  creditBase     Decimal @default(0) @db.Decimal(18, 4)

  taxPercentCode String? @db.VarChar(20)
  lineOrder      Int

  journalEntry JournalEntry @relation(fields: [journalEntryId], references: [id], onDelete: Cascade)
  account      Account      @relation(fields: [accountId], references: [id])
  costCenter   CostCenter?  @relation(fields: [costCenterId], references: [id])

  @@unique([journalEntryId, lineNumber])
  @@index([journalEntryId])
  @@index([accountId])
  @@map("journal_entry_lines")
}

model GlPostingViolation {
  id             String  @id @default(uuid())
  companyId      String
  journalEntryId String
  violationType  String  @db.VarChar(10) // GL | CC
  accountCode    String? @db.VarChar(20)
  costCenterCode String? @db.VarChar(20)
  message        String? @db.Text
  createdAt      DateTime @default(now())

  company       Company       @relation(fields: [companyId], references: [id], onDelete: Cascade)
  journalEntry  JournalEntry  @relation(fields: [journalEntryId], references: [id], onDelete: Cascade)

  @@index([journalEntryId])
  @@map("gl_posting_violations")
}
```

### Data migration for existing rows

After migration SQL runs:

```sql
UPDATE journal_entries SET postingStatus = IF(isPosted, 'Post', 'UnPost') WHERE postingStatus IS NULL;
UPDATE journal_entry_lines SET
  debitBase = debit * exchangeRate,
  creditBase = credit * exchangeRate,
  lineNumber = lineOrder
WHERE lineNumber IS NULL OR lineNumber = 0;
```

---

## Migration commands

From `gates-backend/` with `DATABASE_URL` set:

```bash
cd gates-backend

# 1) Validate schema
npm run ci:db-preflight

# 2) Create and apply migration (dev)
npm run prisma:migrate -- --name wave0_m0_m1_platform_gl

# 3) Regenerate client (also run by migrate dev)
npm run prisma:generate

# 4) Production deploy
npm run prisma:deploy
```

**Create-only** (review SQL before apply):

```bash
npx prisma migrate dev --create-only --name wave0_m0_m1_platform_gl
# inspect prisma/migrations/<timestamp>_wave0_m0_m1_platform_gl/migration.sql
npx prisma migrate dev
```

**No database** (client only):

```bash
npx prisma generate
npx prisma validate
```

---

## Expected migration SQL (summary)

The generated migration should approximately:

1. `ALTER TABLE companies ADD legacyCompanyCode VARCHAR(20) NULL`, unique index.
2. `ALTER TABLE branches ADD legacyBranchCode VARCHAR(20) NULL`, unique `(companyId, legacyBranchCode)`.
3. `CREATE TABLE company_setting_entries`, `fiscal_years`, `fiscal_periods`, `document_sequences`.
4. `ALTER TABLE journal_entries` add `branchId`, `fiscalYearId`, `legacyGlNum`, `postingStatus`, `documentStatus`, `isBalanced`, `sourceType`, `sourceNumber`, `sourceYearId`, `entryType`, `postedAt`, `postedBy`, `deletedAt`, `descriptionAr`, `descriptionEn`, `exchangeRate`; widen types as needed.
5. `ALTER TABLE journal_entry_lines` add `lineNumber`, `exchangeRate`, `debitBase`, `creditBase`, `descriptionAr`, `descriptionEn`, `taxPercentCode`; change `debit`/`credit` to `DECIMAL(18,4)`.
6. `CREATE TABLE gl_posting_violations`.
7. Add FKs and indexes listed in Prisma.

---

## Step 1 follow-up (after schema merge)

1. **`DocumentSequenceService`** — `next(companyId, branchId, docType, { scope, fiscalYearId })` → padded string; uses `prisma.$transaction` + `UPDATE … lastNumber = lastNumber + 1`.
2. **`TenantAndFiscalContextMiddleware`** — headers: `X-Company-Id`, `X-Branch-Id`, optional `X-Fiscal-Year-Id`; validate branch belongs to company; resolve fiscal year from date via `FiscalYearService.getPeriod(date)` (legacy `GetPeriod`: invalid / `Close` / open id).

## Step 2 follow-up (M1 services — after you verify schema)

- `JournalBalanceCalculator` — `RoundTo(4)` on Σ(debit×rate), Σ(credit×rate).
- `JournalPostingService.post` / `unpost` in `prisma.$transaction`.
- Zod DTOs + routes under existing `/api/v1/accounting/journal-entries`.

---

**Approve this schema** (reply “apply schema” or switch to Agent mode) to patch `schema.prisma`, run migrate, then implement services.
