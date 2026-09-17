# M0 — Platform Core (Migration Module)

## 1. Module Overview & Legacy Source Analysis

### Domain scope

Multi-company ERP platform: database connection, company/branch/fiscal year context, authentication, user and group definitions, menu and advanced permissions, global and company settings, document numbering helpers, audit trace, localization, and approval hooks used by every other module.

### Key Delphi files

| Area | Units (`.pas` / `.dfm`) |
|------|-------------------------|
| Kernel | [untgeneral.pas](../../../MainProgram/untgeneral.pas), [G_Variables.pas](../../../MainProgram/G_Variables.pas) |
| Shell | [UntMain.pas](../../../MainProgram/UntMain.pas), [untlogin.pas](../../../MainProgram/untlogin.pas) |
| Organization | [untCompany.pas](../../../MainProgram/untCompany.pas), [untBranch.pas](../../../MainProgram/untBranch.pas), [untYear.pas](../../../MainProgram/untYear.pas), [UntUserBranches.pas](../../../MainProgram/UntUserBranches.pas), [UntBranchType.pas](../../../MainProgram/UntBranchType.pas) |
| Security | [untUserDefinition.pas](../../../MainProgram/untUserDefinition.pas), [untGroupDefinition.pas](../../../MainProgram/untGroupDefinition.pas), [untMenuRights.pas](../../../MainProgram/untMenuRights.pas), [untAdvancedRights.pas](../../../MainProgram/untAdvancedRights.pas), [OtherModulesRights](../../../MainProgram/DataBase.ini) (table) |
| Settings | [untSetting.pas](../../../MainProgram/untSetting.pas), [untcompanyvariables.pas](../../../MainProgram/untcompanyvariables.pas), [untbranchvariables.pas](../../../MainProgram/untbranchvariables.pas) |
| i18n | [untLangMessages.pas](../../../MainProgram/untLangMessages.pas), [untLangLabels.pas](../../../MainProgram/untLangLabels.pas), [untLangReports.pas](../../../MainProgram/untLangReports.pas), [Translation/](../../../MainProgram/Translation/) |
| Ops | [UntApproval.pas](../../../MainProgram/UntApproval.pas), [untTrace.pas](../../../MainProgram/untTrace.pas), [UntUpdateDatabase.pas](../../../MainProgram/UntUpdateDatabase.pas) |
| License (legacy) | [smAppLisence.pas](../../../MainProgram/smAppLisence.pas) → M21 |

### Underlying database tables

| Table | Role |
|-------|------|
| `Company`, `CompanySetting` | Tenant root, key/value settings (`GLPost`, serial modes, warnings) |
| `Branch`, `UserBranches` | Branch master + user scope |
| `Year` | Fiscal periods (open/closed) |
| `UserDefinition`, `GroupDefinition`, `AdvancedRights`, `HiddenScreen` | Users, groups, fine-grained rights |
| `InternalSettings`, `Version` | System metadata |
| `Trace`, `ActionsHistory` | User action log |
| `Langs`, `LangMessages`, `LangFormsTitles`, `LangLabelCaptions`, `LangReportCaptions`, `LangReportsTitles` | UI translation |
| `UserApproval`, `DocumentApproval` | Approval workflow hooks |
| `Alarms` | Cross-module alerts |

Column definitions for core tables are in [DataBase.ini](../../../MainProgram/DataBase.ini) under `[Company]`, `[Branch]`, `[UserDefinition]`, etc.

---

## 2. Business Logic, Formulas & Accounting Rules

### Core operations & flows

1. **Login:** `untlogin` → sets active company/branch/user → loads `GroupDefinition` / menu rights → gates `UntMain` menu visibility.
2. **Session context:** All transactional SQL filters by `CompanyCode`, usually `BranchCode`, and often `YearId` derived from document date via `GetPeriod`.
3. **Period resolution:** `GetPeriod(Date)` returns fiscal `YearId`, `0` (invalid), or `Close` (locked year)—blocks save on GL and inventory (see M1/M4).
4. **Numbering:** `CreateGlNumSpecial`, `CreateCashNum`, invoice serials—read `CompanySetting` (`SerialStart*`, continuous vs yearly). GL numbers: 8-digit zero-padded max+1 ([untgeneral.pas](../../../MainProgram/untgeneral.pas) ~5490–5502).
5. **Permissions:** Menu item enable/disable + `AdvancedRights`; unlicensed mode caps records (`UnLisencedRecords`, [UntGL SaveBtn](../../../MainProgram/UntGL.pas) ~1484).
6. **Trace:** `Save_Trace` on post/unpost/delete for compliance.

### Calculations & math

- Not financial; **serial arithmetic** only (max+1 with padding).
- Hijri/Greg conversion on dates ([GregHijDates.pas](../../../MainProgram/GregHijDates.pas), used across forms).

### Accounting & journal entry generation

M0 does not post GL; it supplies **company flags** consumed by M1:

- `company.GLPost` / `GLUnPost` — enable post/unpost buttons on `UntGL`.
- `ShowSaveWarning` — confirmation before save.

### Validation rules & edge cases

- Closed fiscal year → save rejected (message 2189).
- Missing Hijri date on GL → save rejected (2185).
- Replication mode (`RepClass`) may append audit SQL to every exec—Node uses explicit audit middleware instead.
- Branch mismatch: GL post buttons require `FormdatasetBranchCode = untmain.branch.branchcode`.

---

## 3. Architecture Modernization & Refactoring Plan

### Legacy smells & bottlenecks

- Monolithic `untgeneral` with dynamic SQL string concatenation (SQL injection risk if ever exposed).
- Permissions enforced in UI only (menu/button state), not consistently on DB.
- Global `FrmMain` singleton state (`untmain.company`, `untmain.branch`).
- Settings as EAV `CompanySetting.Name/Value` without typing.

### Target modern architecture

| Layer | Responsibility |
|-------|----------------|
| **Controller** | HTTP + Zod DTO; requires `X-Company-Id`, `X-Branch-Id`, `X-Fiscal-Year-Id` (or derives year from date). |
| **Service** | `TenantContext`, `PermissionService`, `NumberSequenceService`, `FiscalPeriodService`. |
| **Repository** | Prisma queries scoped by `companyId`; no raw SQL in controllers. |

**Transaction boundaries:** User/permission changes in single `$transaction`; numbering uses **`SELECT … FOR UPDATE`** on sequence row (replace max+1 race).

**Replace:** Desktop license checks → subscription `entitlements` (M21); replication → event outbox optional.

---

## 4. Target Prisma Models & Data Schema

Extend existing models in [schema.prisma](../../../gates-backend/prisma/schema.prisma):

```prisma
model FiscalYear {
  id          String   @id @default(uuid())
  companyId   String
  legacyYearId String  // maps Year.YearId
  startDate   DateTime
  endDate     DateTime
  status      String   // Open | Close
  branchId    String?  // if years are branch-specific in import
  company     Company  @relation(fields: [companyId], references: [id])
  @@unique([companyId, legacyYearId])
  @@map("fiscal_years")
}

model CompanySettingEntry {
  id        String @id @default(uuid())
  companyId String
  name      String // e.g. SerialStartGL, AutoPostGL
  value     String
  @@unique([companyId, name])
  @@map("company_setting_entries")
}

model DocumentSequence {
  id           String @id @default(uuid())
  companyId    String
  branchId     String?
  fiscalYearId String?
  docType      String // GL, CashBP, InvoiceRI, ...
  scope        String // C=continuous, Y=yearly
  lastNumber   Int    @default(0)
  @@unique([companyId, branchId, fiscalYearId, docType])
  @@map("document_sequences")
}

model MenuPermission {
  id              String @id @default(uuid())
  userGroupId     String
  menuKey         String // stable key mapped from HiddenScreen
  canView         Boolean @default(false)
  canAdd          Boolean @default(false)
  canEdit         Boolean @default(false)
  canDelete       Boolean @default(false)
  canPost         Boolean @default(false)
  @@map("menu_permissions")
}
```

Map legacy `UserDefinition` → `User`, `GroupDefinition` → `UserGroup`, `Trace` → `ActivityLog`, `InternalSettings` → `SystemSetting`.

Use `@db.Decimal(18, 4)` for any numeric setting that mirrors legacy decimals when imported.

---

## 5. API Endpoint Specifications

| Method | Route | Body / params | Response | Permission |
|--------|-------|---------------|----------|------------|
| GET | `/api/v1/companies` | — | Company list | `company.view` |
| GET | `/api/v1/companies/:id/context` | — | company + branches + open years | authenticated |
| POST | `/api/v1/auth/login` | credentials | JWT + default context | public |
| GET | `/api/v1/users/me/permissions` | headers: company, branch | menu + advanced rights | authenticated |
| CRUD | `/api/v1/users`, `/user-groups` | existing DTOs | user/group | `users.manage` |
| GET/PUT | `/api/v1/company-settings` | key/value map | settings | `settings.manage` |
| GET | `/api/v1/fiscal-years` | `companyId` | open/closed years | `accounting.view` |
| POST | `/api/v1/document-sequences/next` | `{ docType, branchId?, fiscalYearId? }` | `{ nextNumber }` | internal / transactional |
| GET | `/api/v1/translation/messages` | locale | messages | authenticated |

**Production requirement:** Remove `anonymousApiContext` from [app.ts](../../../gates-backend/src/app.ts) and enforce JWT + permission middleware on all `/api/v1/*` except auth health.

---

## 6. Phased Execution & Unit Testing Strategy

### Checklist

- [ ] Import `Company`, `Branch`, `Year` from legacy CSV/SQL into Prisma with legacy code columns (`legacyCompanyCode`, etc.).
- [ ] Implement `FiscalPeriodService.getPeriod(date)` matching `GetPeriod` outcomes (`0`, `Close`, valid id).
- [ ] Implement `NumberSequenceService` with GL 8-digit padding parity.
- [ ] Map `HiddenScreen` / menu rights to `MenuPermission` seeds per role.
- [ ] Wire request context middleware: reject transactional APIs without branch/year when required.
- [ ] Port critical `CompanySetting` keys used by M1 (`GLPost`, `GLUnPost`, `SerialAutomatic`, `SaveUnbalanced`).

### Key test scenarios

1. User in group A cannot call POST `/journal-entries` if group lacks post right (403).
2. Document dated in closed year → 422 with same semantic as legacy 2189.
3. Two concurrent GL number requests → unique `legacyGlNum` per branch/year scope.
4. Imported company settings round-trip: `ShowSaveWarning`, serial continuous vs yearly.

---

**Wave 0 dependency:** Complete M0 before M1 numbering and period checks; M3/M4 inherit context headers.
